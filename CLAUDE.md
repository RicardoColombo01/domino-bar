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

Da Fila 2 sobrou só uma coisa: o HUD de **celular deitado** ainda é o de tela baixa
(`@media (max-height: 560px)`), não um layout próprio. O `#log` que faltava ali deixou de
existir — a conversa o absorveu na v1.5.0.

Fora de fila, o que a v1.5.0 acrescentou além dos itens: a **conversa da mesa** (chat geral
e por dupla, com a narração no mesmo fio, e conversa também no saguão), **voltar para a
mesma partida** depois de a página morrer, e a **legibilidade da mesa** (sRGB, pinta maior,
marca da última jogada).

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

### ONDE PARAMOS — sessão de 30/07/2026

**Leia isto primeiro ao retomar.** É o estado real do trabalho, o que ele produziu, e o que
fazer em seguida. Os detalhes de cada assunto estão nos itens numerados mais abaixo.

#### Nada disto está no ar

`develop` está **11 commits à frente de `origin/develop`**, e **`main` não foi tocada**. Como o
Pages serve da `main`, o que está publicado ainda é a **v1.5.0** — nenhuma mudança desta sessão
chegou a ninguém. Publicar exige `release/*` → merge em `main` com tag, pelo GitFlow do topo
deste arquivo.

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

Suítes ao fim da sessão: `npm test` (3/3), `telas`, `lembrar` e `online` **todas verdes**.

#### A ressalva que não pode se perder

**Uma rodada verde do `npm run telas` NÃO é prova — rode duas.** Semear o `Math.random` matou
a variação do embaralho, mas a espera de 350 ms das cenas ainda deixa passar um número variável
de temporizadores de bot: a mesma cena dá `mesa 0.27` numa rodada e `0.31` na outra. Enquanto
o item 11 não fechar, uma falha isolada do `telas` pode ser moeda, não regressão — **e o
contrário também**.

#### O plano, em ordem

1. **Item 7 — o clique que não joga, no celular.** O mais barato e o mais sentido por quem
   joga. O relato já isolou o candidato: só no celular, sem sair da tela → **limiar de arrasto
   de 9 px**, apertado demais para dedo. Mouse não treme; é a assimetria que aponta.
2. **Item 6 — o toque preso.** `if (arrasto) return;` no `11-interacao.js`: dedo que sai da
   tela nunca manda `pointerup`, e todo toque seguinte é descartado. **Não existe um único
   `visibilitychange` no projeto** — é o gancho que falta, com `pointercancel` e
   `lostpointercapture`.
3. **Item 11 — fechar a intermitência.** Parar os temporizadores de bot durante a montagem da
   cena. Vem antes de qualquer trabalho grande de tela, senão a suíte não serve para julgá-lo.
4. **Item 8 — celular deitado.** O `overflow`/`ellipsis` dos nomes só existe em retrato. Já
   melhorou de lado (a barra de ações subiu no deitado), mas o layout próprio continua devendo.
5. **Item 3(c) — voltar como anfitrião.** O maior. Reivindicar o mesmo id do PeerJS, e para
   isso **inverter** o `unavailable-id` do `tentarAbrir`, que hoje sorteia outro código.
6. **Item 2 — o fechamento forçado.** **Bloqueado esperando o Ricardo:** a mesa, as mãos, o
   lance, o modo, e se havia monte.

#### Perguntas em aberto para o Ricardo

- O **caso concreto** do item 2 (acima).
- **Publicar ou não** o que já está em `develop`. São sete itens fechados, incluindo um
  conserto de regra de pontuação e um de vazamento de mão pela cadeira errada — este último é
  argumento forte para uma `release/1.6.0` cedo.

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

### 2. Ainda dá para FORÇAR o fechamento — BLOQUEADO, esperando o caso do Ricardo

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

### 3. O código da sala tem de ficar visível, para dar de voltar — (a) e (b) ✔, falta o (c)

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
- **(c) Voltar como ANFITRIÃO — o que FALTA.** O difícil, e é o que falta para o "voltar para a mesma
  partida" valer no online. `codigoNovo()` sorteia um código a cada `tentarAbrir`, então o
  anfitrião que recarrega abre uma mesa **outra** e os convidados tentando voltar batem numa
  porta que não existe. Precisaria reabrir com o MESMO código — o id do PeerJS é
  `dominobar-XXXX` e dá para reivindicá-lo se o peer antigo morreu — e casar isso com a
  partida já guardada no `localStorage`. Hoje `retomarPartida` converte cadeira online em bot
  exatamente porque este pedaço não existe. **Detalhe descoberto ao fazer o resto:**
  `tentarAbrir` já trata `unavailable-id` **sorteando outro código** — reivindicar o mesmo id
  exige inverter esse comportamento, e é aí que o (c) vai doer.

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

### 6. Toque preso: o jogo parece congelar e não está — A FAZER (2º da fila)

De **30/07/2026**. `11-interacao.js` começa o trato do toque com `if (arrasto) return;`. Se o
dedo sair da tela ainda apoiado, o `pointerup` **nunca chega**, `arrasto` fica preenchido para
sempre e **todo toque seguinte é descartado**. O render loop continua rodando — por isso
parece congelado sem estar, que é a parte que confunde na hora de relatar.

Não existe **nenhum `visibilitychange` no projeto inteiro**, e é o gancho natural: a aba
perdendo o foco é o sinal de que o `pointerup` não vai chegar. `pointercancel` e
`lostpointercapture` são os outros dois.

### 7. No celular, o clique às vezes não joga a peça — A FAZER (1º da fila)

De **30/07/2026**. Relato do Ricardo: **só no celular, e sem ter saído da tela** — o que
descarta o resíduo do item 6 e aponta para o **limiar de arrasto**. Arrastar é separado de
tocar por DISTÂNCIA (9 px), e 9 px é pouco para dedo: o toque vira arrasto sozinho, solta
fora de qualquer peça e nunca conta como clique. Nunca aconteceu no PC, e mouse não treme —
a assimetria é a evidência.

O terceiro candidato, se não for isso, é o painel da conversa capturando o toque de
propósito.

### 8. Nome cortado com o celular deitado — A FAZER

De **30/07/2026**, e é a **única sobra da Fila 2** aparecendo em campo. O `overflow`, o
`ellipsis` e a rolagem dos nomes existem só dentro do `@media (orientation: portrait)`.
Deitado o jogo cai no `@media (max-height: 560px)`, que só aperta o `gap` — o HUD de celular
deitado nunca foi um layout próprio, é o de tela baixa reaproveitado.

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

**O que SOBROU:** as cenas esperam 350 ms para a tela assentar, e nessa janela um número
**variável** de temporizadores de bot dispara. Duas rodadas seguidas ainda dão `mesa 0.27` e
`mesa 0.31` para a mesma cena. É muito menos folga do que antes, e nenhuma das duas rodadas
reprovou — mas um caso na beirada ainda pode virar a moeda.

**O que falta:** parar os temporizadores de bot durante a montagem da cena, de modo que o
tabuleiro seja função só do que a cena pediu. Enquanto isso não existe, **uma rodada verde do
`telas` não é prova** — rode duas.

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
