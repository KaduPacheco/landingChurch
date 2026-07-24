# Introdução (usuário)

Bem-vindo ao **Simple Church**, sistema de gestão para igrejas.

## O que você encontra

- Cadastro de pessoas (membros, visitantes)
- Financeiro (caixa e lançamentos)
- Escola Bíblica Dominical (EBD)
- Eventos e agenda
- Carteirinhas
- Administração da igreja e congregações
- Área do membro (app)

## Como começar

1. Acesse o sistema com usuário e senha (login em layout dividido: marca à esquerda, formulário à direita no computador).
2. Selecione a congregação (se o perfil exigir).
3. Use o menu lateral (marca da igreja + seções) e o dashboard com indicadores para abrir o módulo desejado.

## Feedback na tela

O sistema usa mensagens padronizadas:

- **Sucesso** (verde) — ações concluídas
- **Erro** (vermelho) — falhas e validações
- **Atenção** (âmbar) — avisos que pedem cuidado
- **Informação** (azul-acinzentado) — orientações

Banners inline e badges de status (ativo, pendente, etc.) seguem as mesmas cores para facilitar a leitura.

## Área do membro (PWA e Android)

O app em `/app` segue a mesma identidade (teal, tipografia Plus Jakarta Sans), com home de saudação, atalhos em grade e barra inferior com destaque no item ativo. A cor da barra de status do celular acompanha a cor principal da igreja, quando configurada.

Além do PWA instalável no navegador, existe o **app Android** (Capacitor) com as mesmas funções — ver [App do membro](app-membro.md).

Na tela de login do app (`/app/login`), o membro entra com **CPF e senha**. Se estiver ativo em mais de uma igreja, escolhe qual acessar. Também há o link **Sou membro — entrar com CPF** no login da gestão (`/login`). Detalhes em [App do membro](app-membro.md).

## Perfis

Permissões variam por perfil. Em caso de acesso negado, solicite ao administrador da igreja a liberação da função.

> Detalhes por módulo nos arquivos desta pasta.

