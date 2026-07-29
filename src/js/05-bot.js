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
    linha: P.linha,                            // está na mesa: todo mundo vê
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
// A DECISÃO DO BOT.
//
//   opcoes: [{ peca:[a,b], ponta:'esq'|'dir', valor:a+b, carroca:bool }]  (nunca vazio)
//   mao:    as peças que o bot ainda tem, incluindo a que ele vai jogar
//   info:   { linha, pontas:[e,d], faltaNo, pecasRestantes, monte, parceiro, cadeira, n }
//
// Uma nota por opção, e a maior ganha. A ordem dos pesos é a ordem das prioridades de
// quem joga bem: bater, não se enterrar, apertar o próximo, e só então descarregar peso.
//
// Repare que aqui NÃO se decide comprar nem passar — quando não há jogada, jogadaDoBot
// resolve antes e esta função nem é chamada. E as opções já chegam filtradas por
// acoesDe, então a regra do fechamento armado vale para o bot sem uma linha a mais.
// ─────────────────────────────────────────────────────────────────────────────
function escolherJogada(opcoes, mao, info) {
  const restam = mao.length;
  const proximo = (info.cadeira + 1) % info.n;
  // faltaNo pode ser Set (níveis com memória) ou o VAZIO compartilhado.
  const naoTem = (c, num) => {
    const f = info.faltaNo[c];
    return !!f && (f.has ? f.has(num) : f.indexOf(num) >= 0);
  };
  const apertaria = (c, e, d) => (naoTem(c, e) ? 1 : 0) + (naoTem(c, d) ? 1 : 0);

  const nota = o => {
    // Bater ganha de tudo — e, entre duas batidas, ganha a que paga mais.
    if (restam === 1) return 1000 + PONTOS[tipoDaBatida(o.peca, info.linha)];

    const [e, d] = pontasDepois(info.linha, o.peca, o.ponta);
    const resto = mao.filter(p => !mesmaPeca(p, o.peca));
    let n = 0;

    // NÃO SE ENTERRAR é o critério que mais separa um bot decente de um burro: contar
    // com quantas peças você ainda responde às pontas que VOCÊ acabou de deixar.
    const respondem = resto.filter(p => p[0] === e || p[1] === e || p[0] === d || p[1] === d).length;
    n += respondem * 6;
    if (!respondem && resto.length) n -= 25;     // sair sem resposta é doar a vez

    // Sufocar quem joga logo depois, e não sufocar o sócio. Sai de graça de `faltaNo`,
    // que é o que cada um mostrou não ter ao passar — informação pública.
    n += apertaria(proximo, e, d) * 12;
    if (info.parceiro !== null) n -= apertaria(info.parceiro, e, d) * 10;

    // Descarregar peso: a tranca é decidida na soma do que sobrou na mão, e peça pesada
    // presa no fim é o que faz perder mão ganha.
    n += o.valor * 0.8;

    // Carroça é a peça mais difícil de colocar — ela só serve num número. Guardá-la
    // para o fim é como guardar a que menos encaixa.
    if (o.carroca) n += 4;

    return n;
  };

  let melhor = opcoes[0], melhorNota = -Infinity;
  for (const o of opcoes) {
    const n = nota(o);
    if (n > melhorNota) { melhorNota = n; melhor = o; }
  }
  return melhor;
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
