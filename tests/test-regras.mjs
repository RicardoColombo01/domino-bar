// Motor de regras, sem gráfico nenhum: milhares de mãos bot×bot com semente fixa.
// Um erro de regra achado aqui custa segundos; achado depois do 3D, custa horas.
import { installStubs, seedRandom, buildModule } from './harness.mjs';

installStubs();
const mod = await import(buildModule([
  'baralhoCompleto', 'distribuir', 'embaralhar', 'quemAbre',
  'pontas', 'orientar', 'jogadasValidas', 'aplicar', 'tipoDaBatida',
  'novaPartida', 'novaMao', 'acoesDe', 'jogar', 'comprar', 'passar', 'visaoDe',
  'jogadaDoBot', 'timeDe', 'valor', 'carroca', 'chave', 'somaMao', 'mesmaPeca', 'PONTOS',
]));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };
const secao = t => console.log('\n' + t);

// ─── baralho ────────────────────────────────────────────────────────────────
secao('baralho');
{
  const b = mod.baralhoCompleto();
  ok(b.length === 28, `baralho tem ${b.length} peças, esperado 28`);
  ok(new Set(b.map(mod.chave)).size === 28, 'peça repetida no baralho');
  ok(b.filter(mod.carroca).length === 7, 'deveriam existir 7 carroças');
  ok(mod.somaMao(b) === 168, `soma de todas as peças = ${mod.somaMao(b)}, esperado 168`);

  seedRandom(7);
  for (const n of [2, 3, 4]) {
    const { maos, monte } = mod.distribuir(n);
    ok(maos.length === n && maos.every(m => m.length === 7), `distribuir(${n}) deu mão errada`);
    ok(monte.length === 28 - 7 * n, `distribuir(${n}) deixou monte de ${monte.length}`);
    const todas = maos.flat().concat(monte).map(mod.chave);
    ok(new Set(todas).size === 28, `distribuir(${n}) duplicou ou perdeu peça`);
  }
}

// ─── encaixe e orientação ───────────────────────────────────────────────────
secao('encaixe');
{
  ok(mod.pontas([]) === null, 'linha vazia não tem ponta');
  const l1 = mod.aplicar([], [6, 6], 'dir');
  ok(String(mod.pontas(l1)) === '6,6', 'linha com 6|6 deve ter pontas 6 e 6');

  const l2 = mod.aplicar(l1, [6, 3], 'dir');
  ok(String(l2[1]) === '6,3', 'peça na direita entra com o número que encosta primeiro');
  ok(String(mod.pontas(l2)) === '6,3', 'pontas viraram 6 e 3');

  const l3 = mod.aplicar(l2, [1, 6], 'esq');
  ok(String(l3[0]) === '1,6', 'peça na esquerda entra com o número que encosta por último');
  ok(String(mod.pontas(l3)) === '1,3', 'pontas viraram 1 e 3');

  for (let i = 0; i + 1 < l3.length; i++) ok(l3[i][1] === l3[i + 1][0], 'invariante da linha quebrou');

  ok(mod.orientar([2, 4], 'dir', 5) === null, '2|4 não encaixa numa ponta 5');
  ok(mod.jogadasValidas([[0, 0]], l3).length === 0, '0|0 não deveria ter jogada em pontas 1 e 3');
  ok(mod.jogadasValidas([[1, 3]], l3).length === 2, '1|3 serve nas duas pontas (lá-e-lô)');
}

// ─── os quatro tipos de batida ──────────────────────────────────────────────
secao('tipos de batida');
{
  const linha = [[2, 5], [5, 5], [5, 4]];                  // pontas 2 e 4
  ok(mod.tipoDaBatida([2, 6], linha) === 'simples', 'peça comum numa ponta só = simples');
  ok(mod.tipoDaBatida([2, 4], linha) === 'laelo', 'peça comum servindo nas duas = lá-e-lô');
  ok(mod.tipoDaBatida([2, 2], linha) === 'carroca', 'carroça numa ponta só = carroça');

  const iguais = [[3, 5], [5, 5], [5, 3]];                 // pontas 3 e 3
  ok(mod.tipoDaBatida([3, 3], iguais) === 'cruzada', 'carroça com as duas pontas iguais = cruzada');
  ok(mod.tipoDaBatida([3, 6], iguais) === 'laelo', 'peça comum com as duas pontas iguais = lá-e-lô');
}

// ─── partidas inteiras ──────────────────────────────────────────────────────
secao('partidas bot × bot');
{
  const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'bot' + i, tipo: 'bot', nivel: 'normal' }));
  const vistos = new Set();
  let maos = 0, batidas = 0, trancas = 0, compras = 0, maiorLinha = 0;

  seedRandom(20260727);
  for (let partida = 0; partida < 900; partida++) {
    const n = 2 + (partida % 3);
    const P = mod.novaPartida(cadeiras(n), { alvo: 6, compraVoluntaria: partida % 7 === 0 });

    for (let passo = 0; P.fase !== 'fim'; passo++) {
      if (passo > 4000) { ok(false, `partida ${partida} não terminou`); break; }

      if (P.fase === 'fimDeMao') {
        maos++;
        const r = P.resultado;
        if (r.motivo === 'batida') { batidas++; vistos.add(r.tipo); } else trancas++;
        ok(r.pontos === (r.time === null ? 0 : mod.PONTOS[r.tipo]), 'pontos não batem com o tipo de batida');
        // Toda mão acaba com alguém sem peça (batida) ou com todo mundo travado (tranca).
        if (r.motivo === 'batida') ok(P.maos[r.vencedor].length === 0, 'bateu mas sobrou peça na mão');
        mod.novaMao(P);
        continue;
      }

      // Conservação: 28 peças, sempre, em algum lugar.
      const total = P.maos.reduce((s, m) => s + m.length, 0) + P.monte.length + P.linha.length;
      ok(total === 28, `sumiram peças: ${total} em vez de 28`);
      maiorLinha = Math.max(maiorLinha, P.linha.length);

      const vez = P.vez;
      const antes = P.maos[vez].length;
      const j = mod.jogadaDoBot(P, vez);
      let r;
      if (j.acao === 'jogar') r = mod.jogar(P, vez, j.peca, j.ponta);
      else if (j.acao === 'comprar') { r = mod.comprar(P, vez); compras++; }
      else r = mod.passar(P, vez);
      ok(!r.erro, `bot fez jogada recusada (${j.acao}): ${r.erro}`);

      if (j.acao === 'comprar') ok(P.maos[vez].length === antes + 1 && P.vez === vez, 'comprar não devia passar a vez');

      // A visão do jogador nunca pode conter a mão de outro.
      if (passo === 0) {
        const v = mod.visaoDe(P, vez);
        ok(v.mao === P.maos[vez], 'visaoDe deveria entregar a própria mão');
        ok(!JSON.stringify(v).includes('"maos"'), 'visaoDe vazou o objeto de mãos');
      }
    }

    ok(P.placar.some(v => v >= 6), 'partida acabou sem ninguém chegar a 6');
    if (n === 4) ok(P.placar.length === 2, 'mesa de 4 deveria pontuar por dupla');
  }

  console.log(`  ${maos} mãos · ${batidas} batidas · ${trancas} trancas · ${compras} compras · maior linha ${maiorLinha}`);
  for (const t of ['simples', 'carroca', 'laelo', 'cruzada'])
    ok(vistos.has(t), `nunca aconteceu uma ${t} em 900 partidas — regra provavelmente inalcançável`);
  ok(trancas > 0, 'nenhum jogo trancou em 900 partidas');
  ok(compras > 0, 'ninguém comprou do monte em 900 partidas');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
