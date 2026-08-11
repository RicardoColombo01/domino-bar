# A Fase 5 — o jogo como aplicativo

**O que está pronto aqui, e o que só você pode fazer.** Esta pasta existe para que a Fase 5
custe uma tarde e não uma investigação: o PWA já está de pé desde a v3.0.0 (manifest, ícones,
service worker, abrir sem internet), e o que falta é embrulhar aquilo num APK.

O caminho é o **TWA** (Trusted Web Activity): o Android abre o **site**, na mesma origem
`https://`, dentro de uma janela sem barra de URL. Não é um WebView empacotado, e a diferença
não é estética — **o `localStorage` continua sendo o mesmo do site**, e com ele o
`dominobar.cliente`, que é a identidade que devolve a cadeira certa a quem cai no meio de uma
partida online. Um Capacitor da vida trocaria a origem e reabriria o item 4 da Fila 5 pela
porta do empacotador.

---

## O QUE TRAVA, e é conta e não código

**O TWA exige um arquivo na RAIZ DO DOMÍNIO**, e o jogo mora numa *project page*:

```
https://ricardocolombo01.github.io/domino-bar/     ← 200, é o jogo
https://ricardocolombo01.github.io/               ← 404
https://ricardocolombo01.github.io/.well-known/assetlinks.json   ← 404
```

Sem esse arquivo o Android não consegue provar que o aplicativo e o site são da mesma pessoa,
e a janela abre **com barra de URL** — ou seja, não passa por aplicativo. Ele é o único
bloqueio real da fase.

**Só você pode destravar**, e a razão é medida e não suposta: a credencial `gh` desta máquina
é da conta `Ricardo-Colombo-pixaflow`, que tem `push: true` e **`admin: false`** neste
repositório; `RicardoColombo01` é outra conta de usuário. Criar um repositório **na sua conta**
não está ao alcance daqui.

### O que fazer (uma vez, ~5 minutos)

1. Criar o repositório público **`ricardocolombo01.github.io`** (o nome tem de ser exatamente
   esse — é o que faz o GitHub servi-lo na raiz do domínio).
2. Copiar para ele o conteúdo de **`twa/user-page/`**, que está pronto nesta pasta.
3. Settings → Pages → *Deploy from a branch* → `main` → `/ (root)`.

> **O `.nojekyll` NÃO É OPCIONAL, e o sintoma engana.** O GitHub Pages passa o site pelo
> Jekyll, e o Jekyll **ignora em silêncio toda pasta que começa com ponto** — inclusive
> `.well-known/`. Sem o arquivo vazio `.nojekyll` na raiz, você recebe um 404 que parece erro
> de caminho e vai procurar no lugar errado. Ele já está em `twa/user-page/`.

---

## Depois, o APK

### 1. A chave de assinatura — a decisão que não dá para desfazer

```
"C:\Program Files\Java\jdk-17\bin\keytool.exe" -genkeypair -v ^
  -keystore domino-bar.keystore -alias domino-bar ^
  -keyalg RSA -keysize 2048 -validity 10000
```

**Ela não está gerada aqui de propósito.** A keystore é a identidade permanente do
aplicativo: quem a tem publica atualizações, quem a perde **não consegue mais atualizar o app
publicado** — nem você. A senha é sua, o backup é seu, e nada disso deve passar por mim nem
entrar no repositório. O `.gitignore` já recusa `*.keystore` e `*.jks`.

Guarde em dois lugares que não sejam esta máquina.

### 2. O fingerprint, que é o que liga o app ao site

```
"C:\Program Files\Java\jdk-17\bin\keytool.exe" -list -v ^
  -keystore domino-bar.keystore -alias domino-bar | findstr SHA256
```

Copie o valor (`AA:BB:CC:…`, 32 pares) para dentro de
`twa/user-page/.well-known/assetlinks.json`, no lugar do `__SHA256__`, e publique a user page.

### 3. Bubblewrap — ⚑ O AMBIENTE JÁ ESTÁ MONTADO NESTA MÁQUINA

**Você não precisa baixar nada.** Isto ficou pronto em 11/08/2026, e é o que costuma custar
a tarde inteira:

| | onde |
|---|---|
| `@bubblewrap/cli` | instalado global (`npm i -g`) |
| JDK 17 | `~/.bubblewrap/jdk/jdk-17.0.11+9` — baixado pelo próprio Bubblewrap |
| Android SDK | `~/android-sdk` — plataforma 34, build-tools 34.0.0, platform-tools |
| licenças do SDK | **aceitas** |
| `~/.bubblewrap/config.json` | já aponta para os dois |
| `twa/twa-manifest.json` | escrito à mão, versionado, conferido pelo `npm run twa` |

**Falta UM comando, e ele precisa de um terminal de verdade:**

```
cd twa
bubblewrap build
```

Ele vai perguntar se pode gerar o projeto Android (responda **Y**) e pedir a keystore e a
senha do passo 1. No fim, o `.apk` sai em `twa/`.

> **Por que eu não rodei isto por você:** o CLI do Bubblewrap **é interativo em todos os
> caminhos que geram ou atualizam o projeto** — `doctor`, `init`, `update` e `build`. Sem um
> terminal, ele estoura com `ERR_USE_AFTER_CLOSE: readline was closed` no instante em que
> abre o primeiro prompt, e **canalizar respostas com `printf … |` não resolve**: ele não lê
> de um cano, lê de um terminal. Foi até onde deu, que é tudo menos o prompt.

#### As três armadilhas que já foram pagas — não repita

1. **O JDK ele baixa sozinho; o Android SDK NÃO.** O `config.json` nasce com
   `{"jdkPath":"", "androidSdkPath":""}`; ele preenche o primeiro na primeira execução e
   **pergunta** pelo segundo. Já está preenchido.

2. **O VALIDADOR DE SDK DO BUBBLEWRAP É ANTIGO, e a mensagem de erro não ajuda.** Ele recusa
   com *"The provided androidSdk isn't correct"* qualquer pasta que não tenha `tools/` **ou**
   `bin/` na raiz — e o layout moderno do SDK põe os binários em
   `cmdline-tools/latest/bin/`. A raiz fica sem `bin`, e ele recusa um SDK perfeitamente bom.

3. **E copiar só o `bin` troca um erro por outro:** ele passa a achar o `sdkmanager` e morre
   com `ClassNotFoundException: com.android.sdklib.tool.sdkmanager.SdkManagerCli`, porque os
   `.bat` procuram as classes num `lib/` irmão. **O par `bin` + `lib` tem de estar na raiz do
   SDK**, e é assim que a pasta está hoje:

   ```
   ~/android-sdk/  bin  lib  build-tools  platforms  platform-tools  cmdline-tools  licenses
   ```

   (`bin` e `lib` são cópias de `cmdline-tools/latest/`; as originais continuam lá.)

Se um dia precisar refazer do zero, foi assim:

```
curl -L -o cmdline.zip https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip
# descompacte em ~/android-sdk/cmdline-tools/, depois copie tudo para cmdline-tools/latest/
yes | ~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=~/android-sdk --licenses
~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=~/android-sdk \
  "platform-tools" "platforms;android-34" "build-tools;34.0.0"
cp -r ~/android-sdk/cmdline-tools/latest/bin ~/android-sdk/bin
cp -r ~/android-sdk/cmdline-tools/latest/lib ~/android-sdk/lib
```

**O `init` não é necessário** — ele existe para gerar o `twa-manifest.json` fazendo perguntas,
e esse arquivo já está pronto e versionado. Mexer nele é mais rápido e deixa a decisão no git
em vez de num prompt que ninguém revê.

### 4. A prova, e é a única que vale

Instale o `.apk` no celular e abra. **Se não houver barra de URL no topo, o assetlinks está
certo.** Se houver, ele não está — e nenhum outro teste responde essa pergunta, porque o
Android decide isso em tempo de execução, buscando o arquivo no seu domínio.

Rode antes `npm run twa`, que confere o que dá para conferir daqui (ver abaixo) e evita
descobrir no celular um erro de digitação no JSON.

### 5. Distribuir

| onde | custo | atrito |
|---|---|---|
| **GitHub Releases** | zero | o Android pede "permitir fontes desconhecidas" uma vez |
| **Amazon Appstore** | conta grátis | nenhum: é loja |
| ~~Play Store~~ | US$ 25 **e** 12 testadores reais por 14 dias corridos | — |

Decidido em 05/08/2026: os dois primeiros. O `.aab` sai do mesmo Bubblewrap, então nada aqui
é jogado fora se você mudar de ideia.

---

## `npm run twa` — o verificador

Confere, sem celular e sem Android:

- se a user page está no ar e servindo `.well-known/assetlinks.json` com `content-type` de JSON;
- se o `.nojekyll` está lá (é ele que faz a pasta com ponto existir);
- se o JSON tem a forma que o Android espera, com `package_name` e `sha256_cert_fingerprints`;
- se o fingerprint ainda é o `__SHA256__` de modelo, que é o erro fácil de cometer;
- se o `package_name` bate com o do `twa-manifest.json`, quando ele existir.

Ele **não** prova que o app abre sem barra — isso é o passo 4, e nenhum script substitui.
Enquanto a user page não existir, ele diz exatamente isso, com o que falta.
