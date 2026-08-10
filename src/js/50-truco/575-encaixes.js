// O QUE A CASA PEDE, respondido em truco.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Irmão do `30-domino/137-encaixes.js`, e a existência dos dois é a prova de que os encaixes
// da v4.5 são contrato e não molde: o dominó responde "Pontas · Monte · Mão" e "Comprar do
// monte"; o truco responde "Vira · Manilha · Vale" e "Pedir truco / Aceitar / Correr". A casa
// desenha os dois sem saber de nenhum.
//
// AQUI MORA A SEGUNDA DIMENSÃO DE JOGADA que o dominó não tem. No dominó você joga uma peça e
// pronto. No truco você joga uma carta OU aposta — e apostar INTERROMPE o turno para o outro
// time responder. É por isso que a barra de ações precisou de encaixe: ela deixou de ser
// "duas ações que o motor às vezes oferece" e passou a ser uma conversa.

// ─── os medidores do #topo ───────────────────────────────────────────────────
// Três, como no dominó, e não por simetria: `#topo` divide a largura com o placar e com o
// código da sala, e em retrato ele já transbordou uma vez por um painel a mais.
//
// A VIRA E A MANILHA são as duas, juntas, porque sozinhas nenhuma serve: a vira está na mesa
// e dá para ver, mas quem NÃO joga truco todo dia não sabe derivar a manilha dela de cabeça —
// e quem não sabe qual é a manilha não sabe o que tem na mão.
// CONTINUAM SENDO TRÊS, e a VIRA foi a que saiu — em 07/08, para o placar de vazas entrar.
//
// O quarto painel foi tentado e MEDIDO: em retrato os seis tamanhos passavam, e em paisagem
// 640×360 ele empurrou o `#topo` por cima da mão de um adversário. Conferido por mutação —
// tirando só o painel novo, a cena volta a passar. Não é opinião sobre "ficou cheio": é a
// única tela em que o `#topo` divide a faixa com as duas colunas.
//
// A VIRA É A CERTA A SAIR, e o comentário original já dizia por quê sem perceber: "a vira
// está na mesa e dá para ver, mas quem não joga truco todo dia não sabe derivar a manilha
// dela de cabeça". O painel existia pela MANILHA; a vira está desenhada no meio da mesa, em
// tamanho de carta, e é a única dos quatro que o jogador lê sem painel nenhum.
//
// O que entra no lugar não é enfeite: a conta das vazas só existia empilhada de lado, e ler a
// pilha é fazer a conta ao contrário — você vê onde as cartas pararam e daí deduz de quem
// foram. Pedido do Ricardo, jogando: "até descobrir qual lado de quem ganhou não fica
// prático".
const medidoresDoTruco = vista => [
  { rot: 'Manilha', val: vista.manilha === null || vista.manilha === undefined
    ? '—' : VALORES[vista.manilha] },
  { rot: 'Vale', val: vista.pedido ? `${vista.aposta} → ${vista.pedido.valor}` : vista.aposta },
  { rot: 'Vazas', val: placarDeVazas(vista) },
];

// "1×0" do SEU ponto de vista, como o placar da partida. Vaza melada não conta para ninguém,
// e é por isso que ela não aparece: somar melou de um lado seria mentir sobre quem está por
// cima, e mostrá-la num terceiro número gastaria o painel inteiro para dizer "nada".
function placarDeVazas(vista) {
  const meu = timeDaVistaNoTruco(vista, vista.cadeira);
  let nos = 0, eles = 0;
  for (const v of vista.vazas || []) {
    if (v.time === null || v.time === undefined) continue;
    if (v.time === meu) nos++; else eles++;
  }
  return `${nos}×${eles}`;
}

// "3 paus" e não "3 de paus": o painel tem 74px e a fonte é de 17px. O nome inteiro está no
// `nomeDaCarta`, que é o que a narração usa — ali há espaço e ali a frase é lida em voz alta.
const nomeCurtoDaCarta = c => `${valorDaCarta(c)} ${naipeDaCarta(c).nome}`;

// ─── a barra de ações ────────────────────────────────────────────────────────
// A ESCADA DA APOSTA em três estados, e a ordem dos botões é a ordem em que se decide.
function barraDoTruco(vista) {
  const a = vista.acoes;

  // A mão de 11: você viu as cartas e escolhe antes de qualquer coisa acontecer.
  if (a.onze) {
    return [
      { rotulo: 'Jogar valendo 3', acao: { acao: 'onze', jogar: true }, principal: true },
      { rotulo: 'Entregar 1 ponto', acao: { acao: 'onze', jogar: false } },
    ];
  }

  // Com pedido na mesa o jogo PARA. Aceitar primeiro, porque é a resposta comum; correr por
  // último, porque é a que custa pontos.
  if (a.aceitar) {
    const botoes = [{ rotulo: 'Aceitar', acao: { acao: 'aceitar' }, principal: true }];
    if (a.trucar) {
      botoes.push({
        rotulo: `Aumentar para ${NOME_DA_APOSTA[a.trucar] || a.trucar}`,
        titulo: `Aceita e sobe: a mão passa a valer ${a.trucar}`,
        acao: { acao: 'trucar' },
      });
    }
    botoes.push({
      rotulo: 'Correr',
      titulo: `Desiste da mão e o outro time marca ${vista.aposta}`,
      acao: { acao: 'correr' },
    });
    return botoes;
  }

  // Na sua vez normal: pedir é opcional, e por isso NÃO é o botão principal — o principal é
  // jogar uma carta, e isso se faz na mesa.
  if (a.trucar) {
    return [{
      rotulo: `Pedir ${NOME_DA_APOSTA[a.trucar] || a.trucar}`,
      titulo: `A mão passa a valer ${a.trucar} se o outro time aceitar`,
      acao: { acao: 'trucar' },
    }];
  }
  return [];
}

// ─── a barra de confirmação ──────────────────────────────────────────────────
// Um botão só: no truco não há dois lados para escolher. O `dado` vai `null` e volta `null` —
// a casa nunca o lê, e o truco não precisa dele.
// CURTO, e o motivo é medido: a barra do truco tinha 137px de altura numa tela de 360 — 38%
// do celular deitado —, porque "J de ouros" e "Jogar esta carta" quebram em três linhas na
// faixa estreita. A do dominó tem 59px. Com o nome curto e um verbo, elas ficam do mesmo
// tamanho, e a diferença some do layout inteiro em vez de virar caso especial de CSS.
//
// E não se perde nada: a carta escolhida está LEVANTADA e com o fantasma no lugar em que vai
// cair. A barra não precisa soletrar o que a mesa já está mostrando — ela precisa dizer o que
// o botão faz.
const confirmacaoDoTruco = (vista, m) => ({
  titulo: nomeCurtoDaCarta(m.carta),
  botoes: [{ dado: null, rotulo: 'Jogar' }],
});

// ─── a tela de fim de mão ────────────────────────────────────────────────────
const TITULO_DO_FIM_DO_TRUCO = {
  vazas: 'Fez a mão!',
  correu: 'Correu',
  entregou: 'Entregou',
  melou: 'Melou',
};

// A linha do meio: COMO a mão acabou. Cada motivo merece a sua, porque "2 × 1 nas vazas" e
// "o outro time correu" contam histórias diferentes sobre a mesma pontuação.
function comoAcabouNoTruco(vista) {
  const r = vista.resultado;
  const ganhas = t => (r.vazas || []).filter(x => x === t).length;
  if (r.motivo === 'vazas') return `${ganhas(r.time)} × ${ganhas(r.time === 0 ? 1 : 0)} nas vazas`;
  if (r.motivo === 'correu') return `valia ${r.pontos}`;
  if (r.motivo === 'entregou') return 'mão de 11 entregue sem jogar';
  return 'as três vazas empataram';
}

function fimDeMaoDoTruco(vista) {
  const r = vista.resultado;
  const fazem = vista.duplas ? 'fazem' : 'faz';
  // As três vazas, com quem levou cada uma. É a leitura da mão inteira num relance, e é o que
  // a mesa de verdade mostra sozinha com as cartas empilhadas na frente de quem ganhou.
  const detalhe = (r.vazas || []).map((t, i) => {
    const quem = t === null ? 'melou' : nomeDoTime(vista, t);
    return `<div><span>${i + 1}ª vaza</span><b>${escapar(quem)}</b></div>`;
  }).join('') +
    (r.vira ? `<div><span>vira</span><b>${escapar(nomeDaCarta(r.vira))}</b></div>` : '');

  return {
    titulo: TITULO_DO_FIM_DO_TRUCO[r.motivo] || 'Fim da mão',
    tipo: comoAcabouNoTruco(vista),
    quem: r.time === null
      ? 'Ninguém marca — a mão morre e embaralha de novo.'
      : `${nomeDoTime(vista, r.time)} ${fazem} ${r.pontos === 1 ? '1 ponto' : `${r.pontos} pontos`}`,
    detalhe,
  };
}

// ─── a vista sem a mão ───────────────────────────────────────────────────────
// A tela de troca do hotseat. Zerar as ações exige saber quais são — no truco há cinco, e
// nenhuma delas se chama `jogadas`.
const semAMaoNoTruco = v => Object.assign({}, v, {
  mao: [],
  acoes: { cartas: [], trucar: null, aceitar: false, correr: false, onze: false },
});

// ─── a abertura da mão ───────────────────────────────────────────────────────
// A VIRA VAI NA NARRAÇÃO, e não é enfeite: ela é a única carta pública do baralho, e é dela
// que sai a manilha. Quem chega atrasado à tela lê aqui o que a mesa toda já viu.
const aberturaDoTruco = P =>
  `Mão ${P.maoNum} · abre ${P.cadeiras[P.vez].nome} · vira ${nomeDaCarta(P.vira)}, ` +
  `manilha ${VALORES[P.manilha]}`;

// ─── aplicar uma intenção ────────────────────────────────────────────────────
// Cinco ações, e a cadeia é FECHADA no fim: mensagem torta do fio vira recusa, nunca um passe
// acidental. A guarda de FORMA da carta mora dentro de `jogarCarta` (`cartaValida`), pelo
// mesmo motivo que o dominó registra — o motor também é chamado pelo bot e pela ponte das
// suítes, que entram por baixo da rede.
// ─── quem está ganhando a vaza EM CURSO ──────────────────────────────────────
// A outra metade do pedido do Ricardo: "deixar quem está ganhando a rodada, para que tenha
// um parâmetro do que jogar". A marca 3D na carta (550-mesa.js) responde para quem OLHA;
// esta frase responde para quem lê, e é ela que o leitor de tela anuncia — o `#vez` é
// `aria-live`, e é justamente por isso que a nota mora lá e não num painel novo.
//
// SILÊNCIO COM A MESA VAZIA, e de propósito: entre uma vaza e outra não há o que ganhar, e
// uma nota que não muda vira ruído — a mesma razão que faz o `#vez` só escrever quando a
// frase muda. `vista.mesa.length` é o que separa "não há vaza" de "a vaza está melando",
// porque `ganhandoAVaza` devolve nada no primeiro caso e `null` no segundo.
function notaDaVezNoTruco(vista) {
  if (!vista.mesa || !vista.mesa.length) return '';
  const g = vista.ganhandoAVaza;
  if (g === null || g === undefined) return 'a vaza está empatada';
  if (g === vista.cadeira) return 'você está ganhando a vaza';
  // EM DUPLAS, "o seu time" é a informação que decide, e não o nome de quem jogou: com o
  // parceiro por cima você descarta, e é o mesmo raciocínio de estar por cima sozinho.
  if (vista.duplas && timeDaVistaNoTruco(vista, g) === timeDaVistaNoTruco(vista, vista.cadeira)) {
    return `${vista.cadeiras[g].nome} (seu time) está ganhando`;
  }
  return `${vista.cadeiras[g].nome} está ganhando a vaza`;
}

// ─── quem ganhou a vaza ──────────────────────────────────────────────────────
// PEDIDO DO RICARDO, jogando (07/08/2026): "falar quem ganhou a rodada, não somente deixar
// as cartas no canto, pois até descobrir qual lado de quem ganhou não fica prático".
//
// Ele está certo, e a razão é geométrica: a pilha vai para o lado de QUEM VENCEU, então ler
// a pilha é fazer a conta ao contrário — você vê onde as cartas pararam e daí deduz o
// vencedor. Uma frase resolve na hora, e ela entra no MESMO fio da conversa que já narra as
// jogadas, então também é lida por leitor de tela e sobrevive na rolagem.
//
// A ORDINAL É ESCRITA À MÃO, e são só três: `VAZAS_POR_MAO` é 3 por definição do truco
// paulista, e uma tabela de três entradas é mais legível que uma regra de formação que
// ninguém vai reusar. O `|| ` guarda o dia em que alguém mexer na constante.
const ORDINAL_DA_VAZA = ['1ª', '2ª', '3ª'];
function narrarVaza(P, vaza) {
  if (!vaza) return [];
  const qual = ORDINAL_DA_VAZA[vaza.numero - 1] || `${vaza.numero}ª`;
  // MELOU: dizer "empatou" e não silenciar. A vaza melada é a que MAIS confunde — a mesa
  // esvazia, ninguém marca, e sem a frase parece que o jogo comeu a rodada.
  if (vaza.vencedor === null) return [`a ${qual} vaza empatou — ninguém leva`];
  return [`${P.cadeiras[vaza.vencedor].nome} ganhou a ${qual} vaza`];
}

function aplicarNoTruco(P, cadeira, i) {
  if (P.fase !== 'mao' && P.fase !== 'onze') return { erro: 'a mão não está em jogo' };
  const nome = P.cadeiras[cadeira].nome;

  if (i.acao === 'jogar') {
    const r = jogarCarta(P, cadeira, i.carta);
    if (r.erro) return r;
    return {
      ok: true,
      narracao: [`${nome} jogou ${nomeDaCarta(i.carta)}`]
        .concat(narrarVaza(P, r.vaza)).concat(fimDoTruco(P, r)),
    };
  }

  // `trucar` E `aumentar` SÃO A MESMA CHAMADA, e os dois nomes existem porque as duas bocas
  // que falam com o motor têm vocabulários diferentes: a barra manda `trucar` (o botão diz
  // "Pedir truco" ou "Aumentar para seis", mas a ação é uma só) e o bot manda o veredito de
  // `responderAposta`, que é literalmente `'aceitar' | 'correr' | 'aumentar'`.
  //
  // Sem este `||`, o bot que resolvia AUMENTAR caía em "ação desconhecida" e a vez dele
  // simplesmente não acontecia: mesa parada, sem mensagem e sem botão — o defeito que quatro
  // filas passaram consertando. Ele não aparece no motor puro porque lá a suíte despacha com
  // o mapa dela; apareceu na primeira partida jogada pela CASA.
  if (i.acao === 'trucar' || i.acao === 'aumentar') {
    const r = trucar(P, cadeira);
    if (r.erro) return r;
    tocarClique();
    return { ok: true, narracao: [`${nome} pediu ${NOME_DA_APOSTA[r.valor] || r.valor}!`] };
  }

  if (i.acao === 'aceitar') {
    const r = aceitarTruco(P, cadeira);
    if (r.erro) return r;
    return { ok: true, narracao: [`${nome} aceitou — a mão vale ${P.aposta}`] };
  }

  if (i.acao === 'correr') {
    // `P.pedido` some dentro do `correrDoTruco`: o valor tem de ser lido ANTES.
    const valia = P.aposta;
    const r = correrDoTruco(P, cadeira);
    if (r.erro) return r;
    return { ok: true, narracao: [`${nome} correu — o outro time marca ${valia}`].concat(fimDoTruco(P, r)) };
  }

  if (i.acao === 'onze') {
    const r = decidirOnze(P, cadeira, !!i.jogar);
    if (r.erro) return r;
    return {
      ok: true,
      narracao: (i.jogar
        ? [`${nome} olhou a mão de 11 e resolveu jogar — vale 3`]
        : [`${nome} entregou a mão de 11`]).concat(fimDoTruco(P, r)),
    };
  }

  return { erro: 'ação desconhecida' };
}

// A linha que fecha a mão, quando ela fechou. Devolve um array para poder ser `concat`ado sem
// um `if` em cada chamada.
function fimDoTruco(P, r) {
  if (!r.fim) return [];
  tocarBatida();
  const f = r.fim;
  if (f.time === null) return ['Melou tudo — ninguém marca, e embaralha de novo.'];
  const quem = P.duplas
    ? `${P.cadeiras[f.time].nome} e ${P.cadeiras[f.time + 2].nome}`
    : P.cadeiras[f.time].nome;
  return [`${quem} ${P.duplas ? 'fazem' : 'faz'} ${f.pontos} · placar ${P.placar.join(' × ')}`];
}

// ─── a dica ──────────────────────────────────────────────────────────────────
// O bot pensando com a SUA mão, e de graça — porque ele nunca precisou trapacear: todo campo
// que `informacaoDoTruco` entrega a ele já existe na visão.
function dicaDoTrucoParaACasa(vista) {
  const d = dicaDoTruco(vista);
  if (!d) return null;
  const razao = ((d.porques || [])[0] || {}).texto || '';

  if (d.acao === 'onze') {
    return {
      texto: `Dica: ${d.jogar ? 'jogar a mão de 11' : 'entregar'} — ${razao}`,
      aviso: d.jogar ? 'Dica: jogue, vale 3.' : 'Dica: entregue 1 ponto.',
    };
  }
  if (d.acao === 'aceitar' || d.acao === 'correr' || d.acao === 'aumentar') {
    const verbo = { aceitar: 'aceitar', correr: 'correr', aumentar: 'aumentar a aposta' }[d.acao];
    return { texto: `Dica: ${verbo} — ${razao}`, aviso: `Dica: ${verbo}.` };
  }

  // Procura na ORDEM DA TELA, que desde a arrumação não é a de `vista.mao`.
  const i = naMaoDoTruco.findIndex(m => mesmaCarta(m.carta, d.carta));
  if (i < 0) return null;
  const razoes = (d.porques || []).slice(0, 2).map(p => p.texto);
  return {
    mostrar: () => { selecionarCarta(i); tocarSoltar(); },
    texto: `Dica: ${nomeDaCarta(d.carta)}${razoes.length ? ' — ' + razoes.join('; ') : ''}`,
    aviso: `Dica: ${nomeDaCarta(d.carta)}`,
  };
}

// ─── o menu ──────────────────────────────────────────────────────────────────
// 12 é a partida de truco paulista, e é o padrão. O 6 é a "meia", que se joga quando não há
// tempo para uma partida inteira — e ele existe aqui pelo mesmo motivo que o dominó tem 6 e
// 10: escolher quanto vai durar é a decisão que se toma antes de sentar.
const ALVOS_DO_TRUCO = [12, 6];

// Nenhuma. A compra livre do dominó é uma regra de monte, e no truco não há monte para
// comprar — a lista vazia é o que faz a segunda metade da linha do menu não ser desenhada.
const OPCOES_DO_TRUCO = [];

const notaDaMesaDoTruco = mesa =>
  `40 cartas, ${MODOS_TRUCO[mesa.modo].cartasPorMao} para cada · vira e manilha corrida`;

// ─── a partida guardada ──────────────────────────────────────────────────────
// `P` do truco é dado PURO — arrays de inteiros e nada mais —, então não há conversão de ida
// e volta a fazer: nenhum `Set`, nenhuma referência ao 3D. `paraGuardar` e `deVolta` ficam de
// fora do contrato, e a casa cai na identidade.
//
// O que ele PRECISA conferir são os campos que só ele desreferencia. Sem a vira, `manilhaDaVira`
// e o layout estouram; sem `vazas`, o `donoDaMao` do próximo fechamento estoura.
const partidaDoTrucoValida = p =>
  cartaValida(p.vira) && Number.isInteger(p.manilha) &&
  Array.isArray(p.vazas) && Array.isArray(p.mesa) &&
  p.maos.every(m => m.every(cartaValida));

// O IRMÃO DELE, para a vista que chega pelo FIO — e ele é DELIBERADAMENTE mais frouxo que o
// de cima, por duas razões que só apareceram medindo.
//
// 1. A MESA DO TRUCO JÁ É DEFENSIVA. `550-mesa.js` escreve `vista.mesa || []`,
//    `vista.vazas || []` e `if (vista.vira)` em todos os pontos de leitura — não há um
//    desreferenciamento sem guarda para proteger. Logo esta função NÃO existe para salvar a
//    tela do truco de si mesma; ela existe para que uma vista de OUTRO jogo não seja
//    desenhada nesta mesa.
// 2. POR ISSO ELA NÃO COBRA `vira` NEM `manilha`, e a tentação de cobrar é grande, porque o
//    validador da partida os cobra dez linhas acima. A forma da vista MUDA COM A FASE, e uma
//    recusa aqui é SILENCIOSA: é exatamente o defeito que este encaixe está consertando,
//    refeito por dentro do conserto. Cobrar campo que some numa fase é como o convidado
//    volta a ficar preso no saguão — só que na mão de 11 em vez de sempre.
//
// `mesa` e `vazas` são arrays em TODAS as fases (vazios, nunca ausentes), e nenhum dos dois
// existe numa vista de dominó. É o mínimo que separa os dois jogos sem inventar rigor.
const vistaDoTrucoValida = v => Array.isArray(v.mesa) && Array.isArray(v.vazas);
