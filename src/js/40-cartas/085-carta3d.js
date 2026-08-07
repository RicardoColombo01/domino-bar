// A CARTA EM 3D: um corpo de papel e uma face desenhada em canvas.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Mesma ideia do `080-peca3d.js`, um tamanho acima: em vez de desenhar 40 cartas, o atlas
// tem as 40 faces numa grade de 10 colunas (os valores) por 4 linhas (os naipes), e cada
// carta é um plano cuja UV aponta para a célula certa. Uma textura, 40 cartas.
//
//        A   2   3   4   5   6   7   Q   J   K
//   ♦  │   │   │   │   │   │   │   │   │   │   │   ← linha 0
//   ♠  │   │   │   │   │   │   │   │   │   │   │
//   ♥  │   │   │   │   │   │   │   │   │   │   │
//   ♣  │   │   │   │   │   │   │   │   │   │   │   ← linha 3
//
// O NÚMERO 085 o põe depois do `070-cena.js` (de onde vêm `THREE`, `pintar` e `CORES`) e
// antes do tabuleiro. Ele não depende de dominó nenhum, e o `test-acoplamento` cobra isso.

// A carta em unidades de mundo. A peça de dominó é 1.0 × 0.5 × 0.18; a carta é mais larga e
// bem mais fina, e a proporção 1.4:1 é a de uma carta de verdade (63×88 mm).
//
// A ESPESSURA É EXAGERADA de propósito. Papel de verdade dá 0.002 nesta escala, e uma carta
// vista de perfil sumiria — inclusive na mão dos outros, que é justamente onde a única coisa
// visível é a espessura. 0.035 é o mínimo que ainda lê como carta e não como tábua.
const CARTA_L = 0.62;      // largura, em X
const CARTA_C = 0.88;      // comprimento, em Z — a carta nasce DEITADA e de frente para você
const CARTA_E = 0.035;

// 192 e não 256: são 40 células contra as 7 do dominó, e a peça chega mais perto da câmera
// que uma carta na mesa jamais chega. 1920×768 é uma textura confortável em qualquer
// aparelho que rode este jogo, e a carta continua nítida quando ocupa meia tela.
const CEL_CARTA = 192;
const COLS_CARTA = VALORES.length;      // 10
const LINS_CARTA = NAIPES.length;       // 4

const PAPEL = '#f6f1e4';

// ─── os quatro naipes, desenhados a MÃO ──────────────────────────────────────
// Em caminho, e não com o glifo `♠` num `fillText`. Glifo depende de a fonte do sistema ter
// aquele caractere, e o que falta vira tofu — num celular Android antigo, que é exatamente o
// aparelho onde este projeto já perdeu uma release para uma textura. Caminho desenha igual
// em todo lugar, e é a mesma escolha que fez a pinta do dominó ser um `arc` e não um "●".
//
// `r` é o raio nominal: a figura cabe num quadrado de lado ~2r centrado em (x, y).
function naipeNoCanvas(c, id, x, y, r) {
  if (id === 'ouros') {
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + r * 0.72, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.72, y);
    c.closePath(); c.fill();
    return;
  }
  if (id === 'copas') {
    c.beginPath();
    c.moveTo(x, y + r * 0.92);
    c.bezierCurveTo(x - r * 1.30, y - r * 0.10, x - r * 0.52, y - r * 1.10, x, y - r * 0.32);
    c.bezierCurveTo(x + r * 0.52, y - r * 1.10, x + r * 1.30, y - r * 0.10, x, y + r * 0.92);
    c.closePath(); c.fill();
    return;
  }
  if (id === 'espadas') {
    // O coração de cabeça para baixo, mais a haste. É literalmente como a espada de baralho
    // é desenhada, e reusar a curva é o que faz os dois naipes terem o mesmo peso na tela.
    c.beginPath();
    c.moveTo(x, y - r * 0.95);
    c.bezierCurveTo(x + r * 1.28, y + r * 0.12, x + r * 0.52, y + r * 1.00, x, y + r * 0.30);
    c.bezierCurveTo(x - r * 0.52, y + r * 1.00, x - r * 1.28, y + r * 0.12, x, y - r * 0.95);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(x - r * 0.34, y + r * 0.98);
    c.quadraticCurveTo(x, y + r * 0.50, x + r * 0.34, y + r * 0.98);
    c.closePath(); c.fill();
    return;
  }
  // paus: três folhas e a haste. AS FOLHAS TÊM DE SE SOBREPOR NO CENTRO — na primeira
  // versão elas se tocavam exatamente em (x, y), e o naipe ficava com um FURO de um pixel
  // bem no meio. A olho isso não aparece (o buraco some no antialiasing); quem viu foi a
  // asserção do atlas, amostrando o centro da célula e lendo "papel" nas dez cartas de paus.
  // É a diferença entre "está desenhado" e "está desenhado certo".
  const rr = r * 0.46;
  for (const [dx, dy] of [[0, -0.40], [-0.46, 0.24], [0.46, 0.24]]) {
    c.beginPath(); c.arc(x + dx * r, y + dy * r, rr, 0, 7); c.fill();
  }
  c.beginPath();
  c.moveTo(x - r * 0.32, y + r * 1.00);
  c.quadraticCurveTo(x, y + r * 0.42, x + r * 0.32, y + r * 1.00);
  c.closePath(); c.fill();
}

// ─── o atlas ─────────────────────────────────────────────────────────────────
// A receita fica GUARDADA em `pintar()` (070-cena.js) para poder ser repintada quando o
// Android descartar o bitmap — e por isso ela obedece às duas regras que a Fila 7 pagou:
// começa com um `fillRect` OPACO (é o que faz a sonda de alfa distinguir "apagado" de
// "desenhado") e NÃO consome `Math.random` global (as suítes de tela semeiam aquele gerador
// dentro da própria página, e mil sorteios aqui deslocariam a sequência inteira).
const texCartas = pintar('cartas', CEL_CARTA * COLS_CARTA, CEL_CARTA * LINS_CARTA, (c, w, h) => {
  // O fundo de TODA a textura primeiro, e opaco. Sem isto a sonda de alfa não funciona.
  c.fillStyle = PAPEL;
  c.fillRect(0, 0, w, h);

  for (let n = 0; n < LINS_CARTA; n++) {
    for (let v = 0; v < COLS_CARTA; v++) {
      const ox = v * CEL_CARTA, oy = n * CEL_CARTA;
      const naipe = NAIPES[n];
      c.fillStyle = naipe.cor;
      c.strokeStyle = naipe.cor;

      // A moldura, um tico para dentro: é ela que separa uma carta da vizinha quando duas
      // ficam encostadas na mesa, do mesmo jeito que a FOLGA da peça de dominó faz.
      c.globalAlpha = 0.22;
      c.lineWidth = CEL_CARTA * 0.018;
      c.strokeRect(ox + CEL_CARTA * 0.06, oy + CEL_CARTA * 0.06,
        CEL_CARTA * 0.88, CEL_CARTA * 0.88);
      c.globalAlpha = 1;

      // O NAIPE GRANDE, no meio. É o que se lê de longe, e é o que a suíte de textura
      // amostra para saber que a célula é do naipe certo.
      naipeNoCanvas(c, naipe.id, ox + CEL_CARTA * 0.5, oy + CEL_CARTA * 0.52, CEL_CARTA * 0.24);

      // O VALOR nos dois cantos, o de baixo de cabeça para baixo — que é o que deixa a carta
      // ser lida com ela virada, e é como toda carta do mundo é impressa. Aqui é texto e não
      // caminho porque dígito e letra latina existem em qualquer fonte; naipe, não.
      c.font = `bold ${Math.round(CEL_CARTA * 0.20)}px Georgia, "Times New Roman", serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const rot = VALORES[v];
      c.fillText(rot, ox + CEL_CARTA * 0.17, oy + CEL_CARTA * 0.17);
      c.save();
      c.translate(ox + CEL_CARTA * 0.83, oy + CEL_CARTA * 0.83);
      c.rotate(Math.PI);
      c.fillText(rot, 0, 0);
      c.restore();
    }
  }
});

// O VERSO. Uma textura só, compartilhada pelas 40 — é o que se vê da mão dos outros, e é a
// garantia visual de que o jogo não desenha o que não deve mostrar (invariante 3, na forma
// que dá para fotografar).
const texVerso = pintar('versoCarta', 256, 256, (c, w, h) => {
  c.fillStyle = '#7a3b2e';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,225,190,.22)';
  c.lineWidth = 3;
  // Losangos: determinístico, sem sorteio nenhum, e some na distância em vez de virar moiré.
  for (let i = -h; i < w + h; i += 22) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
    c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke();
  }
  c.strokeStyle = 'rgba(255,225,190,.5)';
  c.lineWidth = 8;
  c.strokeRect(14, 14, w - 28, h - 28);
});

// ─── a geometria ─────────────────────────────────────────────────────────────
const geomCorpoCarta = new THREE.BoxGeometry(CARTA_L, CARTA_E, CARTA_C);
const matPapel = new THREE.MeshStandardMaterial({ color: PAPEL, roughness: 0.72, metalness: 0 });
const matFaceCarta = new THREE.MeshStandardMaterial({ map: texCartas, roughness: 0.62 });
const matVersoCarta = new THREE.MeshStandardMaterial({ map: texVerso, roughness: 0.68 });

// Um plano por CÉLULA do atlas, em cache: 40 no pior caso, e só as que a partida usar.
// Mesma técnica do `faceDaPinta`, com duas coordenadas em vez de uma.
const geomFaceCarta = new Map();
function faceDaCarta(v, n) {
  const k = v + ':' + n;
  if (geomFaceCarta.has(k)) return geomFaceCarta.get(k);
  const g = new THREE.PlaneGeometry(CARTA_L, CARTA_C);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setX(i, (v + uv.getX(i)) / COLS_CARTA);
    // A LINHA É CONTADA DE BAIXO: a UV do three tem o V crescendo para cima, e o canvas
    // desenha com o Y crescendo para baixo. Sem a inversão, o naipe 0 mostraria a linha 3 —
    // e como todas as células têm a mesma forma, isso passaria por "está desenhando algo".
    uv.setY(i, (LINS_CARTA - 1 - n + uv.getY(i)) / LINS_CARTA);
  }
  uv.needsUpdate = true;
  geomFaceCarta.set(k, g);
  return g;
}

// A carta nasce DEITADA no tampo, com a face para cima e o comprimento em Z — ou seja, de pé
// para quem está sentado na cadeira de baixo. `rotation.y` orienta para as outras cadeiras,
// exatamente como a peça de dominó.
function criarCarta(carta, proprio) {
  const g = new THREE.Group();
  // Material próprio quando a carta é SUA: é o que deixa acender esta e não as outras no
  // hover. Sem o clone, `matPapel` é uma instância só e acender uma acenderia as quarenta —
  // é a mesma razão escrita no `criarPeca`.
  const corpo = new THREE.Mesh(geomCorpoCarta, proprio ? matPapel.clone() : matPapel);
  corpo.castShadow = true;
  corpo.receiveShadow = true;
  const face = new THREE.Mesh(faceDaCarta(carta[0], carta[1]), matFaceCarta);
  face.rotation.x = -Math.PI / 2;
  face.position.y = CARTA_E / 2 + 0.003;
  // O VERSO VAI JUNTO, e não é simetria gratuita: uma carta que já foi jogada pode ser
  // RECOLHIDA — quem ganha a vaza junta as cartas e as põe viradas na sua frente. Isso é uma
  // volta de 180° no mesmo objeto, deslizando, e sem esta face o que apareceria do outro lado
  // seria o creme liso do corpo. Girar o objeto que já está na mesa é mais barato e MUITO
  // mais legível que trocá-lo por outro: com objeto novo não há de onde animar.
  const costas = new THREE.Mesh(new THREE.PlaneGeometry(CARTA_L, CARTA_C), matVersoCarta);
  costas.rotation.x = Math.PI / 2;
  costas.position.y = -CARTA_E / 2 - 0.003;
  g.add(corpo, face, costas);
  g.userData = { carta, corpo };
  return g;
}

// Carta de costas: o que se vê da mão dos outros. Só o corpo e o verso, e nenhuma face —
// é a fronteira de segurança na forma que dá para conferir com o olho.
function criarVersoDeCarta() {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geomCorpoCarta, matPapel);
  corpo.castShadow = true;
  const costas = new THREE.Mesh(new THREE.PlaneGeometry(CARTA_L, CARTA_C), matVersoCarta);
  costas.rotation.x = -Math.PI / 2;
  costas.position.y = CARTA_E / 2 + 0.003;
  g.add(corpo, costas);
  return g;
}

// A mesma carta, translúcida: a PRÉVIA de onde ela vai cair. Âmbar e não branco, pelo motivo
// que o fantasma da peça já registra — sobre um tampo iluminado, um fantasma da cor da carta
// de verdade some, e ele precisa ler como "ainda não é carta".
const matPreviaCarta = new THREE.MeshStandardMaterial({
  color: 0xffb43c, emissive: 0xc06800, emissiveIntensity: 1.1, roughness: 0.45,
  transparent: true, opacity: 0.62, depthWrite: false,
});
const matPreviaFaceCarta = new THREE.MeshStandardMaterial({
  map: texCartas, transparent: true, opacity: 0.8, depthWrite: false,
});

function criarFantasmaDeCarta(carta) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geomCorpoCarta, matPreviaCarta);
  corpo.position.y = CARTA_E / 2;
  const face = new THREE.Mesh(faceDaCarta(carta[0], carta[1]), matPreviaFaceCarta);
  face.rotation.x = -Math.PI / 2;
  face.position.y = CARTA_E + 0.004;
  g.add(corpo, face);
  return g;
}

// ─── o que as suítes alcançam ────────────────────────────────────────────────
// A BANCADA. Enquanto não houver truco, nada neste arquivo tem consumidor — e código que
// existe e nunca rodou é uma categoria de defeito que este projeto já nomeou e pagou três
// vezes (a Fila 9 inteira). Isto o torna alcançável hoje.
//
// NÃO vai pelo `window.__jogo`: aquela ponte é da casa mais o JOGO da mesa, e a casa não
// pode conhecer `40-cartas/` — o `test-acoplamento` reprovaria, e com razão. Quem se expõe
// aqui é a BIBLIOTECA, para a casa continuar sem saber que ela existe.
//
// A v4.5 CORRIGIU A PREVISÃO que estava escrita aqui ("some quando o truco chegar"). O truco
// expõe as mesmas funções no `JOGO.ponte` dele, e isso serve às asserções DO TRUCO; o que este
// arquivo precisa é ser alcançável **sem passar por jogo nenhum** — a biblioteca serve a três
// jogos, e o teste dela não pode depender de qual está na mesa.
window.__cartas = {
  criarCarta, criarVersoDeCarta, criarFantasmaDeCarta, faceDaCarta,
  medidas: { CARTA_L, CARTA_C, CARTA_E, CEL_CARTA, COLS_CARTA, LINS_CARTA },
};
