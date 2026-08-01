# Dominó de Bar

Dominó dupla-seis em 3D numa mesa de boteco. De 2 a 4 jogadores, em qualquer mistura
de gente e bot, na mesma tela ou pela internet.

### ▶ Jogar agora: **https://ricardocolombo01.github.io/domino-bar/**

Também abre offline: duplo-clique no `index.html`. Só o modo online precisa do endereço
acima (ou de `npm run servir`) — a conexão P2P não fecha a partir de `file://`.

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

No menu dá para trocar a mesa (Clássico · Duelo · Trio) e mais duas regras que variam de
bar para bar: **compra voluntária** (comprar mesmo podendo jogar) e o **alvo da partida**.

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

Sem framework, sem bundler, sem asset. Madeira, piso, as pintas das peças e todos os sons
são gerados em código na hora — não há um único `.png` ou `.mp3` no repositório. Three.js
e PeerJS vêm de CDN. São **~5.100 linhas** entre `src/` e o CSS.

```
src/js/01-05   regras puras: baralho, encaixes, turnos, placar, bot
src/js/06      onde cada peça cai na mesa (o serpenteio e as dobras)
src/js/07-08   a cena do boteco e a peça em 3D
src/js/09-13   tabuleiro animado, mão em leque, cliques, som, HUD
src/js/14-16   menu das cadeiras, rede P2P, e a costura de tudo
```

Os arquivos de `src/js/` são **pedaços do mesmo escopo**, concatenados na ordem do número
por `build.mjs` — não têm `import`/`export` entre si. Isso existe porque o navegador
bloqueia módulos em `file://`: o código tem de chegar embutido na página para o
duplo-clique funcionar. O build ainda roda `node --check` no resultado, então erro de
sintaxe vira mensagem no terminal em vez de tela preta.

### Comandos

```
npm run build       junta src/ num index.html autossuficiente
npm run check       avisa se o index.html está desatualizado
npm test            build + as três suítes de lógica (segundos)
npm run telas       build + o jogo em seis tamanhos de tela, nove situações cada
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
- **A tela**, no Chrome de verdade: seis tamanhos × nove situações. Reprova se a página
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
verdes ficam ditas como guarda, não como prova.

### Branches

GitFlow, com uma regra local: **`main` é literalmente o que está no ar.** O GitHub Pages
publica dessa branch, então ela só recebe merge `--no-ff` de `release/*` ou `hotfix/*`, e
sempre com tag.

```
main    v1.0.0 ── v1.0.1 ── v1.1.0 ── … ── v1.6.0 ── v1.7.0 ── v1.7.1 ── v1.8.0
             ╲        ╱          ╱             ╱         ╱         ╱        ╱
develop       ●──●───●──────●───●─────────●───●──────●──●──────●──●─────●──●
               ╲    ╱        ╲   ╱             ╲    ╱            ╲      ╱
feature   fim-de-mao      modos-de-jogo    mesa-nao-atravessa   faixa-dos-jogadores
```

Onze releases até aqui. As duas últimas dizem bem o que este repositório é: a **v1.6.0**
foi a primeira cujos itens vieram quase todos de **jogo de verdade, no celular**, e não de
leitura de código; a **v1.7.1** veio do contrário — uma varredura em busca do que ainda
não tinha incomodado ninguém. Os dois modos se complementam: o campo acha o que incomoda,
a varredura acha o que ainda não incomodou.

O dia a dia sai de `develop`: `feature/x` nasce dela e volta com `--no-ff`. Quando
`develop` está redonda, `release/x.y.z` sobe a `version` do `package.json`, roda
`npm test`, e é mergeada em `main` (com a tag) e de volta em `develop`.

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
