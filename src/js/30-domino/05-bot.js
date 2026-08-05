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
// A nota vem acompanhada dos PORQUÊS — cada parcela com o nome do que ela mede. Não é
// enfeite: é o que a dica de jogada mostra a quem está aprendendo, e é a diferença entre
// dizer "jogue o 4|5" e ensinar por que. A aritmética é EXATAMENTE a de antes, nas mesmas
// parcelas e na mesma ordem, porque `test-regras.mjs` mede a força do bot em 300 partidas
// e qualquer mudança de soma aqui mexeria naquele número.
function escolherJogada(opcoes, mao, info) {
  const restam = mao.length;
  const proximo = (info.cadeira + 1) % info.n;
  // faltaNo pode ser Set (níveis com memória), o VAZIO compartilhado, ou array — a dica
  // entrega o que veio da VISTA, onde ele trafega como array.
  const naoTem = (c, num) => {
    const f = info.faltaNo[c];
    return !!f && (f.has ? f.has(num) : f.indexOf(num) >= 0);
  };
  const apertaria = (c, e, d) => (naoTem(c, e) ? 1 : 0) + (naoTem(c, d) ? 1 : 0);

  const nota = o => {
    const porques = [];
    const somar = (peso, texto) => { if (peso) porques.push({ peso, texto }); return peso; };

    // Bater ganha de tudo — e, entre duas batidas, ganha a que paga mais.
    if (restam === 1) {
      const tipo = tipoDaBatida(o.peca, info.linha);
      return { n: 1000 + PONTOS[tipo], porques: [{ peso: 1000, texto: `bate a mão — ${NOME_BATIDA[tipo]}` }] };
    }

    const [e, d] = pontasDepois(info.linha, o.peca, o.ponta);
    const resto = mao.filter(p => !mesmaPeca(p, o.peca));
    let n = 0;

    // NÃO SE ENTERRAR é o critério que mais separa um bot decente de um burro: contar
    // com quantas peças você ainda responde às pontas que VOCÊ acabou de deixar.
    const respondem = resto.filter(p => p[0] === e || p[1] === e || p[0] === d || p[1] === d).length;
    n += somar(respondem * 6, `você ainda responde às pontas ${e} e ${d} com ${respondem} peça${respondem === 1 ? '' : 's'}`);
    if (!respondem && resto.length) n += somar(-25, `deixa você sem resposta nas pontas ${e} e ${d}`);

    // Sufocar quem joga logo depois, e não sufocar o sócio. Sai de graça de `faltaNo`,
    // que é o que cada um mostrou não ter ao passar — informação pública.
    n += somar(apertaria(proximo, e, d) * 12, 'aperta quem joga depois de você, que já passou nesse número');
    if (info.parceiro !== null) n += somar(-(apertaria(info.parceiro, e, d) * 10), 'atrapalha o seu parceiro');

    // Descarregar peso: a tranca é decidida na soma do que sobrou na mão, e peça pesada
    // presa no fim é o que faz perder mão ganha.
    n += somar(o.valor * 0.8, `descarrega ${o.valor} pontos, que contam se a mesa trancar`);

    // Carroça é a peça mais difícil de colocar — ela só serve num número. Guardá-la
    // para o fim é como guardar a que menos encaixa.
    if (o.carroca) n += somar(4, 'é carroça, e carroça só serve num número');

    return { n, porques };
  };

  let melhor = opcoes[0], melhorNota = -Infinity, melhorPorques = [];
  for (const o of opcoes) {
    const { n, porques } = nota(o);
    if (n > melhorNota) { melhorNota = n; melhor = o; melhorPorques = porques; }
  }
  // O objeto da opção é devolvido como sempre; os porquês vão pendurados nele para quem
  // quiser. `jogadaDoBot` ignora, e é por isso que o bot não mudou de comportamento.
  return Object.assign({}, melhor, { porques: melhorPorques });
}

// ─── a dica de jogada ────────────────────────────────────────────────────────
// A dica é o bot pensando com a SUA mão, e sai da VISTA — nunca da partida.
//
// Isso não é escrúpulo: repare que todo campo que `informacao()` entrega ao bot já existe
// na visão. Não é coincidência, é a consequência de o bot ter sido escrito para não
// trapacear — `linha` e `faltaNo` são públicos, `pecasRestantes` e `monte` são contagens
// que a mesa inteira vê. Se a dica precisasse de um campo a mais, seria prova de que o bot
// estava olhando a mão dos outros.
//
// E é por isso que ela funciona também para o convidado, que não tem partida na memória.
function informacaoDaVista(vista) {
  return {
    linha: vista.linha,
    pontas: pontas(vista.linha),
    faltaNo: vista.faltaNo || VAZIO,
    pecasRestantes: vista.naMao,
    monte: vista.monte,
    // A mesma conta do `parceiroDe`, com `duplas` que a vista já traz.
    parceiro: vista.duplas ? (vista.cadeira + 2) % 4 : null,
    cadeira: vista.cadeira,
    n: vista.cadeiras.length,
  };
}

// Devolve { acao, peca, ponta, porques } ou null se não houver o que sugerir.
function dicaDaVista(vista) {
  if (!vista || vista.fase !== 'mao' || vista.vez !== vista.cadeira) return null;
  const a = vista.acoes;
  if (!a) return null;
  if (!a.jogadas.length) {
    return a.comprar
      ? { acao: 'comprar', porques: [{ texto: 'não há jogada: compre do monte até conseguir' }] }
      : { acao: 'passar', porques: [{ texto: 'não há jogada e não há monte: só resta passar' }] };
  }
  const opcoes = a.jogadas.map(j => ({
    peca: j.peca, ponta: j.ponta, valor: valor(j.peca), carroca: carroca(j.peca),
  }));
  // Sem ruído: a dica é o melhor que este código sabe, não o nível de um adversário.
  // `vista.mao` é a MESMA referência da mão do motor e há teste que a congela — por isso
  // `escolherJogada` só a filtra, nunca a ordena.
  const escolha = escolherJogada(opcoes, vista.mao, informacaoDaVista(vista)) || opcoes[0];
  return { acao: 'jogar', peca: escolha.peca, ponta: escolha.ponta, porques: escolha.porques || [] };
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
