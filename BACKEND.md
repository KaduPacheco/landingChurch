# Captação de contatos sem Supabase

A página comercial envia os contatos diretamente ao n8n pelo servidor. Não consulta nem grava no Supabase. O banco do produto de gestão das igrejas permanece fora deste fluxo. As migrações antigas ficam como histórico; não executar novas migrações para esta captação.

## Workflow atual: notificação comercial

Configure `N8N_WEBHOOK_URL` como variável privada HTTPS e `N8N_WEBHOOK_MODE=legacy_notification`. O workflow fornecido não usa Header Auth e responde `{ "ok": true, "protocolo": "<id recebido>" }` depois do nó de aviso comercial. A API exige correspondência entre protocolo e id. Não há destino padrão no código.

Esse modo confirma encaminhamento ao fluxo comercial, não armazenamento em banco/planilha, entrega ou leitura de WhatsApp. O fluxo existente não tem deduplicação durável. Não há repetição automática: uma nova tentativa após timeout pode duplicar um aviso. O link direto do WhatsApp permanece independente.

## Modo autenticado opcional

Para adotar Header Auth no n8n, configure `Authorization: Bearer <token>`, defina `N8N_WEBHOOK_TOKEN` privado e remova `N8N_WEBHOOK_MODE`. Nesse modo a resposta deve ser `{ "ok": true, "id": "<id recebido>" }`. Aplique as alterações de servidor e workflow em conjunto.

Se adicionar persistência em planilha, faça a confirmação após gravar e implemente deduplicação pelo id. O site não oferece persistência ou fila. Um cabeçalho Idempotency-Key sozinho não garante deduplicação. Nenhum envio real de teste foi realizado durante esta implementação.

## Contrato

`POST /api/leads`, `Content-Type: application/json`, máximo 32 KiB.

Obrigatórios: `name` (2–120), `church` (2–160), `phone` (DDD brasileiro), `privacyConsent: "yes"`.
Opcionais: `email`, `size` (Até 100, 101 a 500, 501 a 1.000, Mais de 1.000), `page`, `tracking`, `requestId` (UUID).
Campos opcionais vazios são aceitos. O honeypot `companyWebsite` deve estar vazio.

Payload encaminhado: `id, name, church, phone, email, size, quantidadeMembros, source, page, submittedAt, privacyConsent, tracking`. Fonte e horário são definidos no servidor. O consentimento inclui `privacy_consent`, `consent_version` e `consent_at` em tracking. IP é usado apenas pelo limitador, não encaminhado no payload.

| Status | Significado |
| --- | --- |
| 201 | Encaminhamento confirmado pelo workflow: `{ "ok": true, "id": "..." }` |
| 204 | Preflight autorizado |
| 400 | Campos, JSON ou honeypot inválidos |
| 403 | Origem recusada |
| 405 | Método não permitido |
| 413 | Corpo muito grande |
| 415 | Content-Type incorreto |
| 429 | Limite atingido, com Retry-After |
| 503 | Configuração ausente ou registro não confirmado |

## Proteções e limites

HTTPS obrigatório, redirecionamentos do webhook recusados, token privado no modo autenticado, timeout de 8 segundos, validação no servidor, honeypot, origem restrita e limite de 12 tentativas por IP/15 minutos por processo. CORS não é autenticação nem impede robôs. Em serverless os contadores não são globais; configurar WAF na hospedagem para proteção distribuída. Turnstile não foi ativado: exigiria chaves e integração próprias.

Não há fila de reenvio no site nem deduplicação durável local. O id enviado em `Idempotency-Key` e no corpo permite ao n8n implementar deduplicação; o cabeçalho por si só não a garante. Sem id do navegador, o servidor gera um UUID. Após recarga ou edição dos dados, pode haver novo id.

`ALLOWED_ORIGINS` permite origens adicionais. `TRUST_PROXY_HOPS` só deve ser configurado para um proxy Express conhecido.

## Verificação

`npm ci && npm run verify`: sintaxe, testes de backend e build.
`npm run test:browser`: responsividade, acessibilidade e fluxos com API simulada; não cria leads reais.
Os testes cobrem ausência de Supabase, autenticação, confirmação explícita, falhas, validação, campos opcionais, consentimento e repetição do id.

Analytics continuam dependentes do consentimento opcional. Um clique no WhatsApp é intenção de contato, não venda nem registro confirmado. Dados pessoais não são enviados aos eventos de analytics.
