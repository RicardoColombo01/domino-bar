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
    // As duas da Onda F são regra de casa (pedidas em 13/08/2026, decididas em 14/08) e por
    // isso estão na tela, como o melou: quem senta precisa saber qual vale AQUI.
    '<b>Esconder a carta:</b> da 2ª vaza em diante dá para jogar de barriga para baixo — ela <b>não vale nada</b>. Se todos esconderem, a vaza mela.',
    '<b>Mão de 11:</b> quem chega a 11 vê as cartas e decide jogar (valendo 3) ou entregar 1 ponto.',
    '<b>Mão de ferro:</b> 11 a 11, todos jogam <b>sem ver</b> as próprias cartas (elas caem abertas na mesa). Não há truco: quem faz a mão <b>leva a partida</b>.',
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
    // O irmão dele para a vista do fio. Mais frouxo de propósito — ver o comentário dele.
    vistaValida: vistaDoTrucoValida,
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
    // O SEXTO ENCAIXE, e o primeiro OPCIONAL da série: a casa escreve "Vez de Fulano" e o
    // jogo acrescenta o que mais importa naquele instante. O dominó não o declara, e a casa
    // trata a ausência como "nada a dizer" em vez de exigir um `() => ''` de todo mundo.
    notaDaVez: notaDaVezNoTruco,
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

    // ─── O QUE ESTÁ NO TAMPO ────────────────────────────────────────────────
    // O `test-telas` lia `grupoMesa`, `grupoOutros` e `grupoMonte` cravados. Numa mesa de
    // truco o `grupoMonte` NÃO EXISTE — `porAPonteDoJogo` (141-abas.js) apaga as chaves do
    // jogo anterior de propósito, para a ponte não mentir — e a suíte estourava. Hoje cada
    // jogo declara a própria mesa e a suíte itera o que vier; é o mesmo desenho dos cinco
    // encaixes de HUD da v4.5. Ver o irmão em `30-domino/300-registro.js`, que declara três
    // grupos porque tem monte.
    //
    // Cada item é `{ nome, curto, grupo, pular? }`:
    //   nome   frase da mensagem de falha — "X e Y ocupam o mesmo tampo"
    //   curto  uma palavra, a coluna do log que um humano compara entre duas rodadas
    //   grupo  o THREE.Group cujos filhos são medidos (caixa, extremo em NDC, cobertura)
    //   pular  filho que não conta na medida — a prévia pousa fora da linha por definição
    //
    // O que existe na mesa do truco: `grupoMesaDoTruco` (a vira, a vaza em curso e as
    // pilhas de vazas ganhas moram TODOS aqui — ver `sincronizarMesaDoTruco`),
    // `grupoOutrosDoTruco` (as cartas de costas dos adversários), `grupoPreviaDoTruco`
    // (dentro do grupo da mesa) e `grupoMaoDoTruco` (a SUA mão, que já é medida à parte,
    // pelo `naMao` — declará-la aqui a mediria duas vezes e faria a mão colidir consigo).
    //
    // DOIS grupos, e a mesa é UM só — não três. A vira, a vaza em curso e as pilhas de
    // vazas ganhas são irmãs achatadas dentro de `grupoMesaDoTruco`, e o preço está dito de
    // frente: `folgaEntre` só compara ENTRE grupos, nunca dentro de um, então esta suíte
    // nunca perguntará se a pilha de uma dupla encavalou a vira. Separá-las exigiria criar
    // um `THREE.Group` novo em `550-mesa.js` — mudar o JOGO para servir ao teste, que é a
    // direção errada, e o mesmo raciocínio que recusou o truco expor um monte vazio. Quem
    // cobre o interior da mesa é o `test-truco` (as postas e a amarração carta↔assento); é
    // o papel que o `test-mesa` faz para o dominó, e é por isso que lá um grupo também basta.
    //
    // A SUA MÃO fica fora, e não por esquecimento: o `naMao` já a mede carta a carta, com a
    // mesma câmera. Declará-la aqui a compararia consigo mesma e a folga mínima da suíte
    // passaria a ser a distância entre duas cartas do seu leque — um número que não é
    // defeito nenhum, medido no lugar do que importa.
    gruposDaMesa: () => [
      { nome: 'a mesa', curto: 'mesa', grupo: grupoMesaDoTruco, pular: grupoPreviaDoTruco },
      { nome: 'a mão de um adversário', curto: 'outros', grupo: grupoOutrosDoTruco },
    ],

    // "3 de paus", e não "3|1" nem "3p". O nome sai da BIBLIOTECA (`045-baralho.js`), que já
    // é quem sabe falar de carta — inventar um segundo jeito de nomear a mesma coisa é como
    // duas metades passam a discordar. Ele aparece uma carta por mensagem ("a peça X da sua
    // mão está por baixo de #contagem"), então o comprimento não custa nada.
    rotuloDaMao: m => nomeDaCarta(m.carta),

    criarCarta, criarVersoDeCarta, criarFantasmaDeCarta, faceDaCarta,
    medidasDaCarta: { CARTA_L, CARTA_C, CARTA_E, CEL_CARTA, COLS_CARTA, LINS_CARTA },
    // A ORDEM DA TELA, que desde a arrumação não é a de `vista.mao`.
    get maoNaTela() { return naMaoDoTruco.map(m => m.carta); },
    // Faz exatamente o que o toque faria. Recebe a CARTA e não o índice, pelo motivo de
    // sempre: índice de tela quebra calado quando a mão reordena.
    selecionar: carta => selecionarCarta(naMaoDoTruco.findIndex(m => mesmaCarta(m.carta, carta))),
  },
};
