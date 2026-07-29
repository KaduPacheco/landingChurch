# Backend SimpleChurch

Backend Node/Express para receber solicitacoes de demonstracao da landing page e gravar os leads no Supabase.

## Configuracao

1. Crie o projeto no Supabase.
2. Execute o SQL em `supabase/migrations/001_create_demo_leads.sql` no SQL Editor do Supabase.
3. Copie `.env.example` para `.env` e preencha:
   - `SUPABASE_URL`: URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role` do Supabase. Use somente no servidor.
   - `ALLOWED_ORIGINS`: dominios que podem chamar a API quando a pagina estiver hospedada fora deste servidor.

## Rodando localmente

```bash
npm install
npm run dev
```

A pagina fica disponivel em `http://localhost:3000` e o formulario envia para `POST /api/leads`.

## Endpoint

`POST /api/leads`

Campos esperados:

```json
{
  "name": "Nome",
  "church": "Igreja",
  "phone": "(00) 00000-0000",
  "email": "contato@igreja.com.br",
  "size": "101 a 500",
  "source": "landing_simplechurch",
  "page": "/",
  "tracking": {
    "utm_source": "google"
  }
}
```

O endpoint valida os dados, aplica limite de requisicoes por IP e insere na tabela `public.demo_leads`.

## Analytics

Os eventos do formulario e CTAs sao enviados para `window.dataLayer` e para o evento customizado `simplechurch:conversion`.

Configure os IDs reais nas variáveis de ambiente da Vercel. O build valida os formatos e gera `dist/analytics-config.js`:

```env
GTM_ID=GTM-XXXXXXX
GA4_ID=G-XXXXXXXXXX
META_PIXEL_ID=000000000000000
ANALYTICS_DIRECT_FORWARDING=false
```

Quando `GTM_ID` estiver definido, o encaminhamento direto fica desativado por padrão para evitar eventos duplicados. Use `ANALYTICS_DIRECT_FORWARDING=true` apenas quando GA4 e Meta não forem disparados pelo GTM.
Eventos emitidos:

- `commercial_cta_click`
- `navigation_click`
- `mobile_menu_toggle`
- `hero_secondary_click`
- `resource_interest`
- `faq_toggle`
- `demo_form_start`
- `demo_form_validation_error`
- `demo_form_submit_attempt`
- `demo_form_submit_success`
- `demo_form_submit_error`

Se o GA4 e o Meta Pixel forem disparados por tags dentro do GTM, mantenha apenas `gtmId` preenchido ou defina `directEventForwarding: false` para evitar duplicidade.

## Checklist publico

Antes de trafego pago, valide na URL final:

- formulario enviando para `POST /api/leads` com resposta `201`;
- `ALLOWED_ORIGINS` contendo exatamente os dominios publicos da landing;
- preview OG com `https://simplechurch.com.br/assets/simplechurch-logo-principal.png`;
- tags de analytics recebendo os eventos esperados;
- `privacidade.html` e `termos.html` revisados por advogado antes de uso formal.
