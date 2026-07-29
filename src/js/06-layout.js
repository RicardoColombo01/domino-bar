// Onde cada peça fica na mesa. Puro cálculo — nada de Three.js aqui, o que deixa
// o serpenteio testável no terminal.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// A linha do motor é uma fila reta; a mesa não é. Dois BRAÇOS crescem a partir da
// peça de abertura, cada um com o próprio cursor e a própria direção:
//
//        ┌──────────────────────┐        peça comum avança o comprimento inteiro
//        │   ╔═╗                │        carroça entra ATRAVESSADA e avança só
//        └───╫─╫────┬───────────┘        a largura — como na mesa de verdade
//     ◄──────╨─╨────┘  ▲
//     braço esquerdo    braço direito, dobrando ao chegar na borda
//
// Duas dobras por braço e depois segue reto: mais que isso e o jogo se enrola em
// cima de si mesmo. Quando estoura, quem resolve é a escala do grupo inteiro.

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // +x, +z, -x, -z
const MAX_DOBRAS = 2;

const avanco = p => (carroca(p) ? PECA_L : PECA_C);   // quanto a peça ocupa NO SENTIDO do braço
const travessa = p => (carroca(p) ? PECA_C : PECA_L); // ... e de lado a lado
const foraDaMesa = (x, z) => Math.abs(x) > ESPALHA_X || Math.abs(z) > ESPALHA_Z;

// linha: a fila orientada do motor · iAncora: onde está, nela, a peça de abertura
// (ela muda de índice toda vez que alguém joga na esquerda).
function layoutDaMesa(linha, iAncora) {
  const postas = new Array(linha.length);
  const nada = { x: 0, z: 0 };
  if (!linha.length) return { postas, caixa: { x: 0, z: 0, l: 0, a: 0 }, alvos: { esq: nada, dir: nada } };

  const ancora = Math.min(Math.max(iAncora | 0, 0), linha.length - 1);
  const meio = avanco(linha[ancora]) / 2;
  postas[ancora] = posta(linha[ancora], 0, 0, carroca(linha[ancora]) ? Math.PI / 2 : 0);

  // sentido: +1 anda para a frente na fila, -1 para trás. sinal: para que lado aponta
  // o "a→b" da peça — no braço esquerdo a fila corre ao contrário do avanço.
  const braco = (de, ate, sentido, dir0, sinal) => {
    let x = sentido > 0 ? meio : -meio, z = 0, dir = dir0, dobras = 0;
    let anterior = linha[ancora];
    for (let i = de; sentido > 0 ? i <= ate : i >= ate; i += sentido) {
      const peca = linha[i];
      const comp = avanco(peca);
      let d = DIRS[dir];
      if (dobras < MAX_DOBRAS && foraDaMesa(x + d[0] * comp, z + d[1] * comp)) {
        const velho = d;
        dir = (dir + 1) % 4;
        dobras++;
        d = DIRS[dir];
        // A QUINA. Sem este desvio as duas peças disputariam o mesmo quadradinho do
        // canto: a de trás ainda ocupa meia travessa para os lados, e a nova nasceria
        // dentro dela. Sai da faixa da anterior (avança) e encosta nela de lado (recua).
        x += d[0] * travessa(anterior) / 2 - velho[0] * travessa(peca) / 2;
        z += d[1] * travessa(anterior) / 2 - velho[1] * travessa(peca) / 2;
      }
      const gx = d[0] * sinal, gz = d[1] * sinal;
      postas[i] = posta(peca, x + d[0] * comp / 2, z + d[1] * comp / 2,
        Math.atan2(-gz, gx) + (carroca(peca) ? Math.PI / 2 : 0));
      x += d[0] * comp;
      z += d[1] * comp;
      anterior = peca;
    }
    // Onde o braço parou é exatamente onde a próxima peça encosta — é isso que vira
    // o marcador de "encaixa aqui" na tela quando a peça serve nas duas pontas.
    return { x, z };
  };

  const alvoDir = braco(ancora + 1, linha.length - 1, +1, 0, +1);
  const alvoEsq = braco(ancora - 1, 0, -1, 2, -1);

  return { postas, caixa: envolver(postas), alvos: { esq: alvoEsq, dir: alvoDir } };
}

// Rotação múltipla de 90° ⇒ toda peça na mesa é um retângulo alinhado aos eixos.
// Guardar l/a aqui deixa a caixa do tabuleiro exata e dá um teste de sobreposição
// que é só comparar retângulos.
function posta(peca, x, z, rotY) {
  const deitadaEmX = Math.abs(Math.cos(rotY)) > 0.5;
  return {
    peca, x, z, rotY,
    l: deitadaEmX ? PECA_C : PECA_L,
    a: deitadaEmX ? PECA_L : PECA_C,
  };
}

function envolver(postas) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of postas) {
    if (!p) continue;
    x0 = Math.min(x0, p.x - p.l / 2); x1 = Math.max(x1, p.x + p.l / 2);
    z0 = Math.min(z0, p.z - p.a / 2); z1 = Math.max(z1, p.z + p.a / 2);
  }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, l: x1 - x0, a: z1 - z0 };
}

// O tabuleiro cresce; a mesa não. Em vez de limitar o jogo, encolhe o grupo inteiro
// até caber — duas linhas que resolvem todos os casos extremos de uma vez.
// `larguraUtil` entra como parâmetro com o valor de sempre por default: quem chama de
// dentro do jogo passa a largura que a TELA mostra (num celular em pé o tabuleiro cabia
// na mesa e não cabia no quadro), e os testes de layout continuam chamando com um
// argumento só, medindo a mesa e não a tela. A função continua pura.
function escalaDoTabuleiro(caixa, larguraUtil = ESPALHA_X * 2.1) {
  if (!caixa.l) return 1;
  return Math.min(1, larguraUtil / caixa.l, (ESPALHA_Z * 2.4) / caixa.a);
}
