# Rota PCMG — passo a passo (iPhone + PC com Windows)

O app guarda tudo no próprio aparelho: plano do dia com cartão-resposta, registro de questões, caderno de erros com revisão em 1/7/30 dias, evolução rumo aos 80% e o resumo para a revisão de sábado às 9h.

## Parte 1 — Colocar o app no ar (10 minutos)

1. No PC, descompacte o arquivo `rota-pcmg.zip`. Você deve ver a pasta **rota-pcmg** com `index.html`, `app.js` e outros arquivos dentro.
2. Abra https://app.netlify.com/drop no navegador. Crie uma conta gratuita (pode usar o Google).
3. Arraste a **pasta rota-pcmg inteira** para a área "Drag and drop your site output folder here".
4. O Netlify gera um endereço (algo como `https://nome-aleatorio.netlify.app`). Copie esse endereço. Se quiser, em *Site configuration > Change site name* troque por um nome fácil, como `rota-vi`.

Para atualizar o app no futuro (quando eu te mandar uma versão nova): em *Deploys* do seu site, arraste a pasta nova no mesmo lugar. Os seus dados não se perdem, porque ficam no iPhone.

## Parte 2 — Instalar no iPhone

1. No iPhone, abra o endereço **no Safari** (precisa ser o Safari).
2. Toque no botão Compartilhar (quadrado com seta) > **Adicionar à Tela de Início** > Adicionar.
3. A partir de agora, **abra sempre pelo ícone "Rota PCMG"**, não pelo Safari. É isso que libera as notificações no iPhone.

## Parte 3 — Notificações pelo OneSignal

Eu não consegui testar isso no seu iPhone, e a tela do OneSignal pode estar diferente do que descrevo. Se travar em algum passo, me mande um print.

1. Crie a conta gratuita em https://onesignal.com e um app novo (nome: Rota PCMG).
2. Em *Settings > Push & In-App > Web*, ative a plataforma Web. Escolha a integração **Custom Code**.
3. Em *Site Name*, coloque "Rota PCMG". Em *Site URL*, o endereço do Netlify da Parte 1. Marque a opção de **iOS/PWA** se ela aparecer, e salve.
4. Copie o **App ID** (um código com letras, números e traços).
5. No iPhone, abra o app pelo ícone > aba **Mais** > cole o App ID > **Salvar ID** > **Ativar avisos** > permita as notificações.
6. No OneSignal, vá em *Messages > New Push*, escolha *Subscribed Users* e envie um teste para ver se chega.

**Mensagens nos horários fixos (6:15, 13:00 e 21:30).** No OneSignal, tente agendar três mensagens com envio em horário definido. Não consegui confirmar se o plano gratuito oferece envio recorrente (todo dia no mesmo horário). Se não oferecer, ou se der trabalho, use a Parte 4: ela cobre exatamente esses três horários sem depender de servidor.

O app não envia notificação sozinho. Quem dispara é o OneSignal (Parte 3) ou o Atalhos (Parte 4).

## Parte 4 — Lembretes fixos pelo app Atalhos (funciona hoje, sem conta)

1. Abra o app **Atalhos** > aba **Automação** > **+** > **Hora do dia**.
2. Escolha 6:15, "Diariamente", e marque **Executar imediatamente** (se pedir).
3. Adicione a ação **Mostrar notificação**. Use um dos textos do arquivo `mensagens-atalhos.md` (um por horário).
4. Repita para 13:00 e 21:30.

Dica: se quiser variar o texto, crie a ação **Escolher item aleatório da lista** com várias mensagens e ligue ao "Mostrar notificação".

## Rotina de uso

- **Manhã (6:15):** abra "Hoje", veja o foco do dia, estude.
- **Ao estudar:** registre as questões na aba Questões e os erros na aba Erros (uma linha por erro).
- **Noite (21:30):** marque as tarefas e feche o dia com sua energia.
- **Sábado, 9h:** aba Mais > **Gerar resumo** > copie e cole no chat com o Claude.
- **Uma vez por semana:** aba Mais > **Copiar backup** e cole nas suas Notas.

## Sobre os dados

- Tudo fica no `localStorage` do app, neste iPhone. Se você apagar o app ou limpar os dados do Safari, perde o histórico. Por isso o backup.
- O iOS pode limpar o armazenamento de sites que você não abre por muito tempo. Abrir o app todo dia já resolve.
- Os números "Base ago–out" vêm dos prints que você enviou (Tec Concursos). As matérias do edital que não são de investigador entram em "Outras".

## Alternativa: publicar pelo GitHub Pages (em vez do Netlify)

1. Crie um repositório **público** novo no GitHub (ex.: `rota-pcmg`).
2. Descompacte o zip. Abra a pasta `rota-pcmg` e selecione **o que está dentro dela** (index.html, app.js, styles.css, sw.js, manifest.webmanifest, a pasta icons, os dois .md). Arraste esse conteúdo para a página do repositório (*Add file > Upload files*) e clique em *Commit changes*.
   `index.html` precisa ficar na raiz do repositório, não dentro de outra pasta.
3. Em *Settings > Pages*, em *Source* escolha *Deploy from a branch*, branch `main`, pasta `/ (root)` e salve. Em 1 a 2 minutos o endereço aparece: `https://SEU-USUARIO.github.io/rota-pcmg/`.
4. Use esse endereço (com a barra no final) na instalação do iPhone e no campo *Site URL* do OneSignal.
Repositório público significa que qualquer pessoa vê o código. Os seus dados de estudo **não** ficam lá, só no seu iPhone.
