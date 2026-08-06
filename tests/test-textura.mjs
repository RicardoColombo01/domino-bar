// AS TEXTURAS SOBREVIVEM A SAIR DO JOGO E VOLTAR?
//
// Relato de campo, com foto (31/07/2026): no Android, sair para outro aplicativo e voltar
// deixa as peças PRETAS, sem pintas — sobra só o risco divisório central. A geometria e a
// iluminação continuam desenhando.
//
// O jogo não tem arquivo de imagem: madeira, piso e as pintas são desenhados em canvas 2D
// na carga (`pintar()`, em 070-cena.js). Duas coisas podem sumir quando a aba vai para o
// fundo num aparelho de pouca memória, e elas são INDEPENDENTES:
//
//   · o CONTEXTO WebGL — o navegador libera a GPU da aba de fundo. O three trata isso
//     sozinho: reinicializa e REENVIA cada textura a partir de `texture.image`.
//   · o BITMAP do canvas 2D — descartado por pressão de memória, volta em branco.
//
// Separadas, nenhuma das duas aparece: canvas íntegro reenviado é igual, e canvas apagado
// sem restore não é reenviado (o único `needsUpdate` do projeto é de UV). JUNTAS, o
// restore sobe um bitmap em branco e o `map` vira preto.
//
// ESTA SUÍTE NASCEU SÓ MEDINDO, de propósito. Três dos onze itens da Fila 5 tinham o
// diagnóstico errado escrito antes de alguém olhar os números, e a regra da casa virou
// medir antes de consertar. Os quatro experimentos abaixo dizem QUAL das duas perdas
// produz o sintoma da foto — e a resposta muda o conserto.
//
// Repare que ela alcança os canvases pelo GRAFO DE CENA e pelo DOM, e nunca por uma ponte
// nova: uma medição que dependesse do conserto daria `TypeError` no código de hoje, e
// TypeError não é o defeito.
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// Aceita um bundle por argumento — é assim que se PROVA que a asserção fica vermelha:
// gera-se o index.html do commit anterior num arquivo à parte e roda-se esta suíte contra
// ele. Asserção que não reprova no código antigo não prova nada, e a única forma de saber
// é rodando-a lá.
//   node test-textura.mjs                     o index.html desta pasta
//   node test-textura.mjs ../antes.html       um bundle qualquer
const alvo = process.argv[2] || path.join(import.meta.dirname, '..', 'index.html');
const JOGO = 'file:///' + path.resolve(alvo).split(path.sep).join('/');

// Tudo que roda DENTRO da página. Sai de uma string porque precisa existir depois de cada
// recarga, e cada experimento recarrega para começar de um estado limpo — E2 e E3 apagam
// bitmaps que, no código de hoje, ninguém repinta.
const AJUDA = `
  const j = window.__jogo;

  // Uma mesa com bots, só para existir mão na tela: o pixel da peça é a metade da medição
  // que fala a língua do relato ("a peça está preta").
  const mesa = () => {
    j.MESA.modo = 'classico'; j.MESA.n = 2;
    j.MESA.cadeiras[1].tipo = 'bot'; j.MESA.cadeiras[1].nivel = 'normal';
    j.comecarLocal();
    j.pararBots();
  };

  const tela = () => document.querySelector('#app canvas');
  const gl = () => { const c = tela(); return c.getContext('webgl2') || c.getContext('webgl'); };
  const perdedor = () => gl().getExtension('WEBGL_lose_context');

  // AS TEXTURAS, sem ponte: as com \`map\` estão no grafo, e o atlas está no material de
  // uma face da sua própria mão. Nomeadas pelo TAMANHO, que é único e não depende de o
  // jogo ter nome para elas — 1792x256 pintas, 512x512 madeira, 256x256 piso.
  const nomeDe = (im) => im.width === 1792 ? 'pintas' : im.width === 512 ? 'madeira'
                       : im.width === 256 ? 'piso' : im.width + 'x' + im.height;
  const texturas = () => {
    const achadas = new Map();
    const olhar = (o) => {
      if (o.isMesh && o.material && o.material.map && o.material.map.image &&
          o.material.map.image.getContext) achadas.set(o.material.map.image, o.material.map);
    };
    j.grupoMesa.parent.traverse(olhar);          // a cena inteira: tampo, piso, o que houver
    for (const m of j.naMao) m.obj.traverse(olhar);   // e a sua mão, que é de onde vem o atlas
    return [...achadas].map(([im, t]) => ({ nome: nomeDe(im), im, t }));
  };

  // A SONDA DO BITMAP. Toda receita de \`pintar()\` começa com um fillRect OPACO cobrindo o
  // canvas, então alfa 0 no canto é a assinatura de bitmap descartado. Um getImageData de
  // 1x1 por textura.
  const alfaDe = (im) => im.getContext('2d').getImageData(0, 0, 1, 1).data[3];

  // Soma dos bytes do bitmap inteiro, para responder "voltou IGUAL?" e não só "voltou
  // não-branco". O veio da madeira é sorteado, então esta é a única pergunta que separa
  // "repintou" de "repintou a MESMA coisa".
  const somaDe = (im) => {
    const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 997) s = (s + d[i] * (i % 251 + 1)) % 4294967296;
    return s;
  };

  // A SONDA DO PIXEL NA TELA — a foto do Ricardo virada em número. Tem de rodar DENTRO de
  // um requestAnimationFrame: sem \`preserveDrawingBuffer\`, o buffer de desenho só é
  // legível entre o render do quadro e a composição. O loop do jogo se reagenda no TOPO de
  // quadro(), então um rAF registrado agora entra na fila DEPOIS dele e vê o quadro pronto.
  const luzEm = (px, py) => {
    const c = tela();
    const r = window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio;
    const n = 9, cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const cx = cv.getContext('2d');
    cx.drawImage(c, px * r - (n >> 1), py * r - (n >> 1), n, n, 0, 0, n, n);
    const d = cx.getImageData(0, 0, n, n).data;
    const luzes = [];
    for (let i = 0; i < d.length; i += 4) luzes.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    luzes.sort((a, b) => a - b);
    return Math.round(luzes[luzes.length >> 1]);       // mediana: ignora a borda da peça
  };

  const ondeNaTela = (x, y, z) => {
    const V = j.naMao.length ? j.naMao[0].obj.position.constructor : null;
    const v = new V(x, y, z); v.project(j.camera);
    return { px: (v.x + 1) / 2 * window.innerWidth, py: (1 - v.y) / 2 * window.innerHeight };
  };

  // ERRO DENTRO DE UM rAF NÃO REJEITA A PROMESSA QUE O ENVOLVE: o \`reject\` nunca é
  // chamado, a promessa nunca resolve, e o puppeteer só reclama 180 s depois com um
  // ProtocolError que não fala da causa. O projeto já pagou isso uma vez (item 11 da Fila
  // 5, um \`j.grupoMao\` inexistente). Aqui todo callback de quadro devolve o erro COMO
  // VALOR, para a falha chegar em Node com nome e sobrenome.
  const noQuadro = (f) => new Promise(r => requestAnimationFrame(() => {
    try { r({ ok: f() }); } catch (e) { r({ erro: (e && e.message) || String(e) }); }
  }));
  const quadro = () => noQuadro(() => 0);

  // A FOTO COMPLETA: alfa e soma de cada bitmap, mais a luz da peça e a do tampo. O tampo
  // é o discriminador: se as tres texturas caem juntas, ele fica preto junto.
  const medir = async () => {
    await quadro(); await quadro();
    const peca = j.naMao[0];
    if (!peca) return { erro: 'a mão está vazia: naMao tem ' + j.naMao.length + ' peças' };
    const p = ondeNaTela(peca.xBase, peca.yBase, peca.zBase);
    const t = ondeNaTela(0, 0, 0);
    const luz = await noQuadro(() => [luzEm(p.px, p.py), luzEm(t.px, t.py)]);
    if (luz.erro) return { erro: 'lendo o pixel da tela: ' + luz.erro };
    let bitmaps;
    try {
      bitmaps = texturas().map(x => ({ nome: x.nome, alfa: alfaDe(x.im), soma: somaDe(x.im) }));
    } catch (e) { return { erro: 'lendo o bitmap: ' + ((e && e.message) || String(e)) }; }
    return { luzPeca: luz.ok[0], luzTampo: luz.ok[1], bitmaps };
  };

  // PERDER E RESTAURAR DE VERDADE, pela extensão. Duas armadilhas de API aqui:
  //   · loseContext() dispara 'webglcontextlost' de forma ASSÍNCRONA;
  //   · restoreContext() chamado antes de o evento sair lança INVALID_OPERATION.
  // Por isso se espera cada evento, em vez de encadear as duas chamadas.
  // ESPERAR EVENTO COM PRAZO. Sem o prazo, um evento que não chega vira promessa que nunca
  // resolve — e do lado de Node isso aparece como ProtocolError três minutos depois, sem
  // dizer o que faltou. Evento que não veio é INFORMAÇÃO; travamento não é.
  const esperar = (alvo, nome, ms) => new Promise(r => {
    const t = setTimeout(() => r(\`o evento \${nome} não chegou em \${ms}ms\`), ms);
    alvo.addEventListener(nome, () => { clearTimeout(t); r(null); }, { once: true });
  });

  const perderERestaurar = async () => {
    const c = tela();
    // A referência da extensão é guardada ANTES de perder o contexto: com o contexto
    // perdido, TODO getExtension devolve null, e o restore ficaria inalcançável.
    const ext = perdedor();
    if (!ext) return 'sem WEBGL_lose_context';
    const caiu = esperar(c, 'webglcontextlost', 5000);
    ext.loseContext();
    const faltou = await caiu;
    if (faltou) return faltou;
    // O Chrome IGNORA restoreContext() chamado de dentro do despacho do 'lost' — com a
    // chamada colada no evento, o 'restored' simplesmente nunca vem. Uma folga curta
    // basta, e ela está explícita aqui para o motivo não se perder.
    await new Promise(r => setTimeout(r, 300));
    const voltou = esperar(c, 'webglcontextrestored', 15000);
    ext.restoreContext();
    const faltou2 = await voltou;
    if (faltou2) return faltou2;
    await quadro(); await quadro(); await quadro();
    return 'ok';
  };

  // APAGAR COMO O SISTEMA APAGA: \`c.width = c.width\` devolve o canvas ao estado inicial,
  // preto transparente, que é o que um backing store descartado entrega de volta.
  const apagarBitmaps = () => { for (const x of texturas()) x.im.width = x.im.width; };

  // ─── o que o ATLAS realmente desenha ────────────────────────────────────────
  // Onde as pintas caem dentro de uma célula, em fração dela. É a mesma grade de três
  // colunas do desenho, dita AQUI e não lida do jogo: um teste que importasse a tabela do
  // próprio código conferiria a tabela contra ela mesma e passaria com qualquer desenho.
  const GRADE = [0.28, 0.5, 0.72];
  // O ATLAS DAS CARTAS, que é a mesma pergunta noutra pasta: 40 células, e cada uma tem de
  // desenhar o naipe da SUA linha. Elas têm todas a mesma forma, então um naipe trocado de
  // linha é invisível a olho — e como a pasta das cartas ainda não tem jogo que a consuma,
  // isto é a única coisa que olha o desenho.
  //
  // Vem de window.__jogo.texturas (a ponte da CASA, por nome) e não do grafo: nenhuma carta
  // está na cena ainda, então caçar material com map não acharia nada.
  //
  // O que se amostra é a COR do naipe grande no centro. A forma exata (coração, folha) não
  // dá para afirmar por amostragem sem virar um teste de pixel frágil; a FAMÍLIA da cor dá,
  // e é ela que pega uma linha inteira trocada — que é o defeito que importa.
  const atlasDasCartas = () => {
    const t = (window.__jogo.texturas || []).find(x => x.nome === 'cartas');
    if (!t) return { erro: 'não achei o atlas de cartas' };
    const im = t.canvas;
    const cols = 10, lins = 4;
    const cel = im.width / cols;
    if (im.height !== cel * lins) return { erro: 'atlas ' + im.width + 'x' + im.height + ' não fecha ' + cols + 'x' + lins };
    const cx = im.getContext('2d');
    const celulas = [];
    for (let n = 0; n < lins; n++) {
      const linha = [];
      for (let v = 0; v < cols; v++) {
        // O centro do naipe grande — 0.52 da célula, que é onde o desenho o põe.
        const d = cx.getImageData(Math.round((v + 0.5) * cel), Math.round((n + 0.52) * cel), 1, 1).data;
        const claro = d[0] > 200 && d[1] > 200 && d[2] > 200;
        linha.push(claro ? 'papel' : (d[0] - d[2] > 60 ? 'vermelho' : 'preto'));
      }
      celulas.push(linha);
    }
    return { celulas, cel, largura: im.width, altura: im.height };
  };

  const atlasDeVerdade = () => {
    const t = texturas().find(x => x.nome === 'pintas');
    if (!t) return { erro: 'não achei o atlas de pintas' };
    const cel = t.im.height;                       // as células são quadradas
    const cx = t.im.getContext('2d');
    const escuro = (x, y) => {
      const d = cx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) < 60;   // pinta é #120f0c
    };
    const celulas = [];
    for (let n = 0; n < t.im.width / cel; n++) {
      const marcadas = [];
      for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++)
        if (escuro(n * cel + GRADE[gx] * cel, GRADE[gy] * cel)) marcadas.push(gx + ',' + gy);
      celulas.push(marcadas.sort().join(' '));
    }
    return { celulas, largura: t.im.width, cel };
  };

  // A UV de cada metade da peça: é ela que escolhe QUAL célula do atlas cada lado mostra.
  // Sem isto, o atlas poderia estar perfeito e a peça mostrar os números trocados.
  const uvDaMao = () => j.naMao.slice(0, 3).map(m => {
    const faces = m.obj.children.filter(o => o.material && o.material.map);
    const faixa = (f) => {
      const uv = f.geometry.attributes.uv;
      let u0 = 1, u1 = 0;
      for (let i = 0; i < uv.count; i++) { u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); }
      return { u0, u1, x: f.position.x };
    };
    const fs = faces.map(faixa).sort((a, b) => a.x - b.x);   // esquerda primeiro
    return { peca: m.peca.slice(), esq: fs[0], dir: fs[1] };
  });

`;

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // 45 s e não os 180 s de fábrica: aqui uma promessa que nunca resolve é o modo de falha
  // MAIS PROVÁVEL (perda de contexto que não volta, quadro que não chega), e esperar três
  // minutos para descobrir isso torna a medição cara demais para se repetir.
  protocolTimeout: 45000,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files'],
});

const pagina = await navegador.newPage();
await pagina.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
const erros = [];
pagina.on('pageerror', e => erros.push(e.message));
pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

// Cada experimento começa de uma página nova: E2 e E3 apagam bitmaps que, no código de
// hoje, ninguém repinta — sem recarregar, um experimento contaminaria o seguinte. É a
// mesma lição do localStorage compartilhado que as suítes de tela já pagaram.
const doZero = async () => {
  await pagina.goto(JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
  await pagina.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
  await pagina.evaluate(naPagina('mesa()'));
};

// A AJUDA vai DENTRO de uma IIFE, e não solta no script. `page.evaluate(string)` avalia em
// escopo global: como cada experimento chama a ajuda várias vezes na mesma página, os
// `const` dela colidiriam consigo mesmos na segunda chamada ("Identifier 'j' has already
// been declared"). O test-telas não tropeça nisso porque avalia a ajuda dele uma vez só
// por página. E o valor da IIFE é o que volta — por isso é expressão, nunca `return` solto.
const naPagina = expr => `(async () => { ${AJUDA}\n return (${expr}); })()`;

const mostrar = (rotulo, m) => {
  if (m.erro) { console.log(`    ${rotulo.padEnd(10)} ✗ ${m.erro}`); return; }
  const bs = m.bitmaps.map(b => `${b.nome} alfa ${String(b.alfa).padStart(3)}`).join(' · ');
  console.log(`    ${rotulo.padEnd(10)} peça ${String(m.luzPeca).padStart(3)} · ` +
    `tampo ${String(m.luzTampo).padStart(3)} · ${bs}`);
};

const experimento = async (nome, oQueFaz) => {
  await doZero();
  if (process.env.DOMINO_DEBUG) console.log('    …medindo o antes');
  const antes = await pagina.evaluate(naPagina('medir()'));
  if (process.env.DOMINO_DEBUG) console.log('    …mexendo');
  const nota = await pagina.evaluate(naPagina(oQueFaz));
  if (process.env.DOMINO_DEBUG) console.log('    …medindo o depois');
  const depois = await pagina.evaluate(naPagina('medir()'));
  console.log(`\n  ${nome}${nota && nota !== 'ok' ? `  (${nota})` : ''}`);
  mostrar('antes', antes);
  mostrar('depois', depois);
  if (!antes.erro && !depois.erro) {
    const mudou = antes.bitmaps.map((b, i) => b.soma === depois.bitmaps[i].soma ? null : b.nome).filter(Boolean);
    console.log(`    bitmaps que MUDARAM: ${mudou.length ? mudou.join(', ') : '(nenhum)'}`);
  }
  return { antes, depois };
};

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

console.log('MEDIÇÃO — o que acontece com as texturas quando o contexto e/ou o bitmap somem');
console.log('(luz é a mediana de 9 pixels: peça de marfim iluminada passa de 100; preta fica perto de 0)');

const e1 = await experimento('E1 · só perder e restaurar o CONTEXTO',
  'perderERestaurar()');

const e2 = await experimento('E2 · só apagar os BITMAPS do canvas',
  '(apagarBitmaps(), "ok")');

const e3 = await experimento('E3 · apagar os bitmaps E perder/restaurar o contexto',
  '(apagarBitmaps(), perderERestaurar())');

await experimento('E4 · perder e restaurar TRÊS vezes seguidas',
  'perderERestaurar().then(perderERestaurar).then(perderERestaurar)');

// ─── 1. O ATLAS DESENHA O QUE PROMETE ────────────────────────────────────────
// Verde hoje, de propósito: é rede de regressão, não conserto. E é a lacuna que o
// CLAUDE.md aponta como a mais perigosa do projeto — `080-peca3d.js` não tinha NENHUMA
// asserção sobre o que a face desenha, então `faceDaPinta(3)` passando a desenhar quatro
// pintas deixaria as suítes todas verdes com o jogo mostrando peças erradas.
//
// A tabela está escrita AQUI, e não importada do jogo: um teste que lesse `PINTAS` do
// próprio código conferiria a tabela contra ela mesma e aprovaria qualquer desenho.
console.log('\n  o atlas de pintas');
const ESPERADO = [
  '',                                                  // 0 — em branco
  '1,1',                                               // 1 — só o centro
  '0,0 2,2',                                           // 2 — diagonal
  '0,0 1,1 2,2',                                       // 3
  '0,0 0,2 2,0 2,2',                                   // 4 — as quatro quinas
  '0,0 0,2 1,1 2,0 2,2',                               // 5 — quinas + centro
  '0,0 0,1 0,2 2,0 2,1 2,2',                           // 6 — duas colunas cheias
].map(s => s.split(' ').filter(Boolean).sort().join(' '));

await doZero();
const atlas = await pagina.evaluate(naPagina('atlasDeVerdade()'));
ok(!atlas.erro, `não deu para ler o atlas: ${atlas.erro}`);
if (!atlas.erro) {
  ok(atlas.celulas.length === 7, `o atlas tem ${atlas.celulas.length} células, e o dominó tem 7 meias-faces`);
  atlas.celulas.forEach((viu, n) => {
    ok(viu === ESPERADO[n],
      `a célula ${n} do atlas desenha ${viu.split(' ').filter(Boolean).length} pinta(s) ` +
      `em [${viu}] — era para ser ${ESPERADO[n].split(' ').filter(Boolean).length} em [${ESPERADO[n]}]`);
  });
  console.log(`    ${atlas.largura}px em 7 células de ${atlas.cel}: ` +
    atlas.celulas.map(c => c.split(' ').filter(Boolean).length).join(''));
}

// ─── e o atlas das CARTAS ────────────────────────────────────────────────────
// A cor de cada naipe está escrita aqui, à mão, pelo motivo de sempre: ler `NAIPES` do jogo
// para conferir `NAIPES` aprovaria qualquer desenho. A ordem é a de `40-cartas/045-baralho.js`
// — ouros, espadas, copas, paus —, e é a linha do atlas.
console.log('\n  o atlas de cartas');
const FAMILIA = ['vermelho', 'preto', 'vermelho', 'preto'];
const cartas = await pagina.evaluate(naPagina('atlasDasCartas()'));
ok(!cartas.erro, `não deu para ler o atlas de cartas: ${cartas.erro}`);
if (!cartas.erro) {
  ok(cartas.celulas.length === 4, `o atlas tem ${cartas.celulas.length} linhas, e são 4 naipes`);
  ok(cartas.celulas.every(l => l.length === 10), 'alguma linha não tem as 10 colunas de valor');
  // NENHUMA célula pode estar em branco: uma coluna vazia é o laço parando cedo, e o
  // `test-cartas` do terminal não enxerga desenho nenhum.
  const vazias = cartas.celulas.flat().filter(x => x === 'papel').length;
  ok(vazias === 0, `${vazias} célula(s) do atlas não desenham naipe nenhum no centro`);
  cartas.celulas.forEach((linha, n) => {
    const erradas = linha.filter(x => x !== FAMILIA[n]).length;
    ok(erradas === 0,
      `a linha ${n} do atlas tinha de ser ${FAMILIA[n]} (é o naipe ${n}) e ${erradas} célula(s) não são: ${linha.join()}`);
  });
  console.log(`    ${cartas.largura}×${cartas.altura} em 40 células de ${cartas.cel}: ` +
    cartas.celulas.map((l, i) => `${i}=${l[0]}`).join(' '));
}

// A UV, que é quem escolhe a célula. O atlas pode estar perfeito e a peça mostrar os
// números trocados — ou espelhados, e aí o `rotY` que o 060-layout calcula fica certo para
// uma peça que aparece errada. A convenção é do 080-peca3d.js: o valor [0] à ESQUERDA.
const uvs = await pagina.evaluate(naPagina('uvDaMao()'));
for (const u of uvs) {
  const [a, b] = u.peca;
  ok(u.esq.x < u.dir.x, `a peça ${a}|${b}: as duas metades não estão em lados opostos`);
  ok(Math.abs(u.esq.u0 - a / 7) < 1e-6 && Math.abs(u.esq.u1 - (a + 1) / 7) < 1e-6,
    `a peça ${a}|${b} mostra a célula ${Math.round(u.esq.u0 * 7)} à esquerda, e o [0] dela é ${a}`);
  ok(Math.abs(u.dir.u0 - b / 7) < 1e-6 && Math.abs(u.dir.u1 - (b + 1) / 7) < 1e-6,
    `a peça ${a}|${b} mostra a célula ${Math.round(u.dir.u0 * 7)} à direita, e o [1] dela é ${b}`);
}
console.log(`    ${uvs.length} peças da mão com o [0] à esquerda e a célula certa em cada lado`);

// ─── 2. O DEFEITO DE CAMPO ───────────────────────────────────────────────────
// É o E3 medido lá em cima, virado em asserção. As três reprovam no código anterior ao
// conserto, e a do meio é literalmente a foto do Ricardo em número.
console.log('\n  a peça sobrevive a sair do jogo e voltar');
ok(!e3.depois.erro, `não deu para medir depois do E3: ${e3.depois.erro}`);
if (!e3.depois.erro) {
  for (const b of e3.depois.bitmaps) {
    ok(b.alfa === 255, `depois de voltar, o bitmap de ${b.nome} está APAGADO (alfa ${b.alfa})`);
  }
  ok(e3.depois.luzPeca >= 100,
    `depois de voltar, a peça na tela tem luz ${e3.depois.luzPeca} — antes tinha ${e3.antes.luzPeca}. ` +
    `É a peça preta da foto: o atlas subiu em branco no restore`);
}
// NÃO se exige aqui que o bitmap volte byte a byte igual, e a razão é medida: depois de
// uma perda de contexto o Chrome repinta o canvas 2D por outro caminho de rasterização, e
// até o PISO — que é fillRect e linhas retas, sem um sorteio sequer — volta com soma
// diferente (2996620 → 2996208). Exigir igualdade aqui seria asserção sobre o
// anti-aliasing do navegador, não sobre o jogo. A pergunta "voltou a MESMA madeira?" tem
// resposta honesta logo abaixo, no bloco 3, onde não há perda de contexto no meio.

// E as duas metades sozinhas continuam sendo inofensivas — se um dia E1 ou E2 passarem a
// escurecer a peça, o mecanismo mudou e o conserto pode estar no lugar errado.
ok(e1.depois.luzPeca >= 100, `só perder o contexto já apagou a peça (luz ${e1.depois.luzPeca})`);
ok(e2.depois.luzPeca >= 100, `só apagar o bitmap já apagou a peça (luz ${e2.depois.luzPeca})`);

// ─── 3. O GANCHO SEM PERDA DE CONTEXTO ───────────────────────────────────────
// O bitmap pode ser descartado sem o contexto cair, e aí NENHUM evento avisa. A tela
// continua certa (a GPU tem a cópia velha), mas o bitmap em branco fica armado para o
// próximo restore. A volta da aba é o único momento em que dá para perguntar.
// É também o único cenário em que dá para perguntar as outras duas coisas com honestidade,
// porque o rasterizador do Chrome não muda de caminho aqui: se a madeira voltar diferente,
// a culpa é NOSSA; e o Math.random que for consumido é o da repintura, não o dos UUIDs que
// o three gera ao reinicializar um contexto restaurado (medi: são 24).
console.log('\n  a volta da aba repinta o bitmap que o sistema levou');
await doZero();
const original = await pagina.evaluate(naPagina('texturas().map(x => ({ nome: x.nome, soma: somaDe(x.im) }))'));
await pagina.evaluate(naPagina(
  '(apagarBitmaps(), window.__sorteios = 0,' +
  ' window.__random = Math.random, Math.random = () => { window.__sorteios++; return window.__random(); }, "ok")'));
const apagados = await pagina.evaluate(naPagina('texturas().map(x => alfaDe(x.im))'));
ok(apagados.every(a => a === 0), `o teste não conseguiu apagar os bitmaps: alfas ${apagados.join(',')}`);

// VISIBILITYCHANGE DE VERDADE, e não um Event sintético: trazer outra aba para a frente é
// o que o sistema faz quando o jogador abre outro aplicativo. Um evento disparado à mão
// provaria só que a função existe — a lição do dublê incompleto já foi paga quatro vezes.
const outra = await navegador.newPage();
await outra.goto('about:blank');
await outra.bringToFront();
await pagina.bringToFront();
await pagina.evaluate(naPagina('new Promise(r => setTimeout(r, 400))'));
const visivel = await pagina.evaluate('document.visibilityState');
const daVolta = await pagina.evaluate(naPagina(
  '(Math.random = window.__random, texturas().map(x => ({ nome: x.nome, alfa: alfaDe(x.im), soma: somaDe(x.im) })))'));
const sorteios = await pagina.evaluate('window.__sorteios');
await outra.close();
console.log(`    visibilityState de volta: ${visivel} · alfas ${daVolta.map(x => x.alfa).join(',')} · ` +
  `${sorteios} sorteios globais`);

ok(daVolta.every(x => x.alfa === 255),
  `voltar para a aba não repintou os bitmaps apagados (alfas ${daVolta.map(x => x.alfa).join(',')}) — ` +
  `eles ficam armados para o próximo restore do contexto`);

// E sem gastar sorteio de ninguém. As duas asserções andam juntas: sem a de cima, esta
// passaria por VACUIDADE num código onde nada repinta — que é o verde vazio de sempre.
ok(sorteios === 0,
  `repintar consumiu ${sorteios} sorteios do Math.random global — a sequência semeada ` +
  `do test-telas se desloca e a intermitência do item 11 volta pela porta dos fundos`);

// ─── 4. REPINTAR DUAS VEZES DÁ A MESMA COISA ─────────────────────────────────
// A pergunta que interessa é "o veio da madeira é sempre o mesmo?", e ela NÃO se responde
// comparando a repintura com a primeira pintura: o navegador rasteriza a primeira num
// canvas recém-criado e as seguintes num canvas já usado como fonte de textura, e a soma
// muda ~0,6% — inclusive a do PISO, que é fillRect e linhas retas, sem um sorteio sequer.
// Foi essa medida que derrubou a suspeita de que a diferença fosse nossa.
//
// Comparando repintura CONTRA repintura o caminho é o mesmo dos dois lados, e aí qualquer
// diferença é do nosso desenho. Sem o gerador próprio do veio, é aqui que a madeira
// trocaria de cara a cada volta do outro aplicativo.
console.log('\n  repintar duas vezes desenha a mesma madeira');
const repintar = async () => {
  await pagina.evaluate(naPagina('(apagarBitmaps(), "ok")'));
  const t2 = await navegador.newPage();
  await t2.goto('about:blank');
  await t2.bringToFront();
  await pagina.bringToFront();
  await pagina.evaluate(naPagina('new Promise(r => setTimeout(r, 400))'));
  await t2.close();
  return pagina.evaluate(naPagina(
    'texturas().map(x => ({ nome: x.nome, alfa: alfaDe(x.im), soma: somaDe(x.im) }))'));
};
const umaVez = await repintar();
const outraVez = await repintar();
// A GUARDA CONTRA VERDE VAZIO, e sem ela este bloco inteiro é decorativo: num código onde
// nada repinta, os dois lados são o mesmo canvas em branco e "idênticos" vira elogio à
// ausência de desenho. Dois bitmaps vazios comparam iguais — é o `diff` de dois arquivos
// vazios, de novo.
ok(umaVez.every(x => x.alfa === 255) && outraVez.every(x => x.alfa === 255),
  `nenhuma das duas repinturas aconteceu (alfas ${umaVez.map(x => x.alfa).join(',')} e ` +
  `${outraVez.map(x => x.alfa).join(',')}) — comparar dois bitmaps em branco não prova nada`);
for (let i = 0; i < umaVez.length; i++) {
  ok(umaVez[i].soma === outraVez[i].soma,
    `o bitmap de ${umaVez[i].nome} saiu diferente entre duas repinturas ` +
    `(${umaVez[i].soma} ≠ ${outraVez[i].soma}) — o desenho não é determinístico`);
}
console.log(`    ${umaVez.length} bitmaps idênticos entre duas repinturas ` +
  `(a 1ª pintura difere ~0,6%: é o rasterizador do Chrome, não o desenho)`);

if (erros.length) {
  console.log(`\nerros no console: ${erros.length}\n  ${erros.slice(0, 4).join('\n  ')}`);
  falhas += erros.length;
}

await navegador.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
