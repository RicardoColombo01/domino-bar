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

console.log(`\n${falhas ? falhas + ' falha(s)' : 'tudo certo'} — ${n} asserções`);
process.exit(falhas ? 1 : 0);
