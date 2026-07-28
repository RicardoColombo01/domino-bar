// A sua mão em leque, as mãos dos outros (só o verso) e o monte.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Quem está na sua frente depende de quem é "você": a cadeira mostrada vai sempre
// para a beirada de baixo da tela e as outras se distribuem em volta da mesa. É o que
// faz o hotseat funcionar — trocar de jogador é só trocar um número.

const grupoMao = new THREE.Group();
const grupoOutros = new THREE.Group();
const grupoMonte = new THREE.Group();
scene.add(grupoMao, grupoOutros, grupoMonte);

// O tombo é POSITIVO: rotação +X joga a normal da face para +Z, que é onde está a
// câmera. Com o sinal trocado a peça encara o fundo da mesa e você vê o verso dela.
// A conta: a câmera olha a mão de ~57° acima do horizonte, então 90° − 57° ≈ 0.58 rad.
const MAO_Z = 4.75, MAO_Y = 1.15, MAO_TOMBO = 0.58;
const LARGURA_MAO = 8.2;             // o quanto cabe na frente da câmera, em unidades
const FOLGA_LEQUE = 1.08;            // respiro entre uma peça e a seguinte
const naMao = [];                    // { obj, peca, xBase, jogavel, erguida }
let assinaturaMao = '';
let escolhida = null;                // índice da peça levantada, ou null

const anguloDaCadeira = (i, eu, n) => ((i - eu + n) % n) * Math.PI * 2 / n;

function sincronizarMao(vista) {
  const assinatura = vista.mao.map(chave).join(',') + '#' + vista.cadeira;
  if (assinatura !== assinaturaMao) {
    assinaturaMao = assinatura;
    escolhida = null;
    naMao.forEach(m => grupoMao.remove(m.obj));
    naMao.length = 0;
    // O ESPAÇO SAI DO COMPRIMENTO DA PEÇA, não de um número escolhido a olho. Com um
    // valor fixo menor que a peça, cada uma cobre a metade DIREITA da anterior — e como
    // a peça nasce com o valor [0] à esquerda e o [1] à direita, o que sumia era sempre
    // o segundo número. Dava para ler meia mão.
    //
    // Primeiro garante que não sobrepõe; só encolhe depois, se a mão for grande. O piso
    // de 0.72 é proposital: com 14 peças compradas é melhor sobrepor 26% da beirada do
    // que encolher tudo até as pintas sumirem.
    const n = Math.max(vista.mao.length, 1);
    const escala = Math.max(0.72, Math.min(1.3, LARGURA_MAO / (n * PECA_C * FOLGA_LEQUE)));
    const espaco = Math.min(PECA_C * escala * FOLGA_LEQUE, LARGURA_MAO / n);
    vista.mao.forEach((peca, i) => {
      const obj = criarPeca(peca, true);
      const x = (i - (vista.mao.length - 1) / 2) * espaco;
      obj.position.set(x, MAO_Y, MAO_Z + Math.abs(x) * 0.05);
      obj.rotation.set(MAO_TOMBO, 0, 0);
      obj.scale.setScalar(escala);
      // Peça na mão está NA SUA MÃO, não na mesa: se ela projetar sombra, vira um
      // borrão preto do tamanho de um tijolo no tampo logo atrás.
      obj.userData.corpo.castShadow = false;
      grupoMao.add(obj);
      naMao.push({ obj, peca, xBase: x, jogavel: false });
    });
  }

  // Quais dessas dá para jogar agora — vem da MESMA função que valida a jogada de
  // verdade (acoesDe), então a tela nunca acende uma peça que o motor recusaria.
  const jogaveis = new Map();
  for (const j of vista.acoes.jogadas) {
    const k = chave(j.peca);
    jogaveis.set(k, (jogaveis.get(k) || []).concat(j.ponta));
  }
  for (const m of naMao) {
    m.pontas = jogaveis.get(chave(m.peca)) || [];
    m.jogavel = m.pontas.length > 0;
    // Apagar a peça que não serve não pode custar a LEITURA dela: você ainda precisa
    // enxergar as pintas para planejar. Escurece de leve e tira o brilho, só isso.
    const mat = m.obj.userData.corpo.material;
    mat.color.setHex(m.jogavel ? CORES.marfim : 0xcdc3ae);
    mat.emissive.setHex(m.jogavel ? 0x33240a : 0x000000);
  }
  if (escolhida !== null && !naMao[escolhida]) escolhida = null;
}

// Some com a mão da tela ANTES de anunciar a troca de jogador no hotseat. Cobrir com
// um overlay não bastaria: as peças continuariam existindo na cena, a um F12 de
// distância. Aqui elas somem de verdade e só voltam depois do "peguei".
function esconderMao() {
  naMao.forEach(m => grupoMao.remove(m.obj));
  naMao.length = 0;
  assinaturaMao = '';
  cancelarEscolha();
}

function sincronizarOutros(vista) {
  grupoOutros.clear();
  const raio = MESA_R * 0.80;
  vista.naMao.forEach((quantas, i) => {
    if (i === vista.cadeira) return;
    const a = anguloDaCadeira(i, vista.cadeira, vista.naMao.length);
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * raio, PECA_E / 2, Math.cos(a) * raio);
    g.rotation.y = -a;
    // Cada peça atravessada na fileira, lado a lado. Enfileiradas no comprimento elas
    // se sobrepõem e o que aparece na mesa é uma tábua preta, não uma mão de dominó.
    const espaco = Math.min(0.56, 4.2 / Math.max(quantas, 1));
    for (let k = 0; k < quantas; k++) {
      const v = criarVerso();
      v.position.set((k - (quantas - 1) / 2) * espaco, 0, 0);
      v.rotation.y = Math.PI / 2;
      g.add(v);
    }
    grupoOutros.add(g);
  });
}

// O monte fica ao alcance da mão, na beirada esquerda: comprar é uma ação sua e o
// bolo precisa estar visível para o número no HUD significar alguma coisa. São duas
// pilhas empilhadas de verdade — espalhado no tampo ele ocuparia meia mesa.
function sincronizarMonte(vista) {
  grupoMonte.clear();
  for (let i = 0; i < vista.monte; i++) {
    const v = criarVerso();
    const pilha = Math.floor(i / 4);                              // quatro bolinhos de 4
    v.position.set(-4.98 + (pilha % 2) * 0.6, PECA_E / 2 + (i % 4) * PECA_E,
      2.15 + Math.floor(pilha / 2) * 1.12);
    v.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.06;   // nada de pilha de régua
    grupoMonte.add(v);
  }
}

function animarMao(dt, apontada) {
  naMao.forEach((m, i) => {
    const sobe = i === escolhida ? 0.42 : (i === apontada && m.jogavel ? 0.2 : 0);
    m.obj.position.y = chegarPerto(m.obj.position.y, MAO_Y + sobe, 14, dt);
    m.obj.position.z = chegarPerto(m.obj.position.z, MAO_Z + Math.abs(m.xBase) * 0.05 - sobe * 0.35, 14, dt);
    m.obj.rotation.x = chegarPerto(m.obj.rotation.x, MAO_TOMBO + sobe * 0.22, 14, dt);
  });
}
