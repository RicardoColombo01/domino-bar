// O tabuleiro na tela: sincroniza as peças 3D com a linha da partida e as anima.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Não existe "animar a jogada X". A cada mudança o tabuleiro é RECONCILIADO com a
// visão: cria o que falta, tira o que sobra, e manda todo mundo deslizar para o novo
// lugar. Assim a peça nova cai do alto e, de brinde, quando o jogo dobra ou encolhe,
// o tabuleiro inteiro se reacomoda sozinho — sem uma linha a mais de animação.

const grupoMesa = new THREE.Group();
scene.add(grupoMesa);

const naMesa = new Map();          // chave da peça → { obj, alvo }
let escalaAlvo = 1, posAlvo = new THREE.Vector3();

// A prévia da jogada: a peça translúcida no lugar exato, com um brilho por baixo.
const grupoPrevia = new THREE.Group();
grupoMesa.add(grupoPrevia);
const matBrilho = new THREE.MeshBasicMaterial({ color: 0xffc451, transparent: true, opacity: 0.5 });
const geomBrilho = new THREE.CircleGeometry(PECA_C * 0.8, 28);

function sincronizarTabuleiro(vista) {
  const { postas, caixa } = layoutDaMesa(vista.linha, vista.iAncora);

  // O tabuleiro cabia na mesa e mesmo assim saía da TELA num celular em pé. O limite
  // passa a ser o menor dos dois: a madeira e o quadro.
  const e = escalaDoTabuleiro(caixa, Math.min(ESPALHA_X * 2.1, larguraVisivelEm(0, 0.4) * 0.86));
  escalaAlvo = e;
  posAlvo.set(-caixa.x * e, 0, -caixa.z * e + 0.4);

  const vivas = new Set();
  postas.forEach(p => {
    const k = chave(p.peca);
    vivas.add(k);
    let reg = naMesa.get(k);
    if (!reg) {
      const obj = criarPeca(p.peca);
      // Nasce no alto e um pouco torta: é a queda que dá o "toc" na mesa.
      obj.position.set(p.x, 2.4, p.z);
      obj.rotation.set(0, p.rotY + 0.5, 0);
      grupoMesa.add(obj);
      reg = { obj, alvo: p };
      naMesa.set(k, reg);
      tocarBaque(0.55);
    }
    reg.alvo = p;
  });

  for (const [k, reg] of naMesa)
    if (!vivas.has(k)) { grupoMesa.remove(reg.obj); naMesa.delete(k); }

  esconderPrevia();
}

// ONDE A PEÇA VAI CAIR — sem uma linha de geometria nova. Simula a jogada com o mesmo
// `aplicar` das regras, entrega a linha resultante ao mesmo `layoutDaMesa` que posiciona
// o tabuleiro, e lê de volta a peça recém-colocada. Por isso a prévia acerta até o caso
// difícil: se aquela peça é a que vai DOBRAR na borda, o fantasma já nasce virado na
// quina, porque quem respondeu foi o código que vai posicioná-la de verdade.
function previaDaJogada(vista, peca, ponta) {
  const linha = aplicar(vista.linha, peca, ponta);
  const ancora = vista.iAncora + (ponta === 'esq' && vista.linha.length ? 1 : 0);
  const { postas } = layoutDaMesa(linha, ancora);
  return postas[ponta === 'esq' ? 0 : postas.length - 1];
}

function mostrarPrevia(vista, peca, pontas) {
  esconderPrevia();
  for (const lado of pontas) {
    const p = previaDaJogada(vista, peca, lado);
    const g = new THREE.Group();
    const brilho = new THREE.Mesh(geomBrilho, matBrilho);
    brilho.rotation.x = -Math.PI / 2;
    brilho.position.y = 0.014;
    const fantasma = criarFantasma(peca);
    fantasma.rotation.y = p.rotY;
    g.add(brilho, fantasma);
    g.position.set(p.x, 0, p.z);
    g.userData.lado = lado;
    grupoPrevia.add(g);
  }
}

const esconderPrevia = () => grupoPrevia.clear();
const temPrevia = () => grupoPrevia.children.length > 0;

// Interpolação exponencial: independe do framerate e não precisa de biblioteca.
const chegarPerto = (atual, alvo, k, dt) => atual + (alvo - atual) * (1 - Math.exp(-k * dt));

function animarTabuleiro(dt) {
  grupoMesa.scale.setScalar(chegarPerto(grupoMesa.scale.x, escalaAlvo, 8, dt));
  grupoMesa.position.x = chegarPerto(grupoMesa.position.x, posAlvo.x, 8, dt);
  grupoMesa.position.z = chegarPerto(grupoMesa.position.z, posAlvo.z, 8, dt);

  // O fantasma pulsa e paira um dedo acima do tampo: peça pousada não flutua, então
  // flutuar é o sinal mais direto de "ainda não joguei, ainda dá para desistir".
  const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 300);
  matBrilho.opacity = 0.3 + 0.34 * pulso;
  matPreviaCorpo.opacity = 0.56 + 0.16 * pulso;
  // só a peça paira; o brilho fica colado no tampo, marcando o lugar
  for (const g of grupoPrevia.children) g.children[1].position.y = 0.07 + 0.035 * pulso;

  for (const { obj, alvo } of naMesa.values()) {
    obj.position.x = chegarPerto(obj.position.x, alvo.x, 13, dt);
    obj.position.z = chegarPerto(obj.position.z, alvo.z, 13, dt);
    obj.position.y = chegarPerto(obj.position.y, PECA_E / 2, 15, dt);
    // Gira pelo caminho mais curto, senão uma peça vira 350° em vez de -10°.
    let d = alvo.rotY - obj.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    obj.rotation.y = chegarPerto(obj.rotation.y, obj.rotation.y + d, 13, dt);
  }
}
