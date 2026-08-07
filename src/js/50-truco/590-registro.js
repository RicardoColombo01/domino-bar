// O TRUCO SE APRESENTA À CASA.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// A `emBreve` SAIU NA v4.5, e com ela a diferença entre registrado e jogável: o truco senta na
// mesa. Repare no que ele NÃO precisou escrever para isso — online P2P, identidade de cliente,
// reconexão, saguão, conversa, hotseat, som, boteco, enquadramento, gaveta, teclado, telas de
// fim e partida guardada vêm todos prontos da casa. É o invariante 2 cobrando o que prometeu:
// **uma cadeira é `voce`/`local`/`bot`/`online` e o motor não sabe a diferença.**
//
// O NÚMERO MUDOU DE 500 PARA 590 quando o motor chegou, e a razão é a ZONA MORTA. Um registro
// é executado NA HORA em que é concatenado, e ele cita `MODOS_TRUCO`, que é um `const`
// declarado no `510-regras.js`. `const` antes da declaração é `ReferenceError`, não
// `undefined` — tela preta na carga, e o `node --check` do build não pega, porque a sintaxe
// está perfeita.
//
// A regra que fica, e que o dominó já obedecia sem ninguém ter escrito: **o registro é o
// ÚLTIMO arquivo do jogo.** Função é içada e sobrevive à ordem; tabela não.

JOGOS.truco = {
  nome: 'Truco Paulista',
  curto: 'Truco',                 // o que cabe na aba; ver o do dominó para o motivo
  sub: '40 cartas, vira e manilha corrida. Sem envido e sem flor — o truco de bar.',

  // As regras. Ficam aqui, e não no HTML da casa, pelo mesmo motivo que as do
  // dominó saíram de lá: `src/pagina.html` é da casa, e a casa não sabe que jogo está na mesa.
  regras: [
    '<b>Baralho de 40:</b> saem o 8, o 9 e o 10.',
    '<b>Força:</b> 4 · 5 · 6 · 7 · Q · J · K · A · 2 · 3, da mais fraca para a mais forte.',
    '<b>A vira:</b> uma carta é virada a cada mão, e a <b>manilha</b> é a seguinte dela nessa ordem — virou 3, a manilha é o 4.',
    '<b>Entre manilhas</b> manda o naipe: ouros &lt; espadas &lt; copas &lt; paus.',
    '<b>A mão:</b> 3 cartas para cada, melhor de 3 vazas.',
    // O MELOU é regra de casa (decidida em 06/08/2026) e por isso está escrito na tela: as
    // três primeiras linhas são o paulista padrão, e a última tem mais de uma leitura
    // defensável por aí. Quem senta na mesa precisa saber qual vale AQUI.
    '<b>Empatou a vaza ("melou"):</b> a <b>primeira</b> vaza é o desempate de tudo — quem a ganhou leva qualquer mão que empate depois.',
    '<b>Empataram as três:</b> a mão <b>morre</b> e ninguém marca.',
    '<b>A aposta:</b> truco vale 3 · seis · nove · doze. Quem corre paga o que valia <b>antes</b> do pedido.',
    '<b>Mão de 11:</b> quem chega a 11 vê as cartas e decide jogar (valendo 3) ou entregar 1 ponto.',
    '<b>A partida</b> vai até 12, de 2 ou de 4 (duplas em cruz).',
    'Sair no meio <b>conta como derrota</b>. Quem cai no online tem 30 s para voltar.',
  ],

  // ─── o motor ───────────────────────────────────────────────────────────────
  motor: {
    nova: novaPartidaDoTruco,
    visao: visaoDoTruco,
    proximaMao: novaMaoDoTruco,
    time: timeNoTruco,
    abandonar: abandonarOTruco,
    // DUAS FASES, e é este jogo que obrigou a casa a parar de escrever `fase === 'mao'`: na
    // mão de 11 a vez é sua, o motor espera por você, e não há carta a jogar.
    emJogo: p => p.fase === 'mao' || p.fase === 'onze',
    aplicar: aplicarNoTruco,
    semAMao: semAMaoNoTruco,
    abertura: aberturaDoTruco,
    // `paraGuardar` e `deVolta` NÃO entram: o `P` do truco é dado puro, e a casa cai na
    // identidade. Um encaixe que não se declara é um encaixe que não custa nada.
    partidaValida: partidaDoTrucoValida,
  },

  // ─── a mesa em 3D ──────────────────────────────────────────────────────────
  mesa: {
    sincronizar: sincronizarTrucoNaMesa,
    animar: animarTrucoNaMesa,
    esconderMao: esconderMaoDoTruco,
    arrumar: arrumarMaoDoTruco,
    esquecerArrumacao: esquecerArrumacaoDoTruco,
    redesenhar: redesenharMaoDoTruco,
    // AS MEDIDAS QUE O ASSENTO PRECISA. A carta é mais larga e MUITO mais fina que a peça, e
    // é por isso que estes quatro existem: com os números do dominó cravados no `070-cena.js`,
    // o adversário do truco passaria por cima do vizinho.
    larguraDaPeca: () => CARTA_C,
    espessuraDaPeca: () => CARTA_E,
    alturaDaMao: () => MAO_TRUCO_Y,
    profundidadeDaMao: () => MAO_TRUCO_Z,
    caixaDoAssento: caixaDoAssentoDoTruco,
  },

  // ─── escolher → ver → confirmar ────────────────────────────────────────────
  toque: {
    selecionar: selecionarCarta,
    cancelar: cancelarEscolhaNoTruco,
    confirmar: confirmarNoTruco,
    reavaliar: reavaliarEscolhaNoTruco,
    ponteiro: atualizarPonteiroDoTruco,
    // Lido na HORA, nunca copiado: é um `let` que muda a cada quadro.
    apontada: () => apontadaNoTruco,
  },

  // ─── o bot ─────────────────────────────────────────────────────────────────
  // O nível continua sendo QUANTA INFORMAÇÃO ele recebe — e aqui a mesma nota decide jogar E
  // apostar, que é o que impede trucar com lixo e correr com manilha.
  bot: { jogada: jogadaDoBotNoTruco, dica: dicaDoTrucoParaACasa, NIVEIS: NIVEIS_TRUCO },

  // ─── o menu ────────────────────────────────────────────────────────────────
  menu: {
    MODOS: MODOS_TRUCO,
    MODO_PADRAO: MODO_PADRAO_TRUCO,
    ALVOS: ALVOS_DO_TRUCO,
    OPCOES: OPCOES_DO_TRUCO,
    nota: notaDaMesaDoTruco,
  },

  // ─── o que a casa desenha e o jogo descreve ────────────────────────────────
  // `painel` NÃO entra: o painel de apoio do dominó conta quantas peças de cada número já
  // saíram, e o truco não tem essa pergunta — as vazas ganhas estão empilhadas na mesa, à
  // vista. Sem a chave, a casa esconde o botão "Contar" em vez de oferecer uma gaveta vazia.
  hud: {
    medidores: medidoresDoTruco,
    barra: barraDoTruco,
    fimDeMao: fimDeMaoDoTruco,
  },

  // ─── o que as SUÍTES precisam alcançar ─────────────────────────────────────
  // Substitui o `window.__cartas` da v4.2, que era bancada temporária: as cartas passam a
  // chegar pela ponte do jogo, como as peças do dominó.
  ponte: {
    jogadaDoBot: jogadaDoBotNoTruco, dicaDaVista: dicaDoTruco,
    grupoMesa: grupoMesaDoTruco, grupoPrevia: grupoPreviaDoTruco,
    grupoOutros: grupoOutrosDoTruco, grupoMao: grupoMaoDoTruco,
    naMao: naMaoDoTruco, naMesa: naMesaDoTruco,
    arrumarMao: arrumarMaoDoTruco,
    criarCarta, criarVersoDeCarta, criarFantasmaDeCarta, faceDaCarta,
    medidasDaCarta: { CARTA_L, CARTA_C, CARTA_E, CEL_CARTA, COLS_CARTA, LINS_CARTA },
    // A ORDEM DA TELA, que desde a arrumação não é a de `vista.mao`.
    get maoNaTela() { return naMaoDoTruco.map(m => m.carta); },
    // Faz exatamente o que o toque faria. Recebe a CARTA e não o índice, pelo motivo de
    // sempre: índice de tela quebra calado quando a mão reordena.
    selecionar: carta => selecionarCarta(naMaoDoTruco.findIndex(m => mesmaCarta(m.carta, carta))),
  },
};
