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

// Que tipo de batida foi. Tem de ser consultado ANTES de jogar a última peça,
// porque o nome depende das pontas que ainda existiam na mesa:
//
//   serve nas duas pontas?   não          sim
//        peça comum      →  simples (1)   lá-e-lô (3)
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
