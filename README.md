# SimpleChurch

Landing page do SimpleChurch com HTML semântico, CSS responsivo e JavaScript progressivo. Captação de leads com Node/Express ou Vercel Functions e persistência no Supabase.

## Desenvolvimento

Requer Node 22 ou 24. A validação desta revisão foi executada com Node 24.

```sh
npm ci
```

Copie `.env.example` para `.env` e configure os valores do servidor. Nunca inclua credenciais nos arquivos públicos.

```sh
npm run dev
```

Acesse `http://localhost:3000`. A porta pode ser definida por `PORT`.

## Qualidade

```sh
npm run verify        # sintaxe, testes de backend e build
npm run test:browser  # Chrome instalado: responsividade, acessibilidade e conversão
npm run format:check # formatação
npm audit            # consulta atualizada de dependências
```

Os testes de navegador iniciam um servidor isolado sem carregar `.env` e interceptam o endpoint do formulário. Não criam leads reais nem acionam notificações comerciais. Os testes de backend usam armazenamento e notificações simulados.

Para conectar um Chrome de testes já iniciado, configure `TEST_CDP_URL`. `TEST_BASE_URL` permite verificar um servidor específico. Capturas e relatório são gravados em `visual-validation/`, ignorado pelo Git. O teste visual cobre 320, 375, 430, 768, 1024 e 1440 pixels; a análise automática de acessibilidade usa axe-core, com regras WCAG A/AA.

## Organização

- `index.html`, `styles.css`, `script.js`: apresentação, navegação e formulário.
- `analytics.js`: preferências e carregamento condicional de analytics.
- `lib/lead-handler.js`: regras HTTP comuns aos dois ambientes.
- `lib/leads.js`: validação, persistência e notificações.
- `lib/app.js`, `server.js`: servidor Express e arquivos públicos permitidos.
- `api/leads.js`: adaptador Vercel.
- `lib/security.js`: política de segurança; o build verifica a paridade com `vercel.json`.
- `scripts/`: build, validação de referências, sintaxe e navegador.
- `.Docs/`: documentação funcional do produto usada como referência editorial; não é o código do aplicativo SaaS.

## Publicação

`npm run build` gera apenas arquivos públicos em `dist/`. A Vercel usa esse diretório e a função `api/leads.js`. Para Express em produção, execute o build e inicie com `NODE_ENV=production` para servir `dist/`.

IDs de analytics são lidos no build. Sem IDs configurados, não há carregamento de provedores. Com IDs, o carregamento depende de consentimento; o rodapé permite alterar a preferência. Quando GTM gerencia os provedores, o encaminhamento direto fica desabilitado por padrão.

Veja [BACKEND.md](BACKEND.md) para configurar integrações e [AUDITORIA.md](AUDITORIA.md) para os achados, correções e limites da validação.
