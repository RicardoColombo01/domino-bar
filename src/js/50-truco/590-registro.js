// O TRUCO SE APRESENTA À CASA — e ainda não tem o que jogar.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// POR QUE ELE EXISTE ANTES DE EXISTIR. A aba de escolher o jogo é o mecanismo desta fase, e
// mecanismo com uma opção só não é mecanismo: a URL, a preferência guardada, a validação
// contra entrada de fora e as chaves de armazenamento por jogo ficariam todas sem uma linha
// de teste até a v6. Com este arquivo, `JOGOS` tem duas entradas de verdade e cada uma dessas
// coisas passa a ser exercitável hoje.
//
// `emBreve: true` é o que separa REGISTRADO de JOGÁVEL (ver `jogavel`, em 010-constantes.js).
// A casa lista este jogo na faixa de abas e o abre; o que ela não faz é montar mesa, porque
// não há motor para sentar nela. Quando a Fase 4 chegar, esta linha sai e as outras entram —
// `motor`, `mesa`, `toque`, `bot`, `menu` —, exatamente como o dominó tem em 300-registro.js.
//
// O NÚMERO MUDOU DE 500 PARA 590 quando o motor chegou, e a razão é a ZONA MORTA. Um registro
// é executado NA HORA em que é concatenado, e a partir da Fase 4 ele cita `MODOS_TRUCO`, que
// é um `const` declarado no `510-regras.js`. `const` antes da declaração é `ReferenceError`,
// não `undefined` — tela preta na carga, e o `node --check` do build não pega, porque a
// sintaxe está perfeita.
//
// A regra que fica, e que o dominó já obedecia sem ninguém ter escrito: **o registro é o
// ÚLTIMO arquivo do jogo.** O do dominó é 300 e os arquivos dele vão até 135. Função é içada
// e sobrevive à ordem; tabela não.

JOGOS.truco = {
  nome: 'Truco Paulista',
  curto: 'Truco',                 // o que cabe na aba; ver o do dominó para o motivo
  sub: '40 cartas, vira e manilha corrida. Sem envido e sem flor — o truco de bar.',

  // O QUE FALTA, dito na tela em vez de escondido. Botão apagado sem explicação é o jogo
  // emudecendo, e esta casa já pagou por isso duas vezes (a compra livre no Duelo, o
  // `selecionarPeca` que desistia calado).
  emBreve: 'O truco ainda não senta nesta mesa. As cartas e as regras vêm nas próximas duas '
    + 'ondas; o online, a conversa e as cadeiras já estão prontos e ele herda os três.',

  // As regras que VÃO valer. Ficam aqui, e não no HTML da casa, pelo mesmo motivo que as do
  // dominó saíram de lá: `src/pagina.html` é da casa, e a casa não sabe que jogo está na mesa.
  regras: [
    '<b>Baralho de 40:</b> saem o 8, o 9 e o 10.',
    '<b>Força:</b> 4 · 5 · 6 · 7 · Q · J · K · A · 2 · 3, da mais fraca para a mais forte.',
    '<b>A vira:</b> uma carta é virada a cada mão, e a <b>manilha</b> é a seguinte dela nessa ordem — virou 3, a manilha é o 4.',
    '<b>Entre manilhas</b> manda o naipe: ouros &lt; espadas &lt; copas &lt; paus.',
    '<b>A mão:</b> 3 cartas para cada, melhor de 3 vazas.',
    '<b>A aposta:</b> truco vale 3 · seis · nove · doze.',
    '<b>Mão de 11:</b> quem chega a 11 vê as cartas e decide jogar ou entregar 1 ponto.',
    '<b>A partida</b> vai até 12.',
  ],
};
