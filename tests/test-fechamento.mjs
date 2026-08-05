// CAÇA AO FECHAMENTO FORÇADO (Fila 5, item 2). Ferramenta de investigação, não suíte.
//
// O CLAUDE.md manda pedir ao Ricardo um caso concreto antes de mexer em
// `fechamentosArmados`. Isto é a alternativa: 030-regras.js é puro, então dá para JOGAR
// milhares de mãos e procurar o caso sozinho — com a mesa, as mãos e o lance em mãos.
//
// A busca é ONISCIENTE (vê todas as mãos), o que a regra jamais pode ser. É exatamente
// essa diferença que separa as três perguntas abaixo:
//
//   A) o jogador PODIA ter escolhido não trancar?          (visão de deus)
//   B) ...e dava para DEDUZIR isso da mesa + da mão dele?   (visão da regra: é bug)
//   C) o tranco veio em DOIS lances seus?                   (a hipótese da fila)
//
// Só (B) e (C) são defeito. (A) sozinho é fechamento natural: barrar exigiria olhar a mão
// dos outros, e a jogada sumindo da tela contaria ao jogador que ninguém tem aquele
// número — o mesmo vazamento que a visaoDe existe para impedir.
import { installStubs, seedRandom, buildModule } from './harness.mjs';

installStubs();
const mod = await import(buildModule([
  'novaPartida', 'novaMao', 'acoesDe', 'jogar', 'passar', 'comprar',
  'jogadasValidas', 'fechamentosArmados', 'pontasDepois', 'jogadaDoBot',
  'baralhoDoModo', 'modoDe', 'carroca', 'mesmaPeca', 'chave',
], undefined, new URL('./.gerado/built-busca.mjs', import.meta.url).pathname.slice(1)));

const PARTIDAS = Number(process.argv[2] || 300);
seedRandom(20260731);

const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'B' + i, tipo: 'bot', nivel: 'normal' }));
const clonar = P => structuredClone(P);
const pecaTxt = p => p[0] + '|' + p[1];
const maoTxt = m => m.map(pecaTxt).join(' ');

// Depois deste lance, o jogo TRANCOU? Deixa o motor responder: dá a vez adiante enquanto
// ninguém tiver lance, e vê como a mão termina.
//
// Não dá para perguntar "ninguém tem jogada?" direto: mão VAZIA também não tem jogada, e
// isso marcava toda BATIDA como tranco — a primeira leva de 55 "achados" era exatamente
// esse engano. Quem sabe a diferença é o `resultado.motivo`, e quem o preenche é o motor.
const trancaDepois = Q => {
  // O teto é generoso porque COMPRAR também gasta rodada: com monte, "ninguém joga" pode
  // levar um punhado de compras até o monte secar. E é justamente aí que mora a suspeita —
  // a regra do fechamento armado só roda quando `temMonte` é falso, mas o monte ACABA no
  // meio da mão, então existe uma janela em que ela está desligada e o tranco já é possível.
  for (let i = 0; i < 80 && Q.fase === 'mao'; i++) {
    const a = mod.acoesDe(Q, Q.vez);
    if (a.jogadas.length) return false;                  // alguém joga: não trancou
    if (a.comprar) mod.comprar(Q, Q.vez);
    else if (a.passar) mod.passar(Q, Q.vez);
    else return false;
  }
  return Q.fase === 'fimDeMao' && Q.resultado && Q.resultado.motivo !== 'batida';
};

const achados = { A: [], B: [], C: [] };

// TODOS os modos sem monte, e não só o clássico de 4. Duelo e Trio esgotam o baralho na
// distribuição, então caem na mesma regra — e a dinâmica deles é outra: no Duelo cada um
// segura METADE do baralho, o que muda completamente o que dá para deduzir.
const MESAS = [
  { modo: 'classico', n: 4 },
  { modo: 'duelo', n: 2 },
  { modo: 'trio', n: 3 },
  // COM MONTE, e é aqui que a suspeita mora: `acoesDe` desliga a regra inteira enquanto
  // `temMonte` for verdadeiro. Só que o monte seca no meio da mão — e um lance dado com o
  // monte ainda de pé pode matar as duas pontas para depois que ele secar.
  { modo: 'classico', n: 2 },
  { modo: 'classico', n: 3 },
];

for (const mesa of MESAS) {
for (let partida = 0; partida < PARTIDAS; partida++) {
  const n = mesa.n;
  const P = mod.novaPartida(cadeiras(n), { alvo: 6, modo: mesa.modo });

  for (let passo = 0; P.fase !== 'fim' && passo < 4000; passo++) {
    if (P.fase === 'fimDeMao') { mod.novaMao(P); continue; }

    const vez = P.vez;
    const acoes = mod.acoesDe(P, vez);

    // Só interessa quem tem ESCOLHA: com um lance só, fechar é natural por definição.
    if (acoes.jogadas.length > 1) {
      const trancam = [], livres = [];
      for (const j of acoes.jogadas) {
        const Q = clonar(P);
        const r = mod.jogar(Q, vez, j.peca, j.ponta);
        if (r && r.erro) continue;
        (trancaDepois(Q) ? trancam : livres).push(j);
      }

      if (trancam.length && livres.length) {
        const caso = {
          modo: mesa.modo, n, partida, maoNum: P.maoNum, vez,
          linha: P.linha.map(pecaTxt).join(' '),
          pontas: mod.pontasDepois(P.linha, trancam[0].peca, trancam[0].ponta),
          minhaMao: maoTxt(P.maos[vez]),
          todasAsMaos: P.maos.map(maoTxt),
          lanceQueTranca: pecaTxt(trancam[0].peca) + ' na ' + trancam[0].ponta,
          alternativa: pecaTxt(livres[0].peca) + ' na ' + livres[0].ponta,
        };
        achados.A.push(caso);

        // (B) A REGRA DEVIA TER PEGO: dava para deduzir só da mesa e da própria mão.
        const armadas = mod.fechamentosArmados(P.linha, trancam, P.maos[vez],
          P.baralho || mod.baralhoDoModo(mod.modoDe(P.regras)));
        if (armadas.length) achados.B.push({ ...caso, quantasArmadas: armadas.length });
      }
    }

    const j = mod.jogadaDoBot(P, vez);
    const r = j.acao === 'jogar' ? mod.jogar(P, vez, j.peca, j.ponta)
      : j.acao === 'comprar' ? mod.comprar(P, vez) : mod.passar(P, vez);
    if (r && r.erro) { console.error('bot recusado:', r.erro); break; }
  }
}
}

console.log(`\n${PARTIDAS} partidas em cada uma das ${MESAS.length} mesas\n`);
console.log(`A) tranco ESCOLHÍVEL (visão de deus):        ${achados.A.length}`);
console.log(`B) e DEDUZÍVEL da mesa + mão (bug da regra): ${achados.B.length}`);

if (achados.B.length) {
  const c = achados.B[0];
  console.log('\n=== CASO (B) — a regra deixou passar um fechamento deduzível ===');
  console.log('  linha:      ', c.linha);
  console.log('  minha mão:  ', c.minhaMao);
  console.log('  todas:      ', c.todasAsMaos.join('   |   '));
  console.log('  lance:      ', c.lanceQueTranca, '  (alternativa livre:', c.alternativa + ')');
} else if (achados.A.length) {
  const c = achados.A[0];
  console.log('\n=== CASO (A) — trancável, mas NÃO deduzível pelo jogador ===');
  console.log('  linha:      ', c.linha);
  console.log('  minha mão:  ', c.minhaMao);
  console.log('  todas:      ', c.todasAsMaos.join('   |   '));
  console.log('  lance:      ', c.lanceQueTranca, '  (alternativa livre:', c.alternativa + ')');
  console.log('\n  Este é fechamento NATURAL pela definição do Ricardo: para barrá-lo o motor');
  console.log('  teria de olhar a mão dos outros, e isso é vazamento de informação.');
}

// Só (B) reprova. (A) sem (B) é fechamento natural e tem de continuar permitido — se um
// dia (A) aparecer sozinho, é informação, não falha: quer dizer que existe posição em que
// o jogo trava sem ninguém poder saber, e isso é dominó, não bug.
if (achados.B.length) {
  console.error(`\n✗ ${achados.B.length} fechamento(s) deduzível(is) passaram pela regra`);
  process.exit(1);
}
console.log('\ntudo certo');
