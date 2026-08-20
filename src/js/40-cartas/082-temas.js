// OS TEMAS DO BARALHO: a cara das cartas, escolhida por quem joga.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Ideia do Ricardo (11/08/2026): "baralho de temas diferentes, aí deixa um inventário para
// cada pessoa escolher que tema irá jogar". A infraestrutura já existia por acidente feliz:
// a Fila 7 obrigou toda textura a guardar a própria RECEITA para poder ser repintada quando
// o Android descarta o bitmap (`pintar()`, 070-cena.js) — trocar de tema é chamar a MESMA
// repintura com outras cores. O mecanismo que existe para sobreviver ao sistema operacional
// serve, sem uma linha nova, para trocar a cara do baralho.
//
// MORA NA BIBLIOTECA e não num jogo, e isso é o que faz o tema valer para o truco, para o
// pife e para o 21 de uma vez — o `test-acoplamento` cobra que esta pasta não alcance nome
// de jogo nenhum. E a preferência é DA PESSOA, não da mesa: ela não muda regra, não viaja
// pelo fio (cada jogador vê o SEU baralho), e vale para todos os jogos de carta — por isso
// a chave é comum (`dominobar.temaBaralho`) e não uma das chaves por jogo.
//
// UM TEMA SÓ MUDA COR, nunca geometria. As asserções do atlas amostram COORDENADAS (o
// centro do naipe a 0.53 da célula, o canto a 0.18×0.275), e um tema que movesse o desenho
// as cegaria — fonte, âncora e tamanho são os mesmos em todos os temas, por contrato.
//
// E TODA COR DE FUNDO (o papel do atlas e o fundo do verso) TEM DE FICAR LONGE DE PRETO E
// DE BRANCO: o pixel (0,0) é a ASSINATURA que separa "desenhado" de "descartado"
// (070-cena.js), e o descarte devolve preto transparente, preto opaco ou branco. Um papel
// preto seria indistinguível de bitmap descartado, e a peça preta da Fila 7/17 voltaria por
// dentro de um tema. O `test-cartas` cobra a distância de cada tema, com o limiar da
// própria sonda (48).

// O clássico lê as cores de `NAIPES` (045-baralho.js) em vez de repeti-las: duas cópias da
// mesma cor é como duas metades passam a discordar.
const CORES_CLASSICAS = Object.fromEntries(NAIPES.map(n => [n.id, n.cor]));

const TEMAS_DO_BARALHO = {
  classico: {
    nome: 'Clássico',
    papel: '#f6f1e4',
    naipes: CORES_CLASSICAS,
    verso: { fundo: '#7a3b2e', linha: 'rgba(255,225,190,.22)', borda: 'rgba(255,225,190,.5)' },
  },
  // A convenção dos baralhos de quatro cores: espadas pretas, copas vermelhas, OUROS AZUIS
  // e PAUS VERDES. No truco a ordem das manilhas é POR NAIPE (ouros < espadas < copas <
  // paus) e o baralho comum as divide em duas cores só — aqui a cor passa a mostrar o que
  // decide a mão.
  quatrocores: {
    nome: '4 cores',
    papel: '#f6f1e4',
    naipes: { ouros: '#1d5fb4', espadas: '#1a1a1a', copas: '#c0392b', paus: '#1e7a34' },
    verso: { fundo: '#31456e', linha: 'rgba(200,220,255,.22)', borda: 'rgba(200,220,255,.5)' },
  },
  // Papel QUASE branco — branco puro colidiria com um descarte branco, ver o aviso lá em
  // cima — e a tinta o mais escura possível. Irmão do piso `--fraco: .58` da Fila 8:
  // acessibilidade é contraste medido, não gosto.
  contraste: {
    nome: 'Contraste',
    papel: '#ececec',
    naipes: { ouros: '#b40000', espadas: '#000000', copas: '#b40000', paus: '#000000' },
    verso: { fundo: '#3a3a3a', linha: 'rgba(255,255,255,.28)', borda: 'rgba(255,255,255,.55)' },
  },
  // Papel envelhecido e tinta desbotada — a identidade da casa, na carta.
  boteco: {
    nome: 'Boteco',
    papel: '#e4d6b8',
    naipes: { ouros: '#a3524a', espadas: '#43392f', copas: '#a3524a', paus: '#43392f' },
    verso: { fundo: '#5c6b4c', linha: 'rgba(240,230,200,.20)', borda: 'rgba(240,230,200,.45)' },
  },
  // Carta escura de tinta clara, para jogar no escuro sem a tela queimar.
  noturno: {
    nome: 'Noturno',
    papel: '#262b33',
    naipes: { ouros: '#ff8b7b', espadas: '#dde4ee', copas: '#ff8b7b', paus: '#dde4ee' },
    verso: { fundo: '#161b23', linha: 'rgba(120,150,200,.25)', borda: 'rgba(120,150,200,.55)' },
  },
};

// A preferência guardada é ENTRADA DE FORA como qualquer outra: `Object.hasOwn`, nunca
// `TEMAS_DO_BARALHO[id] ?` — chave de protótipo já deu tela preta permanente uma vez
// (defeito 5 da Fila 6). Valor que não fecha volta ao clássico em silêncio.
let TEMA_BARALHO_ID = (() => {
  const g = lido('temaBaralho', 'classico');
  return Object.hasOwn(TEMAS_DO_BARALHO, g) ? g : 'classico';
})();

// Lido PELA RECEITA a cada pintura (085-carta3d.js). Como a leitura acontece na hora de
// pintar e a preferência é lida acima ANTES de o atlas existir, a PRIMEIRA pintura já sai
// no tema da pessoa — não há repintura na carga.
const temaDoBaralho = () => TEMAS_DO_BARALHO[TEMA_BARALHO_ID];
const temaDoBaralhoEscolhido = () => TEMA_BARALHO_ID;

// Troca o tema: guarda a preferência e repinta o atlas e o verso NA MESMA textura — o
// material de toda carta aponta para a instância, então tudo o que está na tela muda
// junto, sem reconstruir objeto nenhum. `repintar()` recaptura a assinatura, então a troca
// nunca parece um bitmap descartado para a sonda (`bitmapApagado` compara contra ela).
//
// O que NÃO acompanha na hora: o corpo de papel das cartas com material CLONADO (as da sua
// mão, que acendem no hover) fica com a cor antiga até a próxima sincronização — é só a
// beirada de 0.035 de espessura, e `sincronizarMaoDoTruco` a repinta pelo tema a cada
// publicação. `matPapel` (a instância base, de todas as outras) muda aqui.
function escolherTemaDoBaralho(id) {
  if (!Object.hasOwn(TEMAS_DO_BARALHO, id)) return false;
  if (id === TEMA_BARALHO_ID) return true;
  TEMA_BARALHO_ID = id;
  guardar('temaBaralho', id);
  for (const reg of texturas) {
    if (reg.nome === 'cartas' || reg.nome === 'versoCarta') reg.repintar();
  }
  matPapel.color.set(temaDoBaralho().papel);
  return true;
}

// A LINHA DO MENU, pronta para qualquer jogo de carta pendurar em `menu.OPCOES` — o truco
// a usa hoje e o pife a herda numa linha. É uma opção EXTERNA (ver 140-menu.js): a verdade
// dela mora AQUI e não na MESA, porque tema é preferência da pessoa e não regra da mesa —
// não entra no `lembrarMesa`, não é validada contra a mesa guardada e não viaja no online.
const OPCAO_TEMA_DO_BARALHO = {
  id: 'temaBaralho',
  dado: 'tema',
  rot: 'Baralho',
  externa: true,
  valores: Object.keys(TEMAS_DO_BARALHO).map(k =>
    ({ dado: k, v: k, rotulo: TEMAS_DO_BARALHO[k].nome })),
  atual: temaDoBaralhoEscolhido,
  aoEscolher: escolherTemaDoBaralho,
};
