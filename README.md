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
| **Bot** | fácil, normal ou difícil |
| **Pessoa online** | alguém que entrou com o código da mesa |

O motor de regras não sabe a diferença. Ele diz de quem é a vez e espera. Por isso
"2 humanos online + 1 bot" não é um caso especial — é só outro preenchimento, e sai de
graça. Bot nunca é obrigatório: dá para montar mesa só de gente.

## Como se joga

- **Clique na peça** que quer jogar. Se ela só serve numa ponta, ela vai sozinha.
- Se ela serve **nas duas** (o lá-e-lô), as duas pontas acendem — clique na que quiser.
- Peça que não encaixa fica apagada. `Esc` desfaz a escolha.
- **Comprar do monte** e **Passar a vez** aparecem no canto quando são possíveis.
- No revezamento local, a tela avisa "passe o computador para o Zé" e **apaga as peças
  da cena** antes de trocar — não é só um overlay por cima.

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
  encaixam nas duas pontas já estiverem na mesa ou na sua mão — ou seja, se você *sabe*
  que travou —, essa jogada fica proibida enquanto houver outra. A conta é feita só com o
  que você enxerga, de propósito: se o jogo olhasse a mão dos outros para decidir, apagar
  a peça na tela te contaria que ninguém tem aquele número. Carroça não conta, porque
  jogada numa ponta ela deixa a ponta no mesmo número.
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

Se alguém cair no meio da partida, **a cadeira fica guardada por 30 segundos** — dá para
voltar pelo mesmo código e retomar a mão. Passado o prazo, a partida é dada como perdida
para quem saiu, e a mesa fica sabendo o motivo. Fechar a aba deixou de ser a saída de
emergência de partida mal encaminhada; para sair de verdade existe o **✕** no canto, que
avisa o preço antes.

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
e PeerJS vêm de CDN.

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
npm run build     junta src/ num index.html autossuficiente
npm run check     avisa se o index.html está desatualizado
npm test          build + as três suítes de lógica
npm run telas     build + o jogo aberto em cinco tamanhos de tela
npm run shots     build + screenshots do jogo no Chrome de verdade
npm run online    testa o online abrindo duas abas e uma mesa real
npm run servir    sobe um servidor local (necessário para o online)

Primeira vez:  cd tests && npm install
               git config merge.ours.driver true      ← ver "Branches", abaixo
```

O que os testes cobrem: mais de mil partidas bot×bot — nos três modos — conferindo que
ninguém joga peça inválida, que toda mão termina, que nenhuma peça some do baralho e que
os quatro tipos de batida acontecem; 53 mil tabuleiros conferindo que nenhuma peça se
sobrepõe e que a fila não tem buraco; e o jogo inteiro montado em Node, com cena Three.js
de verdade, incluindo a mão de 14 do Duelo em duas fileiras.

### Branches

GitFlow, com uma regra local: **`main` é literalmente o que está no ar.** O GitHub Pages
publica dessa branch, então ela só recebe merge `--no-ff` de `release/*` ou `hotfix/*`, e
sempre com tag.

```
main      v1.0.0 ─────────────────────────── v1.0.1 ──────── v1.1.0
               ╲                            ╱               ╱
develop         ●───●───●───●──────────────●───●───●───────●
                 ╲     ╱                        ╲         ╱
feature      fim-de-mao-com-pontos           modos-de-jogo
```

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
