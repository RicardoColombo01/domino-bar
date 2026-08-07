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
  if (vista.vira) {
    alvos.set(CHAVE_DA_VIRA,
      { carta: vista.vira, x: 0, z: 0, rotY: VIRA_ROT, baixo: false, y: 0 });
  }

  // As cartas da vaza em curso, cada uma na direção de quem a jogou.
  for (const p of layoutDaVaza(vista.mesa || [], eu, n)) {
    alvos.set(chaveCarta(p.carta), { carta: p.carta, x: p.x, z: p.z, rotY: p.rotY, baixo: false, y: 0 });
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
    m.obj.position.x = chegarPerto(m.obj.position.x, m.xBase, 10, dt);
    m.obj.position.y = chegarPerto(m.obj.position.y, m.yBase + sobe, 14, dt);
    m.obj.position.z = chegarPerto(m.obj.position.z, m.zBase - sobe * 0.35, 14, dt);
    m.obj.rotation.x = chegarPerto(m.obj.rotation.x, m.tombo + sobe * 0.22, 14, dt);
    m.obj.rotation.y = chegarPerto(m.obj.rotation.y, m.giro, 14, dt);
    m.obj.scale.setScalar(chegarPerto(m.obj.scale.x, m.escalaBase, 14, dt));
  }
}
