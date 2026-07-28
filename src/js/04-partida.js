// A partida: turnos, compra, passe, fim de mão e placar.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// A IDEIA QUE SEGURA O PROJETO INTEIRO: uma cadeira é só
//     { nome, tipo: 'voce' | 'local' | 'bot' | 'online', nivel }
// e o motor NÃO sabe a diferença entre os tipos. Ele diz de quem é a vez e espera.
// Quem responde — o mouse, o bot ou a rede — é problema de outra camada. Por isso
// solo, hotseat e online rodam exatamente este mesmo código, e por isso dá para
// sentar 2 humanos online + 2 bots na mesma mesa sem uma linha a mais.

const timeDe = (P, cadeira) => (P.duplas ? cadeira % 2 : cadeira);
const parceiroDe = (P, cadeira) => (P.duplas ? (cadeira + 2) % 4 : null);

function novaPartida(cadeiras, regras) {
  const P = {
    cadeiras,
    n: cadeiras.length,
    duplas: cadeiras.length === 4,            // 4 jogadores → 1&3 contra 2&4, em cruz
    regras: Object.assign({ alvo: ALVO_PADRAO, compraVoluntaria: false, modo: MODO_PADRAO }, regras || {}),
    placar: cadeiras.length === 4 ? [0, 0] : new Array(cadeiras.length).fill(0),
    maoNum: 0,
    abridor: null,
    log: [],
  };
  novaMao(P);
  return P;
}

function novaMao(P) {
  // O tamanho da mão vem de P.regras, e não de parâmetro, porque o botão "Próxima mão"
  // chama novaMao(P) sem mais nada — a mesa não pode trocar de modo no meio da partida.
  const { maos, monte } = distribuir(P.n, P.regras);
  P.maos = maos;
  P.monte = monte;
  P.linha = [];
  // Onde está, na fila, a peça de abertura. Jogar na esquerda empurra todo mundo um
  // índice para a frente — sem isso o tabuleiro inteiro escorregaria na tela a cada
  // jogada pela esquerda, em vez de crescer para os lados a partir do centro.
  P.iAncora = 0;
  P.passesSeguidos = 0;
  P.resultado = null;
  P.fase = 'mao';
  P.maoNum++;
  // Dedução pública: o que cada jogador JÁ MOSTROU não ter, por ter passado.
  P.faltaNo = maos.map(() => new Set());

  if (P.abridor === null) {
    // Primeira mão da partida: quem tem o 6|6 abre, e abre COM ele.
    const a = quemAbre(maos);
    P.vez = a.cadeira;
    P.pecaObrigatoria = a.peca;
  } else {
    P.vez = P.abridor;                        // nas seguintes, abre quem bateu, com o que quiser
    P.pecaObrigatoria = null;
  }
  P.log.push({ t: 'mao', num: P.maoNum, abre: P.vez, obrigatoria: P.pecaObrigatoria });
  return P;
}

// O que esta cadeira pode fazer agora. Serve para três coisas de uma vez: acender os
// botões na tela, alimentar o bot, e validar o que chega pela rede. Uma fonte só.
function acoesDe(P, cadeira) {
  if (P.fase !== 'mao' || P.vez !== cadeira) return { jogadas: [], comprar: false, passar: false };
  let jogadas = jogadasValidas(P.maos[cadeira], P.linha);
  if (P.pecaObrigatoria) jogadas = jogadas.filter(j => mesmaPeca(j.peca, P.pecaObrigatoria));
  const temMonte = P.monte.length > 0;
  return {
    jogadas,
    // Sem monte (mesa de 4) ninguém compra: quem não pode jogar, passa.
    comprar: temMonte && (!jogadas.length || P.regras.compraVoluntaria),
    passar: !jogadas.length && !temMonte,
  };
}

function jogar(P, cadeira, peca, ponta) {
  const { jogadas } = acoesDe(P, cadeira);
  if (!jogadas.some(j => mesmaPeca(j.peca, peca) && j.ponta === ponta)) return { erro: 'jogada inválida' };

  // O tipo da batida depende das pontas de ANTES da jogada — por isso olha aqui.
  const ultima = P.maos[cadeira].length === 1;
  const tipo = ultima ? tipoDaBatida(peca, P.linha) : null;

  const i = P.maos[cadeira].findIndex(p => mesmaPeca(p, peca));
  P.maos[cadeira].splice(i, 1);
  if (ponta === 'esq' && P.linha.length) P.iAncora++;
  P.linha = aplicar(P.linha, peca, ponta);
  P.pecaObrigatoria = null;
  P.passesSeguidos = 0;
  P.log.push({ t: 'jogou', cadeira, peca, ponta });

  if (ultima) return fecharMao(P, { motivo: 'batida', tipo, vencedor: cadeira });
  P.vez = (cadeira + 1) % P.n;
  return { ok: true };
}

function comprar(P, cadeira) {
  if (!acoesDe(P, cadeira).comprar) return { erro: 'não dá para comprar agora' };
  const peca = P.monte.pop();
  P.maos[cadeira].push(peca);
  P.log.push({ t: 'comprou', cadeira });
  return { ok: true, peca };
}

function passar(P, cadeira) {
  if (!acoesDe(P, cadeira).passar) return { erro: 'ainda dá para jogar' };
  // Um passe é informação pública e de graça: ele não tem NENHUM dos dois números
  // das pontas. É com isso que os bots (e você) deduzem a mão alheia.
  const pt = pontas(P.linha);
  if (pt) { P.faltaNo[cadeira].add(pt[0]); P.faltaNo[cadeira].add(pt[1]); }
  P.passesSeguidos++;
  P.log.push({ t: 'passou', cadeira });
  if (P.passesSeguidos >= P.n) return fecharMao(P, { motivo: 'tranca' });
  P.vez = (cadeira + 1) % P.n;
  return { ok: true };
}

function fecharMao(P, res) {
  const somas = P.maos.map(somaMao);
  // O subtotal por time serve a duas coisas: decidir a tranca (quem ficou com a mão
  // mais leve) e a tela de fim de mão, que em duplas precisa mostrar o que a DUPLA
  // deixou na mão — quatro números soltos não dizem quem pagou mais caro. Fica aqui
  // fora do if porque a batida também precisa dele, e antes ele só existia na tranca.
  const porTime = {};
  somas.forEach((s, c) => { const t = timeDe(P, c); porTime[t] = (porTime[t] || 0) + s; });

  let time = null, pontos = 0, vencedor = res.vencedor === undefined ? null : res.vencedor;
  const tipo = res.tipo || 'tranca';

  if (res.motivo === 'batida') {
    time = timeDe(P, vencedor);
    pontos = PONTOS[tipo];
  } else {
    // Trancou: marca quem tem a menor soma na mão. Em duplas, soma as duas mãos do time.
    const ordem = Object.keys(porTime).map(Number).sort((a, b) => porTime[a] - porTime[b]);
    if (ordem.length > 1 && porTime[ordem[0]] === porTime[ordem[1]]) {
      time = null;                                   // empate na soma: a mão morre, ninguém marca
    } else {
      time = ordem[0];
      pontos = PONTOS.tranca;
      // Abre a próxima quem, dentro do time vencedor, ficou com a mão mais leve.
      vencedor = somas
        .map((s, c) => [s, c])
        .filter(par => timeDe(P, par[1]) === time)
        .sort((a, b) => a[0] - b[0])[0][1];
    }
  }

  if (time !== null) P.placar[time] += pontos;
  P.abridor = vencedor === null ? P.vez : vencedor;
  P.resultado = {
    motivo: res.motivo, tipo, vencedor, time, pontos, somas,
    somasPorTime: P.placar.map((_, t) => porTime[t] || 0),   // mesmo índice do placar
  };
  P.fase = P.placar.some(v => v >= P.regras.alvo) ? 'fim' : 'fimDeMao';
  P.log.push(Object.assign({ t: 'fimDeMao' }, P.resultado));
  return { ok: true, fim: P.resultado };
}

// O QUE ESTA CADEIRA PODE VER. No online é literalmente o que trafega — o anfitrião
// nunca manda a mão alheia, então não adianta abrir o DevTools. No hotseat local é o
// que a tela desenha entre um jogador e outro. Segurança e apresentação são o mesmo
// problema ("quem pode ver o quê"), então são a mesma função.
function visaoDe(P, cadeira) {
  return {
    cadeira,
    linha: P.linha,
    iAncora: P.iAncora,
    pontas: pontas(P.linha),
    mao: P.maos[cadeira],                        // só a sua
    naMao: P.maos.map(m => m.length),            // dos outros, só a contagem
    monte: P.monte.length,
    vez: P.vez,
    fase: P.fase,
    placar: P.placar,
    resultado: P.resultado,
    maoNum: P.maoNum,
    duplas: P.duplas,
    alvo: P.regras.alvo,
    modo: P.regras.modo,                         // o convidado não vê MESA nem P.regras
    cadeiras: P.cadeiras.map(c => ({ nome: c.nome, tipo: c.tipo })),
    acoes: acoesDe(P, cadeira),
  };
}
