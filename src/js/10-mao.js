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
const FOLGA_LEQUE = 1.08;            // respiro entre uma peça e a seguinte
const naMao = [];                    // { obj, peca, xBase, yBase, zBase, jogavel, erguida }

// DEIXOU DE SER A CONSTANTE 8.2: agora é a largura de mundo que a câmera realmente
// mostra na profundidade da mão, menos uma margem. Era a constante fixa que quebrava o
// celular — em retrato só cabem ~4.6 unidades ali, e a mão de 8.2 saía pelos dois lados.
//
// A largura visível é TETO, não alvo: no computador cabem 12.4 unidades, e deixar a mão
// crescer até lá espalharia as peças de beirada a beirada, cada uma menor e nas quinas
// da perspectiva. MAO_CHEIA continua sendo o que a mão QUER; a tela só pode tirar.
const LARGURA_MAO = () =>
  Math.max(3.2, Math.min(MAO_CHEIA, larguraVisivelEm(MAO_Y, MAO_Z) - 0.45));

// Quantas peças por fileira. Acima do que cabe, a mão quebra em fileiras em vez de
// continuar encolhendo: com 14 peças numa fileira só, cada uma cobre quase um quinto da
// anterior — e o que some é sempre a beirada direita, ou seja, o segundo número.
//
// São N fileiras, não duas: no computador cabem 10 por fileira e o Duelo de 14 fecha em
// duas, mas num celular em pé cabem 5, e aí 14 peças precisam de três.
const ESCALA_MIN = 0.72;
function porFileira(n) {
  const max = Math.max(2, Math.floor(LARGURA_MAO() / (PECA_C * ESCALA_MIN * FOLGA_LEQUE)));
  if (n <= max) return n;
  return Math.ceil(n / Math.ceil(n / max));      // equilibra: 14 em 3 fileiras = 5,5,4
}

// A largura mudou (girou o celular, mudou a janela): o leque tem de ser refeito.
//
// A largura entra na ASSINATURA em vez de ser invalidada à força, e isso não é detalhe:
// no iOS o `resize` dispara a cada vez que a barra de URL encolhe. Com invalidação à
// força, cada um desses reconstruía a mão e apagava a peça que você tinha levantado.
// Assim, resize que não muda a largura é no-op.
//
// `vistaAtual` mora em 16-loop.js, e é por isso que a primeira chamada de enquadrar()
// vem de lá: aqui ela ainda estaria na zona morta do `let`.
function redesenharMao() {
  if (vistaAtual && vistaAtual.mao) sincronizarMao(vistaAtual);
}
let assinaturaMao = '';
let escolhida = null;                // CHAVE da peça levantada, ou null

// A ARRUMAÇÃO DA MÃO, por cadeira, guardada por chave de peça.
//
// Fica no cliente e nunca no motor, e cada um dos três motivos bastaria sozinho:
// `visaoDe` devolve a MESMA referência de `P.maos[cadeira]`, então ordenar a vista
// ordenaria a mão do anfitrião por causa da preferência visual de um jogador; no
// convidado não funcionaria, porque a vista dele é regenerada do JSON a cada publicação;
// e no hotseat dois humanos dividem o mesmo `P`, então a arrumação de um viraria a do
// outro. Guardar por chave também sobrevive à peça jogada — índice de motor muda a cada
// `splice`, chave não muda nunca.
//
// Por cadeira por causa do hotseat, e de brinde: quando a vez volta para você, a sua
// arrumação ainda está lá.
const ordemDaMao = new Map();        // cadeira → [chave, chave, ...]
let maoDaOrdem = -1;                 // de qual vista.maoNum essas arrumações são

const anguloDaCadeira = (i, eu, n) => ((i - eu + n) % n) * Math.PI * 2 / n;
const naMaoPorChave = k => naMao.find(m => chave(m.peca) === k) || null;
const esquecerArrumacao = () => { ordemDaMao.clear(); maoDaOrdem = -1; };

// Cria o que falta e remove o que saiu, MANTENDO VIVO o que continua na mão. Antes isto
// destruía e recriava as 7 a 14 peças a cada mudança — e com objetos novos toda
// reordenação seria teletransporte, porque não há de onde animar.
function reconciliarMao(vista) {
  // Vista travada (a tela de passe do hotseat) chega com `mao: []` e ainda com a cadeira
  // do jogador ANTERIOR. Gravar a ordem aqui apagava a arrumação dele — e como `[]` é
  // truthy, na volta o sort não reordenava nada. O recurso simplesmente não existia no
  // hotseat, que é justamente onde o comentário lá em cima promete que existe.
  if (!vista.mao.length) {
    naMao.forEach(m => grupoMao.remove(m.obj));
    naMao.length = 0;
    return;
  }
  const querem = new Set(vista.mao.map(chave));
  for (let i = naMao.length - 1; i >= 0; i--) {
    if (!querem.has(chave(naMao[i].peca))) { grupoMao.remove(naMao[i].obj); naMao.splice(i, 1); }
  }
  const tem = new Set(naMao.map(m => chave(m.peca)));
  for (const peca of vista.mao) {
    if (tem.has(chave(peca))) continue;
    const obj = criarPeca(peca, true);
    // Peça na mão está NA SUA MÃO, não na mesa: se ela projetar sombra, vira um borrão
    // preto do tamanho de um tijolo no tampo logo atrás.
    obj.userData.corpo.castShadow = false;
    grupoMao.add(obj);
    // Peça comprada entra no FIM: é onde a mão física recebe, e é o único lugar em que
    // você vê o que comprou sem procurar.
    naMao.push({ obj, peca, nova: true, jogavel: false, xBase: 0, yBase: MAO_Y, zBase: MAO_Z, tombo: MAO_TOMBO, escalaBase: 1 });
  }

  const guardada = ordemDaMao.get(vista.cadeira);
  if (guardada) {
    const pos = new Map(guardada.map((k, i) => [k, i]));
    const posto = naMao.map((m, i) => [m, pos.has(chave(m.peca)) ? pos.get(chave(m.peca)) : Infinity, i]);
    posto.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    posto.forEach((par, i) => { naMao[i] = par[0]; });
  }
  ordemDaMao.set(vista.cadeira, naMao.map(m => chave(m.peca)));
}

// Onde cada peça descansa. SÓ geometria, e lê a ordem atual de `naMao` — é isso que faz
// arrastar e "arrumar" custarem um splice mais uma chamada aqui.
function posicionarMao() {
  // O ESPAÇO SAI DO COMPRIMENTO DA PEÇA, não de um número escolhido a olho. Com um valor
  // fixo menor que a peça, cada uma cobre a metade DIREITA da anterior — e como a peça
  // nasce com o valor [0] à esquerda e o [1] à direita, o que sumia era sempre o segundo
  // número. Primeiro garante que não sobrepõe; só encolhe depois, se a mão for grande; e
  // quando nem encolhendo cabe, quebra em fileiras em vez de virar tira.
  const n = Math.max(naMao.length, 1);
  const largura = LARGURA_MAO();
  const cabem = porFileira(n);
  const escala = Math.max(ESCALA_MIN, Math.min(1.3, largura / (cabem * PECA_C * FOLGA_LEQUE)));
  const espaco = Math.min(PECA_C * escala * FOLGA_LEQUE, largura / cabem);

  naMao.forEach((m, i) => {
    const fila = Math.floor(i / cabem);
    const nesta = Math.min(cabem, n - fila * cabem);        // a de cima pode ser menor
    // A fileira de trás sobe, recua e tomba um pouco mais. Com a mesma altura e o mesmo
    // tombo ela ficaria escondida atrás da da frente — a ideia é o leque de quem segura
    // as peças em duas camadas, não duas linhas na mesma altura.
    m.xBase = ((i % cabem) - (nesta - 1) / 2) * espaco;
    m.yBase = MAO_Y + fila * 0.34 * escala;
    m.zBase = MAO_Z - fila * 0.66 * escala + Math.abs(m.xBase) * 0.05;
    m.tombo = MAO_TOMBO + fila * 0.13;
    m.escalaBase = escala;
    // Peça recém-chegada nasce já no lugar; as outras deslizam até ele.
    if (m.nova) {
      m.obj.position.set(m.xBase, m.yBase, m.zBase);
      m.obj.rotation.set(m.tombo, 0, 0);
      m.obj.scale.setScalar(escala);
      m.nova = false;
    }
  });

  // A luz da mão acompanha o miolo do leque. Com o Duelo de 14 em três ou quatro
  // fileiras, uma luz parada em cima da primeira deixava a de trás com um terço do
  // brilho — e é justamente a que precisa ser lida com esforço.
  const filas = Math.ceil(n / cabem);
  luzDaMao.position.set(0,
    MAO_Y + (filas - 1) / 2 * 0.34 * escala + 1.55,
    MAO_Z - (filas - 1) / 2 * 0.66 * escala + 2.05);
}

// Troca duas peças de lugar na tela e guarda a arrumação nova. O motor não fica sabendo,
// e não precisa: `jogar()` recebe a PEÇA, nunca o índice.
function moverNaMao(de, para) {
  if (de === para || !naMao[de]) return false;
  const m = naMao.splice(de, 1)[0];
  naMao.splice(Math.max(0, Math.min(naMao.length, para)), 0, m);
  if (vistaAtual) ordemDaMao.set(vistaAtual.cadeira, naMao.map(x => chave(x.peca)));
  posicionarMao();
  return true;
}

// Arrumar por NAIPE MAIS FORTE. Não é ordenar por peso nem por número: é o que jogador
// de bar realmente faz, que é olhar a mão e saber "meu forte é o cinco". Conta cada
// número dos dois lados (carroça soma 2 no próprio, o que é certo — carroça é a
// evidência mais forte daquele naipe), põe os naipes na ordem da contagem, e dentro de
// cada um a carroça na frente. É determinístico e idempotente: apertar duas vezes não
// muda nada.
function arrumarMao() {
  if (naMao.length < 2) return;
  const quantos = new Array(MAX_PINTAS + 1).fill(0);
  for (const m of naMao) { quantos[m.peca[0]]++; quantos[m.peca[1]]++; }
  const naipes = quantos.map((q, n) => [q, n]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);

  const nova = [], usadas = new Set();
  for (const [, naipe] of naipes) {
    naMao
      .filter(m => !usadas.has(chave(m.peca)) && (m.peca[0] === naipe || m.peca[1] === naipe))
      .sort((a, b) => (carroca(b.peca) - carroca(a.peca)) || (valor(b.peca) - valor(a.peca)))
      .forEach(m => { usadas.add(chave(m.peca)); nova.push(m); });
  }
  naMao.length = 0;
  naMao.push(...nova);
  if (vistaAtual) ordemDaMao.set(vistaAtual.cadeira, naMao.map(m => chave(m.peca)));
  posicionarMao();
}

// Em que slot do leque cai um ponto da tela. Projetar as posições de REPOUSO e pegar a
// mais próxima resolve fileira e coluna de uma vez, e continua funcionando com uma, duas
// ou quatro fileiras — que é o caso do retrato. Projetar `obj.position` em vez da base
// faria os alvos balançarem junto com a animação e o slot ficaria pulando sozinho.
const _v = new THREE.Vector3();
const naTela = m => {
  _v.set(m.xBase, m.yBase, m.zBase).project(camera);
  return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight };
};
function slotSob(cx, cy) {
  if (!naMao.length) return -1;
  const pontos = naMao.map(naTela);
  let melhor = 0, perto = Infinity;
  pontos.forEach((p, i) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < perto) { perto = d; melhor = i; }
  });
  // "Longe da mão" é longe em relação ao tamanho do slot, e não a um número de pixels
  // que só valeria numa tela: num celular o leque inteiro é do tamanho de dois slots
  // de computador.
  const passo = pontos.length > 1
    ? Math.hypot(pontos[1].x - pontos[0].x, pontos[1].y - pontos[0].y) : 140;
  return perto > Math.max(70, passo * 1.5) ? -1 : melhor;
}

function sincronizarMao(vista) {
  // A assinatura é de CONJUNTO — as chaves ORDENADAS —, e não da ordem em que a mão
  // está. Com a arrumação do jogador, uma assinatura sensível à ordem entraria em laço:
  // reordena, muda a assinatura, reconstrói tudo, perde a seleção. E a largura entra
  // porque o leque depende dela tanto quanto das peças.
  const assinatura = vista.mao.map(chave).sort().join(',') + '#' + vista.cadeira +
    '#' + LARGURA_MAO().toFixed(2);
  // Mão nova apaga a arrumação: as peças são outras, e a de antes não quer dizer nada.
  if (vista.maoNum !== maoDaOrdem) { esquecerArrumacao(); maoDaOrdem = vista.maoNum; }
  if (assinatura !== assinaturaMao) {
    assinaturaMao = assinatura;
    reconciliarMao(vista);
    posicionarMao();
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
  // `escolhida` é a CHAVE da peça, não o índice: assim ela sobrevive a arrastar, a
  // arrumar, à reconciliação e a uma vista chegando do anfitrião sem uma linha de
  // remapeamento. Só some quando a peça deixa a mão.
  if (escolhida !== null && !naMaoPorChave(escolhida)) escolhida = null;
}

// Some com a mão da tela ANTES de anunciar a troca de jogador no hotseat. Cobrir com
// um overlay não bastaria: as peças continuariam existindo na cena, a um F12 de
// distância. Aqui elas somem de verdade e só voltam depois do "peguei".
function esconderMao() {
  encerrarArrasto();                   // o hotseat pode trocar de jogador com o dedo no ar
  naMao.forEach(m => grupoMao.remove(m.obj));
  naMao.length = 0;
  assinaturaMao = '';
  cancelarEscolha();
}

// Quanto o que está NA MESA precisa encolher para caber na tela. 1 é o computador, onde
// tudo cabe; num celular em pé o círculo dos adversários e o monte ficavam do lado de
// fora do quadro — o monte chegava a uma vez e meia a largura da tela. Aperta só o eixo
// X: a profundidade continua a mesma, então os adversários continuam sentados em volta.
const apertoDaMesa = () => Math.min(1, larguraVisivelEm(0, -MESA_R * 0.5) / 13.5);

function sincronizarOutros(vista) {
  grupoOutros.clear();
  const raio = MESA_R * 0.80, aperto = apertoDaMesa();
  vista.naMao.forEach((quantas, i) => {
    if (i === vista.cadeira) return;
    const a = anguloDaCadeira(i, vista.cadeira, vista.naMao.length);
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * raio * aperto, PECA_E / 2, Math.cos(a) * raio);
    g.rotation.y = -a;
    // Cada peça atravessada na fileira, lado a lado. Enfileiradas no comprimento elas
    // se sobrepõem e o que aparece na mesa é uma tábua preta, não uma mão de dominó.
    const espaco = Math.min(0.56, 4.2 * aperto / Math.max(quantas, 1));
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
  // O monte fica na beirada de baixo, MUITO mais perto da câmera que a mesa — e ali a
  // tela é bem mais estreita. Apertar pelo fator da mesa não bastava: ele continuava
  // meia largura para fora num celular. Aqui a posição sai da largura visível na
  // profundidade dele mesmo, então cabe por construção em qualquer tela.
  const aperto = apertoDaMesa();
  const zMonte = 2.15 + (1 - aperto) * 1.6;
  const beirada = larguraVisivelEm(PECA_E / 2, zMonte) / 2;
  const xMonte = -Math.min(4.98, beirada * 0.78);
  for (let i = 0; i < vista.monte; i++) {
    const v = criarVerso();
    const pilha = Math.floor(i / 4);                              // quatro bolinhos de 4
    v.position.set(xMonte + (pilha % 2) * 0.6 * aperto, PECA_E / 2 + (i % 4) * PECA_E,
      zMonte + Math.floor(pilha / 2) * 1.12 * aperto);
    // Torto, mas SEMPRE o mesmo torto: com Math.random() aqui a pilha inteira sorteava
    // ângulos novos a cada publicação — ou seja, a cada lance da mesa — e o que se via
    // era o monte estremecendo. Derivado do índice, ele fica parado e continua torto.
    v.rotation.y = Math.PI / 2 + (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.06;
    grupoMonte.add(v);
  }
}

function animarMao(dt, apontada) {
  const sobEsse = apontada === null || apontada === undefined ? null : naMao[apontada];
  naMao.forEach(m => {
    // A peça no dedo tem a posição escrita pelo ponteiro: interpolar por cima é a receita
    // do "a peça não acompanha o arrasto".
    if (m.arrastando) {
      m.obj.scale.setScalar(chegarPerto(m.obj.scale.x, m.escalaBase * 1.1, 14, dt));
      return;
    }
    const sobe = chave(m.peca) === escolhida ? 0.42 : (m === sobEsse && m.jogavel ? 0.2 : 0);
    // O repouso sai do que posicionarMao calculou para ESTA peça (a fileira de trás mora
    // mais alta e mais ao fundo), e não de MAO_Y/MAO_Z direto.
    //
    // O X passou a ser animado junto: sem isso, trocar duas peças de lugar seria
    // teletransporte, e é justamente o movimento que precisa ser legível. Um pouco mais
    // devagar que o resto, de propósito.
    m.obj.position.x = chegarPerto(m.obj.position.x, m.xBase, 10, dt);
    m.obj.position.y = chegarPerto(m.obj.position.y, m.yBase + sobe, 14, dt);
    m.obj.position.z = chegarPerto(m.obj.position.z, m.zBase - sobe * 0.35, 14, dt);
    m.obj.rotation.x = chegarPerto(m.obj.rotation.x, m.tombo + sobe * 0.22, 14, dt);
    // A escala também: com os objetos sobrevivendo à reconciliação, jogar uma peça muda
    // o tamanho de todas as outras, e um setScalar seco daria um pulo.
    m.obj.scale.setScalar(chegarPerto(m.obj.scale.x, m.escalaBase, 14, dt));
  });
}
