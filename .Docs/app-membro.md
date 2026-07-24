# App do membro (PWA e Android)

O app do membro fica em **`/app`**. É a área mobile para consultar dados, carteirinha, eventos, EBD e financeiro pessoal.

Há duas formas de usar a mesma experiência:

1. **PWA no navegador** — acesse `/app` e, se quiser, adicione à tela inicial.
2. **App Android (Capacitor)** — ícone na loja ou APK interno; abre o mesmo `/app` em WebView.

## Como entrar

1. Abra **`/app/login`**, o atalho do PWA, o app Android, ou o link **Sou membro — entrar com CPF** na tela de login da gestão (`/login`).
2. Informe **CPF** e **senha**.
3. Toque em **Entrar**.
4. Se o CPF estiver ativo em **mais de uma igreja** (com a mesma senha), o app pergunta em qual igreja você deseja entrar — escolha na lista.
5. Se houver apenas uma igreja compatível, o acesso é direto.

### Dicas

- Link com `?tenant=<id>` (após convite/ativação) já associa a igreja; o login valida CPF e senha nessa igreja.
- Biometria (Face ID / impressão digital) no navegador fica disponível quando a igreja já está conhecida (ex.: após convite ou login anterior). No app Android, prefira CPF e senha se a biometria web não responder.
- Só membros com situação **ATIVO** e conta do app já ativada conseguem entrar.

## Primeiro acesso

1. A secretaria envia o **link de convite** (`/app/ativar/<token>`).
2. O membro cria a senha.
3. Em seguida faz login em `/app/login` (a igreja já vem no link).

Com o app Android instalado e App Links configurados, o link de convite pode abrir direto no app.

Sem o convite, o membro entra com CPF e senha se a conta do app já tiver sido ativada em alguma igreja.

## Após o login

Navegação inferior: **Início**, **Eventos**, **Cartão**, **EBD** e **Perfil**. Financeiro (dízimos/ofertas) acessa-se pelo Início. O branding (cores/logo) segue a configuração da igreja.

## Obter o app Android

- **Google Play** — quando a publicação estiver ativa, busque por SimpleChurch (pacote `br.com.simplechurch.membro`).
- **APK interno** — a equipe pode fornecer um APK de teste assinado; instalação exige “fontes desconhecidas” conforme a política do dispositivo.

No app nativo o banner “Instalar na tela inicial” não aparece (já é o app instalado).

Guia técnico de build (Capacitor, emulador, release): [App Android (Capacitor)](../tecnico/android-capacitor.md).
