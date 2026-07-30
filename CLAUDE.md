# Dominó de Bar — guia do projeto

Dominó dupla-seis em 3D no navegador. De 2 a 4 jogadores em qualquer mistura de gente e
bot, na mesma tela ou pela internet. No ar em
**https://ricardocolombo01.github.io/domino-bar/** (repo público `RicardoColombo01/domino-bar`).

Sem framework, sem bundler, sem asset: madeira, pintas e sons são gerados em canvas e
WebAudio na hora. Three.js e PeerJS vêm de CDN. ~2.100 linhas no total.

## Comandos

```
npm run build     junta src/ num index.html autossuficiente
npm run check     avisa se o index.html está desatualizado
npm test          build + as três suítes de lógica
npm run telas     build + o jogo em cinco tamanhos de tela (retrato, paisagem, wide)
npm run lembrar   build + o que sobrevive a RECARREGAR a página (preferências, retomar)
npm run shots     build + screenshots no Chrome de verdade (tests/shots/)
npm run online    testa o online abrindo duas abas e uma mesa real
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
- **Estado novo no `localStorage` contamina as suítes de navegador.** Elas rodam em
  `file://`, onde o armazenamento é do domínio inteiro: a partida guardada por uma cena
  fazia a seguinte abrir com "Continuar a partida de antes" na foto do menu. É a mesma
  lição do `contar()` — cada cena diz o que quer, e agora há `semGuardado()`.

---

# FILA DE TRABALHO

Sobrou a Fila 4. As filas 1, 2 e 3 estão feitas — ficam registradas abaixo porque o que
elas ensinaram sobre este código continua valendo.

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

**Lembrar preferências (5) ✔ feito.** `guardar`/`lido`/`esquecer` em `01-constantes.js` —
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

Sobrou: **7. dica de jogada** para quem está aprendendo.

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
