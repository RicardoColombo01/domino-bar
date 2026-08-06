# Dominó de Bar — guia do projeto

Dominó dupla-seis em 3D no navegador. De 2 a 4 jogadores em qualquer mistura de gente e
bot, na mesma tela ou pela internet. No ar em
**https://ricardocolombo01.github.io/domino-bar/** (repo público `RicardoColombo01/domino-bar`).

Sem framework, sem bundler, e **dois binários** — os ícones do aplicativo, exigidos pelo
manifest: madeira, pintas e sons continuam gerados em canvas e WebAudio na hora. Three.js e
PeerJS vêm de CDN, e o **service worker os guarda**, então depois de uma partida o jogo abre
sem internet. **6.061 linhas** no total (`src/js` + `src/pagina.html` + `src/css/estilo.css`
+ `src/sw.js`), conferido em 05/08/2026 — este número **envelhece**, e envelheceu: ficou
dizendo 2.100 por três releases seguidas.

**Conte com `node`, não com o PowerShell.** `Measure-Object -Line` **não conta linha em
branco** e devolve ~450 a menos; a discordância entre as duas réguas já custou uma
investigação. `node -e "…split('\n').length"` é a que bate com o `wc -l`.

## Comandos

```
npm run build     junta src/ num index.html autossuficiente, e carimba o sw.js
npm run check     avisa se o index.html OU o sw.js estão desatualizados
npm test          build + as três suítes de lógica
npm run app       build + manifest, ícones e o jogo abrindo COM A REDE DESLIGADA (~30 s)
npm run icones    regera icone-192.png e icone-512.png a partir de src/icone.svg
npm run telas     build + o jogo em seis tamanhos de tela (retrato, paisagem, tablet, wide)
                  aceita escolher: node tests/test-telas.mjs 360x640,390x844 nomes,cheia
npm run textura   build + as texturas sobrevivem a sair do jogo e voltar (~40 s)
npm run lembrar   build + o que sobrevive a RECARREGAR a página (preferências, retomar)
npm run shots     build + screenshots no Chrome de verdade (tests/shots/)
npm run online    testa o online abrindo duas abas e uma mesa real
                  aceita escolher: node tests/test-online.mjs --so=saguao
npm run fechamento  caça fechamento forçado jogando milhares de mãos (~3 min)
npm run servir    servidor local (o online não fecha conexão em file://)

A suíte de telas passa de 10 min e já foi interrompida por limite de tempo. Rode em
DUAS METADES, que é o que o argumento existe para permitir:
  node tests/test-telas.mjs 360x640,390x844,640x360
  node tests/test-telas.mjs 844x390,820x1180,1600x900
O rodapé grita "RODADA PARCIAL" — é ele que impede meia suíte passar por suíte inteira.

node tests/test-online.mjs https://ricardocolombo01.github.io/domino-bar/
                  testa o que está PUBLICADO, não o local

Primeira vez:  cd tests && npm install
```

## Branches

**`main` é a única branch permanente, e é exatamente o que está publicado** — o Pages serve
dela. Desde 02/08/2026 não há mais `develop`.

O trabalho vai numa branch com o **nome da versão que ela vai lançar**: `v2` para a 2.0.0,
`v3` para a 3.0.0. Ela nasce de `main`, recebe os commits da onda, e volta com merge
`--no-ff` mais a tag `vX.Y.Z`. Depois é apagada — **branch de trabalho é temporária, e a
tag é o que fica.** Correção urgente do que está no ar continua em `hotfix/*`, com o mesmo
caminho de volta.

```
main   v1.9.0 ── v1.10.0 ─────────────── v2.0.0 ─────────────── v3.0.0
                        ╲               ╱      ╲               ╱
                         ●──●──●──●──●──         ●──●──●──●──●
                              v2                      v3
```

**Por que mudou:** `develop` existia para separar "pronto" de "publicado", e neste projeto
essa separação nunca teve consequência — quem publica é uma pessoa, na mesma tarde, e o
tempo em que `main` e `develop` tinham conteúdo diferente foi sempre medido em minutos. O
que a separação custava era real: **dois merges e dois rebuilds do bundle por release**, e
o `merge=ours` do `index.html` disparando nos dois. Foi de lá que veio o dia perdido de
31/07 — `develop` commitada, `main` três releases atrás, e o Ricardo testando o `github.io`.
Com uma branch permanente só, "commitado" e "publicado" ficam a um `git push` de distância,
não a dois merges.

**O que NÃO mudou, e não pode mudar:**

- `main` é o que está no ar. Ela **só recebe merge `--no-ff`**, sempre com tag — nunca
  commit direto de trabalho. (A exceção é o commit que mudou este próprio modelo: ele não
  tinha de onde sair.)
- `index.html` é gerado e commitado, então está marcado `merge=ours` no `.gitattributes` —
  **todo merge que tocou `src/` termina com `npm run build && git add index.html`**, e
  `npm run check` reprova bundle desatualizado. O driver exige `git config
  merge.ours.driver true` uma vez por clone. Isto fica **mais** importante sem a `develop`,
  não menos: some o segundo merge, que era onde um bundle velho ainda tinha chance de
  aparecer antes de chegar ao ar.
- **Commitado ≠ enviado ≠ publicado** continua valendo, com um lugar a menos para errar:
  `git rev-list --left-right --count origin/main...main` responde tudo agora.

---

## Invariantes — não quebrar

**1. `src/js/<pasta>/NN-*.js` são pedaços do MESMO escopo.** Sem `import`/`export` entre si;
`build.mjs` varre `src/js/` recursivamente e concatena **na ordem do NÚMERO do nome, nunca
na do caminho**, rodando `node --check` antes de gravar. Existe porque o navegador bloqueia
módulos em `file://` e o jogo tem de abrir por duplo-clique.
**Nunca editar `index.html` à mão — ele é gerado.**

**A pasta organiza para quem LÊ; o número manda em quem EXECUTA**, e a distinção não é
estilo. `140-menu.js` (casa) chama `mesaLembrada()` no topo do módulo, e ela valida o nível
de bot contra `NIVEIS`, que mora em `050-bot.js` (**dominó**). Ordenar por caminho poria toda
a `10-casa/` antes de toda a `30-domino/`, `NIVEIS` cairia na zona morta e a carga estouraria
com `ReferenceError` — tela preta que não depende de dado guardado nenhum para acontecer.
Arquivo novo escolhe o número pela **dependência de carga**, não pela pasta em que cai; o
`build.mjs` reprova número repetido e arquivo sem número, porque os dois deixariam a ordem
ao acaso do sistema de arquivos.

**E o `index.html` é AUTOSSUFICIENTE de verdade** — o CSS entra no bundle
(`src/css/estilo.css` vira `<style>`). Ele vinha por `<link>` até aqui, e a palavra
"autossuficiente" era falsa em três arquivos ao mesmo tempo.

**2. Uma cadeira é `voce`, `local`, `bot` ou `online`, e o motor não sabe a diferença.**
Ele diz de quem é a vez e espera; quem responde (mouse, bot ou rede) é outra camada. Não
criar "modo de jogo" — mesa mista (2 online + 1 bot) sai de graça justamente por isso.

**3. `visaoDe(cadeira)` é a fronteira de segurança.** No online é literalmente o que
trafega, e o anfitrião nunca manda a mão alheia. Toda tela lê a *visão*, nunca a partida.
Há teste conferindo que nenhuma peça da mão do anfitrião chega no convidado.

**4. `030-regras.js` e `060-layout.js` são funções puras.** É o que permite testar 53 mil
tabuleiros no terminal — e é de onde a prévia da jogada sai de graça: ela simula com
`aplicar()` e pergunta a posição ao `layoutDaMesa()`, sem geometria nova.

**5. A linha da mesa é guardada já orientada:** `linha[i][1] === linha[i+1][0]`, sempre.
As pontas são o primeiro e o último número; jogar na esquerda é um `unshift`.

### Mapa

A ordem abaixo é a de CONCATENAÇÃO (o número), e ela se lê de cima a baixo mesmo com os
arquivos morando em pastas diferentes — repare como casa e dominó se intercalam. É esse
intercalamento que torna o número, e não o caminho, a fonte da ordem.

**Os números vão de dez em dez desde a v3.0.0**, e é o que permite encaixar arquivo novo
entre dois velhos. Consecutivo quer dizer LOTADO: as constantes de dominó não tinham para
onde ir porque precisavam rodar antes do `140-menu` e não havia inteiro livre em todo o
intervalo. As nove vagas entre cada par são o espaço do `40-truco/`.

```
src/css/estilo.css               entra no bundle como <style>
src/pagina.html                  o molde, com __ESTILO__ e __JOGO__
src/sw.js                        o molde do service worker, com __VERSAO__
src/icone.svg                    a fonte dos dois PNG do manifest

10-casa/010-constantes   cores do boteco, movimento reduzido, guardar/lido/esquecer
30-domino/015-constantes peça, MODOS, pontuação, medidas do tabuleiro
30-domino/020-baralho    embaralhar, distribuir (com re-embaralho), quem abre, sobraDoBaralho
30-domino/030-regras     encaixes, pontas, jogadas válidas, tipo de batida     ← puro
30-domino/040-partida    turnos, compra, passe, placar, visaoDe()
30-domino/050-bot        níveis = quanta informação o bot recebe
30-domino/060-layout     onde cada peça cai na mesa, com as dobras             ← puro
10-casa/070-cena         renderer, câmera, luz de boteco, mesa, tralhas
30-domino/080-peca3d     geometria + atlas de pintas em canvas + fantasma
30-domino/090-tabuleiro  reconcilia o tabuleiro com a visão; prévia da jogada
30-domino/100-mao        sua mão em leque, mãos dos outros, monte
30-domino/110-interacao  raycast: escolher → ver → confirmar
10-casa/120-audio        WebAudio puro, sem arquivo
10-casa/130-hud          placar, vez, botões, telas de fim, o encaixe painelDoJogo
30-domino/135-contagem   o que vai DENTRO do painel: quantas peças faltam aparecer
10-casa/140-menu         montagem da mesa (as cadeiras)
10-casa/145-saguao       a tela do online: código, quem chegou, os quatro cliques
10-casa/150-rede         PeerJS, anfitrião autoritativo — ZERO chamadas ao DOM
10-casa/160-loop         estado do app, turno, hotseat, render loop
```

**A pasta é uma AFIRMAÇÃO, não uma gaveta:** o que está em `10-casa/` promete não saber que
o jogo é dominó, e é o que o Truco vai herdar de graça. Hoje a promessa ainda não é
verdadeira em dois pontos, e eles estão nomeados na seção da Reorganização: `150-rede.js`
escreve na tela por id (45 chamadas `el(...)`, mais que o próprio HUD) e `130-hud.js` tem o
`desenharContagem`, que é regra de dominó. **Enquanto isso durar, a pasta é uma promessa a
cumprir, não um fato.**

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
  `100-mao.js`. Como tudo é o mesmo escopo concatenado, um terceiro `naMao` seria colisão
  silenciosa; o tamanho da mão chama-se `pecasPorMao`.
- **Aritmética de baralho fora do motor apodrece.** `140-menu.js` tinha `28 - 7 * MESA.n`
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
  palavra final é `larguraVisivelEm()`, em `070-cena.js`.
- **`Set` não sobrevive a JSON**, e `P.faltaNo` é um array de `Set`.
  `JSON.stringify(new Set())` dá `{}` — objeto sem `.has` e sem `.indexOf`. Guardar a
  partida no `localStorage` perdia calada a marca de "passou no número" e o bot estourava
  em `050-bot.js`. `visaoDe` já convertia para o fio (`Array.from`); quem guarda tem de
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
- **Contêiner flex CENTRADO que também rola tem o topo inalcançável.** `align-items: center`
  faz o conteúdo mais alto transbordar para os DOIS lados, e a área rolável só se estende
  para o FIM: `scrollTop: 0` já é o fim do curso e o que ficou acima não volta nunca. Quem
  resolve é `margin: auto` no filho — faltando espaço as margens automáticas resolvem para
  zero, sobrando espaço dividem a folga. E `overflow: hidden` **continua rolável por
  script**: um teste que só mexe em `scrollTop` aprova uma tela que o dedo não move.
- **Ao acrescentar uma API de navegador ao jogo, o primeiro lugar a olhar é o `harness.mjs`
  — e o dublê do PRÓPRIO teste conta junto.** Ele já ficou para trás **dez vezes**
  (`matchMedia`, captura de ponteiro, `AudioContext`, `Peer`, eventos de contexto WebGL,
  `setAttribute`, `preventDefault`, o `matchMedia` de novo — por responder SEMPRE a mesma
  coisa —, a `conn` de mentira sem `open`, que fazia `espalharVistas` nunca mandar nada, e
  o `on()` que ENGOLIA o registro). A décima é a mais cara de todas: com
  `on() { return this; }` no `Peer` e `on: () => {}` na `conn`, o `conn.on('data')` inteiro
  era **inalcançável do Node** — nenhuma linha de teste jamais entregou uma mensagem
  malformada à mesa, e foi por esse buraco que passaram quatro dos sete achados da Fila 11.
  **Dublê que engole registro de ouvinte não é dublê incompleto: é uma camada inteira do
  jogo sem teste.** O conserto é ele GRAVAR e o teste DISPARAR — assim ele continua não
  agindo sozinho, e nenhuma suíte existente muda de comportamento.
  Dez não é acaso. E
  a tentação, todas as vezes, é guardar no JOGO (`if (el.setAttribute)`) — isso troca um
  defeito por um ramo que o teste nunca alcança. **Dublê que responde um valor fixo é tão
  incompleto quanto dublê sem método**, e o sintoma é o mesmo: um ramo verde que nunca rodou.
- **Asserção de TEMPO num harness com dublê mede o DUBLÊ.** O custo real de um convidado
  mandando nome de 4 MB é o `publicar()` gravando a partida no `localStorage` a cada
  mensagem — e o harness dubla o `localStorage`. Medido: 20 nomes de 4 MB custam **382 ms**
  em Node contra os ~9 s do navegador. Qualquer limiar de tempo ali estaria certificando um
  mundo que não existe. O que se mede é a **amplificação** (quantas publicações a rajada
  gera), que é determinística e é o defeito em si.
- **Quando o conserto tem DUAS camadas, a mutação de UMA delas sai verde — e isso é o
  desenho, não asserção fraca.** Tirando só o `clearTimeout` ou só a guarda de geração, a
  irmã segura o caso testado. Elas existem porque falham de jeitos diferentes: cancelar faz
  o temporizador deixar de existir, a geração só o faz calar, e só a geração alcança
  callback de peer, que `clearTimeout` não cancela. **A prova honesta é mutar o PAR** — e
  quem mexer numa camada e vir a suíte verde não descobriu que ela é inútil, descobriu que
  a irmã está de pé. Isso precisa estar escrito ao lado da asserção.
- **Asserção que LANÇA em vez de reprovar mata o processo e trunca a suíte.** O efeito
  perverso aparece na conferência por MUTAÇÃO: ela passa a sub-relatar, e parece que a
  asserção não cobria o ramo quando na verdade a suíte morreu antes de chegar lá. Quando
  uma mutação reprovar MENOS do que devia, suspeite disso antes de suspeitar da asserção.
  **A outra causa é a mutação não ter sido aplicada:** os arquivos aqui são CRLF, e um
  `replace` com `\n` no texto de busca não casa, não estoura e deixa o arquivo intacto —
  "tudo certo" fica indistinguível de "não mexi em nada". Mutação por script tem de exigir
  que o casamento aconteceu antes de rodar a suíte.
- **Medir "parou de se mexer" logo depois de mandar parar mede a própria parada** — a
  transição para o valor fixo é uma diferença real que não é oscilação. Precisa de um quadro
  para o regime novo começar. E função de teste que GASTA quadros não pode ser chamada
  dentro da mensagem de erro: as duas chamadas medem intervalos diferentes, e a mensagem
  passa a contar uma história diferente da que reprovou.
- **`opacity` não escurece a cor, ela MISTURA o texto com o fundo.** Então contraste de
  texto desbotado depende de onde ele está, e o piso do projeto tem nome: `--fraco: .58`
  (medido, `.52` é o mínimo do AA e folga zero não é conserto). Opacidade de texto abaixo
  do piso precisa de motivo escrito ao lado.
- **Região `aria-live` reescrita a cada quadro vira ruído.** `desenharHUD` roda em todo
  `publicar()`, e atribuir `textContent` troca o nó de texto mesmo quando a frase é
  idêntica — o leitor de tela anuncia a TROCA, não a diferença. Texto de região viva só se
  escreve quando muda. E `opacity: 0` mantém o elemento na árvore de acessibilidade;
  `display: none` o tira, e o anúncio morre junto sem aparecer em foto nenhuma.
- **Asserção comparada contra um dublê VAZIO é verde por trivialidade.** Comparar o glifo do
  botão de som com `els.get('btSair').textContent` parece mais robusto que escrever `'✕'` à
  mão, e é o contrário: o harness não lê a página, então aquilo é `''`. Quando o teste
  precisa de um valor que só existe no HTML, escreva-o à mão **com o motivo ao lado**.
- **Asserção nova sobre comportamento que já está CERTO não pode nascer vermelha** — e por
  isso não prova nada sozinha. A prova equivalente é **mutação**: quebre a linha que ela
  deveria proteger e confira que ela cai.
- **`Measure-Object -Line` do PowerShell NÃO conta linha em branco** (~450 a menos que o
  `wc -l` neste repositório). Contar linha com ele fez a base parecer ter encolhido depois
  de ganhar código.
- **`catch` que guarda só a `message` esconde ONDE.** O `test-online.mjs` engolia o stack e
  transformava "falhou em algum lugar dos 300 lances do teste" num palpite caro. Hoje
  `DOMINO_DEBUG=1` imprime. Vale para qualquer `catch` que exista para transformar falha de
  rede em aviso: ele também engole os defeitos de verdade — e o recado tranquilizador é
  justamente o que faz ninguém olhar. Hoje `TypeError` e `ReferenceError` ali reprovam com
  stack em vez de virar aviso, porque **rede não produz nenhum dos dois**.
- **Cena de teste que mexe em estado compartilhado tem de devolver como encontrou.** Vale
  para o `localStorage` das suítes de tela e para o `MESA` das cenas do online, que
  compartilham a MESMA aba viva. Uma cena que deixou a mesa no Trio fez a seguinte reprovar
  com "A FALA DA DUPLA VAZOU" — sem duplas, o canal da dupla é o canal geral. Teste novo
  derrubando teste velho lê exatamente como defeito no jogo.
- **Duas suítes pesadas ao mesmo tempo viram "erro de rede".** A contenção de CPU estoura os
  45 s de navegação do `test-online`, e a mensagem culpa o broker do PeerJS. Vale também
  para uma suíte de Node ao lado do `test-telas`: aquilo renderiza WebGL **por software**,
  ou seja é CPU pura, e a espera dele é "oito quadros iguais" com teto de 240 — máquina
  disputada chega ao teto antes de assentar. **Suíte pesada roda sozinha.**
- **Cache é a segunda porta do "está consertado e o celular mostra o defeito".** O dia perdido
  de 31/07 tinha um conserto barato — `git push`. Um service worker servindo a PÁGINA do cache
  reabre o mesmo engano sem conserto nenhum do seu lado, porque o cache é do celular do
  jogador. Regra que fica: **o que muda de conteúdo sem mudar de nome não pode ser servido do
  cache enquanto houver rede**; o que tem versão na URL pode e deve.
- **`String.replace` troca só a PRIMEIRA ocorrência, e o marcador escrito no comentário
  come o de verdade.** O `build.mjs` carimba a versão do `sw.js` trocando `__VERSAO__` — e o
  comentário logo acima explicava o mecanismo citando o próprio token. O comentário ficou com
  o resumo e o `const VERSAO` ficou com o marcador: cache chamado `dominobar-__VERSAO__`, o
  mesmo nome para sempre, que é exatamente o defeito que aquele mecanismo existe para
  impedir. **Contar antes de trocar** — é a mesma disciplina que este arquivo já exige das
  mutações de teste, e agora vale para o build.
- **Resposta OPACA não entra em cache, e é assim que um recurso some só depois de instalado.**
  `<script src>` sem `crossorigin` é buscado em modo `no-cors`; o service worker recebe algo
  que não pode conferir e recusa guardar. O jogo abriria offline **sem o PeerJS**, ou seja,
  sem online — e o relato seria "o botão de mesa online sumiu depois que instalei".
- **Nome de topo repetido no escopo concatenado só é SILENCIOSO em `function` e `var`.**
  `const`, `let` e `class` dão `SyntaxError`, que o `node --check` do build já pegava. A
  dívida anotada dizia o contrário, e citava justamente um `const`. Hoje o `build.mjs`
  reprova o repetido dizendo o nome e **os dois donos**.
- **Numeração consecutiva é numeração LOTADA.** `01…16` não tinha onde encaixar um arquivo
  que precisasse rodar entre dois existentes, e foi por isso que as constantes de dominó
  ficaram anos na pasta da casa: não havia inteiro livre antes do `140-menu`. De dez em dez
  abre nove vagas entre cada par.
- **Quando a sua conferência acusa TUDO, o errado é ela.** Um script de uma vez só disse que
  as 19 constantes tinham sumido do bundle depois da separação — era escaping de `\b` comido
  pelo shell. Um `grep` de dez segundos mostrou que estava tudo lá. Falha universal é sinal de
  instrumento quebrado, não de código quebrado.
- **Uma reprovação sozinha não decide de quem é a culpa; o CONTROLE é rodar a mesma cena na
  `main`.** O `test-online` estourou o prazo de navegação num `page.reload` logo depois de eu
  mexer no saguão, e o recado pronto do arquivo dizia "foi o broker do PeerJS". Rodar a mesma
  cena na `main` (passou) e de novo na branch (passou) é o que separou ambiente de defeito —
  e uma sonda mostrou o `goto` variando de **6 a 18 segundos** contra um prazo de 45.
  **Corolário do PWA:** com o service worker guardando as bibliotecas, essa fragilidade cai
  junto.

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
precisa de um flag de módulo em `160-loop.js` (`viuOFimDaMao`), zerado quando a fase muda —
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
- **A largura tem de entrar na assinatura da mão** (`100-mao.js`). Invalidar à força
  reconstruía o leque a cada `resize` — e no iOS a barra de URL dispara `resize` o tempo
  todo, o que apagava a peça que você tinha levantado.
- **`typeof x` sobre um `let` na zona morta LANÇA**, não devolve `'undefined'`. O guarda
  que parecia defensivo não defendia nada; o que segura é a primeira chamada de
  `enquadrar()` morar em `160-loop.js`, depois de tudo declarado.
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

**`escolherJogada` (`050-bot.js`)** virou uma nota por opção, e a ordem dos pesos é a
ordem das prioridades de quem joga bem: bater (e bater caro), **não se enterrar** —
contar com quantas peças você ainda responde às pontas que acabou de deixar —, apertar
quem joga depois usando `faltaNo`, e só então descarregar peso. `informacao()` passa a
entregar `P.linha`, que é público. Os níveis continuam sendo *quanta informação* o bot
recebe, não três algoritmos. `tests/test-regras.mjs` tem a única asserção do projeto que
mede QUALIDADE: o difícil ganha ~59% do fácil em 300 partidas.

**Arrumar a mão (`100-mao.js`, `110-interacao.js`).** `sincronizarMao` quebrou em
`reconciliarMao()` (mantém vivo quem continua na mão) + `posicionarMao()` (só geometria,
lê a ordem atual de `naMao`). A ordem mora em `ordemDaMao`, um `Map` por cadeira com
chaves de peça, e **nunca no motor**. Arrastar é uma máquina de estados em
`pointerdown/move/up`, separada do toque por DISTÂNCIA e não por tempo.

**Painel de contagem (`130-hud.js`).** Sai inteiro de `vista.linha` + `vista.mao` + o
`faltaNo` novo na visão — tudo público, nada a mudar no motor.

**Lembrar preferências (5) ✔ feito (v1.5.0).** `guardar`/`lido`/`esquecer` em `010-constantes.js` —
mora no primeiro arquivo porque o `130-hud.js` lê preferência na hora em que é concatenado.
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

**Dica de jogada (7) ✔ feito (v1.5.0).** `dicaDaVista(vista)` em `050-bot.js`: é o bot pensando com
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

> **Números de 30/07/2026, mantidos como registro do que se mediu naquele dia.** **HOJE são
> 600 partidas e 335 × 265 (55,8%)** — o laço dobrou e as regras dos itens 1 e 2 mudaram a
> força duas vezes. Quem quiser o número corrente **roda `node tests/test-regras.mjs`**, que
> o imprime; não o leia daqui. A asserção é **limiar** (`> 2σ`), não número fixo, e é por
> isso que ela sobreviveu às três mudanças.

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

#### ESTADO EM UMA OLHADA (05/08/2026)

| | |
|---|---|
| publicado | **v3.0.1** — https://ricardocolombo01.github.io/domino-bar/ |
| esta release | **v3.0.1** — a auditoria da v3.0.0: a página passa a ser rede-primeiro, e o resumo do cache cobre o worker |
| `main` ↔ `origin/main` | conferir com `git rev-list --left-right --count origin/main...main` |
| Filas 5 a 11 | **todas fechadas**, e não há defeito conhecido em aberto |
| o que vem | **o Truco** — é o próximo, e o único item grande que sobrou da ordem dada pelo Ricardo em 04/08 |

**A ordem do Ricardo (04/08) foi cumprida inteira:** worktree ✔ (v2.3.0 e v3.0.0 saíram de
um), as pastas ✔ (v2.3.0, e as duas dívidas na v3.0.0), o PWA ✔ (v3.0.0). Sobra o Truco.

**A fila esvaziou na v1.10.0, encheu em 03/08 pela fonte mais barata (jogar), esvaziou na
v2.0.0 — e a v2.1.0 a encheu de novo pela OUTRA fonte: varredura.** É a segunda da história
do projeto (a primeira deu a Fila 6) e a maior: sete achados confirmados, seis suspeitas, e
um buraco de teste que explica três deles.

**Comece pela Fila 11**, lá embaixo. C1 e C2 são o que um jogador encontra sozinho; C4 é o
que um convidado usa contra a mesa inteira de propósito.

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
| **F8** · acessibilidade | `--fraco: .58` com nome e motivo; aria-live; 🔇 | **7 seletores** reprovavam o AA, 5 nunca citados |
| **F8** · teclado | `← →`, `1..9`, Enter — o realce já existia | **9 asserções**, 7 vermelhas antes |
| **F8** · lacunas | duplas, painel de contagem, `<select>` | provadas por **mutação**, não por vermelho |

**As releases:** v1.6.0 (itens 1, 3a, 3b, 4, 5, 6, 7, 8, 9, 10) → v1.7.0 (itens 2, 3c, e o 11)
→ v1.7.1 (os cinco defeitos da varredura) → v1.8.0 (as cinco fotos da Fila 7) → v1.9.0 (a
Fila 8: acessibilidade, teclado, README e três lacunas de teste) → **v1.10.0** (a Fila 9: os
três ramos que nunca tinham rodado).

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
aliasado do `060-layout.js` **não é defeito** porque ninguém lê aquele campo. Nos dois casos
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

#### O QUE FAZER AMANHÃ — ordem dada pelo Ricardo em 04/08/2026

Palavras dele: *"amanhã quando eu voltar, você leia os arquivos, já que anotou os erros, vai
começar consertando isso; logo após, começar a usar o Worktree para realizar as outras tasks
de forma organizada e limpa — inclusive, tente deixar as próprias pastas limpas e polidas."*

~~**PASSO 0 — ler antes de mexer.**~~ ✔ feito.

~~**PASSO 1 — CONSERTAR A FILA 11.**~~ ✔ **feito em 05/08/2026, e saiu na `v2.2.0`** (e não
na `v3`: nada quebrou compatibilidade de dado guardado, e isso deixa o nome `v3` livre para
a reorganização, que é a mudança grande de verdade). Ver a Fila 11, agora fechada, para o
que a implementação corrigiu no diagnóstico — inclusive que a cena de teste **não era
escrevível** como este passo mandava, porque o despachante era inalcançável do Node.

**PASSO 2 — passar a trabalhar com `git worktree`.** ← **É AQUI QUE SE RETOMA.**
Ver a seção própria, na Reorganização.
O arranjo sugerido, uma frente por diretório:

```
../domino-bar          main          (o que está no ar; para conferir e publicar)
../domino-bar-org      reorg         (as pastas — mexe em TODOS os arquivos)
../domino-bar-app      pwa           (manifest, ícones, service worker)
```

**Por que nesta ordem e não antes:** a `reorg` toca todo arquivo do projeto, então rodá-la em
paralelo com os consertos da Fila 11 garantia conflito em `150-rede.js`, que é justamente onde
os dois trabalhos moram. **Conserta primeiro, reorganiza depois.** E a regra que não muda:
worktree resolve conflito de arquivo, **não de CPU** — suíte pesada continua rodando sozinha.

**PASSO 3 — as pastas limpas e polidas.** Além da separação por dono (`10-casa/`,
`30-domino/`, `40-truco/`), duas arrumações que já dá para nomear:

- **O CSS entra no bundle.** Hoje `css/estilo.css` é fonte e mora **fora** de `src/`, e o
  `index.html` o carrega por `<link>` — que é a razão de o build **não** gerar o arquivo
  autossuficiente que os três arquivos de documentação prometem. Inlinar o CSS no
  `build.mjs` resolve **quatro coisas de uma vez**: a promessa passa a ser verdade, a fonte
  vai para `src/css/` junto com o resto, o service worker passa a cachear um arquivo local em
  vez de dois, e cai uma requisição HTTP.
- **Um lugar só para artefato gerado.** Hoje `tests/` mistura suíte com cinco `built*.mjs`
  gerados (inclusive `built-dbg.mjs` e `built-busca.mjs`, sobras) e mais `shots/`. Juntar o
  gerado num `tests/.gerado/` deixa a pasta com **só** o que uma pessoa escreveu — e o
  `.gitignore` vira uma linha em vez de três.

**Nada disso é caro.** Três dos sete achados são uma linha de guarda cada.

E vale lembrar como esta fila enche: **campo** (jogar — deu as Filas 5, 7 e 10) e
**varredura** (procurar o que ainda não incomodou — deu a Fila 6 e agora a **11**). A Fila 10
saiu de UMA foto e três frases; a Fila 11 saiu de uma tarde de leitura com o código rodando.

**A lista abaixo esvaziou na v1.10.0.** Os seis itens originais saíram na v1.8.0 e na v1.9.0
(Fila 8); os três que sobravam saíram na **v1.10.0** (Fila 9).

O que sobra são coisas que **não recomendo agora** e estão registradas com o motivo, logo
abaixo, e um trabalho de fundo que só vale quando doer:

**O `test-telas` passa de 10 minutos e é preciso rodá-lo em duas metades.** Funciona (o
argumento existe, e o rodapé grita "RODADA PARCIAL"), mas é manual e fácil de esquecer
metade. Quem for mexer nisso deve olhar o **número de quadros parados exigidos** (hoje 8),
que é de onde o tempo vem — e **não** voltar ao prazo fixo, que foi o defeito do item 11.

#### O QUE PODERIA SER FEITO, mas não recomendo agora

Registrado para não ser redescoberto do zero — e com o motivo de não ser prioridade:

- **Fazer o 3D DESVIAR dos painéis** em vez de os painéis darem lugar. Combina com
  `larguraVisivelEm()` e `assentosDaMesa()` (`070-cena.js`), e é o caminho não escolhido do
  item 10. É o mais caro, e a gaveta e as faixas já resolveram o problema real.
  **`apertoDaMesa()` NÃO EXISTE MAIS** — a Fila 7 o dissolveu quando o aperto passou a ser
  decidido pelo assento que binda; este arquivo ainda o cita em três lugares como se
  existisse, e são citações mortas.
- **`beforeunload` no meio de partida online.** As regras dizem em letras grandes que sair
  conta como derrota, e um F5 acidental gasta o prazo de 30 s sem aviso. Barato — mas
  `beforeunload` é incômodo e precisa de decisão do Ricardo, não de programador.
- **Botão de copiar/compartilhar o código da sala.** `user-select: all` resolve o mouse; no
  dedo, copiar de um `<div>` é sofrível, e o caso comum é mandar o código pelo WhatsApp.
  `navigator.share` resolveria. Impacto real no online, custo pequeno.
- ~~**`prefers-reduced-motion`.**~~ ✔ **feito na v1.10.0** (Fila 9), CSS **e** 3D. A previsão
  aqui era "pequeno no CSS, médio no 3D" e o 3D saiu em **duas linhas**: `chegarPerto` é a
  única função de suavização do projeto, e a lâmpada é o único movimento que não acaba nunca.
- **Dívidas que investiguei e concluí que NÃO são defeito hoje** — não refaça o trabalho:
  o clone de material por peça sem `dispose()` (mesma `cacheKey`, os materiais viram lixo
  coletável; é churn, não vazamento); o `alvos.esq === alvos.dir` do `060-layout.js` (aliasing
  armado, mas `alvos` é **código morto** — remover é melhor que consertar); e o array `VAZIO`
  compartilhado do `050-bot.js` (só é lido hoje; um `add` ali um dia envenenaria todos).

#### Perguntas em aberto para o Ricardo

- **Nenhuma em aberto.** O corpo de `nomeUnico()` chegou a ser dele — foi escolha dele quando
  perguntado em 03/08 —, e no fim do mesmo dia ele devolveu: *"amanhã você termina o resto
  que falta"*. Voltou a ser meu e **saiu na v2.0.0**.
- As três decisões da Fila 10 foram respondidas em 03/08/2026: os **três** consertos de
  nome juntos; o convidado que volta **assume a cadeira mesmo virada em bot**; e a onda sai
  em branch `v2`, tag `v2.0.0` (e não em `hotfix`/`v1.10.1`). A quarta veio em **04/08**, e é
  a única que a implementação não podia responder sozinha: quando o nome desempatado não cabe
  nos 14, **o sobrenome sai inteiro** (`"Maria Fernanda"` → `"Maria2"`, e não
  `"Maria2 Fernand"`) — as duas saídas eram defensáveis, como a cruzada da Fila 5.
- **A fila esvaziou na v1.10.0, a Fila 10 a encheu em 03/08 e a v2.0.0 a esvaziou de novo** —
  os três defeitos estão consertados, testados e no ar. O que resta em
  aberto é a lista de "poderia ser feito, mas não recomendo agora", logo acima,
  e dela só uma coisa depende de decisão dele e não de programador: o **`beforeunload` no
  meio de partida online** (um F5 acidental gasta o prazo de 30 s sem aviso, mas
  `beforeunload` é incômodo). As outras duas são escolha de escopo, não de gosto: o botão de
  **compartilhar o código da sala** (impacto real no online, custo pequeno) e fazer o **3D
  desviar dos painéis** (o mais caro, e a gaveta já resolveu o problema real).
- Vale lembrar como este projeto enche a fila: **campo** (o Ricardo jogando no celular, que
  deu a Fila 5, a Fila 7 e agora a **Fila 10**) e **varredura** (procurar o que ainda não
  incomodou, que deu a Fila 6). Três das quatro últimas vieram de jogar — é a fonte mais
  barata que este projeto tem, e a Fila 10 saiu de UMA foto e três frases.

#### Como retomar em cinco minutos

```
git fetch origin && git rev-list --left-right --count origin/main...main   # tem de dar 0 0
git branch -a          # hoje só main; a próxima onda nasce numa v3
npm run check          # o bundle está em dia com src/?
npm test               # as três suítes de lógica, segundos
```

**Hoje `npm test` tem de passar inteiro** — a fila está vazia e não há vermelha esperada.
Qualquer reprovação é regressão.

**Estado em 05/08/2026, conferido rodando:** `npm test`, `npm run lembrar`, `npm run online`,
`npm run textura` e o `telas` nas duas metades — **todos verdes**. A Fila 11 está fechada e
não há defeito conhecido em aberto.

**Suíte pesada roda sozinha** — o `test-telas` renderiza WebGL por software e o `test-online`
tem prazo de navegação de 45 s; duas ao mesmo tempo viram falha que parece da rede. E o
`telas` passa de 10 min: rode em duas metades (ver os Comandos, lá em cima).

E antes de qualquer conserto: **medir**. Três dos onze itens da Fila 5 e dois dos cinco
defeitos da Fila 6 tinham diagnóstico errado escrito antes de alguém olhar os números.

### 1. Lá-e-lô só existe com as pontas DIFERENTES ✔ feito

A batida de lá-e-lô (2 pontos) só vale quando as duas pontas da mesa são de números
**diferentes** e a peça da batida carrega os dois — ou seja, quando ela realmente podia ter
entrado de qualquer um dos lados.

Pontas iguais não são "dois lados". Nas palavras do Ricardo: pontas `3` e `3`, jogador bate
com a `3|1` — **não** conta como bater dos dois lados, é batida simples. Para valer, teria de
ser uma ponta `3` e a outra `1`.

O defeito estava em `tipoDaBatida` (`030-regras.js`), nesta linha:

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

`050-bot.js` pontua batida com `PONTOS[tipoDaBatida]`, então as partidas semeadas se mexeram:
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
concreto antes de mexer. A saída melhor foi *procurar* o caso: `030-regras.js` é puro, então dá
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

**A força do bot se mexeu**, como no item 1 — `050-bot.js` joga pelas ações que `acoesDe`
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
// 150-rede.js, no peer.on('connection')
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

De **30/07/2026**. O `btConectar.onclick` (`150-rede.js`) não tinha guarda de reentrada: cada
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

De **30/07/2026**. `110-interacao.js` começava o trato do toque com `if (arrasto) return;`. Se o
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
`130-hud.js` põe o sobrenome num `<i class="resto">` e o CSS o esconde onde a faixa aperta.
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

Não é hipótese de que esta família reincide: o comentário do `070-cena.js` registra que o copo
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
  para manter o tabuleiro centrado (`090-tabuleiro.js`). Olhando só os filhos, a foto ficava
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

**A FILA 6 ESTÁ FECHADA.** Os cinco defeitos fecharam na v1.7.1; o resto do que a varredura
achou — acessibilidade, cobertura de teste e documentação, na seção "o que ficou de FORA do
escopo" no fim desta fila — foi feito na **v1.9.0**, e está registrado na **Fila 8**. O que
sobrou dali (dois ramos de rede, a compra voluntária) está no "O QUE FAZER AMANHÃ" lá em cima.

**Nenhum destes cinco foi relatado por ninguém.** Vieram de procurar, não de esperar — e é
uma diferença que vale registrar, porque a Fila 5 inteira nasceu de relato. Os dois modos se
complementam: o campo acha o que incomoda, a varredura acha o que ainda não incomodou.

### 1. O mudo durava exatamente um clique ✔ feito

`120-audio.js` implementa o mudo suspendendo o AudioContext. O listener de `pointerdown`
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

`montarCadeiras` (`140-menu.js`) escrevia `value="${c.nome}"`. Era o único `innerHTML` do
projeto fora do `escapar()`, e **pior que os anteriores por estar dentro de um ATRIBUTO**:
basta uma aspa para sair dele.

`c.nome` vem de fora — o convidado manda o nome pela rede, `150-rede.js` escreve em
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
bem testados; sem asserção nenhuma estão: **as pintas da peça** (`080-peca3d.js` — se
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

- `080-peca3d.js` clona um material por peça e o projeto **não tem um único `dispose()`**.
  Investigado: os clones têm parâmetros idênticos, logo mesma `cacheKey` no three — é um
  programa só, e os materiais viram lixo coletável ao sair da cena. É churn de alocação por
  rodada, não memória crescente. Dívida, não defeito que o jogador sente.
- `060-layout.js` devolve o MESMO objeto em `alvos.esq` e `alvos.dir` quando a linha está
  vazia. Aliasing armado — mas `alvos` **não é lido por ninguém**: é código morto. Consertar
  ou remover, e remover é provavelmente melhor.
- `050-bot.js` entrega o mesmo array `VAZIO` de Sets a todos os bots fáceis. Hoje só é lido,
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
- **`visibilitychange` na VOLTA** — o outro lado do gancho do `110-interacao.js`, que só trata
  a saída. Sem contexto perdido a tela continua certa, mas o bitmap em branco fica **armado**
  para o próximo restore.

**O veio da madeira ganhou gerador próprio** (mulberry32 semeado). Duas razões: repintar tem
de devolver a MESMA madeira, e os ~1.000 `Math.random()` do veio deslocariam a sequência que
as suítes de tela semeiam dentro da página — a intermitência do item 11 voltando pela porta
dos fundos. Medido: **0 sorteios globais por repintura**.

**O dublê do harness ficou para trás pela QUINTA vez** (`matchMedia`, captura de ponteiro,
`AudioContext`, `Peer`, e agora os eventos de contexto WebGL). A tentação era guardar no jogo
com `if (domElement.addEventListener)`; está errado pelo mesmo motivo de sempre.

**A suíte fecha de quebra a maior lacuna de teste do projeto:** `080-peca3d.js` não tinha
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

**Eram duas contas que não se falavam** — `090-tabuleiro.js` media o orçamento do tabuleiro em
`z = 0.4` com divisor `0.86`; `100-mao.js` apertava os assentos em `z = −3.05` com divisor
`13.5`. Que as duas dessem quase o mesmo número era coincidência aritmética, **e a
coincidência era justamente o que garantia a colisão**: folga de −0,42 em todo retrato. É a
mesma doença do item 8 ("cada caixa cabe sozinha e nenhuma pergunta pela outra"), agora em 3D.

Hoje é uma conta só: `larguraUtilDoTabuleiro` (em `060-layout.js`, **puro**) tem três tetos e
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

## Fila 8 — o resto do escopo da Fila 6 ✔ fechada (v1.9.0)

Com a Fila 7 fechada e nenhum defeito em aberto, o Ricardo escolheu as **quatro frentes de
qualidade** que a varredura de 31/07 tinha deixado à espera: acessibilidade, teclado, README
e as lacunas de teste. Nenhuma delas é defeito relatado — é a primeira release inteira feita
de trabalho que ninguém pediu porque ninguém sabia que faltava.

### 1. Acessibilidade ✔ feito

O projeto não tinha **um único** `aria-*`, `role`, `alt`, `tabindex` ou `:focus-visible`.

**A MEDIÇÃO CORRIGIU A FILA EM DUAS DIREÇÕES, e é a lição do item.** A fila mandava "subir as
opacidades de `.45–.58` para `~.72`". Medindo o contraste real contra os três fundos do jogo
(`tests/` não tem essa suíte; foi um script de uma vez só):

| a fila dizia | a medida |
|---|---|
| `.nota` está em ~4.3:1 | 4,37:1 — reprova mesmo, mas por pouco |
| subir `.45–.58` → `.72` | `.58` (o valor do `.rot`) **já passava**, com 5,4:1 |
| a linha de corte | **`.52`**, não `.72` — `.72` seria achatar a hierarquia à toa |
| só o `#onlineErro` | **sete** seletores reprovavam, cinco nunca citados |

`opacity` não escurece a cor, ela **mistura** o texto com o que está atrás — por isso o
contraste real depende do fundo. Aqui a variação entre os três fundos é de só ~0,07:1, porque
o `.painel` (`rgba .82`) é opaco o bastante para o 3D atrás quase não contar. **Isso é sorte
de projeto, não desenho:** um painel mais transparente faria o mesmo texto passar sobre
madeira escura e reprovar sobre madeira clara.

**O piso ganhou nome: `--fraco: .58`.** É a mesma lição do `baralhoDoModo()` — número solto
apodrece, número com nome e motivo escritos sobrevive. E a regra que veio junto: **toda
opacidade de texto abaixo do piso tem de ter um motivo escrito ao lado**. As quatro exceções
de hoje: o `×` separador (não é texto, é o traço entre dois placares), o botão desabilitado (o
WCAG dispensa, e aqui o apagado É a informação), e o placar de 34 px (texto grande pede 3:1,
não 4,5:1).

**Duas opacidades eram SEMÂNTICAS e mesmo assim subiram**, e vale saber por quê:
- `.doJogo` (a narração, contra a fala) — o que carrega a distinção não é o quanto a narração
  desbota, é o quanto a **fala acende**: nome em âmbar e opacidade cheia. `.58` contra `1.0`
  continua sendo 42% de diferença.
- `.zerado` (o número que já apareceu inteiro) estava em `.38` = 3,04:1. O painel de contagem
  é **ferramenta de decisão**: saber que o 5 acabou decide a jogada tanto quanto saber que
  faltam dois. Linha que não dá para ler não informa, esconde.

**`aria-live` tem uma armadilha que só aparece neste jogo.** `#vez` virou região viva, e
`desenharHUD` roda em **todo** `publicar()` — várias vezes por jogada. Atribuir `textContent`
troca o nó de texto mesmo quando a frase é idêntica, e o leitor de tela anuncia a **troca**,
não a diferença: sem guarda ele repetiria "Vez de Tião" a cada compra do bot, e a região viva
viraria o motivo de desligar o leitor. Hoje só escreve quando muda.

`#aviso` é `alert`/assertive e não polite, e a razão é o prazo: ele some em 2,2 s, então na
fila atrás da narração seria lido depois de já ter sumido. E ele é `opacity: 0` quando
escondido, **não `display: none`** — continua na árvore de acessibilidade, que é o que faz o
anúncio funcionar. Quem um dia "arrumar" isso para `display: none` mata o anúncio junto, e
não vai aparecer em foto nenhuma.

`#conversaLista` é `role="log"` e não `status`: log é a semântica de fio cronológico em que só
o que **chega** é anunciado — que é o que `porNaConversa` faz com `appendChild`.

O botão de mudo virou **🔇**. Era `✕`, o mesmo glifo do botão de sair da partida, 22 px ao
lado: dois botões com o mesmo desenho e consequências opostas.

### 2. Teclado ✔ feito

**A fila previa que "o custo real é o realce visual da peça focada no 3D". QUINTO diagnóstico
de leitura que esta base perde para um número:** o realce já existia inteiro.
`animarMao(dt, apontada)` levanta a peça apontada em `0.2` desde sempre, e ela nunca soube que
aquilo vinha de um mouse. `apontada` é só um índice.

O que precisou existir foi a **regra de dono**: `atualizarPonteiro` roda em todo quadro e
reescreve `apontada` a partir do raycast, então um cursor de teclado seria apagado no quadro
seguinte ao de nascer. Hoje **o último dispositivo que falou manda** — mexer o ponteiro larga
o teclado, teclar larga o ponteiro.

```
← →            passeia pela mão        1 … 9  pula direto e escolhe
Enter/espaço   escolhe                 Esc    cancela (já existia)
```

**As duas portas existem de propósito.** O número é o caminho rápido e é o que a fila pedia,
mas ele **para no 9 e o Duelo dá catorze peças na mão** — sem as setas, cinco peças ficariam
inalcançáveis num dos três modos da casa.

Escolher pelo teclado passa pelo **mesmo caminho do toque**, na mesma ordem (mesma peça
cancela, peça que não dá explica por quê, e só então seleciona). Um segundo caminho com regras
próprias é como as duas metades passam a discordar — foi literalmente o defeito 3 da Fila 6,
com duas cópias da regra da revanche.

**O silêncio é o defeito, não a recusa.** `selecionarPeca` desiste calada quando a peça não é
jogável; no mouse quem explica é o `soltarArrasto`. Sem a linha equivalente no teclado, apertar
o número não faria nada, para sempre, sem uma palavra — a doença que os itens 6 e 7 da Fila 5 e
a Fila 6 inteira passaram consertando.

**Um furo que só aparece olhando o ciclo inteiro:** escolher põe o foco no botão de confirmar
(é o que faz `3`+`Enter` funcionar). Se daí o jogador aperta `→`, o cursor anda e o **foco
não** — e o Enter seguinte é entregue ao navegador, que aciona o botão focado e joga a peça
**antiga**. Seta significa "voltei a passear", então ela larga o botão.

O anel de foco é `:focus-visible` e não `:focus`, e é isso que o torna indolor: o navegador só
o acende quando o foco veio de teclado. É `outline` e não `border`/`box-shadow` porque outline
não ocupa espaço — num HUD em que cada faixa tem dono (item 8 da Fila 5), mexer em caixa é caro.

### 3. README ✔ feito

Estava duas releases atrás e descrevia um jogo mais pobre do que o que está no ar. Entrou o
que faltava (conversa, dica, gaveta, reabrir a mesa, voltar para a partida, identidade no
online, teclado), o número do bot foi **conferido rodando** (55,8%, não lembrado), e o
diagrama de branches saiu da v1.1.0 para a v1.8.0.

### 4. Três lacunas de teste ✔ feito

**Cobertura de comportamento que já está CERTO não pode nascer vermelha — a prova equivalente
é MUTAÇÃO.** As três foram conferidas assim, e é o método a repetir sempre que a asserção
nova não estiver consertando nada.

- **Fim de mão em duplas.** Toda asserção de fim de mão usava `n = 2`, e com dois jogadores
  `timeDe` é a identidade: as três contas de duplas do `fecharMao` **não rodam**. Testar a
  mesa de 2 era testar o caso em que a regra some. O cenário da tranca separa as duas leituras
  de propósito — a mão mais leve da mesa é do time **perdedor**. E o empate por time só existe
  aqui: quatro somas todas diferentes e mesmo assim 14 × 14. *Mutação: `timeDe` virando
  identidade mata 9 das 12.*
- **O conteúdo do painel de contagem.** Só era testado por fora, nas suítes de tela, onde a
  pergunta é se ele cobre a mesa. O caso que a leitura de código erra: **o total não é 7
  fixo** — no Trio o `0|0` sai e o zero mora em seis peças. *Mutação: total fixo em 7, o
  filtro do `i !== vista.cadeira` e o `escapar`, os três pegos.*
- **O `<select>` de cadeira.** Tem duas metades e só uma é alcançável no harness de Node, que
  não constrói elementos a partir de `innerHTML` — o `onchange` nunca é ligado. **Isso está
  dito no teste em vez de contornado.** A metade que dá para exigir é a do defeito que a casa
  já pagou: a marca `selected` sai de uma string montada à mão (`'bot:' + c.nivel`), e se ela
  discordar de `MESA`, o jogo está certo e a tela mente — o mesmo que `refletirMesaNosBotoes`
  impede nos botões. *Mutação: `val` deixando de compor o nível mata 4.*

### O que esta fila deixou de lição

- **O dublê ficou para trás mais DUAS vezes** — sexta e sétima da série (`matchMedia`, captura
  de ponteiro, `AudioContext`, `Peer`, contexto WebGL). Faltavam `setAttribute` no elemento e
  `preventDefault` no evento. **A tentação, nas duas, era guardar no jogo** com um
  `if (b.setAttribute)`; isso troca um defeito por um ramo que o teste nunca alcança. Sete
  vezes já não é acaso: **ao acrescentar qualquer API de navegador ao jogo, o primeiro lugar
  a olhar é o `harness.mjs`.**
- **Asserção que grava a implementação reprova por ter melhorado.** A do botão de som dizia
  `=== '✕'` — e o `✕` era o próprio defeito. Trocar o glifo a derrubou. Hoje ela exige o
  requisito ("não pode ser o glifo do botão de sair"), com o valor escrito à mão e o motivo
  ao lado.
- **E eu caí na armadilha nº 1 desta casa ao escrever essa mesma asserção:** a primeira versão
  comparava com `els.get('btSair').textContent`, que no harness é `''` — `'🔇' !== ''` é verde
  por trivialidade. Comparar com um dublê vazio parece mais robusto que escrever o valor à
  mão, e é o contrário.
- **`Measure-Object -Line` do PowerShell não conta linha em branco** e devolve ~450 a menos que
  o `wc -l`. Foi por isso que a contagem de linhas pareceu ter *encolhido* depois de eu
  acrescentar código.

## Fila 9 — o que sobrava ✔ fechada (v1.10.0)

Os três itens que a Fila 8 deixou para trás. Nenhum é defeito; os três são ramos que
**nunca tinham rodado**, que é uma categoria própria: código que existe, que a tela promete,
e que nenhuma linha de teste jamais executou.

### 1. `prefers-reduced-motion` ✔ feito — CSS **e** 3D

A metade do CSS sozinha seria meia promessa, e meia promessa em acessibilidade é pior que
nenhuma: quem liga a preferência confia nela. Então foram os dois lados.

**O 3D custou DUAS LINHAS, e a razão é estrutural:** `chegarPerto` (`090-tabuleiro.js`) é a
**única** função de suavização do projeto — treze chamadas, do tabuleiro e da mão. Com a
preferência ligada ela devolve o alvo direto. E ninguém perde informação: o deslizamento
mostra o CAMINHO, e o que decide a jogada é o destino, que continua onde estava.

A outra linha é a lâmpada (`160-loop.js`), e ela era o pior item do jogo para sensibilidade
vestibular — o único movimento que **não acaba nunca**: não depende de jogada nem de vez,
enquanto a aba estiver aberta a luz oscila. Parada, o boteco continua de pé; a luz fica
quente e baixa, só não pulsa.

**A `MediaQueryList` é consultada UMA VEZ e guardada** (`010-constantes.js`). Ela é viva — o
`.matches` acompanha o sistema —, então guardá-la custa uma alocação em vez de sessenta por
segundo, e continua respondendo se a pessoa mudar a preferência com o jogo aberto, sem
listener nenhum.

**No CSS as transições viram `0.01ms`, não `none`.** Código que espera por
`transitionend`/`animationend` nunca é avisado quando a transição deixa de existir. Não há
nenhum hoje — e é exatamente por isso que a hora de escrever assim é agora. E o `transform`
do `#confirmar` e do `#aviso` fica de FORA da anulação: aqueles dois são centrados por
`translate(-50%)`, e zerar o transform os joga meia largura para fora da tela. Mesma
armadilha do item 10 da Fila 5, e ela volta sempre que alguém mexe em movimento sem olhar
quem usava o transform para POSIÇÃO.

### 2. O prazo de 30 s, esgotando ✔ feito

Havia asserção de cair e **voltar**; não havia de cair e **não voltar** — que é o ramo que
faz o prazo significar alguma coisa. Sem ele, "a cadeira fica guardada por 30 s" seria
promessa sem consequência, e fechar a aba voltaria a ser a saída de emergência de qualquer
partida perdida.

**E não custou 30 segundos.** `sentar` e `largar` são funções comuns no escopo concatenado:
dá para dirigi-las com uma `conn` de mentira, em Node, onde o `setTimeout` do harness é uma
fila que o teste drena com `correrTimers()`. O relógio de parede nunca entra. O encanamento
de PeerJS à volta delas continua sendo do `test-online`, com abas de verdade — a divisão é
*lógica no Node, sessão no Chrome*.

**A mutação revelou que o jogo tem DOIS guardas independentes** para "voltou a tempo": o
`clearTimeout` no `sentar` e um `conexoes.has(cadeira)` dentro do próprio callback.
Desligando o primeiro, só a asserção do `esperando` reprova — o desfecho continua certo.
Isso está escrito no teste, porque uma asserção que **não** distingue precisa dizer por quê,
senão o próximo a ler acha que ela é fraca.

### 3. A compra voluntária ✔ feito

A lacuna mais curiosa do projeto: a regra existe no menu, é persistida, é validada, aparece
na tela — e o ramo **nunca rodava**, porque o bot não compra tendo jogada e todas as
partidas de teste são bot×bot. Uma regra da casa que talvez não funcionasse, e ninguém
saberia. Hoje está exercitada: a oferta com e sem a regra, a compra que **não passa a vez**
(comprar e perder a vez seria castigo, não opção), o monte esgotando, e o fato de que o bot
não compra — afirmado de propósito, porque se um dia ele passar a comprar, as milhares de
mãos bot×bot mudam de comprimento e a força medida anda junto.

### 4. O `<select>` de cadeira, a metade que grava ✔ feito

A Fila 8 cobriu o que o menu **desenha** e disse de frente que o `onchange` ficava de fora
(o harness de Node não constrói elementos a partir de `innerHTML`). Foi para o
`test-online.mjs`, onde há DOM de verdade, e o que se exige é a **ida e volta**: o valor que
o menu escreveu na opção tem de ser o mesmo que o `onchange` sabe destrinchar. As duas
pontas são strings montadas à mão (`'bot:' + nivel` de um lado, `split(':')` do outro), e
string montada à mão em dois lugares é como duas metades passam a discordar em silêncio.
`dispatchEvent` e não `sel.onchange()` na mão: o que se quer saber é se o handler está
**ligado ao elemento**.

### 5. A compra livre deixou de ser prometida onde não há monte ✔ feito

Veio da lista de "poderia ser feito, mas não recomendo agora" — e ficou barato justamente
por ter testado a regra no item 3: com a compra voluntária exercitada, ficou evidente que o
botão continuava aceso no Duelo, no Trio e no Clássico de 4, prometendo o que `acoesDe`
descarta em silêncio. A espécie de defeito que o `refletirMesaNosBotoes` existe para
impedir: **o jogo está certo e a tela mente.**

**"Modo com monte" NÃO EXISTE, e é o que a leitura apressada erra:** o Clássico tem monte
com 2 ou 3 jogadores e **nenhum** com 4 — a mesa de 4 esgota o baralho igualzinho ao Duelo
e ao Trio. Por isso a pergunta leva o `n` junto e por isso ela **não** é uma propriedade da
tabela `MODOS`. Quem responde é `sobraDoBaralho(modo, n)`, em `020-baralho.js`, pelo motivo
de sempre: aritmética de baralho escrita à mão no menu já quebrou uma vez (`28 - 7 * MESA.n`).

O botão desabilitado ganhou uma nota ao lado dizendo **por que** não dá — botão apagado sem
explicação é o jogo emudecendo. E a preferência guardada **não** é apagada: quem joga
Clássico de 2 com compra livre e espia o Duelo espera a marca de volta ao voltar; o motor
ignora o valor onde não há monte, então guardá-lo não custa nada.

### O que esta fila deixou de lição

- **Teste novo que MEXE no estado da página derruba o teste velho, e parece defeito no
  jogo.** As cenas do `test-online.mjs` compartilham a mesma aba viva, e `MESA` é global:
  as asserções novas do `<select>` e da compra livre percorriam os cinco modos e deixavam a
  mesa no Trio com a cadeira 1 virada em bot. A cena seguinte monta uma **mesa de 4 em
  duplas** — sem duplas, o canal da dupla vira canal geral, e reprovou com *"A FALA DA
  DUPLA VAZOU"*, que é a asserção mais assustadora do arquivo. É a mesma lição do
  `localStorage` entre as cenas do `test-telas`, noutro meio: **cada cena diz o que quer, e
  devolve como encontrou.**
- **`catch` que transforma falha de rede em aviso engole defeito de verdade — e o recado
  tranquilizador é o que faz ninguém olhar.** Um `j.ajustarCompraAoModo is not a function`
  (nome novo que a ponte do `160-loop.js` não expunha) saiu do `test-online` com o texto "o
  broker gratuito do PeerJS ou a sua rede não deixaram a conexão fechar", com a rede ótima.
  Hoje `TypeError` e `ReferenceError` são reprovação com stack, não aviso: **rede não
  produz nenhum dos dois.**
- **Não rode duas suítes de Puppeteer ao mesmo tempo.** Um `Navigation timeout of 45000 ms`
  no `test-online` foi contenção de CPU criada por uma rodada do `test-telas` em paralelo, e
  o recado de erro apontou para o broker do PeerJS. Antes de culpar a rede, elimine a
  disputa que você mesmo criou.
- **Asserção-guarda de "o dublê entregou alguma coisa?" vale o seu peso.** A tabela da compra
  livre foi escrita primeiro no `test-jogo`, onde `querySelectorAll` devolve `[]` — e sem a
  guarda, `[].some(...)` é `false`, então os três casos que esperavam `false` PASSARIAM e só
  os dois de `true` falhariam. Meio-verde confuso em vez de "o dublê não entregou os botões".
  Toda asserção sobre uma COLEÇÃO deve primeiro exigir que a coleção não esteja vazia.
- **Asserção que LANÇA em vez de reprovar trunca a suíte, e a checagem por mutação passa a
  sub-relatar.** `chave(undefined)` matou o processo no meio da conferência da compra
  voluntária: apareceram 4 vermelhas onde havia 7, e por um momento pareceu que as
  asserções não cobriam o ramo. Quando uma mutação reprovar *menos* do que devia, a
  primeira suspeita é que a suíte morreu antes do fim.
- **Medir "parou de se mexer" logo depois de mandar parar mede a PRÓPRIA parada.** A
  primeira asserção da lâmpada comparava o brilho antes e depois de ligar a preferência, e
  pegava a transição do valor oscilante para o valor fixo — uma diferença real que não é
  oscilação. Precisa de um quadro para o novo regime começar.
- **Função de teste que GASTA quadros não pode ser chamada dentro da mensagem de erro.** O
  `oscila()` aparecia na condição e no texto, e as duas chamadas mediam intervalos
  diferentes: a mensagem contava uma história e a reprovação, outra.
- **Dublê que responde SEMPRE a mesma coisa é tão incompleto quanto dublê sem método.**
  Oitava vez da série. O `matchMedia` do harness devolvia `matches: false` fixo, o que é o
  padrão certo para as media queries de tela — e vira buraco no instante em que o jogo
  pergunta por uma **preferência**, porque aí o ramo ligado fica inalcançável. Hoje há
  `preferir(consulta, ligada)`, e a consulta tem de bater LITERALMENTE com a do jogo: se
  alguém trocá-la, o teste fica vermelho em vez de continuar verde testando um mundo que
  não existe mais.

## Fila 10 — os três defeitos de campo de 03/08/2026 ✔ fechada (v2.0.0)

Uma foto de celular (mesa de Duelo online, 19:37) e três relatos, todos de jogo de verdade.
A fila tinha esvaziado na v1.10.0; encheu de novo pela fonte que o próprio arquivo aponta
como a mais barata — **jogar**.

**A foto é a prova mais direta que este projeto já teve de um defeito:** o placar diz
`Você × Você`, os dois cartões dizem "Você", e as cinco linhas da conversa começam com
"Você" — incluindo a linha em que o Ricardo escreve *"uma coisa q preciso é mudar esses
nomes"*. O defeito e o pedido estão na mesma imagem.

#### O que mudou, por arquivo

| arquivo | o que entrou |
|---|---|
| `css/estilo.css` | `.carta { margin: auto }` e as safe-areas no `.tela` (dois blocos: o normal e o de tela pequena) |
| `src/pagina.html` | o campo `#onlineNome` no saguão |
| `src/js/140-menu.js` | `NOMES` sem "Você"; a migração do "Você" gravado; `vagaOnline` zerada no `<select>` e no literal do `mesaLembrada` |
| `src/js/150-rede.js` | `nomeUnico`/`nomesVizinhos`, `vagaDeVisita`, `porQueNaoSentou`, `RECUSA`, `largarAMesa`, `deixandoAMesa`, `desistiuDaMesa` (extraída), o `sentar` reconvertendo a vaga, o campo de nome revelado/escondido nas três telas |
| `src/js/160-loop.js` | `c.vagaOnline = true` na conversão do `comecarLocal`; o ramo convidado do `sairDaPartida` virou `largarAMesa()` |
| `tests/test-jogo.mjs` | `novaConn` com `open`, `montarMesaOnline` içada e partindo de partida viva, 12 asserções do voltar e 6 do desempate |
| `tests/test-telas.mjs` | cena `menu` (`soTela`), `semGuardado`/`menuCheio`, a medida de topo alcançável, o `V` vindo do `THREE` |
| `tests/test-online.mjs` | cenas `nomes` e `voltar`; o `exit(0)` do aviso de rede deixou de engolir falha |
| `tests/test-lembrar.mjs` | a migração do "Você" gravado, provada por mutação |

**Fechou em 04/08/2026** com o corpo de `nomeUnico()`, que era a última peça. A onda saiu na
tag `v2.0.0`, e o `tests/test-jogo.mjs` ganhou mais 4 asserções junto do conserto (o
sobrenome que sai inteiro, a estabilidade entre chamadas, e a colisão que o corte fabrica).

### 1. Todo mundo se chama "Você" ✔ feito

`NOMES[0]` era literalmente `'Você'` (`140-menu.js`), e é dele que sai o nome que o convidado
manda ao anfitrião (`{t:'ola'}`). Os dois lados liam o mesmo literal.

**São TRÊS medidas, e nenhuma sozinha resolve** — o que só ficou claro ao medir:

- **Trocar `NOMES[0]` não conserta o online.** Os dois lados leem o mesmo literal, então
  `Você × Você` viraria `Careca × Careca`. Ela conserta a SEMÂNTICA: o campo guarda um nome,
  e nome existe para os outros. Quem é você já está dito em dois lugares que não dependem do
  nome — o rótulo da cadeira no menu e a etiqueta "você" do cartão.
- **A migração é obrigatória, não acessório.** `lembrarMesa()` persiste as quatro cadeiras
  assim que alguém encosta no menu, então quem já jogou uma vez tem `'Você'` gravado e o
  padrão novo nunca chegaria até ele: o conserto seria invisível **justamente para quem
  jogou o bastante para se incomodar**. `mesaLembrada()` migra só a cadeira 0 — nas outras
  "Você" nunca foi padrão, logo ali ele só pode ter sido escolhido.
- **O campo `#onlineNome`** é a única das três que deixa a pessoa DIZER quem é. Não inventa
  caminho: torna visível e editável o nome que já viajava calado.
- **O desempate no anfitrião** é a rede embaixo das outras duas: duas pessoas podem
  legitimamente digitar "Ricardo", e duas que não digitaram nada chegam com o mesmo padrão.
  Ele mora no anfitrião porque ele é o único que vê as duas — e **não** se estende às
  cadeiras locais do menu, onde a pessoa digitou os dois nomes e vê os dois na mesma tela.
  A colisão que se desempata é a **invisível para quem a causou**.

**Sem sorteio de nome, e o motivo é de teste:** `Math.random()` no topo do `140-menu.js` roda
antes de qualquer `semear()` e desloca o embaralho de todas as cenas de tela. É a armadilha
que este arquivo já registra duas vezes (a receita do `pintar()`, o `performance.now()`).

**O número do desempate vai no PRIMEIRO nome** — `"Ricardo2 Neves"`, nunca
`"Ricardo Neves 2"`: `nomeEmPartes` corta na PALAVRA em tela estreita, e o sufixo no fim
sumiria justamente no retrato de quatro cartões, que é onde a confusão dói. E **quem encolhe
para caber nos 14 é a base, nunca o desempate** — sufixo comido pelo corte devolve dois
nomes iguais, que é o defeito de volta em silêncio.

**O corpo de `nomeUnico()` ✔ feito (04/08/2026)** — era o último item aberto da fila, e o
`TODO(Ricardo)` saiu junto. O contrato de sempre está no comentário da função; o que a
implementação acrescentou, e que a fila não previa, foi isto:

- **A DECISÃO QUE FALTAVA, e nenhuma leitura de código chega a ela** (escolha do Ricardo,
  04/08): quando `primeiro + número + sobrenome` estoura os 14, **o sobrenome sai INTEIRO**
  — nada de palavra cortada pela metade. `"Maria Fernanda"` duplicado vira **`"Maria2"`**,
  não `"Maria2 Fernand"`. O primeiro nome só cede quando ele sozinho, com o número, ainda
  não cabe (`"Sebastiãozinho"` → `"Sebastiãozinh2"`) — aí não há mais nada para ceder. O
  motivo é o mesmo do número ir no primeiro nome: em tela estreita o cartão mostra **só** o
  primeiro nome, então o pedaço que sobra tem de ser um nome de gente, e não um toco.
- **A CONFERÊNCIA VEM DEPOIS DO CORTE, e é o ponto todo.** O desenho ingênuo — escolher o
  número olhando o nome inteiro e só então cortar em 14 — deixa passar a colisão que o
  **próprio encolhimento** cria: com `"Sebastiãozinh2"` já sentado, o `"Sebastiãozinho"` que
  chega vira `"Sebastiãozinho2"`, que cortado em 14 é `"Sebastiãozinh2"` de novo. Dois nomes
  iguais, e em silêncio. É a mesma família do "sufixo comido pelo corte", por outra porta:
  ali morria o sufixo, aqui é a BASE encurtada que bate num terceiro. **Qualquer variante que
  separe "escolher o número" de "cortar em 14" reabre isto.**
- **A chave normaliza `NFC` e colapsa espaço**, e não é preciosismo: o mesmo "Zé" chega
  composto no Windows e decomposto no iPhone — dois códigos para a MESMA letra passam batidos
  por comparação crua, e a mesa fica com dois "Zé". O `\s` pega de quebra o espaço-duro que
  vem colado quando se copia um nome de aplicativo de conversa.
- **O laço acaba por conta, e não por sorte:** vai até `tomados.size + 1`, e n+1 nomes
  distintos não cabem em n chaves ocupadas. Nada de teto mágico.
- **É estável entre chamadas**, o que importa porque `nomeUnico` reentra a cada `{t:'nome'}`
  e não só ao sentar. Funciona porque `nomesVizinhos` exclui a própria cadeira — quem a
  "simplificar" para passar a mesa toda cria um ratchet `Ricardo2 → Ricardo22 → Ricardo222`
  que só aparece na **segunda** troca de nome. Há asserção.
- **Dívida registrada e NÃO consertada:** o que sustenta a comparação é o invariante "todo
  nome na mesa cabe em 14" — um ocupado mais comprido nunca seria igual a candidato nenhum e
  escaparia do desempate. Os cinco lugares que escrevem nome cortam em 14, então hoje é
  teórico. O bilhete está no comentário do `nomesVizinhos`, para quem acrescentar um sexto.

O contrato, que é o que as asserções cobram:

```
nomeUnico('Zé', ['Tião'])              → 'Zé'          (não colide: não muda)
nomeUnico('Zé', ['Zé'])                → 'Zé2'
nomeUnico('Zé', ['Zé', 'Zé2'])         → 'Zé3'         (pula o que já existe)
nomeUnico('Ana Paula', ['Ana Paula'])  → 'Ana2 Paula'  (no PRIMEIRO nome)
nomeUnico('Maria Fernanda', [idem])    → 'Maria2'      (o sobrenome sai inteiro)
'ricardo' colide com 'Ricardo '                        (caixa e espaço não fazem duas pessoas)
'Sebastiãozinho' (14) duplicado ainda cabe em 14 e sai diferente do original
```

### 2. A tela inicial não voltava ao topo ✔ feito

Rolar as regras para baixo e não conseguir subir de volta. **Uma linha de CSS, e o
diagnóstico não precisou de hipótese:** `.tela` é um scroller (`overflow: auto`) que centra
pelo `align-items: center`, e `.carta` não tinha `margin: auto`. Conteúdo mais alto que o
contêiner, num flex centrado, transborda para os DOIS lados — e a área rolável de um
scroller se estende para o FIM, não para o começo: `scrollTop: 0` já é o mais alto que a
rolagem vai. Medido em 640×360: **489 px de carta acima do alcance**.

`margin: auto` resolve porque as duas pontas do flexbox se comportam diferente conforme o
sinal da folga — sobrando espaço as margens o dividem (o centro de sempre), faltando espaço
elas resolvem para zero e a carta encosta no começo do scroller. **Não `align-items: safe
center`**, que faz o mesmo e é a ferramenta desenhada para isto: declaração não suportada é
descartada INTEIRA, então onde ela não existe o `align-items` cai para `stretch` — precisaria
de duas linhas em cascata e ainda assim com suporte pior. **Não `flex-start`**, que perde o
centro vertical no monitor grande.

**Vale para as SETE telas** que compartilham `.tela`/`.carta`, e as safe-areas entraram
junto: era a única família de painel do projeto sem `--seg-*`, com `viewport-fit=cover`.

**A suíte era cega por três motivos somados:** nenhuma das dez cenas mostrava tela (todas
começam com `mesa()`), a lista de painéis medidos não inclui `.tela`/`.carta`, e a única
medida de transbordo é horizontal e sai do `documentElement` — cega para `position: fixed`,
que é a cegueira que o próprio arquivo já documentava duas vezes.

### 3. O convidado saía e não conseguia voltar ✔ feito

**Eram DOIS defeitos somados num sintoma só**, e é o que a investigação corrigiu no
diagnóstico — os dois reprovam em caminhos diferentes:

| caminho | o que quebrava |
|---|---|
| o anfitrião **não** deu revanche | ele não tinha mais o CÓDIGO; e se digitasse de memória, caía na tela da derrota que já tinha aceitado |
| o anfitrião **deu** revanche | a cadeira dele virou bot **para sempre**, e a mesa respondia *"Essa mesa já está cheia"* — mentira, com um bot improvisado sentado na vaga |

**A mudança de fundo: guardar o CÓDIGO ≠ guardar a CADEIRA.** Sair entrega a *partida*, não
a *mesa*. A cadeira deixa de ser sua na hora (é o que impede sair de virar saída de
emergência barata, e a derrota continua registrada); o código continua guardado, para a
próxima. O `esquecer('sala')` fechava as **três** portas de volta de uma vez — painel do
HUD, botão do menu e campo pré-preenchido —, e as três voltaram de graça ao parar de apagar:
**três sintomas, uma causa, uma linha.**

**A cadeira que virou bot volta a ser de gente.** A conversão do `comecarLocal` **fica** —
ela conserta o defeito 3 da Fila 6, e sem ela a revanche nasce esperando quem não responde.
O que faltava era MEMÓRIA: `c.vagaOnline = true` no instante da conversão, e o `sentar()`
reconverte. A marca separa "bot que a mesa escolheu" de "bot que a mesa improvisou por falta
de gente" — um "Bot · difícil" posto de propósito continua fechado a quem tem o código.

**Reconverter nos DOIS lugares.** `MESA.cadeiras` é o que o próximo `sentar` e o
`comecarLocal` consultam; `P.cadeiras` é o que `seguirOTurno` lê — e enquanto ele disser
'bot', o relógio continua jogando por cima da pessoa que acabou de sentar. Dois donos para a
mesma vez. Vale para o ramo 1 do `sentar` também, e não só para o 2: se o `desisto` se
perdeu, a cadeira ainda é dele **e** já virou bot pela revanche.

**Assumir a cadeira no meio da mão é legítimo por desenho** — invariante 2, "o motor não sabe
a diferença". A cadeira nunca parou de jogar, só trocou de quem responde: ele recebe a mão
que o bot deixou e a vez onde ela estiver, e a mesa é avisada por narração.

**A folga de 400 ms antes do `encerrarRede`**, igual à do ramo do anfitrião e pelo mesmo
motivo escrito lá: `peer.destroy()` aborta o que ainda não saiu do SCTP, e o que não saiu é
justamente o `desisto`. Ela vem com `deixandoAMesa`, que resolve três coisas de uma vez —
ignora a vista do abandono que chegaria na janela (senão ela arranca o jogador do menu de
volta para a derrota), cala o "A mesa fechou" (falso: quem fechou foi ele) e impede o
temporizador atrasado de matar um peer NOVO.

**O `desisto` derruba a conexão junto, e isto não estava previsto.** Ele é sinal mais forte
que o `close`: DIZ que a pessoa saiu, enquanto o outro é o link caindo — e entre um e outro
há o tempo de o peer morrer. Nessa janela `conexoes` ainda apontava para quem não existe
mais, e o anfitrião que clicasse Revanche depressa montava a partida com a cadeira ainda
`online`: **a mesa nasce esperando quem não vai responder**, que é o defeito 3 da Fila 6
entrando por outra porta. Foi a cena de navegador que achou isso, não a leitura.

**Partida acabada não é publicada para quem acaba de sentar.** Sem vista o convidado não sai
da `telaOnline` (é o `t:'vista'` que chama `esconderTelas()`), e o saguão é exatamente o
lugar de quem chega entre duas partidas. Correção de diagnóstico: ele **não** ficava sem
botão na tela de fim — o "Trocar a mesa" está lá; o defeito era reoferecer a derrota que ele
já tinha aceitado.

**Três motivos de recusa em vez de um.** `cheio`, `guardadas` e `semvaga` — o campo é novo
dentro da mensagem de sempre, então convidado antigo cai no texto padrão. Recusar estava
certo nos três casos; mentir o motivo é o que faz quem tentou desistir de tentar de novo.

**Limite conhecido, registrado de propósito:** a marca `vagaOnline` é de sessão e **não** é
persistida (vinda do armazenamento ela abriria ao primeiro estranho com o código uma cadeira
que o dono fechou). Logo, o anfitrião que RECARREGA e reabre uma mesa cuja cadeira já virara
bot não a oferece mais a quem **desistiu** — quem apenas **caiu** continua coberto, porque
`donoDaCadeira` é guardado e o ramo 1 do `sentar` acha a cadeira independente do tipo.
Fechar esse canto exigiria a marca dentro de `P.cadeiras`, que é dado guardado e portanto
entrada de fora com validação própria. Custo maior que o caso.

### O que esta fila deixou de lição

- **O DUBLÊ FICOU PARA TRÁS PELA NONA VEZ**, e desta vez foi o dublê do PRÓPRIO teste, não o
  do harness: a `conn` de mentira do `test-jogo` não tinha `open`, e `espalharVistas`
  confere `conn.open` antes de mandar. A asserção "não mandaram a partida acabada para quem
  acabou de sentar" era **verde por trivialidade** — o dublê recebia o `sentou` (mandado
  direto na conn) e nunca uma vista. Quem contou foi a conferência por mutação, que reprovou
  MENOS do que devia. A série continua: `matchMedia`, captura de ponteiro, `AudioContext`,
  `Peer`, contexto WebGL, `setAttribute`, `preventDefault`, `matchMedia` de novo, `conn.open`.
- **O `exit(0)` do aviso de rede engolia asserção já reprovada.** Uma rodada do `test-online`
  que imprimiu quatro `✗` saía com código ZERO porque uma espera estourou depois. O arquivo
  já registrava essa doença para `TypeError`/`ReferenceError`; faltava o degrau final —
  **o caminho que existe para perdoar a REDE estava perdoando o JOGO.** Hoje falha anterior
  a um aviso reprova a rodada.
- **Mutação que reprova MENOS do que devia é sintoma, não sorte.** TRÊS vezes nesta fila: a
  do `conn.open` acima; uma em que a mutação MATOU o processo (`mostrarFimDeMao` com
  `resultado` nulo) e a suíte inteira saiu sem contar asserção nenhuma; e a terceira, em
  04/08 — ver abaixo. As três confirmam a regra que a Fila 9 escreveu.
- **MUTAÇÃO QUE NÃO CHEGA A SER APLICADA SAI VERDE, e verde é exatamente a resposta errada.**
  Ao conferir o `nomeUnico`, duas mutações de várias linhas foram "aplicadas" por um
  `String.replace` cujo texto de busca tinha `\n` — e **os arquivos deste repositório são
  CRLF**. O casamento falhou, o arquivo ficou intacto, a suíte passou, e por um momento
  pareceu que a asserção não cobria o ramo. É a doença do "reprova menos do que devia" com
  uma causa nova: não é a suíte que morre, é a mutação que nunca nasce. **Toda mutação por
  script tem de EXIGIR que o casamento aconteceu** (contar as ocorrências e estourar se não
  for exatamente uma) antes de rodar coisa nenhuma — sem isso, "tudo certo" é indistinguível
  de "não mexi em nada". Refeitas com essa guarda, as cinco mutações mataram uma asserção
  cada, e cada uma a sua.
- **Heredoc de script com acento no literal chega corrompido.** Um `python - <<'PY'` com
  strings em português foi lido como latin-1 e as buscas nunca casaram. Para editar texto
  acentuado, a ferramenta de edição direta; para script, o arquivo em disco.
- **Cena de teste que mexe em estado compartilhado derruba a seguinte — de novo, e num
  arranjo novo.** O bloco do prazo deixava `P.fase = 'fim'` posto à mão (um estado que o jogo
  não produz: fim sem resultado e sem desistente), e a montagem do bloco seguinte estourava
  dentro do HUD, longe de onde a causa estava. A montagem passou a começar de uma partida
  viva. Terceira vez desta lição, em três meios diferentes: `localStorage` das telas, `MESA`
  do online, `P` do harness.
- **Pegar o tipo de um objeto que pode não existir é armadilha.** O `test-telas` tirava o
  `Vector3` de `naMao[0].obj.position.constructor` — e a primeira cena SEM partida derrubou a
  medida inteira com um "V is not a constructor" que não fala de mão nenhuma. A ponte já
  expõe o `THREE`.
- **Asserção que não pode falhar é decoração com cara de cobertura.** A primeira versão da
  asserção da rolagem media se o FIM da carta era alcançável — e ela passa nos dois mundos,
  porque o defeito clássico é só na ponta de cima. Trocada por "a tela transborda e não
  rola", que pega o caso real (`overflow: hidden` continua rolável **por script**: um
  `scrollTop = n` funciona nele, e por isso as medidas de alcance passavam numa tela que o
  dedo não move um pixel).
- **Exigir que a cena tenha O QUE MEDIR é asserção, e ela é global aqui.** A carta com as
  regras abertas cabe inteira no tablet de 1180 px de altura — exigir transbordo tela a tela
  reprovaria o tablet por um defeito que não existe; exigir zero deixaria a asserção virar
  decoração no dia em que a carta encolher. O rodapé cobra `mediu > 0` no conjunto.

## Fila 11 — a varredura de 04/08/2026 ✔ fechada (v2.2.0)

**Fechada em 05/08/2026.** Os sete confirmados, mais as suspeitas S1, S3, S4 e S5 que o
Ricardo mandou levar junto — e **dois defeitos que só apareceram ao consertar os outros**.
Cada conserto com asserção vermelha antes; onde a asserção nasceu depois do conserto, a prova
foi por **mutação**.

### O que a implementação corrigiu no diagnóstico desta própria fila

Três coisas escritas aqui embaixo estavam erradas, e valem mais que os consertos:

| o que esta fila dizia | o que era |
|---|---|
| `aplicarIntencao` e `atualizarVista` em `040-partida.js` | estão em **`160-loop.js:152`** e **`:91`** |
| "escrever a cena que dirige o `conn.on('data')`" | **aquele código era inalcançável do Node** — o dublê `Peer` tinha `on() { return this; }`. A cena não era escrevível como anotado |
| C2: bastava consertar a guarda `modo !== 'convidado'` | checar `modo` **nunca poderia** funcionar: `conectarNaMesa:615` repõe `modo`. Precisava de identidade da tentativa |

**Oitavo diagnóstico de leitura que esta base perde para a medição.**

### Os dois defeitos que só apareceram consertando

- **A QUARTA CABEÇA DA HIDRA**, em `160-loop.js`: `setTimeout(encerrarRede, 400)`, sem dono e
  sem guarda, chamando `encerrarRede` incondicionalmente. Abrir outra mesa nesses 400 ms
  destruía o peer que acabou de nascer. Não estava na fila porque a varredura procurou os
  `setTimeout` de `150-rede.js`.
- **`ULTIMO_NOME` não era limpo no `encerrarRede`** — nasceu com o conserto do C4, e é da
  família de `conexoes`/`esperando`/`donoDaCadeira`, que já eram limpos. Chaveado por
  CADEIRA: a cadeira 1 de uma mesa nova é outra pessoa, e herdava o relógio de quem sentou
  ali antes, levando um limite de frequência de graça no primeiro nome que mandasse.

E **duas portas que criam peer sem passar pelo `encerrarRede`**, que o desenho inicial não
previa e sem as quais o conserto ficaria pela metade: **"Começar a partida"** (a única saída
da tela de reabertura que não passa por lá) e o **botão Entrar da tela "A mesa caiu"**, que
fica clicável porque o `close` destrava antes de agendar a volta.

### O que a conferência por mutação ensinou aqui

- **Duas camadas se cobrem, e isso não é asserção fraca — é o desenho.** Removendo só o
  `clearTimeout` **ou** só a guarda de geração, a suíte continua verde: a irmã segura o caso.
  A prova honesta é mutar o **par** (C1 cai com 3 falhas, C2 com 2), e isso está escrito no
  teste para quem mexer numa camada não concluir que ela é inútil.
- **A mutação cobrou duas asserções que faltavam.** O bump do `conectarNaMesa` e o corte de
  tamanho do nome estavam **sem prova nenhuma** — o primeiro porque a cena entrava sempre
  pela porta que já cancela o timer, o segundo porque o limite de frequência mascarava
  (só 1 das 20 mensagens era processada). Guarda sem asserção é código que ninguém prova.
- **A guarda de casamento provou o próprio valor**: uma das mutações usou `\n` num arquivo
  CRLF, não casou, e foi **reportada como não aplicada** em vez de passar por verde.

### Duas armadilhas pagas ao escrever as cenas

- **Asserção de TEMPO mediria o DUBLÊ, não o jogo.** O custo real do C4 é o `publicar()`
  gravando a partida no `localStorage` a cada mensagem — e o harness dubla o `localStorage`.
  Medido: os 20 nomes de 4 MB custam **382 ms** em Node contra os ~9 s do navegador. Trocada
  pela **amplificação** (quantas publicações a rajada gera), que é determinística.
- **O bloco do C3 nasceu VERDE.** `acoesDe` devolve `jogadas: []` fora da vez **e** quando a
  peça obrigatória não está na mão, e aí o `.some` de `jogar` curto-circuita antes de chegar
  em `mesmaPeca` — seis asserções verdes sem ter exercitado nada. A guarda de montagem passou
  a exigir **jogada válida**, que é a única forma de afirmar que o ramo perigoso rodou.

### O que ficou de ferramenta

- **O dublê `Peer` grava os ouvintes** e o teste é quem dispara — com `Peer.ultimo` e
  `Peer.todos`. Continua não disparando nada sozinho, que é o que preserva a intenção
  original ("abre e não fala") e garante que nenhuma suíte existente mudou de comportamento.
- **O lado CONVIDADO do fio ficou alcançável** (`linkAnfitriao.on('data')`, aninhado em dois
  callbacks do PeerJS). Ele não tinha uma linha de teste.
- **`{t:'erro'}` no protocolo** (S3), para a recusa deixar de morrer calada.

<details><summary>o texto original da fila, de quando estava aberta</summary>

## Fila 11 — a varredura de 04/08/2026

Pedido do Ricardo depois de a v2.0.0 subir: *"valide tudo para mim, procure por erros ou
melhorias, e anote, principalmente no CLAUDE.md, assim outro dia você consegue pegar o
contexto todo e arrumar."* É a segunda varredura da história do projeto (a primeira deu a
Fila 6), e a maior.

**NADA AQUI FOI CONSERTADO — foi decisão dele nesta rodada: anotar agora, decidir depois.**
Esta fila é a lista de trabalho da próxima sessão, em ordem de valor.

**Todos os seis CONFIRMADOS foram REPRODUZIDOS rodando o código** em Node contra
`tests/built-jogo.mjs`, com a saída registrada — nenhum é hipótese de leitura. A distinção
importa porque este arquivo já registra que leitura erra muito aqui (3 dos 11 itens da Fila 5
e 2 dos 5 da Fila 6 tinham diagnóstico errado escrito antes de alguém medir).

### A ordem recomendada, e por quê

| | o quê | por quê agora |
|---|---|---|
| 1º | **C1** e **C2** | é o que um jogador encontra **sozinho**, sem ninguém agir de má-fé |
| 2º | **C4** | é **abuso**: um convidado congela a mesa de todos de propósito, com uma linha |
| 3º | **C6** | execução de script na máquina dos convidados. Improvável e de consequência máxima |
| 4º | **C5**, **C3**, C7 | guardas de entrada; baratos, e o C5 é tela preta permanente |
| depois | a reorganização, e só então o PWA e o truco | ver as seções próprias, abaixo |

**Três deles são uma linha de guarda cada.** Nenhum é caro perto do que custa.

### C1 · o jogo se reabre sozinho depois de você clicar "Voltar" ⚠ ABERTO

`150-rede.js:185-190`. O `setTimeout` da reabertura de mesa **não guarda o handle**,
`encerrarRede()` não o cancela (ele limpa `esperando`, que é outro mapa) e o callback **não
confere nada** ao disparar. Compare com o irmão `voltarSozinho` (`:719`), que começa com
`if (modo !== 'convidado') return;`. **A assimetria é o defeito.**

Reproduzido: você é anfitrião, recarrega, clica "Reabrir a sua mesa ABCD", vê
`Reservando o código ABCD… (1/6)`, desiste e clica "Voltar" → menu. **1,5 s depois**, sem
tocar em nada, o menu some e você cai numa partida antiga. A vez passa para uma cadeira
`online` que nunca responde, porque `retomarComoAnfitriao` rodou com `modo === 'local'`:
`espalharVistas()` está atrás de `if (modo === 'anfitriao')` e nunca roda. **Mesa parada, sem
mensagem e sem botão** — é o defeito 3 da Fila 6 entrando pela **quinta** porta. E sobra um
peer VIVO reivindicando `dominobar-ABCD`: quem tiver o código senta, recebe `{t:'sentou'}` e
**nunca recebe uma vista**.

Variante: clicando "Sentar e jogar" em vez de "Voltar", o temporizador acorda depois e
**sobrescreve o `peer` global**, vazando o que acabou de ser criado.

**O conserto:** guardar o handle e cancelá-lo no `encerrarRede`, **e** pôr a guarda no
disparo — as duas, porque o item 7 da Fila 5 já ensinou que limiar sozinho não basta.
**O teste que tem de ficar vermelho antes:** clicar Voltar durante a reserva e drenar os
timers; nenhum peer novo pode nascer.

### C2 · o convidado que troca de mesa fica sem conexão, e a tela mente ⚠ ABERTO

`150-rede.js:711-727`. O comentário diz `// desistiu no meio, ou entrou noutra mesa` e a
guarda `if (modo !== 'convidado') return` **não cobre o segundo caso** — quem entrou noutra
mesa também é `'convidado'`. **Comentário que descreve uma proteção que a linha não dá.**

E a ordem é fatal: `encerrarRede()` roda **antes** de `conectarNaMesa`, que então bate no
`if (conectando) return` (`:607`) e desiste calada.

Reproduzido: a mesa AAAA cai, aparece `Tentando voltar… (1/8)`, e nos **4 s** seguintes você
entra na mesa BBBB. O temporizador da AAAA acorda e mata a BBBB. Resultado: **zero peers**,
tela dizendo `Conectado. Esperando o anfitrião começar…` — mentira —, botão `Entrando…`
`disabled` **para sempre**. Cliques seguintes não fazem nada.

É a família dos itens 6 e 7 da Fila 5 na forma pura: `conectando` é um `if (x) return` cujo
`x` ninguém zera nesse caminho. `conectando` e `pararDeConectar` **não aparecem em nenhum
teste**.

### C4 · um convidado congela a mesa de todos com uma linha ⚠ ABERTO

`150-rede.js:164-167`. O `{t:'nome'}` não tem limite de tamanho nem de frequência — e **o
contraste está no mesmo arquivo**: `receberChat` (`:848`) tem os dois (`INTERVALO_FALA` de
600 ms e `TAMANHO_FALA` de 160). É a mensagem **mais cara** do protocolo: `listarSala()`
(reescreve `innerHTML`) + `publicar()` (espalha vistas a todos, e **grava a partida no
`localStorage`**, síncrono). E o corte em 14 do `nomeUnico` acontece **depois** do trabalho
pesado — o `.normalize('NFC').replace(/\s+/g,' ').trim()` roda sobre a string inteira.

Medido: nome de 4 MB → **532 ms**. Vinte deles → **9 segundos**. Como o anfitrião é a
autoridade, **a mesa inteira congela** e o disco apanha uma partida serializada por mensagem.

**O conserto é copiar os dois guardas que já existem dez linhas abaixo.** Cortar em 14
ANTES de normalizar. `String(nome)` em `sentar` (`:434`) tem o mesmo problema, mas ali é uma
vez só.

### C5 · tela preta permanente por partida guardada ⚠ ABERTO

`160-loop.js:292-298`. `partidaGuardada()` confere quatro campos e entrega o resto cru;
`mesaLembrada()` (`140-menu.js:39`) confere campo a campo com `Object.hasOwn`. **A diferença
de rigor entre os dois é acidental, não decidida** — e é o defeito 5 da Fila 6 sobrevivendo
no único validador de `localStorage` que nunca foi endurecido.

Sem o objeto `regras`, `atualizarBotaoRetomar()` — que roda **no topo do módulo**
(`160-loop.js:457`) — lança e mata o script concatenado inteiro: **tela preta que volta a cada
recarregamento**, porque a causa está guardada, e sem saída a não ser limpar o armazenamento.

E com um modo que não existe mais, `MODOS[vista.modo].rotulo` (`130-hud.js:91`) lança dentro
do `desenharHUD`: o menu some, a mesa 3D aparece, e **o HUD não existe** — sem placar, sem
vez, sem botões. `atualizarBotaoRetomar` protege isso (`m ? m.rotulo : …`); `desenharHUD`
**não**. Chave de protótipo ainda passa: `modo: 'constructor'` mostra `undefined · até 6`.

**Ressalva honesta:** hoje `partidaParaGuardar()` sempre grava `regras`, então isto exige
armazenamento adulterado ou troca de versão. Fica registrado porque é a definição de
"entrada de fora" que este arquivo usa.

### C6 · a QUARTA mordida do `innerHTML`, por uma porta nova ⚠ ABERTO

`130-hud.js:86-98` e `:377`. A regra da casa — *todo texto de fora passa pelo `escapar`* — foi
aplicada às **strings** (`nome`, `txt`) e **nunca aos campos que se assume serem números**:
`vista.placar`, `vista.alvo`, `vista.naMao[i]`, `vista.maoNum`, `r.somas[i]`, `r.pontos`.

E no convidado, `atualizarVista(m.v)` (`150-rede.js:667`) recebe o objeto do fio **sem uma
única validação**. Como qualquer aba pode ser anfitriã, um anfitrião modificado manda
`{t:'vista', v:{placar:['<img src=x onerror=…>', 0]}}` e roda script na máquina dos
convidados. Reproduzido; `escapou o placar? false`.

Também: `atualizarVista(m.v)` com `m.v` ausente deixa `vistaAtual` indefinido e mata a tela.

### C3 · `{t:'acao'}` sem `peca` estoura no anfitrião ⚠ ABERTO

`150-rede.js:168` → `040-partida.js:107` → `mesmaPeca` (`020-baralho.js:9`). `aplicarIntencao`
não confere **nada** da mensagem: `i.acao`, `i.peca` e `i.ponta` vão crus para o motor.
`mesmaPeca([1,2], undefined)` lança `Cannot read properties of undefined`.

**NÃO é trapaça** — `jogar` valida contra `acoesDe(P, cadeira)`, que sai da mão do próprio
jogador; peça inventada devolve `'jogada inválida'` e não entra na mesa. **A fronteira do
invariante 3 continua de pé.** O dano é o `publicar()` não rodar e a vez não andar.

### C7 · a cadeira pode passar a se chamar `"undefined"` ⚠ ABERTO

`150-rede.js:165`. Com o campo ausente, `String(undefined)` é a string `"undefined"`, que é
**truthy** — então o `|| 'Visita'` nunca dispara. Medido: `{t:'nome'}` → `"undefined"`,
`{nome:null}` → `"null"`, `{nome:42}` → `"42"`. Aparece no placar, na lista da sala e no
começo de toda linha da conversa: **é o defeito da foto da Fila 10 por outra porta.**

**A lição vale mais que o conserto:** o `nomeUnico` tem `String(nome == null ? '' : nome)`
dentro, **e essa guarda é inútil aqui**, porque quem chama já converteu antes. *Guarda no
lugar errado é guarda que não guarda.* O irmão em `sentar` (`:363`) está certo, porque tem
`if (nome !== undefined)` à frente.

### As SUSPEITAS — registradas COMO suspeita

| # | onde | o quê |
|---|---|---|
| S1 | `150-rede.js:161,413,91` | `String(m.id \|\| '')` sem teto vai para `donoDaCadeira`, que é **persistido**. Id de megabytes ou estoura a cota (e `guardar` engole calado — o bug do item 4 pela porta dos fundos) ou come a cota da origem. **Cota real não medida.** |
| S2 | `150-rede.js:641` | `euNaTela = m.cadeira` sem faixa nem tipo. Rastreados os consumidores, **nenhum dano hoje** — mas é "índice do fio usado sem checar limites", e basta alguém passar a lê-lo |
| S3 | `160-loop.js:159` | ação recusada de convidado morre **em silêncio**: não existe `{t:'erro'}` no protocolo. É a doença que a Fila 6 e o item 2 da Fila 8 passaram consertando, viva no único caminho que atravessa a rede |
| S4 | `040-partida.js` (6 pontos) | `P.log` cresce para sempre — **347 entradas / 18,7 KB** numa partida de 12 mãos — e é serializado a cada `publicar()`: **334 gravações síncronas por partida**. E **não tem um único leitor** em `src/` nem em `tests/`: é peso morto. Jank em celular não medido |
| S5 | `150-rede.js:712` | `voltando` não é zerado ao cancelar pelo botão. A próxima queda começa em 4/8. Causa idêntica à do C2 |
| S6 | `150-rede.js:223` | `donoDaCadeira` restaurado exige `Number.isInteger` mas **não a faixa**. Os três leitores são limitados por `MESA.n` — inofensivo hoje |

### A RAIZ COMUM, e é a lição desta fila

**C1, C2 e S5 são o mesmo defeito três vezes**, e este arquivo já escreveu a regra no item 7
da Fila 5: *"para todo `if (x) return`, perguntar as duas coisas — quem zera o `x`, e o que
acontece se esse alguém não vier."* São três `setTimeout` sem dono e sem guarda no disparo.

**Uma lição registrada não impede a repetição se ninguém a usar como checklist.** O projeto
tem um dos dois `setTimeout` certo (`voltarSozinho` confere `modo`) e o irmão errado, no mesmo
arquivo — exatamente como tem o `receberChat` guardado e o `{t:'nome'}` sem guarda dez linhas
acima. **Segurança aplicada num lugar e esquecida no vizinho é o padrão que este repositório
repete há quatro filas.** Ao mexer em qualquer guarda, a pergunta nova é: *"quem é o irmão
desta linha, e ele tem a mesma guarda?"*

### O buraco de TESTE que explica C3, C4 e C7

**Nenhuma linha de teste jamais entregou uma mensagem malformada ao anfitrião.** O
`conn.on('data')` inteiro (`150-rede.js:155-171`) não é alcançado por suíte nenhuma: o
`test-jogo` chama `sentar`/`largar`/`receberChat`/`desistiuDaMesa` **direto**, e o
`test-online` só troca mensagens bem-formadas. Zero ocorrências nos testes de: `conectando`,
`pararDeConectar`, `explicarErroDeRede` (nenhum dos seis ramos roda), o retry de
`unavailable-id`, e `RECUSA[m.porque]` no lado do convidado.

**O conserto do buraco é uma cena só:** dirigir o despachante com uma `conn` de mentira
mandando `null`, `{}`, `{t:'acao',acao:'jogar'}` e um nome gigante. Ela pegaria quatro dos
sete de uma vez.

### O que foi investigado e NÃO é defeito — não refaça

- **O chat está certo**: tem os dois limites (160 caracteres, 600 ms por cadeira) e o
  anfitrião entra pela mesma porta.
- **Nada vaza**: `conexoes`, `esperando`, `donoDaCadeira`, `ULTIMA_FALA` e `ordemDaMao` são
  chaveados por cadeira (≤ 4); `linhasDoLog` corta em 40; `texturas` recebe 3 empurrões na
  carga. **O único crescimento sem teto é o `P.log` (S4).**
- **Listeners não acumulam**: os 18 `addEventListener` de `src/js/` são todos de topo de
  módulo. Não há um único dentro de função.
- **O único `JSON.parse`** (`010-constantes.js:112`) está em `try/catch` com padrão de volta.
- **`mesaLembrada()` é sólido** — e é o **modelo** que falta ao `partidaGuardada` (C5).

</details>


### As lacunas de teste que a varredura mediu

- **`080-peca3d.js`: 2 nomes exercitados de 18.** Ninguém afirma que a peça `[3,5]` mostra
  três pintas de um lado e cinco do outro — a única prova é olho humano no `tests/shots/`.
  O que existe é cobertura **negativa** (peça de adversário não tem `material.map`), que é
  fronteira de segurança, não geometria.
- **`120-audio.js`: nenhuma asserção de que um som SAI.** E é pior que ramo verde: o dublê
  (`tests/harness.mjs:140-153`) é um objeto-nulo — `createGain()` e `createOscillator()`
  devolvem `nada()` —, então `estalo()` e `nota()` rodam inteiros e **ninguém pergunta o que
  saiu**. Só `ac.state` é conferido. **É o arquivo mais reaproveitável para os jogos novos:
  reusá-lo hoje é reusar sem rede.**
- **`enquadrar()` não tem asserção, e o `fov` só é IMPRESSO** (`test-telas.mjs:416,630`).
  `FOV_BASE = 46` e `FOV_TETO = 62` (`070-cena.js:26-27`) **não têm guarda**: trocar o 46 por
  50 não derruba suíte nenhuma, só muda um número no log. O comentário do próprio arquivo
  chama isso de "o bug do celular inteiro".
- **Nenhum teste dispara `resize` nem `orientationchange`.** O harness fixa 1600×900 e o
  `test-telas` chama `setViewport` uma vez, antes de carregar. **O caminho "girou o celular"
  nunca roda.**
- Sem asserção própria também: `escapar()` (uma função de segurança provada só por um
  payload indireto), `mostrarFimDeMao`/`sobrouNaMao` (a Fila 1 inteira — só se afirma que
  "tem algum dígito ali"), `assinaturaMao`, `chegarPerto`, e o ciclo de vida do `avisar()`.

### O custo do `test-telas`, com número

São **60 navegações completas** (6 telas × 10 cenas, cada uma com `newPage()` + `goto`
`networkidle2`), em WebGL **por software**. A constante que este arquivo mandava olhar está em
`tests/test-telas.mjs:500` — e são **DUAS**, não uma:

```js
if (parados >= 8 || ++quadros > 240) return pronto();
```

`parados >= 8` é o **piso**: toda cena paga 8 quadros *depois* de já estar parada — 480
quadros de puro imposto. `quadros > 240` é o **teto** do pior caso, e este arquivo já avisa
que "máquina disputada chega ao teto antes de assentar".

**ANTES de mexer em qualquer um dos dois: instrumentar.** Hoje `quadros` é contado
(`:490`) e **jogado fora** — a linha de log imprime `fov`, peças, folga e nome, mas não
quantos quadros a cena gastou nem se bateu no teto. **Sem esse número não dá para saber se o
custo está no piso ou no teto**, e a regra da casa é medir antes de consertar. Custa uma
interpolação na linha que já existe.

Outros caminhos, em ordem de valor: reusar a página em vez de `newPage()` + `goto` por célula
(a infra de "cada cena diz o que quer" já existe e é a pré-condição — mas **não** troque por
`createBrowserContext`, que mata o cache HTTP); e marcar como `soTela: true` as cenas que só
apertam o HUD. O mínimo defensável para `parados` é **2**, não 1 — este arquivo registra que
medir logo depois de mandar parar mede a própria parada.

### A documentação mentia em números — e o culpado não era o previsto

Eu ia mandar atualizar o README. **A medição inverteu isso**, e é o **sexto** diagnóstico de
leitura que esta base perde para um número:

- o **diagrama de branches do README já está no modelo novo** (`README.md:264-285`);
- o **número do bot no README está CERTO** (55,8%, conferido rodando);
- **quem carregava número velho era ESTE arquivo** — corrigido nesta fila, com um bilhete
  mandando rodar o teste em vez de ler o número daqui.

Corrigido no `README.md`: **5.544** linhas (dizia ~5.100), **dez** cenas de tela (dizia nove,
em dois lugares), **quinze** releases (dizia doze). E entrou o que a v2.0.0 trouxe, que não
tinha uma linha lá.

**E uma afirmação errada em TRÊS arquivos:** `build.mjs:1`, `CLAUDE.md` e `README.md` dizem
que o build gera um `index.html` **autossuficiente**. Não gera: o CSS continua externo
(`index.html:12` é um `<link>`). São 2 arquivos locais + 2 do CDN — e **um service worker
precisa saber disso**.

---

## A casa de jogos — Dominó → Truco → Pife → 21

Decidido com o Ricardo em 04/08/2026: o site deixa de ser "um jogo de dominó" e vira uma casa
de jogos de bar. **Truco primeiro**, depois Pife, depois 21. Sinuca fica para muito depois, e
com uma ressalva grande (abaixo).

### O motor já é quase agnóstico ao jogo, e isso não é sorte

Medindo linhas contra menções ao vocabulário de dominó (`peça`, `pinta`, `carroça`,
`tabuleiro`, `baralho`):

| arquivo | linhas | menções | leitura |
|---|---:|---:|---|
| `150-rede.js` | **857** | **3** | a camada mais cara do projeto é **genérica** |
| `120-audio.js` | 92 | 1 | genérica |
| `140-menu.js` | 250 | 14 | quase toda genérica (as cadeiras) |
| `130-hud.js` | 473 | 15 | placar, vez e conversa são genéricos |
| `070-cena.js` | 430 | 27 | o boteco é genérico; a mesa é do jogo |
| `040-partida.js` | 235 | 29 | motor **do dominó** |
| `03` · `06` · `08` | 139 · 152 · 125 | 33 · 37 · 45 | **puro dominó** |

É consequência direta do **invariante 2**: a rede nunca precisou saber que o jogo era
dominó. Um segundo jogo herda **de graça** o online P2P, a identidade de cliente, a
reconexão, o saguão, a conversa e o hotseat — que é justamente a parte que levou cinco filas
para ficar de pé. Aproximadamente **2.400 linhas reaproveitáveis** contra **1.100 de dominó**.

### Onde corta a linha

```
DA CASA (herdado)                    DO JOGO (nasce por jogo)
  online P2P, cadeiras, saguão         regras: o que vale, o que encaixa
  som                                  layout: onde a carta/peça cai
  placar, vez, conversa, gaveta        a peça/carta 3D
  o boteco, a luz, o enquadramento     o bot
  escolher → confirmar                 turnos e pontuação
```

O que **não existe e vale para os três jogos de carta** é um baralho e uma **carta 3D** —
naipe e valor num atlas de canvas, exatamente como o `080-peca3d.js` já faz com as pintas. Por
isso a ordem é boa: **o truco paga o baralho e a carta, e o pife e o 21 depois ficam baratos.**

### Duas armadilhas previstas — escritas ANTES de alguém começar

- **O 21 tem BANCA, e banca não é uma cadeira como as outras.** O invariante 2 diz que o
  motor não sabe a diferença entre `voce`/`local`/`bot`/`online`; a banca **fura isso**,
  porque joga por regra fixa e não por escolha. É o único dos três que mexe no modelo de
  cadeira — e é por isso que ele **não** deve ser o primeiro, apesar de parecer o mais simples.
- **A sinuca é outro PROJETO, não outro jogo.** Não é por turnos: exige física (colisão,
  atrito, efeito) e online em **tempo real**. O modelo anfitrião-autoritativo por mensagem —
  o que este projeto tem de mais valioso — **não serve** ali; vira netcode. Registrado agora
  para a decepção não vir depois de começar.

---

## A reorganização — ✔ as pastas feitas (v2.3.0), as duas dívidas EM ABERTO

**Feito em 05/08/2026:** `src/js/10-casa/` e `src/js/30-domino/`, o `build.mjs` varrendo
recursivo e ordenando pelo NÚMERO, o CSS entrando no bundle (`src/css/`), e `tests/.gerado/`
para todo artefato — `tests/` passou a mostrar só o que uma pessoa escreveu.

**A prova de que não mudou comportamento nenhum:** o `index.html` gerado ficou **idêntico
byte a byte** ao anterior, tirando as linhas de separador `/* ····· … ····· */`. É a
verificação certa para mudança estrutural — verde de suíte diria bem menos.

**O que a implementação descobriu, e o plano abaixo não previa:** ordenar por CAMINHO
QUEBRARIA o jogo. `140-menu.js` (casa) chama `mesaLembrada()` no topo do módulo e valida o
nível de bot contra `NIVEIS`, que mora em `050-bot.js` (dominó) — com toda a `10-casa/` antes
de toda a `30-domino/`, é `ReferenceError` na carga e tela preta. Por isso a ordem saiu do
número e não da pasta, e por isso o `build.mjs` reprova número repetido e arquivo sem número.

**AS DUAS DÍVIDAS FECHARAM NA v3.0.0 — e a medição corrigiu as DUAS antes de consertar.**
Nono e décimo diagnósticos de leitura que esta base perde para um número.

| a dívida como estava anotada | o que a medição mostrou |
|---|---|
| "`150-rede.js` é dominó disfarçado de rede" | os 11 ids são **todos do saguão**, e saguão é da casa. Era **transporte** misturado com **apresentação** |
| "o `naMao` do truco colide **em silêncio**" | `naMao` é `const`, e `const` repetido é **SyntaxError** — o caso citado é o barulhento |
| — (não anotado) | `010-constantes.js` da casa guardava `PECA_C`, `MAX_PINTAS`, `PONTOS`, `MODOS` |

- **A rede tem ZERO chamadas ao DOM.** A tela do online virou `145-saguao.js`: a rede diz o
  que É (esta cadeira chegou, faltam dois), o saguão diz como isso APARECE.
- **O namespace não foi feito, e o motivo está medido.** Só `function` redeclarada e `var`
  colidem calado; `const`/`let`/`class` já eram `SyntaxError` que o `node --check` do build
  pegava. **O `build.mjs` passou a reprovar nome de topo repetido entre arquivos**, dizendo o
  nome e os dois donos — vinte linhas, contra as 153 chamadas de cerimônia que um
  `JOGOS.domino = {…}` custaria com um jogo só na mesa. Se o truco trouxer colisão demais, o
  objeto continua disponível; hoje ele compraria pouco.
- **`desenharContagem` saiu do HUD**, e não mudando de pasta: a casa ganhou o encaixe
  `painelDoJogo`, que nasce sem fazer nada, e o dominó pendura o dele em
  `30-domino/135-contagem.js`. O HUD desenha um painel de dominó sem citar dominó uma vez.

<details><summary>o plano original, de quando nada disso existia</summary>

## A reorganização — pré-requisito, não gosto

Pedido do Ricardo em 04/08/2026: *"mantenha tudo organizado, separe os códigos, as pastas,
faça tudo de forma fluida e polida, e inclusive também no próprio Git."*

**Isto deixa de ser estética e vira pré-requisito**, porque a varredura mostrou que o
obstáculo ao segundo jogo não é o tamanho dos arquivos — é o **modelo de módulo**.

### O problema, concreto

`build.mjs:23` lê `src/js/*.js` e concatena tudo num **escopo único**. Um baralho traz
naturalmente `naMao`, `carta`, `chave`, `valor`, `distribuir`, `embaralhar`, `jogar`,
`passar`, `visaoDe`, `MESA`, `P` — **todos já existem hoje**. Este arquivo já registra que
`naMao` sendo dois nomes quase virou colisão silenciosa; com dois jogos, cada um desses é um
conflito.

Some-se: **uma** ponte `window.__jogo` (`160-loop.js:488`), de que as sete suítes dependem, e
**75 `id="…"`** de dominó no `src/pagina.html`.

### A separação proposta

Pastas por dono. O invariante 1 **não muda** — o `build.mjs` passa a varrer recursivamente e
ordenar por caminho, e a concatenação continua, que é o que faz o jogo abrir por duplo-clique:

```
src/js/
  10-casa/     o que é da CASA e de jogo nenhum   (~2.400 linhas já prontas)
               constantes, armazenamento, cena, áudio, HUD, conversa,
               telas, menu de cadeiras, rede P2P, loop
  30-domino/   regras, baralho, partida, bot, layout, peça 3D, tabuleiro, mão
  40-truco/    (nasce aqui)   50-pife/   60-vinteum/
```

### Duas dívidas a pagar JUNTO, senão a pasta é cosmética

- **A rede escreve na tela por id — e mais que o próprio HUD.** Medido: `150-rede.js` tem
  **45** chamadas `el('…')` contra **43** do `130-hud.js`. A camada de rede é hoje a que mais
  toca no DOM do projeto inteiro. **Enquanto isso existir, `150-rede.js` não é "da casa": é
  dominó disfarçado de rede.**
- **Um namespace por jogo** — cada jogo pendura o seu num objeto (`JOGOS.domino = {…}`) em vez
  de soltar nomes no escopo comum. É o que torna o `naMao` do truco e o do dominó duas coisas
  diferentes sem prefixo feio.

E os três arquivos que misturam vidas diferentes, por ordem de custo: **`070-cena.js`**
(infra de render + texturas + o boteco concreto + `assentosDaMesa`), **`130-hud.js`**
(telas + conversa + gavetas + som + `desenharContagem`, que é **regra de dominó**), e
**`160-loop.js`** (estado + turno + render loop + persistência + a ponte).

### No Git

O que já é bom **fica**: `main` única e publicada, branch por versão (`v3`), merge `--no-ff`
com tag, branch apagada depois, `index.html` gerado com `merge=ours` e **rebuild dentro do
merge**. O que entra escrito: **um assunto por commit**, com a mensagem dizendo o *porquê* e
não o *quê* (é o padrão que os commits recentes já seguem), e **registro não é exceção à
regra de branch** — esta própria fila saiu numa `v2.1` com tag `v2.1.0`.

### `git worktree` — a tentar, e o motivo é real aqui

Pedido do Ricardo em 04/08/2026: poder trabalhar em partes diferentes **ao mesmo tempo**.
`git worktree` dá isso — vários diretórios de trabalho sobre o **mesmo** `.git`, cada um numa
branch, sem `stash` e sem trocar de branch no meio de uma investigação:

```
git worktree add ../domino-bar-v3     v3        # a onda de código
git worktree add ../domino-bar-app    pwa       # o PWA, em paralelo
git worktree list
git worktree remove ../domino-bar-app           # quando acabar
```

**Por que faz sentido NESTE projeto, especificamente:** as suítes pesadas passam de dez
minutos, e trocar de branch no meio de uma rodada do `telas` invalida o `index.html` que ela
está medindo. Com worktree, a rodada longa fica num diretório e o trabalho segue noutro.

**O que herda de graça:** o `.git` é o mesmo, então a tag, o histórico e — importante aqui —
o `git config merge.ours.driver true` valem para todos os worktrees. Não é preciso
reconfigurar o driver por diretório, ao contrário do que acontece a cada **clone**.

**As três armadilhas, e a terceira é a que dói:**

1. **`node_modules` não é compartilhado.** `tests/node_modules` está no `.gitignore`, então
   cada worktree novo precisa de `cd tests && npm install` antes de rodar suíte de navegador.
2. **`index.html` é gerado e commitado.** Cada worktree tem o seu, e `npm run check` responde
   sobre o diretório em que você está. Não presuma que "o bundle está em dia" vale para o
   outro.
3. **Worktree NÃO autoriza rodar duas suítes pesadas ao mesmo tempo.** Este arquivo já
   registra que a contenção de CPU estoura os 45 s de navegação do `test-online` e faz o
   `test-telas` bater no teto de 240 quadros antes de assentar — e que **a mensagem de erro
   culpa o broker do PeerJS**, com a rede ótima. Worktree resolve o conflito de *arquivos*,
   não o de *CPU*: **suíte pesada continua rodando sozinha.**

**A receita deste repositório**, para copiar e colar quando chegar a hora (decisão do
Ricardo em 04/08/2026: adotar worktree logo depois de fechar a Fila 11):

```
# a partir de C:\Users\ricar\Projetos-Testes\domino-bar, com a main limpa
git worktree add ../domino-bar-org  -b reorg   main
git worktree add ../domino-bar-app  -b pwa     main

cd ../domino-bar-org/tests && npm install      # POR WORKTREE — node_modules não é compartilhado
cd ../domino-bar-app/tests && npm install

git worktree list                              # quem está onde
```

E ao terminar cada frente, o caminho de volta é o de sempre — merge `--no-ff` em `main` com
tag, **rebuild do bundle dentro do merge** —, e só então:

```
git worktree remove ../domino-bar-app
git branch -d pwa
```

**A ordem importa:** o worktree entra **depois** dos consertos da Fila 11, não junto. A
reorganização mexe em todo arquivo do projeto e os consertos moram em `150-rede.js` — as duas
frentes em paralelo dariam conflito exatamente no arquivo mais disputado. Worktree serve para
frentes que **não se cruzam**; usá-lo para frentes que se cruzam é criar trabalho de merge.

**Não foi adotado ainda** — fica registrado como a próxima coisa a experimentar, e o
`git worktree list` é o que diz se já foi.

### A ordem — e ela importa

**A reorganização vem ANTES do truco.** Reorganizar com um jogo só é trabalho mecânico com as
sete suítes de rede; reorganizar com dois jogos escritos é o dobro do trabalho e com risco de
misturar as regras dos dois.

---

</details>

## O caminho de aplicativo — ✔ PWA feito (v3.0.0), a Play Store em aberto

Decidido com o Ricardo em 04/08/2026. **O PWA é pré-requisito do TWA**: não há como pular
direto para a loja. O PWA saiu na **v3.0.0**; o que falta para a loja é decisão de conta e
está mais abaixo.

### O que já existia, e era o caro

`viewport-fit=cover`, safe-areas, alvos de 44 px por `(pointer: coarse)`,
`touch-action: none`, vibração, gaveta, `prefers-reduced-motion`, teclado completo, e o gesto
interrompido pelo sistema (`110-interacao.js`). **O trabalho de celular que costuma ser o
caro já estava feito** — foi por isso que o resto custou uma release só.

### O que entrou ✔

`manifest.webmanifest`, `src/sw.js` (gerado em `sw.js` pelo build), `icone-192.png` e
`icone-512.png` — **os dois únicos binários versionados do projeto**, e a exceção é imposta
de fora: a loja e o manifest exigem PNG em arquivo. A fonte é `src/icone.svg`, e
`npm run icones` refaz os dois; artefato sem caminho de volta à fonte é artefato que ninguém
consegue mudar daqui a um ano.

**A PÁGINA É REDE-PRIMEIRO; o resto é cache-primeiro.** Não é inconsistência, e a distinção é
o achado mais importante da auditoria da v3.0.0: as URLs do three e do peerjs têm a versão no
caminho e são **imutáveis**, então buscá-las de novo nunca traria nada diferente. O
`index.html` é o **único arquivo que muda de conteúdo sem mudar de nome** — servi-lo do cache
fazia toda correção publicada só aparecer na SEGUNDA visita, e quem testa veria o defeito que
acabou de consertar. É o dia perdido de 31/07 por uma porta nova, e pior: ali bastava um
`git push`, aqui não bastaria nada, porque o cache é do celular do jogador. Há asserção — a
suíte publica uma "v2" no meio da rodada e exige que ela apareça sem segunda visita.

**O nome do cache é um RESUMO do `index.html` mais o molde `src/sw.js`**, carimbado pelo
`build.mjs`. A segunda metade também veio da auditoria: mudando só a estratégia de cache o
`index.html` fica igual, o nome não trocaria, e a lógica nova mandaria num cache montado pela
lógica velha. Cache de service
worker que não troca de nome prende o jogador numa versão antiga para sempre, e nem limpar a
aba resolve — amarrando o nome ao conteúdo, publicar correção JÁ é publicar cache novo, e
"esquecer de bumpar a versão" deixa de existir como categoria de erro. Por isso `sw.js`
entrou no `merge=ours` do `.gitattributes` junto do `index.html`.

**As bibliotecas NÃO são baixadas na instalação, de propósito.** São 763 KB, e baixá-las
duas vezes (uma pela página, outra pelo worker) atrasaria justamente a primeira visita. O
`fetch` as guarda quando a própria página as pede; o resultado final é o mesmo. Consequência
que vale saber: **quem enche o cache é a SEGUNDA carga**, porque o worker só intercepta
depois de instalado.

### O orçamento de offline: 1,03 MB (era 1,64 MB)

| | antes | agora |
|---|---:|---:|
| three | 1.272.972 (não minificado) | **670.681** |
| `peerjs.min.js` | 92.865 | 92.865 |
| `index.html` (com o CSS dentro) | 314.078 | 317.063 |
| **total** | **1.679.915** | **1.080.609** |

**O ganho de graça era real e saiu numa linha:** o importmap apontava para
`three.module.js` **não minificado**. 47% a menos no maior download da página. A segunda
entrada (`three/addons/`) saiu junto — o único `import` do projeto é
`import * as THREE from 'three'`, em `070-cena.js`.

**`crossorigin` no `<script>` do PeerJS não é enfeite.** Sem ele o navegador busca em modo
`no-cors`, o worker recebe resposta **opaca** — que não dá para conferir e por isso ele
recusa guardar — e o jogo abriria offline **sem o online**. O sintoma seria "o botão de mesa
online sumiu depois que instalei o aplicativo". Provado por mutação.

**A promessa do `#semCarga` deixou de ser promessa.** `npm run app` desliga a rede e recarrega;
se o jogo não ficar pronto, reprova. É a asserção que vale por todas as outras da suíte.

### O BLOQUEIO da Play Store, que ninguém adivinharia

O jogo mora numa *project page* (`ricardocolombo01.github.io/domino-bar/`), e um TWA exige o
arquivo de Digital Asset Links na **RAIZ DO DOMÍNIO**. Medido em 04/08/2026:

```
https://ricardocolombo01.github.io/                    → 404
https://ricardocolombo01.github.io/.well-known/…json   → 404
https://ricardocolombo01.github.io/domino-bar/         → 200   (o jogo)
```

Sem esse arquivo o app abre **com barra de URL** (cai para Custom Tab) e não passa por
aplicativo. **O conserto é de graça e não envolve o jogo:** criar o repositório
`ricardocolombo01.github.io` (user page) só para servir o `.well-known/`. É **decisão de
conta, não de código** — por isso está escrito aqui e não numa tarefa.

O resto do caminho: conta de desenvolvedor Google (US$ 25, uma vez), Bubblewrap para gerar o
projeto Android, assinatura do AAB, política de privacidade, ícone e prints.

### Dois riscos a dizer antes de prometer prazo

- **Trocar de origem apaga o `localStorage`** — as 6 chaves `dominobar.*`, inclusive
  `dominobar.cliente`, que é a identidade que devolve a cadeira certa a quem cai. **Um TWA
  mantém a origem `https://` e não sofre disso**; um WebView empacotado (Capacitor) sofre, e
  é mais um motivo para o TWA.
- **O online depende do broker público do PeerJS, com STUN e sem TURN** (`150-rede.js:14-17`).
  Em rede móvel com NAT simétrico a conexão falha e **não há plano B no código**. Isto já
  vale hoje, no site — o app só torna mais visível. E os códigos de 4 letras vivem num
  **namespace global compartilhado** naquele broker.

### A ordem sugerida — os três primeiros ✔ feitos na v3.0.0

1. ~~o three minificado e o importmap limpo~~ ✔
2. ~~ícones + `manifest.webmanifest` + `theme-color`~~ ✔ **instalável**
3. ~~service worker~~ ✔ **abre sem internet**, com o registro atrás de
   `location.protocol.indexOf('http') === 0` — em `file://` o `register` REJEITA, e este
   jogo existe para abrir por duplo-clique;
4. **o repositório da user page com o `.well-known/`** → destrava o TWA. ← é aqui que para,
   e é decisão de conta do Ricardo, não de código;
5. Bubblewrap, conta, assinatura, loja.

---

## Regras da casa (implementadas)

Três modos, na tabela `MODOS` de `010-constantes.js`: **Clássico** (7 na mão, 2 a 4
jogadores, 28 peças), **Duelo** (14 na mão, 1v1, 28 peças) e **Trio** (9 na mão, 3
jogadores, 27 peças — o `0|0` sai, e é isso que faz 27 dividir exato por 3).

Duelo e Trio **esgotam o baralho na distribuição**, então caem sozinhos no caminho "sem
monte, quem trava passa" que a mesa de 4 já usava — não há regra de compra nova. Com
monte só o Clássico de 2 ou 3, onde quem não pode jogar **compra até conseguir**.

**Clássico de 4:** duplas em cruz (1&3 × 2&4). Primeira mão abre com o 6|6 — ou, quando
ele está no monte, com a maior carroça (`quemAbre`, `020-baralho.js`); as seguintes, quem
bateu. Batida: simples 1, carroça 2, **lá-e-lô 2**, cruzada 4. Trancou: 1 ponto para a
mão mais leve; empatou, a mão morre. Partida até 6 (ou 10, no menu). Compra voluntária e
o modo da mesa são alternáveis no menu.

`maoRuim(mao, modo)` em `020-baralho.js` reprova a mão com `modo.carrocasDemais` carroças
ou mais e manda `distribuir` refazer tudo (até `MAX_EMBARALHOS`). Acontece em 1,4% das
distribuições no clássico, 0,6% no duelo e 2,6% no trio.

**Não dá para trancar de propósito** (`fechamentosArmados`, `030-regras.js`, filtrado em
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

**Sair conta como derrota** (`abandonar`, `040-partida.js`): grava `P.desistiu`, põe
`fase='fim'` e a tela de campeão tira o time do desistente da conta. No online a cadeira
fica guardada `ESPERA_VOLTA` (30 s) antes de virar derrota — e continua marcada `online`
justamente para o mesmo código reclamá-la.
