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
01-constantes  peças, medidas, pontuação, folgas visuais, tabela MODOS
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
- **O que cabe na mesa não é o que cabe na TELA.** O tabuleiro, os adversários e o monte
  cabiam nos 6.1 de raio do tampo e mesmo assim saíam do quadro em retrato. Quem tem a
  palavra final é `larguraVisivelEm()`, em `07-cena.js`.

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

0. **`maoRuim` em `02-baralho.js` é placeholder** (devolve `false`). O laço de
   re-embaralho, a trava de `MAX_EMBARALHOS` e os testes já existem — falta só o critério.
   O Ricardo vai escrever; **não escrever por ele.** `tests/test-regras.mjs` avisa no
   terminal enquanto for placeholder e mede quantos embaralhos cada modo gasta.
1. **`escolherJogada` em `05-bot.js:39` ainda é o placeholder** que só descarrega a peça
   mais pesada. É a maior lacuna do projeto — o bot é o adversário na maioria das partidas,
   e no Duelo de 14 a fraqueza dele fica ainda mais visível.
   O Ricardo quis escrever essa função; **perguntar antes de escrever por ele.** O andaime
   está pronto: `opcoes` já vem com `valor` e `carroca`, e `info.faltaNo` guarda os números
   que cada adversário mostrou não ter.
2. **Reordenar a mão** arrastando, ou um botão "agrupar por número". No dominó de verdade
   todo mundo arruma as peças, e hoje não dá.
3. **Painel "o que já saiu"**: quantas peças de cada número já estão na mesa. É a conta que
   jogador bom faz de cabeça, e o jogo já tem o dado.
4. **Marca de "passou no 4"** na cadeira do adversário. O motor já guarda em `P.faltaNo`
   para os bots usarem — só a tela não mostra, o que deixa o humano em desvantagem contra
   o próprio bot da mesa.
5. **Lembrar preferências** (nomes, número de jogadores, som) em `localStorage`.
6. **Reconexão no online:** hoje quem cai vira bot na hora (`15-rede.js`, `conn.on('close')`);
   segurar a cadeira ~30 s antes de entregar ao bot.
7. **Dica de jogada** para quem está aprendendo as regras de bar.

---

## Regras da casa (implementadas)

Três modos, na tabela `MODOS` de `01-constantes.js`: **Clássico** (7 na mão, 2 a 4
jogadores, 28 peças), **Duelo** (14 na mão, 1v1, 28 peças) e **Trio** (9 na mão, 3
jogadores, 27 peças — o `0|0` sai, e é isso que faz 27 dividir exato por 3).

Duelo e Trio **esgotam o baralho na distribuição**, então caem sozinhos no caminho "sem
monte, quem trava passa" que a mesa de 4 já usava — não há regra de compra nova. Com
monte só o Clássico de 2 ou 3, onde quem não pode jogar **compra até conseguir**.

**Clássico de 4:** duplas em cruz (1&3 × 2&4). Primeira mão abre com o 6|6; as seguintes,
quem bateu. Batida: simples 1, carroça 2, lá-e-lô 3, cruzada 4. Trancou: 1 ponto para a
mão mais leve; empatou, a mão morre. Partida até 6 (ou 10, no menu). Compra voluntária e
o modo da mesa são alternáveis no menu.

`maoRuim(mao, modo)` em `02-baralho.js` decide quando a distribuição volta e todo mundo
embaralha de novo (`distribuir` refaz até `MAX_EMBARALHOS`). **Ainda é o placeholder — o
Ricardo vai escrever.** `modo.carrocasDemais` é a munição.
