# Backend SimpleChurch

## Configuração

1. Execute, na ordem, `supabase/migrations/001_create_demo_leads.sql` e `002_add_lead_webhook_status.sql` caso ainda não estejam aplicadas.
2. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor. A tabela mantém RLS habilitado; o formulário não acessa o banco diretamente.
3. Configure `ALLOWED_ORIGINS` para clientes de outras origens. A origem exata do próprio site é permitida automaticamente.
4. Defina `N8N_WEBHOOK_URL` com o destino HTTPS desejado. Uma string vazia desativa notificações. Para preservar instalações existentes, a variável ausente mantém o destino legado já utilizado pelo repositório.

`TRUST_PROXY_HOPS` se aplica apenas ao Express atrás de um proxy conhecido. Sem configuração, cabeçalhos de IP enviados pelo cliente não são confiáveis. Na função Vercel, o adaptador usa o encaminhamento da plataforma.

## Contrato HTTP

`POST /api/leads`, `Content-Type: application/json`, corpo limitado a 32 KiB.

```json
{
  "name": "Maria Alves",
  "church": "Comunidade Central",
  "phone": "(21) 97434-0508",
  "email": "maria@example.com",
  "size": "101 a 500",
  "privacyConsent": "yes",
  "companyWebsite": "",
  "page": "/",
  "tracking": { "utm_source": "google" }
}
```

- `size`: `Até 100`, `101 a 500`, `501 a 1.000` ou `Mais de 1.000`.
- `privacyConsent`: obrigatório e explicitamente igual a `yes`.
- `companyWebsite`: honeypot; deve estar vazio para visitantes reais.
- `tracking`: somente `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` e `fbclid`, com até 500 caracteres por valor. O navegador envia esses dados somente após consentimento opcional.
- `source` e horário de recebimento são definidos pelo servidor. O cliente não controla o horário persistido.

Respostas:

| Status | Significado                               |
| ------ | ----------------------------------------- |
| 201    | Lead persistido; `{ "ok": true }`         |
| 202    | Honeypot preenchido; nenhuma persistência |
| 204    | Preflight permitido                       |
| 400    | JSON ou campos inválidos                  |
| 403    | Origem recusada                           |
| 405    | Método não permitido                      |
| 413    | Corpo excedeu o limite                    |
| 415    | Tipo de conteúdo incorreto                |
| 429    | Limite atingido; inclui `Retry-After`     |
| 503    | Persistência indisponível                 |

As respostas não são armazenadas em cache. O cliente só redireciona para `/obrigado` após uma resposta HTTP de sucesso com `ok: true`. Falhas preservam os campos preenchidos.

## Persistência e notificações

O consentimento de contato, a versão do texto e o horário são registrados no JSON `tracking`, usando a estrutura existente da tabela. As credenciais não entram no build público nem nos logs de erro.

O cadastro é salvo antes da notificação. Falhas no webhook ou na atualização de seu status não alteram a resposta de sucesso de um lead já salvo. Notificações usam HTTPS, recusam redirecionamentos e têm prazo de 3 segundos. Operações do banco têm prazo de 5 segundos; o navegador aguarda até 20 segundos.

`webhook_status` fica `sent` quando o destino responde com sucesso, `failed` quando falha e `pending` quando a notificação não foi executada ou não foi possível atualizar o status. Não há reprocessamento automático neste repositório.

## Proteção e limites

O limitador permite 12 tentativas por IP a cada 15 minutos por processo. Expira entradas e limita a memória a 10 mil origens. Em múltiplas instâncias/serverless, os contadores não são globais: para tráfego elevado, aplique um limite compartilhado ou uma regra no firewall da plataforma.

O formulário tem proteção contra clique duplicado durante o envio. Não existe idempotência persistida entre requisições ou recargas: uma conexão perdida após a gravação ainda pode gerar duplicidade ao tentar novamente.

## Analytics

Defina os IDs em variáveis de ambiente antes do build:

```env
GTM_ID=
GA4_ID=
META_PIXEL_ID=
ANALYTICS_DIRECT_FORWARDING=
```

O build valida os formatos e gera `dist/analytics-config.js`. O consentimento opcional é separado da autorização de contato comercial. GTM tem prioridade; GA4/Meta diretos só são inicializados junto ao GTM quando o encaminhamento direto foi explicitamente habilitado. Evite habilitá-lo se o container já dispara os mesmos eventos.

Eventos: `commercial_cta_click`, `navigation_click`, `mobile_menu_toggle`, `hero_secondary_click`, `resource_interest`, `faq_toggle`, `demo_form_start`, `demo_form_validation_error`, `demo_form_submit_attempt`, `demo_form_submit_success` e `demo_form_submit_error`. Dados pessoais do formulário não são incluídos nesses eventos. GA4 recebe `generate_lead` e Meta recebe `Lead` após sucesso; um simples clique no CTA não é contado como lead.
