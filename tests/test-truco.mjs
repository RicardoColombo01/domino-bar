// AS REGRAS DO TRUCO, no terminal. `50-truco/510-regras.js` é puro (invariante 4), então
// cabe inteiro aqui — e é onde um erro de regra custa segundos em vez de horas.
//
// AS TABELAS SÃO ESCRITAS À MÃO, e não lidas do jogo. Ler `ORDEM_TRUCO` para conferir
// `ORDEM_TRUCO` aprovaria qualquer ordem. Aqui elas estão em NOME de carta ("3 de paus"), que
// é como um jogador falaria — se o teste e o código discordarem, quem estiver errado é
// visível a olho nu.
import { installStubs, seedRandom, buildModule } from './harness.mjs';

installStubs();
seedRandom(11);
const mod = await import(buildModule([
  'VALORES', 'NAIPES', 'baralho40', 'chaveCarta', 'nomeDaCarta',
  'ORDEM_TRUCO', 'manilhaDaVira', 'forcaDaCarta', 'compararCartas', 'postoDaCarta',
  'vencedorDaVaza', 'donoDaMao', 'VALORES_DA_APOSTA', 'proximaAposta', 'NOME_DA_APOSTA',
  'MODOS_TRUCO', 'MODO_PADRAO_TRUCO',
  'novaPartidaDoTruco', 'novaMaoDoTruco', 'acoesDoTruco', 'jogarCarta', 'visaoDoTruco',
  'trucar', 'aceitarTruco', 'correrDoTruco', 'decidirOnze', 'abandonarOTruco', 'timeNoTruco',
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
  ok(mod.cartaValida ? true : true, '');
  n--;                                     // a linha acima é só documentação; não conta
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
  const P = mod.novaPartidaDoTruco(mesa(4));
  const v = mod.visaoDoTruco(P, 0);
  ok(v.mao === P.maos[0], 'a visão não entregou a sua própria mão');
  // O INVARIANTE 3: a mão alheia NÃO trafega. Só a contagem — e a vira, que é pública por
  // definição do jogo.
  const meu = new Set(P.maos[0].map(mod.chaveCarta));
  const texto = JSON.stringify(Object.assign({}, v, { mao: [] }));
  let vazou = 0;
  for (let cad = 1; cad < 4; cad++) {
    for (const carta of P.maos[cad]) {
      if (meu.has(mod.chaveCarta(carta))) continue;
      // Procura o PAR, e não o texto solto: `[0,2]` também é um placar.
      if (texto.includes(JSON.stringify(carta))) vazou++;
    }
  }
  ok(vazou === 0, `${vazou} carta(s) da mão alheia apareceram na visão`);
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

console.log(`\n${falhas ? falhas + ' falha(s)' : 'tudo certo'} — ${n} asserções`);
process.exit(falhas ? 1 : 0);
