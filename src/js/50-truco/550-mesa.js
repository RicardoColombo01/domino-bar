// A MESA DO TRUCO EM 3D: a vira, a vaza em curso, as vazas já ganhas e as mãos.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Mesma ideia que segura o tabuleiro do dominó, e ela é a razão de este arquivo ser curto:
// não existe "animar a jogada X". A cada mudança a mesa é RECONCILIADA com a vista — cria o
// que falta, tira o que sobra, e manda todo mundo deslizar para o lugar novo.
//
// E AQUI ISSO PAGA UM CASO QUE O DOMINÓ NUNCA TEVE. A linha do dominó só CRESCE; a mesa do
// truco esvazia três vezes por mão. Com a reconciliação, "a vaza acabou" não é um caso
// especial: as quatro cartas simplesmente ganham um alvo novo — a pilha do time que venceu —
// e vão deslizando para lá, virando de barriga para baixo no caminho. É exatamente o gesto
// da mesa de verdade, e não custou uma linha de animação.
//
// OS NOMES LEVAM SUFIXO porque `src/js` é um escopo só: `grupoMesa`, `naMesa`, `escolhida` e
// `assinaturaMao` já são do dominó, e o `build.mjs` reprova nome repetido dizendo os dois
// donos.

const grupoMesaDoTruco = new THREE.Group();
const grupoMaoDoTruco = new THREE.Group();
const grupoOutrosDoTruco = new THREE.Group();
const grupoPreviaDoTruco = new THREE.Group();
scene.add(grupoMesaDoTruco, grupoMaoDoTruco, grupoOutrosDoTruco);
grupoMesaDoTruco.add(grupoPreviaDoTruco);

// Onde o centro da mesa fica, em profundidade. Um pouco à frente do centro do tampo, como o
// tabuleiro do dominó — a mesa é vista de cima e de trás, e o miolo geométrico do tampo cai
// alto demais na tela.
const MESA_TRUCO_Z = 0.45;

// A ESCALA É CALCULADA, não escolhida. O `540-layout.js` é puro e trabalha em unidades de
// carta: a mesa inteira dá pouco mais de duas cartas de largura, que num tampo de 6.1 de raio
// seria um selo no meio da madeira. Aqui ela cresce até caber na TELA, com teto — a mesma
// distinção que o `LARGURA_MAO` do dominó registra: a largura visível é TETO, não alvo.
const ESCALA_TRUCO_MAX = 2.35;
let escalaDaMesaDoTruco = 1;
let escalaAlvoDoTruco = 1;

// chave da carta → { obj, alvo }. `alvo` traz posição, giro e se ela está virada para baixo.
const naMesaDoTruco = new Map();
const CHAVE_DA_VIRA = 'vira';

// ─── o toco do baralho, embaixo da vira ──────────────────────────────────────
// MOBÍLIA, e por isso NÃO entra em `naMesaDoTruco`: aquele mapa é de cartas reconciliadas
// por chave, e o toco não é carta nenhuma — é o resto do baralho, que ninguém joga. Montado
// UMA vez e guardado, porque ele nunca muda: reconstruí-lo a cada publicação seria churn
// puro, que é a mesma razão de a marca de "está ganhando" nascer na reconciliação.
//
// ELE ENTRA E SAI DO GRUPO em vez de ligar e desligar o `visible`, e a diferença é de
// medição: o `Box3.setFromObject` do `test-telas` percorre a árvore e engorda a caixa com o
// que encontra, visível ou não. Um toco escondido continuaria contando — e a mesa passaria a
// medir, na mão de 11, um baralho que não está lá.
//
// O TOCO FICA A 0° E A VIRA A 90°, atravessada em cima dele. Não é enfeite: é o que faz a
// cruz que se lê de relance como "baralho com a vira virada", e é o que separa as duas em
// tela sem precisar de legenda. Em x/z a cruz cabe em 0.44 do centro, contra os 1.126 de
// `caixaDaMesaDoTruco` — ou seja, o toco NÃO muda a caixa da mesa, e não há teto novo a
// conferir.
const tocoDoBaralho = new THREE.Group();
for (let k = 0; k < CARTAS_NO_TOCO; k++) {
  const v = criarVersoDeCarta();
  v.position.y = CARTA_E / 2 + k * CARTA_E;
  // Cada carta um tico torta, e o giro é DERIVADO do índice e não sorteado: `Math.random`
  // aqui rodaria na carga e deslocaria o embaralho semeado das suítes de tela — a armadilha
  // que a receita do `pintar()` e o `performance.now()` já pagaram. Um baralho perfeitamente
  // alinhado parece um bloco de madeira; este parece um baralho.
  v.rotation.y = ((k % 3) - 1) * 0.014;
  tocoDoBaralho.add(v);
}

// ─── a sua mão ───────────────────────────────────────────────────────────────
// Três cartas, e por isso não há leque em fileiras nem `porFileira`: o problema que aquilo
// resolve — catorze peças numa tela de 360px — não existe aqui.
const MAO_TRUCO_Z = 4.55, MAO_TRUCO_Y = 1.15, MAO_TRUCO_TOMBO = 0.58;
const FOLGA_DO_LEQUE_TRUCO = 1.14;
const ESCALA_MAO_TRUCO = 1.7;         // três cartas cabem grandes, e carta pequena não se lê
const naMaoDoTruco = [];              // { obj, carta, xBase, yBase, zBase, tombo, escalaBase }

let assinaturaDaMaoDoTruco = '';
let escolhidaNoTruco = null;          // CHAVE da carta levantada, ou null

// A arrumação fica no CLIENTE e nunca no motor, pelas três razões que o dominó já pagou:
// `visaoDoTruco` devolve a MESMA referência de `P.maos[cadeira]`, o convidado regenera a
// vista do JSON a cada publicação, e no hotseat dois humanos dividem o mesmo `P`.
const ordemDaMaoDoTruco = new Map();  // cadeira → [chave, chave, …]
let maoDaOrdemNoTruco = -1;

const naMaoDoTrucoPorChave = k => naMaoDoTruco.find(m => chaveCarta(m.carta) === k) || null;
const esquecerArrumacaoDoTruco = () => { ordemDaMaoDoTruco.clear(); maoDaOrdemNoTruco = -1; };

const larguraDaMaoDoTruco = () =>
  Math.max(2.4, Math.min(6.4, larguraVisivelEm(MAO_TRUCO_Y, MAO_TRUCO_Z) - 0.45));

function reconciliarMaoDoTruco(vista) {
  // Vista travada (a tela de passe do hotseat) chega com `mao: []` e ainda com a cadeira do
  // jogador ANTERIOR — gravar a ordem aqui apagaria a arrumação dele.
  if (!vista.mao.length) {
    naMaoDoTruco.forEach(m => grupoMaoDoTruco.remove(m.obj));
    naMaoDoTruco.length = 0;
    return;
  }
  const querem = new Set(vista.mao.map(chaveCarta));
  for (let i = naMaoDoTruco.length - 1; i >= 0; i--) {
    if (!querem.has(chaveCarta(naMaoDoTruco[i].carta))) {
      grupoMaoDoTruco.remove(naMaoDoTruco[i].obj);
      naMaoDoTruco.splice(i, 1);
    }
  }
  const tem = new Set(naMaoDoTruco.map(m => chaveCarta(m.carta)));
  for (const carta of vista.mao) {
    if (tem.has(chaveCarta(carta))) continue;
    const obj = criarCarta(carta, true);
    // Carta na mão está NA SUA MÃO: se projetar sombra, vira um borrão no tampo atrás.
    obj.userData.corpo.castShadow = false;
    grupoMaoDoTruco.add(obj);
    naMaoDoTruco.push({ obj, carta, nova: true, jogavel: false,
      xBase: 0, yBase: MAO_TRUCO_Y, zBase: MAO_TRUCO_Z, tombo: MAO_TRUCO_TOMBO, escalaBase: 1 });
  }

  const guardada = ordemDaMaoDoTruco.get(vista.cadeira);
  if (guardada) {
    const pos = new Map(guardada.map((k, i) => [k, i]));
    const posto = naMaoDoTruco.map((m, i) =>
      [m, pos.has(chaveCarta(m.carta)) ? pos.get(chaveCarta(m.carta)) : Infinity, i]);
    posto.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    posto.forEach((par, i) => { naMaoDoTruco[i] = par[0]; });
  }
  ordemDaMaoDoTruco.set(vista.cadeira, naMaoDoTruco.map(m => chaveCarta(m.carta)));
}

// Onde cada carta descansa. SÓ geometria, e lê a ordem atual de `naMaoDoTruco`.
function posicionarMaoDoTruco() {
  const n = Math.max(naMaoDoTruco.length, 1);
  const largura = larguraDaMaoDoTruco();
  // O espaço sai da LARGURA DA CARTA, não de um número escolhido a olho — é a mesma
  // armadilha que o dominó pagou: um valor fixo menor que a peça faz cada uma cobrir a
  // anterior, e o que some é sempre a beirada de quem está à direita.
  const escala = Math.max(0.9, Math.min(ESCALA_MAO_TRUCO,
    largura / (n * CARTA_L * FOLGA_DO_LEQUE_TRUCO)));
  const espaco = Math.min(CARTA_L * escala * FOLGA_DO_LEQUE_TRUCO, largura / n);

  naMaoDoTruco.forEach((m, i) => {
    m.xBase = (i - (n - 1) / 2) * espaco;
    m.yBase = MAO_TRUCO_Y;
    // As das pontas recuam um tico: é o leque de quem segura três cartas em arco, e é o que
    // impede as bordas de encostarem quando a tela aperta o espaçamento.
    m.zBase = MAO_TRUCO_Z + Math.abs(m.xBase) * 0.06;
    m.giro = -m.xBase * 0.10;
    m.tombo = MAO_TRUCO_TOMBO;
    m.escalaBase = escala;
    if (m.nova) {
      m.obj.position.set(m.xBase, m.yBase, m.zBase);
      m.obj.rotation.set(m.tombo, m.giro, 0);
      m.obj.scale.setScalar(escala);
      m.nova = false;
    }
  });

  luzDaMao.position.set(0, MAO_TRUCO_Y + 1.55, MAO_TRUCO_Z + 2.05);
}

// Arrumar por FORÇA, da mais fraca para a mais forte, com a manilha no fim. É o que jogador
// de truco faz sem pensar, e é determinístico: apertar duas vezes não muda nada.
function arrumarMaoDoTruco() {
  if (naMaoDoTruco.length < 2) return;
  const manilha = vistaAtual ? vistaAtual.manilha : null;
  naMaoDoTruco.sort((a, b) =>
    forcaDaCarta(a.carta, manilha) - forcaDaCarta(b.carta, manilha));
  if (vistaAtual) ordemDaMaoDoTruco.set(vistaAtual.cadeira, naMaoDoTruco.map(m => chaveCarta(m.carta)));
  posicionarMaoDoTruco();
}

function sincronizarMaoDoTruco(vista) {
  // A assinatura é de CONJUNTO (chaves ordenadas) mais a largura, e nunca da ordem: sensível
  // à ordem, ela entraria em laço com a arrumação — reordena, reconstrói, perde a seleção.
  const assinatura = vista.mao.map(chaveCarta).sort().join(',') + '#' + vista.cadeira +
    '#' + larguraDaMaoDoTruco().toFixed(2);
  // Mão nova apaga a arrumação: as cartas são outras, e a de antes não quer dizer nada.
  if (vista.maoNum !== maoDaOrdemNoTruco) { esquecerArrumacaoDoTruco(); maoDaOrdemNoTruco = vista.maoNum; }
  if (assinatura !== assinaturaDaMaoDoTruco) {
    assinaturaDaMaoDoTruco = assinatura;
    reconciliarMaoDoTruco(vista);
    posicionarMaoDoTruco();
  }

  // Quais dá para jogar agora vem da MESMA função que valida a jogada de verdade
  // (`acoesDoTruco`), então a tela nunca acende uma carta que o motor recusaria.
  const podem = new Set((vista.acoes.cartas || []).map(chaveCarta));
  for (const m of naMaoDoTruco) {
    m.jogavel = podem.has(chaveCarta(m.carta));
    // Apagar a carta que não serve não pode custar a LEITURA dela: você ainda precisa ver o
    // naipe para planejar a mão. Escurece de leve e tira o brilho, só isso.
    const mat = m.obj.userData.corpo.material;
    mat.color.setHex(m.jogavel ? 0xf6f1e4 : 0xcfc7b6);
    mat.emissive.setHex(m.jogavel ? 0x2a1f08 : 0x000000);

    // A MANILHA GANHA ANEL, e ele é PENDURADO AQUI e não na animação — mesma razão que a
    // marca de "está ganhando" registra: quem é manilha só muda quando a mão muda, e a
    // animação roda sessenta vezes por segundo. Criar e destruir um Mesh por quadro é churn
    // puro.
    //
    // A PERGUNTA É DA REGRA (`ehManilha`, em 510-regras.js), e ela é a MESMA que decide quem
    // ganha a vaza. Comparar aqui por conta própria daria duas respostas para a mesma
    // pergunta — e a tela realçando uma carta que o motor não considera manilha é pior que
    // realce nenhum: seria o jogo mentindo com confiança.
    //
    // SÓ A SUA MÃO, e isto é o invariante 3 e não zelo: `grupoOutrosDoTruco` é verso, e um
    // anel ali contaria ao adversário que ele tem manilha. Vazamento por decoração é
    // vazamento igual — e por isso há asserção cobrando que ninguém lá ganhe marca.
    m.manilha = ehManilha(m.carta, vista.manilha);
    if (m.manilha && !m.marca) {
      m.marca = new THREE.Mesh(geomManilhaNoTruco, matManilhaNoTruco);
      // O `-PI/2` é o mesmo da marca da mesa e deita o anel no plano da CARTA, não no do
      // mundo: como ele é FILHO do objeto dela, herda o tombo do leque e continua paralelo à
      // face por mais que a mão se incline. Pendurar no `grupoMaoDoTruco` em vez de na carta
      // deixaria o anel deitado no chão enquanto a carta está de pé para você.
      m.marca.rotation.x = -Math.PI / 2;
      // Atrás da carta, e o anel INTEIRO sobra pelas bordas: o raio interno é a meia-diagonal
      // (0.538), que é a distância do centro ao CANTO — ou seja, ele começa exatamente onde a
      // carta acaba. É a mesma conta que faz o anel de "está ganhando" aparecer nos cantos em
      // vez de só nas laterais, e aqui ela também garante que não há z-fighting com a face.
      m.marca.position.y = -CARTA_E / 2 - 0.004;
      m.obj.add(m.marca);
    } else if (!m.manilha && m.marca) {
      m.obj.remove(m.marca);
      m.marca = null;
    }
  }
  if (escolhidaNoTruco !== null && !naMaoDoTrucoPorChave(escolhidaNoTruco)) escolhidaNoTruco = null;
}

// Some com a mão da tela ANTES de anunciar a troca de jogador no hotseat. Cobrir com um
// overlay não bastaria: as cartas continuariam na cena, a um F12 de distância.
function esconderMaoDoTruco() {
  encerrarGestoNoTruco();
  naMaoDoTruco.forEach(m => grupoMaoDoTruco.remove(m.obj));
  naMaoDoTruco.length = 0;
  assinaturaDaMaoDoTruco = '';
  cancelarEscolhaNoTruco();
}

const redesenharMaoDoTruco = () => {
  if (vistaAtual && vistaAtual.mao) sincronizarMaoDoTruco(vistaAtual);
};

// ─── as mãos dos outros ──────────────────────────────────────────────────────
// Onde eles sentam e quanto a fileira mede sai inteiro de `assentosDaMesa()` (070-cena.js),
// que é da casa — aqui só se monta o que ele decidiu.
function sincronizarOutrosNoTruco(vista) {
  grupoOutrosDoTruco.clear();
  for (const l of assentosDaMesa(vista).lugares) {
    const g = new THREE.Group();
    g.position.set(l.x, CARTA_E / 2, l.z);
    g.rotation.y = -l.a;
    for (let k = 0; k < l.quantas; k++) {
      const v = criarVersoDeCarta();
      v.position.set((k - (l.quantas - 1) / 2) * l.espaco, 0, 0);
      g.add(v);
    }
    grupoOutrosDoTruco.add(g);
  }
}

// A caixa que a fileira daquele assento ocupa — o encaixe que o `assentosDaMesa` da casa
// pede. Com a carta as duas medidas trocam de papel em relação ao dominó: ela é mais larga
// que comprida na direção em que se enfileira.
function caixaDoAssentoDoTruco(a, x, z, quantas, espaco) {
  const aoLongo = (CARTA_L + espaco * Math.max(0, quantas - 1)) / 2;
  const atravessado = CARTA_C / 2;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { x, z, l: 2 * (c * aoLongo + s * atravessado), a: 2 * (s * aoLongo + c * atravessado) };
}

// ─── quanto a mesa pode crescer sem invadir os assentos ──────────────────────
// A FILA 7 DE NOVO, com outro jogo. Lá o tabuleiro do dominó e a mão do vizinho mediam a
// mesma tela em profundidades diferentes, com divisores mágicos diferentes — cada caixa
// cabia sozinha e nenhuma perguntava pela outra. O truco nasceu com o mesmo buraco: a escala
// tinha DOIS tetos (o máximo e a tela) e o dominó tem TRÊS.
//
// Achado pela cena `truco duplas` do `test-telas`, na primeira vez que ela rodou: numa mesa
// de 4 a mesa cresce até bater na largura da tela e monta em cima do vizinho — folga −0,36
// em 360×640 e −0,45 em 390×844. Nenhum olho tinha visto porque nenhuma foto existia.
//
// A CONTA É DE SEPARAÇÃO DE CAIXAS, e duas caixas estão separadas se estiverem separadas em
// **um** dos eixos — não nos dois. Por isso cada assento devolve o MAIOR entre a folga em x e
// a folga em z: o vizinho de lado é resolvido afastando em x, e o de frente, em z. Tomar o
// menor apertaria a mesa até sumir por um eixo que já estava resolvido pelo outro.
//
// O PISO É 1, como no dominó ("nunca abaixo de uma peça"): um corredor impossível encolheria
// a mesa até virar um selo no meio da madeira, e mesa invisível é pior que mesa encostada. Se
// um dia o piso morder, o sintoma volta a aparecer nesta mesma cena — e aí o conserto é mexer
// no RAIO DO ASSENTO, não em espremer mais a mesa.
// O NÚMERO É MEDIDO, e a diferença entre o que se pede e o que se obtém é o ponto: pedindo
// 0,22 a suíte mediu 0,13. As duas caixas desta conta são ANALÍTICAS (meia-caixa em unidades
// de carta) e a que o `test-telas` mede é a de verdade, montada com `Box3.setFromObject` sobre
// as cartas na cena — a pilha de vazas desloca cada carta em `CARTA_E * 0.6`, e a fileira do
// assento é medida com a rotação real. A analítica fica ~0,09 otimista.
//
// Então este número não é "a folga que eu quero": é a folga que eu quero MAIS o que a conta
// erra. Está aqui com o valor conferido rodando, e quem mexer nele confere do mesmo jeito —
// `node tests/test-telas.mjs 360x640 duplas` imprime a folga medida em toda rodada, verde
// inclusive, exatamente para que ela não encolha em silêncio.
const FOLGA_DO_VIZINHO_NO_TRUCO = 0.42;
function escalaQueCabeEntreOsAssentos(vista, caixa) {
  let teto = Infinity;
  for (const l of assentosDaMesa(vista).lugares) {
    const b = l.caixa;
    // Quanto a meia-caixa da mesa pode medir antes de encostar, por eixo.
    const emX = (Math.abs(b.x) - b.l / 2 - FOLGA_DO_VIZINHO_NO_TRUCO) / caixa.x;
    // Em z a mesa não é centrada na origem: ela mora em `MESA_TRUCO_Z`, e o assento pode
    // estar à frente ou atrás dela. `Math.abs` da distância entre os centros resolve os dois
    // lados sem um `if` que alguém esqueceria de espelhar.
    const emZ = (Math.abs(b.z - MESA_TRUCO_Z) - b.a / 2 - FOLGA_DO_VIZINHO_NO_TRUCO) / caixa.z;
    teto = Math.min(teto, Math.max(emX, emZ));
  }
  return teto;
}

// ─── a mesa: a vira, a vaza em curso e as vazas ganhas ───────────────────────
// UMA SÓ RECONCILIAÇÃO para as três coisas, e é o que faz a carta recolhida DESLIZAR da mesa
// para a pilha em vez de sumir e reaparecer.
function sincronizarMesaDoTruco(vista) {
  const n = vista.naMao.length;
  const eu = vista.cadeira;
  const alvos = new Map();

  // A VIRA. Ela é a única carta pública do baralho e é o que diz qual é a manilha — sem ela
  // desenhada, o jogador não tem como saber, e o jogo fica ilegível.
  //
  // EM CIMA DO TOCO (`ALTURA_DA_VIRA`), e o porquê está medido em `540-layout.js`: no tampo
  // ela dividia o plano com as cartas jogadas, que a cobrem em 0.064 × 0.62. O toco entra e
  // sai COM ela — a mão de 11 não tem vira, e um baralho sozinho no meio da mesa seria
  // mobília prometendo uma carta que não existe.
  if (vista.vira) {
    alvos.set(CHAVE_DA_VIRA,
      { carta: vista.vira, x: 0, z: 0, rotY: VIRA_ROT, baixo: false, y: ALTURA_DA_VIRA });
    if (!tocoDoBaralho.parent) grupoMesaDoTruco.add(tocoDoBaralho);
  } else if (tocoDoBaralho.parent) {
    grupoMesaDoTruco.remove(tocoDoBaralho);
  }

  // As cartas da vaza em curso, cada uma na direção de quem a jogou.
  //
  // A QUE ESTÁ GANHANDO leva marca e sobe um pouco. Quem responde é a VISÃO
  // (`ganhandoAVaza`, em 520-partida.js) e não uma conta aqui: é pergunta de regra, e a tela
  // do convidado não tem `P` para respondê-la. A marca acompanha a reconciliação como todo o
  // resto — cada carta que cai pode roubar a liderança, e aí ela muda de dona sozinha.
  const mandaAgora = (vista.mesa || []).length && vista.ganhandoAVaza !== null
    && vista.ganhandoAVaza !== undefined
    ? (vista.mesa.find(j => j.cadeira === vista.ganhandoAVaza) || {}).carta : null;
  for (const p of layoutDaVaza(vista.mesa || [], eu, n)) {
    const ganhando = !!mandaAgora && mesmaCarta(p.carta, mandaAgora);
    alvos.set(chaveCarta(p.carta), {
      carta: p.carta, x: p.x, z: p.z, rotY: p.rotY, baixo: false,
      y: ganhando ? ALTURA_GANHANDO : 0, ganhando,
    });
  }

  // As vazas já ganhas, empilhadas de lado e viradas para baixo. Sem elas visíveis o jogador
  // tem de LEMBRAR quem ganhou o quê — e a conta das vazas é a informação mais importante da
  // mesa depois da própria mão.
  const postas = layoutDasVazas(vista.vazas || [], eu, n);
  (vista.vazas || []).forEach((v, i) => {
    const p = postas[i];
    (v.jogadas || []).forEach((j, k) => {
      alvos.set(chaveCarta(j.carta), {
        carta: j.carta,
        x: p.x + k * CARTA_E * 0.6, z: p.z, rotY: p.rotY + (p.inclinada ? 0.22 : 0),
        y: p.y + k * CARTA_E, baixo: true,
      });
    });
  });

  for (const [k, alvo] of alvos) {
    let reg = naMesaDoTruco.get(k);
    if (!reg) {
      const obj = criarCarta(alvo.carta, false);
      // Nasce no alto e torta: é a queda que dá o "toc" na mesa.
      obj.position.set(alvo.x, 2.0, alvo.z);
      obj.rotation.set(0, alvo.rotY + 0.4, 0);
      grupoMesaDoTruco.add(obj);
      reg = { obj };
      naMesaDoTruco.set(k, reg);
      tocarBaque(0.5);
    }
    reg.alvo = alvo;

    // A MARCA É PENDURADA E TIRADA AQUI, e não na animação: quem ganha a vaza só muda quando
    // a vista muda, e a animação roda sessenta vezes por segundo. Criar e destruir um Mesh a
    // cada quadro seria churn puro — a mesma razão que fez o `assinaturaMao` do dominó
    // existir. É irmã do `marcarUltima` do tabuleiro, com uma diferença: lá a marca é do
    // PASSADO (a última peça caiu ali) e some sozinha; aqui ela é do PRESENTE e tem de
    // acompanhar a liderança, então a reconciliação manda nela como manda na posição.
    if (alvo.ganhando && !reg.marca) {
      reg.marca = new THREE.Mesh(geomGanhandoNoTruco, matGanhandoNoTruco);
      reg.marca.rotation.x = -Math.PI / 2;
      reg.marca.position.y = -CARTA_E / 2 - 0.004;      // colada no tampo, por baixo da carta
      reg.obj.add(reg.marca);
    } else if (!alvo.ganhando && reg.marca) {
      reg.obj.remove(reg.marca);
      reg.marca = null;
    }
  }

  for (const [k, reg] of naMesaDoTruco) {
    if (alvos.has(k)) continue;
    grupoMesaDoTruco.remove(reg.obj);
    naMesaDoTruco.delete(k);
  }

  // A escala que faz a mesa caber na tela. `caixaDaMesaDoTruco` é puro e devolve meia-caixa
  // em unidades de carta; aqui ela vira pixels através de `larguraVisivelEm`, que é quem tem
  // a palavra final sobre o que cabe no QUADRO — a lição do monte, cobrada de novo.
  const caixa = caixaDaMesaDoTruco(n);
  escalaAlvoDoTruco = Math.max(1, Math.min(
    ESCALA_TRUCO_MAX,
    larguraVisivelEm(0, MESA_TRUCO_Z) * 0.86 / (2 * caixa.x),
    // O TERCEIRO TETO: o que cabe entre os ASSENTOS. Ele faltava, e é a Fila 7 se repetindo
    // com outro jogo — ver `escalaQueCabeEntreOsAssentos`.
    escalaQueCabeEntreOsAssentos(vista, caixa)));

  esconderPreviaDoTruco();
}

function sincronizarTrucoNaMesa(vista) {
  sincronizarMesaDoTruco(vista);
  sincronizarMaoDoTruco(vista);
  sincronizarOutrosNoTruco(vista);
}

// ─── a prévia ────────────────────────────────────────────────────────────────
// Onde a carta vai cair, sem uma linha de geometria nova: a posta sai da MESMA função que vai
// posicioná-la de verdade. É o mesmo desenho da prévia do dominó, e mais simples, porque no
// truco não há dois lados para escolher.
const matBrilhoDoTruco = new THREE.MeshBasicMaterial({
  color: 0xffc451, transparent: true, opacity: 0.5,
});
const geomBrilhoDoTruco = new THREE.CircleGeometry(CARTA_C * 0.62, 28);

// ─── a marca de QUEM ESTÁ GANHANDO A VAZA ────────────────────────────────────
// Pedido do Ricardo em 07/08/2026, jogando: sem saber quem está por cima não há parâmetro
// para decidir se vale gastar uma carta forte. A frase equivalente está na linha da vez
// (`notaDaVezNoTruco`, em 575-encaixes.js); esta é a resposta para quem está OLHANDO a mesa,
// que é onde os olhos estão na hora de escolher.
//
// UM ANEL e não um disco, porque um disco por baixo de uma carta não aparece — a carta o
// cobre inteiro. O anel sobra pelas bordas.
//
// E A CARTA SOBE JUNTO (`ALTURA_GANHANDO`), o que não é redundância: cor sozinha não é
// informação acessível, e o realce tem de sobreviver a quem não distingue verde de âmbar e
// a uma foto em preto e branco. É a mesma disciplina do `--fraco` da Fila 8, num meio
// diferente — a altura é a redundância não-cromática.
//
// NÃO PULSA, de propósito. O brilho da prévia acima oscila para sempre enquanto está na
// tela, e um segundo oscilador permanente na mesma cena é exatamente o que o
// `prefers-reduced-motion` da Fila 9 saiu tirando (a lâmpada era "o único movimento que não
// acaba nunca"). Esta marca fica parada: ela informa, não chama.
const matGanhandoNoTruco = new THREE.MeshBasicMaterial({
  color: 0x7fd18a, transparent: true, opacity: 0.62,
});
// O RAIO INTERNO SAI DA MEIA-DIAGONAL DA CARTA, e não de um número escolhido a olho:
// `hypot(CARTA_L, CARTA_C) / 2` é 0.538, o ponto mais distante do centro que a carta ocupa.
// Um anel mais estreito que isso fica escondido nos CANTOS e aparece só nas laterais — meia
// marca, que a olho lê como defeito de desenho. Começando na diagonal ele aparece inteiro.
//
// E o externo cabe: as cartas da vaza ficam a `RAIO_DA_VAZA` (0.686) do centro, então numa
// mesa de 4 os vizinhos estão a 0.97 um do outro. O anel vai a 0.65 do centro DA CARTA, e
// como ele não entra na caixa medida (`criarCarta` expõe `userData.corpo`, e é só o corpo
// que o `test-telas` mede) ele também não infla a mesa — é a mesma isenção que a marca da
// última jogada do dominó tem, e ali ela custou 0.22 de caixa até alguém notar.
const RAIO_GANHANDO = Math.hypot(CARTA_L, CARTA_C) / 2;
const geomGanhandoNoTruco = new THREE.RingGeometry(RAIO_GANHANDO, RAIO_GANHANDO * 1.21, 30);
const ALTURA_GANHANDO = 0.085;

// ─── a marca de MANILHA, na SUA mão ──────────────────────────────────────────
// O painel do `#topo` diz `MANILHA 6` e o jogador olha as três cartas para descobrir quais
// são 6. O comentário do `575-encaixes.js` já dizia a razão sem perceber: "quem não joga
// truco todo dia não sabe derivar a manilha da vira". O jogo SABE — `vista.manilha` viaja na
// visão desde a v4.3 — e a tela não mostrava.
//
// O CANAL TEM DE SER PRÓPRIO, e isto não é gosto: `mat.color`/`mat.emissive` já carregam
// jogável × não-jogável (ver `sincronizarMaoDoTruco`), e no truco, NA SUA VEZ, todas as
// cartas são jogáveis — então mais brilho não distinguiria nada dentro da mão. É a diferença
// entre este realce e o do dominó, onde acender a peça jogável já separa.
//
// O DESENHO É O DA MARCA DE "ESTÁ GANHANDO", de propósito: anel MAIS altura. A altura é a
// redundância não-cromática, pelo motivo escrito lá em cima — cor sozinha não é informação
// acessível, e o realce tem de sobreviver a quem não distingue âmbar de verde.
//
// A COR É A DO PAINEL (`--ambar`, #f0c274, que é a cor de todo `.dado b` do HUD) e não o
// verde de "está ganhando". As duas marcas nunca dividem a mesma carta — uma vive na mesa e a
// outra na sua mão —, mas duas coisas diferentes não podem ter a mesma cor, e aqui a cor
// AMARRA: o número no painel e o anel na carta são a mesma informação, dita duas vezes.
//
// O ANEL É MAIS ESTREITO que o de ganhando (1.16 contra 1.21) porque as cartas da mão ficam
// lado a lado com `FOLGA_DO_LEQUE_TRUCO` de sobra: um anel largo demais encosta na vizinha e
// vira borrão. Na mesa elas estão a 0.97 uma da outra e há espaço.
const matManilhaNoTruco = new THREE.MeshBasicMaterial({
  color: 0xf0c274, transparent: true, opacity: 0.7,
});
const geomManilhaNoTruco = new THREE.RingGeometry(RAIO_GANHANDO, RAIO_GANHANDO * 1.16, 30);
const ALTURA_MANILHA = 0.11;

function mostrarPreviaDoTruco(vista) {
  esconderPreviaDoTruco();
  const m = escolhidaNoTruco === null ? null : naMaoDoTrucoPorChave(escolhidaNoTruco);
  if (!m) return;
  const p = postaDaVaza(vista.cadeira, vista.cadeira, vista.naMao.length);
  const g = new THREE.Group();
  const brilho = new THREE.Mesh(geomBrilhoDoTruco, matBrilhoDoTruco);
  brilho.rotation.x = -Math.PI / 2;
  brilho.position.y = 0.014;
  const fantasma = criarFantasmaDeCarta(m.carta);
  fantasma.rotation.y = p.rotY;
  g.add(brilho, fantasma);
  g.position.set(p.x, 0, p.z);
  g.userData.confirma = true;
  grupoPreviaDoTruco.add(g);
}

const esconderPreviaDoTruco = () => grupoPreviaDoTruco.clear();
const temPreviaDoTruco = () => grupoPreviaDoTruco.children.length > 0;

// ─── a animação ──────────────────────────────────────────────────────────────
function animarTrucoNaMesa(dt, apontadaAgora) {
  escalaDaMesaDoTruco = chegarPerto(escalaDaMesaDoTruco, escalaAlvoDoTruco, 8, dt);
  grupoMesaDoTruco.scale.setScalar(escalaDaMesaDoTruco);
  grupoMesaDoTruco.position.z = MESA_TRUCO_Z;

  const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 300);
  matBrilhoDoTruco.opacity = 0.3 + 0.34 * pulso;
  for (const g of grupoPreviaDoTruco.children) g.children[1].position.y = 0.07 + 0.035 * pulso;

  for (const { obj, alvo } of naMesaDoTruco.values()) {
    obj.position.x = chegarPerto(obj.position.x, alvo.x, 13, dt);
    obj.position.z = chegarPerto(obj.position.z, alvo.z, 13, dt);
    obj.position.y = chegarPerto(obj.position.y, alvo.y + CARTA_E / 2, 15, dt);
    // A VIRADA é uma rotação em Z de 180°, e ela é animada como tudo o mais: é o gesto de
    // recolher a vaza. Sem o verso no `criarCarta` o que apareceria do outro lado seria o
    // creme liso do corpo.
    obj.rotation.z = chegarPerto(obj.rotation.z, alvo.baixo ? Math.PI : 0, 9, dt);
    // Gira pelo caminho mais curto, senão uma carta faz 350° em vez de -10°.
    let d = alvo.rotY - obj.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    obj.rotation.y = chegarPerto(obj.rotation.y, obj.rotation.y + d, 13, dt);
  }

  const sobEssa = apontadaAgora === null || apontadaAgora === undefined
    ? null : naMaoDoTruco[apontadaAgora];
  for (const m of naMaoDoTruco) {
    const sobe = chaveCarta(m.carta) === escolhidaNoTruco ? 0.42
      : (m === sobEssa && m.jogavel ? 0.2 : 0);
    // A MANILHA FICA UM DEGRAU ACIMA DAS OUTRAS, e o termo é separado do `sobe` de propósito:
    // aquele é GESTO (o ponteiro em cima, a carta escolhida) e alimenta também o z, o tombo e
    // a escala; este é ESTADO da mão, e mexer no tombo por causa dele faria a carta parecer
    // levantada pelo dedo de ninguém. Somam-se: uma manilha apontada sobe as duas coisas, que
    // é o certo — as duas informações continuam legíveis juntas.
    const realce = m.manilha ? ALTURA_MANILHA : 0;
    m.obj.position.x = chegarPerto(m.obj.position.x, m.xBase, 10, dt);
    m.obj.position.y = chegarPerto(m.obj.position.y, m.yBase + realce + sobe, 14, dt);
    m.obj.position.z = chegarPerto(m.obj.position.z, m.zBase - sobe * 0.35, 14, dt);
    m.obj.rotation.x = chegarPerto(m.obj.rotation.x, m.tombo + sobe * 0.22, 14, dt);
    m.obj.rotation.y = chegarPerto(m.obj.rotation.y, m.giro, 14, dt);
    m.obj.scale.setScalar(chegarPerto(m.obj.scale.x, m.escalaBase, 14, dt));
  }
}
