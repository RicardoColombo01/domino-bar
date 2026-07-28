// A peça em 3D: um corpo de marfim e duas meias-faces com as pintas.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// As 28 peças saem de UMA textura só. Em vez de desenhar 28 combinações, o atlas tem
// as sete meias-faces (0 a 6) lado a lado, e cada metade da peça é um plano cuja UV
// aponta para a célula certa — sete geometrias em cache dão conta das 28 peças.
//
//   atlas ▸ │ ·  │ ·· │ ⁚  │ ⁙  │ ⁘  │ ⁙· │ ⁚⁚ │      peça [3,5] = célula 3 + célula 5
//            0    1    2    3    4    5    6

const ATLAS_N = 7, CELULA = 128;
const G3 = [0.28, 0.5, 0.72];                     // as três colunas/linhas do desenho
const PINTAS = [
  [],
  [[1, 1]],
  [[0, 0], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [2, 0], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
];

const texPintas = pintar(CELULA * ATLAS_N, CELULA, (c) => {
  for (let n = 0; n < ATLAS_N; n++) {
    const ox = n * CELULA;
    c.fillStyle = '#f4ecd9';
    c.fillRect(ox, 0, CELULA, CELULA);
    for (const [gx, gy] of PINTAS[n]) {
      const x = ox + G3[gx] * CELULA, y = G3[gy] * CELULA, r = CELULA * 0.088;
      c.fillStyle = 'rgba(255,255,255,.65)';      // lasquinha clara embaixo: dá relevo de furo
      c.beginPath(); c.arc(x + 1.5, y + 1.5, r, 0, 7); c.fill();
      c.fillStyle = '#191512';
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.75, 0, 7); c.fill();
    }
  }
});

const geomCorpo = new THREE.BoxGeometry(PECA_C * FOLGA_C, PECA_E, PECA_L * FOLGA_L);
const geomRisco = new THREE.BoxGeometry(0.022, 0.005, PECA_L * FOLGA_L * 0.8);
const matMarfim = new THREE.MeshStandardMaterial({ color: CORES.marfim, roughness: 0.4, metalness: 0.03 });
const matVerso = new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.6 });
const matPintas = new THREE.MeshStandardMaterial({ map: texPintas, roughness: 0.38 });
const matRisco = new THREE.MeshStandardMaterial({ color: 0x8a7660, roughness: 0.85 });

const geomFace = [];
function faceDaPinta(n) {
  if (geomFace[n]) return geomFace[n];
  const g = new THREE.PlaneGeometry(PECA_C * FOLGA_C / 2, PECA_L * FOLGA_L);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (n + uv.getX(i)) / ATLAS_N);
  uv.needsUpdate = true;
  return (geomFace[n] = g);
}

// A peça nasce deitada com o eixo longo em X: o valor [0] à esquerda, o [1] à direita.
// É a mesma convenção da linha do motor, e é o que faz o rotY do layout já vir certo.
function criarPeca(peca, proprio) {
  const g = new THREE.Group();
  // Peça na mão ganha material próprio para poder acender no hover sem acender as outras.
  const corpo = new THREE.Mesh(geomCorpo, proprio ? matMarfim.clone() : matMarfim);
  corpo.castShadow = true;
  corpo.receiveShadow = true;
  const y = PECA_E / 2 + 0.003;
  const fa = new THREE.Mesh(faceDaPinta(peca[0]), matPintas);
  const fb = new THREE.Mesh(faceDaPinta(peca[1]), matPintas);
  fa.rotation.x = fb.rotation.x = -Math.PI / 2;
  fa.position.set(-PECA_C * FOLGA_C / 4, y, 0);
  fb.position.set(PECA_C * FOLGA_C / 4, y, 0);
  const risco = new THREE.Mesh(geomRisco, matRisco);
  risco.position.y = y;
  g.add(corpo, fa, fb, risco);
  g.userData = { peca, corpo };
  return g;
}

// A mesma peça, translúcida: é a PRÉVIA de onde ela vai cair. Mostrar a peça inteira em
// vez de um marcador abstrato é o que deixa conferir antes de soltar — dá para ver que
// número vai encostar em qual, e se ela entra atravessada por ser carroça.
// Âmbar saturado, não marfim claro: sobre um tampo de madeira iluminado, um fantasma
// da cor da peça de verdade some. Ele tem de ser reconhecível como "ainda não é peça".
const matPreviaCorpo = new THREE.MeshStandardMaterial({
  color: 0xffb43c, emissive: 0xc06800, emissiveIntensity: 1.1, roughness: 0.45,
  transparent: true, opacity: 0.66, depthWrite: false,
});
const matPreviaPinta = new THREE.MeshStandardMaterial({
  map: texPintas, transparent: true, opacity: 0.8, depthWrite: false,
});

function criarFantasma(peca) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geomCorpo, matPreviaCorpo);
  corpo.position.y = PECA_E / 2;
  const y = PECA_E + 0.004;
  const fa = new THREE.Mesh(faceDaPinta(peca[0]), matPreviaPinta);
  const fb = new THREE.Mesh(faceDaPinta(peca[1]), matPreviaPinta);
  fa.rotation.x = fb.rotation.x = -Math.PI / 2;
  fa.position.set(-PECA_C * FOLGA_C / 4, y, 0);
  fb.position.set(PECA_C * FOLGA_C / 4, y, 0);
  g.add(corpo, fa, fb);
  return g;
}

// Peça de costas: é o que se vê da mão dos outros. Só o corpo, sem pinta nenhuma —
// e é essa a garantia visual de que o jogo não desenha o que não deve mostrar.
function criarVerso() {
  const m = new THREE.Mesh(geomCorpo, matVerso);
  m.castShadow = true;
  return m;
}

function porNaMesa(obj, posta) {
  obj.position.set(posta.x, PECA_E / 2, posta.z);
  obj.rotation.set(0, posta.rotY, 0);
}
