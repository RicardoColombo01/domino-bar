// O serpenteio do tabuleiro. Como toda peça na mesa cai em ângulo múltiplo de 90°,
// cada uma é um retângulo alinhado aos eixos — e aí "as peças não se sobrepõem" e
// "cada peça encosta na seguinte" viram comparação de retângulos, não olhômetro.
import path from 'path';
import { installStubs, seedRandom, buildModule } from './harness.mjs';

installStubs();
// Arquivo montado próprio: cada teste exporta nomes diferentes e eles rodam em sequência.
const mod = await import(buildModule([
  'layoutDaMesa', 'escalaDoTabuleiro', 'novaPartida', 'novaMao', 'jogar', 'comprar',
  'passar', 'jogadaDoBot', 'carroca', 'PECA_C', 'PECA_L',
  'larguraUtilDoTabuleiro', 'caixaDoMonte', 'anguloDaCadeira', 'TABULEIRO_Z', 'FOLGA_VIZINHO',
], undefined, path.join(import.meta.dirname, '.gerado', 'built-mesa.mjs')));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };
const EPS = 1e-6;

const cruzam = (a, b, folga) =>
  Math.abs(a.x - b.x) < (a.l + b.l) / 2 - folga &&
  Math.abs(a.z - b.z) < (a.a + b.a) / 2 - folga;

console.log('\ncasos simples');
{
  const vazio = mod.layoutDaMesa([], 0);
  ok(vazio.postas.length === 0, 'linha vazia não gera peça posta');

  const uma = mod.layoutDaMesa([[6, 6]], 0);
  ok(uma.postas[0].x === 0 && uma.postas[0].z === 0, 'a peça de abertura fica no centro');
  ok(Math.abs(uma.postas[0].l - mod.PECA_L) < EPS, 'carroça de abertura entra atravessada');

  // Jogar pela esquerda empurra a âncora: ela tem de continuar no centro.
  const l = [[1, 2], [2, 3], [3, 4]];
  ok(mod.layoutDaMesa(l, 2).postas[2].x === 0, 'âncora no fim da fila continua no centro');
  ok(mod.layoutDaMesa(l, 0).postas[0].x === 0, 'âncora no começo da fila continua no centro');
}

console.log('\ntabuleiros de partidas de verdade');
{
  const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'b' + i, tipo: 'bot', nivel: 'normal' }));
  let tabuleiros = 0, maiorLinha = 0, menorEscala = 1, comDobra = 0;

  seedRandom(1234);
  for (let partida = 0; partida < 300; partida++) {
    const P = mod.novaPartida(cadeiras(2 + (partida % 3)), { alvo: 6 });
    for (let passo = 0; P.fase !== 'fim' && passo < 4000; passo++) {
      if (P.fase === 'fimDeMao') { mod.novaMao(P); continue; }

      const { postas, caixa } = mod.layoutDaMesa(P.linha, P.iAncora);
      tabuleiros++;
      maiorLinha = Math.max(maiorLinha, P.linha.length);
      menorEscala = Math.min(menorEscala, mod.escalaDoTabuleiro(caixa));

      if (postas.length) {
        ok(Math.abs(postas[P.iAncora].x) < EPS && Math.abs(postas[P.iAncora].z) < EPS,
          'a peça de abertura saiu do centro da mesa');
        if (postas.some(p => Math.abs(p.z) > EPS)) comDobra++;
      }

      // 1. Nenhum par de peças ocupa o mesmo espaço.
      for (let i = 0; i < postas.length; i++)
        for (let j = i + 1; j < postas.length; j++)
          if (cruzam(postas[i], postas[j], EPS)) {
            ok(false, `peças ${i} e ${j} sobrepostas (linha de ${postas.length})`);
            i = j = postas.length;                       // um relatório por tabuleiro basta
          }

      // 2. Cada peça encosta na seguinte — a fila não pode ter buraco.
      for (let i = 0; i + 1 < postas.length; i++) {
        const a = postas[i], b = postas[i + 1];
        if (!cruzam({ x: a.x, z: a.z, l: a.l + 2 * EPS, a: a.a + 2 * EPS }, b, 0)) {
          ok(false, `peças ${i} e ${i + 1} não se tocam (linha de ${postas.length})`);
          break;
        }
      }

      const vez = P.vez;
      const j = mod.jogadaDoBot(P, vez);
      if (j.acao === 'jogar') mod.jogar(P, vez, j.peca, j.ponta);
      else if (j.acao === 'comprar') mod.comprar(P, vez);
      else mod.passar(P, vez);
    }
  }
  console.log(`  ${tabuleiros} tabuleiros · maior linha ${maiorLinha} · ${comDobra} com dobra · menor escala ${menorEscala.toFixed(2)}`);
  ok(comDobra > 0, 'nenhum tabuleiro chegou a dobrar — a borda nunca foi testada');
  ok(menorEscala > 0.3, `escala ficou em ${menorEscala.toFixed(2)}: as peças ficariam ilegíveis`);
  ok(maiorLinha >= 20, 'nenhuma linha longa apareceu para testar o serpenteio');
}

// ─── o corredor entre os adversários ─────────────────────────────────────────
// A guarda RÁPIDA do defeito da linha atravessando a mão do vizinho. A profunda é a
// asserção 3D contra 3D do test-telas, que abre o Chrome em seis telas e leva minutos;
// esta roda em milissegundos, dentro do `npm test`, e é a que alguém realmente roda a cada
// salvamento. Mesma divisão por custo que o fechamento forçado já usa.
//
// Os números de tela entram como DADO, não como medida: a função é pura, e quem mede o
// Chrome é o test-telas. Estes são os de um retrato 390×844 com mesa de 4.
console.log('\no corredor entre os adversários');
{
  const APERTO = 0.55, RAIO = 4.88, TELA = 5.32;
  const montes = [1, 2, 3].map(i => {
    const a = mod.anguloDaCadeira(i, 0, 4);
    return mod.caixaDoMonte(a, Math.sin(a) * RAIO * APERTO, Math.cos(a) * RAIO, 4, 0.56);
  });
  const linha = Array.from({ length: 14 }, (_, i) => [i % 7, (i + 1) % 7]);
  const { caixa } = mod.layoutDaMesa(linha, 0);

  const util = mod.larguraUtilDoTabuleiro(caixa, TELA, montes);
  const meia = caixa.l * mod.escalaDoTabuleiro(caixa, util) / 2;
  const bordaDoVizinho = Math.min(...montes.filter(m => Math.abs(m.x) > 1e-6)
    .map(m => Math.abs(m.x) - m.l / 2));
  ok(meia <= bordaDoVizinho - mod.FOLGA_VIZINHO + EPS,
    `a linha vai a ${meia.toFixed(2)} e o monte do vizinho começa em ${bordaDoVizinho.toFixed(2)}`);

  // O adversário SENTADO LONGE da faixa da linha não pode apertar nada: sem esta, a conta
  // ficaria "o mais próximo em x manda", e numa mesa de 2 (o de frente, a 4.88 de
  // distância) o tabuleiro encolheria à toa.
  const soDeFrente = [mod.caixaDoMonte(Math.PI, 0, -RAIO, 14, 0.3)];
  ok(mod.larguraUtilDoTabuleiro(caixa, TELA, soDeFrente) === Math.min(4 * 2.1, TELA),
    'o adversário sentado longe da linha apertou o tabuleiro sem precisar');

  // E o caminho PURO não pode ter mudado: `escalaDoTabuleiro` continua com o mesmo
  // default, que é o que test-mesa.mjs usa nas 53 mil comparações lá em cima.
  ok(mod.escalaDoTabuleiro(caixa) === mod.escalaDoTabuleiro(caixa, 8.4),
    'o default de escalaDoTabuleiro mudou, e com ele todo o teste de sobreposição acima');
  console.log(`  linha até ${meia.toFixed(2)} · vizinho em ${bordaDoVizinho.toFixed(2)} · ` +
    `folga ${(bordaDoVizinho - meia).toFixed(2)} (mínimo ${mod.FOLGA_VIZINHO})`);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
