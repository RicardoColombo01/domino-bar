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
const naMao = [];                    // { obj, peca, xBase, yBase, zBase, jogavel, erguida }

// Quantas peças cabem numa fileira sem passar do piso de escala. Acima disso a mão vai
// para DUAS fileiras em vez de continuar encolhendo: com 14 peças (o Duelo inteiro,
// não mais o caso raro de quem comprou muito) uma fileira só sobrepõe quase um quinto
// de cada peça, e o que some é sempre a beirada direita — ou seja, o segundo número.
const ESCALA_MIN = 0.72;
const porFileira = n => (n <= Math.floor(LARGURA_MAO / (PECA_C * ESCALA_MIN * FOLGA_LEQUE))
  ? n : Math.ceil(n / 2));
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
    // Primeiro garante que não sobrepõe; só encolhe depois, se a mão for grande. E
    // quando nem encolhendo cabe, a mão quebra em duas fileiras em vez de virar tira.
    const n = Math.max(vista.mao.length, 1);
    const cabem = porFileira(n);
    const escala = Math.max(ESCALA_MIN, Math.min(1.3, LARGURA_MAO / (cabem * PECA_C * FOLGA_LEQUE)));
    const espaco = Math.min(PECA_C * escala * FOLGA_LEQUE, LARGURA_MAO / cabem);

    vista.mao.forEach((peca, i) => {
      const fila = Math.floor(i / cabem);
      const nesta = Math.min(cabem, n - fila * cabem);      // a de cima pode ser menor
      const obj = criarPeca(peca, true);
      // A fileira de trás sobe, recua e tomba um pouco mais. Com a mesma altura e o
      // mesmo tombo ela ficaria escondida atrás da da frente — a ideia é o leque de
      // quem segura as peças em duas camadas, não duas linhas na mesma altura.
      const x = ((i % cabem) - (nesta - 1) / 2) * espaco;
      const y = MAO_Y + fila * 0.34 * escala;
      const z = MAO_Z - fila * 0.66 * escala + Math.abs(x) * 0.05;
      const tombo = MAO_TOMBO + fila * 0.13;
      obj.position.set(x, y, z);
      obj.rotation.set(tombo, 0, 0);
      obj.scale.setScalar(escala);
      // Peça na mão está NA SUA MÃO, não na mesa: se ela projetar sombra, vira um
      // borrão preto do tamanho de um tijolo no tampo logo atrás.
      obj.userData.corpo.castShadow = false;
      grupoMao.add(obj);
      naMao.push({ obj, peca, xBase: x, yBase: y, zBase: z, tombo, jogavel: false });
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
    // O repouso sai do que sincronizarMao calculou para ESTA peça (a fileira de trás
    // mora mais alta e mais ao fundo), e não de MAO_Y/MAO_Z direto.
    m.obj.position.y = chegarPerto(m.obj.position.y, m.yBase + sobe, 14, dt);
    m.obj.position.z = chegarPerto(m.obj.position.z, m.zBase - sobe * 0.35, 14, dt);
    m.obj.rotation.x = chegarPerto(m.obj.rotation.x, m.tombo + sobe * 0.22, 14, dt);
  });
}
