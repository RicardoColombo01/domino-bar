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

---

# FILA DE TRABALHO

Ordem sugerida: 3 → 2 → 4. A fila 3 antes da 2 de propósito: é o teste que torna a
adaptação para celular verificável em vez de opinião.

## Fila 1 — o bug dos pontos ✔ feito (v1.0.1)

A mão que decide a partida mostra os pontos antes do campeão; a tela de campeão ganhou
placar final e número de mãos; `#fimSomas` virou `#fimSobrou`, com título "sobrou na mão"
e subtotal por dupla (`fecharMao` grava `somasPorTime`).

**O que ficou de lição:** a tela é função pura de `vista.fase` e `atualizarVista()` roda
em **todo** `publicar()`. Qualquer passo de UI com mais de um estado para a mesma fase
precisa de um flag de módulo em `16-loop.js` (`viuOFimDaMao`), zerado quando a fase muda —
não dá para resolver dentro do HUD.

## Fila 2 — celular (retrato está quebrado)

**Diagnóstico:** `ajustarTela()` (`07-cena.js:192`) só atualiza `camera.aspect`. Como o
`fov` do Three é **vertical**, em retrato (aspect ~0.46) o campo horizontal cai de ~61°
para ~21° e a mão sai pelos dois lados da tela. **Não é CSS, é câmera.**

Decidido com o Ricardo: **peças grandes e mão em duas fileiras**, aceitando que a borda da
mesa saia do quadro.

1. **`enquadrar()` no lugar de `ajustarTela()`** — derivar o `fov` da largura de mundo que
   precisa caber, e não o contrário: `fovX = 2·atan((L/2)/dist)`, depois
   `fovY = 2·atan(tan(fovX/2)/aspect)`, com teto para não distorcer e recuo extra da
   câmera em telas muito altas. Em retrato, aproximar e baixar o `lookAt` para a mesa
   ficar na metade de cima e a mão na de baixo.
2. **`LARGURA_MAO` deixa de ser a constante `8.2`** (`10-mao.js:17`) e passa a ser a
   largura de mundo realmente visível na profundidade da mão, menos margem. Isso resolve
   celular e o pedido de "adaptar à quantidade de peças" com a mesma conta.
3. ~~**Mão em fileiras.**~~ ✔ feito na v1.1.0, junto do Duelo de 14 — `porFileira()` em
   `10-mao.js` quebra em duas fileiras acima de 10 peças, e a de trás sobe, recua e tomba
   mais. Falta só reagir à largura de verdade, que é o item 2 acima.
4. **HUD responsivo por orientação**, não só por largura: painéis do topo viram faixa
   compacta, `#jogadores` vira linha horizontal, alvos de toque ≥ 44 px, `#log` só em tela
   larga, barra de confirmação ocupando a largura inteira embaixo. Hoje só existe um
   `@media (max-width: 720px)` com quatro regras.
5. **Toque:** `touch-action: none` no canvas, `user-select: none`, `viewport-fit=cover` e
   `env(safe-area-inset-*)` para o notch — sem isso o navegador rola e dá zoom por cima do
   jogo. Mais `navigator.vibrate(12)` ao encaixar: uma linha, e muda a sensação.

Arquivos: `07-cena.js`, `10-mao.js`, `css/estilo.css`, `src/pagina.html`.

## Fila 3 — teste de telas (novo: `tests/test-telas.mjs`)

Sem isto, "adaptei para celular" é opinião. Abre o jogo em cinco tamanhos — retrato
390×844 e 360×640, paisagem de celular 844×390, tablet 820×1180, wide 1600×900 — monta uma
partida e **reprova** se:

- `documentElement.scrollWidth > innerWidth` (transbordou);
- qualquer painel do HUD sair da viewport (`getBoundingClientRect`);
- painéis se sobrepuserem (`#vez` por cima de `#acoes`, por exemplo);
- **qualquer peça da mão cair fora da tela** — projetar a posição 3D com a `camera` para
  NDC e conferir `|x| ≤ 1`. Este é o que prova de verdade "dá para ver a mão", e teria
  pego o bug do retrato sozinho, sem ninguém olhar screenshot.

Seguir o padrão de `tests/shots.mjs` (puppeteer-core + Chrome instalado) e usar
`window.__jogo` (`16-loop.js`, no fim) para montar as situações. Lembrar de
`{ polling: 400 }` nos `waitForFunction` quando houver mais de uma aba.

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
