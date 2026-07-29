// As regras propriamente ditas. Tudo aqui é função pura sobre a linha da mesa:
// nenhum estado guardado, nenhum Three.js — é o que permite rodar mil partidas
// no terminal em segundos e achar erro de regra antes de existir um pixel.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// A LINHA É GUARDADA JÁ ORIENTADA da esquerda para a direita:
//
//     [[6,5],[5,3],[3,3],[3,0]]     →  linha[i][1] === linha[i+1][0], sempre.
//      └──┘ └──┘                       as pontas são só o primeiro e o último número
//
// Com essa invariante, "qual é a ponta?" é um índice e "jogar na esquerda" é um
// unshift. Sem ela, toda consulta de ponta viraria uma busca pela linha inteira.

function pontas(linha) {
  return linha.length ? [linha[0][0], linha[linha.length - 1][1]] : null;
}

// Vira a peça para encaixar naquela ponta, ou devolve null se ela não serve.
// Na ponta direita o número que encosta é o PRIMEIRO da peça; na esquerda, o último.
function orientar(peca, ponta, valorDaPonta) {
  const [a, b] = peca;
  if (ponta === 'dir') return a === valorDaPonta ? [a, b] : b === valorDaPonta ? [b, a] : null;
  return b === valorDaPonta ? [a, b] : a === valorDaPonta ? [b, a] : null;
}

function jogadasValidas(mao, linha) {
  if (!linha.length) return mao.map(peca => ({ peca, ponta: 'dir' }));
  const [e, d] = pontas(linha);
  const jogadas = [];
  for (const peca of mao) {
    if (orientar(peca, 'esq', e)) jogadas.push({ peca, ponta: 'esq' });
    if (orientar(peca, 'dir', d)) jogadas.push({ peca, ponta: 'dir' });
  }
  return jogadas;
}

function aplicar(linha, peca, ponta) {
  if (!linha.length) return [peca.slice()];
  const [e, d] = pontas(linha);
  const posta = orientar(peca, ponta, ponta === 'esq' ? e : d);
  if (!posta) throw new Error(`peça ${chave(peca)} não encaixa na ponta ${ponta}`);
  return ponta === 'esq' ? [posta, ...linha] : [...linha, posta];
}

// Como ficam as pontas SE eu jogar isto — sem montar a linha nova. Uma carroça deixa a
// ponta no mesmo número, e é essa propriedade que faz a regra do fechamento tratá-la à
// parte lá embaixo.
function pontasDepois(linha, peca, ponta) {
  if (!linha.length) return [peca[0], peca[1]];
  const [e, d] = pontas(linha);
  const posta = orientar(peca, ponta, ponta === 'esq' ? e : d);
  return ponta === 'esq' ? [posta[0], d] : [e, posta[1]];
}

// FECHAR O JOGO DE PROPÓSITO. O motor já impede passar quando se pode jogar, então a
// única tranca armável é escolher, entre as jogadas válidas, a que deixa as duas pontas
// em números que ninguém mais consegue casar — e ganhar 1 ponto na contagem sem ter
// batido. Estas são essas jogadas.
//
// A CONTA É FEITA SÓ COM O QUE O JOGADOR ENXERGA: a mesa e a própria mão. Isso não é
// preguiça, é o ponto. Se o motor olhasse a mão dos outros para decidir, apagar a peça
// na tela contaria a você que ninguém tem aquele número — e trocaríamos uma trapaça por
// outra. Aqui a regra só proíbe o que você já sabia de qualquer jeito.
//
// Carroça fica de fora por decisão da casa, e a decisão tem lastro: jogada numa ponta X
// ela deixa a ponta em X, então nunca TRANSFORMA uma ponta viva em morta. Quando ela
// fecha é por consumir o último X do jogo — consequência, não manobra.
//
// Quem chama decide o resto (é `acoesDe`, em 04-partida.js): a regra só vale sem monte,
// não vale na sua última peça (jogar a última é bater), e só barra se sobrar jogada que
// não seja também um fechamento — senão as duas se barrariam, você ficaria sem jogada, e
// o motor te mandaria passar: a tranca aconteceria igual, pela porta dos fundos.
function fechamentosArmados(linha, jogadas, mao, baralho) {
  const vistas = new Set(linha.map(chave));
  for (const p of mao) vistas.add(chave(p));            // a que vai ser jogada inclusive
  const morto = [];
  for (let n = 0; n <= MAX_PINTAS; n++) {
    morto[n] = !baralho.some(p => (p[0] === n || p[1] === n) && !vistas.has(chave(p)));
  }
  return jogadas.filter(j => {
    if (carroca(j.peca)) return false;
    const [e, d] = pontasDepois(linha, j.peca, j.ponta);
    return morto[e] && morto[d];
  });
}

// Que tipo de batida foi. Tem de ser consultado ANTES de jogar a última peça,
// porque o nome depende das pontas que ainda existiam na mesa:
//
//   serve nas duas pontas?   não          sim
//        peça comum      →  simples (1)   lá-e-lô (2)
//        carroça         →  carroça (2)   cruzada (4)
//
// Repare que uma carroça [x,x] só "serve nas duas" quando as DUAS pontas são x —
// que é exatamente o que a mesa chama de cruzada. A tabela cai sozinha.
function tipoDaBatida(peca, linha) {
  if (!linha.length) return 'simples';
  const [e, d] = pontas(linha);
  const nasDuas = (peca[0] === e || peca[1] === e) && (peca[0] === d || peca[1] === d);
  if (carroca(peca)) return nasDuas ? 'cruzada' : 'carroca';
  return nasDuas ? 'laelo' : 'simples';
}
