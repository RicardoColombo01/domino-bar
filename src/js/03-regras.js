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
// E fechar é NINGUÉM conseguir jogar, você inclusive: se você ainda responde às pontas
// que deixou, os outros passam, a vez volta e você joga de novo. Isso é jogar sozinho —
// jogo bom, não manobra —, e não pode ser barrado.
//
// Quem chama decide o resto (é `acoesDe`, em 04-partida.js): a regra não vale na sua
// última peça (jogar a última é bater), e só barra se sobrar jogada que não seja também
// um fechamento — senão as duas se barrariam, você ficaria sem jogada, e o motor te
// mandaria passar: a tranca aconteceria igual, pela porta dos fundos.
//
// E ela vale COM MONTE TAMBÉM, desde o item 2 da Fila 5. Antes `acoesDe` a desligava
// enquanto houvesse monte, por "com monte ninguém trava, compra" — mas o `morto` daqui
// de baixo já é uma pergunta mais forte que essa: ele só dá o número por morto quando
// toda peça dele está na mesa ou na sua mão, e portanto NÃO está no monte. Ponta morta
// com monte de pé é ponta que o monte não resolve. A guarda antiga não protegia nada e
// abria uma janela: bastava dar o lance antes de o monte secar.
function fechamentosArmados(linha, jogadas, mao, baralho) {
  // CHAVE CANÔNICA, e é o detalhe que fazia a regra quase não existir: `chave` é
  // sensível à ordem (p[0]|p[1]) e a linha guarda as peças JÁ ORIENTADAS — uma 2|5
  // deitada como [5,2] virava '5|2', o baralho tem '2|5', e a peça que estava na mesa
  // contava como ainda solta no jogo. Quase 40% das peças de uma fileira ficam
  // invertidas, e a regra errava sempre para menos.
  //
  // Só aqui dentro: `chave` continua sensível à orientação de propósito, porque em
  // 09-tabuleiro.js e 10-mao.js ela é o identificador do objeto 3D.
  const kc = p => Math.min(p[0], p[1]) + '|' + Math.max(p[0], p[1]);

  const vistas = new Set(linha.map(kc));
  for (const p of mao) vistas.add(kc(p));               // a que vai ser jogada inclusive
  const morto = [];
  for (let n = 0; n <= MAX_PINTAS; n++) {
    morto[n] = !baralho.some(p => (p[0] === n || p[1] === n) && !vistas.has(kc(p)));
  }
  return jogadas.filter(j => {
    if (carroca(j.peca)) return false;
    const [e, d] = pontasDepois(linha, j.peca, j.ponta);
    if (!morto[e] || !morto[d]) return false;
    // ...e você também não pode ter resposta: com resposta na mão, o jogo não trava.
    const resto = mao.filter(p => !mesmaPeca(p, j.peca));
    return !resto.some(p => p[0] === e || p[1] === e || p[0] === d || p[1] === d);
  });
}

// Que tipo de batida foi. Tem de ser consultado ANTES de jogar a última peça,
// porque o nome depende das pontas que ainda existiam na mesa:
//
//                        pontas 6 e 1        pontas 6 e 6
//        peça comum  →   6|1 é lá-e-lô (2)   6|1 é simples (1)
//        carroça     →   6|6 é carroça (2)   6|6 é cruzada  (4)
//
// A coluna da direita é a regra da casa, e ela NÃO é simétrica — por isso os dois
// ramos abaixo fazem perguntas diferentes em vez de dividirem uma só:
//
//   Lá-e-lô é bater podendo ter entrado dos DOIS LADOS, e duas pontas no mesmo número
//   não são dois lados. Com 6 e 6, a 6|1 encosta num 6 só; o outro continua vivo, e a
//   batida é simples. Daí o `e !== d`.
//
//   A cruzada é o oposto: ela EXIGE as pontas iguais, porque é a carroça daquele
//   número casando com as duas. Um `e !== d` compartilhado a mataria junto.
//
// (Escrever isso como um `nasDuas` único foi o defeito que viveu até a v1.5.0: com as
// pontas em 3 e a peça 3|1, os dois lados do `&&` davam verdadeiro PELO MESMO 3. Errava
// de graça quase sempre, porque lá-e-lô e carroça valem 2 os dois — só aparecia no
// placar quando a batida devia ser simples.)
function tipoDaBatida(peca, linha) {
  if (!linha.length) return 'simples';
  const [e, d] = pontas(linha);
  const serve = n => peca[0] === n || peca[1] === n;
  if (carroca(peca)) return serve(e) && serve(d) ? 'cruzada' : 'carroca';
  return e !== d && serve(e) && serve(d) ? 'laelo' : 'simples';
}
