# Dominó de Bar

Dominó dupla-seis em 3D numa mesa de boteco. De 2 a 4 jogadores, em qualquer mistura
de gente e bot, na mesma tela ou pela internet.

### ▶ Jogar agora: **https://ricardocolombo01.github.io/domino-bar/**

**Isto está virando uma casa de jogos.** Há uma faixa de abas no alto do menu, e o **Truco
Paulista** já está lá — registrado, com as regras à mostra, e ainda sem motor para sentar
nele. O link `?jogo=truco` abre direto. Cada jogo guarda a mesa e a partida **na chave dele**,
então espiar a aba do lado não custa a partida que está em andamento.

**Dá para instalar como aplicativo**, e depois de uma partida ele **abre sem internet** — o
service worker guarda o jogo e as duas bibliotecas. Também abre por duplo-clique no
`index.html`, que é um arquivo só, com o CSS e o JavaScript dentro. Só o modo online precisa
do endereço acima (ou de `npm run servir`) — a conexão P2P não fecha a partir de `file://`.

---

## A ideia: cadeiras, não modos de jogo

Não existe "modo solo", "modo local" e "modo online" neste jogo. Existe uma mesa com 2
a 4 **cadeiras**, e cada uma é preenchida por uma destas quatro coisas:

| cadeira | quem responde |
|---|---|
| **Você** | o mouse, nesta tela |
| **Pessoa nesta tela** | outra pessoa, revezando o computador |
| **Bot** | fácil, normal ou difícil (o difícil ganha **55,8%** contra o fácil, em 600 partidas) |
| **Pessoa online** | alguém que entrou com o código da mesa |

O motor de regras não sabe a diferença. Ele diz de quem é a vez e espera. Por isso
"2 humanos online + 1 bot" não é um caso especial — é só outro preenchimento, e sai de
graça. Bot nunca é obrigatório: dá para montar mesa só de gente.

## Como se joga

- **Clique na peça** que quer jogar: ela levanta e o fantasma mostra onde vai cair. Um
  segundo clique — no fantasma ou no botão — confirma. São sempre dois passos, inclusive
  quando só há uma ponta possível: num jogo em que a peça errada custa a mão inteira, um
  deslize do mouse não pode virar jogada.
- Se ela serve **nas duas** pontas, as duas acendem — escolha a que quiser. O botão diz o
  **número** da ponta ("encaixar no 5"), que é o que se decide, e não "esquerda/direita".
- Peça que não encaixa fica apagada, e clicar nela **diz por quê** — são três motivos
  diferentes e o certo aparece. `Esc` desfaz a escolha.
- **Arraste a peça** para mudar o lugar dela na sua mão — dá para arrumar o jogo enquanto
  os outros jogam. O botão **⇄ Arrumar** (ou a tecla `A`) agrupa tudo pelo seu número
  mais forte de uma vez.
- **? Dica** sugere uma jogada **e diz por quê**, com os dois critérios que mais pesaram.
  Ela levanta a peça e abre a confirmação, exatamente onde o seu clique teria parado —
  ninguém joga por você. Só vale na sua vez. É o próprio bot pensando com a sua mão, e
  saiu de graça: todo campo que ele recebe já estava na visão, porque ele nunca trapaceou.
- **Contar** liga uma tabelinha do lado com quantas peças de cada número ainda não
  apareceram, contando as da mesa e as da sua mão — e quem já mostrou não ter o número,
  por ter passado. É a conta que jogador bom faz de cabeça; fica desligada por padrão.
- **Comprar do monte** e **Passar a vez** aparecem no canto quando são possíveis.
- No revezamento local, a tela avisa "passe o computador para o Zé" e **apaga as peças
  da cena** antes de trocar — não é só um overlay por cima.

### Sem mouse, e sem tela

Dá para jogar a partida inteira pelo teclado:

| tecla | o que faz |
|---|---|
| `←` `→` | passeia pela mão — a peça sob o cursor levanta |
| `1` … `9` | pula direto para a n-ésima peça e a escolhe |
| `Enter` / espaço | escolhe a peça sob o cursor; de novo, confirma a jogada |
| `Esc` | desfaz a escolha |
| `A` · `D` | arrumar a mão · pedir dica |

As duas portas existem porque o número para no `9` e o **Duelo dá catorze peças na mão**:
sem as setas, cinco peças ficariam inalcançáveis. Escolher uma peça leva o foco ao botão
de confirmar, então jogar é `3` `Enter`.

O placar, de quem é a vez, os avisos de erro e a conversa da mesa são **regiões vivas**
(`aria-live`), então um leitor de tela narra a partida sozinho. Todo texto do HUD passa no
contraste AA — inclusive o de erro, que era o de menor contraste da tela.

E quem pede **menos movimento** ao sistema (`prefers-reduced-motion`) recebe: a lâmpada para
de respirar, as peças não deslizam até o lugar — já estão nele — e as animações de HTML
somem. A mesa continua a mesma; nada de informação se perde, porque o deslizamento mostrava
o caminho e quem decide a jogada é o destino. Vale nos dois sentidos e sem recarregar: mudar
a preferência com o jogo aberto tem efeito no quadro seguinte.

### A conversa da mesa

Narração e falas no **mesmo fio**, em ordem: a jogada em cinza, a fala em âmbar com o nome
de quem falou. Um lugar só para olhar. Numa mesa em duplas há o canal **Dupla**, que só o
seu parceiro lê (e o anfitrião, que retransmite — está dito na cara, não há sigilo para
ele). A conversa existe **antes** da partida também, no saguão: é justamente quando se
quer falar, esperando a mesa encher.

No celular a conversa e a tabela de contagem viram **gaveta**: abrem por cima, com cortina
atrás, e fecham num toque. Numa tela de 360 px elas simplesmente não cabem ao lado da mão,
e encolher a mesa até caber deixaria o tabuleiro pequeno demais para ler.

## As regras desta casa

Dominó varia de bar para bar. Aqui vale:

São três mesas, e o que muda entre elas é quantas peças cada um segura:

| mesa | na mão | jogadores | baralho | monte |
|---|---|---|---|---|
| **Clássico** | 7 | 2 a 4 | 28 | o que sobrar |
| **Duelo** | 14 | 2 | 28 | nenhum |
| **Trio** | 9 | 3 | 27, sem o `0\|0` | nenhum |

O Trio tira a bucha de zero porque é justamente isso que faz o baralho dividir exato
entre três — 27 ÷ 9. E como Duelo e Trio esgotam o baralho na distribuição, os dois caem
na mesma regra da mesa de 4 sem precisar de regra nova.

- **Sem monte** (Duelo, Trio e o Clássico de 4): quem não pode jogar, passa.
- **Com monte** (Clássico de 2 ou 3): quem não pode jogar **compra até conseguir**; só
  passa se o monte secar.
- **Clássico de 4:** duplas em cruz (1&3 × 2&4).
- Mão carroçuda demais volta para a mesa e todo mundo embaralha de novo.
- A primeira mão da partida abre com o **6|6** — ou, quando ele está no monte, com a
  maior carroça. As seguintes, abre quem bateu.
- Batida: **simples 1** · **carroça 2** · **lá-e-lô 2** · **cruzada 4**.
- Trancou: 1 ponto para a mão mais leve (somando a dupla, quando há duplas). Empatou na
  soma, a mão morre e ninguém marca.
- **Não dá para trancar de propósito.** Se, depois da sua jogada, todas as peças que
  encaixam nas duas pontas já estiverem na mesa ou na sua mão **e você também não tiver
  resposta** — ou seja, se você *sabe* que a mesa parou de vez —, essa jogada fica
  proibida enquanto houver outra. Se você ainda responde às pontas, o jogo não trava: os
  outros passam, a vez volta e você joga de novo. Isso é *jogar sozinho*, e é jogo bom.
  A conta é feita só com o que você enxerga, de propósito: se o jogo olhasse a mão dos
  outros para decidir, apagar a peça na tela te contaria que ninguém tem aquele número.
  Carroça não conta, porque jogada numa ponta ela deixa a ponta no mesmo número.
- **Sair no meio conta como derrota.** Partida até 6 pontos (ou 10, no menu).

**Compra livre:** ligada, dá para comprar do monte **mesmo podendo jogar** — e comprar não
passa a vez, então dá para comprar até o monte secar, se quiser. Desligada (o padrão), só
compra quem não tem jogada.

Ela só existe onde existe monte, e o menu a desliga sozinho onde não existe, dizendo por
quê. Repare que **"modo com monte" não é uma coisa**: o Clássico tem monte com 2 ou 3
jogadores e nenhum com 4, porque quatro mãos de sete esgotam as 28 peças — a mesma conta
que faz o Duelo e o Trio nascerem sem monte.

No menu dá para trocar a mesa (Clássico · Duelo · Trio) e mais duas regras que variam de
bar para bar: a **compra livre** acima e o **alvo da partida**.

## Online

Abra **https://ricardocolombo01.github.io/domino-bar/**, monte a mesa deixando uma ou mais
cadeiras como *Pessoa online*, e o jogo devolve um código de 4 letras (`TP9L`). Mande o link
e o código para quem vai jogar; do outro lado é *Entrar numa mesa pelo código*.

Não há servidor para manter, nem conta, nem login: a ligação é direta entre os navegadores,
via WebRTC (PeerJS).

**O anfitrião é a autoridade.** Ele embaralha, guarda o estado e valida tudo. O convidado
não tem partida nenhuma na memória — ele manda a *intenção* ("quero jogar 3|5 na esquerda")
e recebe de volta só a visão dele, que nunca inclui a mão dos outros. Abrir o DevTools não
mostra a mão alheia porque **o dado não está lá**. Tem teste automatizado só para isso.

**Quem você é não depende de qual vaga estava livre.** Cada navegador sorteia um
identificador e o guarda; o anfitrião reserva a cadeira para ele. Sem isso a cadeira saía
por ordem de chegada — e como o número da cadeira é a chave da visão, quem pegasse a vaga
de alguém receberia a mão dele. Abrir o jogo em duas abas ocupa **uma** cadeira: a segunda
assume e a primeira é avisada, porque recusar deixaria você trancado do lado de fora da
sua própria cadeira.

Se alguém cair no meio da partida, **a cadeira fica guardada por 30 segundos** — dá para
voltar pelo mesmo código e retomar a mão. Passado o prazo, a partida é dada como perdida
para quem saiu, e a mesa fica sabendo o motivo. Fechar a aba deixou de ser a saída de
emergência de partida mal encaminhada; para sair de verdade existe o **✕** no canto, que
avisa o preço antes.

**O código da mesa fica à mostra** o tempo todo, num painel ao lado de Pontas/Monte/Mão, e
dá para selecionar e copiar. Sem ele, os 30 segundos de tolerância não valiam nada: quem
fechou a aba não tinha mais o código para digitar.

### Voltar depois de a página morrer

A partida é dado puro — é a mesma propriedade que faz o online funcionar —, então ela cabe
inteira no armazenamento do navegador. Recarregou, fechou sem querer, acabou a bateria: o
menu oferece **Continuar a partida de antes** por 12 horas.

No online isso vale para os dois lados. O **convidado** volta pela mesa em que sentou (2
horas — a sala depende de o anfitrião estar de pé, a partida não depende de ninguém). E o
**anfitrião reabre a MESMA mesa**, reivindicando o código de antes, com os convidados
voltando sozinhos para a cadeira deles. Uma metade sem a outra não serve para nada: se o
anfitrião reabrisse com código novo, quem tentasse voltar bateria numa porta que não
existe mais.

### O que pode dar errado

- O broker gratuito do PeerJS às vezes fica instável. O jogo mostra o motivo em português
  em vez de travar.
- WebRTC não fecha conexão em algumas redes (empresa com firewall fechado, CGNAT) sem um
  servidor TURN, que ninguém oferece de graça. Num 4G ou noutra rede costuma passar.
- Online precisa de `https://` (o link do Pages) ou `http://` (`npm run servir`). No
  duplo-clique em `file://` só rodam solo e local.

## O projeto

Sem framework, sem bundler. Madeira, piso, as pintas das peças e todos os sons são gerados
em código na hora — não há um único `.mp3` no repositório, e os únicos binários são os dois
ícones do aplicativo, que o manifest exige em arquivo. Three.js e PeerJS vêm de CDN. São
**7.499 linhas** em `src/`.

```
src/pagina.html      o molde
src/css/estilo.css   entra no bundle como <style>
src/sw.js            o service worker, com a versão carimbada pelo build
src/icone.svg        a fonte dos dois PNG (npm run icones)
src/js/10-casa/      o que é da CASA e de jogo nenhum: cores, armazenamento, cena,
                     áudio, HUD, abas, menu de cadeiras, saguão, rede P2P, loop
src/js/30-domino/    o que é DOMINÓ: constantes, baralho, regras, partida, bot,
                     layout, peça 3D, tabuleiro, mão, interação, painel de contagem
src/js/40-cartas/    BIBLIOTECA: naipes, valores, o baralho de 40 e a carta 3D —
                     o truco paga, o pife e o vinte-e-um herdam
src/js/50-truco/     o que é TRUCO: as regras (força, manilha, o melou) e o motor
                     (vazas, aposta, mão de 11). Falta o corpo — 3D, bot e a barra
                     de apostas —, então ele ainda não senta na mesa
```

São **três espécies de pasta**, e o `test-acoplamento` cobra a diferença: a **casa** não
alcança nada de fora; um **jogo** se pendura em `JOGOS` e não alcança outro jogo; uma
**biblioteca** ninguém registra, os jogos a usam, e ela **não alcança jogo nenhum** — a seta
tem um sentido só, senão um baralho que sabe o que é manilha vira truco disfarçado.

Os números dos arquivos vão **de dez em dez**, e é isso que deixa encaixar um arquivo novo
entre dois velhos sem renumerar tudo — o número é a ordem de carga.

A separação por pasta existe para o **segundo jogo**, e ela deixou de ser promessa: a casa
alcança **zero** nomes de dominó, e há um teste que mede isso a cada `npm test`
(`test-acoplamento`, uma varredura por AST — `grep` não serve, porque `chave` e `valor`
também são palavras portuguesas). A camada de rede, as cadeiras, o saguão, a conversa e o
hotseat nunca precisaram saber que o jogo era dominó, e é isso que o Truco herda de graça.

A carga tem **três tempos**: a casa DECLARA (010…160), cada jogo se REGISTRA em `JOGOS`
(300, 500…), e o `900-arranque` escolhe quem senta e liga o loop. O terceiro tempo existe
porque "validar a mesa guardada contra a tabela de modos" é uma pergunta sem resposta
enquanto ninguém escolheu o jogo.

Os arquivos de `src/js/` são **pedaços do mesmo escopo**, concatenados por `build.mjs` na
ordem do NÚMERO do nome — nunca na do caminho — e não têm `import`/`export` entre si. A
pasta organiza para quem lê; o número manda em quem executa, porque casa e dominó se
intercalam na carga (o menu, que é da casa, valida o nível de bot contra uma tabela que
mora no dominó). Isso existe porque o navegador
bloqueia módulos em `file://`: o código tem de chegar embutido na página para o
duplo-clique funcionar. O build ainda roda `node --check` no resultado, então erro de
sintaxe vira mensagem no terminal em vez de tela preta.

### Comandos

```
npm run build       junta src/ num index.html autossuficiente (o CSS entra junto)
npm run check       avisa se o index.html ou o sw.js estão desatualizados
npm test            build + o acoplamento e as três suítes de lógica (segundos)
npm run acoplamento a casa alcança ZERO nomes de jogo — varredura por AST, instantânea
                    (traz o `acorn`: rode `cd tests && npm install` uma vez)
npm run cartas      o baralho de 40 e a carta 3D, no terminal
npm run truco       as regras e o motor do truco, no terminal
npm run app         build + manifest, ícones, e o jogo abrindo COM A REDE DESLIGADA
npm run icones      regera os dois PNG a partir de src/icone.svg
npm run telas       build + o jogo em seis tamanhos de tela, dez situações cada
npm run textura     build + as texturas sobrevivem a sair do jogo e voltar (~40 s)
npm run lembrar     build + o que sobrevive a RECARREGAR a página
npm run shots       build + screenshots do jogo no Chrome de verdade
npm run online      testa o online abrindo duas abas e uma mesa real
npm run fechamento  caça fechamento forçado jogando milhares de mãos (~3 min)
npm run servir      sobe um servidor local (necessário para o online)

As duas suítes lentas aceitam escolher o que rodar:
    node tests/test-telas.mjs 360x640,390x844 nomes,cheia
    node tests/test-online.mjs --so=saguao
    node tests/test-online.mjs https://ricardocolombo01.github.io/domino-bar/
                                    ↑ testa o que está PUBLICADO, não o local

Primeira vez:  cd tests && npm install
               git config merge.ours.driver true      ← ver "Branches", abaixo
```

O que os testes cobrem:

- **As regras**, no terminal: mais de mil partidas bot×bot nos três modos, conferindo que
  ninguém joga peça inválida, que toda mão termina, que nenhuma peça some do baralho e que
  os quatro tipos de batida acontecem. Mais 53 mil tabuleiros, conferindo que nenhuma peça
  se sobrepõe e que a fila não tem buraco. Tudo isso é possível porque as regras e o layout
  são **funções puras**.
- **A força do bot** — a única asserção do projeto que mede *qualidade*: o difícil tem de
  ganhar do fácil acima do acaso, em 600 partidas. É um **limiar** (`> 2σ`) e não um número
  fixo, de propósito: mudança de regra move a porcentagem sem quebrar a asserção.
- **A tela**, no Chrome de verdade: seis tamanhos × dez situações. Reprova se a página
  transbordar, se um painel sair da viewport, se dois painéis se sobrepuserem, se um alvo
  de toque for menor que 40 px, se **uma peça cair fora do quadro**, se uma peça ficar
  **por baixo de um painel**, ou se **duas coisas do 3D se atravessarem** — a mão do
  vizinho e a linha da mesa medem a mesma tela em profundidades diferentes.
- **O que sobrevive**: recarregar a página (preferências, retomar a partida, reabrir a
  mesa online), e sair do jogo e voltar (num celular, isso pode levar o contexto WebGL
  **e** o bitmap dos canvas, e são coisas independentes).
- **O online**, com duas abas e uma mesa de verdade: que a mão do anfitrião **nunca**
  chega ao convidado, que cair e voltar devolve a mesma cadeira com a mesma mão, e que a
  mesma pessoa em três abas ocupa uma cadeira só.

A regra da casa sobre teste: **asserção que não fica vermelha antes do conserto não prova
nada.** Toda asserção nova é rodada contra o código com defeito primeiro, e as que nascem
verdes ficam ditas como guarda, não como prova. Quando a asserção cobre comportamento que
já está certo — e portanto não pode nascer vermelha —, a prova equivalente é **mutação**:
quebra-se de propósito a linha que ela deveria proteger e confere-se que ela cai.

### Branches

Uma regra local acima de tudo: **`main` é literalmente o que está no ar.** O GitHub Pages
publica dessa branch, então ela só recebe merge `--no-ff`, e sempre com tag.

**`main` é a única branch permanente.** Cada onda de trabalho vai numa branch com o nome da
versão que ela vai lançar — `v2`, `v3` —, que nasce de `main`, volta para `main` e é
apagada. A tag é o que fica.

```
main   … ── v1.10.0 ── v2.0.0 ── v2.2.0 ─────── v3.0.0 ── v3.1.0 ── v4.0.0 ─────── v4.1.0
                              ╲            ╱          ╲          ╱      ╲         ╱
                               ●──●──●──●──            ●──●──●──         ●──●──●──
                                     v2                     v3              v4.1
```

Até a v1.10.0 o projeto usava GitFlow, com uma `develop` entre as features e a `main`.
Aquela separação existe para dividir "pronto" de "publicado" — e aqui ela nunca teve
consequência, porque quem publica é uma pessoa, na mesma tarde. O que ela custava era real:
dois merges e dois rebuilds do bundle por release. **Um dia inteiro se perdeu por causa
disso**, com a `develop` em dia e a `main` três releases atrás. Hoje há um lugar a menos
para o trabalho ficar preso.

Vinte e cinco releases até aqui, e três delas dizem bem o que este repositório é: a **v1.6.0** foi a
primeira cujos itens vieram quase todos de **jogo de verdade, no celular**, e não de leitura
de código; a **v1.7.1** veio do contrário — uma varredura atrás do que ainda não tinha
incomodado ninguém; e a **v1.10.0** fechou os ramos que **existiam e nunca tinham rodado**.
São três jeitos diferentes de achar trabalho, e nenhum substitui os outros.

A **v2.0.0** trouxe o que a mesa online precisava para saber quem é quem: cada cadeira nasce
com um nome próprio (era "Você" para todo mundo, inclusive no placar do online), quem entra
pelo código **diz o seu nome** num campo do saguão, e o anfitrião **desempata nomes iguais** —
dois "Ricardo" viram "Ricardo" e "Ricardo2", com o número no primeiro nome porque é o único
pedaço que o cartão mostra em tela estreita. Junto foram dois defeitos de campo: as telas de
texto **voltam ao topo** quando você rola (a carta mais alta que a tela ficava com o começo
fora do alcance), e o convidado que **sai consegue voltar** — sair entrega a partida, não a
mesa, e a cadeira que virou bot por falta de gente volta a ser dele.

A **v2.2.0** fechou a **Fila 11**, a segunda varredura da história do projeto — e a primeira
release inteira feita de coisas que **nenhum jogador tinha relatado**, porque nenhuma delas
aparece jogando normalmente. Elas aparecem quando alguém desiste no meio de um clique, ou
quando alguém do outro lado do fio não está de boa-fé: um temporizador de rede que acordava
depois de você mudar de ideia e reabria uma mesa sozinho, um convidado capaz de **congelar a
mesa de todos** mandando um nome de 4 MB, campos numéricos indo para a tela sem escape, e uma
partida guardada corrompida que dava **tela preta a cada recarregamento**.

O que ela deixou de mais valioso não é conserto nenhum: é que o `conn.on('data')` — a porta
por onde entra tudo o que vem da rede — **não era alcançável por teste nenhum**, porque o
dublê do PeerJS engolia o registro de ouvintes. Quatro dos sete defeitos moravam ali.

A **v3.0.0** é a release em que o jogo **vira aplicativo** — instalável, com ícone próprio, e
abrindo sem internet depois da primeira partida. Junto veio o maior ganho de download da
história do projeto por uma linha só: o `three` era baixado **não minificado**, 1,27 MB onde
670 KB resolvem. E ela fechou as duas dívidas que decidiam se a separação em pastas era fato
ou promessa — a camada de rede não escreve mais uma única linha na tela (a tela do online
virou arquivo próprio), e as regras de dominó saíram do primeiro arquivo da casa, onde
estavam desde sempre. As duas dívidas estavam **anotadas com o diagnóstico errado**, e nos
dois casos foi medir que mostrou.

A **v4.0.0** e a **v4.1.0** transformam o jogo em **casa de jogos**. A primeira trocou os 46
nomes de dominó que a casa alcançava por um contrato — `JOGOS`, `JOGO`, e uma carga em três
tempos —, e a asserção dela não é suíte verde: é o número **zero**. A segunda pôs a **faixa
de abas** em cima disso, com o Truco Paulista já registrado e ainda sem motor, e resolveu o
que a aba obriga a resolver: a mesa e a partida passam a ser guardadas **por jogo** (com
migração do que já estava gravado, senão o conserto seria invisível justamente para quem mais
jogou), `?jogo=` na URL para o link ser compartilhável, e a faixa **travada com a mesa
ocupada** — trocar de jogo com uma partida viva gravaria a partida de um sob a chave do
outro. Ela também transformou a varredura de acoplamento, que vivia num arquivo temporário,
no `test-acoplamento`: o invariante "a casa não conhece jogo nenhum" passou de fotografia a
trava.

O dia a dia: `git switch -c v2` a partir de `main`, commits normais na branch, e no fim ela
sobe a `version` do `package.json`, roda `npm test`, e volta para `main` com `--no-ff` e a
tag. Correção urgente do que está no ar vai em `hotfix/x.y.z`, pelo mesmo caminho.

**O `index.html` é gerado e mesmo assim commitado** — não tem como não ser, é o arquivo
que o Pages serve e o que abre no duplo-clique. Para não gastar tempo resolvendo conflito
num bundle de 80 KB, o `.gitattributes` marca ele como `merge=ours`, o que exige uma vez
por clone:

```
git config merge.ours.driver true
```

E a regra que vem junto: **todo merge que tocou `src/` termina com
`npm run build && git add index.html`** antes de fechar o commit de merge. Antes de
qualquer push para `main`, `npm run check` diz se o bundle está desatualizado.
