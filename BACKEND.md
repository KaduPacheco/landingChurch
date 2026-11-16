# Captação de contatos sem Supabase

A página comercial envia os contatos diretamente ao n8n pelo servidor. Não consulta nem grava no Supabase. O banco do produto de gestão das igrejas permanece fora deste fluxo. As migrações antigas ficam como histórico; não executar novas migrações para esta captação.

## Configuração antes da publicação

1. Definir `N8N_WEBHOOK_URL` (HTTPS) e `N8N_WEBHOOK_TOKEN` nos ambientes Preview e Production da hospedagem. Nenhum destino padrão permanece no código.
2. No Webhook do n8n, configurar Header Auth: nome `Authorization`, valor `Bearer <mesmo token>`. Usar a URL de produção do workflow ativo.
3. Preservar os campos do payload abaixo. O `id` passa a ser um UUID da requisição, sem relação com uma linha do Supabase. Remover do workflow qualquer consulta obrigatória a `demo_leads` ou atualização de status nessa tabela.
4. Registrar o contato em armazenamento controlado pelo fluxo (por exemplo, Google Sheets). Usar `id` como chave de deduplicação. Uma consulta e inserção simples em Sheets não é atômica: serializar execuções se usar esse método.
5. Somente após o registro durável, responder pelo nó Respond to Webhook com HTTP 200 e JSON `{ "ok": true, "id": "<id recebido>" }`. No n8n, usar a expressão do id do Webhook, por exemplo `$('Webhook').item.json.body.id` (ajustar o nome real do nó).
6. Em retry de um id já registrado, retornar a mesma confirmação sem duplicar a linha. Notificações e mensagens comerciais são etapas separadas do registro; o site não comprova a entrega dessas mensagens.
7. Em erro de registro, retornar status não-2xx. O retorno padrão “Workflow was started” não é confirmação.
8. Verificar o fluxo com um contato de teste autorizado antes de integrar à produção. Nenhum contato real foi enviado durante a implementação.

O link direto do WhatsApp funciona mesmo sem essas configurações. Sem credenciais, com timeout ou resposta inesperada, o formulário informa que o registro não foi confirmado e oferece continuar pelo WhatsApp. Um timeout não prova que o n8n deixou de gravar, portanto o retry reutiliza o mesmo id enquanto os dados não forem editados.

## Contrato

`POST /api/leads`, `Content-Type: application/json`, máximo 32 KiB.

Obrigatórios: `name` (2–120), `church` (2–160), `phone` (DDD brasileiro), `privacyConsent: "yes"`.
Opcionais: `email`, `size` (Até 100, 101 a 500, 501 a 1.000, Mais de 1.000), `page`, `tracking`, `requestId` (UUID).
Campos opcionais vazios são aceitos. O honeypot `companyWebsite` deve estar vazio.

Payload encaminhado: `id, name, church, phone, email, size, source, page, submittedAt, privacyConsent, tracking`. Fonte e horário são definidos no servidor. O consentimento inclui `privacy_consent`, `consent_version` e `consent_at` em tracking. IP é usado apenas pelo limitador, não encaminhado no payload.

| Status | Significado |
| --- | --- |
| 201 | Registro confirmado pelo workflow: `{ "ok": true, "id": "..." }` |
| 204 | Preflight autorizado |
| 400 | Campos, JSON ou honeypot inválidos |
| 403 | Origem recusada |
| 405 | Método não permitido |
| 413 | Corpo muito grande |
| 415 | Content-Type incorreto |
| 429 | Limite atingido, com Retry-After |
| 503 | Configuração ausente ou registro não confirmado |

## Proteções e limites

HTTPS obrigatório, redirecionamentos do webhook recusados, token privado, timeout de 8 segundos, validação no servidor, honeypot, origem restrita e limite de 12 tentativas por IP/15 minutos por processo. CORS não é autenticação nem impede robôs. Em serverless os contadores não são globais; configurar WAF na hospedagem para proteção distribuída. Turnstile não foi ativado: exigiria chaves e integração próprias.

Não há fila de reenvio no site nem deduplicação durável local. O id enviado em `Idempotency-Key` e no corpo permite ao n8n implementar deduplicação; o cabeçalho por si só não a garante. Sem id do navegador, o servidor gera um UUID. Após recarga ou edição dos dados, pode haver novo id.

`ALLOWED_ORIGINS` permite origens adicionais. `TRUST_PROXY_HOPS` só deve ser configurado para um proxy Express conhecido.

## Verificação

`npm ci && npm run verify`: sintaxe, testes de backend e build.
`npm run test:browser`: responsividade, acessibilidade e fluxos com API simulada; não cria leads reais.
Os testes cobrem ausência de Supabase, autenticação, confirmação explícita, falhas, validação, campos opcionais, consentimento e repetição do id.

Analytics continuam dependentes do consentimento opcional. Um clique no WhatsApp é intenção de contato, não venda nem registro confirmado. Dados pessoais não são enviados aos eventos de analytics.
