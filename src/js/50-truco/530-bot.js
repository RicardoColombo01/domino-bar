// O BOT DO TRUCO: que carta jogar, e quando apostar.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// A dificuldade NÃO é um algoritmo por nível — é QUANTA INFORMAÇÃO o bot recebe e quanto ele
// erra no impulso, exatamente como no dominó (`30-domino/050-bot.js`). Assim existe uma
// decisão só para manter, em vez de três que divergem com o tempo.
//
// O QUE O TRUCO ACRESCENTA: uma segunda decisão. No dominó o bot escolhe uma peça e pronto;
// aqui ele escolhe uma carta E decide se aposta, se aceita e se corre. As duas saem do mesmo
// número — o PODER da mão —, e é isso que impede o bot de trucar com lixo e correr com
// manilha.
//
// E ele nunca trapaceia: tudo o que `informacaoDoTruco` entrega já está em `visaoDoTruco`.
// Não é escrúpulo, é o que faz a DICA existir de graça — e se a dica precisasse de um campo a
// mais, seria prova de que o bot olhava a mão dos outros.

const NIVEIS_TRUCO = {
  // `memoria` é reparar no que JÁ SAIU nas vazas anteriores — as cartas estão viradas na
  // mesa e todo mundo viu, então isto é atenção e não informação privilegiada.
  facil: { ruido: 0.35, memoria: false, coragem: -0.12 },
  normal: { ruido: 0.10, memoria: true, coragem: 0 },
  dificil: { ruido: 0, memoria: true, coragem: 0.05 },
};

const SEM_MEMORIA = [];

// ─── o PODER de uma carta, de 0 a 1 ──────────────────────────────────────────
// `forcaDaCarta` devolve 0…9 para as comuns e 100…103 para as manilhas — bom para COMPARAR,
// ruim para SOMAR: a distância entre a manilha e o 3 viraria dez vezes a distância entre o 3
// e o 4, e a mão com uma manilha e duas cartas fracas pareceria imbatível.
//
// Esta escala aperta as duas faixas em algo comparável: uma manilha vale ~0.9, o 3 vale 0.6,
// o 4 vale 0. É a diferença entre "que carta ganha desta" e "que mão é esta", e são perguntas
// diferentes.
function poderDaCarta(carta, manilha) {
  if (carta[0] === manilha) return 0.86 + FORCA_NAIPE[naipeDaCarta(carta).id] * 0.045;
  return (postoDaCarta(carta) / 9) * 0.6;
}

// O poder da MÃO: a média, com a melhor carta pesando mais. Uma mão de "manilha + dois 4" é
// melhor do que a média sugere — a manilha ganha uma vaza sozinha, e no truco uma vaza é
// um terço da mão.
function poderDaMao(mao, manilha) {
  if (!mao.length) return 0;
  const p = mao.map(c => poderDaCarta(c, manilha)).sort((a, b) => b - a);
  const media = p.reduce((s, x) => s + x, 0) / p.length;
  return Math.min(1, media * 0.55 + p[0] * 0.45);
}

// ─── o que o bot pode saber ──────────────────────────────────────────────────
// Tudo público: a vira está virada na mesa, as cartas jogadas estão à vista, quem ganhou
// cada vaza a mesa inteira viu, e o placar está no HUD.
function informacaoDoTruco(P, cadeira, cfg) {
  return {
    manilha: P.manilha,
    mesa: P.mesa,                                     // a vaza em curso, à vista de todos
    vazas: cfg.memoria ? P.vazas.map(v => v.time) : SEM_MEMORIA,
    // O que já SAIU do baralho nas vazas fechadas — quem prestou atenção sabe.
    saiu: cfg.memoria ? P.vazas.flatMap(v => v.jogadas.map(j => j.carta)) : SEM_MEMORIA,
    aposta: P.aposta,
    pedido: P.pedido,
    placar: P.placar,
    alvo: P.regras.alvo,
    meuTime: timeNoTruco(P, cadeira),
    cadeira,
    n: P.n,
    duplas: P.duplas,
    coragem: cfg.coragem,
  };
}

// A mesma coisa, a partir da VISTA — é o que faz a dica funcionar para o convidado, que não
// tem partida na memória. Repare que nenhum campo precisou ser inventado.
function informacaoDoTrucoDaVista(vista) {
  return {
    manilha: vista.manilha,
    mesa: vista.mesa,
    vazas: (vista.vazas || []).map(v => v.time),
    saiu: (vista.vazas || []).flatMap(v => (v.jogadas || []).map(j => j.carta)),
    aposta: vista.aposta,
    pedido: vista.pedido,
    placar: vista.placar,
    alvo: vista.alvo,
    meuTime: vista.duplas ? vista.cadeira % 2 : vista.cadeira,
    cadeira: vista.cadeira,
    n: vista.cadeiras.length,
    duplas: vista.duplas,
    coragem: 0,                                       // a dica é o melhor que este código sabe
  };
}

// Quem está ganhando a vaza em curso, e com que carta. `null` se a mesa está vazia.
function mandandoNaVaza(info, time) {
  if (!info.mesa.length) return null;
  let melhor = info.mesa[0];
  for (const j of info.mesa) {
    if (compararCartas(j.carta, melhor.carta, info.manilha) > 0) melhor = j;
  }
  return { cadeira: melhor.cadeira, carta: melhor.carta, meu: time(melhor.cadeira) === info.meuTime };
}

// ─── que carta jogar ─────────────────────────────────────────────────────────
// Uma nota por carta, e a maior ganha — mesma forma do dominó, e pelos mesmos dois motivos:
// dá para explicar (os PORQUÊS alimentam a dica) e dá para mudar um peso sem reescrever o
// raciocínio.
function escolherCarta(mao, info, time) {
  const manda = mandandoNaVaza(info, time);
  const primeira = info.vazas.length === 0;

  const nota = carta => {
    const porques = [];
    const somar = (peso, texto) => { if (peso) porques.push({ peso, texto }); return peso; };
    const p = poderDaCarta(carta, info.manilha);
    let n = 0;

    if (manda) {
      const ganha = compararCartas(carta, manda.carta, info.manilha) > 0;
      if (manda.meu) {
        // O SÓCIO ESTÁ GANHANDO: não passe por cima dele. Gastar uma manilha para tomar a
        // vaza do próprio parceiro é o erro mais caro que um bot de truco comete, e é o que
        // separa jogar em dupla de jogar sozinho com um sócio atrapalhando.
        n += somar((1 - p) * 40, 'o seu parceiro já está ganhando esta vaza: guarde as boas');
      } else if (ganha) {
        // Ganhe com a MAIS BARATA que ganha. Matar um 4 com manilha é jogar fora a mão.
        n += somar(30, 'esta carta ganha a vaza');
        n += somar((1 - p) * 25, 'e é a mais barata que ganha — não gaste manilha à toa');
      } else {
        // Não dá para ganhar: jogue a pior e guarde as boas.
        n += somar((1 - p) * 30, 'não dá para ganhar esta vaza: descarte a mais fraca');
      }
    } else {
      // SAINDO. A primeira vaza vale mais NESTA CASA do que na regra genérica: aqui ela é o
      // desempate de tudo (ver o melou, em 510-regras.js), então quem a ganha leva qualquer
      // mão que empate depois. Sair forte na primeira é regra de casa virando estratégia.
      n += somar(p * (primeira ? 34 : 26), primeira
        ? 'sair forte na primeira: aqui ela é o desempate de toda a mão'
        : 'sair forte para tomar a vaza');
      // …mas não com a melhor de todas na primeira, se houver outra que também ganha muito:
      // a manilha guardada decide a terceira.
      if (primeira && mao.length === 3 && p > 0.85) {
        n += somar(-8, 'guardar a manilha para depois costuma valer mais que abrir com ela');
      }
    }

    // Carta que já não ganha de ninguém é lixo — e lixo se descarta cedo. Só o bot com
    // MEMÓRIA sabe disso, porque depende de reparar no que já saiu.
    if (info.saiu.length && p < 0.5) {
      n += somar(3, 'carta baixa, e já saiu carta alta o bastante para ela não valer nada');
    }
    return { n, porques };
  };

  let melhor = mao[0], melhorNota = -Infinity, melhorPorques = [];
  for (const c of mao) {
    const { n, porques } = nota(c);
    if (n > melhorNota) { melhorNota = n; melhor = c; melhorPorques = porques; }
  }
  return { carta: melhor, porques: melhorPorques };
}

// ─── apostar, aceitar, correr ────────────────────────────────────────────────
// Tudo sai do mesmo número — o poder da mão —, corrigido por três coisas que um jogador
// olha sem pensar: as vazas já ganhas, o que a mão vale, e o placar.
//
// OS LIMIARES SÃO CHUTE CALIBRADO, e está dito de frente: eles saíram de rodar o bot contra
// ele mesmo e olhar se ele trucava com lixo ou corria com manilha. O que os defende não é a
// escolha do número, é a asserção de FORÇA — o difícil tem de ganhar do fácil, e ela reprova
// se um ajuste aqui piorar o bot.
function avaliarAposta(mao, info) {
  let poder = poderDaMao(mao, info.manilha);

  // Vaza ganha é meia mão ganha, e a primeira vale mais (é o desempate).
  const ganhas = info.vazas.filter(t => t === info.meuTime).length;
  const perdidas = info.vazas.filter(t => t !== null && t !== info.meuTime).length;
  if (info.vazas[0] === info.meuTime) poder += 0.14;
  poder += ganhas * 0.10 - perdidas * 0.12;

  // DESESPERO: perdendo feio, vale arriscar; ganhando de lavada, não vale. É o que um
  // jogador chama de "não tem nada a perder", e sem isto o bot joga igual em toda situação.
  const meu = info.placar[info.meuTime], dele = info.placar[info.meuTime === 0 ? 1 : 0];
  if (dele - meu >= 4) poder += 0.10;
  if (meu - dele >= 4) poder -= 0.06;

  return Math.max(0, Math.min(1, poder + info.coragem));
}

// Vale a pena pedir? `valor` é quanto a mão passaria a valer.
//
// O LIMIAR SOBE COM A APOSTA: pedir truco com mão média é blefe barato; pedir doze com a
// mesma mão é entregar a partida. E o preço do erro cresce, então a exigência cresce junto.
function querTrucar(mao, info, valor) {
  const p = avaliarAposta(mao, info);
  const exige = { 3: 0.58, 6: 0.68, 9: 0.76, 12: 0.82 }[valor];
  return exige !== undefined && p >= exige;
}

// Aceitar, correr ou aumentar. Devolve 'aceitar' | 'correr' | 'aumentar'.
//
// CORRER É BARATO E ACEITAR É CARO, e é por isso que o limiar de aceitar é MAIS BAIXO que o
// de pedir: quem corre entrega o que já valia; quem aceita arrisca o que vai valer. Um bot
// que usasse o mesmo número para as duas coisas correria de mãos boas.
function responderAposta(mao, info, pedido) {
  const p = avaliarAposta(mao, info);
  const sobe = proximaAposta(pedido.valor);
  if (sobe !== null && p >= { 6: 0.80, 9: 0.86, 12: 0.90 }[sobe]) return 'aumentar';
  return p >= { 3: 0.34, 6: 0.42, 9: 0.50, 12: 0.58 }[pedido.valor] ? 'aceitar' : 'correr';
}

// ─── a dica ──────────────────────────────────────────────────────────────────
// O bot pensando com a SUA mão, sem ruído e sem coragem extra. Sai da VISTA e nunca da
// partida — a mesma propriedade que o dominó já tem.
function dicaDoTruco(vista) {
  if (!vista || vista.vez !== vista.cadeira) return null;
  const a = vista.acoes;
  if (!a) return null;
  const info = informacaoDoTrucoDaVista(vista);
  const time = c => (vista.duplas ? c % 2 : c);

  if (a.onze) {
    const p = poderDaMao(vista.mao, vista.manilha);
    return p >= 0.55
      ? { acao: 'onze', jogar: true, porques: [{ texto: 'mão boa para uma mão de 11: vale os 3 pontos' }] }
      : { acao: 'onze', jogar: false, porques: [{ texto: 'mão fraca: entregar 1 custa menos que perder 3' }] };
  }
  if (a.aceitar) {
    const r = responderAposta(vista.mao, info, vista.pedido);
    return { acao: r, porques: [{ texto: r === 'correr' ? 'a mão não paga o que está valendo'
      : r === 'aumentar' ? 'mão forte o bastante para subir a aposta' : 'a mão aguenta o que está valendo' }] };
  }
  if (!a.cartas.length) return null;

  const escolha = escolherCarta(vista.mao, info, time);
  const porques = escolha.porques.slice();
  if (a.trucar && querTrucar(vista.mao, info, a.trucar)) {
    porques.unshift({ texto: `dá para pedir ${NOME_DA_APOSTA[a.trucar] || a.trucar} antes de jogar` });
  }
  return { acao: 'jogar', carta: escolha.carta, porques };
}

// ─── a vez do bot ────────────────────────────────────────────────────────────
// Devolve a INTENÇÃO e não mexe na partida — quem aplica é o loop, pelo mesmo caminho de
// uma jogada que chega pela rede. É o que faz o bot passar pelas mesmas validações.
function jogadaDoBotNoTruco(P, cadeira) {
  const a = acoesDoTruco(P, cadeira);
  const cfg = NIVEIS_TRUCO[P.cadeiras[cadeira].nivel] || NIVEIS_TRUCO.normal;
  const info = informacaoDoTruco(P, cadeira, cfg);
  const time = c => timeNoTruco(P, c);
  const mao = P.maos[cadeira];

  if (a.onze) {
    // No impulso, entrega ou joga sem olhar. Com atenção, olha a mão.
    const jogar = Math.random() < cfg.ruido
      ? Math.random() < 0.5
      : poderDaMao(mao, P.manilha) >= 0.55;
    return { acao: 'onze', jogar };
  }

  if (a.aceitar) {
    if (Math.random() < cfg.ruido) {
      return { acao: Math.random() < 0.7 ? 'aceitar' : 'correr' };
    }
    return { acao: responderAposta(mao, info, P.pedido) };
  }

  if (!a.cartas.length) return null;                  // não é a vez, ou não há o que fazer

  // PEDIR VEM ANTES DE JOGAR, porque é a ordem da mesa: você truca e só então põe a carta.
  // O ruído entra aqui também — o bot fácil truca no impulso, que é o que faz jogar contra
  // ele ser diferente de jogar contra o difícil.
  if (a.trucar) {
    const quer = Math.random() < cfg.ruido
      ? Math.random() < 0.18
      : querTrucar(mao, info, a.trucar);
    if (quer) return { acao: 'trucar' };
  }

  const carta = Math.random() < cfg.ruido
    ? mao[Math.floor(Math.random() * mao.length)]
    : escolherCarta(mao, info, time).carta;
  return { acao: 'jogar', carta };
}
