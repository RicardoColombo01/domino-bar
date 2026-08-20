# Dominó de Bar — guia do projeto

Uma **casa de jogos** de boteco em 3D no navegador. **Dois jogos jogáveis**, na mesma aba: o
dominó dupla-seis e o **Truco Paulista** — os dois de 2 a 4 jogadores, em qualquer mistura de
gente e bot, na mesma tela ou pela internet. No ar em
**https://ricardocolombo01.github.io/domino-bar/** (repo público `RicardoColombo01/domino-bar`).

Sem framework, sem bundler, e **dois binários** (os ícones PNG do manifest): madeira, pintas,
cartas e sons são gerados em canvas e WebAudio na hora. Three.js e PeerJS vêm de CDN, e o
**service worker os guarda** — depois de uma partida o jogo abre sem internet.

**Não leia número de linhas daqui — rode a conta.** O número envelheceu seis vezes neste
arquivo. E **conte com `node`, não com o PowerShell**: `Measure-Object -Line` não conta linha
em branco (~450 a menos). `node -e "…split('\n').length"` é a que bate com o `wc -l`.

> **Este arquivo foi CONDENSADO em 20/08/2026** (de ~6.100 para ~1.100 linhas, a pedido do
> Ricardo). O texto integral — as narrativas completas das Filas 1–17, os diagnósticos de
> deploy, os inventários por arquivo — está no git: `git show v4.15.0:CLAUDE.md` (ou
> `git log -p -- CLAUDE.md`). Aqui fica o que se USA: comandos, invariantes, armadilhas,
> estado, regras de casa e planos abertos. O resumo do que cada fila ensinou está no fim.

## Comandos

```
npm run build     junta src/ num index.html autossuficiente, e carimba o sw.js
npm run check     avisa se o index.html OU o sw.js estão desatualizados
npm test          build + o acoplamento, as cartas e as três suítes de lógica
npm run acoplamento  a casa alcança ZERO nomes de jogo (varredura por AST, instantânea)
npm run cartas    o baralho de 40 e a carta 3D, no terminal
npm run truco     o truco inteiro, com UMA PARTIDA DO COMEÇO AO FIM pela casa (500+ asserções)
npm run app       build + manifest, ícones e o jogo abrindo COM A REDE DESLIGADA (~30 s)
npm run twa       a FASE 5: confere o que dá sem celular (user page, .well-known/,
                  fingerprint). NÃO reprova enquanto a user page não existir. Ver twa/LEIA.md
npm run icones    regera icone-192.png e icone-512.png a partir de src/icone.svg
npm run telas     build + o jogo em seis tamanhos de tela × treze cenas
                  aceita escolher: node tests/test-telas.mjs 360x640,390x844 nomes,cheia
npm run textura   build + as texturas sobrevivem a sair do jogo e voltar (~40 s)
npm run lembrar   build + o que sobrevive a RECARREGAR a página (preferências, retomar)
npm run shots     build + screenshots no Chrome de verdade (tests/shots/)
npm run online    o online com abas e mesas reais — SETE cenas, duas de truco (`truco` e
                  `trucoduplas`, esta de QUATRO abas sem bot)
                  aceita escolher: node tests/test-online.mjs --so=trucoduplas
npm run fechamento  caça fechamento forçado jogando milhares de mãos (~3 min)
npm run servir    servidor local (o online não fecha conexão em file://)

node tests/mutar.mjs <arq> <de.txt> <para.txt> -- "<comando>"
                  A CONFERÊNCIA POR MUTAÇÃO — quebra a linha que a asserção deveria
                  proteger e confere que ela CAI. Exige que o padrão casou (1 ocorrência),
                  detecta CRLF/LF sozinho, e CLASSIFICA A SAÍDA: sem `✗` no texto a rodada
                  é INCONCLUSIVA, nunca "a asserção pegou".

O test-telas passa de 10 min: rode em DUAS METADES (o rodapé grita "RODADA PARCIAL"):
  node tests/test-telas.mjs 360x640,390x844,640x360
  node tests/test-telas.mjs 844x390,820x1180,1600x900

node tests/test-online.mjs https://ricardocolombo01.github.io/domino-bar/
                  testa o que está PUBLICADO, não o local

Primeira vez, E POR WORKTREE:  cd tests && npm install
  (tests/node_modules não é versionado nem compartilhado; sem o acorn, npm test
   morre na PRIMEIRA suíte.)
```

**Suíte pesada roda sozinha.** `test-telas` renderiza WebGL por software (CPU pura) e o
`test-online` tem prazo de navegação de 45 s — duas ao mesmo tempo viram "erro de rede" que
culpa o broker do PeerJS com a rede ótima.

## Branches

**`main` é a única branch permanente, e é exatamente o que está publicado** (o Pages serve
dela). O trabalho vai numa branch com o nome da versão (`v2`, `v3`…), nasce de `main`, volta
com merge `--no-ff` mais a tag `vX.Y.Z`, e é apagada — **a tag é o que fica**. Correção
urgente vai em `hotfix/*`, mesmo caminho de volta. Registro não é exceção à regra de branch.

**Regras que não mudam:**

- `main` só recebe merge `--no-ff`, sempre com tag — nunca commit direto de trabalho.
- `index.html` e `sw.js` são gerados e commitados, marcados `merge=ours` no `.gitattributes`:
  **todo merge que tocou `src/` termina com `npm run build && git add index.html sw.js`**, e
  `npm run check` reprova bundle desatualizado. O driver exige
  `git config merge.ours.driver true` uma vez por clone.
- **Commitado ≠ enviado ≠ publicado** — ver "Réguas de entrega", abaixo.
- Um assunto por commit, mensagem dizendo o *porquê*. Push só com liberação explícita do
  Ricardo.
- **Worktree**: serve a frentes que NÃO se cruzam; frentes que se cruzam em arquivo é
  fabricar merge. Não autoriza duas suítes pesadas ao mesmo tempo (conflito de CPU, não de
  arquivo). `git worktree remove` no Windows pode deixar a pasta ("Permission denied") —
  `git worktree prune` + `rmdir`, e conferir com `git worktree list`. `git checkout -b` roda
  no diretório em que você está — use `git -C <caminho>`.

---

## Invariantes — não quebrar

**1. `src/js/<pasta>/NN-*.js` são pedaços do MESMO escopo.** Sem `import`/`export` entre si;
`build.mjs` varre `src/js/` recursivamente e concatena **na ordem do NÚMERO, nunca do
caminho**, rodando `node --check` antes de gravar. Existe porque o navegador bloqueia módulos
em `file://` e o jogo tem de abrir por duplo-clique. **Nunca editar `index.html` à mão.**
A pasta organiza quem LÊ; o número manda em quem EXECUTA — `140-menu.js` (casa) valida contra
`NIVEIS` de `050-bot.js` (dominó) no topo do módulo; ordenar por caminho daria
`ReferenceError` e tela preta. Arquivo novo escolhe o número pela **dependência de carga**; o
build reprova número repetido e arquivo sem número. O CSS entra no bundle (`estilo.css` vira
`<style>`), então o `index.html` é autossuficiente de verdade.

**2. Uma cadeira é `voce`, `local`, `bot` ou `online`, e o motor não sabe a diferença.**
Ele diz de quem é a vez e espera; quem responde (mouse, bot ou rede) é outra camada. Não
criar "modo de jogo" — mesa mista sai de graça justamente por isso.

**3. `visaoDe(cadeira)` é a fronteira de segurança.** No online é literalmente o que trafega,
e o anfitrião nunca manda a mão alheia. Toda tela lê a *visão*, nunca a partida. E a
fronteira tem CHAVE: quem decide o *número da cadeira* também precisa de guarda (`clienteId`
+ `donoDaCadeira`). Ao auditar, perguntar as duas coisas — "esta função vaza?" e "quem decide
o argumento dela?".

**4. `030-regras.js`, `060-layout.js`, `510-regras.js` e `540-layout.js` são funções puras.**
É o que permite testar dezenas de milhares de posições no terminal, e de onde a prévia da
jogada sai de graça.

**5. A linha da mesa é guardada já orientada:** `linha[i][1] === linha[i+1][0]`, sempre.
As pontas são o primeiro e o último número; jogar na esquerda é um `unshift`.

### Mapa

A ordem abaixo é a de CONCATENAÇÃO (o número), de dez em dez desde a v3.0.0 — consecutivo
quer dizer LOTADO. **A carga tem TRÊS TEMPOS** (010…165 declara a casa · 300, 590 cada jogo
se registra · 900 arranca), e é isso que faz o terceiro jogo ser barato.

```
src/css/estilo.css               entra no bundle como <style>
src/pagina.html                  o molde, com __ESTILO__ e __JOGO__
src/sw.js                        o molde do service worker, com __VERSAO__
src/icone.svg                    a fonte dos dois PNG do manifest

— 1º tempo: A CASA DECLARA ————————————————————————————————————————————————
10-casa/010-constantes   JOGOS/JOGO/jogavel/estaNaMesa, cores, movimento reduzido,
                         EMBARALHAR, ANGULO DA CADEIRA, CHEGAR PERTO, guardar/lido/esquecer
30-domino/015-constantes peça, MODOS, pontuação, medidas do tabuleiro
30-domino/020-baralho    distribuir (com re-embaralho), quem abre, sobraDoBaralho
30-domino/030-regras     encaixes, pontas, jogadas válidas, tipo de batida     ← puro
30-domino/040-partida    turnos, compra, passe, placar, visaoDe()
40-cartas/045-baralho    naipes, valores, o baralho de 40, distribuir  ← puro, BIBLIOTECA
30-domino/050-bot        níveis = quanta informação o bot recebe
30-domino/060-layout     onde cada peça cai na mesa, com as dobras             ← puro
10-casa/070-cena         renderer, câmera, luz de boteco, mesa, tralhas
30-domino/080-peca3d     geometria + atlas de pintas em canvas + fantasma
40-cartas/085-carta3d    a carta 3D: atlas de 40 células               ← BIBLIOTECA
50-truco/510-regras      força, manilha, quem ganha a vaza, o melou, a aposta   ← puro
50-truco/520-partida     vazas, aposta, mão de 11, ferro, placar, visaoDoTruco
50-truco/530-bot         que carta jogar E quando apostar; nível = informação
50-truco/540-layout      onde cada carta cai; a vira no toco, as vazas de lado  ← puro
50-truco/550-mesa        a mesa do truco em 3D (reconciliação), e limparMesaDoTruco
50-truco/560-interacao   raycast: escolher → ver → confirmar (sem arrasto: são 3 cartas)
30-domino/090-tabuleiro  reconcilia o tabuleiro; prévia; limparMesaDoDomino
30-domino/100-mao        sua mão em leque, mãos dos outros, monte
30-domino/110-interacao  raycast: escolher → ver → confirmar (com arrasto)
10-casa/120-audio        WebAudio puro, sem arquivo
10-casa/130-hud          placar, vez, telas de fim — e os encaixes medidores/barra/painel
30-domino/135-contagem   o que vai DENTRO do painel de contagem
30-domino/137-encaixes   o que a casa PEDE, respondido em dominó
10-casa/140-menu         montagem da mesa (as cadeiras) + modos, alvos e opções, gerados
10-casa/141-abas         QUAL JOGO está na mesa: a faixa, a URL, a preferência, a ponte
10-casa/145-saguao       a tela do online: código, quem chegou
10-casa/146-convite      compartilhar o código; o link `?sala=` pré-preenche
10-casa/150-rede         PeerJS, anfitrião autoritativo — ZERO chamadas ao DOM
10-casa/160-loop         estado do app, turno, hotseat, render loop
10-casa/165-chamado      a vez virando com a aba no fundo: título piscando + som
50-truco/575-encaixes    os mesmos encaixes, respondidos em truco — a aposta é a barra

— 2º tempo: CADA JOGO SE REGISTRA ——————————————————————————————————————————
30-domino/300-registro   o contrato do dominó (motor, mesa, toque, bot, menu, hud, ponte)
50-truco/590-registro    o contrato do truco — o mesmo, sem `painel`

— 3º tempo: ARRANCAR ———————————————————————————————————————————————————————
10-casa/900-arranque     monta as abas, abre o jogo escolhido, enquadra, liga o loop
```

**O REGISTRO É O ÚLTIMO ARQUIVO DO JOGO.** Registro executa na hora em que é concatenado; um
`const` citado antes da declaração é `ReferenceError` (tela preta) que o `node --check` não
pega. Função é içada e sobrevive à ordem; tabela não. (O do truco foi de 500 para 590 por
isso.)

**HÁ TRÊS ESPÉCIES DE PASTA**, e o `test-acoplamento` (AST, não grep) as classifica pela
pergunta *"pendura-se em `JOGOS`?"*:

| | | |
|---|---|---|
| **casa** | `10-casa/` | não alcança nada de fora — nem jogo, nem biblioteca |
| **jogo** | `30-domino/`, `50-truco/` | pendura-se em `JOGOS`; não alcança outro jogo |
| **biblioteca** | `40-cartas/` | ninguém a registra; jogos a usam; **não alcança jogo nenhum** |

A seta da biblioteca tem um sentido só: uma `40-cartas/` que soubesse o que é manilha seria
truco disfarçado de baralho. A varredura cobra identificadores E literais/templates com id de
jogo (`if (JOGO_ID === 'domino')` é acoplamento em texto) — quem sabe o nome do jogo é o jogo
(`JOGO.herdaOGuardadoSemSufixo`).

**As CINCO perguntas da fronteira casa/jogo** (cada uma achou defeito real que as anteriores
não viam): que **nomes** a casa alcança? (o AST responde) · que **textos**? (HTML e CSS ficam
fora do AST — doze linhas de regra sobreviveram no `pagina.html` com a suíte dizendo zero) ·
que **forma**? ("Pontas · Monte · Mão", `vista.pontas`, `{peca, ponta}` — acesso a
propriedade não é identificador livre) · que **formato** de elemento/texto? (o `title` de um
botão da casa prometia frase de dominó) · e **abra os VALIDADORES** — um validador descreve o
formato do dado por definição, e foi em `vistaDoFio` que `v.linha` prendeu todo convidado de
truco no saguão por três releases.

### Armadilhas já pagas (não repetir)

**Navegador / 3D / CSS:**

- **`requestAnimationFrame` para em aba de fundo.** Temporizador de jogo vai em `setTimeout`.
- **O `fov` do Three é vertical.** O horizontal sai de `2·atan(tan(fovY/2)·aspect)`.
- **Textura de canvas é EMPRESTADA.** Sair do app pode levar o contexto WebGL E o bitmap do
  canvas (independentes; só juntos dão peça preta). Toda receita de `pintar()` fica guardada
  para repintar, começa com `fillRect` OPACO, captura a ASSINATURA do pixel (0,0) — há
  aparelho que descarta para preto OPACO (alfa 255), e sonda que só pergunta alfa não o vê —
  e **não pode consumir `Math.random` global** (as suítes semeiam esse gerador; gerador
  próprio semeado, como o veio da madeira).
- **`restoreContext()` chamado de dentro do despacho do `webglcontextlost` é IGNORADO** pelo
  Chrome. Toda espera de evento em teste precisa de PRAZO.
- **O Chrome rasteriza canvas novo e canvas já usado como textura de formas diferentes**
  (~0,6% mesmo sem sorteio). Determinismo se mede repintura contra repintura.
- **`opacity` não escurece, MISTURA com o fundo.** Piso do projeto: `--fraco: .58` (medido;
  `.52` é o mínimo AA). Abaixo do piso exige motivo escrito ao lado.
- **Região `aria-live` reescrita a cada quadro vira ruído** — só escrever quando muda. E
  `opacity: 0` mantém o elemento na árvore de acessibilidade; `display: none` mata o anúncio.
- **Contêiner com `overflow` MENTE sobre o que está dentro.** Transbordo dentro de
  `position: fixed` nunca chega ao `documentElement.scrollWidth`.
- **Flex CENTRADO que rola tem o topo inalcançável** (`align-items: center` transborda para
  os dois lados; a área rolável só se estende para o FIM). Quem resolve é `margin: auto` no
  filho. E `overflow: hidden` continua rolável POR SCRIPT — teste de `scrollTop` aprova tela
  que o dedo não move.
- **Zerar `transform` é obrigatório ao reposicionar** elemento centrado por
  `translate(-50%)` — senão ele nasce meia largura fora da tela. Vale também para
  `prefers-reduced-motion` (o transform de posição fica FORA da anulação; transições viram
  `0.01ms`, não `none`).
- **`var(--que-nao-existe)` invalida a declaração inteira** e a propriedade cai na herança —
  defeito escondido atrás de acidente. Conferir com grep as vars usadas × declaradas.
- **Tela `display: flex` em linha não aceita irmão novo sem mudar de layout** — envolva os
  dois num item só e mude o dono da margem automática.
- **`display: contents` é o que faz invólucro gerado custar zero em layout** (medidores e
  barra gerados pelo jogo).
- **Duas caixas que cabem sozinhas e não perguntam uma pela outra vão se encavalar** — pago
  em CSS (o `#topo` × `#jogadores`) e em 3D (tabuleiro × assentos). Quando o mesmo espaço tem
  dois donos, a conta tem de ser UMA. E o que cabe na MESA não é o que cabe na TELA — quem
  manda é `larguraVisivelEm()` (`070-cena.js`), medido na profundidade do próprio objeto.
- **Sete pixels de folga não são conserto, são sorte** — o limiar de folga 3D é 0,15, e a
  folga vai para o log mesmo verde.
- **`pointerup` é evento que o navegador PROMETE e não garante** (dedo pela beirada, troca de
  app). Para todo `if (x) return`: quem zera o `x`, e o que acontece se esse alguém não vier?
  As portas: captura de ponteiro como fonte de verdade + `visibilitychange`/`blur`
  (`desistirDoGesto`). `lostpointercapture` foi recusado (ordem não confiável).
- **Limiar de arrasto por tipo de ponteiro** (`{mouse: 9, dedo: 18}`) **e julgar pelo
  RESULTADO** (`foiMesmoArrasto`: gesto que não reordenou nada é toque).
- **Ouvinte global de jogo continua vivo com o OUTRO jogo na mesa.** Todo ouvinte de jogo
  começa com `if (!estaNaMesa(JOGOS.x)) return;`.
- **Grupo arrancado do pai continua respondendo `children.length > 0`.** `grupoPrevia` é
  FILHO de `grupoMesa` nos dois jogos: `limparMesa*` remove só o que a reconciliação pôs
  (nunca `clear()` no grupo da mesa), e a asserção é "fica SÓ a prévia pendurada".
- **Toda função de "tirar as coisas do tampo" lista a MÃO junto com a mesa**
  (`esconderMao*`) — `sairDaPartida` não esconde nada por desenho.
- **Mesa ESPELHADA passa em toda asserção de simetria.** Amarre a carta/peça ao ASSENTO
  (convenção da casa), não a ela mesma.
- **A mesma marca não serve a dois lugares** — o anel de "ganhando" cabia na mesa (0.97 de
  espaçamento) e invadia 77% na mão (0.707). Refazer a conta do espaço; marcas diferentes em
  FORMA se distinguem melhor que só em cor.
- **Chave FIXA num mapa de reconciliação mente sobre o que guarda** (a vira com chave
  `'vira'` mostrava a da primeira mão para sempre). Ao reconciliar por chave: *esta chave
  DETERMINA o conteúdo, ou só o nomeia?*
- **Sobreposição se mede com CAIXAS**; distância entre centros só responde sobre círculos.
- **"Está desenhado" ≠ "está desenhado CERTO"** — asserção de desenho que só pergunta "tem
  tinta" aprova qualquer borrão; a que vale escolhe um ponto onde a tinta TEM de estar. E
  célula de atlas com proporção errada não aparece em amostra de cor (a carta saiu 42%
  esticada em todas as 40 células por um ano).

**Dados / motor / rede:**

- **`Set` não sobrevive a JSON** (`{}` sem `.has`). `P.faltaNo` é array de `Set`; quem guarda
  converte nos dois sentidos. Vale para qualquer coisa nova em `P`.
- **Preferência guardada e TUDO que chega pelo fio é ENTRADA DE FORA.** `Object.hasOwn`
  (chave de protótipo já deu tela preta permanente), validar campo a campo contra as regras
  de hoje, e teto de tamanho/frequência em toda mensagem (o `{t:'nome'}` de 4 MB congelava a
  mesa; `log`/`chat` sem teto idem).
- **`|| []` protege contra AUSENTE, não contra presente-com-outro-tipo** (`('xx' || [])` é
  `'xx'`). Validador cobra o continente E o elemento — sem reabrir frouxidão deliberada
  (`[].every()` é `true`, a mão de 11 continua passando).
- **Validação frouxa pode ser DE PROPÓSITO**: a forma da vista muda com a fase (mão de 11 sem
  vira). Guarda cujo erro é silencioso paga rigor com defeito — pergunte o que ela protege.
- **Migração de chave guardada MIGRA E APAGA** — ler a antiga "quando a nova falta"
  ressuscita a partida que acabou de acabar. E a migração pode CEGAR a asserção (comportamento
  idêntico com um jogo só): nesses casos medir a CHAVE é o certo, com o motivo ao lado.
- **A ordem da mão na tela não pode virar ordem no motor** — `visaoDe` devolve a MESMA
  referência de `P.maos`; a arrumação mora no cliente (`ordemDaMao`). Há teste que congela
  `vista.mao`.
- **Cache com duas dependências olha para as DUAS, e não para a ordem** — a assinatura da mão
  é de CONJUNTO (chaves ordenadas) + largura da tela. Sensível à ordem entraria em laço com a
  arrumação; sem a largura, o resize não refazia o leque (e invalidar à força apagava a peça
  levantada).
- **Aritmética de baralho fora do motor apodrece** (`28 - 7 * MESA.n` foi a primeira linha a
  quebrar). Tamanho de baralho sai de `baralhoDoModo()`/`sobraDoBaralho()`.
- **Bug de regra que atravessa DUAS mãos não existe para caso escrito à mão** (`donoDaAposta`
  não zerado no embaralho; o `'aumentar'` que o motor não conhecia = mesa parada). Quem acha
  é a partida INTEIRA jogada pela casa — flags de mão zeram nos DOIS ramos do embaralho.
- **Duas bocas falam com o motor com vocabulários diferentes** (a barra manda `'trucar'`, o
  bot manda `'aumentar'`). Ao criar ação nova, pergunte QUEM a manda, no plural.
- **Guarda que só é repintada quando o estado não pode acontecer é código morto.** O lugar de
  repintar é onde a tela APARECE (`mostrarTela`), não onde ela muda.
- **Quem GERA os botões liga os cliques deles** — chamada solta no topo do módulo encontra a
  faixa vazia quando os botões passam a ser gerados.
- **Utilitário genérico morando na pasta de um jogo só é descoberto quando aparece o
  segundo** (`embaralhar`, `anguloDaCadeira`, `chegarPerto` — os três foram para a casa). A
  pergunta: *fala de PEÇA e PONTA, ou de ARRAY/número?* Contrato menor é fronteira melhor.
- **Nome de topo repetido só é silencioso em `function` e `var`** — o `build.mjs` reprova o
  repetido dizendo o nome e os dois donos. `naMao` já é dois nomes; o tamanho da mão chama-se
  `pecasPorMao`.
- **`typeof x` sobre `let` na zona morta LANÇA.** Quem resolve é a ordem de quem chama.
- **`String.replace` troca só a PRIMEIRA ocorrência** — o token `__VERSAO__` citado num
  comentário comeu o de verdade. Contar antes de trocar.
- **Resposta OPACA não entra em cache do service worker** — `<script src>` sem `crossorigin`
  faria o jogo abrir offline SEM o PeerJS.
- **O que muda de conteúdo sem mudar de nome não pode ser servido do cache com rede** — a
  página é rede-primeiro; o que tem versão na URL é cache-primeiro. O nome do cache é um
  RESUMO do conteúdo (bumpar versão deixou de ser categoria de erro).
- **`CacheStorage` é escopado por ORIGEM, não pelo scope do worker** — o `activate` filtra
  por prefixo (`dominobar-`), senão apaga o cache dos vizinhos da user page.
- **Escape: todo texto de fora passa pelo `escapar` UMA vez** — nem zero (quatro mordidas do
  `innerHTML`, a pior dentro de ATRIBUTO, onde quem abre é a aspa) nem duas (`nomeDoTime` já
  devolve HTML; reescapar mostra `&amp;amp;`, e mandá-lo a `textContent` mostra a entidade
  crua). Campos "que são números" também escapam — o fio pode mandar qualquer coisa.
- **Índice cravado numa lista que o jogo DECLARA muda de assunto sem avisar** — encaixe se lê
  pelo RÓTULO (`meds.find(m => m.rot === …)`), nunca pela posição.
- **A pergunta do IRMÃO cobrou seis filas seguidas:** guarda aplicada num lugar e esquecida
  no vizinho é o formato deste código (dois jogos, dois lados do fio, dois validadores, duas
  telas de fim). **Ao mexer em qualquer guarda, liste os irmãos dela ANTES de fechar.**

**Teste / harness / método:**

- **Medir antes de consertar.** Este projeto perdeu ~13 diagnósticos de leitura para a
  medição. Hipótese de leitura registrada COMO hipótese; suspeita não confirmada COMO
  suspeita.
- **Asserção nova sobre comportamento já CERTO não pode nascer vermelha — a prova é
  MUTAÇÃO.** Asserção vermelha antes do conserto é a prova forte.
- **Asserção vermelha nem sempre acusa o código** — pode ser o teste olhando na hora errada,
  pelo caminho errado, ou com a RÉGUA incompleta (o retrato de "a mesa andou" sem a aposta).
- **O DUBLÊ DO HARNESS FICOU PARA TRÁS 14 VEZES.** Ao acrescentar QUALQUER API de navegador,
  o primeiro lugar a olhar é `tests/harness.mjs` — e o dublê do próprio teste conta junto. As
  espécies: método ausente · valor fixo que esconde o ramo interessante (`matchMedia`) ·
  registro de ouvinte ENGOLIDO (`on() {return this}` deixou o `conn.on('data')` inteiro sem
  teste) · campo que nunca existiu (`tagName`) · dublê que não RASTREIA (o raycast — ver
  Lacunas) · **dublê e guarda dividindo a MESMA suposição errada** (o descarte simulado como
  a guarda o esperava, não como ele É). A tentação é sempre guardar no JOGO
  (`if (el.setAttribute)`) — isso troca defeito por ramo que o teste nunca alcança. O
  conserto de dublê de eventos: ele GRAVA e o teste DISPARA.
- **AS SEIS FORMAS DE A CONFERÊNCIA POR MUTAÇÃO MENTIR** (o `tests/mutar.mjs` guarda contra
  todas): 1· mutação que não casa (CRLF×LF — este repo tem os DOIS; exigir o casamento) ·
  2· asserção que LANÇA trunca a suíte e sub-relata (`(x || {}).campo`, sempre) · 3· comando
  que falha por outra razão sai não-zero e parece "pegou" (sem `✗` no texto = INCONCLUSIVO) ·
  4· comando sem `node build.mjs` roda contra o bundle velho ("SOBREVIVEU" mentiroso) ·
  5· o build dentro do comando deixa bundle SUJO no fim (`npm run check` prova; o `sw.js`
  tem de recuperar o MESMO resumo) · 6· mutador morto de fora deixa a mutação NA FONTE —
  **toda rodada com prazo apertado termina com `git status`**.
- **Quando o conserto tem DUAS camadas, mutar UMA sai verde — é o desenho** (a irmã segura).
  A prova honesta é mutar o PAR, e isso fica escrito ao lado da asserção. Duas guardas que se
  cobrem precisam de asserções DIFERENTES, separadas pelo efeito colateral (o som que a de
  cima já tocou).
- **Testar as peças não é testar a MONTAGEM** — a mutação do C2 sobreviveu porque as
  asserções mediam as funções, e o defeito era QUAL delas a linha chama.
- **Montagem de cena tem de COBRAR que conseguiu** antes de medir (jogada válida, escolha que
  PEGOU) — senão helper que desiste calado dá cena verde que nunca aconteceu (o índice onde a
  ponte esperava PEÇA, e o inverso). Cena montada por LANCE CONTADO é intermitente; o que
  vale é a CONDIÇÃO (`while … && P.maos[0].length > 1`).
- **Asserção sobre operação idempotente não pode falhar** — parta do estado que a ação
  mudaria. **"Parou" não se mede num instante só** (o tique alterna; três drenagens). Medir
  "parou de se mexer" logo depois de mandar parar mede a própria parada.
- **Asserção comparada contra dublê VAZIO é verde por trivialidade** (`textContent` é `''` no
  harness). Valor que só existe no HTML: escreva à mão com o motivo ao lado. Toda asserção
  sobre COLEÇÃO exige primeiro que ela não esteja vazia.
- **Asserção de TEMPO num harness com dublê mede o dublê** — meça a AMPLIFICAÇÃO
  (determinística), não milissegundos.
- **Sonda mede a si mesma primeiro** — a linha "vista boa passa? false" é o alarme. Sonda que
  mede pela PONTE depois de trocar de jogo mede o jogo NOVO (a ponte é o que a troca
  reaponta): leia pelos REGISTROS (`JOGOS.x.ponte.…`). `undefined` mascarado por
  `if (j.naMesa && …)` virou "não vazou" — foi assim que a mesa órfã passou por "medido".
- **Sonda que mede antes de a tela ASSENTAR varia por rodada** — o `test-telas` espera oito
  quadros iguais; antes de sonda nova, pergunte se a suíte já sabe perguntar aquilo.
- **`localStorage` NÃO existe no harness de Node** — lógica no Node, sessão no Chrome. E no
  `file://` ele é compartilhado entre as abas: cada cena diz o que quer (`semGuardado()`) e
  devolve como encontrou (vale para `MESA` e `P` também).
- **`performance.now()` no harness AVANÇA o relógio falso a cada chamada** — teste que
  precisa de mesa parada monta a mesa, não confia no sorteio. Sorteio consumido a mais desloca
  o embaralho semeado de todo vizinho (foi assim que o falso positivo do `[0,0]` explodiu:
  carta `[0,0]` = placar `0×0`; o conserto foi armar as mãos com cartas que nenhum outro
  campo produz, não branquear a asserção).
- **`catch` que guarda só a `message` esconde ONDE**; `TypeError`/`ReferenceError` reprovam
  com stack (rede não produz nenhum dos dois). `exit(0)` de aviso de rede não pode engolir
  `✗` anterior.
- **Uma reprovação sozinha não decide a culpa; o CONTROLE é rodar a mesma cena na `main`.**
  Quando a conferência acusa TUDO (ou nada), o quebrado é o instrumento.
- **`throw` dentro de callback de `requestAnimationFrame` não rejeita a Promise** — vira
  travamento silencioso. `diff` de dois arquivos vazios passa — exigir que haja o que
  comparar.
- **O que sai de `pagina.evaluate()` tem de ser DADO PURO** (`dataset` atravessa como `{}`).
- **Crase em comentário dentro de template literal é CÓDIGO** (`AJUDA`/`MEDIR` do
  test-telas): escapar com `\``.
- **`navigator` não é atribuível no Node moderno** — só
  `Object.defineProperty(globalThis, 'navigator', {value, configurable: true})`.
- **Contexto isolado do Puppeteer derruba o cache HTTP** — para separar só o armazenamento,
  `evaluateOnNewDocument` custa zero.
- **Dependência nova de teste quebra TODO worktree existente** — a suíte diz o comando
  (import dinâmico com catch), não só este arquivo.
- **PONTO CEGO DECLARADO É ONDE O DEFEITO MORA** — cobrou DUAS vezes no mesmo lugar
  (`folgaEntre` "só compara ENTRE grupos": a vira coplanar, e depois as cartas da vaza).
  Comentário que declara lacuna de medição é lista de lugares para olhar à mão. E razão
  escrita, plausível e não medida é a espécie de afirmação que este projeto mais paga.
- **Fatiar hunk para a FRENTE desloca os seguintes em silêncio** — parta do estado final e
  DESFAÇA (`git apply -R`); a conferência é grep pelos nomes que não podem ter sobrado.
- **Heredoc com acento chega corrompido** (latin-1) — texto acentuado vai por ferramenta de
  edição direta ou arquivo em disco.
- **Buscar peça por texto no JSON dá falso positivo** (`[0,0]` também é placar).
- **`>/dev/null` é sintaxe Unix e o `execSync` no Windows usa `cmd.exe`** — ver forma 3 da
  mutação.
- O harness precisa passar o timestamp no `requestAnimationFrame` e enfileirar `setTimeout`
  de verdade, senão o teste passa sem ter rodado nada.

---

# FILA DE TRABALHO

**Toda ideia e toda implementação combinada entram AQUI** — não em memória de sessão, que não
viaja com o repositório. As filas enchem por duas fontes: **campo** (jogar — a mais barata; deu
as Filas 5, 7, 10, 16, 17) e **varredura** (deu as 6, 11, 12, 13).

## ESTADO EM UMA OLHADA (20/08/2026)

| | |
|---|---|
| commitado | **v4.15.0** — Fila 17: sonda de textura por ASSINATURA, canto da carta maior, leque tombado. Antes: v4.14.4 (Onda D), v4.14.3 (Fila 16, mesa órfã), v4.14.0 (Onda F) |
| enviado | ✔ `git ls-remote` responde `49a0f83`, igual ao local |
| PUBLICADO | ✔ `sw.js` servido `149d533767a9`, igual ao local, conferido duas vezes. A régua é o conteúdo servido |
| em curso | **nada aberto no jogo** |
| Filas 1–17 | todas fechadas · da Fila 15 sobram as Ondas **C** e **E** |
| o que vem | **JOGAR** (abaixo), depois Ondas **E** e **C**, depois o **PIFE**. Fase 5 ⏸ em espera |

## O que vem, em ordem

### 1º · JOGAR — as perguntas que só o olho no celular responde

Nunca tocado por mão humana: a **mão de ferro** de verdade (o leque de versos lê como "não é
a sua mão" ou como defeito?) · o botão **Esconder** no dedo, na barra do celular deitado · a
**troca de jogo** (consertada na v4.14.3, publicada em 19/08, nunca retestada em campo) · as
**cartas legíveis** da v4.15 · o convite, o chamado da vez, a mesa de 4 com gente de verdade ·
a marca de "ganhando a vaza" e a carta virando de barriga para baixo · a barra de apostas no
dedo · a mão de 11 na tela.

**Como relatar barato:** 1· QUAL VERSÃO (site ou local — rode o `curl` das Réguas; foto tem
data, use-a) · 2· qual jogo, quantas cadeiras, bot de que nível · 3· foto vale mais que
descrição · 4· se a mesa PAROU: de quem era a vez, o que dizia o alto, se havia botão · 5·
não precisa diagnosticar — a leitura erra muito aqui.

### 2º · ONDA E — TEMAS DE BARALHO (ideia do Ricardo, 11/08) · ~um dia

A infraestrutura já existe: `pintar()` guarda a receita para repintar (Fila 7) — **trocar de
tema é chamar `repintar` com outras cores**. Mora em `40-cartas/` (biblioteca: vale para
truco, pife e 21 de uma vez). Um tema define: cor do papel, quatro cores de naipe, verso,
talvez a fonte do valor — tabela por tema, do feitio de `MODOS`.

Os cinco propostos: **Clássico** (o de hoje, padrão) · **Quatro cores** (no truco a ordem das
manilhas é POR NAIPE — a cor passa a mostrar o que decide a mão) · **Alto contraste**
(acessibilidade) · **Boteco** (papel gasto) · **Noturno**.

As quatro armadilhas, todas já pagas: 1· receita não consome `Math.random` global (gerador
próprio semeado) · 2· repintura dá a MESMA carta com o mesmo tema (o `test-textura` compara)
· 3· preferência guardada é entrada de fora (`Object.hasOwn(TEMAS, …)`) · 4· a asserção do
atlas amostra COR — com tema trocável, ou força o Clássico ou lê a cor do tema; **decidir ao
escrever**. O mesmo inventário serve depois para a peça de dominó — mas entregar o baralho
primeiro.

### 3º · ONDA C — quem chega pela primeira vez · ~um dia

**C1 · Estatísticas locais** (casa) — partidas/vitórias/derrotas por jogo; o dado já passa
por `publicar()`. Armadilha: estado novo no `localStorage` contamina as suítes de navegador —
cada cena diz o que quer. **C2 · Primeira mão guiada** (casa + jogo) — reaproveita a dica
inteira. **C3 · Desfazer no HOTSEAT** (os dois) — `P` é dado puro, é uma cópia. **Só em mesa
local**: online ou contra bot seria trapaça.

### 4º · O PIFE (decisão do Ricardo, 11/08)

Herda pronto: o online P2P inteiro, hotseat, som, boteco, telas, partida guardada, o baralho
de 40 e a carta 3D (`40-cartas/`), os cinco encaixes de HUD (que o truco teve de inventar), e
`CHAVES_DO_JOGO` (`mesa.<id>`/`partida.<id>` sem linha nova). O custo medido do segundo jogo
foi 7 arquivos / ~1.800 linhas.

**O 21 NÃO é o próximo, apesar de parecer o mais simples:** ele tem BANCA, e banca fura o
invariante 2 (joga por regra fixa, não por escolha) — é o único que mexe no modelo de
cadeira. **A sinuca é outro PROJETO**: física + tempo real; o modelo anfitrião-autoritativo
por mensagem não serve ali.

### O que NÃO recomendo (registrado para não redescobrir)

- Fazer o 3D desviar dos painéis (o mais caro; a gaveta e as faixas resolveram o real).
- Envido/flor no truco (decidido: sem os dois). Tema/cor da MESA (o boteco é a identidade).
- Dívidas investigadas que NÃO são defeito: clone de material sem `dispose()` (mesma
  `cacheKey`, vira lixo coletável); `alvos` aliasado do `060-layout` (código morto — remover
  é melhor); o array `VAZIO` compartilhado do `050-bot` (só é lido; um `add` envenenaria).
- No `test-telas`: antes de mexer no custo, INSTRUMENTAR (`quadros` é contado e jogado fora).
  O piso é `parados >= 8`, teto 240; mínimo defensável para `parados` é 2. Não voltar ao
  prazo fixo, e não trocar `newPage()` por `createBrowserContext` (mata o cache HTTP).

## Réguas de entrega — commitado ≠ enviado ≠ publicado

**São TRÊS réguas para três perguntas** (cada confusão aqui já custou um dia):

```
git rev-parse main                                # 1· o log LOCAL
git ls-remote origin refs/heads/main              # 2· ENVIADO? pergunte ao SERVIDOR
       # (git rev-list …origin/main compara com um ref em CACHE e já respondeu
       #  "0 0" com duas releases paradas na máquina — não serve para isto)
curl -s https://ricardocolombo01.github.io/domino-bar/sw.js | grep VERSAO   # 3· PUBLICADO?
grep VERSAO sw.js                                 #    compare com o local
```

- **A régua de PUBLICADO é o conteúdo SERVIDO.** A fila do Pages já travou por um dia; fila
  travada ENGOLE o push seguinte (não enfileira dois). Uma consulta só não decide — o Pages
  já devolveu o `sw.js` velho na primeira. Release que não toca no que o Pages serve não gera
  rodada, e isso não é "faltando".
- Ao FIM de qualquer sessão, dizer por escrito onde o trabalho está nos três degraus.
- Release que muda `src/` TEM de mudar o `sw.js` servido — se não mudou, ou o Pages não rodou
  ou o merge saiu sem `npm run build`.
- `gh` está instalado, autenticado na conta `Ricardo-Colombo-pixaflow` (push: true desde a
  colaboração; admin: false). Serve para auditar o Pages pela API pública.

**Como retomar em cinco minutos:**

```
git ls-remote origin refs/heads/main && git rev-parse main   # enviado?
git worktree list      # deve haver SÓ a main
npm run check          # o bundle está em dia com src/?
npm test               # acoplamento + cartas + truco + as suítes de lógica, segundos
curl -s https://ricardocolombo01.github.io/domino-bar/sw.js | grep VERSAO  # publicado?
```

E abra o jogo nas duas abas (`npm run servir`) — suítes verdes não substituem trinta segundos
olhando. `npm test` tem de passar inteiro: a fila está vazia, qualquer reprovação é regressão.

**Onde testar sem depender de deploy:** duplo-clique no `index.html` (tudo menos o online) ·
`npm run servir` + IP da máquina no celular (tudo, inclusive mesa online celular×PC). O
celular é o aparelho que mais achou defeito na história do projeto.

## Mapa: sintoma → onde mora

| se acontecer isto | olhar primeiro |
|---|---|
| a aba do Truco não aparece / versão velha | **é o deploy** — compare os dois `VERSAO` |
| não vejo quem está ganhando a vaza | `vista.ganhandoAVaza` (520) → marca em `550-mesa` e frase em `notaDaVezNoTruco` (575). TRÊS superfícies: anel na carta, nota no `#vez`, placar `Vazas` — diga qual falhou |
| ninguém anuncia quem ganhou a vaza | `fecharVaza` devolve `r.vaza`; `narrarVaza` (575) escreve na CONVERSA |
| o placar `Vazas` mente | `placarDeVazas` (575) — é do SEU ponto de vista; vaza melada não conta |
| moldura da manilha ausente/na carta errada | `ehManilha` (510) → `sincronizarMaoDoTruco` (550). DOIS canais: moldura âmbar e ALTURA |
| a vira na mesa ≠ a vira do painel | guarda de `mesmaCarta` em `sincronizarMesaDoTruco` (consertado na v4.12; se voltar, é ali) |
| baralho sem vira em cima / toco sobrando | `tocoDoBaralho` entra e sai COM a vira; na mão de 11 os dois somem |
| "Peso" errado no topo do dominó | `medidoresDoDomino` (137) usa `somaMao`; mão escondida mostra `—` de propósito |
| barra de confirmar cobre a mão | retrato: `--alt-confirmar` (130-hud); paisagem: coluna direita |
| botão errado / que não faz nada | `desenharBarra` (130-hud) — religa `onclick` a cada publicação de propósito |
| carta/peça não responde ao toque | `estaNaMesa(JOGOS.x)` nos ouvintes (560/110) — um jogo "roubando" o toque do outro |
| mesa do truco cortada/escalada errada | `ESCALA_TRUCO_MAX` e `MESA_TRUCO_Z` (550) |
| carta ilegível / naipe borrado | o atlas em `085-carta3d` (o naipe é CAMINHO, não glifo) |
| **a mesa PARA (sem mensagem e sem botão)** | **o defeito que mais dói.** Anote fase, vez e placar — `aplicarNoTruco` recusa em silêncio para quem não está na tela |
| "continuar a partida" não aparece | `partidaGuardada` (casa) + `partida*Valida` (jogo) |
| sobras de um jogo na mesa do outro | `JOGO.mesa.limpar` chamado em `abrirJogo` no jogo que SAI (Fila 16) |
| peça/carta preta ao voltar de outro app | a sonda de assinatura em `070-cena` + as receitas de `pintar()` (Filas 7 e 17) |
| peça/carta por baixo de painel no celular | família das Filas 7 e 10 — o `test-telas` mede isso no dominó |

## Lacunas e suspeitas conhecidas (registradas, não urgentes)

- **O raycast do Three não acha nada no harness de Node** (12ª do dublê): nenhuma asserção de
  Node jamais mirou peça/carta com o ponteiro — tudo entra pelo teclado ou por
  `selecionarPeca` direto. Consertar é trabalho de uma onda própria.
- **`document.activeElement` não existe no dublê** — o conserto do "Enter joga a carta
  antiga" não tem asserção em Node.
- **Nenhum teste dispara `resize`/`orientationchange`** — o caminho "girou o celular" nunca
  roda em suíte.
- **`FOV_BASE`/`FOV_TETO` não têm guarda** — o fov só é impresso no log do telas.
- Jogos não usam `Object.hasOwn` (os 16 usos são da casa) — cosmético, exige anfitrião
  hostil (`NOME_DA_APOSTA[a.trucar]`).
- `class="pecaEscolhida"`/`pecas` é vocabulário de dominó no HTML/CSS da casa (4º degrau da
  fronteira). `donoDaCadeira` restaurado não valida faixa (leitores limitados por `MESA.n`).
- O defeito 4 da Fila 6 (CDN caído) confere-se à mão: bloquear `cdn.jsdelivr.net` no DevTools.
- `#semCarga` fica fora da lista do `mostrarTela` de propósito.

## A FASE 5 — o aplicativo ⏸ EM ESPERA (decisão do Ricardo, 11/08/2026)

**Pausa, não dívida.** Palavras dele: *"no momento esqueça essa parte; quando eu acabar o
outro projeto do gutenberg, irei trocar a conta do GH para que você possa fazer"*. Quando a
credencial desta máquina trocar, a fase volta a ser MINHA. **Ao retomar: `npm run twa`** — ele
diz em que degrau a fase está.

**Os DOIS bloqueios, medidos:** 1· a **user page** `ricardocolombo01.github.io` exige ser
dono da conta `RicardoColombo01` (as credenciais daqui são `Ricardo-Colombo-pixaflow`) · 2· o
**Bubblewrap é interativo** em todo caminho que gera projeto (`doctor`/`init`/`update`/
`build`) — sem terminal morre em `ERR_USE_AFTER_CLOSE`, e canalizar respostas não resolve.

**O que já está montado** (não refazer): o CLI, o JDK 17, o Android SDK (plataforma 34,
build-tools, licenças aceitas), o `config.json`, o `twa-manifest.json` versionado,
`twa/user-page/` pronto para copiar (`.nojekyll` + `.well-known/assetlinks.json` com
`__SHA256__`), e o `npm run twa`. Falta UM comando num terminal de verdade:
`cd twa && bubblewrap build`.

- **A KEYSTORE NÃO FOI GERADA de propósito** — é a identidade permanente do app; senha e
  backup são dele. O comando está no `twa/LEIA.md` (keytool do JDK 17 em
  `C:\Program Files\Java\jdk-17\bin`).
- **Armadilhas de SDK já pagas:** o validador do Bubblewrap recusa SDK sem `tools/` ou `bin/`
  na raiz (layout moderno usa `cmdline-tools/`); e copiar só o `bin` sem o `lib` irmão dá
  `ClassNotFoundException`. O par `bin` + `lib` tem de estar na raiz — é como a pasta está.
- **O GitHub Pages não serve pasta que começa com ponto** — o `.nojekyll` vazio na raiz da
  user page não é opcional; o sintoma é 404 que parece erro de caminho.
- **A última milha não é automatizável:** instalar o `.apk` e ver que NÃO há barra de URL — o
  Android decide em runtime buscando o assetlinks. Se a Amazon reassinar o pacote, o
  `assetlinks.json` leva as DUAS impressões.
- **Distribuição decidida (05/08):** APK no GitHub Releases + Amazon Appstore (grátis).
  **SEM Play Store** (US$ 25 + 12 testadores reais por 14 dias). O `.aab` sai do mesmo
  Bubblewrap — nada é jogado fora se ele mudar de ideia. Serviços que "vendem testadores"
  arriscam banimento.
- **TWA e não WebView empacotado:** o TWA mantém a origem `https://` — `localStorage`,
  `clienteId` e os códigos de sala são os MESMOS no site e no app. Capacitor trocaria a
  origem e com ela a identidade. Em tablet Fire (Silk) pode cair para aba comum.
- **Risco permanente do online:** broker público do PeerJS, STUN sem TURN — NAT simétrico
  falha sem plano B, e os códigos de 4 letras vivem num namespace global compartilhado.

## PWA — as regras que ficam

A página é **rede-primeiro** (é o único arquivo que muda de conteúdo sem mudar de nome);
three e peerjs têm versão na URL e são **cache-primeiro**. O nome do cache é um RESUMO do
`index.html` + `src/sw.js`, carimbado pelo build — publicar correção JÁ é publicar cache
novo. As bibliotecas não são baixadas na instalação (o `fetch` as guarda quando a página as
pede; quem enche o cache é a SEGUNDA carga). O registro do SW fica atrás de
`location.protocol.indexOf('http') === 0` — em `file://` o `register` rejeita. `npm run app`
desliga a rede e recarrega: se o jogo não ficar pronto, reprova. Os dois PNG do manifest são
os únicos binários versionados; a fonte é `src/icone.svg` + `npm run icones`.

---

## Regras da casa

### Dominó (implementadas)

Três modos (`MODOS`, `015-constantes.js`): **Clássico** (7 na mão, 2–4 jogadores, 28 peças),
**Duelo** (14 na mão, 1v1), **Trio** (9 na mão, 3 jogadores, 27 peças — o `0|0` sai). Duelo e
Trio esgotam o baralho; com monte só o Clássico de 2 ou 3, onde quem não pode jogar compra
até conseguir. Compra voluntária opcional (só onde há monte — `sobraDoBaralho(modo, n)`;
"modo com monte" não existe: o Clássico de 4 esgota igual).

**Clássico de 4:** duplas em cruz (1&3 × 2&4). Primeira mão abre com o 6|6 (ou a maior
carroça se ele está no monte); as seguintes, quem bateu. **Batida: simples 1, carroça 2,
lá-e-lô 2, cruzada 4.** Trancou: 1 ponto para a mão mais leve; empatou, a mão morre. Partida
até 6 ou 10.

- **Lá-e-lô só existe com as pontas DIFERENTES** (decisão do Ricardo, 30/07): pontas `3`|`3`
  e batida com `3|1` é batida simples — pontas iguais não são "dois lados". A regra é sobre
  os NÚMEROS das pontas, não sobre a contagem de encaixes.
- **A cruzada continua valendo 4** mesmo "encostando de um lado só" — ela EXIGE pontas
  iguais (a carroça do número casando com as duas). A regra da casa não é simétrica de
  propósito. Um `e !== d` comum no `nasDuas` mataria a cruzada junto.
- `maoRuim(mao, modo)` reprova mão com carroças demais e redistribui (até `MAX_EMBARALHOS`).

**Não dá para trancar de propósito** (`fechamentosArmados`, filtrado em `acoesDe`). Cinco
condições para barrar: 1· sem monte QUE SALVE — o `morto[n]` responde a pergunta forte: ponta
morta com monte de pé é ponta que o monte não resolve (a guarda `!temMonte` foi a janela cega
de três releases) · 2· não é a sua última peça (jogar a última é bater) · 3· a peça não é
carroça · 4· sobra outra jogada que também não feche · 5· você também não responde às pontas
que deixou. A conta usa SÓ a mesa e a sua própria mão (olhar a mão alheia vazaria informação
pela jogada que some da tela). A chave interna é canônica (`Math.min|max`) porque a linha
guarda peças já orientadas. Guarda em dois níveis: o par `monteInutil`/`monteSalvador` no
`npm test`, e `npm run fechamento` (~3 min) sob demanda.

**Sair conta como derrota** (`abandonar`): no online a cadeira fica guardada `ESPERA_VOLTA`
(30 s) e continua `online` para o mesmo `clienteId` reclamá-la.

**nomeUnico — o contrato** (as asserções cobram exatamente isto):

```
nomeUnico('Zé', ['Tião'])              → 'Zé'
nomeUnico('Zé', ['Zé'])                → 'Zé2'         (o número vai no PRIMEIRO nome)
nomeUnico('Zé', ['Zé', 'Zé2'])         → 'Zé3'
nomeUnico('Ana Paula', ['Ana Paula'])  → 'Ana2 Paula'
nomeUnico('Maria Fernanda', [idem])    → 'Maria2'      (o sobrenome sai INTEIRO, nunca cortado)
'ricardo' colide com 'Ricardo '        (NFC + caixa + espaço colapsado)
```

A conferência de colisão vem DEPOIS do corte em 14 (o encolhimento cria colisões próprias);
`nomesVizinhos` exclui a própria cadeira (senão ratchet `Ricardo2 → Ricardo22`); o laço vai
até `tomados.size + 1`. Prazos: partida guardada 12 h · sala do convidado 2 h · mesa do
anfitrião 12 h. Sair de propósito esquece a cadeira, não o código; cair não esquece nada.

### Truco Paulista (implementadas)

```
baralho  40 cartas, sem 8 9 10
ordem    4 5 6 7 Q J K A 2 3         (da mais fraca para a mais forte)
vira     uma por mão; a MANILHA é a SEGUINTE dela na ordem (3 → 4, cíclico)
manilhas batem tudo; entre elas:   ♦ ouros < ♠ espadas < ♥ copas < ♣ paus
mão      3 cartas; melhor de 3 vazas
aposta   truco 3 → seis 6 → nove 9 → doze 12   (donoDaAposta: a mesma dupla não sobe 2×)
partida  até 12 · mesas de 2 ou 4 (duplas em cruz; 3 não fecha times)
mão de 11  quem chega a 11 vê as cartas e decide jogar ou entregar 1 ponto

O MELOU (decidido 06/08): empatou a 1ª → quem ganhar a 2ª leva · ganhou a 1ª e empatou
a 2ª → quem ganhou a 1ª leva · empatou 1ª e 2ª → a 3ª decide · EMPATOU AS TRÊS → a MÃO
MORRE, ninguém marca (coerente com a tranca empatada do dominó).

ESCONDER A CARTA (v4.14): jogada sem força, de barriga para baixo. PROIBIDA na 1ª vaza
de cada mão. Todos esconderam → a vaza mela (cai na tabela do melou). A flag viaja
DENTRO da jogada ({cadeira, carta, escondida}); a VISTA a redige para todos, dono
inclusive. Proibido esconder durante o ferro.

MÃO DE FERRO (v4.14): gatilho alvo-1 × alvo-1 (nunca o literal 11), vale na mesa de 2,
DECIDE A PARTIDA, sem truco nela. Você NÃO vê as suas cartas: a vista manda mao: [] e o
leque cego nasce da contagem (sintéticas ['f', i]); joga-se POR POSIÇÃO e a carta cai
ABERTA (coberta, tudo melaria). O oráculo está fechado: jogar por carta é recusado até
com a carta certa. É flag (P.ferro), não fase — zerada nos DOIS ramos do embaralho.
```

**Sem envido e sem flor** (decidido 05/08 — não reabrir). `undefined` ≠ `null` em
`ganhandoAVaza`: `undefined` = não há vaza em curso; `null` = melando. A narração da vaza sai
em TODOS os caminhos de `fecharVaza`, inclusive o que fecha a mão.

### Decisões do Ricardo — não perguntar de novo

Melou = a mão morre · cruzada = 4 · lá-e-lô só com pontas diferentes · sobrenome sai inteiro
no desempate de nome · convidado que volta assume a cadeira mesmo virada em bot · o convidado
volta sozinho (8 tentativas de 4 s) · código da sala sempre à mostra · URL `?jogo=` grava a
preferência (link = clique) · Truco Paulista sem envido/flor · esconder proibido na 1ª vaza ·
ferro decide a partida, sem truco, vale na mesa de 2 · carta do ferro cai aberta · chamado da
vez para QUALQUER mesa (título+som, não `Notification`) · link `?sala=` pré-preenche e NÃO
conecta sozinho · `beforeunload` só no online com partida viva · APK + Amazon, sem Play
Store · próximo jogo: PIFE · temas de baralho em inventário (Onda E) · Fase 5 adiada até ele
trocar a conta do GH.

---

## Histórico das filas — resumo (o texto integral: `git show v4.15.0:CLAUDE.md`)

- **Filas 1–4** (v1.0–v1.5): pontos da mão final; o celular (enquadrar por fov com piso
  46°/teto 62°, `test-telas`); bot com pesos nomeados (a força é asserção de LIMIAR >2σ, não
  número fixo — rode `node tests/test-regras.mjs` para o corrente); arrumar a mão
  (`ordemDaMao` no cliente); painel de contagem; dica (sai da VISTA — prova de que o bot não
  trapaceia); lembrar preferências e partida (`test-lembrar` recarrega a página).
- **Fila 5** (v1.6–v1.7): onze itens de campo. Lá-e-lô; fechamento forçado (313 casos → 0);
  identidade `clienteId`/`donoDaCadeira` (era vazamento de mão); reentrada do Entrar; toque
  preso e limiar de dedo; deitado com faixa por dono; gaveta modal no celular; determinismo
  do telas (esperar a tela PARAR — 8 quadros iguais). 3 dos 11 tinham diagnóstico errado
  escrito: medir antes de consertar.
- **Fila 6** (v1.7.1): varredura — mudo de um clique, escape em atributo, revanche congelada
  (duas cópias da regra), CDN caído com menu morto, chave de protótipo = tela preta.
- **Fila 7** (v1.8): cinco fotos de campo — DATAR AS FOTOS primeiro (eram todas de versão
  anterior). Peça preta = contexto + bitmap juntos → receitas de `pintar()` + sonda; 4º
  jogador fora da tela (minmax que não encolhe); tralhas dentro da mão (arco da frente
  calculado); a conta única `larguraUtilDoTabuleiro` com três tetos.
- **Fila 8** (v1.9): acessibilidade medida (piso `--fraco: .58`; sete seletores reprovavam),
  teclado completo (o realce já existia; regra de dono do cursor), README, três lacunas
  provadas por mutação.
- **Fila 9** (v1.10): os ramos que nunca rodaram — `prefers-reduced-motion` (CSS e 3D),
  o prazo de 30 s esgotando, a compra voluntária, o `<select>` que grava, compra livre só
  onde há monte.
- **Fila 10** (v2.0): a foto do "Você × Você" — `NOMES` sem "Você" + migração + campo
  `#onlineNome` + desempate no anfitrião (`nomeUnico`); o topo inalcançável
  (`margin: auto`); sair e voltar (código ≠ cadeira; `vagaOnline` reconvertida nos DOIS
  lugares; o `desisto` derruba a conexão junto).
- **Fila 11** (v2.2): varredura da rede — três `setTimeout` sem dono (handle cancelado +
  guarda de geração, o PAR), teto no `{t:'nome'}`, validação do `localStorage`, escape dos
  campos "numéricos", `{t:'erro'}` no protocolo. O dublê `Peer` passou a GRAVAR ouvintes.
- **Reorganização** (v2.3) e **PWA** (v3.0): as pastas por dono com ordem pelo número; a rede
  com ZERO DOM (`145-saguao` nasceu); o encaixe `painelDoJogo`; manifest + service worker +
  three minificado.
- **v4.0–v4.5 — o Truco:** Fase 1 o contrato `JOGOS`/`JOGO` (acoplamento 46 nomes → ZERO,
  medido por AST); Fase 2 a aba (`?jogo=`, chaves por jogo com migração, HTML da casa limpo);
  Fase 3 `40-cartas/` (biblioteca; naipe é CAMINHO, não glifo; carta `[v,n]` SEM a simetria
  da peça); Fase 4 o truco inteiro (o caro foi a CASA saber a FORMA das coisas do dominó — os
  cinco encaixes de HUD nasceram; o contrato encolheu ganhando: 8 verbos por 5, `aplicar`
  devolve a narração).
- **v4.6:** três cenas de truco no telas (cada jogo DECLARA a própria mesa —
  `gruposDaMesa`/`rotuloDaMao`); 4 defeitos de geometria, um do dominó havia meses (a cena
  que o mediria nunca abriu a barra). O mutador virou `tests/mutar.mjs`, versionado.
- **v4.7:** **o truco online estava QUEBRADO** — `vistaDoFio` exigia `v.linha` e prendia todo
  convidado no saguão. "Herda de graça" era afirmação, não medição. Nasceu
  `JOGO.motor.vistaValida` (frouxo de propósito) e o jogo no protocolo (`ola`/`sentou`).
- **v4.8:** truco online em DUPLAS medido — quatro abas, nenhum bot (ações só são observáveis
  com VISTA; bot andaria com a mesa embaixo das asserções). A asserção honesta cobra
  `cartas.length > 0` ao lado do `trucar: null`, mais o CONTRASTE do outro time.
- **Fila 12** (v4.9): varredura pós-truco — escape duplo/cru do fim de mão, `resultado` sem
  validação matava a tela do convidado (o irmão esquecido pela 3ª vez), teto de `log`/`chat`,
  gesto interrompido no truco, o filtro do SW por prefixo, índice cravado na própria suíte.
- **Fila 13** (v4.10): validar o continente e deixar o CONTEÚDO livre (`linha: [null]`
  passava); eu cometi o defeito da véspera dentro do conserto (`somasPorTime` com `|| []`) —
  varredura periódica é o argumento. O `test-twa` saía 127 por causa do `fetch` do Node 24
  (→ `https.get`).
- **Fila 14** (v4.11): a carta 42% esticada (célula quadrada para face retangular); o canto
  ganhou naipe (no truco o naipe DECIDE); o truco herdou quase todas as lições do dominó
  (conferido uma a uma).
- **Fila 15 — as ondas:** **A** (v4.12) manilhas realçadas (moldura, não anel — a foto achou
  o que 385 asserções não acharam), vira erguida no toco (era z-fighting), Peso no topo do
  dominó. **B** (v4.13) o convite em cascata, o chamado da vez, conversa pelo teclado,
  `beforeunload`; e o raio da vaza (cartas encavaladas em campo). **F** (v4.14) esconder a
  carta e a mão de ferro. **D** (v4.14.4) o `test-textura` com o truco na mesa. Sobram
  **C** e **E** (ver "O que vem").
- **Fila 16** (v4.14.3): a MESA ÓRFÃ — trocar de jogo não limpava a cena (os grupos 3D dos
  dois jogos moram na `scene` desde a carga). Nasceu `JOGO.mesa.limpar()`, chamado em
  `abrirJogo` no jogo que SAI (nunca `clear()` — a prévia é filha). A foto do antes mostrou
  a MÃO ficando também.
- **Fila 17** (v4.15): a peça preta DE VOLTA — dublê e guarda dividiam a mesma suposição
  (descarte "sempre transparente"); o conserto é a ASSINATURA do pixel (0,0), e o E5 nasceu
  VERMELHO com os números da Fila 7. E a legibilidade: canto 0.23→0.30, naipe do canto
  0.090→0.12, leque tombado 0.58→0.80 (o naipe do CENTRO não cresceu — a sonda do E3-truco
  cai na margem de papel a 0.11 da largura).
