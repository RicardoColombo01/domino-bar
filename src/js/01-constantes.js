// Números fixos do dominó de bar: peças, medidas e pontuação.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)

const MAX_PINTAS = 6;            // dupla-seis → 28 peças
const NA_MAO = 7;                // quantas cada jogador recebe

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

const PONTOS = { simples: 1, carroca: 2, laelo: 3, cruzada: 4, tranca: 1 };
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
