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

// ─── as texturas, e por que elas sabem se repintar ───────────────────────────
// Toda textura do jogo é um <canvas> 2D desenhado UMA vez, na carga, e isso valeu
// enquanto a página era imortal. No Android, sair para outro aplicativo e voltar devolve
// DUAS perdas somadas: o contexto WebGL (o navegador libera a GPU da aba de fundo) e o
// BITMAP do canvas 2D (descartado por pressão de memória, volta em branco).
//
// Separadas, nenhuma das duas aparece, e isso foi MEDIDO antes de consertar
// (tests/test-textura.mjs): só perder o contexto não muda nada, porque o three reenvia a
// textura a partir de `texture.image` e o canvas está íntegro; só apagar o bitmap também
// não, porque ninguém reenvia nada e a GPU segue com a cópia boa — o único `needsUpdate`
// do projeto é de UV. JUNTAS, o restore sobe um bitmap em branco: a luz da peça na tela
// cai de 166 para 3, e é a peça preta da foto.
//
// Repare no tampo, que cai só de 132 para 80 e continua parecendo madeira: com o albedo
// zerado o `MeshStandardMaterial` ainda devolve o brilho ESPECULAR da lâmpada. Era por
// isso que a foto mostrava mesa marrom e peça preta ao mesmo tempo — e é por isso que
// "se as três caíssem juntas o tampo estaria preto" era um palpite errado. A medição
// derrubou o palpite; é o terceiro diagnóstico de leitura que este projeto perde para um
// número.
//
// O que faltava era guardar o `desenho`: ele era um arrow inline usado uma vez e jogado
// fora, então não existia como repintar. É o conserto inteiro.
const texturas = [];

function pintar(nome, w, h, desenho) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  // O canvas é pintado em sRGB, e o default do Three é tratar textura como dado LINEAR.
  // Sem esta linha as três texturas do jogo saem lavadas — é por isso que o marfim da
  // peça e a madeira iluminada tendiam para o mesmo âmbar, e a pinta escura chegava
  // cinza. Uma linha, e é a maior alavanca de contraste que existe aqui.
  t.colorSpace = THREE.SRGBColorSpace;
  // Repinta o MESMO canvas e a MESMA textura, nunca uma nova: `matPintas` e
  // `matPreviaPinta` apontam para esta instância, e trocá-la consertaria uma e deixaria a
  // outra preta. `needsUpdate` porque o bitmap mudou e a cópia na GPU é velha.
  const repintar = () => { desenho(cv.getContext('2d'), w, h); t.needsUpdate = true; };
  repintar();
  texturas.push({ nome, canvas: cv, textura: t, repintar });
  return t;
}

// O veio tem GERADOR PRÓPRIO, e não é preciosismo — são duas razões, nesta ordem:
//
// (1) Repintar tem de devolver a MESMA madeira. O tampo trocando de veio ao voltar do
//     outro aplicativo seria o conserto virando um segundo defeito visível, menor e mais
//     difícil de explicar. É também o que deixa o teste exigir que o bitmap volte
//     idêntico, que é muito mais forte do que "não está em branco".
// (2) `Math.random` é GLOBAL, e as suítes de tela semeiam esse gerador dentro da própria
//     página (item 11 da Fila 5). Uma repintura consome ~1.000 sorteios e deslocaria a
//     sequência semeada — a cena que hoje é reproduzível voltaria a ser moeda, e a
//     intermitência que custou uma sessão inteira voltaria pela porta dos fundos.
//
// mulberry32, o mesmo do test-telas, reinstanciado a cada pintura.
const veioDaMadeira = () => {
  let a = 0x5b3a22;                                     // a própria cor da madeira, de semente
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

const texMadeira = pintar('madeira', 512, 512, (c, w, h) => {
  const rnd = veioDaMadeira();
  c.fillStyle = '#5b3a22'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {                       // veios: faixas horizontais tortas
    c.strokeStyle = `rgba(${30 + rnd() * 60},${15 + rnd() * 30},0,${0.06 + rnd() * 0.12})`;
    c.lineWidth = 0.5 + rnd() * 2.5;
    c.beginPath();
    const y = rnd() * h;
    c.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x / 40 + i) * 3);
    c.stroke();
  }
  for (let i = 0; i < 60; i++) {                        // marcas de copo e de uso
    c.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
    c.beginPath();
    c.arc(rnd() * w, rnd() * h, 6 + rnd() * 30, 0, 7);
    c.fill();
  }
});
texMadeira.wrapS = texMadeira.wrapT = THREE.RepeatWrapping;

const texPiso = pintar('piso', 256, 256, (c, w, h) => {
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

// ─── e quem devolve a textura quando o sistema a leva ────────────────────────
// O bitmap descartado volta como PRETO TRANSPARENTE, e toda receita daqui começa com um
// fillRect opaco cobrindo o canvas — então alfa 0 no canto é a assinatura do descarte, e
// custa um getImageData de 1×1 por textura. Quem escrever textura nova aqui herda essa
// obrigação: começar opaca, ou a sonda mente.
//
// A sonda olha UM pixel. Um descarte parcial passaria batido; ninguém relatou nada assim,
// o mecanismo conhecido joga fora o bitmap inteiro, e se um dia aparecer a resposta é
// amostrar três pontos — não abandonar a sonda, que é o que torna o segundo gancho barato.
const bitmapApagado = t => {
  try { return t.canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] < 8; }
  catch (e) { void e; return false; }      // canvas que não deixa ler não é canvas apagado
};

let perdasDeContexto = 0, restauracoes = 0, repinturas = 0;

function conferirTexturas() {
  let n = 0;
  for (const t of texturas) if (bitmapApagado(t)) { t.repintar(); n++; }
  repinturas += n;
  return n;
}

// GANCHO 1 — o restore, que é o que o three NÃO pode fazer por nós. Ele reinicializa o
// contexto e reenvia cada textura a partir de `texture.image`; se a imagem voltou em
// branco, ele reenvia o branco com toda a diligência do mundo. Nosso listener nasce depois
// do dele (o dele é do construtor do WebGLRenderer, lá em cima), então repintamos antes do
// primeiro render — e mesmo que a ordem fosse outra, `repintar()` marca `needsUpdate`.
renderer.domElement.addEventListener('webglcontextlost', () => { perdasDeContexto++; });
renderer.domElement.addEventListener('webglcontextrestored', () => {
  restauracoes++;
  conferirTexturas();
});

// GANCHO 2 — a volta da aba. A perda de contexto NÃO é obrigatória: o bitmap pode ser
// descartado sozinho, e aí nenhum evento avisa ninguém. Sem contexto perdido a tela
// continua certa (a GPU tem a cópia velha), mas o bitmap em branco fica armado para o
// próximo restore. O retorno da aba é o único momento em que dá para PERGUNTAR, e a
// pergunta custa três pixels.
//
// O `visibilitychange` do 110-interacao.js trata a SAÍDA (document.hidden) e é sobre gesto
// preso; este é o outro lado, e mora aqui, junto do assunto dele.
document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirTexturas(); });

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
// tampo tem 12 de diâmetro. Quando não cabe, quem encolhe é o tabuleiro (060-layout).
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
// As tralhas ficam guardadas numa lista porque elas DISPUTAM O TAMPO com o tabuleiro, com
// o monte e com as mãos dos adversários, e o comentário acima é a prova de que isso já
// aconteceu uma vez e foi resolvido movendo um número à mão. Sem a lista, o teste de
// sobreposição não tem como perguntar por elas.
// AS TRALHAS FICAM NO ARCO DA FRENTE, e o arco é calculado, não escolhido a olho.
// Os adversários sentam num anel de raio 4.88, e cada mão se abre TANGENCIALMENTE: com
// sete peças ela cobre ±23° do anel, com as catorze do Duelo ±27°. As cadeiras possíveis
// são 90°, 120°, 180°, 240° e 270° (mesa de 4, de 3 e de 2, com você sempre em 0°), então
// o anel está ocupado de 63° a 297° passando pelo fundo — e sobra o arco da FRENTE, que é
// seu. É por construção livre em qualquer tamanho de mesa, e é por isso que estas
// posições podem continuar sendo literais.
//
// Antes elas estavam em 105°, 251° e 273°, ou seja dentro das cadeiras: medido, o copo
// entrava 0.82 na mão do adversário — mais fundo do que a linha da mesa entrava (0.42), e
// em paisagem, wide e tablet, isto é, no computador, sempre, desde o começo. Ninguém
// relatou porque peça de costas dentro de copo de vidro lê como "coisa do boteco".
//
// O comentário abaixo é de quando um copo já tinha sido movido à mão pelo mesmo motivo. A
// família reincidiu do outro lado, e é por isso que agora existe asserção 3D contra 3D no
// test-telas em vez de mais um número escolhido a dedo.
const tralhas = [
  copo(-3.35, 4.05, 0.75),    // longe do monte: em (-5, 1.9) o copo nascia dentro da pilha
  copo(3.35, 4.05, 0.4),
  copo(4.75, 3.25, 0.95),
];

const cinzeiro = new THREE.Mesh(
  new THREE.CylinderGeometry(0.46, 0.4, 0.14, 20),
  new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.5 })
);
cinzeiro.position.set(1.6, 0.07, 5.1);      // mesmo arco da frente que os copos
cinzeiro.castShadow = true;
scene.add(cinzeiro);
tralhas.push(cinzeiro);

// ─── quem senta onde ─────────────────────────────────────────────────────────
// A conta ÚNICA do que está no tampo. Antes eram duas: 100-mao.js apertava o círculo dos
// adversários por um lado e 090-tabuleiro.js media o orçamento do tabuleiro por outro, em
// profundidades diferentes (z = -3.05 contra z = 0.4) e com divisores mágicos diferentes
// (13.5 contra 0.86), sem uma saber da outra. Que os dois dessem quase o mesmo número era
// coincidência aritmética — e a coincidência era justamente o que garantia a colisão.
const RAIO_ASSENTO = MESA_R * 0.80;

// O aperto continua sendo UM só (a roda continua uma roda), mas quem o decide passa a ser
// o assento mais espremido, cada um medido na PROFUNDIDADE DELE. O 13.5 de antes media
// sempre em z = -3.05, que é onde senta o adversário DE CIMA; quem estoura é o de LADO, em
// z = 0, onde a tela é ~16% mais estreita. É a mesma lição que o monte já tinha ensinado
// uma vez ("a posição dele sai da largura visível na profundidade dele mesmo"), cobrada
// uma segunda vez, no assento.
function assentosDaMesa(vista) {
  const n = vista && vista.naMao ? vista.naMao.length : 0;
  const crus = [];
  for (let i = 0; i < n; i++) {
    if (i === vista.cadeira) continue;
    // `anguloDaCadeira` é da CASA desde a v4.4 — vinha pelo contrato só porque o nome morava
    // no dominó, e quem senta à sua frente está à sua frente em qualquer jogo.
    const a = anguloDaCadeira(i, vista.cadeira, n);
    crus.push({ cadeira: i, a, x: Math.sin(a) * RAIO_ASSENTO, z: Math.cos(a) * RAIO_ASSENTO,
      quantas: vista.naMao[i] });
  }
  let aperto = 1;
  for (const s of crus) {
    if (Math.abs(s.x) < 1e-6) continue;                 // sentado no eixo: nada a apertar
    // A LARGURA E A ESPESSURA VÊM DO JOGO. Era aqui que o boteco sabia o tamanho de uma
    // peça de dominó: uma carta tem outra proporção, e com o número cravado ela não caberia
    // na conta do assento — o adversário passaria por cima do vizinho.
    const cabe = larguraVisivelEm(JOGO.mesa.espessuraDaPeca() / 2, s.z) / 2
      - JOGO.mesa.larguraDaPeca() / 2;
    aperto = Math.min(aperto, cabe / Math.abs(s.x));
  }
  aperto = Math.min(1, Math.max(0.25, aperto));
  const lugares = crus.map(s => {
    const x = s.x * aperto;
    const espaco = Math.min(0.56, 4.2 * aperto / Math.max(s.quantas, 1));
    return { ...s, x, espaco, monte: JOGO.mesa.caixaDoMonte(s.a, x, s.z, s.quantas, espaco) };
  });
  return { aperto, lugares };
}

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

  const fovX = 2 * Math.atan((MAO_CHEIA / 2)
    / profundidadeDe(JOGO.mesa.alturaDaMao(), JOGO.mesa.profundidadeDaMao()));
  const preciso = 2 * Math.atan(Math.tan(fovX / 2) / aspect) * 180 / Math.PI;
  // Em retrato o "preciso" passa de 90°, e aí é melhor a mão em mais fileiras do que a
  // mesa entortada de perspectiva: o teto corta, e 100-mao.js quebra o leque.
  camera.fov = Math.min(FOV_TETO, Math.max(FOV_BASE, preciso));
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  // A largura disponível mudou: o leque tem de ser refeito. Quem decide se vale a pena
  // é a assinatura da mão, em 100-mao.js — resize que não mexe na largura é no-op.
  JOGO.mesa.redesenhar();
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
