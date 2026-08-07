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
  // O NOME QUE CABE NA ABA. Mesma razão do `short_name` do manifest: em 360px de tela a faixa
  // tem ~320px para todas as abas, e dois nomes cheios já não cabem — sem isto a faixa
  // transborda numa tela que o `test-telas` mede.
  curto: 'Dominó',
  sub: 'Dupla-seis, regras de bar. Você escolhe quem senta em cada cadeira.',

  // O QUE ESTAVA GUARDADO SEM SUFIXO É MEU. Até a v4.0 havia um jogo só, então as chaves
  // `dominobar.mesa` e `dominobar.partida` só podiam ser de dominó. Da v4.1 em diante cada
  // jogo guarda a sua (`…​.domino`, `…​.truco`), e esta marca é o que autoriza a casa a
  // migrar o acervo antigo — ver `migrarOGuardadoSemSufixo`, em 010-constantes.js.
  //
  // JOGO NOVO NÃO PODE DECLARAR ISTO. Não é uma opção de contrato: é um fato histórico de
  // um jogo só, e dois donos para o mesmo acervo seria uma corrida para ver quem migra
  // primeiro.
  herdaOGuardadoSemSufixo: true,

  // ─── as regras, escritas onde elas valem ───────────────────────────────────
  // Estavam em `src/pagina.html`, dentro do `<details>` do menu — doze linhas de regra de
  // dominó no HTML da CASA, que é o arquivo que promete não saber que jogo está na mesa. É o
  // mesmo vazamento que a Fase 1 tirou do JavaScript, sobrevivendo no HTML porque a varredura
  // por AST não enxerga marcação.
  //
  // A casa fica com a MOLDURA (o `<details>`, o "As regras desta casa", o `<li>`) e o jogo
  // entrega o texto de dentro.
  regras: [
    '<b>Clássico:</b> 28 peças, 7 para cada, de 2 a 4 jogadores.',
    '<b>Duelo:</b> 1v1 com o baralho inteiro na mão — 14 para cada, sem monte.',
    '<b>Trio:</b> a bucha de zero sai do baralho, sobram 27 e dão 9 para cada um dos três, sem monte.',
    '<b>Sem monte</b> (Duelo, Trio e o Clássico de 4): quem não pode jogar, passa.',
    '<b>Com monte</b> (Clássico de 2 ou 3): quem não pode jogar <b>compra até conseguir</b>; só passa se o monte secar.',
    'No Clássico de 4, duplas em cruz (1&amp;3 × 2&amp;4).',
    'Mão carroçuda demais volta para a mesa e todo mundo embaralha de novo.',
    'A primeira mão abre com o <b>6|6</b> — ou, se ele estiver no monte, com a maior carroça. Depois, abre quem bateu.',
    'Batida: simples <b>1</b> · carroça <b>2</b> · lá-e-lô <b>2</b> · cruzada <b>4</b>.',
    'Trancou: marca 1 ponto quem tiver a mão mais leve. Empatou, a mão morre.',
    '<b>Não dá para trancar de propósito:</b> a jogada que você sabe que trava a mesa — <b>você inclusive</b> — fica proibida enquanto houver outra. Se você ainda responde às pontas, o jogo não trava e a jogada vale. Carroça não conta: ela não muda o número da ponta.',
    'Sair no meio <b>conta como derrota</b>. Quem cai no online tem 30 s para voltar.',
  ],

  // ─── o motor ───────────────────────────────────────────────────────────────
  // Turnos, pontuação e a fronteira de segurança. `visao` é o invariante 3: é literalmente o
  // que trafega no online, e o anfitrião nunca manda a mão alheia.
  motor: {
    nova: novaPartida,
    visao: visaoDe,
    proximaMao: novaMao,
    time: timeDe,
    abandonar,
    // "HÁ UMA VEZ DE ALGUÉM AGIR?" — serve tanto para a partida quanto para a vista, porque
    // as duas carregam `fase` e `vez`. Era `fase === 'mao'` escrito em quatro lugares da
    // casa, e o truco denunciou: lá a mão de 11 é uma fase em que a vez é sua e não há carta
    // a jogar.
    emJogo: p => p.fase === 'mao',
    // A intenção inteira, validada e aplicada aqui dentro. Substituiu `jogar`/`comprar`/
    // `passar` + `jogadaDoFio` + `nomeDoFim` + a narração escrita na casa — cinco encaixes
    // por um, e a casa deixou de saber que uma jogada tem peça e ponta.
    aplicar: aplicarNoDomino,
    semAMao: semAMaoNoDomino,
    abertura: aberturaDoDomino,
    // O que não sobrevive ao JSON e o que só este jogo confere na partida guardada.
    paraGuardar: guardarODomino,
    deVolta: dominoDeVolta,
    partidaValida: partidaDoDominoValida,
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
    // `anguloDaCadeira` SAIU DO CONTRATO na v4.4: ele estava aqui só porque o nome morava no
    // dominó, e a conta é da mesa. Foi para `10-casa/010-constantes.js` e a casa passou a
    // chamá-la direto. **Um encaixe some quando o que ele carregava se descobre da casa** —
    // e o contrato ficar menor é o sinal de que a fronteira melhorou, não piorou.
    // Era `caixaDoMonte`, e o nome mentia desde sempre: o que ela mede é a FILEIRA do
    // adversário naquele assento — a caixa que a mão dele ocupa no tampo —, e não o monte.
    // Com o truco lendo o mesmo encaixe, um nome que só faz sentido num dos jogos passava a
    // custar uma explicação por leitura.
    caixaDoAssento: caixaDoMonte,
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
  //
  // `dica` devolve o que DIZER e o que FAZER; o `dicaDaVista` cru continua na ponte, para as
  // suítes que perguntam pela jogada e não pela frase.
  bot: { jogada: jogadaDoBot, dica: dicaDoDominoParaACasa, NIVEIS },

  // ─── o menu ────────────────────────────────────────────────────────────────
  // `baralho` e `sobra` SAÍRAM do contrato: a casa os chamava para escrever "28 peças, 7 para
  // cada" e para saber se a compra livre valia — duas frases de dominó. Hoje ela pede a nota
  // pronta e pergunta à própria opção se ela vale. Contrato menor, fronteira melhor.
  menu: { MODOS, MODO_PADRAO, ALVOS: ALVOS_DO_DOMINO, OPCOES: OPCOES_DO_DOMINO, nota: notaDaMesaDoDomino },

  // ─── o que a casa DESENHA e o jogo descreve ────────────────────────────────
  // O painel de apoio já era um encaixe desde a v3.0.0 (`painelDoJogo`). A v4.5 generalizou
  // os outros quatro pelo mesmo desenho: a casa reserva o lugar e chama, o jogo preenche.
  painel: desenharContagem,
  hud: {
    medidores: medidoresDoDomino,
    barra: barraDoDomino,
    fimDeMao: fimDeMaoDoDomino,
    // O botão que ABRE o painel acima. O rótulo e a promessa são do jogo — era a última
    // frase de dominó viva no `src/pagina.html`.
    painelBotao: {
      rotulo: 'Contar',
      titulo: 'Mostrar quantas peças de cada número já apareceram',
    },
  },

  // ─── o que as SUÍTES precisam alcançar ─────────────────────────────────────
  // A ponte `window.__jogo` (160-loop.js) expunha `grupoMonte`, `naMao` e `jogadaDoBot` —
  // ou seja, a casa listava nomes de dominó para os testes acharem. Um teste que precisa de
  // `grupoMonte` está pedindo uma coisa DO JOGO, e quem sabe se ela existe é o jogo.
  //
  // O arranque despeja isto por cima da ponte, então AS CHAVES CONTINUAM AS MESMAS e
  // nenhuma linha de suíte mudou. Um jogo sem monte simplesmente não põe `grupoMonte` aqui.
  ponte: {
    jogadaDoBot, dicaDaVista,
    grupoMesa, grupoPrevia, grupoOutros, grupoMonte,
    naMao, arrumarMao, moverNaMao,
    // A ORDEM DA TELA, que desde a arrumação não é mais a de `vista.mao`. Quem quiser
    // selecionar uma peça tem de procurar aqui.
    get maoNaTela() { return naMao.map(m => m.peca); },
    // Faz exatamente o que o clique faria: levanta a peça, mostra os fantasmas e a barra.
    // Recebe a PEÇA e não o índice — igual ao motor, e pelo mesmo motivo: índice de tela era
    // o único acoplamento do repositório que quebrava calado quando a mão reordenava.
    selecionar: peca => selecionarPeca(naMao.findIndex(m => mesmaPeca(m.peca, peca))),
  },
};
