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
// que uma carta na mesa jamais chega. A carta continua nítida quando ocupa meia tela.
const CEL_CARTA = 192;

// A CÉLULA TEM A PROPORÇÃO DA CARTA, e não é detalhe — foi um defeito de verdade, achado
// olhando a mesa renderizada em 11/08. A célula era QUADRADA (192×192) e a face é
// `PlaneGeometry(0.62, 0.88)`: a UV esticava o quadrado no retângulo e **tudo saía 42% mais
// alto do que devia**. Os naipes ficavam alongados, o losango de ouros virava um oval e as
// letras esguias — e como TODAS as células sofriam igual, não havia com o que comparar.
//
// Nenhuma asserção pegava: a suíte de textura amostra a COR no centro da célula, e cor não
// se deforma. É a família do "está desenhado" ≠ "está desenhado CERTO" que este arquivo já
// registra com o furo de um pixel no naipe de paus.
const CEL_CARTA_A = Math.round(CEL_CARTA * (CARTA_C / CARTA_L));   // 272
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
const texCartas = pintar('cartas', CEL_CARTA * COLS_CARTA, CEL_CARTA_A * LINS_CARTA, (c, w, h) => {
  // O fundo de TODA a textura primeiro, e opaco. Sem isto a sonda de alfa não funciona.
  c.fillStyle = PAPEL;
  c.fillRect(0, 0, w, h);

  for (let n = 0; n < LINS_CARTA; n++) {
    for (let v = 0; v < COLS_CARTA; v++) {
      const ox = v * CEL_CARTA, oy = n * CEL_CARTA_A;
      const naipe = NAIPES[n];
      c.fillStyle = naipe.cor;
      c.strokeStyle = naipe.cor;

      // A moldura, um tico para dentro: é ela que separa uma carta da vizinha quando duas
      // ficam encostadas na mesa, do mesmo jeito que a FOLGA da peça de dominó faz. Ela se
      // apertou contra a beirada em 19/08 para o canto crescido caber por dentro dela.
      c.globalAlpha = 0.22;
      c.lineWidth = CEL_CARTA * 0.018;
      c.strokeRect(ox + CEL_CARTA * 0.035, oy + CEL_CARTA_A * 0.03,
        CEL_CARTA * 0.93, CEL_CARTA_A * 0.94);
      c.globalAlpha = 1;

      // O NAIPE GRANDE, no meio. É o que se lê de longe, e é o que a suíte de textura
      // amostra para saber que a célula é do naipe certo.
      naipeNoCanvas(c, naipe.id, ox + CEL_CARTA * 0.5, oy + CEL_CARTA_A * 0.53, CEL_CARTA * 0.30);

      // O CANTO: valor E naipe, nas duas pontas, o de baixo de cabeça para baixo — que é o
      // que deixa a carta ser lida virada, e é como toda carta do mundo é impressa. O valor é
      // texto e não caminho porque dígito e letra latina existem em qualquer fonte; naipe,
      // não (num Android velho um `♠` que a fonte não tenha vira tofu).
      //
      // O NAIPE PEQUENO ENTROU AQUI PORQUE O CANTO É O QUE SOBRA. Medido em 11/08: em retrato
      // as três cartas da mão SE SOBREPÕEM (390px e 360px), e da carta coberta só se vê a
      // faixa do canto — o naipe grande do meio fica escondido debaixo da vizinha. Sem naipe
      // no canto, a informação some justamente na tela onde o jogo mais é jogado.
      //
      // E NO TRUCO ISSO DECIDE A MÃO, não é enfeite: entre duas manilhas quem ganha é o naipe
      // (ouros < espadas < copas < paus), e as quatro se dividem em DUAS cores só. Ver a
      // carta e não saber o naipe é ver metade da carta.
      const rot = VALORES[v];
      // O CANTO CRESCEU DE NOVO EM 19/08, por relato de campo: "no celular não está tendo
      // como ver os símbolos e nem o número". A conta que o relato cobrou: em retrato 360 a
      // carta tem ~103px de tela, e o valor a 0.23 da célula dava ~24px — legíveis DE
      // FRENTE. Mas a carta da mesa está deitada e a da mão tomba: o ângulo da câmera
      // comprime o glifo em quase metade, e o que se lê são ~12px. Como o canto é a única
      // faixa visível da carta coberta no leque, é ele que carrega a legibilidade: valor a
      // 0.30, naipe a 0.12, e a âncora um tico para dentro para o conjunto caber.
      const cantoDe = (px, py, virado) => {
        c.save();
        c.translate(ox + CEL_CARTA * px, oy + CEL_CARTA_A * py);
        if (virado) c.rotate(Math.PI);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `bold ${Math.round(CEL_CARTA * 0.30)}px Georgia, "Times New Roman", serif`;
        c.fillText(rot, 0, -CEL_CARTA_A * 0.055);
        naipeNoCanvas(c, naipe.id, 0, CEL_CARTA_A * 0.115, CEL_CARTA * 0.12);
        c.restore();
      };
      cantoDe(0.18, 0.16, false);
      cantoDe(0.82, 0.84, true);
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
  // `carta === null` É A CARTA SEM IDENTIDADE — a escondida da mesa do truco. Ela nasce SEM
  // o plano da face, e isso é fronteira e não economia: um objeto que não tem geometria de
  // face não pode mostrá-la nem por um quadro, nem de barriga para cima, nem no F12. A
  // biblioteca não sabe POR QUE uma carta seria anônima (isso é regra de jogo); ela só
  // oferece a forma.
  if (carta) {
    const face = new THREE.Mesh(faceDaCarta(carta[0], carta[1]), matFaceCarta);
    face.rotation.x = -Math.PI / 2;
    face.position.y = CARTA_E / 2 + 0.003;
    g.add(face);
  }
  // O VERSO VAI JUNTO, e não é simetria gratuita: uma carta que já foi jogada pode ser
  // RECOLHIDA — quem ganha a vaza junta as cartas e as põe viradas na sua frente. Isso é uma
  // volta de 180° no mesmo objeto, deslizando, e sem esta face o que apareceria do outro lado
  // seria o creme liso do corpo. Girar o objeto que já está na mesa é mais barato e MUITO
  // mais legível que trocá-lo por outro: com objeto novo não há de onde animar.
  const costas = new THREE.Mesh(new THREE.PlaneGeometry(CARTA_L, CARTA_C), matVersoCarta);
  costas.rotation.x = Math.PI / 2;
  costas.position.y = -CARTA_E / 2 - 0.003;
  g.add(corpo, costas);
  g.userData = { carta: carta || null, corpo };
  return g;
}

// Carta de costas: o que se vê da mão dos outros — e, na mão de ferro do truco, da SUA. Só
// o corpo e o verso, e nenhuma face — é a fronteira de segurança na forma que dá para
// conferir com o olho.
//
// `proprio` clona o material pelo MESMO motivo do `criarCarta`: o leque tinge o corpo da
// carta apontada, e sem o clone `matPapel` é uma instância só — acender um verso acenderia
// as quarenta cartas e todos os versos da mesa. E `userData.corpo` entra porque o leque
// desreferencia `m.obj.userData.corpo` em dois pontos; um verso sem ele era um leque cego
// que lançava na primeira sincronização.
function criarVersoDeCarta(proprio) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geomCorpoCarta, proprio ? matPapel.clone() : matPapel);
  corpo.castShadow = true;
  const costas = new THREE.Mesh(new THREE.PlaneGeometry(CARTA_L, CARTA_C), matVersoCarta);
  costas.rotation.x = -Math.PI / 2;
  costas.position.y = CARTA_E / 2 + 0.003;
  g.add(corpo, costas);
  g.userData = { carta: null, corpo };
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
  // `carta === null` é o fantasma ANÔNIMO — a prévia da mão de ferro, que não pode soletrar
  // o que nem o próprio jogador sabe. Mesma convenção do `criarCarta`.
  if (carta) {
    const face = new THREE.Mesh(faceDaCarta(carta[0], carta[1]), matPreviaFaceCarta);
    face.rotation.x = -Math.PI / 2;
    face.position.y = CARTA_E + 0.004;
    g.add(face);
  }
  g.add(corpo);
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
  medidas: { CARTA_L, CARTA_C, CARTA_E, CEL_CARTA, CEL_CARTA_A, COLS_CARTA, LINS_CARTA },
};
