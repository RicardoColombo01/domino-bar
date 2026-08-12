// AS REGRAS DO TRUCO, no terminal. `50-truco/510-regras.js` é puro (invariante 4), então
// cabe inteiro aqui — e é onde um erro de regra custa segundos em vez de horas.
//
// AS TABELAS SÃO ESCRITAS À MÃO, e não lidas do jogo. Ler `ORDEM_TRUCO` para conferir
// `ORDEM_TRUCO` aprovaria qualquer ordem. Aqui elas estão em NOME de carta ("3 de paus"), que
// é como um jogador falaria — se o teste e o código discordarem, quem estiver errado é
// visível a olho nu.
import { installStubs, seedRandom, buildModule, correrTimers, els, frames, fire } from './harness.mjs';

installStubs();
seedRandom(11);
const mod = await import(buildModule([
  'VALORES', 'NAIPES', 'baralho40', 'chaveCarta', 'nomeDaCarta', 'mesmaCarta',
  'ORDEM_TRUCO', 'manilhaDaVira', 'forcaDaCarta', 'compararCartas', 'postoDaCarta',
  'vencedorDaVaza', 'donoDaMao', 'VALORES_DA_APOSTA', 'proximaAposta', 'NOME_DA_APOSTA',
  'MODOS_TRUCO', 'MODO_PADRAO_TRUCO',
  'novaPartidaDoTruco', 'novaMaoDoTruco', 'acoesDoTruco', 'jogarCarta', 'visaoDoTruco',
  'trucar', 'aceitarTruco', 'correrDoTruco', 'decidirOnze', 'abandonarOTruco', 'timeNoTruco',
  'NIVEIS_TRUCO', 'poderDaCarta', 'poderDaMao', 'escolherCarta', 'querTrucar',
  'responderAposta', 'avaliarAposta', 'informacaoDoTruco', 'jogadaDoBotNoTruco', 'dicaDoTruco',
  'postaDaVaza', 'layoutDaVaza', 'postaDaVazaGanha', 'layoutDasVazas', 'caixaDaMesaDoTruco',
  'CARTA_C', 'CARTA_L', 'anguloDaCadeira',
  // A CASA. Estes são os nomes que fazem o truco SENTAR: sem eles a suíte prova o cérebro e
  // deixa o corpo — a mesa 3D, a barra de apostas, o caminho da intenção — sem uma linha.
  'JOGOS', 'JOGO', 'JOGO_ID', 'abrirJogo', 'MESA', 'comecarLocal', 'pedirAcao',
  'aplicarIntencao', 'publicar', 'P', 'vistaAtual', 'desenharHUD', 'mostrarFimDeMao',
  'partidaGuardada', 'atualizarBotaoRetomar', 'podeAgirAgora', 'vistaDoFio',
  // E o corpo do truco.
  'naMaoDoTruco', 'naMesaDoTruco', 'grupoMaoDoTruco', 'selecionarCarta', 'confirmarNoTruco',
  'cancelarEscolhaNoTruco', 'escolhidaNoTruco', 'barraDoTruco', 'medidoresDoTruco',
  'fimDeMaoDoTruco', 'semAMaoNoTruco', 'aplicarNoTruco', 'arrumarMaoDoTruco',
  // Quem está ganhando a vaza e quem ganhou — os dois pedidos do Ricardo de 07/08.
  'notaDaVezNoTruco', 'narrarVaza', 'placarDeVazas', 'timeDaVistaNoTruco',
  'temPreviaDoTruco', 'dicaDoTrucoParaACasa', 'porQueNaoDaNoTruco', 'HUD',
  // Fila 15 · A1: o realce das manilhas na sua mão. `ehManilha` é a pergunta da REGRA, e o
  // teste faz a mesma que o jogo faz — escrever `carta[0] === manilha` aqui seria a suíte
  // conferindo a tabela contra ela mesma. A geometria é como se pergunta pelo anel de fora
  // da sua mão, e o grupo dos outros é onde ele não pode aparecer.
  'ehManilha', 'geomManilhaNoTruco', 'grupoOutrosDoTruco',
  // Fila 12: projetar a carta para NDC é o único jeito de mirar com o DEDO de verdade —
  // e é o dedo, não o teclado, que o sistema interrompe.
  'ponteiroDoTruco',
]));

let falhas = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

// Escrever `[3, 2]` no teste seria escrever índices — ilegível, e um dígito trocado passa
// despercebido. `c('4', 'paus')` é o que a mesa diz.
const iv = v => mod.VALORES.indexOf(v);
const inp = id => mod.NAIPES.findIndex(x => x.id === id);
const c = (v, naipe) => [iv(v), inp(naipe)];

// ─── a escada do truco ───────────────────────────────────────────────────────
console.log('\na ordem do truco');
{
  // Do mais fraco para o mais forte, escrita como um jogador recita.
  const ESCADA = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  ok(mod.ORDEM_TRUCO.length === 10, `a escada tem ${mod.ORDEM_TRUCO.length} degraus`);
  ESCADA.forEach((v, i) => {
    ok(mod.postoDaCarta(c(v, 'ouros')) === i,
      `o ${v} devia estar no degrau ${i} e está no ${mod.postoDaCarta(c(v, 'ouros'))}`);
  });
  // A INVERSÃO que faz o truco não ser nenhum outro jogo: o 4 é a mais fraca e o 3 a mais
  // forte. É o primeiro lugar onde alguém erra ao ler o código.
  ok(mod.postoDaCarta(c('4', 'paus')) < mod.postoDaCarta(c('7', 'ouros')), 'o 4 devia ser mais fraco que o 7');
  ok(mod.postoDaCarta(c('3', 'ouros')) > mod.postoDaCarta(c('A', 'paus')), 'o 3 devia ser mais forte que o A');
  ok(mod.postoDaCarta(c('K', 'ouros')) > mod.postoDaCarta(c('Q', 'paus')), 'o K devia ser mais forte que a Q');
  console.log(`  ${ESCADA.join(' < ')}`);
}

// ─── a manilha ───────────────────────────────────────────────────────────────
console.log('\na manilha é a seguinte da vira');
{
  const PARES = [['4', '5'], ['5', '6'], ['6', '7'], ['7', 'Q'], ['Q', 'J'],
    ['J', 'K'], ['K', 'A'], ['A', '2'], ['2', '3'], ['3', '4']];
  for (const [vira, esperada] of PARES) {
    const m = mod.manilhaDaVira(c(vira, 'copas'));
    ok(m === iv(esperada),
      `virou ${vira}: a manilha devia ser ${esperada} e é ${mod.VALORES[m]}`);
  }
  // A VOLTA CÍCLICA é o caso que um `+1` sem módulo perde, e ela acontece numa mão em dez:
  // virou o 3 (o topo da escada), a manilha é o 4 (a base).
  ok(mod.manilhaDaVira(c('3', 'paus')) === iv('4'),
    'virou o 3 e a manilha não voltou para o 4 — falta o módulo');
  // E a vira NÃO muda de manilha por causa do naipe: quem manda é o valor.
  for (const naipe of ['ouros', 'espadas', 'copas', 'paus']) {
    ok(mod.manilhaDaVira(c('7', naipe)) === iv('Q'), `a vira de ${naipe} mudou a manilha`);
  }
  console.log(`  ${PARES.map(([a, b]) => a + '→' + b).join(' · ')}`);
}

// ─── a força ─────────────────────────────────────────────────────────────────
console.log('\nqualquer manilha bate qualquer carta comum');
{
  const man = mod.manilhaDaVira(c('7', 'ouros'));       // virou 7 → manilha é a Q
  // A manilha mais FRACA (ouros) contra a carta comum mais FORTE (o 3).
  ok(mod.compararCartas(c('Q', 'ouros'), c('3', 'paus'), man) > 0,
    'a manilha de ouros perdeu para o 3 de paus — manilha bate tudo');
  // Entre manilhas, o naipe manda: ouros < espadas < copas < paus.
  const ESCADA_NAIPE = ['ouros', 'espadas', 'copas', 'paus'];
  for (let i = 1; i < ESCADA_NAIPE.length; i++) {
    ok(mod.compararCartas(c('Q', ESCADA_NAIPE[i]), c('Q', ESCADA_NAIPE[i - 1]), man) > 0,
      `a manilha de ${ESCADA_NAIPE[i]} não bateu a de ${ESCADA_NAIPE[i - 1]}`);
  }
  // O NAIPE SÓ DESEMPATA ENTRE MANILHAS. Duas cartas comuns de mesmo valor EMPATAM, e é
  // disso que o "melou" é feito — quem trouxer o desempate por naipe para as comuns apaga
  // o empate do jogo inteiro.
  for (const v of ['4', '7', 'K', '3']) {
    ok(mod.compararCartas(c(v, 'paus'), c(v, 'ouros'), man) === 0,
      `${v} de paus e ${v} de ouros não empataram — o naipe vazou para as cartas comuns`);
  }
  console.log(`  virou 7 → manilha Q · ${ESCADA_NAIPE.join(' < ')} · comuns de mesmo valor empatam`);
}

// ─── quem ganha a vaza ───────────────────────────────────────────────────────
console.log('\nquem ganha a vaza');
{
  const man = mod.manilhaDaVira(c('4', 'ouros'));       // virou 4 → manilha é o 5
  const dupla = cad => cad % 2;                          // mesa de 4, duplas em cruz
  const solo = cad => cad;                               // mesa de 2

  const v1 = mod.vencedorDaVaza([
    { cadeira: 0, carta: c('K', 'ouros') },
    { cadeira: 1, carta: c('3', 'paus') },
  ], man, solo);
  ok(v1 === 1, `o 3 devia ganhar do K, veio cadeira ${v1}`);

  const v2 = mod.vencedorDaVaza([
    { cadeira: 0, carta: c('3', 'ouros') },
    { cadeira: 1, carta: c('5', 'espadas') },
  ], man, solo);
  ok(v2 === 1, 'a manilha (5, porque virou 4) devia ganhar do 3');

  // MELOU: duas cartas de mesmo valor, de times diferentes.
  const v3 = mod.vencedorDaVaza([
    { cadeira: 0, carta: c('K', 'ouros') },
    { cadeira: 1, carta: c('K', 'paus') },
  ], man, solo);
  ok(v3 === null, `duas K de times diferentes deviam melar, veio ${v3}`);

  // E NÃO MELA quando as duas iguais são da MESMA dupla: a dupla ganhou de qualquer jeito,
  // e quem leva é a primeira delas, porque é ela quem sai na vaza seguinte.
  const v4 = mod.vencedorDaVaza([
    { cadeira: 0, carta: c('K', 'ouros') },
    { cadeira: 1, carta: c('4', 'ouros') },
    { cadeira: 2, carta: c('K', 'paus') },
    { cadeira: 3, carta: c('5', 'ouros') },       // manilha! ganha de todas
  ], man, dupla);
  ok(v4 === 3, `a manilha da cadeira 3 devia levar, veio ${v4}`);

  const v5 = mod.vencedorDaVaza([
    { cadeira: 0, carta: c('K', 'ouros') },
    { cadeira: 1, carta: c('4', 'ouros') },
    { cadeira: 2, carta: c('K', 'paus') },
    { cadeira: 3, carta: c('7', 'ouros') },
  ], man, dupla);
  ok(v5 === 0, `duas K da MESMA dupla não deviam melar, e a primeira leva — veio ${v5}`);
  console.log('  manilha > 3 > K · K×K de times diferentes mela · K×K da mesma dupla não');
}

// ─── o melou, e a tabela inteira ─────────────────────────────────────────────
// Esta é a regra de CASA da Fase 4, decidida pelo Ricardo. A tabela está escrita aqui em
// forma de casos, cada um com o desfecho por extenso.
console.log('\no melou');
{
  const E = null;                    // empatou a vaza
  const CASOS = [
    // [vazas, time esperado, morreu?, comentário]
    [[0, 0], 0, false, 'duas vazas seguidas: acabou na segunda'],
    [[0, 1, 0], 0, false, '1 a 1, a terceira decide'],
    [[1, 0, 1], 1, false, '1 a 1, a terceira decide (do outro lado)'],
    [[E, 1], 1, false, 'empatou a 1ª: quem ganhar a 2ª leva'],
    [[E, 0], 0, false, 'empatou a 1ª: quem ganhar a 2ª leva'],
    [[0, E], 0, false, 'ganhou a 1ª e empatou a 2ª: leva quem fez a 1ª'],
    [[1, E], 1, false, 'ganhou a 1ª e empatou a 2ª: leva quem fez a 1ª'],
    [[0, 1, E], 0, false, '1 a 1 e empatou a 3ª: leva quem fez a 1ª'],
    [[1, 0, E], 1, false, '1 a 1 e empatou a 3ª: leva quem fez a 1ª'],
    [[E, E, 1], 1, false, 'empatou 1ª e 2ª: a 3ª decide'],
    [[E, E, E], null, true, 'EMPATOU AS TRÊS: a mão morre'],
  ];
  for (const [vazas, time, morreu, texto] of CASOS) {
    const r = mod.donoDaMao(vazas);
    ok(r.time === time && !!r.morreu === morreu,
      `${texto} — [${vazas.map(x => x === null ? 'E' : x).join(',')}] deu ` +
      `${JSON.stringify(r)}, esperava time ${time}${morreu ? ' e mão morta' : ''}`);
  }

  // AINDA ABERTO não é o mesmo que EMPATOU, e confundir os dois fecharia a mão cedo — o
  // motor pararia de pedir carta no meio da segunda vaza.
  for (const parcial of [[], [0], [E], [0, 1], [E, E]]) {
    const r = mod.donoDaMao(parcial);
    ok(r.aberto === true && r.time === null,
      `[${parcial.map(x => x === null ? 'E' : x).join(',')}] ainda não decide nada, e deu ${JSON.stringify(r)}`);
  }
  console.log(`  ${CASOS.length} desfechos + 5 estados abertos · empatou as três, a mão morre`);
}

// ─── a escada da aposta ──────────────────────────────────────────────────────
console.log('\na aposta');
{
  ok(JSON.stringify(mod.VALORES_DA_APOSTA) === JSON.stringify([1, 3, 6, 9, 12]),
    `a escada da aposta é ${mod.VALORES_DA_APOSTA}`);
  ok(mod.proximaAposta(1) === 3, 'a mão limpa é trucada para 3');
  ok(mod.proximaAposta(3) === 6, 'de 3 sobe para 6');
  ok(mod.proximaAposta(6) === 9, 'de 6 sobe para 9');
  ok(mod.proximaAposta(9) === 12, 'de 9 sobe para 12');
  // O TETO. Uma conta `+3` continuaria para sempre; a lista acaba, e é por isso que ela é
  // lista. `null` é o que faz o botão de aumentar apagar.
  ok(mod.proximaAposta(12) === null, 'de 12 não sobe mais nada — doze é o teto');
  ok(mod.proximaAposta(7) === null, 'um valor fora da escada não pode ter próximo');
  ok(mod.NOME_DA_APOSTA[3] === 'truco' && mod.NOME_DA_APOSTA[12] === 'doze',
    'os nomes da aposta não batem com o que se fala na mesa');
  console.log(`  ${mod.VALORES_DA_APOSTA.join(' → ')} · ` +
    mod.VALORES_DA_APOSTA.slice(1).map(v => mod.NOME_DA_APOSTA[v]).join(', '));
}

// ─── e o baralho inteiro tem força bem definida ──────────────────────────────
// Uma varredura, não um caso: para QUALQUER vira, as 40 cartas têm de ter força, e as
// quatro manilhas têm de ser as quatro mais fortes da mesa. É o tipo de asserção que pega
// um `indexOf` devolvendo -1 sem ninguém notar.
console.log('\nas 40 cartas, para as 10 viras');
{
  let piorComum = -1, melhorComum = -1, quantasManilhas = 0;
  for (let v = 0; v < 10; v++) {
    const man = mod.manilhaDaVira([v, 0]);
    const forcas = mod.baralho40().map(x => ({ carta: x, f: mod.forcaDaCarta(x, man) }));
    ok(forcas.every(x => Number.isFinite(x.f) && x.f >= 0),
      `a vira ${mod.VALORES[v]} deixou carta sem força definida`);
    const manilhas = forcas.filter(x => x.carta[0] === man);
    ok(manilhas.length === 4, `a vira ${mod.VALORES[v]} produziu ${manilhas.length} manilhas, e são 4`);
    const comuns = forcas.filter(x => x.carta[0] !== man);
    ok(manilhas.every(m => comuns.every(x => m.f > x.f)),
      `com a vira ${mod.VALORES[v]}, alguma manilha não bateu alguma carta comum`);
    ok(new Set(manilhas.map(m => m.f)).size === 4,
      `com a vira ${mod.VALORES[v]}, duas manilhas ficaram com a mesma força — o naipe não desempatou`);
    quantasManilhas += manilhas.length;
    piorComum = Math.max(piorComum, Math.max(...comuns.map(x => x.f)));
    melhorComum = Math.min(melhorComum < 0 ? 99 : melhorComum, Math.min(...comuns.map(x => x.f)));
  }
  console.log(`  10 viras × 40 cartas · ${quantasManilhas} manilhas ao todo · ` +
    `comuns de ${melhorComum} a ${piorComum}, manilhas de 100 a 103`);
}

// ═══ O MOTOR ════════════════════════════════════════════════════════════════
// Daqui para baixo o assunto é a PARTIDA, e não mais as regras soltas. As cadeiras são as
// mínimas que o motor aceita — ele não sabe a diferença entre `bot` e `voce` (é o invariante
// 2), então o tipo aqui é decoração.
const mesa = n => Array.from({ length: n }, (_, i) => ({ nome: 'C' + i, tipo: i ? 'bot' : 'voce' }));

// Joga a carta que a cadeira da vez tiver na posição `i`. Devolve o retorno do motor.
//
// A GUARDA NÃO É PARANOIA: com `P.vez` fora da faixa, `P.maos[P.vez][0]` LANÇA, e asserção
// que lança mata o processo e trunca a suíte inteira — a conferência por mutação passa a
// sub-relatar, e parece que a asserção não cobria o ramo quando na verdade ela nem chegou a
// rodar. Foi o que aconteceu na primeira mutação da saída: o teste morreu antes do bloco que
// a pegaria. O `CLAUDE.md` já registrava a lição; aqui ela cobrou de novo.
const motivoDe = P => (P.resultado || {}).motivo;

function jogaIesima(P, i) {
  if (!Number.isInteger(P.vez) || !P.maos[P.vez] || !P.maos[P.vez].length) {
    ok(false, `a vez ficou em ${JSON.stringify(P.vez)} e não há carta para jogar — o motor perdeu o turno`);
    return { erro: 'sem vez' };
  }
  return mod.jogarCarta(P, P.vez, P.maos[P.vez][i || 0]);
}

// Força uma mão CONHECIDA na mesa. A distribuição é sorteada, e um teste de regra não pode
// depender de sorte — é a mesma razão pela qual o `test-regras` do dominó monta a linha à
// mão em vez de jogar até cair no caso.
function armar(P, maos, vira) {
  P.maos = maos.map(m => m.slice());
  P.vira = vira;
  P.manilha = mod.manilhaDaVira(vira);
  return P;
}

console.log('\na partida começa');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  ok(P.n === 2 && P.duplas === false, 'a mesa de 2 não devia ser de duplas');
  ok(P.placar.length === 2, `o truco tem sempre DOIS placares, veio ${P.placar.length}`);
  ok(P.maos.every(m => m.length === 3), `cada um recebe 3 cartas, veio ${P.maos.map(m => m.length)}`);
  ok(Array.isArray(P.vira) && P.vira.length === 2, 'a vira não é uma carta');
  // A VIRA SAI DO BARALHO. Sem isto ela poderia repetir uma carta da mão de alguém, e a
  // manilha apareceria duas vezes na mesma mão — defeito que só aparece em uma mão de dez.
  const naMao = P.maos.flat().map(mod.chaveCarta);
  ok(!naMao.includes(mod.chaveCarta(P.vira)),
    `a vira ${mod.nomeDaCarta(P.vira)} também está na mão de alguém`);
  ok(new Set(naMao).size === naMao.length, 'alguma carta foi distribuída duas vezes');
  ok(P.aposta === 1, `a mão começa valendo 1, veio ${P.aposta}`);
  ok(P.fase === 'mao', `a fase inicial devia ser 'mao', veio '${P.fase}'`);
  const P4 = mod.novaPartidaDoTruco(mesa(4));
  ok(P4.duplas === true && mod.timeNoTruco(P4, 0) === mod.timeNoTruco(P4, 2),
    'na mesa de 4 as cadeiras 0 e 2 deviam ser do mesmo time');
  ok(mod.timeNoTruco(P4, 0) !== mod.timeNoTruco(P4, 1), 'as cadeiras 0 e 1 deviam ser de times diferentes');
  console.log(`  2 e 4 cadeiras · 3 cartas cada · vira ${mod.nomeDaCarta(P.vira)} → manilha ${mod.VALORES[P.manilha]}`);
}

console.log('\nas vazas decidem a mão');
{
  // Virou 4 → manilha é o 5. A cadeira 0 tem duas cartas altas e ganha 2 a 0.
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('3', 'paus'), c('2', 'copas'), c('4', 'ouros')],
    [c('K', 'ouros'), c('Q', 'espadas'), c('7', 'paus')],
  ], c('4', 'ouros'));
  P.vez = 0; P.saiu = 0;

  jogaIesima(P, 0);                         // 0 joga o 3
  ok(P.vez === 1, 'depois da primeira carta a vez devia passar');
  jogaIesima(P, 0);                         // 1 joga o K → 0 ganha
  ok(P.vazas.length === 1 && P.vazas[0].vencedor === 0, 'a cadeira 0 devia ter ganho a 1ª vaza');
  ok(P.vez === 0, 'quem ganhou a vaza sai na seguinte');

  jogaIesima(P, 0);                         // 0 joga o 2
  jogaIesima(P, 0);                         // 1 joga a Q → 0 ganha de novo
  ok(P.fase === 'fimDeMao', `2 a 0 devia fechar a mão, a fase é '${P.fase}'`);
  ok(P.placar[0] === 1, `a mão limpa vale 1, o placar deu ${P.placar}`);
  ok(motivoDe(P) === 'vazas', `o motivo devia ser 'vazas', veio '${motivoDe(P)}'`);
  // A TERCEIRA CARTA NÃO É PEDIDA. Uma mão decidida em duas vazas acaba ali — pedir a
  // terceira é o defeito clássico de quem conta vazas em vez de perguntar quem ganhou.
  ok(P.maos[0].length === 1, `sobrou ${P.maos[0].length} carta na mão, e devia sobrar 1`);

  // A SAÍDA ANDA ENTRE AS MÃOS, e ela anda mesmo que a mão morra. Sair é desvantagem — você
  // mostra carta primeiro —, então uma saída que não anda dá a mesma desvantagem à mesma
  // cadeira a partida inteira. É o tipo de regra que ninguém repara faltando.
  //
  // QUEM GIRA É O FIM DA MÃO, não o começo da seguinte, e a primeira versão desta asserção
  // media depois do giro e reprovava com o jogo certo. Vale a nota: asserção vermelha nem
  // sempre acusa o código — às vezes acusa o momento em que ela olhou.
  ok(P.abridor === 1, `a partida abriu na 0, e ao fechar a mão a saída devia ir para 1 — foi para ${P.abridor}`);
  mod.novaMaoDoTruco(P);
  ok(P.vez === 1 && P.saiu === 1, `a mão nova devia começar pela cadeira 1, começou em ${P.vez}/${P.saiu}`);
  console.log(`  2 a 0 em duas vazas · placar ${P.placar.join('×')} · a saída andou para ${P.abridor}`);
}

// ─── quem está ganhando, e quem ganhou ───────────────────────────────────────
// AS DUAS METADES DO PEDIDO DO RICARDO, de 07/08/2026, jogando: "no truco deixar quem está
// ganhando a rodada, para que tenha um parâmetro do que jogar" e "falar quem ganhou a
// rodada, não somente deixar as cartas no canto, pois até descobrir qual lado de quem
// ganhou não fica prático".
//
// As duas são invisíveis para toda asserção que existia: `vencedorDaVaza` já era testada, e
// o que faltava não era a REGRA — era a regra CHEGAR na tela. É a mesma distinção que fez a
// Fase 4 custar o dobro do previsto: o motor bastava, quem não bastava era a tela.
console.log('\nquem está ganhando a vaza, e quem ganhou');
{
  // Virou 4 → a manilha é o 5. Ninguém tem manilha aqui, então vale a escada normal.
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('3', 'paus'), c('4', 'ouros'), c('5', 'copas')],
    [c('K', 'ouros'), c('A', 'espadas'), c('6', 'paus')],
  ], c('4', 'espadas'));
  P.vez = 0; P.saiu = 0;

  // MESA VAZIA NÃO TEM LÍDER, e o campo some em vez de mentir um `null` — que é o valor
  // reservado para "empatou". Quem lê separa os dois pelo `vista.mesa.length` ao lado.
  const v0 = mod.visaoDoTruco(P, 0);
  ok(v0.ganhandoAVaza === undefined,
    `com a mesa vazia o líder devia ser undefined, veio ${JSON.stringify(v0.ganhandoAVaza)}`);
  ok(mod.notaDaVezNoTruco(v0) === '', 'a nota da vez falou de vaza com a mesa vazia — isso é ruído');

  jogaIesima(P, 0);                                   // 0 joga o 3 (a mais forte do baralho)
  const v1 = mod.visaoDoTruco(P, 0);
  ok(v1.ganhandoAVaza === 0, `com uma carta na mesa quem joga está ganhando, veio ${v1.ganhandoAVaza}`);
  ok(mod.notaDaVezNoTruco(v1) === 'você está ganhando a vaza',
    `a nota saiu "${mod.notaDaVezNoTruco(v1)}"`);
  // E O ADVERSÁRIO VÊ O MESMO FATO com outras palavras — é a mesma vista, lida de outra
  // cadeira. Se a frase fosse montada na tela em vez de na visão, o convidado (que não tem
  // `P`) não teria como montá-la.
  const v1b = mod.visaoDoTruco(P, 1);
  ok(v1b.ganhandoAVaza === 0 && mod.notaDaVezNoTruco(v1b) === 'C0 está ganhando a vaza',
    `da cadeira 1 a nota saiu "${mod.notaDaVezNoTruco(v1b)}"`);

  const r = jogaIesima(P, 0);                         // 1 joga o K → perde, 0 leva a vaza
  ok(r.vaza && r.vaza.numero === 1 && r.vaza.vencedor === 0,
    `o motor devia dizer que a 1ª vaza foi da cadeira 0, veio ${JSON.stringify(r.vaza)}`);
  const nar = mod.aplicarNoTruco;                     // a frase, que é o que o jogador lê
  ok(typeof nar === 'function', 'aplicarNoTruco sumiu da ponte');

  // FECHADA A VAZA, a mesa esvazia e o líder some de novo — senão a marca 3D ficaria presa
  // na carta que já foi para a pilha.
  const v2 = mod.visaoDoTruco(P, 0);
  ok(v2.ganhandoAVaza === undefined, 'a vaza fechou e ainda havia um líder marcado');
  // PELO RÓTULO, e não pela posição: a lista de medidores já mudou de tamanho uma vez (o
  // painel da vira saiu em 07/08 para o placar de vazas caber em paisagem), e um índice
  // cravado transforma essa troca num `Cannot read properties of undefined` que MATA o
  // processo e trunca a suíte — foi o que aconteceu aqui, e o arquivo já registrava a lição.
  const vazasDe = v => (mod.medidoresDoTruco(v).find(m => m.rot === 'Vazas') || {}).val;
  ok(vazasDe(v2) === '1×0', `depois de ganhar a 1ª o placar de vazas devia ser 1×0, veio ${vazasDe(v2)}`);
  // E DO OUTRO LADO ele é 0×1 — o placar é do SEU ponto de vista, como o da partida.
  ok(vazasDe(mod.visaoDoTruco(P, 1)) === '0×1', 'o placar de vazas não virou ao trocar de cadeira');
}
{
  // EMPATE: as duas cartas do mesmo valor, times diferentes. `null` e não `undefined`, e a
  // nota tem de DIZER que empatou — a vaza melada é a que mais confunde, porque a mesa
  // esvazia e ninguém marca.
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('K', 'paus'), c('4', 'ouros'), c('5', 'copas')],
    [c('K', 'ouros'), c('A', 'espadas'), c('6', 'paus')],
  ], c('4', 'espadas'));
  P.vez = 0; P.saiu = 0;
  jogaIesima(P, 0);
  jogaIesima(P, 0);                                   // K contra K, times diferentes
  ok(P.vazas.length === 1 && P.vazas[0].vencedor === null, 'as duas K deviam ter melado a vaza');
  // A MELADA NÃO CONTA PARA NINGUÉM no placar de vazas: somá-la de um lado seria mentir
  // sobre quem está por cima.
  ok((mod.medidoresDoTruco(mod.visaoDoTruco(P, 0)).find(m => m.rot === 'Vazas') || {}).val === '0×0',
    'a vaza melada entrou no placar de vazas para alguém');
}
{
  // A VAZA QUE DECIDE A MÃO TAMBÉM É ANUNCIADA, e este é o caso que o desenho ingênuo perde:
  // ela sai por `fecharMaoDoTruco`, num `return` diferente do caminho comum. Prender o
  // recado ao ramo de mão aberta deixaria calada justamente a vaza que mais importa.
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('3', 'paus'), c('2', 'copas'), c('4', 'ouros')],
    [c('K', 'ouros'), c('Q', 'espadas'), c('7', 'paus')],
  ], c('4', 'ouros'));
  P.vez = 0; P.saiu = 0;
  jogaIesima(P, 0); jogaIesima(P, 0);                 // 1ª vaza para a cadeira 0
  jogaIesima(P, 0);
  const r = jogaIesima(P, 0);                         // 2ª vaza fecha a mão
  ok(P.fase === 'fimDeMao', `a mão devia ter fechado, a fase é '${P.fase}'`);
  ok(r.vaza && r.vaza.numero === 2 && r.vaza.vencedor === 0,
    `a vaza que fechou a mão saiu sem recado: ${JSON.stringify(r.vaza)}`);
}

console.log('\no melou, na mesa');
{
  // As três vazas empatam: cartas de valores iguais, times diferentes.
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('K', 'ouros'), c('7', 'ouros'), c('4', 'ouros')],
    [c('K', 'paus'), c('7', 'paus'), c('4', 'paus')],
  ], c('A', 'ouros'));                      // manilha = 2, nenhuma na mesa
  P.vez = 0; P.saiu = 0;
  for (let v = 0; v < 3; v++) { jogaIesima(P, 0); jogaIesima(P, 0); }

  ok(P.vazas.length === 3 && P.vazas.every(v => v.time === null), 'as três vazas deviam ter melado');
  ok(P.fase === 'fimDeMao', `a mão devia ter acabado, a fase é '${P.fase}'`);
  ok(motivoDe(P) === 'melou', `o motivo devia ser 'melou', veio '${motivoDe(P)}'`);
  ok(P.placar[0] === 0 && P.placar[1] === 0, `ninguém devia marcar, o placar deu ${P.placar}`);
  console.log(`  três vazas empatadas · placar ${P.placar.join('×')} — a mão morreu`);
}

console.log('\nquem melou não perde a saída');
{
  const P = armar(mod.novaPartidaDoTruco(mesa(2)), [
    [c('K', 'ouros'), c('3', 'paus'), c('4', 'ouros')],
    [c('K', 'paus'), c('7', 'paus'), c('5', 'paus')],
  ], c('A', 'ouros'));
  P.vez = 1; P.saiu = 1;                    // quem sai é a cadeira 1
  jogaIesima(P, 0); jogaIesima(P, 0);       // K × K → melou
  ok(P.vazas[0].vencedor === null, 'a vaza devia ter melado');
  // Sem isto a saída andaria sozinha pela mesa numa mão de empates, e quem sai é quem tem a
  // desvantagem de mostrar carta primeiro — andar de graça muda o jogo.
  ok(P.saiu === 1 && P.vez === 1, `a saída devia continuar na cadeira 1, e está em ${P.saiu}/${P.vez}`);
  console.log('  melou e a saída ficou onde estava');
}

console.log('\na aposta');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.vez = 0; P.saiu = 0;
  ok(mod.acoesDoTruco(P, 0).trucar === 3, 'a cadeira da vez devia poder trucar por 3');
  ok(mod.acoesDoTruco(P, 1).trucar === null, 'quem não é da vez não joga nem truca');

  mod.trucar(P, 0);
  ok(P.pedido && P.pedido.valor === 3, 'o pedido de truco não ficou registrado');
  ok(P.vez === 1, 'quem responde o truco é o adversário');
  // COM PEDIDO NA MESA O JOGO PARA: ninguém põe carta enquanto o outro não responde.
  ok(mod.acoesDoTruco(P, 1).cartas.length === 0, 'dava para jogar carta com truco pendente');
  ok(mod.acoesDoTruco(P, 1).aceitar && mod.acoesDoTruco(P, 1).correr, 'faltou aceitar/correr');
  ok(mod.acoesDoTruco(P, 1).trucar === 6, 'quem recebe truco devia poder aumentar para 6');

  mod.aceitarTruco(P, 1);
  ok(P.aposta === 3 && P.pedido === null, `a mão devia valer 3, vale ${P.aposta}`);
  ok(P.vez === 0, 'depois de aceitar, a vez volta para quem ia jogar');
  // O MESMO TIME NÃO PEDE DUAS VEZES SEGUIDAS. Sem isto o "truco, seis" sai da mesma boca e
  // o adversário nunca responde.
  ok(mod.acoesDoTruco(P, 0).trucar === null, 'quem trucou por último não pode trucar de novo');

  // E o outro time PODE subir.
  jogaIesima(P, 0);
  ok(mod.acoesDoTruco(P, 1).trucar === 6, 'o outro time devia poder subir para 6');
  console.log('  1 → truco 3 → aceito · o jogo para no pedido · o mesmo time não pede duas vezes');
}

console.log('\ncorrer paga o que valia ANTES do pedido');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.vez = 0; P.saiu = 0;
  mod.trucar(P, 0);                          // pede 3, valendo 1
  mod.correrDoTruco(P, 1);
  ok(P.placar[0] === 1, `quem trucou e viu correr leva 1, e o placar deu ${P.placar}`);
  ok(P.fase === 'fimDeMao', 'correr devia fechar a mão');
  ok(motivoDe(P) === 'correu', `o motivo devia ser 'correu', veio '${motivoDe(P)}'`);

  // E de 3 para 6: quem corre paga os 3 já aceitos, não os 6 pedidos.
  //
  // Repare que a cadeira 1 precisa ESPERAR A VEZ para pedir os 6 — trucar é uma ação da sua
  // vez, como jogar. A primeira versão deste bloco pedia fora da vez, o motor recusou (certo)
  // e o placar ficou 0×0; a asserção reprovou por causa do TESTE, não do jogo. Vale registrar:
  // asserção vermelha nem sempre acusa o código.
  const Q = mod.novaPartidaDoTruco(mesa(2));
  Q.vez = 0; Q.saiu = 0;
  mod.trucar(Q, 0); mod.aceitarTruco(Q, 1);  // vale 3, e a vez volta para a cadeira 0
  jogaIesima(Q, 0);                          // 0 joga; agora é a vez da 1
  mod.trucar(Q, 1);                          // 1 pede 6
  mod.correrDoTruco(Q, 0);
  ok(Q.placar[1] === 3, `correr de 6 devia pagar os 3 aceitos, e o placar deu ${Q.placar}`);
  console.log(`  correu do truco → 1 ponto · correu do seis → 3 pontos`);
}

console.log('\na mão de 11');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.placar = [11, 5];
  mod.novaMaoDoTruco(P);
  ok(P.fase === 'onze', `com 11 a fase devia ser 'onze', veio '${P.fase}'`);
  ok(P.decideOnze === 0, `quem decide devia ser o time 0, veio ${P.decideOnze}`);
  ok(mod.acoesDoTruco(P, P.vez).onze === true, 'quem decide não recebeu a ação de decidir');
  ok(mod.acoesDoTruco(P, P.vez).cartas.length === 0, 'dava para jogar carta antes de decidir a mão de 11');

  // Entregou: o OUTRO marca 1.
  mod.decidirOnze(P, P.vez, false);
  ok(P.placar[1] === 6, `entregar dá 1 ao outro time, e o placar deu ${P.placar}`);
  ok(motivoDe(P) === 'entregou', `o motivo devia ser 'entregou', veio '${motivoDe(P)}'`);

  // Jogou: a mão já nasce valendo 3.
  const Q = mod.novaPartidaDoTruco(mesa(2));
  Q.placar = [11, 5];
  mod.novaMaoDoTruco(Q);
  mod.decidirOnze(Q, Q.vez, true);
  ok(Q.fase === 'mao' && Q.aposta === 3, `jogar a mão de 11 devia valer 3, vale ${Q.aposta} na fase '${Q.fase}'`);

  // OS DOIS EM 11: ninguém decide nada e a mão vale 1. Sem este ramo a mesa travaria numa
  // fase que espera a decisão de dois times ao mesmo tempo.
  const R = mod.novaPartidaDoTruco(mesa(2));
  R.placar = [11, 11];
  mod.novaMaoDoTruco(R);
  ok(R.fase === 'mao' && R.aposta === 1,
    `com os dois em 11 a mão devia ser normal, veio fase '${R.fase}' valendo ${R.aposta}`);
  console.log('  entregou → 1 ao outro · jogou → vale 3 · os dois em 11 → mão normal');
}

console.log('\na fronteira de segurança');
{
  // A MÃO É ARMADA, e não sorteada, e é o conserto do falso positivo explicado abaixo.
  //
  // As cartas alheias são todas de valor ALTO (`K`, `A`, `2`, `3` → índices 9, 0… não: `A` é
  // 0), então elas são escolhidas uma a uma para que NENHUMA delas seja um par que a visão
  // produza por outro motivo. Uma carta é `[valor, naipe]` com valor 0..9 e naipe 0..3; os
  // pares que a visão gera sem ser carta são o `placar` (`[0,0]` numa partida nova) e o
  // `naMao` (contagens, `[3,3,3,3]` — e numa mesa de 2 ele é `[3,3]`, que é a Q de paus).
  // Nenhuma das seis abaixo colide com esses.
  const P = mod.novaPartidaDoTruco(mesa(4));
  P.maos = [
    [c('A', 'ouros'), c('4', 'ouros'), c('5', 'ouros')],       // a SUA — pode aparecer
    [c('K', 'espadas'), c('J', 'espadas'), c('7', 'espadas')],
    [c('K', 'copas'), c('J', 'copas'), c('7', 'copas')],
    [c('K', 'paus'), c('J', 'paus'), c('2', 'paus')],
  ];
  const v = mod.visaoDoTruco(P, 0);
  ok(v.mao === P.maos[0], 'a visão não entregou a sua própria mão');
  // O INVARIANTE 3: a mão alheia NÃO trafega. Só a contagem — e a vira, que é pública por
  // definição do jogo.
  const meu = new Set(P.maos[0].map(mod.chaveCarta));
  // A BUSCA CONTINUA VARRENDO A VISÃO INTEIRA — só a SUA mão sai, porque ela pode estar lá.
  //
  // A tentação, ao ver a reprovação, era branquear `placar` e `naMao` junto. **Isso teria
  // cegado a asserção**: um vazamento por `naMao` (trocar as contagens pelas mãos é um
  // caractere de diferença no motor) deixaria de ser visto, e a asserção mais assustadora da
  // suíte viraria decoração. Quem sai de cena é a COLISÃO, não o campo — por isso as mãos
  // acima são armadas.
  //
  // O FALSO POSITIVO ERA REAL e é o documentado: uma carta é `[valor, naipe]`, e `[0,0]` é
  // tanto a A de ouros quanto um placar 0×0. O `CLAUDE.md` já registrava isso para o dominó,
  // e a suíte do truco reproduziu o defeito letra por letra.
  //
  // E VALE MAIS A FORMA COMO ELE APARECEU: ficou escondido até uma seção NOVA, sem relação
  // nenhuma com segurança, consumir sorteio a mais e mudar quem recebeu a A de ouros. É a
  // família do `performance.now()` que desloca os temporizadores do bot — **teste que depende
  // da ordem do sorteio guarda defeito latente até alguém mexer num vizinho**, e o sintoma
  // chega disfarçado do pior erro possível.
  const texto = JSON.stringify(Object.assign({}, v, { mao: [] }));
  const vazou = [];
  for (let cad = 1; cad < 4; cad++) {
    for (const carta of P.maos[cad]) {
      if (meu.has(mod.chaveCarta(carta))) continue;
      // Procura o PAR, e não o texto solto: `[0,2]` também é um placar.
      if (texto.includes(JSON.stringify(carta))) vazou.push(`${mod.nomeDaCarta(carta)} (cadeira ${cad})`);
    }
  }
  // QUANDO ELA REPROVA, ELA DIZ O QUÊ. A versão anterior contava e só: "1 carta(s) da mão
  // alheia apareceram na visão" — e a busca por texto no JSON dá FALSO POSITIVO conhecido
  // (o `CLAUDE.md` registra que `[0,0]` também é um placar 0×0). Sem o nome da carta, um
  // falso positivo e um vazamento de verdade são a mesma linha de log, e a asserção mais
  // assustadora da suíte vira um palpite caro — exatamente o que o `catch` que guardava só a
  // `message` custou no `test-online`.
  ok(vazou.length === 0, `carta(s) da mão alheia na visão: ${vazou.join(', ')}`);
  ok(JSON.stringify(v.naMao) === JSON.stringify([3, 3, 3, 3]), 'a contagem das mãos não bate');
  ok(Array.isArray(v.vira), 'a vira devia estar na visão — ela é pública');
  ok(v.acoes && Array.isArray(v.acoes.cartas), 'a visão não trouxe as ações');
  console.log(`  4 cadeiras · a visão da 0 não tem carta alheia · naMao ${v.naMao.join()}`);
}

console.log('\nsair conta como derrota');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  mod.abandonarOTruco(P, 1);
  ok(P.fase === 'fim' && P.desistiu === 1, 'abandonar devia encerrar a partida marcando quem saiu');
  ok(mod.abandonarOTruco(P, 0).erro, 'dava para abandonar duas vezes');
  console.log('  quem sai fica registrado e a partida acaba');
}

console.log('\nação torta não derruba a mesa');
{
  // O C3 da Fila 11 é a lembrança: o anfitrião recebe do fio o que o convidado mandar, e
  // desreferenciar `undefined` para a mesa de todos.
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.vez = 0; P.saiu = 0;
  const TORTAS = [undefined, null, [], [99, 0], [0, 99], 'A de ouros', {}, [0]];
  for (const t of TORTAS) {
    let deu = null, r = null;
    try { r = mod.jogarCarta(P, 0, t); } catch (e) { deu = e.message; }
    ok(!deu, `jogarCarta com ${JSON.stringify(t)} estourou: ${deu}`);
    ok(r && r.erro, `jogarCarta com ${JSON.stringify(t)} devia ser recusada`);
  }
  // E fora da vez ninguém joga.
  ok(mod.jogarCarta(P, 1, P.maos[1][0]).erro, 'a cadeira 1 jogou fora da vez');
  ok(mod.trucar(P, 1).erro, 'a cadeira 1 trucou fora da vez');
  ok(mod.aceitarTruco(P, 0).erro, 'deu para aceitar sem ter pedido nenhum');
  ok(mod.correrDoTruco(P, 0).erro, 'deu para correr sem ter pedido nenhum');
  ok(mod.decidirOnze(P, 0, true).erro, 'deu para decidir a mão de 11 fora dela');
  console.log(`  ${TORTAS.length} cartas tortas recusadas · nada fora da vez`);
}

console.log('\nmil mãos bot×bot, sem estourar e sem travar');
{
  // A VARREDURA. Um caso escrito à mão prova o caso; mil mãos aleatórias provam que não há
  // estado de onde não se sai — que é o defeito que mais dói neste projeto (mesa parada, sem
  // mensagem e sem botão), e o único que não aparece em teste de caso.
  let maos = 0, melou = 0, correu = 0, entregou = 0, lances = 0, presa = 0;
  for (let p = 0; p < 60; p++) {
    const P = mod.novaPartidaDoTruco(mesa(p % 2 ? 4 : 2));
    for (let guarda = 0; guarda < 4000 && P.fase !== 'fim'; guarda++) {
      if (P.fase === 'fimDeMao') { mod.novaMaoDoTruco(P); maos++; continue; }
      const a = mod.acoesDoTruco(P, P.vez);
      if (a.onze) { mod.decidirOnze(P, P.vez, guarda % 3 !== 0); if (P.resultado) entregou++; continue; }
      if (a.aceitar) {
        // Responde: às vezes aceita, às vezes corre, às vezes sobe.
        if (guarda % 7 === 0 && a.trucar) mod.trucar(P, P.vez);
        else if (guarda % 5 === 0) { mod.correrDoTruco(P, P.vez); correu++; }
        else mod.aceitarTruco(P, P.vez);
        continue;
      }
      if (a.trucar && guarda % 11 === 0) { mod.trucar(P, P.vez); continue; }
      if (!a.cartas.length) { presa++; break; }        // mesa parada: é o que se caça
      mod.jogarCarta(P, P.vez, a.cartas[guarda % a.cartas.length]);
      lances++;
    }
    if (P.fase !== 'fim') presa++;
    maos++;
    // Conta VAZA empatada e não mão morta: mão morta pede as três vazas empatadas e é
    // raríssima, então contá-la daria zero e o log pareceria dizer que o empate não roda.
    // A vaza empatada é o caminho que precisa ser exercitado em jogo aleatório.
    melou += P.vazas.filter(v => v.time === null).length;
  }
  ok(presa === 0, `${presa} partida(s) travaram — alguém ficou sem ação nenhuma`);
  ok(maos > 200, `só ${maos} mãos rodaram; a varredura precisa de volume para valer`);
  // O EMPATE TEM DE ACONTECER SOZINHO. Zero aqui não seria sorte: seria o desempate por
  // naipe tendo vazado para as cartas comuns, e o melou deixando de existir no jogo inteiro
  // sem nenhuma outra asserção notar.
  ok(melou > 0, 'nenhuma vaza empatou em centenas de mãos — o melou não existe mais');
  console.log(`  60 partidas · ${maos} mãos · ${lances} cartas · ${correu} corridas · ` +
    `${entregou} entregas · ${melou} vazas empatadas · 0 travadas`);
}

// ═══ O BOT ══════════════════════════════════════════════════════════════════
console.log('\no poder de uma carta, e o de uma mão');
{
  const man = iv('Q');                                  // virou 7 → manilha Q
  // A ESCALA APERTA AS DUAS FAIXAS. `forcaDaCarta` é boa para comparar e péssima para somar
  // (100 contra 9); `poderDaCarta` é o contrário. Ordem preservada, distâncias comprimidas.
  ok(mod.poderDaCarta(c('Q', 'paus'), man) > mod.poderDaCarta(c('3', 'paus'), man),
    'a manilha devia ter mais poder que o 3');
  ok(mod.poderDaCarta(c('3', 'ouros'), man) > mod.poderDaCarta(c('4', 'paus'), man),
    'o 3 devia ter mais poder que o 4');
  ok(mod.poderDaCarta(c('4', 'ouros'), man) === 0, 'a carta mais fraca devia valer 0');
  ok(mod.poderDaCarta(c('Q', 'paus'), man) <= 1, 'nenhuma carta pode passar de 1');
  // O NAIPE só separa manilhas, aqui também.
  ok(mod.poderDaCarta(c('3', 'paus'), man) === mod.poderDaCarta(c('3', 'ouros'), man),
    'duas cartas comuns iguais deviam ter o mesmo poder');

  // A mão de três manilhas contra a mão de três lixos.
  const otima = mod.poderDaMao([c('Q', 'paus'), c('3', 'paus'), c('2', 'copas')], man);
  const pessima = mod.poderDaMao([c('4', 'ouros'), c('5', 'ouros'), c('6', 'ouros')], man);
  ok(otima > 0.8, `a mão com manilha e dois altos devia ser forte, deu ${otima.toFixed(2)}`);
  ok(pessima < 0.25, `a mão de 4-5-6 devia ser fraca, deu ${pessima.toFixed(2)}`);
  // UMA MANILHA SOZINHA levanta a mão mais do que a média sugere: ela ganha uma vaza
  // inteira, e uma vaza é um terço da mão.
  const soManilha = mod.poderDaMao([c('Q', 'paus'), c('4', 'ouros'), c('5', 'ouros')], man);
  const mediaCrua = (mod.poderDaCarta(c('Q', 'paus'), man) + 0 + mod.poderDaCarta(c('5', 'ouros'), man)) / 3;
  ok(soManilha > mediaCrua, 'a manilha sozinha devia pesar mais que a média crua');
  console.log(`  Q♣ ${mod.poderDaCarta(c('Q', 'paus'), man).toFixed(2)} · ` +
    `3 ${mod.poderDaCarta(c('3', 'ouros'), man).toFixed(2)} · 4 0.00 · ` +
    `mão ótima ${otima.toFixed(2)} × péssima ${pessima.toFixed(2)}`);
}

console.log('\nque carta o bot joga');
{
  const P = mod.novaPartidaDoTruco(mesa(4));
  P.manilha = iv('Q');
  const time = c => c % 2;
  const info = c2 => Object.assign(mod.informacaoDoTruco(P, 0, mod.NIVEIS_TRUCO.dificil), c2);

  // GANHA COM A MAIS BARATA QUE GANHA. Matar um 4 com manilha é jogar a mão fora.
  P.mesa = [{ cadeira: 1, carta: c('4', 'ouros') }];
  let e = mod.escolherCarta([c('Q', 'paus'), c('5', 'ouros'), c('3', 'paus')], info({ mesa: P.mesa }), time);
  ok(mod.mesmaCarta(e.carta, c('5', 'ouros')),
    `devia ganhar com o 5 e escolheu ${mod.nomeDaCarta(e.carta)}`);

  // NÃO DÁ PARA GANHAR: descarta a pior.
  P.mesa = [{ cadeira: 1, carta: c('Q', 'paus') }];
  e = mod.escolherCarta([c('4', 'ouros'), c('7', 'ouros'), c('3', 'paus')], info({ mesa: P.mesa }), time);
  ok(mod.mesmaCarta(e.carta, c('4', 'ouros')),
    `devia descartar o 4 e escolheu ${mod.nomeDaCarta(e.carta)}`);

  // O SÓCIO ESTÁ GANHANDO: não passe por cima dele. É o erro mais caro de um bot de dupla.
  P.mesa = [{ cadeira: 2, carta: c('3', 'paus') }];    // cadeira 2 é do time da cadeira 0
  e = mod.escolherCarta([c('Q', 'paus'), c('4', 'ouros')], info({ mesa: P.mesa }), time);
  ok(mod.mesmaCarta(e.carta, c('4', 'ouros')),
    `o parceiro estava ganhando e o bot gastou ${mod.nomeDaCarta(e.carta)}`);

  // SAINDO, sai forte — e a primeira vaza vale mais NESTA CASA, porque é o desempate.
  e = mod.escolherCarta([c('4', 'ouros'), c('3', 'paus'), c('5', 'ouros')],
    info({ mesa: [], vazas: [] }), time);
  ok(mod.mesmaCarta(e.carta, c('3', 'paus')),
    `saindo devia sair forte e saiu com ${mod.nomeDaCarta(e.carta)}`);

  // E TODA ESCOLHA VEM COM PORQUÊ, porque é o que a dica mostra a quem está aprendendo.
  ok(e.porques.length > 0 && e.porques.every(p => p.texto), 'a escolha veio sem porquê');
  console.log(`  ganha com a mais barata · descarta a pior · não atropela o sócio · sai forte na 1ª`);
}

console.log('\nquando o bot aposta');
{
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.manilha = iv('Q');
  const info = mod.informacaoDoTruco(P, 0, mod.NIVEIS_TRUCO.normal);
  const OTIMA = [c('Q', 'paus'), c('3', 'paus'), c('2', 'copas')];
  const PESSIMA = [c('4', 'ouros'), c('5', 'ouros'), c('6', 'ouros')];

  ok(mod.querTrucar(OTIMA, info, 3), 'com manilha e dois altos o bot devia trucar');
  ok(!mod.querTrucar(PESSIMA, info, 3), 'com 4-5-6 o bot não devia trucar');
  // O LIMIAR SOBE COM A APOSTA, e provar isso exige uma mão NO MEIO — uma que passe no
  // limiar do truco e não passe no do doze. A primeira versão usava uma mão fraca, que é
  // recusada nos dois mundos: a asserção passava e passaria também com o limiar achatado,
  // ou seja não media a escada coisa nenhuma. Foi a mutação que contou.
  const BOA = [c('Q', 'ouros'), c('3', 'ouros'), c('7', 'ouros')];   // a manilha mais fraca
  const pBoa = mod.poderDaMao(BOA, info.manilha);
  ok(pBoa > 0.58 && pBoa < 0.82, `a mão do meio saiu em ${pBoa.toFixed(2)} e precisa ficar entre 0.58 e 0.82`);
  ok(mod.querTrucar(BOA, info, 3), 'com manilha de ouros e um 3 o bot devia pedir truco');
  ok(!mod.querTrucar(BOA, info, 12), 'a MESMA mão não pode pedir doze — é a escada em número');

  // CORRER É BARATO, ACEITAR É CARO — e por isso o limiar de aceitar é mais BAIXO que o de
  // pedir. Um bot com os dois iguais correria de mãos boas.
  ok(mod.responderAposta(OTIMA, info, { valor: 3 }) !== 'correr', 'não se corre com mão ótima');
  ok(mod.responderAposta(PESSIMA, info, { valor: 3 }) === 'correr', 'com 4-5-6 devia correr');
  // AUMENTAR é um ramo que não roda sozinho, e a primeira versão desta asserção usava a mão
  // "ótima" (0.84) contra um limiar de 0.86 — ou seja, media o NÚMERO e não o mecanismo, e
  // reprovava com o bot certíssimo. Aqui vai a mão imbatível: TRÊS manilhas, que existem
  // (são quatro no baralho). Se nem com ela o bot sobe, o ramo está morto.
  const NUTS = [c('Q', 'paus'), c('Q', 'copas'), c('Q', 'espadas')];
  ok(mod.poderDaMao(NUTS, info.manilha) > 0.9, 'três manilhas deviam ser quase 1');
  ok(mod.responderAposta(NUTS, info, { valor: 6 }) === 'aumentar',
    'com três manilhas o bot devia subir de 6 para 9');
  // A mão MÉDIA aceita o truco e não pede: é a assimetria em número.
  const MEDIA = [c('3', 'ouros'), c('K', 'paus'), c('6', 'ouros')];
  ok(!mod.querTrucar(MEDIA, info, 3) && mod.responderAposta(MEDIA, info, { valor: 3 }) === 'aceitar',
    'a mão média devia aceitar sem pedir — se pede e aceita no mesmo limiar, algo está errado');

  // DESESPERO: perdendo feio, a mesma mão vale mais.
  const atras = Object.assign({}, info, { placar: [0, 8] });
  ok(mod.avaliarAposta(MEDIA, atras) > mod.avaliarAposta(MEDIA, info),
    'perdendo de 8 a 0 a mesma mão devia valer mais — não ter nada a perder é informação');
  console.log('  truca com mão boa · corre com lixo · aceita com média · arrisca mais perdendo');
}

console.log('\no bot não trapaceia: a dica sai da VISTA');
{
  // A MESMA PROPRIEDADE DO DOMINÓ, e ela não é escrúpulo: se a dica precisasse de um campo
  // que a visão não tem, isso seria PROVA de que o bot olha a mão dos outros.
  const P = mod.novaPartidaDoTruco(mesa(2));
  P.vez = 0; P.saiu = 0;
  const v = mod.visaoDoTruco(P, 0);
  const d = mod.dicaDoTruco(v);
  ok(d && d.acao === 'jogar' && d.carta, 'a dica não sugeriu jogada nenhuma na vez do jogador');
  ok(v.mao.some(x => mod.mesmaCarta(x, d.carta)), 'a dica sugeriu uma carta que não está na sua mão');
  ok(d.porques.length > 0, 'a dica veio sem porquê — é metade do que ela serve');
  // FORA DA VEZ não há o que sugerir: prometer jogada que o motor recusa é pior que calar.
  ok(mod.dicaDoTruco(mod.visaoDoTruco(P, 1)) === null, 'a dica falou fora da vez');
  ok(mod.dicaDoTruco(null) === null, 'a dica estourou com vista nula');
  console.log(`  sugeriu ${mod.nomeDaCarta(d.carta)} · ${d.porques.length} porquê(s) · cala fora da vez`);
}

console.log('\no difícil ganha do fácil');
{
  // A ÚNICA ASSERÇÃO DE QUALIDADE do truco, irmã da que o dominó tem há oito releases. Ela é
  // o que defende os limiares do bot: eles são chute calibrado, e o que os justifica não é a
  // escolha do número — é isto continuar verde depois de mexerem neles.
  //
  // LIMIAR e não número fixo (`> 2σ`), pelo mesmo motivo do dominó: a força muda quando uma
  // regra muda, e um número cravado transformaria toda mudança de regra em falso alarme.
  seedRandom(4242);
  let venceDificil = 0, venceFacil = 0, travadas = 0;
  const N = 400;
  for (let p = 0; p < N; p++) {
    // Alterna quem senta na cadeira 0, senão a vantagem da saída vira a do nível.
    const dOndeEsta = p % 2;
    const cad = [0, 1].map(i => ({ nome: 'C' + i, tipo: 'bot', nivel: i === dOndeEsta ? 'dificil' : 'facil' }));
    const P = mod.novaPartidaDoTruco(cad);
    let guarda = 0;
    while (P.fase !== 'fim' && guarda++ < 3000) {
      if (P.fase === 'fimDeMao') { mod.novaMaoDoTruco(P); continue; }
      const i = mod.jogadaDoBotNoTruco(P, P.vez);
      if (!i) { travadas++; break; }
      if (i.acao === 'jogar') mod.jogarCarta(P, P.vez, i.carta);
      else if (i.acao === 'trucar' || i.acao === 'aumentar') mod.trucar(P, P.vez);
      else if (i.acao === 'aceitar') mod.aceitarTruco(P, P.vez);
      else if (i.acao === 'correr') mod.correrDoTruco(P, P.vez);
      else if (i.acao === 'onze') mod.decidirOnze(P, P.vez, i.jogar);
      else { travadas++; break; }
    }
    if (P.fase !== 'fim') { travadas++; continue; }
    const campeao = P.placar[0] >= P.placar[1] ? 0 : 1;
    if (campeao === dOndeEsta) venceDificil++; else venceFacil++;
  }
  ok(travadas === 0, `${travadas} partida(s) travaram com bots de verdade jogando`);
  const jogadas = venceDificil + venceFacil;
  ok(jogadas > N * 0.9, `só ${jogadas} das ${N} partidas terminaram`);
  // 2σ de uma binomial justa: quantas vitórias a mais que a metade seriam sorte.
  const sigma = Math.sqrt(jogadas) / 2;
  const vantagem = (venceDificil - jogadas / 2) / sigma;
  ok(vantagem > 2,
    `o difícil ganhou ${venceDificil} × ${venceFacil} — ${vantagem.toFixed(1)}σ, e abaixo de 2σ é sorte`);
  console.log(`  ${venceDificil} × ${venceFacil} em ${jogadas} partidas · ` +
    `${(100 * venceDificil / jogadas).toFixed(1)}% · ${vantagem.toFixed(1)}σ`);
}

// ═══ O LAYOUT ═══════════════════════════════════════════════════════════════
// Puro, como o `060-layout.js` do dominó — e é por isso que ele cabe aqui em vez de precisar
// de navegador. O que se testa é a GEOMETRIA da mesa, não o desenho dela.
console.log('\nonde cada carta cai na mesa');
{
  const dist = p => Math.hypot(p.x, p.z);

  // A SUA CARTA CAI NA SUA DIREÇÃO, que em coordenadas de mundo é +z (a câmera olha de +z
  // para a origem). Se este sinal inverter, a mesa inteira gira e cada carta aparece no
  // lugar do adversário de frente — e nenhuma foto denuncia, porque continua simétrica.
  const minha = mod.postaDaVaza(0, 0, 4);
  ok(minha.z > 0 && Math.abs(minha.x) < 1e-9,
    `a sua carta devia cair à sua frente (+z), e caiu em x=${minha.x.toFixed(2)} z=${minha.z.toFixed(2)}`);

  // O DE FRENTE cai do lado oposto.
  const frente = mod.postaDaVaza(2, 0, 4);
  ok(frente.z < 0 && Math.abs(frente.x) < 1e-9, 'a carta de quem senta à sua frente devia cair em -z');

  // E os dois de lado, um de cada lado — nunca no mesmo.
  const esq = mod.postaDaVaza(1, 0, 4), dir = mod.postaDaVaza(3, 0, 4);
  ok(Math.sign(esq.x) === -Math.sign(dir.x) && Math.abs(esq.x) > 0.1,
    `as cadeiras 1 e 3 caíram do mesmo lado: ${esq.x.toFixed(2)} e ${dir.x.toFixed(2)}`);

  // TODAS À MESMA DISTÂNCIA do centro: a vaza é um círculo, e uma carta mais perto pareceria
  // ter sido jogada com mais força.
  const raios = [0, 1, 2, 3].map(i => dist(mod.postaDaVaza(i, 0, 4)));
  ok(Math.max(...raios) - Math.min(...raios) < 1e-9, `os raios não batem: ${raios.map(r => r.toFixed(3))}`);

  // NADA SE SOBREPÕE: duas cartas quaisquer ficam a mais de uma largura de carta uma da
  // outra. É a mesma pergunta que o espaçamento da mão do dominó responde, e o número sai
  // do TAMANHO DA CARTA — nunca de um valor escolhido a olho.
  for (const n2 of [2, 4]) {
    const postas = [];
    for (let i = 0; i < n2; i++) postas.push(mod.postaDaVaza(i, 0, n2));
    for (let i = 0; i < n2; i++) for (let k = i + 1; k < n2; k++) {
      const d = Math.hypot(postas[i].x - postas[k].x, postas[i].z - postas[k].z);
      ok(d > mod.CARTA_L, `mesa de ${n2}: as cartas ${i} e ${k} ficaram a ${d.toFixed(2)}, e a carta tem ${mod.CARTA_L}`);
    }
  }

  // A CARTA CAI DO LADO DE QUEM A JOGOU — a mesma convenção que a CASA usa para os assentos
  // (`assentosDaMesa`, em 070-cena.js, põe o assento em `sin(a), cos(a)`).
  //
  // Esta é a asserção que pega o ESPELHO, e ela precisou existir: a primeira versão do
  // layout tinha `-sin`, e a mesa saía espelhada — o vizinho da esquerda jogava e a carta
  // aparecia à direita. Todas as outras asserções passavam, porque uma mesa espelhada
  // continua simétrica: os raios batem, nada se sobrepõe, e as cadeiras 1 e 3 continuam em
  // lados opostos. Só amarrar a carta ao ASSENTO denuncia.
  for (const n2 of [2, 4]) {
    for (let i = 0; i < n2; i++) {
      const a = mod.anguloDaCadeira(i, 0, n2);
      const p = mod.postaDaVaza(i, 0, n2);
      const ladoDoAssento = Math.sin(a), ladoDaCarta = p.x;
      ok(Math.abs(ladoDoAssento) < 1e-9 || Math.sign(ladoDoAssento) === Math.sign(ladoDaCarta),
        `mesa de ${n2}: a cadeira ${i} senta em x=${ladoDoAssento.toFixed(2)} e a carta dela caiu em ` +
        `x=${ladoDaCarta.toFixed(2)} — a mesa está espelhada`);
    }
  }

  // A MESA GIRA COM QUEM OLHA: para o jogador da cadeira 2, a carta DELE é que fica na
  // frente. Sem isto, o convidado veria a mesa pelos olhos do anfitrião.
  const doOutro = mod.postaDaVaza(2, 2, 4);
  ok(Math.abs(doOutro.z - minha.z) < 1e-9 && Math.abs(doOutro.x - minha.x) < 1e-9,
    'a mesa não girou para quem senta na cadeira 2');
  console.log(`  raio ${raios[0].toFixed(2)} · 4 cadeiras sem sobreposição · a mesa gira com quem olha`);
}

console.log('\nas vazas ganhas empilham de lado');
{
  const meu = mod.postaDaVazaGanha(0, 0, 0, 2);       // eu sou a cadeira 0 (time 0)
  const dele = mod.postaDaVazaGanha(0, 1, 0, 2);
  ok(Math.sign(meu.x) === -Math.sign(dele.x) && Math.abs(meu.x) > 0.1,
    'a pilha do seu time e a do adversário ficaram do mesmo lado');
  // O MELOU NÃO É DE NINGUÉM: fica no meio e girado, para não parecer de alguém.
  const melou = mod.postaDaVazaGanha(0, null, 0, 2);
  ok(Math.abs(melou.x) < 1e-9 && melou.inclinada === true,
    'a vaza que melou devia ficar no meio e marcada como tal');
  // EMPILHA PARA CIMA, senão a segunda vaza some dentro da primeira.
  const p0 = mod.postaDaVazaGanha(0, 0, 0, 2), p1 = mod.postaDaVazaGanha(1, 0, 0, 2);
  ok(p1.y > p0.y, 'a segunda vaza da pilha devia ficar acima da primeira');
  ok(p1.z < p0.z, 'a pilha devia crescer para trás, longe da vaza em curso');

  // E NA MESA DE 4 quem manda é o TIME, não a cadeira: as cadeiras 0 e 2 veem a mesma pilha
  // do mesmo lado, porque são do mesmo time.
  const de0 = mod.postaDaVazaGanha(0, 0, 0, 4), de2 = mod.postaDaVazaGanha(0, 0, 2, 4);
  ok(Math.sign(de0.x) === Math.sign(de2.x),
    'parceiros deviam ver a pilha do time deles do mesmo lado');
  const de1 = mod.postaDaVazaGanha(0, 0, 1, 4);
  ok(Math.sign(de1.x) === -Math.sign(de0.x), 'o adversário devia ver a pilha do outro lado');

  const l = mod.layoutDasVazas([{ time: 0 }, { time: null }, { time: 1 }], 0, 2);
  ok(l.length === 3 && l.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)),
    'layoutDasVazas devolveu posta inválida');
  console.log('  seu time de um lado, o outro do outro · melou no meio · empilha para cima e para trás');
}

console.log('\na mesa cabe no tampo');
{
  // O tampo do boteco tem ~6.1 de raio (070-cena.js). A mesa do truco não cresce — é o
  // contrário da linha do dominó —, então ela tem de caber SEMPRE, sem escala nenhuma.
  for (const n2 of [2, 4]) {
    const cx = mod.caixaDaMesaDoTruco(n2);
    ok(cx.x > 0 && cx.z > 0, `a caixa da mesa de ${n2} veio vazia`);
    ok(cx.x < 3 && cx.z < 3, `a mesa de ${n2} ficou grande demais: ${cx.x.toFixed(2)} × ${cx.z.toFixed(2)}`);
    // E ela precisa envolver de fato o que cai nela: uma caixa menor que as cartas seria
    // uma promessa falsa para quem for enquadrar a câmera.
    for (let i = 0; i < n2; i++) {
      const p = mod.postaDaVaza(i, 0, n2);
      ok(Math.abs(p.x) <= cx.x + 1e-9 && Math.abs(p.z) <= cx.z + 1e-9,
        `a carta da cadeira ${i} caiu fora da caixa declarada`);
    }
  }
  const c4 = mod.caixaDaMesaDoTruco(4);
  console.log(`  mesa de 4: ${c4.x.toFixed(2)} × ${c4.z.toFixed(2)} de meia-caixa, dentro dos 6.1 do tampo`);
}

// ─── O TRUCO SENTA NA MESA ───────────────────────────────────────────────────
// Tudo acima é o CÉREBRO — puro, e provado sem casa nenhuma. Este bloco é o CORPO: a aba, o
// menu, a barra de apostas, a mesa em 3D e o caminho da intenção, que é por onde passam o seu
// toque, o bot e a rede.
//
// A pergunta que ele existe para responder é uma só, e é a que mais dói neste projeto:
// **a mesa PARA em algum lugar?** Estado de onde não se sai, sem mensagem e sem botão, é o
// defeito que quatro filas passaram consertando.
console.log('\na casa senta na mesa de truco');
{
  ok(mod.abrirJogo('truco'), 'a casa não conseguiu abrir o truco');
  ok(mod.JOGO_ID === 'truco', `o jogo na mesa é ${mod.JOGO_ID}`);
  // REGISTRADO ≠ JOGÁVEL, e a v4.5 é onde os dois se encontram: sem esta asserção, tirar o
  // `emBreve` e esquecer o motor passaria despercebido até alguém clicar.
  ok(!mod.JOGOS.truco.emBreve, 'o truco ainda está marcado como "em breve"');
  ok(typeof mod.JOGO.motor.aplicar === 'function', 'o truco não pendurou o motor no contrato');
  ok(!mod.JOGO.painel,
    'o truco declarou um painel de apoio — sem ele, a casa esconde o botão "Contar"');

  // O menu do truco: até 12, e nenhuma opção de mesa (compra livre é regra de monte).
  ok(mod.JOGO.menu.ALVOS[0] === 12, `o alvo padrão do truco é ${mod.JOGO.menu.ALVOS[0]}, não 12`);
  ok(mod.JOGO.menu.OPCOES.length === 0, 'o truco declarou opção de mesa que não existe nele');

  // Mesa de 2: você e um bot difícil.
  mod.MESA.n = 2;
  mod.MESA.modo = 'paulista';
  mod.MESA.alvo = 12;
  mod.MESA.cadeiras[0].tipo = 'voce';
  mod.MESA.cadeiras[1].tipo = 'bot';
  mod.MESA.cadeiras[1].nivel = 'dificil';
  mod.comecarLocal();

  ok(!!mod.P, 'comecarLocal não montou partida nenhuma');
  ok(mod.P.maos.every(m => m.length === 3), 'alguém não recebeu três cartas');
  ok(Array.isArray(mod.P.vira) && mod.P.vira.length === 2, 'a vira não saiu do monte');
  ok(mod.vistaAtual && mod.vistaAtual.vira, 'a vista não carrega a vira — a manilha fica invisível');

  // ─── os medidores ─────────────────────────────────────────────────────────
  const meds = mod.medidoresDoTruco(mod.vistaAtual);
  // QUANTOS CABEM É PERGUNTA DE TELA, E ESTA SUÍTE NÃO TEM TELA.
  //
  // A linha aqui era `meds.length === 3`, com a mensagem "o #topo tem lugar para três" — e
  // ela gravava a IMPLEMENTAÇÃO, não o requisito. Quando o quarto medidor entrou (o placar de
  // vazas, pedido do Ricardo em 07/08), esta suíte reprovou por o jogo ter MELHORADO: é
  // letra por letra o caso do botão de som que exigia `=== '✕'` e caiu no dia em que o glifo
  // foi consertado.
  //
  // O requisito é "o #topo não transborda e nenhum painel monta em cima de outro", e quem
  // pode responder isso é o `test-telas` — que desde a v4.6 tem três cenas de truco em seis
  // tamanhos de tela. O quarto medidor foi MEDIDO lá antes de entrar: zero transbordo e zero
  // sobreposição em 360×640 e 390×844, que são os dois retratos mais apertados.
  //
  // O teto continua existindo porque um número sem teto vira uma lista que ninguém revisa —
  // mas ele agora diz ONDE conferir, em vez de cravar o que existe hoje.
  ok(meds.length <= 3, `o truco pediu ${meds.length} medidores. O QUARTO foi tentado e medido: ` +
    `em retrato ele cabe, e em paisagem 640×360 ele empurra o #topo por cima da mão de um ` +
    `adversário. Quem responde é \`node tests/test-telas.mjs 640x360 duplas\`, não esta suíte`);
  ok(meds.every(m => m.rot && m.val !== undefined && m.val !== null),
    'algum medidor veio sem rótulo ou sem valor — o #topo mostraria um painel em branco');
  // PELO RÓTULO, NUNCA PELA POSIÇÃO. Estas três liam `meds[0]`, `meds[1]` e `meds[2]`, e
  // `meds[1].val === 1` não conferia rótulo nenhum: no dia em que o jogo inserisse um painel
  // antes, ela passaria a medir OUTRO medidor calada. Este arquivo já pagou exatamente isso
  // quando o painel da vira saiu e o `[2]` virou outro painel — uma asserção reprovou com o
  // jogo certo e a outra matou o processo. A lição foi aplicada em três pontos deste mesmo
  // arquivo (`vazasDe`, e as duas de `Vale`) e esquecida aqui (C7 da Fila 12).
  const med = rot => meds.find(m => m.rot === rot);
  // A MANILHA É A QUE NÃO PODE FALTAR: ela não se deduz da mesa, e sem ela o jogador não sabe
  // o que tem na mão. A VIRA saiu daqui em 07/08 — ela está desenhada no meio da mesa.
  ok(med('Manilha') && mod.VALORES.includes(String(med('Manilha').val)),
    `a manilha saiu como "${(med('Manilha') || {}).val}", que não é um valor de carta`);
  ok(med('Vale') && med('Vale').val === 1,
    `a mão vale ${(med('Vale') || {}).val} antes de qualquer aposta, e devia valer 1`);
  // O PLACAR DE VAZAS começa em 0×0 e é do SEU ponto de vista — mesma convenção do placar da
  // partida. Ele existe porque ler a pilha na mesa é fazer a conta ao contrário.
  ok(med('Vazas') && med('Vazas').val === '0×0',
    `o placar de vazas começou em "${(med('Vazas') || {}).val}", e antes da primeira vaza é 0×0`);
  // E A VIRA CONTINUA VISÍVEL, só que na MESA e não no painel — sem isto o conserto acima
  // teria escondido a única carta pública do baralho e ninguém notaria.
  ok(mod.naMesaDoTruco.has('vira'), 'a vira saiu do painel E não está desenhada na mesa');

  // O BOTÃO DO PAINEL TEM DE ESTAR ESCONDIDO. O truco não declara `painel` no registro (as
  // vazas ganhas estão à vista na mesa, e a pergunta "quantas peças de cada número já
  // apareceram" não existe aqui), então a casa esconde o botão em vez de oferecer uma gaveta
  // vazia — é a espécie de defeito que o `refletirMesaNosBotoes` existe para impedir: o jogo
  // certo e a tela prometendo.
  //
  // Ela nasceu de uma dúvida de sonda: o `textContent` do `#acoes` numa mesa de truco dizia
  // "Painel", e `textContent` NÃO sabe de CSS — ele lê filho escondido igual. A dúvida só
  // fecha perguntando pela CLASSE, e é o que esta linha faz.
  ok(!mod.JOGO.painel, 'o truco declarou um painel de apoio que ele não tem');
  ok(mod.HUD.contar.classList.contains('oculta'),
    'o botão do painel ficou visível numa mesa de truco — ele abriria uma gaveta vazia');

  // ─── a mesa em 3D ─────────────────────────────────────────────────────────
  // A VIRA PRECISA ESTAR DESENHADA. Ela é a única carta pública do baralho, e sem ela na mesa
  // o jogador não tem como saber qual é a manilha — o jogo fica ilegível.
  ok(mod.naMesaDoTruco.has('vira'), 'a vira não foi desenhada na mesa');

  ok(mod.naMaoDoTruco.length === 3, `a sua mão tem ${mod.naMaoDoTruco.length} cartas em 3D`);
  ok(mod.grupoMaoDoTruco.children.length === 3, 'as cartas da mão não entraram na cena');

  // ─── as MANILHAS realçadas na sua mão ─────────────────────────────────────
  // O painel diz `MANILHA 5` e o jogador tem de descobrir sozinho quais das três cartas são
  // 5. A informação existia na visão desde a v4.3 e a tela não a mostrava.
  //
  // A MÃO É ARMADA, e sem isso a asserção seria verde por trivialidade: numa mão sorteada
  // pode não haver manilha nenhuma, e aí "as marcadas são exatamente as manilhas" compara
  // dois conjuntos VAZIOS e passa com o realce apagado. É a família do `conn.open` e do
  // helper que passava índice — montagem que não alcança o estado interessante —, e o remédio
  // é o de sempre: exigir que a montagem CONSEGUIU antes de medir.
  //
  // AS DUAS MÃOS E A MESA são postas à mão, não só a minha: sobrescrever uma só deixaria a
  // carta que o bot já jogou viva em dois lugares, e `chaveCarta` é a chave de
  // `naMesaDoTruco` — duas cartas iguais na mesa é um estado que o jogo não produz, e medir
  // dentro dele mede outra coisa.
  //
  // A vira é o 4 de ouros, então a manilha é o 5 — a SEGUINTE na escada, que começa no 4.
  // Pelo `c('4', 'ouros')` e não por índice, que é a convenção desta suíte: `[3, 0]` é índice
  // de índice, e um dígito trocado ali passa despercebido.
  mod.P.vira = c('4', 'ouros');              // → manilha: o 5
  mod.P.manilha = mod.manilhaDaVira(mod.P.vira);
  mod.P.mesa = [];
  mod.P.maos[0] = [c('5', 'paus'), c('4', 'espadas'), c('3', 'copas')];   // ← uma MANILHA
  mod.P.maos[1] = [c('A', 'ouros'), c('2', 'espadas'), c('7', 'copas')];
  mod.P.vez = 0;
  mod.publicar();

  const manilhasNaMao = mod.naMaoDoTruco.filter(m => mod.ehManilha(m.carta, mod.P.manilha));
  const comunsNaMao = mod.naMaoDoTruco.filter(m => !mod.ehManilha(m.carta, mod.P.manilha));
  // A GUARDA DE MONTAGEM, e ela vem ANTES de qualquer medida: sem uma de cada, o que vier
  // abaixo não distingue realce nenhum de realce certo.
  ok(manilhasNaMao.length === 1 && comunsNaMao.length === 2,
    `a montagem falhou: ${manilhasNaMao.length} manilha(s) e ${comunsNaMao.length} comum(ns) ` +
    'na mão, e o caso interessante precisa de uma e duas');

  ok(!!manilhasNaMao[0].marca, 'a manilha da sua mão não ganhou marca nenhuma');
  ok(comunsNaMao.every(m => !m.marca),
    `${comunsNaMao.filter(m => m.marca).length} carta(s) comum(ns) foram marcadas como manilha`);
  // FILHA DA CARTA — é o que a faz acompanhar o leque quando a mão é arrumada ou a tela muda
  // de largura. Pendurada no grupo da mão, ela ficaria parada enquanto a carta desliza.
  //
  // O `|| {}` NÃO É PARANOIA, e ele entrou depois de a mutação cobrar: escrito
  // `marca.parent`, esta linha LANÇA quando a marca não existe — e aí a mutação que apaga o
  // realce mata o PROCESSO em vez de reprovar, a suíte trunca, e a conferência sub-relata
  // (uma reprovação onde havia duas). Foi exatamente o que aconteceu na primeira rodada.
  // Em suíte que vai ser mutada, toda asserção tem de sobreviver ao objeto ausente.
  ok((manilhasNaMao[0].marca || {}).parent === manilhasNaMao[0].obj,
    'a marca da manilha não foi pendurada na carta, então ela não acompanharia o movimento');

  // O INVARIANTE 3, e é por isto que esta asserção existe: `grupoOutrosDoTruco` é VERSO, e um
  // anel ali diria ao adversário que ele tem manilha. Vazamento por decoração é vazamento
  // igual — a fronteira não é só o que `visaoDe` devolve, é também o que a tela desenha com o
  // que ela devolveu.
  let marcadasFora = 0;
  mod.grupoOutrosDoTruco.traverse(o => {
    if (o.geometry === mod.geomManilhaNoTruco) marcadasFora++;
  });
  ok(marcadasFora === 0,
    `${marcadasFora} carta(s) da mão de um adversário ganharam a marca de manilha`);

  // MÃO NOVA, MANILHA NOVA, e a marca TROCA DE DONA. Isto não é redundante com o de cima: o
  // realce vive no laço que roda em TODA publicação, e não dentro do `if` da assinatura da
  // mão — que aqui nem dispararia, porque as cartas são as mesmas. Escrito de outro jeito, o
  // anel ficaria preso na carta da mão anterior até alguém reordenar o leque.
  //
  // A vira passa a ser o 2 de ouros, e a seguinte dele na escada é o 3.
  mod.P.vira = c('2', 'ouros');
  mod.P.manilha = mod.manilhaDaVira(mod.P.vira);
  mod.publicar();
  const aDe5 = mod.naMaoDoTruco.find(m => mod.mesmaCarta(m.carta, c('5', 'paus')));
  const aDe3 = mod.naMaoDoTruco.find(m => mod.mesmaCarta(m.carta, c('3', 'copas')));
  ok(aDe5 && !aDe5.marca, 'o 5 de paus continuou marcado depois de deixar de ser manilha');
  ok(aDe3 && !!aDe3.marca, 'o 3 de copas virou manilha e não ganhou marca');

  // E volta ao estado de onde o resto da seção parte: mesa vazia, sua vez, três cartas.
  mod.P.vira = c('4', 'ouros');
  mod.P.manilha = mod.manilhaDaVira(mod.P.vira);
  mod.publicar();

  // ─── escolher → ver → confirmar ───────────────────────────────────────────
  // O caminho do toque, inteiro. A vez é forçada porque o que se mede aqui é o CAMINHO, e não
  // o sorteio de quem abre.
  mod.P.vez = 0;
  mod.publicar();
  const jogaveis = mod.naMaoDoTruco.filter(m => m.jogavel).length;
  ok(jogaveis === 3, `só ${jogaveis} das 3 cartas ficaram jogáveis na sua vez`);

  const antes = mod.P.maos[0].length;
  mod.selecionarCarta(0);
  ok(mod.temPreviaDoTruco(), 'escolher a carta não abriu o fantasma na mesa');
  mod.confirmarNoTruco();
  ok(mod.P.maos[0].length === antes - 1, 'confirmar não tirou a carta da mão');
  ok(!mod.temPreviaDoTruco(), 'o fantasma ficou na mesa depois de jogar');

  // ─── a marca de QUEM ESTÁ GANHANDO, em 3D ─────────────────────────────────
  // A outra metade do pedido do Ricardo. A frase da linha da vez já foi conferida lá em cima
  // (`notaDaVezNoTruco`); esta responde para quem está OLHANDO a mesa, que é onde os olhos
  // estão na hora de escolher a carta.
  //
  // Sem asserção aqui a marca seria a única coisa desta onda que nada prova: o `test-telas`
  // mede CAIXA, e a marca fica de fora da caixa DE PROPÓSITO (`criarCarta` expõe
  // `userData.corpo`, e é só o corpo que entra no `Box3`) — justamente para não inflar a
  // mesa. O que a isenta da medida de espaço a deixaria sem medida nenhuma.
  //
  // MORA NO FIM DA SEÇÃO, e não no meio: ela GASTA cartas, e o bloco acima exige mão de 3.
  // Cena que mexe em estado compartilhado derruba a seguinte, e o sintoma chega longe da
  // causa — é a lição do `MESA` deixado no Trio, aqui em terceiro meio.
  const marcadas = () => [...mod.naMesaDoTruco.entries()].filter(([, r]) => r.marca);
  // Uma carta já está na mesa (o `confirmarNoTruco` acima), então há um líder.
  const uma = marcadas();
  ok(uma.length === 1, `${uma.length} cartas marcadas como ganhando, e com uma na mesa devia ser 1`);
  // E É A CARTA CERTA, não uma qualquer. Marcar "alguma" passaria numa asserção de contagem e
  // mentiria na mesa — é a lição do atlas de pintas: "tem tinta em algum lugar" aprova
  // qualquer borrão; a asserção que vale escolhe o ponto onde a tinta TEM de estar.
  const vg = mod.visaoDoTruco(mod.P, 0);
  const daVez = (mod.P.mesa || []).find(j => j.cadeira === vg.ganhandoAVaza);
  ok(uma.length === 1 && daVez && uma[0][0] === mod.chaveCarta(daVez.carta),
    'a marca de "está ganhando" caiu numa carta que não é a que está ganhando');
  // FILHA DA CARTA — é isso que a faz deslizar junto, sem uma linha de animação.
  ok(uma.length === 1 && uma[0][1].marca.parent === uma[0][1].obj,
    'a marca não foi pendurada na carta, então ela não acompanharia o movimento');

  // FECHADA A VAZA a marca some. Sem isto ela desceria para a pilha grudada na carta, e a
  // mesa passaria a dizer que uma carta virada de barriga para baixo está ganhando.
  // COM TETO: um `while` sem bound numa suíte é pior que uma reprovação — ele trava o
  // processo e o log fica igual ao de uma suíte que nunca rodou.
  for (let g = 0; g < 8 && mod.P.mesa.length; g++) {
    mod.jogarCarta(mod.P, mod.P.vez, mod.P.maos[mod.P.vez][0]);
  }
  ok(mod.P.mesa.length === 0, 'não consegui fechar a vaza para conferir que a marca some');
  mod.publicar();
  const sobrando = marcadas().length;
  ok(sobrando === 0, `a vaza fechou e ${sobrando} marca(s) ficaram para trás`);
}

// ─── a barra de apostas ──────────────────────────────────────────────────────
// O encaixe que a Fase 1 deixou de fora de propósito, porque sem o truco escrito a forma dele
// seria chute. O que se cobra dela é o que ela promete: os botões que existem são exatamente
// as ações que o motor aceita — nem uma a menos (silêncio), nem uma a mais (promessa).
console.log('\na barra de apostas oferece o que o motor aceita');
{
  const P2 = mod.novaPartidaDoTruco(
    [{ nome: 'A', tipo: 'voce' }, { nome: 'B', tipo: 'bot' }], { alvo: 12 });
  const bt = mod.barraDoTruco(mod.visaoDoTruco(P2, P2.vez));
  ok(bt.length === 1 && /truco/i.test(bt[0].rotulo),
    `na vez normal a barra devia oferecer só "pedir truco", e veio: ${bt.map(b => b.rotulo).join(', ')}`);

  const quemPediu = P2.vez;
  mod.trucar(P2, quemPediu);
  const vPedido = mod.visaoDoTruco(P2, P2.vez);
  const rotulos = mod.barraDoTruco(vPedido).map(b => b.rotulo.toLowerCase());
  ok(rotulos.some(r => r.includes('aceitar')), 'faltou "Aceitar" com pedido na mesa');
  ok(rotulos.some(r => r.includes('correr')), 'faltou "Correr" com pedido na mesa');
  ok(rotulos.some(r => r.includes('seis')), 'faltou o aumento para seis');
  // E o medidor tem de DIZER que subiu: "1 → 3". Sem isso o jogador aceita sem saber o quê.
  // PELO RÓTULO: esta linha era `[2]`, e `[2]` deixou de ser o "Vale" no dia em que o painel
  // da vira saiu. Índice cravado numa lista que pode encolher é asserção que muda de assunto
  // sem avisar — aqui ela passou a medir o placar de vazas e reprovou com o jogo certo.
  ok(String((mod.medidoresDoTruco(vPedido).find(m => m.rot === 'Vale') || {}).val).includes('→'),
    'o medidor não mostrou a aposta pendente');

  // NO TOPO DA ESCADA não há para onde subir, e o botão tem de SUMIR. Botão que não faz nada
  // é a mesma doença do "o silêncio é o defeito", entrando pela porta da promessa.
  P2.pedido = { de: 1, time: 1, valor: 12 };
  P2.vez = 0;
  const noTeto = mod.barraDoTruco(mod.visaoDoTruco(P2, 0)).map(b => b.rotulo.toLowerCase());
  ok(!noTeto.some(r => r.includes('aumentar')), 'ofereceu aumentar no topo da escada (doze)');

  // A mão de 11 tem DUAS saídas e nenhuma terceira: jogar valendo 3 ou entregar 1.
  const P3 = mod.novaPartidaDoTruco(
    [{ nome: 'A', tipo: 'voce' }, { nome: 'B', tipo: 'bot' }], { alvo: 12 });
  P3.placar = [11, 4];
  mod.novaMaoDoTruco(P3);
  const b11 = mod.barraDoTruco(mod.visaoDoTruco(P3, P3.vez));
  ok(b11.length === 2, `a mão de 11 ofereceu ${b11.length} saídas, e são duas`);
  ok(b11.every(b => b.acao.acao === 'onze'), 'a mão de 11 ofereceu uma ação que não é dela');

  // NA MÃO DE 11 A VEZ É SUA E NÃO HÁ CARTA A JOGAR, e é este jogo que obrigou a casa a parar
  // de escrever `fase === 'mao'`. Sem `onze` no `emJogo`, `podeAgirAgora()` é falso: os dois
  // botões aparecem na tela e NENHUM funciona, porque `pedirAcao` desiste na primeira linha —
  // a mesa emudece exatamente no lance que decide a partida.
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();
  mod.P.placar = [11, 4];
  mod.novaMaoDoTruco(mod.P);
  mod.publicar();
  ok(mod.P.fase === 'onze', `a mesa devia estar na mão de 11 e está em ${mod.P.fase}`);
  ok(mod.podeAgirAgora(), 'na mão de 11 a casa acha que não há nada a fazer');
  mod.aplicarIntencao(0, { acao: 'onze', jogar: true });
  ok(mod.P.aposta === 3, `jogar a mão de 11 devia pôr a mão valendo 3, e vale ${mod.P.aposta}`);

  // AS DUAS BOCAS QUE PEDEM A MESMA COISA. A barra manda `trucar`; o bot manda o veredito de
  // `responderAposta`, que é literalmente `'aumentar'`. Sem os dois nomes no motor, a vez do
  // bot que resolve aumentar não acontece — mesa parada, sem mensagem e sem botão.
  const P4 = mod.novaPartidaDoTruco(
    [{ nome: 'A', tipo: 'voce' }, { nome: 'B', tipo: 'bot' }], { alvo: 12 });
  mod.trucar(P4, P4.vez);
  const antesDoAumento = P4.pedido.valor;
  const rAumento = mod.JOGOS.truco.motor.aplicar(P4, P4.vez, { acao: 'aumentar' });
  ok(!rAumento.erro, `o motor recusou "aumentar", que é o que o bot manda: ${rAumento.erro}`);
  ok(P4.pedido && P4.pedido.valor > antesDoAumento,
    'o "aumentar" do bot não subiu a aposta');

  // A VISTA SEM A MÃO: a tela de troca do hotseat. A mão some E as cinco ações zeram — uma
  // ação sobrevivente seria um botão vivo na tela que esconde as cartas do jogador anterior.
  const v = mod.semAMaoNoTruco(mod.visaoDoTruco(P3, 0));
  ok(v.mao.length === 0, 'a mão sobreviveu à vista travada');
  ok(v.acoes.cartas.length === 0 && !v.acoes.aceitar && !v.acoes.correr
    && !v.acoes.onze && v.acoes.trucar === null, 'sobrou ação na vista travada');
}

// ─── uma partida inteira pela casa ───────────────────────────────────────────
// Do começo ao fim, com os quatro jogando pelo caminho REAL — `aplicarIntencao` →
// `JOGO.motor.aplicar` → `publicar`. É a única asserção que prova que a mesa não empaca: o
// laço tem teto, e bater no teto é a reprovação.
//
// A guarda "a mesa ANDOU" é o que a torna forte. Sem ela, um estado que se repete para sempre
// só apareceria como estouro de teto, e o relatório diria "não acabou" em vez de dizer ONDE.
console.log('\numa partida de truco do começo ao fim');
{
  mod.MESA.n = 4;
  mod.MESA.cadeiras.forEach((c2, i) => { if (i) { c2.tipo = 'bot'; c2.nivel = 'normal'; } });
  mod.comecarLocal();

  let lances = 0, parou = null;
  const TETO = 4000;
  while (mod.P.fase !== 'fim' && lances < TETO) {
    lances++;
    if (mod.P.fase === 'fimDeMao') { mod.novaMaoDoTruco(mod.P); mod.publicar(); continue; }
    const vez = mod.P.vez;
    const acao = mod.jogadaDoBotNoTruco(mod.P, vez);
    if (!acao) { parou = `cadeira ${vez} não teve o que fazer na fase ${mod.P.fase}`; break; }
    // A APOSTA ENTRA NA MARCA, e isto foi a primeira reprovação desta suíte a acusar o
    // TESTE e não o jogo: pedir truco e o outro aceitar devolve a mesa exatamente ao mesmo
    // ponto — mesma mão, mesma vez, mesma carta na mesa, mesmo placar. O que mudou foi o
    // que a mão VALE, e sem ele no retrato o avanço parecia estagnação.
    const marca = () => `${mod.P.maoNum}/${mod.P.fase}/${mod.P.vez}/${mod.P.mesa.length}`
      + `/${mod.P.aposta}/${mod.P.pedido ? mod.P.pedido.valor : '-'}/${mod.P.placar}`;
    const antes = marca();
    mod.aplicarIntencao(vez, acao);
    correrTimers();
    // O QUE O MOTOR RECUSOU vai junto. `catch` que guarda só a mensagem esconde ONDE, e um
    // laço que só diz "não andou" é a mesma doença: o caro é descobrir qual ação e por quê.
    if (antes === marca()) {
      parou = `a mesa não andou: ${antes} · ação ${JSON.stringify(acao)}`
        + ` · ações ${JSON.stringify(mod.acoesDoTruco(mod.P, vez))}`
        + ` · aviso "${mod.HUD.aviso.textContent}"`;
      break;
    }
  }
  ok(!parou, `a mesa parou — ${parou}`);
  ok(mod.P.fase === 'fim', `a partida não acabou em ${lances} lances (fase ${mod.P.fase})`);
  ok(mod.P.placar.some(v => v >= 12), `ninguém chegou a 12: ${mod.P.placar.join(' × ')}`);
  console.log(`  ${lances} lances · ${mod.P.maoNum} mãos · placar ${mod.P.placar.join(' × ')}`);
}

// ─── o HUD aguenta as quatro maneiras de a mão acabar ────────────────────────
// `mostrarFimDeMao` desreferencia `vista.resultado` inteiro, e cada motivo preenche campos
// diferentes. Um `undefined` aqui é a tela de fim de mão em branco — sem botão para sair dela.
console.log('\na tela de fim de mão, nos quatro motivos');
{
  for (const motivo of ['vazas', 'correu', 'entregou', 'melou']) {
    const P2 = mod.novaPartidaDoTruco(
      [{ nome: 'Zé', tipo: 'voce' }, { nome: 'Tião', tipo: 'bot' }], { alvo: 12 });
    P2.vazas = [{ time: 0 }, { time: 1 }, { time: motivo === 'melou' ? null : 0 }];
    P2.resultado = {
      motivo,
      time: motivo === 'melou' ? null : 0,
      pontos: motivo === 'melou' ? 0 : 3,
      aposta: 3,
      vazas: P2.vazas.map(v => v.time),
      vira: P2.vira,
    };
    P2.fase = 'fimDeMao';
    const v = mod.visaoDoTruco(P2, 0);
    let erro = null;
    try {
      const f = mod.fimDeMaoDoTruco(v);
      ok(!!f.titulo && !!f.tipo && !!f.quem, `o fim por "${motivo}" veio com campo vazio`);
      ok(f.detalhe.includes('vaza'), `o fim por "${motivo}" não mostrou as vazas`);
      mod.desenharHUD(v);
      mod.mostrarFimDeMao(v);
    } catch (e) { erro = e.message; }
    ok(!erro, `a tela de fim por "${motivo}" estourou: ${erro}`);
  }
}

// ─── a aposta não atravessa o embaralho ──────────────────────────────────────
// `donoDaAposta` impede a MESMA dupla de subir a aposta duas vezes seguidas. Ele vale dentro
// de uma mão — e sobrevivia a `novaMaoDoTruco`, o que deixava o time que trucou na mão 3 sem
// poder trucar em nenhuma das seguintes, calado.
//
// Esta asserção nasce VERDE (o conserto veio antes dela, empurrado pela partida inteira), e
// por isso a prova dela é MUTAÇÃO: tirando o `P.donoDaAposta = null` do `novaMaoDoTruco`, ela
// cai — e a partida inteira volta a empacar.
console.log('\na aposta não atravessa o embaralho');
{
  const P2 = mod.novaPartidaDoTruco(
    [{ nome: 'A', tipo: 'voce' }, { nome: 'B', tipo: 'bot' }], { alvo: 12 });
  const quem = P2.vez;
  mod.trucar(P2, quem);
  mod.aceitarTruco(P2, P2.vez);
  ok(P2.donoDaAposta === mod.timeNoTruco(P2, quem), 'quem pediu não ficou marcado');
  ok(mod.acoesDoTruco(P2, quem).trucar === null,
    'o mesmo time conseguiu pedir duas vezes seguidas na mesma mão');

  mod.novaMaoDoTruco(P2);
  ok(P2.donoDaAposta === null, 'a marca da aposta sobreviveu ao embaralho');
  P2.vez = quem;
  ok(mod.acoesDoTruco(P2, quem).trucar === 3,
    'quem trucou na mão passada ficou sem poder trucar na mão nova');
}

// ─── o validador da partida guardada ─────────────────────────────────────────
// A casa exigia `linha` e `monte` de TODA partida guardada — dois campos de dominó. Com aquela
// lista, o botão "continuar a partida de antes" nunca apareceria na aba do truco, calado. Hoje
// a casa cobra o que ELA desreferencia e o jogo cobra o resto, e é o resto que se mede aqui.
//
// A IDA E VOLTA PELO ARMAZENAMENTO fica no `test-lembrar` (Chrome), e não por preguiça: o
// harness de Node não tem `localStorage`, então `partidaGuardada()` devolveria `null` dizendo
// "a casa recusou" quando na verdade nada foi gravado — asserção que reprova pelo motivo
// errado é pior que asserção nenhuma. **Lógica no Node, sessão no Chrome.**
console.log('\na partida de truco guardada é entrada de fora');
{
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();
  // O JSON de verdade, e não o objeto vivo: é assim que ela volta do armazenamento, e é onde
  // um campo que não sobrevive à serialização apareceria.
  const bom = JSON.parse(JSON.stringify(mod.P));
  ok(mod.JOGO.motor.partidaValida(bom), 'o validador do truco recusou uma partida boa');
  for (const campo of ['vira', 'vazas', 'mesa', 'manilha']) {
    const torto = JSON.parse(JSON.stringify(mod.P));
    delete torto[campo];
    ok(!mod.JOGO.motor.partidaValida(torto),
      `o validador aceitou uma partida de truco sem ${campo}`);
  }
  // E uma carta torta DENTRO da mão — o caso que uma validação por `Array.isArray` sozinha
  // deixaria passar, e que estoura lá adiante no `forcaDaCarta`.
  const maoTorta = JSON.parse(JSON.stringify(mod.P));
  maoTorta.maos[0][0] = [99, 0];
  ok(!mod.JOGO.motor.partidaValida(maoTorta), 'o validador aceitou uma carta fora do baralho');
}

// ─── o validador da VISTA QUE CHEGA PELO FIO — o irmão esquecido ─────────────
// A seção de cima conta que a casa exigia `linha` e `monte` de toda partida guardada, e que
// isso foi consertado. `vistaDoFio` (`150-rede.js`) é o IRMÃO daquele validador, no mesmo
// papel — conferir entrada de fora antes de os desenhistas a desreferenciarem — e ele ficou
// para trás exigindo `Array.isArray(v.linha)`, que é a linha da mesa do DOMINÓ.
//
// O efeito não é cosmético. No convidado, `if (m.t === 'vista' && vistaDoFio(m.v))` é a
// ÚNICA porta por onde a vista entra: recusada, o `esconderTelas()` não roda e ele fica
// preso no saguão PARA SEMPRE, sem uma palavra. É o defeito que este projeto mais odeia, e
// a ironia é que `vistaDoFio` nasceu justamente para impedir "o jogo preto sem uma palavra".
//
// É a pergunta que o CLAUDE.md manda fazer a cada guarda: QUEM É O IRMÃO DESTA LINHA, e ele
// tem a mesma guarda? Aqui a resposta era não, e o segundo jogo é quem cobrou.
//
// PELO JSON, e não pelo objeto vivo: é assim que a vista chega de verdade, e um campo que
// não sobrevive à serialização (`undefined`, um `Set`) apareceria aqui e em nenhum outro
// lugar desta suíte.
console.log('\na vista de truco atravessa o fio');
{
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();

  const doFio = c => JSON.parse(JSON.stringify(mod.JOGO.motor.visao(mod.P, c)));

  ok(mod.vistaDoFio(doFio(1)), 'a casa recusou uma vista de truco boa — o convidado fica preso no saguão');
  ok(mod.vistaDoFio(doFio(0)), 'a casa recusou a vista da cadeira 0');

  // AS OUTRAS FASES TÊM CAMPOS DIFERENTES, e é onde um validador estrito demais volta a
  // calar a mesa — só que agora por dentro do próprio conserto. A mão de 11 e o fim de mão
  // são as duas que mudam a forma da vista.
  mod.P.fase = 'onze'; mod.P.decideOnze = 0;
  ok(mod.vistaDoFio(doFio(1)), 'a casa recusou a vista da mão de 11');
  mod.P.fase = 'fim'; mod.P.resultado = { tipo: 'pontos', time: 0, pontos: 1 };
  ok(mod.vistaDoFio(doFio(1)), 'a casa recusou a vista de fim de partida');

  // E a guarda tem de continuar GUARDANDO: ela existe porque uma vista sem `cadeiras` mata a
  // tela no primeiro `sincronizar`. Afrouxá-la até aceitar qualquer coisa troca um defeito
  // por outro, e este par é o que impede o conserto de virar a remoção da guarda.
  //
  // ESTAS DEZ NASCEM VERDES POR TRIVIALIDADE, e está dito de propósito: hoje a casa recusa
  // TODA vista de truco, então recusar uma torta não prova nada. Elas só passam a medir
  // alguma coisa depois do conserto — e quem as prova é a MUTAÇÃO, não esta rodada.
  mod.P.fase = 'mao';
  for (const campo of ['cadeiras', 'placar', 'acoes', 'mao', 'naMao']) {
    const torto = doFio(1);
    delete torto[campo];
    ok(!mod.vistaDoFio(torto), `a casa aceitou uma vista de truco sem ${campo}`);
  }
  ok(!mod.vistaDoFio(null), 'a casa aceitou uma vista nula');
  ok(!mod.vistaDoFio({}), 'a casa aceitou um objeto vazio como vista');
  const foraDaFaixa = doFio(1); foraDaFaixa.vez = 9;
  ok(!mod.vistaDoFio(foraDaFaixa), 'a casa aceitou uma vez fora da faixa de cadeiras');
}

// ─── a dica, e o silêncio que não pode existir ───────────────────────────────
console.log('\na dica e o porquê da recusa');
{
  mod.comecarLocal();
  mod.P.vez = 0;
  mod.publicar();
  const d = mod.dicaDoTrucoParaACasa(mod.vistaAtual);
  ok(!!d && !!d.texto && !!d.aviso, 'a dica do truco não devolveu o que dizer');
  ok(!!d && typeof d.mostrar === 'function', 'a dica não devolveu o gesto — ela tem de levantar a carta');
  if (d && d.mostrar) d.mostrar();
  ok(mod.temPreviaDoTruco(), 'a dica não levantou carta nenhuma');
  mod.cancelarEscolhaNoTruco();

  // O SILÊNCIO É O DEFEITO, NÃO A RECUSA: cada estado em que a carta não vai tem uma frase
  // própria, e a genérica só vale onde não há nada melhor a dizer.
  const vPedido = Object.assign({}, mod.vistaAtual, { pedido: { de: 1, time: 1, valor: 3 } });
  ok(/aposta/i.test(mod.porQueNaoDaNoTruco(vPedido)),
    'com aposta na mesa o jogo não explica por que a carta não vai');
  const vOnze = Object.assign({}, mod.vistaAtual, { pedido: null, fase: 'onze' });
  ok(/11/.test(mod.porQueNaoDaNoTruco(vOnze)), 'na mão de 11 o jogo não explica o que falta');
  ok(mod.porQueNaoDaNoTruco(null).length > 0, 'sem vista, a recusa fica muda');
}

// ─── FILA 12 ────────────────────────────────────────────────────────────────
console.log('\no nome no fim de mão sai escapado UMA vez');
{
  // C1 · `nomeDoTime` devolve HTML já escapado, e este encaixe o passava por `escapar()` de
  // novo: um jogador `Zé & Cia` virava `Zé &amp;amp; Cia` na tela. O irmão em dominó sempre
  // interpolou sem reescapar — era esta metade que estava fora.
  //
  // As entidades estão escritas À MÃO de propósito. Comparar com uma segunda chamada de
  // `escapar` seria comparar a função com ela mesma e ficaria verde com o defeito de pé.
  const vista = {
    duplas: false, cadeira: 0, vez: 0, fase: 'fimDeMao',
    cadeiras: [{ nome: 'Zé & Cia', tipo: 'voce' }, { nome: 'Bot', tipo: 'bot' }],
    resultado: { motivo: 'vazas', time: 0, pontos: 3, vazas: [0, 0], vira: [0, 1] },
  };
  const f = mod.fimDeMaoDoTruco(vista);
  ok(f.detalhe.includes('Zé &amp; Cia'),
    `o nome no detalhe saiu ${JSON.stringify(String(f.detalhe).slice(0, 60))} — devia levar UM escape`);
  ok(!f.detalhe.includes('&amp;amp;'),
    'o detalhe do fim de mão escapou o nome DUAS vezes — o jogador vê a entidade crua');
  // Guarda de montagem: sem ela, um `detalhe` vazio passaria na negativa acima de graça.
  ok(f.detalhe.length > 0 && /vaza/.test(f.detalhe),
    'montagem: o detalhe não trouxe as vazas, e as duas asserções acima não mediriam nada');
  console.log('  Zé & Cia aparece como Zé & Cia, e não como Zé &amp; Cia');
}

console.log('\no CONTEÚDO da vista de truco, e não só o continente');
{
  // O IRMÃO da cena do dominó (test-jogo). `vistaDoTrucoValida` cobrava
  // `Array.isArray(v.mesa) && Array.isArray(v.vazas)` e deixava o conteúdo livre — três
  // vistas passavam e matavam a tela em TRÊS superfícies (a mesa 3D, a dica e o HUD).
  //
  // O comentário daquele encaixe dizia que a mesa "já é defensiva em todo ponto de leitura".
  // Ela é, contra o campo AUSENTE: `vista.vazas || []`. Contra `'xx'` o `||` entrega a
  // string para o `.map`. **A razão estava escrita e mesmo assim errada** — foi preciso
  // medir para ver a diferença entre ausente e presente-com-outro-tipo.
  mod.abrirJogo('truco');
  mod.MESA.n = 2;
  mod.MESA.cadeiras[0].tipo = 'voce'; mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();
  mod.publicar();
  const boa = JSON.parse(JSON.stringify(mod.vistaAtual));
  ok(mod.vistaDoFio(boa), 'montagem: a vista boa de truco já não passa — o resto não mediria nada');

  for (const [rot, f] of [
    ['vaza nula',        v => { v.vazas = [null]; }],
    ['vaza número',      v => { v.vazas = [7]; }],
    ['jogadas em texto', v => { v.vazas = [{ jogadas: 'xx', time: 0 }]; }],
    ['carta na mesa nula', v => { v.mesa = [null]; }],
  ]) {
    const v = JSON.parse(JSON.stringify(boa)); f(v);
    ok(!mod.vistaDoFio(v), `uma vista de truco com ${rot} passou — e ela mata a mesa, a dica e o hud`);
  }
  // E A FROUXIDÃO DELIBERADA CONTINUA: a mão de 11 não tem vira nem manilha, e `mesa` e
  // `vazas` chegam VAZIOS. Cobrar o elemento não pode ter fechado essa porta — `[].every`
  // é `true`, e esta asserção é o que prova que continua sendo.
  const onze = JSON.parse(JSON.stringify(boa));
  onze.mesa = []; onze.vazas = []; delete onze.vira; delete onze.manilha;
  ok(mod.vistaDoFio(onze), 'a vista da mão de 11 foi recusada — o rigor novo fechou a porta que a v4.7 abriu');
  console.log('  vaza torta não chega à mesa, e a mão de 11 continua passando');
}

console.log('\no gesto que o sistema interrompe');
{
  // C5 · O `pointerup` é PROMETIDO e não garantido (item 6 da Fila 5): troca de aplicativo e
  // gaveta de notificação não o mandam. O dominó trata isso desde a v1.6.0 com
  // `visibilitychange`/`blur`; o truco nasceu sem, e a carta ficava erguida.
  //
  // Mede-se pelo `apontada` da PONTE, que é o mesmo campo que o realce consome — e não pela
  // existência do ouvinte, que provaria só que alguém chamou `addEventListener`.
  mod.abrirJogo('truco');
  mod.MESA.n = 2;
  mod.MESA.cadeiras[0].tipo = 'voce'; mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();
  frames(3);

  // MEDE-SE O PONTEIRO, E NÃO O `apontada`. Duas descobertas obrigaram a isso, e as duas
  // ficam escritas porque a próxima pessoa tentaria os mesmos dois caminhos:
  //
  // 1. PELO TECLADO NÃO SERVE. Com o cursor de teclado ativo, `atualizarPonteiroDoTruco`
  //    repõe o realce a cada quadro — e isso está CERTO: quem joga de teclado não perde o
  //    cursor por trocar de aplicativo. O que o sistema interrompe é o GESTO do dedo.
  // 2. PELO DEDO NÃO DÁ EM NODE. O raycast não acha nada no harness — conferido projetando
  //    a carta para NDC (valores dentro do quadro) e disparando `pointermove`: `apontada`
  //    fica `null`. **Vale igual para o DOMINÓ**, logo é o dublê e não o jogo. Está anotado
  //    como lacuna do harness na Fila 12; consertá-lo é trabalho de outra onda.
  //
  // O que sobra é o outro efeito de `largarMiraDoTruco`: ele joga a mira para fora do
  // quadro (9, 9). Isso prova o que esta cena existe para provar — que o ouvinte está
  // REGISTRADO e chama quem devia —, sem depender do raycast.
  mod.ponteiroDoTruco.set(0, 0);
  ok(mod.ponteiroDoTruco.x === 0, 'montagem: não consegui pôr a mira dentro do quadro');

  document.hidden = true;
  fire('visibilitychange', {});
  document.hidden = false;
  ok(mod.ponteiroDoTruco.x === 9 && mod.ponteiroDoTruco.y === 9,
    `o truco voltou de outro aplicativo com a mira ainda na tela (${mod.ponteiroDoTruco.x}, ` +
    `${mod.ponteiroDoTruco.y}) — falta o irmão do desistirDoGesto, e a carta fica ERGUIDA`);

  // E o `blur`, que é a outra porta: aba perdendo o foco sem ficar escondida.
  mod.ponteiroDoTruco.set(0, 0);
  fire('blur', {});
  ok(mod.ponteiroDoTruco.x === 9, 'o blur não solta a mira do truco');

  // O CONTROLE: com o dominó na mesa, o ouvinte do truco não pode agir. Sem esta asserção,
  // um handler sem `estaNaMesa` passaria nas duas de cima — e ouvinte de jogo agindo fora da
  // sua mesa é o defeito que a v4.5 pagou com o toque na carta sendo comido pelo dominó.
  mod.abrirJogo('domino');
  mod.ponteiroDoTruco.set(0, 0);
  fire('blur', {});
  ok(mod.ponteiroDoTruco.x === 0,
    'o ouvinte do truco mexeu na mira com o DOMINÓ na mesa — falta a guarda estaNaMesa');
  mod.abrirJogo('truco');
  console.log('  sair para outro aplicativo solta a mira, como no dominó — e só com o truco na mesa');
}

console.log(`\n${falhas ? falhas + ' falha(s)' : 'tudo certo'} — ${n} asserções`);
process.exit(falhas ? 1 : 0);
