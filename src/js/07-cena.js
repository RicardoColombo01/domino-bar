// O boteco: renderer, câmera, a lâmpada pendurada, a mesa e as tralhas em cima dela.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Nenhum arquivo de imagem no projeto: madeira, piso e as pintas das peças são
// desenhados em canvas na hora. Textura procedural custa ~40 linhas e economiza
// download, pasta de assets e o risco de abrir o jogo em file:// sem elas.
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0908);
scene.fog = new THREE.Fog(0x0d0908, 16, 34);

// O FOV DO THREE É VERTICAL, e essa única frase é o bug do celular inteiro. A largura
// de mundo que cabe na tela é `2·d·tan(fovY/2)·aspect`: com fov fixo em 46°, o
// computador (aspect 1.78) enxerga 12.4 unidades na profundidade da mão e a mão de 8.2
// cabe folgada — mas um celular em pé (aspect 0.46) enxerga 3.2, e a mão fica duas
// vezes e meia maior que a tela. Não é CSS, é câmera. Ver enquadrar(), no fim do arquivo.
const FOV_BASE = 46;                 // o enquadramento de sempre, no computador
const FOV_TETO = 62;                 // além disso a mesa começa a entortar de perspectiva
const MAO_CHEIA = 8.2;               // a largura que a mão gostaria de ter, em unidades

const camera = new THREE.PerspectiveCamera(FOV_BASE, innerWidth / innerHeight, 0.1, 100);
// De onde a câmera olha AGORA. Guardado porque a conta de profundidade precisa disso
// antes de a matriz de mundo estar atualizada, e porque enquadrar() interpola os quatro.
const enq = { camY: 8.3, camZ: 9.3, alvoY: 0, alvoZ: 0.8 };
camera.position.set(0, enq.camY, enq.camZ);
camera.lookAt(0, enq.alvoY, enq.alvoZ);

// Profundidade de um ponto ao longo do eixo de visada. Câmera e alvo têm x = 0, então
// a conta é toda no plano YZ.
function profundidadeDe(y, z) {
  const uy = enq.alvoY - enq.camY, uz = enq.alvoZ - enq.camZ;
  return ((y - enq.camY) * uy + (z - enq.camZ) * uz) / Math.hypot(uy, uz);
}

// Quanta LARGURA de mundo cabe na tela naquela profundidade. É daqui que a mão descobre
// de quanto espaço dispõe — a mesma conta que enquadrar() usa para escolher o fov, para
// não existirem duas matemáticas discordando sobre o mesmo enquadramento.
const larguraVisivelEm = (y, z) =>
  2 * profundidadeDe(y, z) * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;

function pintar(w, h, desenho) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  desenho(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

const texMadeira = pintar(512, 512, (c, w, h) => {
  c.fillStyle = '#5b3a22'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {                       // veios: faixas horizontais tortas
    c.strokeStyle = `rgba(${30 + Math.random() * 60},${15 + Math.random() * 30},0,${0.06 + Math.random() * 0.12})`;
    c.lineWidth = 0.5 + Math.random() * 2.5;
    c.beginPath();
    const y = Math.random() * h;
    c.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x / 40 + i) * 3);
    c.stroke();
  }
  for (let i = 0; i < 60; i++) {                        // marcas de copo e de uso
    c.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
    c.beginPath();
    c.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 0, 7);
    c.fill();
  }
});
texMadeira.wrapS = texMadeira.wrapT = THREE.RepeatWrapping;

const texPiso = pintar(256, 256, (c, w, h) => {
  c.fillStyle = '#2a2320'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#332a26';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    if ((x + y) % 2) c.fillRect(x * w / 4, y * h / 4, w / 4, h / 4);
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke();
    c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke();
  }
});
texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
texPiso.repeat.set(9, 9);

// ─── luz ─────────────────────────────────────────────────────────────────────
// Uma lâmpada baixa em cima da mesa, e o resto na penumbra: é o contraste que faz
// parecer boteco à noite em vez de sala de reunião. Mas contraste demais custa leitura
// — o piso subiu para dar de CONTAR as peças na beirada do cone sem virar dia claro.
scene.add(new THREE.AmbientLight(0x6b5744, 0.95));
scene.add(new THREE.HemisphereLight(0xffe0b8, 0x241a12, 0.35));

const lampada = new THREE.SpotLight(CORES.luz, 300, 30, 0.85, 0.55, 1.45);
lampada.position.set(0, 7.6, 0.4);
lampada.target.position.set(0, 0, 0.4);
lampada.castShadow = true;
lampada.shadow.mapSize.set(1024, 1024);
lampada.shadow.camera.near = 2;
lampada.shadow.camera.far = 20;
lampada.shadow.bias = -0.0012;
scene.add(lampada, lampada.target);

// Uma luz fraca só na sua beirada da mesa. Sem ela a mão fica fora do cone da lâmpada
// e as pintas somem justamente nas peças que você precisa ler para decidir.
const luzDaMao = new THREE.PointLight(0xffd8ab, 13, 13, 1.8);
luzDaMao.position.set(0, 2.7, 6.8);
scene.add(luzDaMao);

const cupula = new THREE.Mesh(
  new THREE.ConeGeometry(1.15, 0.9, 24, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x1b1512, side: THREE.DoubleSide, roughness: 0.85 })
);
cupula.position.set(0, 8.05, 0.4);
scene.add(cupula);
const bulbo = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff1cf })
);
bulbo.position.set(0, 7.62, 0.4);
scene.add(bulbo);
const fio = new THREE.Mesh(
  new THREE.CylinderGeometry(0.02, 0.02, 4, 6),
  new THREE.MeshStandardMaterial({ color: 0x110d0b })
);
fio.position.set(0, 10.4, 0.4);
scene.add(fio);

// ─── cenário ─────────────────────────────────────────────────────────────────
const piso = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 46),
  new THREE.MeshStandardMaterial({ map: texPiso, roughness: 0.95 })
);
piso.rotation.x = -Math.PI / 2;
piso.position.y = -2.4;
piso.receiveShadow = true;
scene.add(piso);

const parede = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 20),
  new THREE.MeshStandardMaterial({ color: CORES.parede, roughness: 1 })
);
parede.position.set(0, 7.6, -13);
scene.add(parede);

// A mesa é redonda e o jogo cabe nela: o tabuleiro pode ir a ~8.4 de largura e o
// tampo tem 12 de diâmetro. Quando não cabe, quem encolhe é o tabuleiro (06-layout).
const MESA_R = 6.1;
const tampo = new THREE.Mesh(
  new THREE.CylinderGeometry(MESA_R, MESA_R, 0.34, 64),
  new THREE.MeshStandardMaterial({ map: texMadeira, roughness: 0.62, metalness: 0.04 })
);
tampo.position.y = -0.17;
tampo.receiveShadow = true;
scene.add(tampo);

const borda = new THREE.Mesh(
  new THREE.TorusGeometry(MESA_R, 0.13, 10, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f1d12, roughness: 0.7 })
);
borda.rotation.x = Math.PI / 2;
borda.position.y = -0.05;
scene.add(borda);

const pe = new THREE.Mesh(
  new THREE.CylinderGeometry(0.34, 0.9, 2.4, 16),
  new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.8 })
);
pe.position.y = -1.55;
pe.castShadow = true;
scene.add(pe);

// ─── as tralhas em cima da mesa ──────────────────────────────────────────────
// Ficam nas quinas, fora do caminho do tabuleiro (ESPALHA_X × ESPALHA_Z).
const vidro = new THREE.MeshPhysicalMaterial({
  color: 0xcfe3dc, roughness: 0.06, metalness: 0, transmission: 0.9,
  transparent: true, opacity: 0.45, thickness: 0.3,
});

function copo(x, z, cheio) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.85, 20, 1, true), vidro);
  c.position.y = 0.42;
  const cerveja = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.22, 0.62 * cheio, 20),
    new THREE.MeshStandardMaterial({ color: 0xd99420, roughness: 0.25 })
  );
  cerveja.position.y = 0.31 * cheio + 0.06;
  const espuma = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.1, 20),
    new THREE.MeshStandardMaterial({ color: 0xfdf6e6, roughness: 0.9 })
  );
  espuma.position.y = 0.62 * cheio + 0.11;
  g.add(c, cerveja, espuma);
  g.position.set(x, 0, z);
  g.children.forEach(m => (m.castShadow = true));
  scene.add(g);
  return g;
}
copo(-5.35, -0.3, 0.75);      // longe do monte: em (-5, 1.9) o copo nascia dentro da pilha
copo(4.9, 2.2, 0.4);
copo(5.2, -1.4, 0.95);

const cinzeiro = new THREE.Mesh(
  new THREE.CylinderGeometry(0.46, 0.4, 0.14, 20),
  new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.5 })
);
cinzeiro.position.set(-5.1, 0.07, -1.7);
cinzeiro.castShadow = true;
scene.add(cinzeiro);

// Enquadrar é derivar o fov da largura que precisa caber, e não o contrário. Antes isto
// só mexia em `camera.aspect`, o que em retrato deixava a mão duas vezes e meia maior
// que a tela (ver a nota do FOV lá em cima).
//
// O PISO importa tanto quanto o teto: no computador a largura necessária pede 31°, menos
// que os 46° de sempre — sem o piso, adaptar o celular teria mudado o enquadramento de
// quem joga na tela grande, sem nenhum motivo.
function enquadrar() {
  const aspect = innerWidth / innerHeight;

  // 0 em paisagem, 1 em retrato fechado. Interpolado, e não um `if`: com dois casos
  // secos, girar o celular dá um degrau no meio da partida.
  const t = Math.min(1, Math.max(0, (1.2 - aspect) / 0.7));
  enq.camY = 8.3 - 1.0 * t;                  // desce
  enq.camZ = 9.3 - 0.4 * t;
  enq.alvoY = -0.30 * t;                     // e olha um pouco para baixo e para a
  enq.alvoZ = 0.8 + 1.05 * t;                // frente: mesa em cima, mão embaixo
  camera.position.set(0, enq.camY, enq.camZ);
  camera.lookAt(0, enq.alvoY, enq.alvoZ);
  camera.aspect = aspect;

  const fovX = 2 * Math.atan((MAO_CHEIA / 2) / profundidadeDe(MAO_Y, MAO_Z));
  const preciso = 2 * Math.atan(Math.tan(fovX / 2) / aspect) * 180 / Math.PI;
  // Em retrato o "preciso" passa de 90°, e aí é melhor a mão em mais fileiras do que a
  // mesa entortada de perspectiva: o teto corta, e 10-mao.js quebra o leque.
  camera.fov = Math.min(FOV_TETO, Math.max(FOV_BASE, preciso));
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  // A largura disponível mudou: o leque tem de ser refeito. Quem decide se vale a pena
  // é a assinatura da mão, em 10-mao.js — resize que não mexe na largura é no-op.
  redesenharMao();
}

// Um `resize` pode chegar dezenas de vezes numa rotação, e no iOS a barra de URL
// colapsando dispara outro tanto. Coalesce num quadro só, e repete depois que o
// aparelho assenta — a rotação do iOS leva uns 350 ms, e o `resize` chega ANTES de
// innerHeight estabilizar, com a altura da orientação anterior.
let quadroDeEnquadre = 0, atrasoDeEnquadre = 0;
function agendarEnquadre() {
  cancelAnimationFrame(quadroDeEnquadre);
  quadroDeEnquadre = requestAnimationFrame(enquadrar);
  clearTimeout(atrasoDeEnquadre);
  atrasoDeEnquadre = setTimeout(enquadrar, 350);
}
addEventListener('resize', agendarEnquadre);
addEventListener('orientationchange', agendarEnquadre);
if (typeof visualViewport !== 'undefined' && visualViewport) {
  visualViewport.addEventListener('resize', agendarEnquadre);
}
