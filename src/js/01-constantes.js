// Números fixos do dominó de bar: peças, medidas e pontuação.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)

const MAX_PINTAS = 6;            // dupla-seis → 28 peças

// Os modos da casa. Um modo é só quantas peças cada um recebe, com quantas cadeiras
// isso fecha, e se alguma peça sai do baralho.
//
// Repare que Duelo e Trio ESGOTAM o baralho na distribuição (2×14 = 28, 3×9 = 27) —
// então caem sozinhos no caminho "sem monte, quem trava passa" que a mesa de 4 já
// usava, sem uma linha de regra nova. E o 27 do Trio não é coincidência: tirar a
// bucha de zero é justamente o que faz o baralho dividir exato entre três.
//
// `carrocasDemais` é a munição de maoRuim() (02-baralho.js): a partir de quantas
// carroças a mesa embaralha de novo.
const MODOS = {
  classico: { rotulo: 'Clássico', nota: '7 peças',  pecasPorMao: 7,  cadeiras: [2, 3, 4], semZeroZero: false, carrocasDemais: 5 },
  duelo:    { rotulo: 'Duelo',    nota: '14, 1v1',  pecasPorMao: 14, cadeiras: [2],       semZeroZero: false, carrocasDemais: 7 },
  trio:     { rotulo: 'Trio',     nota: '9, sem 0|0', pecasPorMao: 9, cadeiras: [3],      semZeroZero: true,  carrocasDemais: 5 },
};
const MODO_PADRAO = 'classico';

// Trava do laço de re-embaralho. Um critério exigente demais em maoRuim() faria a
// distribuição rodar para sempre; aqui ela desiste e entrega a última mão.
const MAX_EMBARALHOS = 100;

// Medidas da peça em unidades de mundo. O comprimento é EXATAMENTE o dobro da
// largura — é isso que faz uma carroça atravessada ocupar meia peça no braço e
// o tabuleiro fechar sem sobra em 06-layout.js. Mexer num, mexer no outro.
const PECA_C = 1.0;
const PECA_L = 0.5;
const PECA_E = 0.18;

// A MALHA é desenhada um tico menor que o espaço que a peça ocupa. Encostadas exatamente
// uma na outra, marfim contra marfim, oito peças na mesa lêem como uma tábua só — a folga
// abre uma linha de sombra entre elas e a fileira volta a ser contável de relance.
// O layout continua avançando o tamanho cheio: isto aqui é casca, não geometria de jogo.
const FOLGA_C = 0.965;
const FOLGA_L = 0.93;

// Até onde o tabuleiro pode se espalhar antes de dobrar (meia-largura, em unidades).
const ESPALHA_X = 4.0;
const ESPALHA_Z = 2.2;

// Regra da casa: bater nas duas pontas com peça comum vale o mesmo que bater de
// carroça. Só a cruzada — carroça servindo nas duas — paga mais.
const PONTOS = { simples: 1, carroca: 2, laelo: 2, cruzada: 4, tranca: 1 };
const ALVO_PADRAO = 6;

const NOME_BATIDA = {
  simples: 'batida simples',
  carroca: 'batida de carroça',
  laelo: 'batida de lá-e-lô',
  cruzada: 'batida cruzada',
  tranca: 'jogo trancado',
};

const CORES = {
  feltro: 0x1e5f3d,
  madeira: 0x53331d,
  marfim: 0xf4ecd9,
  pinta: 0x191512,
  luz: 0xffd7a0,
  parede: 0x241a16,
};
