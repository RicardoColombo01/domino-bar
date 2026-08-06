// O DOMINÓ SE APRESENTA À CASA. É o único arquivo desta pasta que a casa enxerga.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Até a v3 a casa chamava o dominó pelo nome — `novaPartida(...)`, `sincronizarMao(v)`,
// `selecionarPeca(i)`. Funciona com um jogo só, e para de funcionar com dois. Aqui o dominó
// pendura um CONTRATO em `JOGOS`, e a casa passa a falar com `JOGO.motor.x`.
//
// O CONTRATO É DE VERBOS, NÃO DE NOMES INTERNOS, e a distinção é o ponto todo. Espelhar os
// 46 nomes que a casa usava hoje obrigaria o truco a ter um `sincronizarMonte` — e truco não
// tem monte. O que a casa precisa dizer é "sincronize a mesa com esta vista", "anime",
// "qual a largura de uma peça". Como cada jogo faz isso é problema dele.
//
// O número 300 põe este arquivo depois de toda a `10-casa/` (010…160) e depois de todo o
// resto do dominó: ele REFERENCIA tudo, então tem de vir por último. É o segundo dos três
// tempos de carga descritos em `010-constantes.js`.

JOGOS.domino = {
  nome: 'Dominó de Bar',
  sub: 'Dupla-seis, regras de bar. Você escolhe quem senta em cada cadeira.',

  // ─── o motor ───────────────────────────────────────────────────────────────
  // Turnos, pontuação e a fronteira de segurança. `visao` é o invariante 3: é literalmente o
  // que trafega no online, e o anfitrião nunca manda a mão alheia.
  motor: {
    nova: novaPartida,
    visao: visaoDe,
    jogar, comprar, passar,
    proximaMao: novaMao,
    time: timeDe,
    abandonar,
    // "esta jogada que chegou pelo fio tem forma de jogada deste jogo?" — a guarda que
    // impede uma mensagem torta de derrubar a mesa do anfitrião (C3 da Fila 11). No dominó
    // é um par de números de 0 a 6; no truco será uma carta.
    jogadaDoFio: p => Array.isArray(p) && p.length === 2
      && p.every(n => Number.isInteger(n) && n >= 0 && n <= MAX_PINTAS),
    // Duas jogadas são a mesma? O arrasto e a seleção precisam comparar sem saber a forma.
    mesmaJogada: mesmaPeca,
    // Como se chama o jeito como a mão acabou ("batida de carroça", "jogo trancado").
    nomeDoFim: tipo => NOME_BATIDA[tipo] || '',
  },

  // ─── a mesa em 3D ──────────────────────────────────────────────────────────
  // Quatro verbos, e não os vinte e um nomes que a casa alcançava antes.
  mesa: {
    sincronizar(v) { sincronizarTabuleiro(v); sincronizarMao(v); sincronizarOutros(v); sincronizarMonte(v); },
    animar(dt, apontada) { animarTabuleiro(dt); animarMao(dt, apontada); },
    esconderMao,
    arrumar: arrumarMao,
    esquecerArrumacao,
    mover: moverNaMao,
    redesenhar: redesenharMao,
    // O array vivo das peças na sua mão, para o raycast e para o arrasto. A referência é
    // estável (é um `const []` que o dominó só mutila por dentro), então vai direto.
    naMao,
    // Os grupos que o raycast atravessa. Devolvido por função porque um jogo pode montá-los
    // depois — e porque o truco terá outros.
    grupos: () => [grupoMesa, grupoPrevia, grupoOutros, grupoMonte],

    // AS MEDIDAS QUE O ASSENTO PRECISA. Era aqui que o 3D da casa vazava: `070-cena.js`
    // media o assento do adversário com `PECA_C`/`PECA_E` e chamava `caixaDoMonte` — ou
    // seja, o boteco sabia o tamanho de uma peça de dominó. Uma carta tem outra proporção, e
    // sem isto ela não caberia na conta.
    larguraDaPeca: () => PECA_C,
    espessuraDaPeca: () => PECA_E,
    alturaDaMao: () => MAO_Y,
    profundidadeDaMao: () => MAO_Z,
    anguloDaCadeira,
    caixaDoMonte,
  },

  // ─── escolher → ver → confirmar ────────────────────────────────────────────
  toque: {
    selecionar: selecionarPeca,
    cancelar: cancelarEscolha,
    confirmar: confirmarJogada,
    reavaliar: reavaliarEscolha,
    ponteiro: atualizarPonteiro,
    // `apontada` é um `let` que muda a cada quadro — tem de ser lido na hora, nunca copiado
    // no registro, senão o realce congela no valor que existia na carga.
    apontada: () => apontada,
  },

  // ─── o bot ─────────────────────────────────────────────────────────────────
  // Níveis são QUANTA INFORMAÇÃO o bot recebe, não três algoritmos — e a dica é o bot
  // pensando com a sua mão, o que só é possível porque ele nunca trapaceou.
  bot: { jogada: jogadaDoBot, dica: dicaDaVista, NIVEIS },

  // ─── o menu ────────────────────────────────────────────────────────────────
  menu: { MODOS, MODO_PADRAO, baralho: baralhoDoModo, sobra: sobraDoBaralho },

  // ─── os dois encaixes da tela ──────────────────────────────────────────────
  // O painel de apoio já era um encaixe desde a v3.0.0 (`painelDoJogo`); ele passa a chegar
  // pelo contrato, junto com os outros, em vez de por uma atribuição solta.
  painel: desenharContagem,
};
