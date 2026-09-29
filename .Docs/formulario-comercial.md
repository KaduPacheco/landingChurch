# Formulário comercial

A landing envia `POST /api/leads` na mesma origem. Express e Vercel executam a mesma lógica em `lib/lead-handler.js`.

O formulário pede nome, WhatsApp com DDD, igreja, e-mail, faixa de membros e consentimento explícito de contato. Há mensagens acessíveis por campo, máscara de telefone, bloqueio durante o envio, honeypot e tratamento de falhas sem apagar os dados.

Uma resposta bem-sucedida com `{ "ok": true }` redireciona para `/obrigado`. Não existe fallback por e-mail. Se o JavaScript estiver desativado, a página informa a necessidade de ativá-lo; o link de contato via WhatsApp continua disponível.

Parâmetros de campanha são encaminhados apenas após aceitação das ferramentas opcionais. Eventos de formulário não contêm os valores dos dados pessoais.

Consulte [BACKEND.md](../BACKEND.md) para contrato, variáveis de ambiente, notificações e limites de operação; consulte [README.md](../README.md) para executar os testes.
