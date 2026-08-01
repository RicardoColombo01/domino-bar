# Dominó de Bar — guia do projeto

Dominó dupla-seis em 3D no navegador. De 2 a 4 jogadores em qualquer mistura de gente e
bot, na mesma tela ou pela internet. No ar em
**https://ricardocolombo01.github.io/domino-bar/** (repo público `RicardoColombo01/domino-bar`).

Sem framework, sem bundler, sem asset: madeira, pintas e sons são gerados em canvas e
WebAudio na hora. Three.js e PeerJS vêm de CDN. **4.880 linhas** no total (`src/js` +
`pagina.html` + `css/estilo.css`), conferido em 02/08/2026 — este número **envelhece**, e
envelheceu: ficou dizendo 2.100 por três releases seguidas.

## Comandos

```
npm run build     junta src/ num index.html autossuficiente
npm run check     avisa se o index.html está desatualizado
npm test          build + as três suítes de lógica
npm run telas     build + o jogo em seis tamanhos de tela (retrato, paisagem, tablet, wide)
                  aceita escolher: node tests/test-telas.mjs 360x640,390x844 nomes,cheia
npm run textura   build + as texturas sobrevivem a sair do jogo e voltar (~40 s)
npm run lembrar   build + o que sobrevive a RECARREGAR a página (preferências, retomar)
npm run shots     build + screenshots no Chrome de verdade (tests/shots/)
npm run online    testa o online abrindo duas abas e uma mesa real
                  aceita escolher: node tests/test-online.mjs --so=saguao
npm run fechamento  caça fechamento forçado jogando milhares de mãos (~3 min)
npm run servir    servidor local (o online não fecha conexão em file://)

node tests/test-online.mjs https://ricardocolombo01.github.io/domino-bar/
                  testa o que está PUBLICADO, não o local

Primeira vez:  cd tests && npm install
```

## Branches

GitFlow. `main` é **exatamente o que está publicado** (o Pages serve dela): só recebe
merge `--no-ff` de `release/*` ou `hotfix/*`, sempre com tag `vX.Y.Z`. O trabalho sai de
`develop` em `feature/*`.

`index.html` é gerado e commitado, então está marcado `merge=ours` no `.gitattributes` —
**todo merge que tocou `src/` termina com `npm run build && git add index.html`**, e
`npm run check` reprova bundle desatualizado. O driver exige `git config
merge.ours.driver true` uma vez por clone.

---

## Invariantes — não quebrar

**1. `src/js/NN-*.js` são pedaços do MESMO escopo.** Sem `import`/`export` entre si;
`build.mjs` concatena na ordem do número e roda `node --check` antes de gravar. Existe
porque o navegador bloqueia módulos em `file://` e o jogo tem de abrir por duplo-clique.
**Nunca editar `index.html` à mão — ele é gerado.**

**2. Uma cadeira é `voce`, `local`, `bot` ou `online`, e o motor não sabe a diferença.**
Ele diz de quem é a vez e espera; quem responde (mouse, bot ou rede) é outra camada. Não
criar "modo de jogo" — mesa mista (2 online + 1 bot) sai de graça justamente por isso.

**3. `visaoDe(cadeira)` é a fronteira de segurança.** No online é literalmente o que
trafega, e o anfitrião nunca manda a mão alheia. Toda tela lê a *visão*, nunca a partida.
Há teste conferindo que nenhuma peça da mão do anfitrião chega no convidado.

**4. `03-regras.js` e `06-layout.js` são funções puras.** É o que permite testar 53 mil
tabuleiros no terminal — e é de onde a prévia da jogada sai de graça: ela simula com
`aplicar()` e pergunta a posição ao `layoutDaMesa()`, sem geometria nova.

**5. A linha da mesa é guardada já orientada:** `linha[i][1] === linha[i+1][0]`, sempre.
As pontas são o primeiro e o último número; jogar na esquerda é um `unshift`.

### Mapa

```
01-constantes  peças, medidas, pontuação, folgas visuais, tabela MODOS, guardar/lido
02-baralho     embaralhar, distribuir (com re-embaralho), quem abre
03-regras      encaixes, pontas, jogadas válidas, tipo de batida     ← puro
04-partida     turnos, compra, passe, placar, visaoDe()
05-bot         níveis = quanta informação o bot recebe
06-layout      onde cada peça cai na mesa, com as dobras             ← puro
07-cena        renderer, câmera, luz de boteco, mesa, tralhas
08-peca3d      geometria + atlas de pintas em canvas + fantasma
09-tabuleiro   reconcilia o tabuleiro com a visão; prévia da jogada
10-mao         sua mão em leque, mãos dos outros, monte
11-interacao   raycast: escolher → ver → confirmar
12-audio       WebAudio puro, sem arquivo
13-hud         placar, vez, botões, telas de fim
14-menu        montagem da mesa (as cadeiras)
15-rede        PeerJS, anfitrião autoritativo
16-loop        estado do app, turno, hotseat, render loop
```

### Armadilhas já pagas (não repetir)

- **`requestAnimationFrame` para em aba de fundo.** O relógio do bot já morou nele e o
  anfitrião trocar de aba congelava a mesa inteira, inclusive para quem jogava online.
  Temporizador de jogo vai em `setTimeout`.
- **O `fov` do Three é vertical.** O horizontal sai de `2·atan(tan(fovY/2)·aspect)` — ver
  a Fila 2.
- **Espaçamento da mão tem de sair do comprimento da peça.** Um número fixo menor que a
  peça faz cada uma cobrir a metade direita da anterior, e como a peça nasce com `[0]` à
  esquerda, o que some é sempre o segundo número.
- **O harness de teste precisa passar o timestamp no `requestAnimationFrame`** e enfileirar
  `setTimeout` de verdade (`tests/harness.mjs`), senão temporizadores nunca disparam e o
  teste passa sem ter rodado nada.
- **Buscar peça por texto no JSON dá falso positivo:** `[0,0]` também é um placar 0×0.
- **`naMao` já é dois nomes** — o array de contagens em `visaoDe` e o array de peças 3D em
  `10-mao.js`. Como tudo é o mesmo escopo concatenado, um terceiro `naMao` seria colisão
  silenciosa; o tamanho da mão chama-se `pecasPorMao`.
- **Aritmética de baralho fora do motor apodrece.** `14-menu.js` tinha `28 - 7 * MESA.n`
  escrito à mão e foi a primeira linha a quebrar com os modos. Tamanho de baralho sai de
  `baralhoDoModo()`, sempre.
- **`distribuir` dava mão curta em silêncio** quando `n × peças` não cabia no baralho. Hoje
  estoura com mensagem — o menu barra a combinação, mas os testes entram por baixo dele.
- **Cache que depende de duas coisas tem de olhar para as duas.** `assinaturaMao` só via
  as peças, então mudar a largura da tela não refazia o leque — e invalidar à força a
  cada `resize` apagava a peça levantada. A largura entrou na assinatura.
- **`typeof x` sobre um `let` na zona morta LANÇA**, não devolve `'undefined'`. Guarda
  desse tipo em escopo concatenado dá falsa sensação de segurança; o que resolve é a
  ordem de quem chama.
- **A ordem da mão na tela não pode virar ordem no motor.** `visaoDe` devolve a MESMA
  referência de `P.maos[cadeira]`: um `vista.mao.sort()` ordenaria a mão do anfitrião por
  causa da preferência visual de um jogador, e no convidado nem funcionaria (a vista dele
  é regenerada do JSON a cada publicação). Há teste que congela `vista.mao` para
  transformar isso em erro em vez de bug silencioso.
- **Cache com duas dependências tem de olhar para as duas, e não para a ordem.** A
  assinatura da mão é de CONJUNTO (chaves ordenadas) mais a largura: sensível à ordem,
  ela entraria em laço com a arrumação — reordena, reconstrói, perde a seleção.
- **`localStorage` no `file://` é compartilhado entre as abas do teste.** Uma cena que
  liga a contagem contaminava as seguintes, e a foto saía mentindo. Cada cena diz o que
  quer, explicitamente.
- **O que cabe na mesa não é o que cabe na TELA.** O tabuleiro, os adversários e o monte
  cabiam nos 6.1 de raio do tampo e mesmo assim saíam do quadro em retrato. Quem tem a
  palavra final é `larguraVisivelEm()`, em `07-cena.js`.
- **`Set` não sobrevive a JSON**, e `P.faltaNo` é um array de `Set`.
  `JSON.stringify(new Set())` dá `{}` — objeto sem `.has` e sem `.indexOf`. Guardar a
  partida no `localStorage` perdia calada a marca de "passou no número" e o bot estourava
  em `05-bot.js`. `visaoDe` já convertia para o fio (`Array.from`); quem guarda tem de
  fazer a mesma conversão nos dois sentidos. **Vale para qualquer coisa nova em `P`.**
- **`performance.now()` no harness AVANÇA o relógio falso a cada chamada**
  (`tests/harness.mjs`). Código novo que só consulte a hora desloca os temporizadores do
  bot, e com eles o embaralho semeado: um teste que dependia de "quem abre" passa a
  falhar sem que nada do que ele testa tenha mudado. Teste que precisa de mesa parada
  monta a mesa, não confia no sorteio.
- **Preferência guardada é ENTRADA DE FORA.** Pode vir de uma versão antiga, de um modo
  que não existe mais, ou de alguém editando o armazenamento. Um `{modo:'trio', n:4}`
  guardado estoura no `distribuir`. `mesaLembrada()` confere cada campo contra as regras
  de hoje — e o nível de bot contra a tabela `NIVEIS` do próprio bot, não contra uma
  segunda lista.
- **Painel do HUD por baixo de tela é problema de EMPILHAMENTO, não de visibilidade.** A
  conversa não existia no saguão por dois motivos somados: `desenharConversa` só era
  chamada por `desenharHUD` (que exige partida) **e** `.tela` é `z-index: 30` contra os 6
  do `#conversa`. Trocar classe de `oculta` não resolveria metade do problema. Hoje
  `atualizarConversa(vista)` aceita vista nula e `body.saguao` sobe o painel.
- **Todo texto que o convidado escreve é entrada de fora, e o nome dele é o mais antigo.**
  `listarSala` punha `c.nome` direto em `innerHTML` desde antes de existir chat — e o corte
  em 14 caracteres não protege nada, porque `<img src=x>` tem 11. O teste do online usa
  exatamente esse nome e reprova se virar elemento.
- **Estado novo no `localStorage` contamina as suítes de navegador.** Elas rodam em
  `file://`, onde o armazenamento é do domínio inteiro: a partida guardada por uma cena
  fazia a seguinte abrir com "Continuar a partida de antes" na foto do menu. É a mesma
  lição do `contar()` — cada cena diz o que quer, e agora há `semGuardado()`.
- **Fronteira de segurança tem CHAVE, e a chave também precisa de guarda.** `visaoDe(cadeira)`
  estava correta o tempo todo e mesmo assim a mão vazava: o *número da cadeira* era entregue
  por ordem de chegada, então bastava pegar a vaga de alguém para receber a mão dele. Ao
  auditar o invariante 3, perguntar as duas coisas — "esta função vaza?" **e** "quem decide o
  argumento dela?".
- **Contexto isolado do Puppeteer derruba o cache HTTP.** Trocar `newPage()` por
  `createBrowserContext().newPage()` para dar `localStorage` separado a cada aba fez cada uma
  rebaixar three.js e PeerJS do CDN: a primeira levou 8 s e a segunda estourou os 45 s de
  navegação. Quando o que se quer é só separar o armazenamento, `evaluateOnNewDocument`
  injetando o valor custa zero.
- **Textura de canvas é EMPRESTADA, não sua.** Num celular, sair para outro aplicativo pode
  levar o contexto WebGL **e** o bitmap do `<canvas>` — e são coisas independentes. Nenhuma
  das duas sozinha aparece; juntas, o three reenvia um bitmap em branco no restore e a peça
  fica preta. Toda receita de `pintar()` fica guardada para poder ser repintada, começa com
  um `fillRect` OPACO (é o que faz a sonda de alfa funcionar) e **não pode consumir
  `Math.random` global** — as suítes de tela semeiam esse gerador dentro da página.
- **Duas caixas que cabem sozinhas e não perguntam uma pela outra vão se encavalar** — o item
  8 pagou isso em CSS e a Fila 7 pagou de novo em 3D, com o tabuleiro e os assentos medindo a
  mesma tela em profundidades diferentes, com divisores mágicos diferentes. Quando o mesmo
  espaço tem dois donos, a conta tem de ser UMA.
- **Contêiner com `overflow` MENTE sobre o que está dentro dele.** Ele cabe na tela sempre, e
  o filho que saiu é invisível para qualquer medida feita no contêiner — foi assim que o
  quarto cartão de jogador nasceu inteiro fora da tela com a suíte verde. E o transbordo
  dentro de um `position: fixed` nunca chega ao `documentElement.scrollWidth`.
- **`restoreContext()` chamado de dentro do despacho do `webglcontextlost` é IGNORADO** pelo
  Chrome, e aí o `restored` nunca vem. Toda espera de evento em teste precisa de PRAZO:
  evento que não chega é informação, promessa que não resolve é `ProtocolError` três minutos
  depois sem dizer a causa.
- **O Chrome rasteriza um canvas novo e um canvas já usado como fonte de textura de formas
  diferentes** — até um desenho sem um sorteio sequer muda ~0,6% ao ser repintado. Para
  perguntar "o desenho é determinístico?", compare repintura contra repintura, nunca contra a
  primeira pintura.
- **`catch` que guarda só a `message` esconde ONDE.** O `test-online.mjs` engolia o stack e
  transformava "falhou em algum lugar dos 300 lances do teste" num palpite caro. Hoje
  `DOMINO_DEBUG=1` imprime. Vale para qualquer `catch` que exista para transformar falha de
  rede em aviso: ele também engole os defeitos de verdade.

---

# FILA DE TRABALHO

**As filas 1 a 4 estão fechadas (v1.5.0); a Fila 5 está aberta.** As fechadas ficam
registradas abaixo porque o que elas ensinaram sobre este código continua valendo — é o
motivo de este arquivo existir.

**Toda ideia e toda implementação combinada entram na Fila 5.** É aqui que o trabalho por
fazer mora, e não em memória de sessão: memória não viaja com o repositório nem é lida por
quem abrir o projeto amanhã.

**A Fila 2 está fechada desde a v1.6.0.** O que sobrava dela era o HUD de **celular
deitado**, que era o de tela baixa reaproveitado; o item 8 o transformou em layout próprio
(cada faixa com dono). O `#log` que faltava ali deixou de existir — a conversa o absorveu
na v1.5.0.

Fora de fila, o que a v1.5.0 acrescentou além dos itens: a **conversa da mesa** (chat geral
e por dupla, com a narração no mesmo fio, e conversa também no saguão), **voltar para a
mesma partida** depois de a página morrer, e a **legibilidade da mesa** (sRGB, pinta maior,
marca da última jogada).

A **v1.7.0** fecha a Fila 5 inteira. Ela leva as duas coisas que sobravam, e as duas são de
fundo: o **fechamento forçado** deixa de ter janela cega (a regra valia só sem monte, e o monte
seca no meio da mão), e o **anfitrião passa a reabrir a MESMA mesa** ao recarregar, com os
convidados voltando sozinhos para a cadeira deles. Sem esta segunda, o "voltar para a mesma
partida" era metade de um mecanismo.

A **v1.6.0** é a primeira release cujos itens vieram quase todos de **jogo de verdade, no
celular**, e não de leitura de código. Ela leva: o lá-e-lô com as pontas certas (1), a
cadeira que passa a ser de quem é dono dela (4) — que era **vazamento de mão**, não só
inconveniência —, o "Entrar" que parava de lotar a mesa (5), o código da sala visível e o
caminho de volta (3a, 3b), a gaveta do celular (9, 10), e o toque que o celular engolia
(6, 7) mais o deitado com layout próprio (8).

## Fila 1 — o bug dos pontos ✔ feito (v1.0.1)

A mão que decide a partida mostra os pontos antes do campeão; a tela de campeão ganhou
placar final e número de mãos; `#fimSomas` virou `#fimSobrou`, com título "sobrou na mão"
e subtotal por dupla (`fecharMao` grava `somasPorTime`).

**O que ficou de lição:** a tela é função pura de `vista.fase` e `atualizarVista()` roda
em **todo** `publicar()`. Qualquer passo de UI com mais de um estado para a mesma fase
precisa de um flag de módulo em `16-loop.js` (`viuOFimDaMao`), zerado quando a fase muda —
não dá para resolver dentro do HUD.

## Fila 2 — celular ✔ feito (v1.2.0)

`enquadrar()` substituiu `ajustarTela()` e deriva o `fov` da largura que precisa caber,
com **piso** nos 46° de sempre (o computador não mudou um pixel) e **teto** em 62°.
`LARGURA_MAO` virou função da largura de mundo realmente visível, `porFileira` faz N
fileiras (um Duelo de 14 em pé usa quatro), e o que está na mesa — tabuleiro,
adversários e monte — aperta junto por `apertoDaMesa()`. HUD com bloco de orientação,
alvos de 44 px, safe-area, `touch-action: none` e vibração ao encaixar.

**O que ficou de lição:**

- **A largura visível é TETO, não alvo.** A primeira versão deixava a mão crescer até a
  largura real (12.4 no computador) e ela se espalhava de beirada a beirada, por baixo
  dos painéis. `MAO_CHEIA = 8.2` continua sendo o que a mão *quer*; a tela só pode tirar.
- **A largura tem de entrar na assinatura da mão** (`10-mao.js`). Invalidar à força
  reconstruía o leque a cada `resize` — e no iOS a barra de URL dispara `resize` o tempo
  todo, o que apagava a peça que você tinha levantado.
- **`typeof x` sobre um `let` na zona morta LANÇA**, não devolve `'undefined'`. O guarda
  que parecia defensivo não defendia nada; o que segura é a primeira chamada de
  `enquadrar()` morar em `16-loop.js`, depois de tudo declarado.
- **`max-width` é a pergunta errada para alvo de toque.** Um tablet de 820 px e um
  celular deitado de 844 px são largos e continuam sendo dedo — quem responde é
  `(pointer: coarse)`.
- **O monte não pode ser apertado pelo fator da mesa:** ele fica muito mais perto da
  câmera, onde a tela é mais estreita. A posição dele sai da largura visível na
  profundidade dele mesmo.

Falta só: `#log` e o painel "Mão" ainda somem em vez de se adaptar, e o HUD de celular
deitado é o de tela baixa, não um layout próprio.

## Fila 3 — teste de telas ✔ feito (v1.2.0)

`tests/test-telas.mjs` (`npm run telas`) abre o jogo em cinco tamanhos — retrato 390×844
e 360×640, paisagem de celular 844×390, tablet 820×1180, wide 1600×900 — em quatro
situações (mão de 7, mão de 14, confirmando, mesa cheia) e reprova se a página
transbordar, se um painel do HUD sair da viewport, se dois painéis se sobrepuserem, se o
alvo de toque for menor que 40 px, ou se **qualquer peça da mão, do tabuleiro, das mãos
dos adversários ou do monte cair fora do quadro** — projetando com a mesma `camera` que
desenha, para NDC.

Foi ele que achou os três defeitos que ninguém tinha visto: monte a 1,9 de NDC (quase
duas telas para fora), adversários a 1,57 e tabuleiro a 1,04 em retrato.

## Fila 4 — jogabilidade

Feito na v1.4.0: o bot de verdade (1), arrumar a mão (2), o painel de contagem (3), a
marca de "passou no número" (4) e a reconexão no online (6, na v1.3.0).

**`escolherJogada` (`05-bot.js`)** virou uma nota por opção, e a ordem dos pesos é a
ordem das prioridades de quem joga bem: bater (e bater caro), **não se enterrar** —
contar com quantas peças você ainda responde às pontas que acabou de deixar —, apertar
quem joga depois usando `faltaNo`, e só então descarregar peso. `informacao()` passa a
entregar `P.linha`, que é público. Os níveis continuam sendo *quanta informação* o bot
recebe, não três algoritmos. `tests/test-regras.mjs` tem a única asserção do projeto que
mede QUALIDADE: o difícil ganha ~59% do fácil em 300 partidas.

**Arrumar a mão (`10-mao.js`, `11-interacao.js`).** `sincronizarMao` quebrou em
`reconciliarMao()` (mantém vivo quem continua na mão) + `posicionarMao()` (só geometria,
lê a ordem atual de `naMao`). A ordem mora em `ordemDaMao`, um `Map` por cadeira com
chaves de peça, e **nunca no motor**. Arrastar é uma máquina de estados em
`pointerdown/move/up`, separada do toque por DISTÂNCIA e não por tempo.

**Painel de contagem (`13-hud.js`).** Sai inteiro de `vista.linha` + `vista.mao` + o
`faltaNo` novo na visão — tudo público, nada a mudar no motor.

**Lembrar preferências (5) ✔ feito (v1.5.0).** `guardar`/`lido`/`esquecer` em `01-constantes.js` —
mora no primeiro arquivo porque o `13-hud.js` lê preferência na hora em que é concatenado.
A mesa inteira é lembrada (modo, jogadores, alvo, compra livre, nome e tipo das **quatro**
cadeiras) e o som também. `mesaLembrada()` valida tudo; `refletirMesaNosBotoes()` existe
porque os botões nascem marcados no HTML com o padrão, e sem mover a marca o jogo começa
num Trio até 10 enquanto a tela promete Clássico até 6.

**Voltar para a mesma partida ✔ feito** (não estava na fila; pedido depois). A partida é
dado puro, então cabe inteira no `localStorage` — é a mesma propriedade que faz o online
funcionar, cobrada uma segunda vez. Guarda em `publicar()`, o funil por onde toda mudança
passa; apaga quando a partida acaba; oferece por botão no menu, com prazo de 12 h. Cadeira
que era `online` vira bot ao retomar, senão o motor espera para sempre por quem não vai
responder. `tests/test-lembrar.mjs` (`npm run lembrar`) é a primeira suíte que **recarrega
a página** — sem isso, "lembrar" não é testável, e foi ela que achou o defeito do `Set`.

**Dica de jogada (7) ✔ feito (v1.5.0).** `dicaDaVista(vista)` em `05-bot.js`: é o bot pensando com
a sua mão, sem ruído. Sai da **vista** e nunca da partida — e repare que isso não custou
nada, porque **todo** campo que `informacao()` entrega ao bot já existe na visão. Não é
coincidência: é consequência de o bot ter sido escrito para não trapacear. Se a dica
precisasse de um campo a mais, seria prova de que o bot olhava a mão dos outros. De graça,
ela funciona para o convidado, que não tem `P`.

`escolherJogada` passou a devolver os **porquês** junto da nota — uma parcela nomeada por
critério —, e a dica mostra os dois que mais pesaram. A aritmética é a mesma, nas mesmas
parcelas e na mesma ordem: `test-regras.mjs` mede a força do bot em 300 partidas e o número
tem de continuar igual (359 × 241, 59,8%, conferido antes e depois). Note que `n -= x`
virou `n += somar(-x, …)` para o porquê guardar o sinal certo — é idêntico em ponto
flutuante.

A dica **levanta** a peça em vez de só dizer o nome: termina exatamente onde o seu clique
terminaria, com os fantasmas nas pontas e a barra de confirmar aberta. Ninguém joga por
você. Só na sua vez, porque fora dela seria prometer jogada que o motor recusa.

A fila 4 está fechada.

## Fila 5 — as regras que ainda estão erradas

**Comece pelo "ONDE PARAMOS" logo abaixo** — ele tem o estado, os números e o plano em ordem.

**Esta fila é o lugar de toda ideia e de toda implementação combinada.** Ideia nova, minha
ou do Ricardo, entra aqui — não em memória de sessão, que não viaja com o repositório e não
é lida por quem abrir o projeto amanhã.

Os itens 1 e 2 vieram do Ricardo em **29/07/2026** e são regra de casa: não se deduzem do
código nem se resolvem por bom senso de programador. O item 3 é de **30/07/2026** e é o
pedaço que falta para a reconexão do online valer. Os itens **4 a 11** são de **30/07/2026** e
saíram de jogo de verdade, no celular — são a primeira leva de defeitos relatados **em campo**,
e não de leitura de código. Vale a distinção: a leitura acha o que está escrito errado, o
campo acha o que está escrito certo e mesmo assim não funciona.

---

### ONDE PARAMOS — sessões de 30/07 a 02/08/2026

**Leia isto primeiro ao retomar.** É o estado real do trabalho, o que ele produziu, o que
fazer em seguida e por quê. Os detalhes de cada assunto estão nos itens numerados mais abaixo.

#### ESTADO EM UMA OLHADA (02/08/2026)

| | |
|---|---|
| publicado | **v1.8.0** — https://ricardocolombo01.github.io/domino-bar/ |
| `main` ↔ `origin/main` | `0 ← \| 0 →` |
| `develop` ↔ `origin/develop` | `0 ← \| 0 →` |
| árvore de trabalho | limpa |
| Fila 5 | **fechada** — 11 itens |
| Fila 6 | **5 defeitos fechados**, o resto do escopo à espera (ver a seção da Fila 6) |
| **Fila 7** | **fechada** — as cinco fotos de campo de 31/07 (ver a seção da Fila 7) |
| pendências bloqueadas | **nenhuma** — nada esperando resposta do Ricardo |

**Não há defeito conhecido em aberto.** O que sobra é trabalho de qualidade, listado no fim
desta seção em ordem de valor.

#### O QUE CUSTOU UM DIA INTEIRO, e não pode se repetir

Em 31/07 o Ricardo testou o jogo e **viu os mesmos defeitos**, e a conclusão natural foi que
nada tinha sido feito. Estava tudo feito e tudo commitado — **e nada tinha saído da máquina**.
Ele testou o `github.io`, que serve da `main`, e a `main` era a v1.5.0.

A lição não é "lembrar de publicar". É que **o projeto tem duas travas contra bundle velho
(`merge=ours` no `.gitattributes` e `npm run check`) e nenhuma contra trabalho não enviado** —
porque enviar é decisão de gente. Ao FIM de qualquer sessão, dizer em voz alta e por escrito
onde o trabalho está: **commitado ≠ enviado ≠ publicado.** São três lugares diferentes, e
`git rev-list --left-right --count origin/main...main` responde os dois últimos em um segundo.

#### O que mudou, e o que deu

| item | o que ficou | o número |
|---|---|---|
| 1 · lá-e-lô | pontas iguais não são dois lados; cruzada mantida em 4 | força do bot 59,8% → **57,8% (3,8σ)**, limiar preservado |
| 4 · identidade | `clienteId` + `sentar()` + `donoDaCadeira` reservando a cadeira | volta na cadeira certa **com a mesma mão**; 2 abas = 1 conexão |
| 5 · reentrada | guarda no `btConectar` + retorno visual | um clique = uma conexão |
| 3(a) · ver | código no `#topo`, copiável | — |
| 3(b) · voltar | `guardar('sala')` + botão no menu, prazo de 2 h | sobrevive à recarga |
| 9 e 10 · gaveta | conversa/contagem viram gaveta modal no celular | **20 falhas → 0** |
| 11 · intermitência | embaralho das cenas semeado | metade: ver ressalva |
| **6 e 7** · toque | limiar por ponteiro + `foiMesmoArrasto` + `visibilitychange`/captura | **5 asserções novas**, todas vermelhas no código antigo |
| **8** · deitado | `#topo` vira faixa entre as colunas; corte do nome na PALAVRA | **17 falhas → 0**; diagnóstico da fila estava INVERTIDO |
| **11** · determinismo | espera a tela PARAR em vez de contar 350 ms | duas rodadas **idênticas**, 49 linhas cada |
| **3(c)** · reabrir | reivindica o mesmo id do PeerJS; `donoDaCadeira` guardado | convidado volta **sozinho** na cadeira dele |
| **2** · fechamento | cai o `!temMonte`; o `morto[]` já era a pergunta forte | **313 casos em 1000 mãos → 0** |
| **F6** · cinco defeitos | mudo, escape do nome, revanche, CDN, chave de protótipo | todos com asserção **vermelha antes** |

**As releases:** v1.6.0 (itens 1, 3a, 3b, 4, 5, 6, 7, 8, 9, 10) → v1.7.0 (itens 2, 3c, e o 11)
→ v1.7.1 (os cinco defeitos da varredura).

#### A ressalva CAIU — e como se prova que caiu

Durante toda a Fila 5 valeu: *"uma rodada verde do `telas` não é prova, rode duas"*. **O item 11
fechou em 31/07/2026 e ela não vale mais** — uma rodada voltou a ser prova.

O que a derrubou não foi a suíte ficar verde: foi ela ficar **igual**. Duas rodadas seguidas,
49 linhas de números cada, idênticas linha a linha. Verde é o critério fraco — um teste
intermitente também fica verde metade das vezes. **Determinismo se mede comparando rodadas, não
contando aprovações**, e é assim que se confere se ele voltou a valer no futuro.

#### O plano, em ordem

1. ~~**PUBLICAR.**~~ ✔ **v1.6.0 publicada em 31/07/2026.** Nove itens, entre eles um conserto
   de regra de pontuação e um vazamento de mão pela cadeira errada.
2. ~~**Item 11 — fechar a intermitência.**~~ ✔ **feito em 31/07/2026.** A causa não era a
   prevista (temporizador de bot), era a animação pega no meio por uma espera fixa.
3. ~~**Item 3(c) — voltar como anfitrião.**~~ ✔ **feito em 31/07/2026.** O `unavailable-id` foi
   mesmo onde doeu, e `donoDaCadeira` teve de virar dado guardado — isso não estava previsto.
4. ~~**Item 2 — o fechamento forçado.**~~ ✔ **feito em 31/07/2026, sem o caso do Ricardo.** A
   busca achou o caso sozinha, e ele não era o previsto: a janela cega era o `!temMonte`.

**A FILA 5 ESTÁ VAZIA.** Todos os onze itens fechados. O que vier agora é fila nova — e a
regra de sempre vale: ideia nova entra AQUI, não em memória de sessão.

#### O que aprendemos sobre esta fila, olhando para trás

**Três dos onze itens tinham o diagnóstico ERRADO escrito nesta fila**, e nos três a medição
mandou em cima da leitura:

| item | o que a fila dizia | o que era |
|---|---|---|
| 8 | falta `ellipsis` no deitado | o nome cabe deitado; quem corta é o RETRATO — deitado o `#topo` monta na lista |
| 11 | temporizador de bot | animação pega no meio por uma espera fixa |
| 2 | a regra tem um lance de profundidade | a regra nem rodava: `!temMonte` a desligava |

Não é acaso: hipótese escrita de leitura de código é barata e por isso mesmo grudenta. **O
antídoto foi sempre o mesmo — medir antes de consertar**, e em todos os três a medição custou
menos que o conserto teria custado no lugar errado.

E aconteceu de novo na Fila 6, com dois dos cinco: o "vazamento de GPU" dos materiais clonados
**não era vazamento** (mesma `cacheKey`, os materiais viram lixo coletável), e o `alvos`
aliasado do `06-layout.js` **não é defeito** porque ninguém lê aquele campo. Nos dois casos
meia hora de investigação evitou um conserto inútil. **Suspeita não confirmada tem de ser
registrada COMO suspeita** — foi o que permitiu descartá-las sem refazer a leitura.

#### As três armadilhas de TESTE que estas sessões pagaram

Valem mais que os consertos, porque se repetem em qualquer projeto:

1. **Asserção que não fica vermelha antes do conserto não prova nada.** Cinco asserções minhas
   passaram no código antigo na primeira tentativa, ao longo destas sessões. Cada uma parecia
   certa lendo o texto dela.
2. **"Parece o mesmo ataque" não é o mesmo ataque.** A asserção do nome reusava o
   `<img src=x>` que a suíte já tinha — e sem aspa aquele nome fica preso dentro do `value=`,
   não vira elemento nem no código com defeito. Quem abre o atributo é a **aspa**.
3. **Dublê que não deixa o código alcançar o estado interessante dá verde que não quer dizer
   nada.** Foi a lição do `matchMedia`, depois da captura de ponteiro, depois do
   `AudioContext`, depois do `Peer`. **Quatro vezes.** Quando um teste não consegue alcançar
   um ramo, a pergunta certa é "o que falta no dublê", não "como contorno isto".

E uma quarta, de fora do código: **`diff` de dois arquivos vazios passa.** A suíte travada não
gerou saída, os dois arquivos saíram com zero linhas e a comparação declarou "idênticas". Teste
de igualdade tem de exigir também que **haja o que comparar**.

#### O QUE FAZER AMANHÃ — em ordem, e por quê

Nada disto é defeito: são melhorias medidas, todas com arquivo e linha na seção da **Fila 6**
lá embaixo. A ordem abaixo é uma recomendação com justificativa, não uma sentença — o escopo é
do Ricardo, e ele já mostrou que prefere ondas pequenas com release no fim de cada uma.

**1. Acessibilidade barata — meio dia, e é a maior alavanca por real gasto.**
O projeto não tem **um único** `aria-*`, `role`, `alt`, `tabindex`, `:focus-visible` ou
`prefers-*`. Comece por três coisas que somam poucas linhas:
- `aria-live="polite"` em `#aviso`, `#vez` e `#conversaLista`. O `avisar()` é o canal de TODO
  erro do motor e do porquê de a peça não dar; hoje nada disso existe para leitor de tela.
- **Contraste do texto de erro.** `#onlineErro` usa `.nota` (`opacity: .5` em 12 px, ~4.3:1) —
  é o texto de MENOR contraste da tela, e é justamente o que avisa que algo deu errado. Erro
  não é decoração. Subir as opacidades de `.45–.58` para `~.72` resolve sem tocar no estilo
  âmbar-sobre-marrom.
- **O botão de mudo vira `✕`, o mesmo glifo do botão de sair, 22 px ao lado.** Trocar por 🔇.

**2. Teclado — meio dia, e fecha um ciclo que já está quase pronto.**
Hoje o teclado tem três teclas (`Esc`, `A`, `D`) e **não existe** como escolher uma peça. Mas
os botões de confirmar já são `<button>` de verdade e já pegam Tab. Teclas `1..9` chamando
`selecionarPeca(i-1)` — função que já existe e é a mesma que a dica usa — fecham o ciclo
inteiro: selecionar → Tab → Enter. O custo real é o realce visual da peça focada no 3D.

~~**3. As pintas da peça — a lacuna de teste mais perigosa que existe hoje.**~~ ✔ **feita na
v1.8.0**, de carona na suíte de textura (Fila 7, item 1): cada célula do atlas é amostrada
nos 9 pontos da grade contra uma tabela escrita no teste, e a UV de cada metade prova a
convenção "o `[0]` à esquerda". Conferida por mutação.

~~**4. O argumento de linha de comando do `test-telas`.**~~ ✔ **feito na v1.8.0**, e virou
pré-requisito prático em vez de conforto — com ele, iterar num defeito de uma tela custa um
minuto em vez de dez. O `test-online` ganhou o mesmo (`--so=`).

**5. Documentação — o README está duas releases atrás.** Não menciona a conversa da mesa, a
dica de jogada, a gaveta do celular nem o reabrir a mesa; diz que o bot difícil ganha ~59% (é
**55,8%** desde os itens 1 e 2); o diagrama de branches para na v1.1.0. E o cabeçalho DESTE
arquivo dizia ~2.100 linhas (corrigido em 01/08). É a porta de entrada de um repositório
público, e hoje ela descreve um jogo mais pobre do que o que está no ar.

**6. As outras lacunas de teste**, em ordem de gravidade: o som e o mudo (hoje o dublê existe,
então ficou barato), o fim de mão **em duplas** (só há asserção com `MESA.n = 2`, e mesa de 4 é
o modo clássico de boteco), o **conteúdo** do painel de contagem (só se testa se ele cobre a
mesa, nunca se conta certo — e é ferramenta de decisão), o `<select>` de cadeira do menu, o
esgotamento do prazo de 30 s de quem cai, e os ramos de rede do sair da partida.

#### O QUE PODERIA SER FEITO, mas não recomendo agora

Registrado para não ser redescoberto do zero — e com o motivo de não ser prioridade:

- **Fazer o 3D DESVIAR dos painéis** em vez de os painéis darem lugar. Combina com
  `apertoDaMesa()` e `larguraVisivelEm()`, e é o caminho não escolhido do item 10. É o mais
  caro, e a gaveta e as faixas já resolveram o problema real.
- **`beforeunload` no meio de partida online.** As regras dizem em letras grandes que sair
  conta como derrota, e um F5 acidental gasta o prazo de 30 s sem aviso. Barato — mas
  `beforeunload` é incômodo e precisa de decisão do Ricardo, não de programador.
- **Botão de copiar/compartilhar o código da sala.** `user-select: all` resolve o mouse; no
  dedo, copiar de um `<div>` é sofrível, e o caso comum é mandar o código pelo WhatsApp.
  `navigator.share` resolveria. Impacto real no online, custo pequeno.
- **Compra voluntária desabilitada nos modos sem monte.** Hoje o botão fica aceso prometendo
  uma regra que o motor descarta — `ajustarCadeirasAoModo` já faz exatamente isso, com
  elegância, para o número de jogadores.
- **`prefers-reduced-motion`.** A lâmpada respira para sempre e a câmera reenquadra; é o pior
  conjunto para sensibilidade vestibular. Pequeno no CSS, médio no 3D.
- **Dívidas que investiguei e concluí que NÃO são defeito hoje** — não refaça o trabalho:
  o clone de material por peça sem `dispose()` (mesma `cacheKey`, os materiais viram lixo
  coletável; é churn, não vazamento); o `alvos.esq === alvos.dir` do `06-layout.js` (aliasing
  armado, mas `alvos` é **código morto** — remover é melhor que consertar); e o array `VAZIO`
  compartilhado do `05-bot.js` (só é lido hoje; um `add` ali um dia envenenaria todos).

#### Perguntas em aberto para o Ricardo

- **Nenhuma bloqueia.** O item 2 era a única e a busca respondeu no lugar dele.
- A única decisão que vale perguntar antes de agir é **o escopo da próxima onda** (a lista de
  1 a 6 acima), porque ele já disse que prefere ondas pequenas com release no fim.

#### Como retomar em cinco minutos

```
git fetch origin && git rev-list --left-right --count origin/develop...develop   # tem de dar 0 0
npm run check          # o bundle está em dia com src/?
npm test               # as três suítes de lógica, segundos
```

E antes de qualquer conserto: **medir**. Três dos onze itens da Fila 5 e dois dos cinco
defeitos da Fila 6 tinham diagnóstico errado escrito antes de alguém olhar os números.

### 1. Lá-e-lô só existe com as pontas DIFERENTES ✔ feito

A batida de lá-e-lô (2 pontos) só vale quando as duas pontas da mesa são de números
**diferentes** e a peça da batida carrega os dois — ou seja, quando ela realmente podia ter
entrado de qualquer um dos lados.

Pontas iguais não são "dois lados". Nas palavras do Ricardo: pontas `3` e `3`, jogador bate
com a `3|1` — **não** conta como bater dos dois lados, é batida simples. Para valer, teria de
ser uma ponta `3` e a outra `1`.

O defeito estava em `tipoDaBatida` (`03-regras.js`), nesta linha:

```js
const nasDuas = (peca[0] === e || peca[1] === e) && (peca[0] === d || peca[1] === d);
```

Com `e === d === 3` e a peça `[3,1]`, os dois lados do `&&` davam verdadeiro **pelo mesmo 3**.

**A cruzada continua valendo 4** — decisão do Ricardo em 30/07/2026. E é por causa dela que
não deu para só acrescentar `e !== d` ao `nasDuas` compartilhado: a cruzada é o caso
**oposto**, ela EXIGE as pontas iguais, porque é a carroça daquele número casando com as
duas. Um `e !== d` comum teria matado a cruzada junto. Hoje os dois ramos fazem perguntas
diferentes, e o comentário acima da função deixou de dizer que "a tabela cai sozinha".

**Por que sobreviveu tanto tempo:** `PONTOS` dá 2 para `laelo` e 2 para `carroca`, então uma
carroça classificada como lá-e-lô continua marcando o valor certo por acidente. O placar só
mente quando a batida devia ser **simples (1)** e sai como lá-e-lô (2). Defeito que erra de
graça na maioria dos casos é o que menos aparece e o que mais tempo dura.

**O teste gravava a regra errada** (`test-regras.mjs`, "peça comum com as duas pontas iguais
= lá-e-lô"), então a correção começou invertendo uma asserção. Ficou junto o caso que
documenta a confusão de origem: a `3|6` **encaixa nos dois lados de verdade** em pontas `3` e
`3` — `jogadasValidas` devolve duas. A regra é sobre os NÚMEROS das pontas, não sobre a
contagem de encaixes, e trocar uma coisa pela outra é o que criou o defeito.

`05-bot.js` pontua batida com `PONTOS[tipoDaBatida]`, então as partidas semeadas se mexeram:
a força do bot foi de 359 × 241 (59,8%) para **347 × 253 (57,8%, 3,8σ)**. A asserção é
**limiar** (`> 2σ`), não número fixo — foi de propósito que ela foi escrita assim, e é por
isso que uma mudança semântica de regra não a derruba.

**Pergunta que estava aberta e foi respondida:** o mesmo `nasDuas` alimentava a **cruzada** (4
pontos), na linha de cima. Uma carroça `6|6` com as duas pontas em `6` cai no mesmo
raciocínio — só encosta de um lado, o outro `6` continua vivo —, então pela regra do lá-e-lô
ela *poderia* valer `carroca` (2). **O Ricardo decidiu que continua cruzada (4).** A regra da
casa não é simétrica, e está tudo bem que não seja: a cruzada é a batida das pontas iguais, e
o lá-e-lô é a das pontas diferentes. Registrado aqui porque nenhuma leitura de código chega
a essa resposta — as duas saídas eram defensáveis.

### 2. Ainda dá para FORÇAR o fechamento ✔ feito (31/07/2026)

**NÃO PRECISOU DO CASO DO RICARDO, e é isso que vale registrar.** Esta seção pedia um caso
concreto antes de mexer. A saída melhor foi *procurar* o caso: `03-regras.js` é puro, então dá
para jogar milhares de mãos e caçar a posição — que é a mesma propriedade que permite medir a
força do bot em 300 partidas. `tests/busca-fechamento.mjs` faz isso, e a chave do desenho é que
a busca é **onisciente** (vê todas as mãos) enquanto a regra nunca pode ser. A diferença entre
as duas visões é exatamente a fronteira entre "fechou" e "fechou de propósito", e ela separa
três perguntas:

| | |
|---|---|
| (A) o jogador podia ter escolhido não trancar? | visão de deus — sozinho, é fechamento NATURAL |
| (B) …e dava para deduzir da mesa + da mão dele? | visão da regra — **isto é bug** |

**O buraco era a guarda `!temMonte` em `acoesDe`.** Ela desligava a regra inteira enquanto
houvesse monte, por "com monte ninguém trava, compra". Isso confunde **existir monte** com **o
monte poder salvar alguém** — e o `morto[n]` de `fechamentosArmados` já responde a pergunta
forte: ele só dá o número por morto quando toda peça dele está na mesa ou na sua mão, e
portanto **não está no monte**. Ponta morta com monte de pé é ponta que o monte não resolve.
A guarda não protegia nada e abria uma janela: bastava dar o lance **antes de o monte secar**.

Era por isso que a hipótese registrada aqui (a regra ter "um lance de profundidade") não
levava a lugar nenhum, e vale saber por quê: a busca deu **zero** em 750 mãos dos três modos
**sem** monte. A um lance de profundidade a regra sempre esteve certa. O defeito estava onde
ela nem rodava — e o Clássico de 2 e 3 são justamente as mesas de partida rápida.

**O caso concreto que a busca achou** (clássico de 2, 4 peças no monte):

```
linha:  5|3 3|4 4|6 6|1 1|5 5|5 5|2 2|6 6|3 3|2 2|0 0|5 5|6 6|0 0|0 0|4 4|4
mão:    2|2 1|1 0|1 1|2 4|5          adversário: 2|4 1|3
```

A `4|5` **na direita** deixa as duas pontas em `5` com os **sete** 5 já vistos: ninguém joga
nunca mais, o adversário compra o monte inteiro e passa. A **mesma peça na esquerda** deixa as
pontas em `4`, e o jogo segue. Escolher qual é literalmente "escolher o lance que faz não haver
mais lance nenhum".

**Números:** 313 casos em 1000 mãos (200 por modo, cinco mesas) antes; **0** depois.

**O teste gravava a regra errada** — de novo, como no item 1. A asserção dizia *"com monte não
há tranca para armar"*, e era ela que sustentava a janela. Virou um par, e o par é a regra
inteira: monte com `0|1` não responde a 3 nenhum, comprar não adianta, o fechamento **continua
barrado**; monte com o `3|3` responde à ponta, o 3 deixa de estar morto e nada é barrado.

**A força do bot se mexeu**, como no item 1 — `05-bot.js` joga pelas ações que `acoesDe`
oferece. Foi de 57,8% para **55,8% (2,9σ)**. A asserção é **limiar** (`> 2σ`), não número fixo,
e foi escrita assim exatamente para sobreviver a mudanças de regra.

**A guarda ficou em DOIS níveis, e a divisão é por custo.** A busca leva ~3 min, e o `npm test`
roda em segundos — pôr uma dentro da outra faria ninguém rodar nenhuma:

- **rápida, dentro do `npm test`:** o par `monteInutil` / `monteSalvador` em `test-regras.mjs`.
  É instantâneo e cobre exatamente este defeito, nas duas direções.
- **profunda, sob demanda:** `npm run fechamento` (`tests/test-fechamento.mjs`). Reprova só em
  (B). Se um dia (A) aparecer sozinho, **isso é informação e não falha**: quer dizer que existe
  posição em que o jogo trava sem ninguém poder saber — e isso é dominó, não bug.

---

#### O texto original do item, para contexto histórico

O Ricardo consegue forçar o jogo a trancar. A regra do fechamento armado existe (ver "Regras
da casa" abaixo) e não está fechando o buraco todo.

A regra, nas palavras dele:

- **Fechamento natural** = você não consegue evitar que feche. **Permitido.**
- **Fechamento forçado** = você escolhe o lance que faz não haver mais lance nenhum.
  **Proibido.**
- Se o lance fecha uma ponta mas **ainda sobram lances possíveis**, está tudo bem.
- **Exceção:** bucha jogada por último é natural. Exemplo dele — as duas pontas em `6` e a
  única peça na mão é a `6|6`: pode jogar, e mesmo fechando o jogo isso é natural.

**Antes de mexer, pedir um caso concreto** (a mesa, as mãos, o lance usado). É o insumo que
falta e vale mais que qualquer leitura de código: `fechamentosArmados` tem cinco condições,
cada uma paga com um bug, e corrigir a errada reabre um dos antigos.

**Candidato mais forte, NÃO confirmado:** a regra tem **um lance de profundidade**. Ela barra
o lance que fecha agora, mas não impede armar em dois — jogar algo que não fecha e deixar a
posição em que, na vez seguinte, o único lance possível fecha. Aí ele passa como natural
justamente porque `jogadas.length > 1` é falso. Hipótese de leitura, não diagnóstico.

**O que não pode ser tocado ao corrigir:** a conta usa só a mesa e a sua PRÓPRIA mão. Se
olhasse a mão dos outros, a jogada desaparecendo da tela contaria ao jogador que ninguém tem
aquele número — e isso é vazamento de informação, irmão do que a `visaoDe` existe para
impedir.

### 3. O código da sala tem de ficar visível, para dar de voltar ✔ feito — (a), (b) e (c)

Pedido do Ricardo em **30/07/2026**: deixar o código da mesa visível, para que quem sair tenha
como voltar.

Hoje o código **não existe em lugar nenhum** depois do saguão. Ele é variável local dentro de
`tentarAbrir` (anfitrião) e do `btConectar` (convidado), nunca sai para o escopo do módulo e
nunca é guardado. O `#onlineCodigo` vive dentro da `telaOnline`, que o `esconderTelas()`
esconde no primeiro `t:'vista'` que chega. Ou seja: no instante em que a partida começa, o
código desaparece da vida de todo mundo.

Isso é o que estraga a reconexão que **já existe**: `ESPERA_VOLTA` guarda a cadeira por 30 s
justamente para dar tempo de voltar, mas quem fechou a aba não tem mais o código para digitar.
Uma metade do mecanismo sem a outra.

São **três pedaços**, e vale tratá-los separados porque a dificuldade é muito diferente:

- **(a) Ver ✔ feito.** `codigoDaSala` no escopo do módulo e `pintarSala()` no HUD, num painel
  do `#topo`. Ela fica **fora de `desenharHUD`** de propósito — aquela função só lê `vista`, e
  o código não está na visão nem poderia estar: pô-lo lá seria furar a fronteira do `visaoDe`
  por um dado de tela. É irmã de `pintarBotaoSom()`: quem muda o dado é quem chama.
  Precisou de exceção ao `pointer-events: none` do `#topo`, senão o código apareceria e **não
  daria para copiar** — metade do motivo de mostrá-lo.
- **(b) Voltar como convidado ✔ feito.** `guardar('sala', …)` só no convidado e só quando o
  `sentou` chega, porque sentar de fato é o que prova que o código presta. **Prazo de 2 h**, e
  a assimetria com as 12 h da partida é o ponto: a partida é *sua* e não depende de ninguém,
  a sala depende de o anfitrião ainda estar de pé. **Sair de propósito esquece; cair não** —
  cair é exatamente o caso para o qual isto existe.
- **(c) Voltar como ANFITRIÃO ✔ feito (31/07/2026).** Era o que faltava para o "voltar para a
  mesma partida" valer no online, e o `unavailable-id` foi de fato onde doeu — a inversão é o
  item inteiro. **Abrindo mesa nova o código é descartável:** sorteia outro e pronto.
  **Reivindicando o código que era seu, sortear outro é exatamente o erro** — o código é o
  ponto, é o que os convidados vão digitar. Hoje os dois caminhos fazem coisas opostas no
  mesmo `catch`, e o que os separa é `codigoDesejado` ter sido passado ou não. A reivindicação
  insiste **com espera** (6 tentativas de 1,5 s, em `setTimeout`): o peer velho pode ainda
  estar morrendo no servidor de sinalização, que só larga o id quando o socket cai de fato.

  **`donoDaCadeira` precisou VIRAR DADO GUARDADO, e isso não estava previsto.** Ele só existia
  em memória — reabrir com o código certo devolveria as cadeiras **erradas**, que é o bug do
  item 4 voltando pela porta dos fundos. É o mesmo raciocínio do `clienteId` um nível acima: de
  nada adianta o convidado saber quem é se o anfitrião esqueceu. O mapa é restaurado **antes**
  de o peer abrir, porque a primeira conexão pode chegar no mesmo instante do `open`.

  **`retomarPartida` ganhou `{ mantendoOnline: true }`.** A conversão de cadeira online em bot
  continua obrigatória no caso comum — fora daqui a mesa de antes não existe mais e o motor
  esperaria para sempre por quem não vai responder. Aqui ela existe: é ela que está voltando. E
  `MESA.cadeiras` precisa acompanhar `P.cadeiras`, porque é a MESA que o `sentar()` consulta
  para achar vaga online, e ela ficou com o que o menu tinha na tela.

  **O convidado volta sozinho** (decisão do Ricardo, 31/07): daqui de fora, anfitrião
  recarregando e mesa fechando são o **mesmo evento** — o link cai igual. Desistir na primeira
  queda desperdiçaria justamente o mecanismo acima. São 8 tentativas de 4 s, e cada uma derruba
  o peer velho antes: `conectarNaMesa` não faz isso (quem fazia era o `entrarNumaMesa` da tela),
  e sem esse cuidado cada tentativa deixaria um peer vivo — o vazamento do item 5 de volta.

  **Prazos por papel:** a sua mesa dura 12 h, a dos outros 2 h. A assimetria antiga existia
  porque a sala do convidado depende de o anfitrião estar de pé; sendo você o anfitrião, o que
  a mesa acompanha é a partida guardada, que dura 12 h. Prazos iguais fariam o botão de reabrir
  sumir com a partida ainda viva.

  **No teste:** o mesmo código, a partida de volta com as cadeiras ainda `online`, e o convidado
  sentando **sozinho** na cadeira dele com a mesma mão — as três juntas, porque qualquer uma
  sem as outras não serve para nada.

  **Armadilha do harness, não do jogo:** as abas do `test-online.mjs` vivem na mesma origem e
  portanto no MESMO `localStorage`, então o `guardar('sala')` do convidado passa por cima do
  registro do anfitrião. Por isso o teste confere o registro do anfitrião **antes** de a visita
  sentar, e recompõe o valor na hora da recarga. Na vida real são navegadores diferentes.

  <details><summary>o texto original, de quando ainda faltava</summary>

- **(c) Voltar como ANFITRIÃO — o que FALTA.** O difícil, e é o que falta para o "voltar para a mesma
  partida" valer no online. `codigoNovo()` sorteia um código a cada `tentarAbrir`, então o
  anfitrião que recarrega abre uma mesa **outra** e os convidados tentando voltar batem numa
  porta que não existe. Precisaria reabrir com o MESMO código — o id do PeerJS é
  `dominobar-XXXX` e dá para reivindicá-lo se o peer antigo morreu — e casar isso com a
  partida já guardada no `localStorage`. Hoje `retomarPartida` converte cadeira online em bot
  exatamente porque este pedaço não existe. **Detalhe descoberto ao fazer o resto:**
  `tentarAbrir` já trata `unavailable-id` **sorteando outro código** — reivindicar o mesmo id
  exige inverter esse comportamento, e é aí que o (c) vai doer.

  </details>

**Tensão de desenho, decidida em 30/07/2026:** código na tela é código em qualquer print,
qualquer transmissão e qualquer tela compartilhada — inclusive na mesa mista, onde a tela passa
de mão em mão no hotseat. O Ricardo escolheu **sempre à mostra**, num painel do `#topo` ao lado
de Pontas/Monte/Mão. Escopo combinado: **(a) e (b) agora, (c) fica na fila.**

**Duas armadilhas do (a), achadas ao planejar:**

- `#topo` é `pointer-events: none` (`css/estilo.css`), para não roubar o toque da mesa — o que
  também impede **selecionar e copiar** o código. Um código que não dá para copiar derrota
  metade do motivo de mostrá-lo. Precisa de exceção pontual, como a que o `#conversa` já tem.
- Em retrato o `#topo` já transbordou uma vez, e o comentário do CSS registra por quê: *"em
  360px ele saía pelos dois lados SEM aparecer no scrollWidth, porque overflow negativo em
  elemento fixo não conta"*. Um quinto painel é a mesma armadilha. E o `test-telas.mjs` **não
  tem cenário online**, então o painel novo nasceria sem nenhuma foto — o cenário tem de ser
  escrito junto, senão a suíte que existe exatamente para isso não enxerga isso.

**O (b) depende do item 4.** Sem identidade, "voltar para a mesa" põe você na primeira vaga
livre — que pode não ser a sua. Ver abaixo.

### 4. A cadeira é da primeira vaga livre, não de quem é dono dela ✔ feito

De **30/07/2026**, e é o achado que reorganizou a fila. O Ricardo relatou cinco defeitos
diferentes no online (não conseguir voltar, entrar na cadeira errada, duas abas brigando,
"lota o servidor"). **A maior parte deles é um bug só:** nada no protocolo diz *quem* é o
cliente.

```js
// 15-rede.js, no peer.on('connection')
const cadeira = MESA.cadeiras.slice(0, MESA.n)
  .findIndex((c, i) => c.tipo === 'online' && !conexoes.has(i));
```

A cadeira sai da **primeira vaga livre**, decidida no instante da conexão — antes de o
convidado ter dito uma palavra. O comentário logo abaixo afirma que ao voltar *"a cadeira é
dele de novo"*, mas **nada no código torna a cadeira dele**: `conn.on('close')` faz
`conexoes.delete(cadeira)` na hora, e o `ESPERA_VOLTA` de 30 s só adia o `abandonar()` — ele
**não reserva o assento**.

**Isto é mais grave do que parece, e vale dizer por quê.** O invariante 3 diz que
`visaoDe(cadeira)` é a fronteira de segurança, e ela está correta. O problema mora uma camada
abaixo: **o número da cadeira é a chave dessa fronteira, e ela é entregue por ordem de
chegada.** Quem pegar a vaga recebe a mão de quem estava nela. Dois convidados que caem e
voltam trocam de mão — em duplas, trocam de dupla; um terceiro com o código senta na cadeira
de quem caiu e vê as peças dele. Não adianta a `visaoDe` não vazar a mão alheia se o motor
pode achar que você é outra pessoa.

**O conserto é um `clienteId`** — um identificador sorteado uma vez e guardado no
`localStorage` do convidado, mandado ao anfitrião no aperto de mão. Barato, sem servidor (que
é a premissa do jogo) e resolve os três de uma vez. Muda uma coisa de fundo: **a cadeira
deixa de ser escolhida no `connection` e passa a ser escolhida quando o convidado se
identifica** — hoje a decisão acontece cedo demais, antes de existir informação para tomá-la.

**Como ficou** — `sentar()` decide a cadeira, e `donoDaCadeira` (cadeira → clienteId) é o que
a RESERVA:

- **Cadeira reservada durante o `ESPERA_VOLTA`.** Antes o prazo só adiava o `abandonar()`; um
  estranho com o código sentava na cadeira de quem tinha acabado de cair.
- **A mesma pessoa em duas abas:** a conexão **nova assume** e a velha recebe `expulso`.
  Recusar deixaria você trancado do lado de fora da sua própria cadeira. `largar()` recebe a
  `conn` junto porque a conexão velha ainda dispara o próprio `close` — sem essa conferência
  ela liberaria a cadeira que a nova acabou de ocupar.
- **Convidado de versão antiga** manda `nome` sem `ola` e **senta como anônimo**, que é o
  comportamento de antes: quebrar quem não recarregou seria pior que a falta de identidade.
- **O `clienteId` é lido na CARGA e fixado em memória.** O armazenamento é da origem inteira,
  não da aba, e a identidade desta aba não pode mudar no meio da partida porque outra escreveu
  lá. Já a **geração é preguiçosa**: sortear na carga gastaria `Math.random`, que no harness é
  semeado — o embaralho inteiro andaria e uma suíte que depende de "quem abre" falharia sem
  que nada do que ela testa tivesse mudado.

**No teste:** cair e voltar tem de devolver a MESMA cadeira **com a mesma mão** — o número
certo com a mão errada seria o bug passando despercebido —, e a mesma pessoa em duas abas tem
de ocupar UMA conexão.

### 5. Cada clique em "Entrar" consome outra cadeira ✔ feito (junto do 4)

De **30/07/2026**. O `btConectar.onclick` (`15-rede.js`) não tinha guarda de reentrada: cada
clique fazia um `new Peer`, abandonava o peer anterior **vivo** e consumia mais uma vaga. O
"lota o servidor" que o Ricardo relatou era literal.

E havia um agravante de **desenho** que fazia o usuário clicar de novo: depois de conectar, a
tela não mudava — ela só sai quando o anfitrião começa a partida. Ou seja, ficava parada
exatamente no instante em que parecia ter falhado. A guarda consertou o dano; o retorno visual
('Entrando…', 'Na mesa') consertou a causa.

**Sentado NÃO é ocioso:** o botão fica travado depois do `sentou`. Solto, ele reconectaria — e
como o `clienteId` é o mesmo, o jogador faria take-over da própria cadeira.

O corpo virou `conectarNaMesa(codigo)`, que é o que o botão "voltar para a mesa" reusa.

### 6. Toque preso: o jogo parece congelar e não está ✔ feito (31/07/2026)

De **30/07/2026**. `11-interacao.js` começava o trato do toque com `if (arrasto) return;`. Se o
dedo saísse da tela ainda apoiado, o `pointerup` **nunca chegava**, `arrasto` ficava preenchido
para sempre e **todo toque seguinte era descartado**. O render loop continua rodando — por isso
parece congelado sem estar, que é a parte que confunde na hora de relatar.

**O `pointerup` é um evento que o navegador PROMETE e não garante.** Dedo saindo pela beirada,
troca de app, gaveta de notificação: nenhum deles manda `pointerup`. O guarda do dedo único
estava certo; o que faltava era alguém para **destrancá-lo**.

Duas portas, e as duas precisavam existir:

- **A captura de ponteiro é a fonte de verdade.** Se pedimos captura daquele ponteiro e o
  navegador já a tirou de nós, o dedo foi embora sem avisar — e aí o `arrasto` é fantasma e o
  toque novo passa por cima. Por isso `capturado` é gravado: sem essa marca o guarda não
  distingue *"a captura sumiu"* de *"nunca houve captura"*, e num navegador sem captura ele
  largaria o arrasto do primeiro dedo a cada segundo toque — trocando o toque preso pela peça
  congelada no ar, que é o bug que aquele guarda existe para impedir.
- **`visibilitychange` + `blur`**, que não existiam em lugar nenhum do projeto. Repare que
  ali NÃO se pergunta se foi arrasto ou toque: gesto interrompido pelo sistema não é escolha
  de ninguém, e completá-lo como toque jogaria por você.

`lostpointercapture` foi considerado e **recusado**: a ordem dele contra o `pointerup` não é
confiável entre navegadores, e se chegasse antes ele zeraria o `arrasto` e faria todo toque
normal deixar de selecionar — item 7 de volta, pior.

### 7. No celular, o clique às vezes não joga a peça ✔ feito (31/07/2026)

De **30/07/2026**. Relato do Ricardo: **só no celular, e sem ter saído da tela** — o que
descartava o resíduo do item 6 e apontava para o **limiar de arrasto**. Era isso: 9 px é uma
mão apoiada numa mesa, e num celular na mão é menos que a oscilação de um toque **parado**. O
toque virava arrasto sozinho, soltava sem ter reordenado nada, e `foiArrasto` fazia o
`soltarArrasto` voltar antes de selecionar. Nunca aconteceu no PC porque mouse não treme — **a
assimetria era a evidência, e ela estava certa.**

O conserto tem **duas camadas, e a segunda é a que importa**:

1. `LIMIAR_ARRASTO` virou `{ mouse: 9, dedo: 18 }`. Direto, e resolve o caso comum.
2. **`foiMesmoArrasto` julga pelo RESULTADO, não pela distância.** Um limiar é sempre um
   chute — 18 px serve para a maioria dos dedos e vai continuar sendo pouco para alguém. Um
   gesto que atravessou o limiar e **não trocou nenhuma peça de lugar** não arrumou nada, e a
   única intenção que sobra é a de tocar. É a rede embaixo do número, e é ela que faz o
   defeito não voltar com outro dedo.

**A regra geral que isto ensina:** para todo `if (x) return`, perguntar as duas coisas — *quem
zera o `x`* e *o que acontece se esse alguém não vier*. O item 7 é o jogo entrando no estado
cedo demais; o item 6 é o jogo não saindo dele nunca. São a mesma borda, em espelho.

**No teste** (`test-jogo.mjs`, "o toque no celular"): 12 px de tremor no dedo continua sendo
toque, 12 px no **mouse** continua sendo arrasto (o limiar do dedo não podia afrouxar o
mouse), gesto de 300 px que não reordenou nada vale como toque, e o toque seguinte funciona
tanto depois da captura perdida quanto depois de a aba voltar do fundo. **As cinco reprovam no
código antigo** — foram rodadas contra ele de propósito.

Duas armadilhas pagas ao escrever esse teste:

- **`ok(mod.escolhida === tocar(...))` lê o operando da ESQUERDA primeiro.** A asserção
  comparava a escolha *anterior* com a peça deste gesto, e nasceu **verde sem testar nada**
  toda vez que as duas coincidiam. A peça sai numa linha própria, sempre.
- **O dublê do renderer não tinha captura de ponteiro**, então o caminho inteiro do item 6
  ficaria sem teste — o jogo passou a *perguntar* à captura se o dedo ainda está lá. É
  literalmente a lição que o `harness.mjs` já registrava sobre o `matchMedia`: *"quem estava
  incompleto era o dublê, não o jogo"*. A captura do dublê **não** se solta sozinha no
  `pointerup`; quem quiser simular o dedo sumindo chama `releasePointerCapture` na mão, que é
  o que o sistema faz.

### 8. Nome cortado com o celular deitado ✔ feito (31/07/2026)

De **30/07/2026**, e é a **única sobra da Fila 2** aparecendo em campo.

**A MEDIÇÃO CONTRADISSE O DIAGNÓSTICO, e essa é a lição do item.** A fila supunha que faltava
`overflow`/`ellipsis` no deitado. Medindo com nomes de 14 caracteres (o `maxlength` do menu),
o nome **cabe** deitado — 109 px de 109 px disponíveis. Quem corta é o **retrato**: com quatro
jogadores a faixa dá **68 px** para 93–95 px de texto, e "Maria Fernanda" virava "Maria Fer…".

O que existe deitado é outra coisa, e de longe se parece com nome cortado: **o `#topo` monta
em cima da lista de jogadores.** Ele é centrado na TELA (454 px de largura) enquanto os três
botões ocupam 14→146 px à esquerda e o `#jogadores` fica ancorado à direita. Cada caixa cabe
sozinha e **nenhuma pergunta pela outra**:

| tela | `#topo` | `#jogadores` | sobreposição |
|---|---|---|---|
| paisagem 844×390 | 195–649 | 693–830 | — |
| paisagem 736×414 | 141–595 | 585–722 | 10 px |
| paisagem 667×375 | 107–561 | 516–653 | 45 px |
| paisagem 640×360 | 93–547 | 489–626 | **58 px** |

**Por que a suíte jurava que o deitado estava bem:** ela só tinha `paisagem 844×390`, que é o
**maior** deitado que existe em celular — e o único onde isto não acontece. Uma tela de teste
escolhida pelo caso fácil é pior que nenhuma, porque ela dá um verde que parece cobertura.
Entrou `paisagem 640×360`, e com ela **17 falhas** de cara.

**O conserto — CADA FAIXA TEM DONO** (escolha do Ricardo em 31/07/2026). O `#topo` deixa de ser
centrado na tela e vira uma faixa entre as duas colunas, por construção incapaz de alcançá-las.
Como a faixa é estreita, sai o que se deduz de outro lugar: o "até 6" (está no menu e na tela de
fim) e parte do nome do time (está na lista ao lado).

- **As reservas são a largura da coluna MAIS a margem dela.** Reservar 124 px para uma coluna
  que ocupa 130 (116 de largura + 14 de âncora) deixava 6 px de invasão — invisível a olho e
  260 px² para o teste, que é exatamente para isso que ele serve.
- **`#jogadores` ganhou largura FIXA**, e é o que torna a conta acima verdadeira: com largura de
  conteúdo, um nome longo empurraria a coluna de volta para dentro da faixa do topo.
- **Zerar o `transform` é obrigatório** — mesma armadilha que a gaveta pagou no item 10.

**No retrato, o corte passou a ser na PALAVRA** (escolha do Ricardo): `nomeEmPartes()` em
`13-hud.js` põe o sobrenome num `<i class="resto">` e o CSS o esconde onde a faixa aperta.
"Maria Fernanda" vira **"Maria"**, inteiro e legível de relance, em vez de "Maria Fer…" — cortar
no meio da palavra é o que fazia o nome deixar de identificar quem é. O ellipsis continua ali
para o primeiro nome que ainda assim não couber.

**As duas metades passam pelo `escapar`.** O nome do convidado é entrada de fora e fatiar uma
string não a torna segura — repare que um nome-ataque como `<img src=x>` **também tem espaço**,
então o corte cai no meio dele. Sai `&lt;img` + `<i class="resto"> src=x&gt;</i>`.

**A barra de ações desceu para a faixa esquerda junto**, e o número explica por quê. `#acoes`
tem a MESMA largura nas duas paisagens (x 14→264), mas o arco dos adversários não: em 844×390
ele começa em 271 e escapa por **7 px**; em 640×360 começa em **181**, porque a mesa é mais
estreita, e a barra monta em cima de 83 px de peça. Prendê-la à faixa que já era dela
(`max-width` + `flex-wrap`) resolve os dois sem tocar no 3D. O caminho de fazer a mesa desviar
existe (`apertoDaMesa`), e continua sendo o mais caro.

**Sete pixels de folga não são um conserto, são sorte.** Era exatamente essa a folga em
844×390, a única paisagem que a suíte tinha — mais um jeito de o mesmo defeito ter passado.

### 9. Peças "bugadas" em vertical = peças POR BAIXO DE PAINEL ✔ feito (ver item 10)

De **30/07/2026**. O Ricardo confirmou que **é layout**, não textura — o que descartou o atlas
de pintas e o WebGL do aparelho, que seriam os únicos ramos impossíveis de consertar às cegas.

Com isso o item 9 e o item 10 são **a mesma coisa**, e a asserção que faltava provou: em
**retrato 360×640 com a conversa aberta, CINCO peças da sua mão ficam por baixo do
`#conversa`**. A peça está no lugar certo, dentro do quadro, com um painel em cima — que é
exatamente a pergunta que o teste não sabia fazer.

### 10. Peça por baixo de painel ✔ feito — asserção e conserto

De **30/07/2026**. O `test-telas.mjs` reprovava peça **fora do quadro** e painel **sobre**
painel, mas não peça **por baixo** de painel. São perguntas diferentes, e a que faltava é a
que pega a família de defeitos que o Ricardo relatou.

A asserção foi escrita **antes** do conserto e reprovou **20 vezes**, o que é o ponto: era um
defeito relatado em palavras ("peças bugadas") e virou uma lista de linhas e telas. Ela ficou
numa branch até o conserto existir — teste vermelho no tronco ensina exatamente o hábito que o
item 11 condena.

Ela mede as **caixas que PINTAM** (`.painel`, `button.canto`, `#acoes button`, `#confirmar`) e
não os contêineres: o `#topo` em retrato é uma faixa da largura da tela com fundo
transparente, e usar o retângulo dele acusaria cobertura no vão entre um painel e outro, onde
dá para ver o jogo.

**O que ela achou — 20 falhas, e o desenho delas é a informação:**

| tela | o que fica coberto |
|---|---|
| retrato 390×844 | a mão de um adversário, por baixo do `#contagem` (3 cenas) |
| retrato 360×640 | **5 peças da SUA mão** por baixo do `#conversa`; adversário sob `#contagem` |
| paisagem 844×390 | peças da sua mão sob `#btContagem` e `#conversa`; adversário e tabuleiro sob `#contagem` |
| tablet 820×1180 | limpo |
| wide 1600×900 | limpo |

**Tablet e wide passam.** É por isso que isto nunca apareceu no computador, e é a confirmação
de que o relato "só no celular" está certo.

**O conserto escolhido pelo Ricardo: GAVETA.** No celular a conversa e a contagem param de
conviver com o jogo — abrem por cima, com cortina atrás, e fecham num toque. É a única saída
que respeita a aritmética: numa tela de 360 px o `#conversa` tem **268 px fixos**, então painel
e mão não cabem lado a lado, e encolher a mesa até caber deixaria o tabuleiro pequeno demais
para ler.

Três coisas que só apareceram ao fazer:

- **A gaveta tem de ser MODAL** (`body.gaveta` esconde `#acoes`, `#vez` e `#confirmar`). Sem
  isso a barra de ações fica boiando **por cima da cortina**, que é a mesma confusão de antes
  de cabeça para baixo.
- **A ASSERÇÃO estava incompleta**, e foi a gaveta que revelou: "nada do jogo sob painel" é
  falso quando há gaveta aberta — uma gaveta **existe** para cobrir o jogo. O defeito nunca foi
  cobrir; foi cobrir **sem dizer**. Hoje o teste exige coisas diferentes conforme o estado:
  gaveta fechada, nada coberto; gaveta aberta, ela manda na tela sozinha.
- **Zerar o `transform` é obrigatório.** Em tela baixa a contagem era centrada por `left: 50%`
  + `translateX(-50%)`. Só trocar o `left` deixa o deslocamento de meia largura de pé, e a
  gaveta nasce 414 px fora da tela.

**Deitado, a barra de ações subiu para o topo.** Em 844×390 a mão se espalha por ~80% da
largura e desce até a beirada de baixo: qualquer coisa no rodapé esquerdo fica em cima da peça
mais à esquerda. É a última sobra da Fila 2, e ela finalmente apareceu **em número** em vez de
em opinião.

O caminho não escolhido, se um dia fizer falta: fazer o 3D **desviar** das faixas ocupadas,
que combina com o `apertoDaMesa()` e o `larguraVisivelEm()` — e é o mais caro.

Não é hipótese de que esta família reincide: o comentário do `07-cena.js` registra que o copo
já foi movido à mão uma vez pelo mesmo motivo. Defeito que já voltou uma vez volta de novo, e
a diferença entre um conserto e uma asserção é exatamente essa.

### 11. O `test-telas.mjs` era INTERMITENTE — METADE feita, A FAZER (3º da fila)

Descoberto em **30/07/2026**, ao acrescentar a cena da mesa online. Três rodadas seguidas do
mesmo código deram: falha em `#acoes` × `#conversa` se sobrepondo, depois **passe limpo**,
depois falha diferente (`o tabuleiro passou da borda, ndc.x 1.05`). Mesmo commit, três
resultados.

**A causa:** as cenas montam a mesa com `auto(6)` / `ateALinha(13)`, que jogam de verdade — e
no navegador o `Math.random` **não é semeado**, ao contrário do harness em Node. Cada rodada
monta um tabuleiro diferente, com uma quantidade diferente de linhas na conversa e um
comprimento diferente de fileira. Vários casos ficam **na beirada** do limite, e a moeda
decide.

**Por que é pior do que parece:** um teste que falha às vezes ensina a rodar de novo. E "rodar
de novo" é exatamente como uma regressão de verdade passa — foi o que quase aconteceu aqui: a
primeira falha parecia culpa do painel novo, e não era. O tempo gasto separando as duas coisas
é o custo recorrente.

**Feito pela metade, e vale saber qual metade.** As cenas passaram a semear `Math.random`
dentro da própria página (`semear()` no `AJUDA`, um mulberry32 de cinco linhas) — não precisou
de nada no jogo, porque a página inteira usa `Math.random`. Isso matou a variação do
**embaralho**: a mesma cena monta sempre as mesmas peças.

### 11. O `test-telas.mjs` era INTERMITENTE ✔ feito (31/07/2026)

**A segunda metade não era o que a fila dizia.** A previsão era "parar os temporizadores de
bot durante a montagem". Isso foi feito (`pararBots()` na ponte, um `clearTimeout(timerBot)`;
uma chamada basta, porque `seguirOTurno` só roda em `publicar()`) — **e não bastou.**

Comparando duas rodadas **linha a linha** em vez de só olhar o verde, o desenho apontou
sozinho: **só o `mesa` variava.** `outros`, `monte`, `fileiras`, `peças` e `fov` saíam
idênticos. E algumas variações eram grandes — `mão de 7` dava `0.48` e `0.66`, `contando` dava
`0.59` e `0.89`.

A causa real: **as peças DESLIZAM até o lugar**, e a espera fixa de 350 ms pegava a animação no
meio. Quem decidia onde a peça estava era o relógio de parede e o jitter do software
rendering, não a cena. O `pararBots` tirou a variação de *quantas* jogadas aconteceram; faltava
a de *onde elas pararam*.

**O conserto: esperar a tela PARAR, e não contar tempo.** A cena tira uma foto das posições a
cada quadro e segue quando oito quadros saem iguais, com teto de 240 quadros para uma cena que
nunca assente não travar a suíte.

**Veredito:** duas rodadas seguidas, 49 linhas cada, **idênticas**. Com isso a ressalva "rode
duas" deixa de valer — uma rodada do `telas` voltou a ser prova.

**O preço, dito de frente:** a suíte passou de ~5 para **mais de 10 minutos**. Esperar oito
quadros parados custa mais que contar 350 ms, e são 54 cenas (6 telas × 9 casos). Foi troca
consciente — antes eram duas rodadas de 5 min para ter meia certeza; hoje é uma de 10 para ter
certeza. Se um dia incomodar, o lugar de mexer é o número de quadros parados exigidos, não a
volta ao prazo fixo.

**E ela já passou do que uma sessão aguenta numa tacada.** Em 01/08/2026 a rodada completa foi
interrompida por limite de tempo **quatro vezes seguidas**, e o jeito de obter veredito foi
cortar a lista de `TELAS` em duas metades e rodar cada uma. Funciona, mas é manual e fácil de
esquecer metade. **O próximo a mexer aqui deveria dar à suíte um argumento de linha de comando
para escolher telas** (`node test-telas.mjs 640x360,360x640`), que é barato e transforma a
gambiarra de hoje em ferramenta — inclusive para iterar num defeito de uma tela só.

Três armadilhas pagas, e as três valem mais que o conserto:

- **A posição do GRUPO conta, não só a das peças.** O `grupoMesa` faz o próprio easing em z
  para manter o tabuleiro centrado (`09-tabuleiro.js`). Olhando só os filhos, a foto ficava
  parada enquanto o mundo inteiro ainda deslizava — e a medida é em coordenadas de **mundo**.
- **`throw` dentro de um callback de `requestAnimationFrame` NÃO rejeita a `Promise` que o
  envolve.** O `reject` nunca é chamado, então o erro vira travamento silencioso: a suíte
  parou 30 s e o puppeteer cuspiu um `ProtocolError` que não fala da causa. O erro era um
  `j.grupoMao` inexistente — **a ponte nunca expôs esse grupo** (a mão sai do `naMao`).
- **`diff` de dois arquivos VAZIOS passa.** A suíte travada não gerou saída, os dois arquivos
  saíram com zero linhas, e a comparação declarou "idênticas". Um teste de igualdade tem de
  exigir também que **haja o que comparar** — senão a ausência de dados vira prova de
  consistência. Hoje a comparação reprova abaixo de 40 linhas.

## Fila 6 — o que a varredura de 31/07/2026 achou

Com a Fila 5 fechada e nada relatado em aberto, a pergunta virou "o que ainda vale
melhorar?". Foram varridas três frentes que a Fila 5 não cobria: cobertura de teste,
robustez dos módulos não auditados naquele dia (`05`, `06`, `07`, `08`, `12`, `14`), e
experiência/acessibilidade. **Cada achado foi conferido à mão antes de entrar aqui.**

Saíram cinco defeitos, todos ✔ feitos na v1.7.1. **Dois deles são a mesma doença dos itens
6 e 7: o jogo falhando em silêncio.**

**A FILA 6 CONTINUA ABERTA.** Os cinco defeitos fecharam; o resto do que a varredura achou
está na seção **"o que ficou de FORA do escopo"**, no fim desta fila — acessibilidade,
cobertura de teste e documentação. Nada disso é defeito, tudo isso é medido, e a ordem
recomendada está no **"O QUE FAZER AMANHÃ"** lá em cima.

**Nenhum destes cinco foi relatado por ninguém.** Vieram de procurar, não de esperar — e é
uma diferença que vale registrar, porque a Fila 5 inteira nasceu de relato. Os dois modos se
complementam: o campo acha o que incomoda, a varredura acha o que ainda não incomodou.

### 1. O mudo durava exatamente um clique ✔ feito

`12-audio.js` implementa o mudo suspendendo o AudioContext. O listener de `pointerdown`
que existe para destravar o áudio (navegador exige um gesto) retomava o contexto em
**qualquer** toque, sem perguntar se o jogador tinha pedido silêncio. Clicava em ♪, calava;
o toque seguinte — escolher uma peça — religava tudo, **com o botão ainda mostrando ✕**. A
preferência lembrada morria igual: `ligarMurmuro` aplica o mudo no começo da partida e o
primeiro toque na mesa desfazia.

**Por que durou tanto:** `AudioContext` era `undefined` no harness, então o áudio inteiro
nunca ligava e o mudo não tinha um único teste. Hoje o dublê tem `state` e o par
`suspend`/`resume` de verdade — **terceira vez que a lição "quem estava incompleto era o
dublê" se paga** (as outras foram `matchMedia` e a captura de ponteiro).

Junto veio um detalhe de legibilidade que não é acessório: o parâmetro de `silenciar(mudo)`
**sombreava a global de mesmo nome**, e é o tipo de coisa que faz um defeito assim ser
difícil de enxergar. Chama-se `calado` agora.

### 2. O nome ia para `innerHTML` sem escape — a TERCEIRA mordida ✔ feito

`montarCadeiras` (`14-menu.js`) escrevia `value="${c.nome}"`. Era o único `innerHTML` do
projeto fora do `escapar()`, e **pior que os anteriores por estar dentro de um ATRIBUTO**:
basta uma aspa para sair dele.

`c.nome` vem de fora — o convidado manda o nome pela rede, `15-rede.js` escreve em
`MESA.cadeiras[].nome`, e `lembrarMesa()` persiste as quatro cadeiras. Um convidado com
nome `"><img src=x onerror=…>` rodava script na máquina do **anfitrião** assim que ele
mexesse no modo, no número de jogadores, ou recarregasse.

**O caso benigno também era real:** um jogador chamado `Zé "O Rei"` fechava o atributo
sozinho; o campo passava a mostrar `Zé ` e o nome corrompido já estava gravado.

**Lição da asserção:** a primeira versão dela usava o nome `<img src=x>` que a suíte já
tinha — e **passava nos dois lados**. Sem aspa, aquele nome fica preso dentro do `value=` e
não vira elemento nem no código com defeito. Quem abre o atributo é a aspa. *Asserção que
não reprova no código antigo não prova nada, e "parece o mesmo ataque" não é o mesmo
ataque.*

### 3. A revanche congelava a mesa ✔ feito

`comecarLocal()` convertia cadeira `online` em bot **só `if (modo === 'local')`**. Isso
cobria a revanche depois de SAIR de uma mesa e deixava passar a revanche DENTRO de uma: o
anfitrião clicando "Revanche" com um convidado que já fechou a aba montava uma partida com
uma cadeira que ninguém joga. `seguirOTurno` não faz nada quando chega a vez dela, e a mesa
**para para sempre** — sem mensagem, sem botão.

**A guarda estava condicionada ao lugar errado.** A pergunta nunca foi "em que modo estou",
é **"esta cadeira tem alguém do outro lado"** — e quem sabe isso é `conexoes`, vazio em mesa
local e portanto convertendo tudo, como antes. Com a regra aqui, o `btIniciarOnline` voltou
a ser só `comecarLocal()`: **duas cópias da mesma regra, uma delas com defeito, é como o
defeito dura.**

**Lição da asserção:** a primeira versão passava no código antigo, porque em Node `modo`
era eternamente `'local'` — `temPeerJS()` era falso e `abrirMesaOnline` desistia na primeira
linha. O harness ganhou um `Peer` que ABRE E NÃO FALA, só para o jogo poder alcançar o
estado de anfitrião. *Um dublê que nunca deixa o código chegar no estado interessante dá um
verde que não quer dizer nada.*

### 4. Se o CDN não carregasse, o menu ficava na tela e nada funcionava ✔ feito

O jogo inteiro é **um `<script type="module">`** que começa importando o three do CDN. Se
esse import falha — wifi de bar, WebGL desligado, aparelho velho — **nada daquele módulo
executa**, e portanto nenhum handler de botão é registrado. Como o `#telaMenu` nasce visível
no HTML, a pessoa via o menu inteiro, digitava os nomes, apertava "Sentar e jogar" e não
acontecia nada. Para sempre.

Havia tratamento explícito e cuidadoso para o **PeerJS** faltar, e **nenhum para a
biblioteca sem a qual o jogo não existe**.

Hoje há um `<script>` clássico (não-módulo) que sonda `window.__jogo.pronto` e mostra um
recado se ele não aparecer. **Sonda, e não um `setTimeout` único:** com prazo fixo, uma
máquina lenta mostraria o recado com o jogo ainda a caminho — e o `test-telas` reprovaria
por painel a mais na tela. O `#semCarga` fica **fora** da lista do `mostrarTela`, então o
jogo nunca disputa esse elemento com a sonda.

**Não tem teste automatizado**, e isso está dito de propósito: exigiria interceptar rede no
puppeteer. Confere-se bloqueando `cdn.jsdelivr.net` no DevTools e recarregando.

### 5. Chave de protótipo no `localStorage` dava tela preta permanente ✔ feito

`MODOS[g.modo] ? g.modo : MODO_PADRAO` — `MODOS` é objeto literal, então
`MODOS['constructor']` é **truthy** e passava; `MODOS['constructor'].cadeiras` é `undefined`
e a linha seguinte lançava `TypeError`. Como `mesaLembrada()` roda no **topo do módulo**, a
exceção matava o script concatenado inteiro: **tela preta que voltava a cada
recarregamento**, porque a causa estava guardada. O jogador não tinha como sair sem limpar o
armazenamento.

O comentário logo acima da função promete cobrir "alguém mexendo no armazenamento à mão" —
**a validação existia e tinha um buraco do tamanho do protótipo do `Object`.** Hoje é
`Object.hasOwn`, aqui e no `NIVEIS` (onde o efeito era brando, mas deixar dois padrões de
validação no mesmo arquivo é como o primeiro volta).

A asserção contra o código antigo é a mais eloquente do projeto: **`window.__jogo` nem
existe.**

---

### O que ficou de FORA do escopo, e continua valendo

O Ricardo escolheu só os cinco defeitos nesta rodada. Isto aqui é trabalho real, medido, à
espera:

**Acessibilidade — o projeto não tem UM `aria-*`.** Busca no repositório inteiro: zero
`aria-*`, `role`, `alt`, `tabindex`, `:focus-visible`, `prefers-*`. Por ordem de alavanca
sobre custo:

- `aria-live` em três elementos (`#aviso`, `#vez`, `#conversaLista`). `avisar()` é o canal
  de **todo** erro do motor e do porquê de a peça não dar. Três atributos.
- **O texto de ERRO é o de menor contraste da tela**: `#onlineErro` usa `.nota`
  (`opacity: .5` em 12 px, ~4.3:1 — abaixo do AA). Erro não é decoração.
- `prefers-reduced-motion` não existe; a lâmpada pulsa para sempre e a câmera reenquadra.
- **O botão de mudo vira `✕` — o mesmo glifo do botão de sair, 22 px ao lado.**
- Não dá para jogar sem apontador. Os botões de confirmar já são `<button>` de verdade e
  já pegam Tab; falta só selecionar a peça (teclas `1..9` chamando `selecionarPeca`, que já
  existe e é a mesma que a dica usa).

**Cobertura — o buraco é a camada que o olho e o dedo tocam.** O motor e a rede estão muito
bem testados; sem asserção nenhuma estão: **as pintas da peça** (`08-peca3d.js` — se
`faceDaPinta(3)` desenhasse 4 pintas, *tudo continuaria verde* e o jogo mostraria peças
erradas), o **fim de mão em duplas** (só há asserção com `MESA.n = 2`), **o conteúdo** do
painel de contagem (só se testa se ele cobre a mesa, nunca se conta certo), o **`<select>`
de cadeira** do menu (é como se escolhe contra quem jogar), o **esgotamento** do prazo de
30 s de quem cai, e os ramos de rede do **sair da partida**. A **compra voluntária** é o
caso mais curioso: existe no menu, é persistida e validada, e **o ramo nunca roda**, porque
o bot nunca compra tendo jogada.

**Documentação, duas releases atrás.** O `README.md` não menciona a conversa da mesa, a dica
de jogada, a gaveta do celular nem o reabrir a mesa; diz que o bot difícil ganha ~59% (é
**55,8%** depois das mudanças de regra dos itens 1 e 2); e o diagrama de branches para na
v1.1.0. (O cabeçalho deste arquivo dizia o mesmo e já foi corrigido: são **4.537** linhas.)

**Dívidas registradas e NÃO consertadas, com o porquê:**

- `08-peca3d.js` clona um material por peça e o projeto **não tem um único `dispose()`**.
  Investigado: os clones têm parâmetros idênticos, logo mesma `cacheKey` no three — é um
  programa só, e os materiais viram lixo coletável ao sair da cena. É churn de alocação por
  rodada, não memória crescente. Dívida, não defeito que o jogador sente.
- `06-layout.js` devolve o MESMO objeto em `alvos.esq` e `alvos.dir` quando a linha está
  vazia. Aliasing armado — mas `alvos` **não é lido por ninguém**: é código morto. Consertar
  ou remover, e remover é provavelmente melhor.
- `05-bot.js` entrega o mesmo array `VAZIO` de Sets a todos os bots fáceis. Hoje só é lido,
  então está correto; um `add` ali um dia envenenaria o esquecimento de todos.

## Fila 7 — as cinco fotos de campo de 31/07/2026 ✔ fechada (v1.8.0)

O Ricardo mandou cinco fotos de celular, tiradas entre 07:17 e 15:09 de **31/07/2026**, com
cinco defeitos vistos jogando.

**A PRIMEIRA COISA A FAZER FOI DATAR AS FOTOS, e é a lição de processo desta fila.** A
v1.6.0 subiu às 20:40 daquele dia; as cinco fotos são anteriores, ou seja, **todas mostram a
v1.5.0** — a versão que ficou no ar o dia inteiro por causa do "commitado ≠ enviado ≠
publicado". Relato de campo tem data, e a data diz contra qual código ele vale. Sem essa
conferência, dois defeitos já consertados teriam sido "consertados" de novo, e três abertos
poderiam ter sido descartados como "já resolvido".

| # | relato | veredito contra a v1.7.1 |
|---|---|---|
| 1 | bug ao sair para outro aplicativo | **ABERTO** — defeito novo, nunca esteve em fila |
| 2 | layout cortando o nome lá em cima | **ABERTO** — o item 8 consertou o TEXTO, não a largura do cartão |
| 3 | dominó atravessando na mesa | **ABERTO** — nunca diagnosticado |
| 4 | deitado tampa uma peça | corrigido no item 8 (v1.6.0) — faltava a prova |
| 5 | mesma pessoa várias vezes na mesa | corrigido no item 4 (v1.6.0) — faltava a prova |

### 1. As peças ficavam PRETAS ao voltar de outro aplicativo ✔ feito

São **duas perdas independentes**, e o defeito só existe com as duas juntas — o que a
medição (`tests/test-textura.mjs`, escrito primeiro só imprimindo números) mostrou assim:

| | | luz da peça na tela |
|---|---|---|
| E1 | só perder e restaurar o contexto WebGL | 166 → 166 |
| E2 | só apagar os bitmaps dos canvas | 166 → 166 |
| **E3** | **as duas juntas** | **166 → 3** ← a foto |
| E4 | perder e restaurar três vezes | estável |

Separadas não aparecem: o three reenvia a textura a partir de `texture.image` no restore, e
canvas íntegro reenviado é igual; canvas apagado **sem** restore não é reenviado, porque o
único `needsUpdate` do projeto é de UV. Juntas, o restore sobe um bitmap em branco.

**O palpite escrito antes da medição estava errado, e vale registrar como ele era
convincente:** "se as três texturas caíssem juntas, o TAMPO também estaria preto, e na foto
ele está marrom — logo não é isso". O tampo cai de 132 para **80**, não para 0, porque com o
albedo zerado o `MeshStandardMaterial` ainda devolve o brilho ESPECULAR da lâmpada. Mesa
marrom e peça preta na mesma foto é exatamente o que a hipótese previa. **Quarto diagnóstico
de leitura que este projeto perde para um número.**

O conserto é guardar a receita: `desenho` era um arrow inline usado uma vez e jogado fora.
`pintar()` registra `{nome, canvas, textura, repintar}`, e dois ganchos chamam uma sonda de
1 pixel (`alfa < 8` é a assinatura do bitmap descartado, porque toda receita começa com
`fillRect` opaco):

- **`webglcontextrestored`** — o que o three não pode fazer por nós.
- **`visibilitychange` na VOLTA** — o outro lado do gancho do `11-interacao.js`, que só trata
  a saída. Sem contexto perdido a tela continua certa, mas o bitmap em branco fica **armado**
  para o próximo restore.

**O veio da madeira ganhou gerador próprio** (mulberry32 semeado). Duas razões: repintar tem
de devolver a MESMA madeira, e os ~1.000 `Math.random()` do veio deslocariam a sequência que
as suítes de tela semeiam dentro da página — a intermitência do item 11 voltando pela porta
dos fundos. Medido: **0 sorteios globais por repintura**.

**O dublê do harness ficou para trás pela QUINTA vez** (`matchMedia`, captura de ponteiro,
`AudioContext`, `Peer`, e agora os eventos de contexto WebGL). A tentação era guardar no jogo
com `if (domElement.addEventListener)`; está errado pelo mesmo motivo de sempre.

**A suíte fecha de quebra a maior lacuna de teste do projeto:** `08-peca3d.js` não tinha
NENHUMA asserção sobre o que a face desenha. Agora cada célula do atlas é amostrada nos 9
pontos da grade contra uma tabela escrita **no teste** — ler `PINTAS` do jogo conferiria a
tabela contra ela mesma —, e a UV de cada metade prova a convenção "o `[0]` à esquerda".
Conferido por mutação.

**Duas armadilhas de teste que esta suíte pagou:**

- **`restoreContext()` chamado de dentro do despacho do `lost` é IGNORADO pelo Chrome**, e o
  `restored` nunca vem: promessa que não resolve, e do lado de Node um `ProtocolError` três
  minutos depois que não fala da causa. Precisa de folga, e de **prazo em toda espera de
  evento** — evento que não chega é informação, travamento não é.
- **Comparar a repintura com a PRIMEIRA pintura não mede o nosso desenho.** O Chrome
  rasteriza um canvas novo e um canvas já usado como fonte de textura de formas levemente
  diferentes: até o piso, que é `fillRect` e linhas retas sem um sorteio sequer, muda 0,6%.
  Quem responde "é sempre a mesma madeira?" é **repintura contra repintura**.

### 2. O quarto jogador nascia fora da tela ✔ feito

`grid-auto-columns: minmax(96px, 1fr)`, e **`1fr` nunca encolhe abaixo do piso do minmax**:
quatro cadeiras pedem `4×96 + 3×5 = 399px` numa caixa de 322 (tela de 390) ou 292 (tela de
360). O bloco era **byte a byte** o mesmo desde a v1.5.0 — o item 8 consertou o corte do
NOME e nunca tocou na largura do cartão.

**A suíte era cega por três motivos somados, todos com a mesma raiz: ela media CONTÊINERES,
e contêiner com `overflow` mente sobre o que está dentro dele.** Os painéis eram coletados
por ID (os `.jog` nunca eram medidos); o `transbordo` saía de `documentElement.scrollWidth`,
e transbordo dentro de um `position: fixed` com `overflow-x` nunca chega ao documento; e a
varredura de "peça por baixo de painel" procura `.painel`, que o `.jog` não tem.

A asserção nova **não é "medir `.jog`"**. É: *um filho pintado não pode sair da caixa do
próprio painel — a menos que dê para rolar até ele.* O "a menos que" é o que a torna honesta,
porque painel rolável TEM o direito de o filho passar da caixa; mas `pointer-events: none`
faz a rolagem ser decoração. Assim ela codifica o **requisito**, não a implementação: fica
verde tanto encolhendo o cartão quanto tornando a rolagem real. **10 falhas antes, 0 depois.**

**A ressalva do Ricardo estava certa e foi medida:** encolher o cartão custa o nome — de 68px
para 47px em 360, e a 47px o ellipsis começava a comer nomes CURTOS como "Ricardo", o que
desfaz por baixo a decisão do item 8. **A emenda que eu tinha planejado não serviria, e a
medição mostrou por quê antes de eu escrevê-la:** a régua de peças vive em
`grid-column: 1/3`, ou seja na SEGUNDA linha do cartão, e não disputa largura com o nome.
Quem devolve pixel é padding, gap e borda mais magros (9px) mais um ponto a menos de fonte
(~4% de texto): 59px em 390, 51px em 360, **zero nomes cortados** no pior caso.

### 3. A linha da mesa atravessando a mão do vizinho ✔ feito

**Eram duas contas que não se falavam** — `09-tabuleiro.js` media o orçamento do tabuleiro em
`z = 0.4` com divisor `0.86`; `10-mao.js` apertava os assentos em `z = −3.05` com divisor
`13.5`. Que as duas dessem quase o mesmo número era coincidência aritmética, **e a
coincidência era justamente o que garantia a colisão**: folga de −0,42 em todo retrato. É a
mesma doença do item 8 ("cada caixa cabe sozinha e nenhuma pergunta pela outra"), agora em 3D.

Hoje é uma conta só: `larguraUtilDoTabuleiro` (em `06-layout.js`, **puro**) tem três tetos e
o menor manda — a madeira, a tela, e o **corredor** entre os montes dos adversários. E o
aperto passou a ser decidido pelo assento que **binda**, cada um medido na profundidade dele:
o `13.5` media sempre onde senta o adversário DE CIMA, e quem estoura é o de LADO, em `z = 0`,
onde a tela é ~16% mais estreita. Mesma lição que o monte já tinha ensinado, cobrada uma
segunda vez, no assento — e com ela o divisor mágico morreu.

**A asserção 3D CONTRA 3D não existia**, e é a lacuna estrutural que esta fila fecha: o
`test-telas` sabia perguntar "está dentro do quadro" e "está por baixo de painel HTML", e a
linha correndo por dentro da mão do vizinho passa nas duas. Agora compara **caixas** em
coordenadas de mundo (centros nunca acusariam: ficam a 2,7 um do outro e quem se toca são as
bordas), ignora o Y de propósito (tudo nasce no tampo) e exclui a marca da última jogada, que
inflaria a caixa em 0,22 e mediria o clarão em vez da madeira.

**ELA ACHOU UM SEGUNDO DEFEITO, mais fundo e mais antigo que o da foto:** os copos e o
cinzeiro estavam DENTRO das mãos dos adversários, **−0,82**, em paisagem, wide e tablet — ou
seja, no computador, sempre, desde o começo. Ninguém relatou porque peça de costas dentro de
copo de vidro lê como "coisa do boteco". As tralhas foram para o **arco da frente**, que é
calculado e não escolhido a olho: as cadeiras possíveis são 90°, 120°, 180°, 240° e 270°,
cada mão cobre ±23° do anel (±27° com as catorze do Duelo), então o anel está ocupado de 63°
a 297° e sobra a frente — livre **por construção** em qualquer tamanho de mesa, e é por isso
que estas posições podem seguir sendo literais.

| tela | folga antes | depois |
|---|---|---|
| retrato 390×844 | −0,42 | +0,33 |
| retrato 360×640 | −0,41 | +0,33 |
| paisagem 844×390 | −0,82 | +1,11 |
| paisagem 640×360 | −0,82 | +1,11 |
| tablet 820×1180 | −0,21 | +0,33 |
| wide 1600×900 | −0,82 | +1,11 |

O limiar é **0,15 e não zero**: "sete pixels de folga não são um conserto, são sorte". E a
folga vai para o log **sempre, mesmo verde** — é a margem que encolhe em silêncio.

### 4 e 5. Os dois que já estavam corrigidos — a prova que faltava ✔ feito

**Foto 4** (paisagem tampando peça, item 8) não precisou de teste novo: a asserção de "peça
por baixo de painel" já cobria, e agora dá para rodá-la em um minuto em vez de dez.

**Foto 5** (a mesma pessoa em três cadeiras, item 4) ganhou cena nova no `test-online.mjs`:
saguão, mesa de 4, três abas com o MESMO `clienteId`. Ela cobre três eixos que a asserção
existente não cobria — **saguão** (`P` nulo, o único lugar onde `largar()` apaga o dono da
cadeira), **mesa de 4** (com três vagas o `findIndex` tem para onde errar) e **três** abas,
que encadeiam dois take-overs.

**Ela nasce VERDE, e isso está dito no próprio teste**, porque a casa trata asserção que
nasce verde como coisa que não prova conserto nenhum. Foi conferida por mutação: desligando o
`donoDaCadeira` em `sentar()`, ela reproduz a foto letra por letra — *"a mesma pessoa ocupou
3 das 3 cadeiras online"*.

### O que esta fila deixou de ferramenta

- **`test-telas.mjs` e `test-online.mjs` aceitam escolher tela e cena** (`node
  test-telas.mjs 360x640 nomes`, `node test-online.mjs --so=saguao`). Era o item 4 do "o que
  fazer amanhã" e virou pré-requisito prático: a rodada cheia passa de 10 minutos e o
  contorno era cortar a lista `TELAS` à mão, que é editar o teste para poder rodá-lo.
  **Seleção vazia é ERRO** e o rodapé **grita "RODADA PARCIAL"** — sem as duas, o argumento
  troca uma gambiarra por outra.
- **`npm run textura`** — suíte nova, ~40 s, que também é a única asserção que existe sobre o
  que as peças desenham.
- **A folga 3D e a largura do nome no log do `telas`**, sempre.

## Regras da casa (implementadas)

Três modos, na tabela `MODOS` de `01-constantes.js`: **Clássico** (7 na mão, 2 a 4
jogadores, 28 peças), **Duelo** (14 na mão, 1v1, 28 peças) e **Trio** (9 na mão, 3
jogadores, 27 peças — o `0|0` sai, e é isso que faz 27 dividir exato por 3).

Duelo e Trio **esgotam o baralho na distribuição**, então caem sozinhos no caminho "sem
monte, quem trava passa" que a mesa de 4 já usava — não há regra de compra nova. Com
monte só o Clássico de 2 ou 3, onde quem não pode jogar **compra até conseguir**.

**Clássico de 4:** duplas em cruz (1&3 × 2&4). Primeira mão abre com o 6|6 — ou, quando
ele está no monte, com a maior carroça (`quemAbre`, `02-baralho.js`); as seguintes, quem
bateu. Batida: simples 1, carroça 2, **lá-e-lô 2**, cruzada 4. Trancou: 1 ponto para a
mão mais leve; empatou, a mão morre. Partida até 6 (ou 10, no menu). Compra voluntária e
o modo da mesa são alternáveis no menu.

`maoRuim(mao, modo)` em `02-baralho.js` reprova a mão com `modo.carrocasDemais` carroças
ou mais e manda `distribuir` refazer tudo (até `MAX_EMBARALHOS`). Acontece em 1,4% das
distribuições no clássico, 0,6% no duelo e 2,6% no trio.

**Não dá para trancar de propósito** (`fechamentosArmados`, `03-regras.js`, filtrado em
`acoesDe`). Cinco condições para barrar, e cada uma tem um porquê:

1. sem monte — com monte ninguém trava, compra;
2. não é a sua última peça — jogar a última é bater;
3. a peça não é carroça — ela deixa a ponta no mesmo número, então nunca transforma
   ponta viva em morta;
4. sobra outra jogada **que também não feche** — barrar todas te deixaria sem jogada, o
   motor te mandaria passar, e o jogo trancava do mesmo jeito;
5. **você também não responde às pontas que deixou** — se responde, os outros passam, a
   vez volta e você joga de novo. Isso é jogar sozinho, não fechar o jogo.

A conta usa só a mesa e a sua própria mão, e isso é o ponto: se o motor olhasse a mão dos
outros, apagar a peça na tela contaria ao jogador que ninguém tem aquele número.

**A chave ali dentro é canônica de propósito** (`Math.min|Math.max`). O `chave` global é
sensível à ordem, e a linha guarda as peças JÁ ORIENTADAS — quase 40% delas ficam
gravadas invertidas, não casavam com o baralho, e a regra deixava passar o fechamento
armado. O teste cobre isso rodando cada cenário também na **fileira espelhada**.

**Sair conta como derrota** (`abandonar`, `04-partida.js`): grava `P.desistiu`, põe
`fase='fim'` e a tela de campeão tira o time do desistente da conta. No online a cadeira
fica guardada `ESPERA_VOLTA` (30 s) antes de virar derrota — e continua marcada `online`
justamente para o mesmo código reclamá-la.
