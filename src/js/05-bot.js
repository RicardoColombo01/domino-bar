// O bot.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// A dificuldade aqui NÃO é um algoritmo diferente por nível — é QUANTA INFORMAÇÃO o
// bot recebe e quanto ele erra no impulso. O bot fácil não presta atenção em quem
// passou; o difícil lembra de tudo. Assim existe uma decisão só para manter, em vez
// de três que divergem com o tempo.

const NIVEIS = {
  facil: { ruido: 0.35, memoria: false },   // distraído: joga no impulso e não repara em quem passou
  normal: { ruido: 0.10, memoria: true },
  dificil: { ruido: 0, memoria: true },
};

const VAZIO = [new Set(), new Set(), new Set(), new Set()];

// Tudo que um jogador atento pode saber sem trapacear.
function informacao(P, cadeira, cfg) {
  return {
    pontas: pontas(P.linha),
    faltaNo: cfg.memoria ? P.faltaNo : VAZIO,   // quem passou mostrou o que não tem
    pecasRestantes: P.maos.map(m => m.length),
    monte: P.monte.length,
    parceiro: parceiroDe(P, cadeira),
    cadeira,
    n: P.n,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A DECISÃO DO BOT — escrita pelo Ricardo.
//
//   opcoes: [{ peca:[a,b], ponta:'esq'|'dir', valor:a+b, carroca:bool }]  (nunca vazio)
//   mao:    as peças que o bot ainda tem, incluindo a que ele vai jogar
//   info:   { pontas:[e,d], faltaNo, pecasRestantes, monte, parceiro, cadeira, n }
//
// Devolve uma das opcoes. Devolver null cai no desempate seguro (a primeira).
// ─────────────────────────────────────────────────────────────────────────────
function escolherJogada(opcoes, mao, info) {
  // PLACEHOLDER — troca esta linha pela sua heurística.
  // Hoje ele só descarrega a peça mais pesada, que é o bot mais burro que ainda
  // parece intencional: sobrevive à tranca, mas entrega as peças versáteis cedo.
  return opcoes.reduce((a, b) => (b.valor > a.valor ? b : a));
}

// A vez do bot: joga, compra ou passa. Devolve a intenção, não mexe na partida —
// quem aplica é o loop, e é o mesmo caminho de uma jogada que chega pela rede.
function jogadaDoBot(P, cadeira) {
  const acoes = acoesDe(P, cadeira);
  if (!acoes.jogadas.length) return { acao: acoes.comprar ? 'comprar' : 'passar' };

  const cfg = NIVEIS[P.cadeiras[cadeira].nivel] || NIVEIS.normal;
  const opcoes = acoes.jogadas.map(j => ({
    peca: j.peca, ponta: j.ponta, valor: valor(j.peca), carroca: carroca(j.peca),
  }));

  const escolha = Math.random() < cfg.ruido
    ? opcoes[Math.floor(Math.random() * opcoes.length)]
    : escolherJogada(opcoes, P.maos[cadeira], informacao(P, cadeira, cfg)) || opcoes[0];

  return { acao: 'jogar', peca: escolha.peca, ponta: escolha.ponta };
}
