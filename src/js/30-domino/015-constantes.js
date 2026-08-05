// Números fixos do DOMINÓ: peças, modos, medidas de mesa e pontuação.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Estava tudo em `10-casa/010-constantes.js`, cuja primeira linha dizia, ela mesma,
// "Números fixos do dominó de bar" — regra de um jogo morando na pasta que promete não
// saber que jogo é. Enquanto for um jogo só isso não incomoda ninguém; com o truco ao
// lado, `PECA_C` e `MAX_PINTAS` no arquivo comum são convite a `CARTA_C` do lado deles.
//
// O NÚMERO 015 não é decorativo: `140-menu.js` roda `mesaLembrada()` no topo do módulo e
// valida o modo guardado contra `MODOS`, então esta tabela tem de estar declarada antes
// dele. Foi por não haver inteiro livre entre 01 e 14 que os arquivos passaram a ser
// numerados de dez em dez.

const MAX_PINTAS = 6;            // dupla-seis → 28 peças

// Os modos da casa. Um modo é só quantas peças cada um recebe, com quantas cadeiras
// isso fecha, e se alguma peça sai do baralho.
//
// Repare que Duelo e Trio ESGOTAM o baralho na distribuição (2×14 = 28, 3×9 = 27) —
// então caem sozinhos no caminho "sem monte, quem trava passa" que a mesa de 4 já
// usava, sem uma linha de regra nova. E o 27 do Trio não é coincidência: tirar a
// bucha de zero é justamente o que faz o baralho dividir exato entre três.
//
// `carrocasDemais` é a munição de maoRuim() (020-baralho.js): a partir de quantas
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
// o tabuleiro fechar sem sobra em 060-layout.js. Mexer num, mexer no outro.
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

// O tabuleiro é empurrado meio corpo para o fundo, para a mão caber embaixo dele. Era um
// literal 0.4 escrito em dois pontos de 090-tabuleiro.js, e virou constante porque quem
// confere sobreposição no tampo precisa saber onde a caixa do tabuleiro realmente está.
const TABULEIRO_Z = 0.4;

// O vão entre a ponta da linha e o monte do adversário. NÃO é folga de renderização: é o
// espaço que a mão de quem joga precisa para pegar a peça sem esbarrar na do vizinho.
const FOLGA_VIZINHO = 0.30;

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
