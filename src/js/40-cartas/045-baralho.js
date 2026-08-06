// O BARALHO DE 40, e nada além disso.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// POR QUE ESTA PASTA NÃO É DO TRUCO. Naipe, valor e o desenho de uma carta servem ao truco,
// ao pife e ao vinte-e-um; a FORÇA de cada carta serve a um só. É a mesma divisão que fez
// `10-casa/` existir: aqui mora o que três jogos herdam, e a regra de quem ganha de quem
// mora com quem tem a regra.
//
// O truco paga esta pasta; o pife e o vinte-e-um pegam de graça. É por isso que a ordem das
// fases é esta e não outra.
//
// PURO, como `030-regras.js` e `060-layout.js` do dominó (invariante 4): nada aqui toca em
// tela, em three ou em armazenamento. É o que permite testá-lo inteiro no terminal.

// As dez cartas de cada naipe. Saem o 8, o 9 e o 10 — é isso que faz 40 em vez de 52.
//
// A ORDEM DESTE ARRAY É IDENTIDADE, NÃO FORÇA. Aqui ela é a ordem em que qualquer um
// recitaria um baralho; a força do truco é outra (4 5 6 7 Q J K A 2 3, com a manilha por
// cima de tudo) e mora em `50-truco/`, porque no pife e no vinte-e-um ela é diferente de
// novo. Misturar as duas coisas neste arquivo seria pôr regra de um jogo na pasta que
// promete servir a três.
const VALORES = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'];

// Os quatro naipes. `cor` é do DESENHO e não da regra: num baralho espanhol de verdade os
// quatro são da mesma cor, e vermelho/preto é a convenção que todo mundo lê de relance.
//
// A ordem aqui também é só identidade. O desempate do truco entre manilhas
// (ouros < espadas < copas < paus) calha de ser esta, e isso é COINCIDÊNCIA: quem depender
// dela está lendo regra de truco de dentro da pasta errada, e no dia em que um jogo quiser
// outra ordem esta linha não pode ser o motivo de ele não poder.
const NAIPES = [
  { id: 'ouros', nome: 'ouros', cor: '#c0392b' },
  { id: 'espadas', nome: 'espadas', cor: '#1a1a1a' },
  { id: 'copas', nome: 'copas', cor: '#c0392b' },
  { id: 'paus', nome: 'paus', cor: '#1a1a1a' },
];

// UMA CARTA É `[v, n]` — dois inteiros, índices nas tabelas acima.
//
// Dois números e não um objeto `{valor:'A', naipe:'ouros'}`, e a razão é a mesma que fez a
// peça de dominó ser `[a, b]`: isto atravessa `JSON.stringify` sem perder nada, cabe na
// `visaoDe` que trafega no online, e compara com `===` campo a campo. O invariante 3 depende
// de a partida inteira ser dado puro — objeto com método não sobrevive ao fio.
const valorDaCarta = c => VALORES[c[0]];
const naipeDaCarta = c => NAIPES[c[1]];

// A chave canônica. Diferente do dominó, aqui NÃO há simetria a resolver: a `[0,2]` do
// dominó e a `[2,0]` são a mesma peça, e por isso `chave` e `mesmaPeca` são coisas
// diferentes lá. Uma carta é o par ordenado, e ponto.
const chaveCarta = c => c[0] + ':' + c[1];
const mesmaCarta = (a, b) => a[0] === b[0] && a[1] === b[1];

const cartaValida = c => Array.isArray(c) && c.length === 2
  && Number.isInteger(c[0]) && c[0] >= 0 && c[0] < VALORES.length
  && Number.isInteger(c[1]) && c[1] >= 0 && c[1] < NAIPES.length;

// O nome que uma pessoa lê: "3 de paus".
const nomeDaCarta = c => cartaValida(c) ? `${valorDaCarta(c)} de ${naipeDaCarta(c).nome}` : '?';

function baralho40() {
  const cartas = [];
  for (let n = 0; n < NAIPES.length; n++)
    for (let v = 0; v < VALORES.length; v++) cartas.push([v, n]);
  return cartas;                                                  // 40
}

// Distribui e devolve o que sobrou. Quantas cartas por mão é decisão do JOGO — o truco dá
// três, o pife dá nove —, então ela chega por parâmetro e não sai de uma tabela aqui.
//
// ESTOURA em vez de entregar mão curta, e a lição é emprestada do dominó: `distribuir` dava
// mãos curtas EM SILÊNCIO quando a conta não fechava, porque o `splice` devolve o que tem.
// O menu barra a combinação, mas os testes e a ponte entram por baixo dele.
function distribuirCartas(nJogadores, porMao) {
  if (!Number.isInteger(nJogadores) || nJogadores < 1) throw new Error(`jogadores inválido: ${nJogadores}`);
  if (!Number.isInteger(porMao) || porMao < 1) throw new Error(`cartas por mão inválido: ${porMao}`);
  const total = NAIPES.length * VALORES.length;
  if (nJogadores * porMao > total) {
    throw new Error(`${nJogadores} jogadores × ${porMao} cartas não cabem num baralho de ${total}`);
  }
  const monte = embaralhar(baralho40());          // `embaralhar` é da CASA (010-constantes.js)
  const maos = [];
  for (let i = 0; i < nJogadores; i++) maos.push(monte.splice(0, porMao));
  return { maos, monte };
}
