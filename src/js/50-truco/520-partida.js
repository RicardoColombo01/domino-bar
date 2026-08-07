// A PARTIDA DE TRUCO: vazas, aposta, mão de 11 e placar.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Mesma ideia que segura o dominó, e por isso o online, o hotseat e o saguão vêm de graça:
// uma cadeira é só `{ nome, tipo, nivel }` e o MOTOR NÃO SABE A DIFERENÇA. Ele diz de quem é
// a vez e espera; quem responde — o mouse, o bot ou a rede — é outra camada.
//
// OS NOMES LEVAM SUFIXO porque `src/js` é um escopo só (invariante 1): `novaPartida`,
// `acoesDe`, `jogar` e `visaoDe` já são do dominó, e o `build.mjs` reprova nome repetido
// dizendo os dois donos. Quem traduz `novaPartidaDoTruco` para o verbo `nova` do contrato é
// o `590-registro.js` — a casa continua sem saber que existe truco.
//
// O QUE O TRUCO TEM E O DOMINÓ NÃO: uma segunda dimensão de jogada. No dominó você joga uma
// peça e pronto; aqui você joga uma carta OU aposta, e apostar interrompe o turno normal
// para o outro time responder. É o encaixe que a Fase 1 deixou de fora de propósito (a
// `barraDoJogo`), porque sem o truco escrito a forma dele seria chute.

const CARTAS_POR_MAO = 3;
const VAZAS_POR_MAO = 3;

const timeNoTruco = (P, cadeira) => (P.duplas ? cadeira % 2 : cadeira);

// A mão de 11 é a regra que muda a partida de caráter no fim: quem chega a 11 vê as cartas e
// decide se joga (valendo 3) ou entrega 1 ponto. Como o alvo é configurável, o número não é
// 11 — é `alvo - 1`.
const naMaoDeOnze = (P, time) => P.placar[time] === P.regras.alvo - 1;

function novaPartidaDoTruco(cadeiras, regras) {
  const P = {
    cadeiras,
    n: cadeiras.length,
    duplas: cadeiras.length === 4,
    regras: Object.assign({ alvo: 12, modo: MODO_PADRAO_TRUCO }, regras || {}),
    // Sempre DOIS placares, mesmo na mesa de 2: no truco não existe "cada um por si" com
    // três jogadores, então time é 0 ou 1 em qualquer mesa. É mais simples que o dominó, e
    // é o que faz `naMaoDeOnze` não precisar saber quantas cadeiras há.
    placar: [0, 0],
    maoNum: 0,
    abridor: 0,
    desistiu: null,
  };
  novaMaoDoTruco(P);
  return P;
}

function novaMaoDoTruco(P) {
  const { maos, monte } = distribuirCartas(P.n, CARTAS_POR_MAO);
  P.maos = maos;
  // A VIRA sai do monte, e é PÚBLICA — está virada na mesa para todo mundo. É a única carta
  // do baralho que aparece na `visaoDe` de todos sem ser jogada.
  P.vira = monte.pop();
  P.manilha = manilhaDaVira(P.vira);
  P.vazas = [];                       // as fechadas: [{ jogadas, vencedor, time }]
  P.mesa = [];                        // as cartas da vaza em curso
  P.aposta = 1;
  P.pedido = null;                    // { de, time, valor } enquanto alguém espera resposta
  // QUEM PEDIU POR ÚLTIMO NÃO ATRAVESSA A MÃO. `donoDaAposta` existe para impedir a mesma
  // dupla de subir a aposta duas vezes seguidas — "truco, seis" saindo da mesma boca —, e
  // isso vale DENTRO de uma mão. Sem esta linha ele sobrevivia ao embaralho: o time que
  // trucou na mão 3 e viu o outro aceitar ficava sem poder trucar na 4, na 5 e no resto da
  // partida, calado.
  //
  // Achado pela partida inteira jogada pela casa, e não pelo motor puro: nenhum caso escrito
  // à mão atravessa duas mãos, e é justamente atravessar que revela o campo que não zera.
  P.donoDaAposta = null;
  P.correu = null;
  P.resultado = null;
  P.maoNum++;
  P.vez = P.abridor;
  P.saiu = P.abridor;                 // quem abre a vaza em curso

  // A MÃO DE 11 É DECIDIDA ANTES DE QUALQUER CARTA, e por isso é uma fase própria: quem está
  // a um ponto do alvo vê as três cartas e escolhe. Se os DOIS times estão em 11, ninguém
  // escolhe nada — a mão vale 1 e joga-se normal, que é a regra da casa para não travar.
  const onzes = [0, 1].filter(t => naMaoDeOnze(P, t));
  if (onzes.length === 1) {
    P.fase = 'onze';
    P.decideOnze = onzes[0];
    P.vez = P.cadeiras.findIndex((_, c) => timeNoTruco(P, c) === onzes[0]);
  } else {
    P.fase = 'mao';
    P.decideOnze = null;
  }
  return P;
}

// O que esta cadeira pode fazer AGORA. Uma fonte só para três consumidores: acender os
// botões, alimentar o bot, e validar o que chega pela rede — igual ao dominó.
function acoesDoTruco(P, cadeira) {
  const nada = { cartas: [], trucar: null, aceitar: false, correr: false, onze: false };
  // A CADEIRA VEM DE FORA. No online ela é o número que o anfitrião atribuiu, mas o motor
  // também é chamado pelo bot, pela ponte das suítes e pelo `visaoDe` — e um índice fora da
  // faixa faz `P.maos[cadeira].slice()` LANÇAR, o que para a mesa de todo mundo.
  //
  // É a suspeita S2 da Fila 11 ("índice do fio usado sem checar limites"), que lá era
  // inofensiva porque ninguém a lia. Aqui ela é lida na primeira linha, e a mutação da saída
  // encontrou o buraco: com `vez` em `null`, a suíte inteira morria em vez de reprovar.
  if (!Number.isInteger(cadeira) || cadeira < 0 || cadeira >= P.n) return nada;
  if (P.fase === 'onze') {
    // Só quem decide a mão de 11 age, e as duas saídas são a decisão inteira.
    return timeNoTruco(P, cadeira) === P.decideOnze && P.vez === cadeira
      ? Object.assign({}, nada, { onze: true }) : nada;
  }
  if (P.fase !== 'mao' || P.vez !== cadeira) return nada;

  // COM PEDIDO NA MESA, o jogo PARA. Quem recebeu responde, e ninguém joga carta enquanto
  // isso — é o que separa a aposta de uma jogada comum, e é a razão de `pedido` existir em
  // vez de um simples `aposta` que sobe sozinho.
  if (P.pedido) {
    return Object.assign({}, nada, {
      aceitar: true,
      correr: true,
      // Aumentar é aceitar e subir de uma vez. `null` no topo da escada apaga o botão.
      trucar: proximaAposta(P.pedido.valor),
    });
  }

  return {
    cartas: P.maos[cadeira].slice(),
    // TRUCAR SÓ SE O OUTRO TIME NÃO PEDIU POR ÚLTIMO. Sem isto, a mesma dupla subiria a
    // aposta duas vezes seguidas e o adversário nunca responderia — o "truco, seis" saindo
    // da mesma boca.
    trucar: P.donoDaAposta === timeNoTruco(P, cadeira) ? null : proximaAposta(P.aposta),
    aceitar: false,
    correr: false,
    onze: false,
  };
}

// ─── a mão de 11 ─────────────────────────────────────────────────────────────
function decidirOnze(P, cadeira, jogar) {
  if (!acoesDoTruco(P, cadeira).onze) return { erro: 'não é sua a decisão da mão de 11' };
  if (jogar) {
    // Jogou: a mão vale 3 de saída, e ninguém pode trucar — já está trucada por definição.
    P.aposta = 3;
    P.donoDaAposta = null;
    P.fase = 'mao';
    P.decideOnze = null;
    P.vez = P.abridor;
    return { ok: true, jogou: true };
  }
  // Entregou: o OUTRO time marca 1 e a mão acaba sem carta nenhuma na mesa.
  const outro = P.decideOnze === 0 ? 1 : 0;
  return fecharMaoDoTruco(P, { motivo: 'entregou', time: outro, pontos: 1 });
}

// ─── jogar uma carta ─────────────────────────────────────────────────────────
function jogarCarta(P, cadeira, carta) {
  // A FORMA ANTES DO CONTEÚDO. `mesmaCarta` lê `b[0]`, e `undefined[0]` LANÇA — no online
  // isso é a mesa do anfitrião inteira parando por causa de uma mensagem torta de um
  // convidado. É o C3 da Fila 11, e ele apareceu aqui na primeira rodada do teste.
  //
  // A guarda mora no motor e não só no `jogadaDoFio` do registro porque o motor também é
  // chamado pelo bot e pela ponte das suítes, que entram por baixo da rede.
  if (!cartaValida(carta)) return { erro: 'carta inválida' };
  const { cartas } = acoesDoTruco(P, cadeira);
  if (!cartas.some(x => mesmaCarta(x, carta))) return { erro: 'carta inválida' };

  const i = P.maos[cadeira].findIndex(x => mesmaCarta(x, carta));
  P.maos[cadeira].splice(i, 1);
  P.mesa.push({ cadeira, carta });

  if (P.mesa.length < P.n) {
    P.vez = (cadeira + 1) % P.n;
    return { ok: true };
  }
  return fecharVaza(P);
}

function fecharVaza(P) {
  const vencedor = vencedorDaVaza(P.mesa, P.manilha, c => timeNoTruco(P, c));
  const time = vencedor === null ? null : timeNoTruco(P, vencedor);
  P.vazas.push({ jogadas: P.mesa, vencedor, time });
  P.mesa = [];

  const dono = donoDaMao(P.vazas.map(v => v.time));
  if (!dono.aberto) {
    return dono.morreu
      ? fecharMaoDoTruco(P, { motivo: 'melou', time: null, pontos: 0 })
      : fecharMaoDoTruco(P, { motivo: 'vazas', time: dono.time, pontos: P.aposta });
  }
  // A MÃO ACABOU SEM DECIDIR? Só acontece se as três vazas melarem, e `donoDaMao` já trata.
  // Este guarda existe para o dia em que alguém mexer na tabela e esquecer um ramo — sem
  // ele, o motor pediria uma quarta carta que não existe e a mesa pararia calada.
  if (P.vazas.length >= VAZAS_POR_MAO) {
    return fecharMaoDoTruco(P, { motivo: 'melou', time: null, pontos: 0 });
  }

  // QUEM MELOU NÃO PERDE A SAÍDA: se a vaza empatou, sai o mesmo de antes. É o que impede a
  // saída de andar sozinha pela mesa numa mão de três empates.
  P.saiu = vencedor === null ? P.saiu : vencedor;
  P.vez = P.saiu;
  return { ok: true };
}

// ─── a aposta ────────────────────────────────────────────────────────────────
function trucar(P, cadeira) {
  const a = acoesDoTruco(P, cadeira);
  if (!a.trucar) return { erro: 'não dá para aumentar agora' };
  const meu = timeNoTruco(P, cadeira);
  // Se já havia pedido, este é um AUMENTO: o valor sobe a partir do que estava pedido.
  P.pedido = { de: cadeira, time: meu, valor: a.trucar };
  // Responde o PRIMEIRO adversário a partir de quem pediu — na mesa de 2 é o outro; na de 4
  // é quem está à esquerda, que é quem a mesa olha.
  for (let k = 1; k <= P.n; k++) {
    const c = (cadeira + k) % P.n;
    if (timeNoTruco(P, c) !== meu) { P.vez = c; break; }
  }
  return { ok: true, valor: P.pedido.valor };
}

function aceitarTruco(P, cadeira) {
  if (!acoesDoTruco(P, cadeira).aceitar) return { erro: 'não há aposta para aceitar' };
  P.aposta = P.pedido.valor;
  // QUEM PEDIU FICA MARCADO, e é isso que impede o mesmo time de pedir de novo em seguida.
  P.donoDaAposta = P.pedido.time;
  P.pedido = null;
  // A vez VOLTA para quem estava jogando — e quem estava jogando é quem ainda não pôs carta
  // nesta vaza, a partir de quem saiu. Sem isto, aceitar um truco pularia a vez de alguém.
  P.vez = quemFalta(P);
  return { ok: true };
}

function correrDoTruco(P, cadeira) {
  if (!acoesDoTruco(P, cadeira).correr) return { erro: 'não há aposta para correr' };
  // CORREU: o outro time marca o valor que valia ANTES do pedido, não o pedido. Quem trucou
  // e viu o outro correr leva 1 (ou o que já estava aceito), e não 3 — é o preço de o
  // adversário desistir cedo.
  P.correu = timeNoTruco(P, cadeira);
  return fecharMaoDoTruco(P, { motivo: 'correu', time: P.pedido.time, pontos: P.aposta });
}

// Quem, na vaza em curso, ainda não jogou — na ordem a partir de quem saiu.
function quemFalta(P) {
  for (let k = 0; k < P.n; k++) {
    const c = (P.saiu + k) % P.n;
    if (!P.mesa.some(j => j.cadeira === c)) return c;
  }
  return P.saiu;
}

// ─── o fim da mão ────────────────────────────────────────────────────────────
function fecharMaoDoTruco(P, res) {
  if (res.time !== null && res.pontos) P.placar[res.time] += res.pontos;
  // Abre a próxima quem está à esquerda de quem abriu esta. A saída ANDA sempre, inclusive
  // quando a mão morre — senão uma mesa azarada ficaria com o mesmo abridor para sempre.
  P.abridor = (P.abridor + 1) % P.n;
  P.resultado = {
    motivo: res.motivo,
    time: res.time,
    pontos: res.pontos,
    aposta: P.aposta,
    vazas: P.vazas.map(v => v.time),
    vira: P.vira,
  };
  P.fase = P.placar.some(v => v >= P.regras.alvo) ? 'fim' : 'fimDeMao';
  return { ok: true, fim: P.resultado };
}

function abandonarOTruco(P, cadeira) {
  if (P.fase === 'fim') return { erro: 'a partida já acabou' };
  P.desistiu = cadeira;
  P.fase = 'fim';
  P.resultado = null;
  return { ok: true, fim: { motivo: 'abandono', desistiu: cadeira } };
}

// ─── o que esta cadeira pode ver ─────────────────────────────────────────────
// O INVARIANTE 3, no truco. É literalmente o que trafega no online, e a mão alheia não está
// aqui — só a CONTAGEM. A vira está, porque ela é pública por definição do jogo.
function visaoDoTruco(P, cadeira) {
  return {
    cadeira,
    mao: P.maos[cadeira],                              // só a sua
    naMao: P.maos.map(m => m.length),                  // dos outros, só quantas
    mesa: P.mesa,                                      // as cartas já jogadas nesta vaza
    vazas: P.vazas.map(v => ({ time: v.time, vencedor: v.vencedor, jogadas: v.jogadas })),
    vira: P.vira,
    manilha: P.manilha,
    aposta: P.aposta,
    pedido: P.pedido,
    vez: P.vez,
    saiu: P.saiu,
    fase: P.fase,
    placar: P.placar,
    resultado: P.resultado,
    maoNum: P.maoNum,
    duplas: P.duplas,
    alvo: P.regras.alvo,
    modo: P.regras.modo,
    decideOnze: P.decideOnze,
    correu: P.correu,
    desistiu: P.desistiu === undefined ? null : P.desistiu,
    cadeiras: P.cadeiras.map(c => ({ nome: c.nome, tipo: c.tipo })),
    acoes: acoesDoTruco(P, cadeira),
  };
}
