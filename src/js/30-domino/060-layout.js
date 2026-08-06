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

// ─── quem mais está sentado à mesa ───────────────────────────────────────────
// `anguloDaCadeira` SAIU DAQUI e foi para `10-casa/010-constantes.js`. O comentário que
// ficava neste lugar dizia "mora aqui porque é trigonometria pura" — e trigonometria pura
// sobre CADEIRAS é da mesa, não do dominó. Quem senta à sua frente está à sua frente em
// qualquer jogo.
//
// Ninguém tinha tirado essa conclusão porque havia um jogo só. Quem tirou foi o
// `test-acoplamento`, no dia em que o layout do truco precisou dela: um jogo alcançando o
// nome do outro, reprovado com razão. O orçamento do tabuleiro, logo abaixo, continua
// chamando — só que agora um nome da casa.

// A caixa que o monte de um adversário ocupa no tampo. Ele nasce girado -a e as peças
// entram ATRAVESSADAS, então a fileira cresce pela LARGURA da peça e cada uma deita o
// COMPRIMENTO de lado a lado — é o contrário do que a intuição diz. Mesmo formato de
// `envolver()` ({x, z, l, a}), para comparar retângulo com retângulo.
function caixaDoMonte(a, x, z, quantas, espaco) {
  const aoLongo = (PECA_L + espaco * Math.max(0, quantas - 1)) / 2;
  const atravessado = PECA_C / 2;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { x, z, l: 2 * (c * aoLongo + s * atravessado), a: 2 * (s * aoLongo + c * atravessado) };
}

// Quanta LARGURA o tabuleiro pode ocupar. Três tetos, e o menor manda: a madeira da mesa,
// o que a TELA mostra, e o CORREDOR entre os montes dos adversários.
//
// O terceiro faltava, e é por isso que a linha atravessava a mão do vizinho: depois de
// MAX_DOBRAS o braço corre reto para sempre em z = 0, e os laterais de uma mesa de 4 estão
// sentados exatamente em z = 0, no mesmo y. Eram duas contas independentes — o orçamento
// do tabuleiro medido numa profundidade, o aperto dos assentos medido noutra — e nenhuma
// perguntava pela outra. Medido antes do conserto: folga de -0.42 em todo retrato, ou seja
// a linha entrando 45% para dentro do montinho do vizinho.
//
// Só estorva quem está NA FAIXA por onde a linha corre: o adversário de cima fica a 4.9 de
// distância e não tem por que apertar ninguém. A faixa sai da caixa já encolhida pelos dois
// primeiros tetos — um passo só, sem laço, e o erro é sempre para o lado seguro (faixa
// larga demais conta assentos demais e o orçamento sai menor, nunca maior).
//
// Continua PURA: recebe onde os assentos ficaram; quem mede a tela é 070-cena.js.
function larguraUtilDoTabuleiro(caixa, tela = Infinity, montes = [], folga = FOLGA_VIZINHO) {
  const semVizinhos = Math.min(ESPALHA_X * 2.1, tela);
  if (!caixa.l) return semVizinhos;
  const meiaFaixa = caixa.a * escalaDoTabuleiro(caixa, semVizinhos) / 2;
  let corredor = Infinity;
  for (const m of montes) {
    if (Math.abs(m.z - TABULEIRO_Z) - m.a / 2 > meiaFaixa) continue;    // sentado longe da linha
    corredor = Math.min(corredor, 2 * (Math.abs(m.x) - m.l / 2 - folga));
  }
  // Nunca abaixo de uma peça: um corredor impossível encolheria o tabuleiro até sumir, e
  // tabuleiro invisível é pior que tabuleiro encostado.
  return Math.max(PECA_C, Math.min(semVizinhos, corredor));
}
