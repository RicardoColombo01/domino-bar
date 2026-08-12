// AS REGRAS DO TRUCO PAULISTA: força, manilha, quem ganha a vaza e quem ganha a mão.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// PURO, como `030-regras.js` e `060-layout.js` do dominó (invariante 4): nada aqui toca em
// tela, em three, em armazenamento nem em `P`. É o que permite rodar milhares de mãos no
// terminal — e um erro de regra achado aqui custa segundos, achado depois do 3D custa horas.
//
// O QUE ESTE ARQUIVO SABE E O `40-cartas/` NÃO: que existe manilha. A biblioteca entrega
// naipe, valor e o desenho; a FORÇA é daqui, porque no pife e no vinte-e-um ela é outra. O
// `test-acoplamento` cobra a seta nesse sentido — biblioteca não alcança jogo.

// OS MODOS DA MESA, no formato que o menu da casa já sabe desenhar (`rotulo` e `nota` viram
// o botão, `cadeiras` diz quantas pessoas cabem). Um modo só, porque no truco a variação não
// é de baralho nem de mão: é de quantos sentam.
//
// TRÊS NÃO EXISTE, e não é esquecimento — o truco é de times, e três cadeiras não fecham dois
// times. O menu da casa apaga sozinho o botão que não está em `cadeiras`, então isto basta.
const MODOS_TRUCO = {
  paulista: { rotulo: 'Paulista', nota: '3 cartas, até 12', cartasPorMao: 3, cadeiras: [2, 4] },
};
const MODO_PADRAO_TRUCO = 'paulista';

// A ORDEM DO TRUCO, do mais fraco para o mais forte, em índices de `VALORES`.
//
//   VALORES  A  2  3  4  5  6  7  Q  J  K      (a ordem de baralho, em 045-baralho.js)
//   índice   0  1  2  3  4  5  6  7  8  9
//   truco    4  5  6  7  Q  J  K  A  2  3      ← esta linha, em índices, é o array abaixo
//
// Note que o 4 é a carta mais FRACA e o 3 a mais forte — é a inversão que faz o truco não
// ser nenhum outro jogo de baralho, e é o primeiro lugar onde alguém erra ao ler o código.
const ORDEM_TRUCO = [3, 4, 5, 6, 7, 8, 9, 0, 1, 2];

// A força do NAIPE entre manilhas, declarada AQUI por id e não pela posição em `NAIPES`.
// A ordem daquele array calha de ser a mesma, e isso é coincidência — depender dela seria
// ler regra de truco de dentro da pasta das cartas, que é o que a divisão existe para
// impedir. No dia em que alguém reordenar `NAIPES` por qualquer motivo, esta tabela segura.
const FORCA_NAIPE = { ouros: 0, espadas: 1, copas: 2, paus: 3 };

// Onde uma carta está na escada do truco: 0 é o 4 (a mais fraca), 9 é o 3 (a mais forte).
const postoDaCarta = c => ORDEM_TRUCO.indexOf(c[0]);

// A MANILHA É A SEGUINTE DA VIRA, e a volta é CÍCLICA: virou o 3 (o topo da escada), a
// manilha é o 4 (a base). Sem o módulo, virar o 3 não teria manilha — e virar o 3 é uma mão
// em dez.
//
// Devolve o ÍNDICE em `VALORES`, que é o mesmo alfabeto de `carta[0]`.
function manilhaDaVira(vira) {
  return ORDEM_TRUCO[(postoDaCarta(vira) + 1) % ORDEM_TRUCO.length];
}

// "Esta carta é manilha nesta mão?" — UMA definição, e ela mora aqui porque é regra.
//
// Ela nasceu para a TELA (o realce das manilhas na sua mão, em `550-mesa.js`), e mesmo assim
// não nasceu lá: a mesa teria de escrever `carta[0] === manilha` ou `forca >= 100`, e aí a
// mesma pergunta teria duas respostas escritas em arquivos diferentes. É o padrão que este
// projeto já pagou três vezes — o `28 - 7 * MESA.n` do menu, as duas cópias da regra da
// revanche, e o `'bot:' + nivel` montado à mão nas duas pontas do `<select>`.
//
// A GUARDA DE NULO É PARA A MÃO DE 11, que não tem vira e portanto não tem manilha:
// `vista.manilha` chega `null` (ou some no fio, virando `undefined`). Sem ela o resultado
// seria o mesmo por acidente — `carta[0]` é sempre um índice válido —, e acidente não é
// guarda: bastaria alguém passar a chamar isto com um valor que se compare mal.
const ehManilha = (carta, manilha) =>
  manilha !== null && manilha !== undefined && carta[0] === manilha;

// A força comparável de uma carta nesta mão. Duas faixas que não se encostam:
//
//   0 … 9      as cartas comuns, na escada do truco
//   100 … 103  as quatro manilhas, entre si desempatadas pelo naipe
//
// O salto para 100 não é enfeite: ele diz, em um número, que QUALQUER manilha bate QUALQUER
// carta comum. Comparar por faixa seria a mesma coisa com um `if` a mais e um lugar a mais
// para errar.
function forcaDaCarta(carta, manilha) {
  if (ehManilha(carta, manilha)) return 100 + FORCA_NAIPE[naipeDaCarta(carta).id];
  return postoDaCarta(carta);
}

// -1, 0 ou 1 — e o ZERO é o assunto todo deste jogo. Duas cartas comuns do mesmo valor
// empatam, mesmo com naipes diferentes: o naipe SÓ desempata entre manilhas. Quem trouxer o
// desempate por naipe para as cartas comuns faz o "melou" deixar de existir.
function compararCartas(a, b, manilha) {
  const fa = forcaDaCarta(a, manilha), fb = forcaDaCarta(b, manilha);
  return fa === fb ? 0 : (fa > fb ? 1 : -1);
}

// Quem ganhou a vaza. `jogadas` é `[{ cadeira, carta }, …]` na ordem em que caíram.
//
// Devolve a CADEIRA vencedora, ou `null` se empatou. Empate aqui é entre TIMES e não entre
// cadeiras: numa mesa de 4, se a carta mais forte foi jogada por dois adversários com o
// mesmo valor, melou; se as duas mais fortes são da MESMA dupla, a dupla ganhou e quem leva
// é a primeira delas (é ela quem sai na vaza seguinte).
function vencedorDaVaza(jogadas, manilha, time) {
  if (!jogadas.length) return null;
  let melhor = jogadas[0];
  let empatado = false;
  for (let i = 1; i < jogadas.length; i++) {
    const d = compararCartas(jogadas[i].carta, melhor.carta, manilha);
    if (d > 0) { melhor = jogadas[i]; empatado = false; continue; }
    // Só é empate de verdade se o outro for de OUTRO time. Duas cartas iguais da mesma
    // dupla não param nada — a dupla ganhou de qualquer jeito.
    if (d === 0 && time(jogadas[i].cadeira) !== time(melhor.cadeira)) empatado = true;
  }
  return empatado ? null : melhor.cadeira;
}

// O TIME DE UMA CADEIRA, PARTINDO DA VISTA. Irmão de `timeNoTruco` (520-partida.js), que
// parte de `P` — e são dois porque quem tem `P` é só o anfitrião: a tela do convidado só
// recebe a visão, e ela precisa da mesma conta para saber de que lado uma vaza caiu.
//
// Declarado UMA vez porque a fórmula já estava escrita à mão em três lugares (`530-bot.js`
// duas vezes, e agora os medidores) — é a doença do `28 - 7 * MESA.n` que o menu pagou: a
// aritmética copiada fica certa até o dia em que uma cópia não acompanha. As duas do bot
// continuam como estavam de propósito: substituí-las é trivial e não muda nada, mas o bot
// tem asserção de FORÇA medida, e mexer nele sem motivo é gastar risco à toa.
const timeDaVistaNoTruco = (vista, cadeira) => (vista.duplas ? cadeira % 2 : cadeira);

// ─── quem ganha a MÃO, e o melou ─────────────────────────────────────────────
// `vencedores` é o time que ganhou cada vaza, na ordem: um número, `null` para empate, ou
// `undefined` para vaza que ainda não aconteceu.
//
// A TABELA, decidida com o Ricardo em 06/08/2026 — as três primeiras são o paulista padrão,
// a última é a escolha da casa:
//
//   empatou a 1ª                  quem ganhar a 2ª leva a mão
//   ganhou a 1ª, empatou a 2ª     quem ganhou a 1ª leva
//   1 a 1, empatou a 3ª           quem ganhou a 1ª leva
//   empatou a 1ª e a 2ª           quem ganhar a 3ª leva
//   EMPATOU AS TRÊS               a MÃO MORRE, ninguém marca
//
// O fio condutor das três do meio é o mesmo: **a primeira vaza é o desempate de tudo**.
// Quem a ganhou leva qualquer mão que empate depois; e se nem ela decidiu, a mão morre.
// É a mesma leitura que o dominó desta casa já faz na tranca — "empatou, a mão morre" —, e
// foi esse o argumento da escolha.
function donoDaMao(vencedores) {
  const [a, b, c] = vencedores;
  const aberto = { time: null, aberto: true };

  if (a === undefined) return aberto;

  if (a === null) {                                   // empatou a primeira
    if (b === undefined) return aberto;
    if (b !== null) return { time: b, decidiuNa: 2 };
    if (c === undefined) return aberto;               // empatou a primeira E a segunda
    if (c !== null) return { time: c, decidiuNa: 3 };
    return { time: null, morreu: true, decidiuNa: 3 };
  }

  if (b === undefined) return aberto;
  if (b === null) return { time: a, decidiuNa: 2 };   // empatou a 2ª: leva quem fez a 1ª
  if (b === a) return { time: a, decidiuNa: 2 };      // duas vazas, acabou

  if (c === undefined) return aberto;                 // 1 a 1: a terceira decide
  if (c === null) return { time: a, decidiuNa: 3 };   // empatou a 3ª: leva quem fez a 1ª
  return { time: c, decidiuNa: 3 };
}

// ─── a aposta ────────────────────────────────────────────────────────────────
// A escada, e ela é fixa: uma mão vale 1; trucada vale 3; e daí sobe de três em três até
// doze. `null` no fim é o que diz "não dá para aumentar mais" — e é por isso que a escada é
// uma lista e não uma conta: `+3` continuaria para sempre, e doze é o teto.
const VALORES_DA_APOSTA = [1, 3, 6, 9, 12];
const proximaAposta = v => {
  const i = VALORES_DA_APOSTA.indexOf(v);
  return i < 0 || i + 1 >= VALORES_DA_APOSTA.length ? null : VALORES_DA_APOSTA[i + 1];
};

// O NOME que a mesa ouve. "Truco" é o primeiro pedido; do segundo em diante o pedido é o
// valor, que é como se fala na mesa ("seis!", "nove!") — e é o que o botão precisa dizer.
const NOME_DA_APOSTA = { 3: 'truco', 6: 'seis', 9: 'nove', 12: 'doze' };
