// O baralho: as peças, o embaralho e quem abre a mão. Quantas peças e quantas na mão
// depende do modo da mesa (MODOS, em 01-constantes.js).
// (parte de src/js — mesmo escopo, concatenado por build.mjs)

const chave = p => p[0] + '|' + p[1];
const valor = p => p[0] + p[1];
const carroca = p => p[0] === p[1];
const somaMao = mao => mao.reduce((s, p) => s + valor(p), 0);
const mesmaPeca = (a, b) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

function baralhoCompleto() {
  const pecas = [];
  for (let a = 0; a <= MAX_PINTAS; a++)
    for (let b = a; b <= MAX_PINTAS; b++) pecas.push([a, b]);
  return pecas;                                              // 28
}

// Aceita a chave do modo ('trio') ou o próprio objeto — o objeto serve aos testes,
// que montam modos de mentira para exercitar os limites sem mexer na tabela real.
const modoDe = regras => {
  const m = (regras || {}).modo;
  return (typeof m === 'object' && m) || MODOS[m] || MODOS[MODO_PADRAO];
};

// O Trio joga sem a bucha de zero: 27 peças, que dividem exato entre três.
function baralhoDoModo(modo) {
  const pecas = baralhoCompleto();
  return modo.semZeroZero ? pecas.filter(p => !mesmaPeca(p, [0, 0])) : pecas;
}

// QUANTAS PEÇAS SOBRAM PARA O MONTE nesta combinação de modo e jogadores. Mora aqui, junto
// do `baralhoDoModo`, porque aritmética de baralho fora do motor apodrece — o `14-menu.js`
// já teve um `28 - 7 * MESA.n` escrito à mão, e foi a primeira linha a quebrar quando os
// modos chegaram.
//
// Repare que a resposta NÃO é uma propriedade do modo: o Clássico tem monte com 2 ou 3
// jogadores e nenhum com 4, e é a mesma tabela que faz o Duelo e o Trio esgotarem o baralho
// na distribuição. Quem pergunta são o menu (para não prometer compra livre onde ela não
// existe) e quem quiser saber antes de distribuir.
function sobraDoBaralho(modo, n) {
  return baralhoDoModo(modo).length - n * modo.pecasPorMao;
}

// A REGRA DA CASA: quando a mão saiu ruim demais e a mesa embaralha tudo de novo.
//
// Devolver true joga a distribuição INTEIRA fora — não só esta mão — e redistribui, até
// MAX_EMBARALHOS vezes. O critério é só a contagem de buchas, como se combinou:
// `modo.carrocasDemais` vale 5 no clássico e no trio, e 7 no duelo, onde são as sete e a
// mão inteira é de carroça.
//
// Acontece pouco (menos de 1% das distribuições em qualquer modo), e é assim que tem de
// ser: o laço de re-embaralho existe para o negócio esquisito, não para editar a sorte.
function maoRuim(mao, modo) {
  return mao.filter(carroca).length >= modo.carrocasDemais;
}

// Fisher-Yates. Usa Math.random de propósito: os testes trocam Math.random por uma
// versão com semente, e aí uma partida que falhou é sempre reproduzível.
function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function distribuir(nJogadores, regras) {
  const modo = modoDe(regras);
  const total = baralhoDoModo(modo).length;
  // Sem isto o splice devolveria mãos curtas EM SILÊNCIO — o menu já barra a
  // combinação, mas os testes e a ponte window.__jogo entram por baixo dele.
  if (nJogadores * modo.pecasPorMao > total) {
    throw new Error(`${nJogadores} jogadores × ${modo.pecasPorMao} peças não cabem num baralho de ${total}`);
  }

  for (let embaralhos = 1; ; embaralhos++) {
    const monte = embaralhar(baralhoDoModo(modo));
    const maos = [];
    for (let i = 0; i < nJogadores; i++) maos.push(monte.splice(0, modo.pecasPorMao));
    // No clássico com 4, no duelo e no trio o monte sai vazio, por construção.
    if (embaralhos >= MAX_EMBARALHOS || !maos.some(m => maoRuim(m, modo))) {
      return { maos, monte, embaralhos };
    }
  }
}

// Quem abre a primeira mão da partida: quem tem o 6|6. Se ninguém tiver — só acontece
// quando existe monte, com 2 ou 3 jogadores — a maior carroça; e se não houver carroça
// nenhuma na mesa, a peça de maior valor.
function quemAbre(maos) {
  let melhor = null;
  maos.forEach((mao, cadeira) => {
    for (const p of mao) {
      const nota = (carroca(p) ? 100 : 0) + valor(p);
      if (!melhor || nota > melhor.nota) melhor = { cadeira, peca: p, nota };
    }
  });
  return melhor;
}
