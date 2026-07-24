# Formulário comercial

O formulário de demonstração está preparado para enviar leads para um endpoint HTTP configurável em `script.js`.

## Configuração

No topo de `script.js`, defina:

```js
const COMMERCIAL_FORM_ENDPOINT = "https://seu-endpoint-ou-webhook";
```

Enquanto esse valor estiver vazio, o formulário usa o fallback por e-mail definido em `COMMERCIAL_CTA_DESTINATION`.

## Método

O envio usa `POST` com `Content-Type: application/json`.

## Payload

```json
{
  "name": "Nome informado",
  "church": "Igreja informada",
  "phone": "WhatsApp informado",
  "email": "E-mail informado",
  "size": "Faixa de membros",
  "source": "landing_simplechurch",
  "page": "/index.html",
  "submittedAt": "2026-07-23T00:00:00.000Z",
  "tracking": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "campanha"
  }
}
```

Os campos de `tracking` são enviados apenas quando existem na URL. Chaves suportadas: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` e `fbclid`.

## Resposta esperada

Qualquer status HTTP `2xx` é tratado como sucesso. Status fora de `2xx` entram no fluxo de erro e mostram mensagem para o usuário.