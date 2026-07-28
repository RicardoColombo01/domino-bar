// O baralho: as 28 peças, o embaralho e quem abre a mão.
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

// Fisher-Yates. Usa Math.random de propósito: os testes trocam Math.random por uma
// versão com semente, e aí uma partida que falhou é sempre reproduzível.
function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

function distribuir(nJogadores) {
  const monte = embaralhar(baralhoCompleto());
  const maos = [];
  for (let i = 0; i < nJogadores; i++) maos.push(monte.splice(0, NA_MAO));
  return { maos, monte };            // com 4 jogadores o monte sai vazio, por construção
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
