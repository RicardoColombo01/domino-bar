// O jogo aberto em cinco tamanhos de tela, no Chrome de verdade, com a pergunta que
// nenhuma suíte em Node consegue fazer: DÁ PARA VER A MÃO?
//
// Existe porque "adaptei para celular" era opinião. O bug do retrato viveu meses num
// projeto com 900 partidas testadas — porque o harness em Node roda sempre em 1600×900
// (tests/harness.mjs fixa innerWidth/innerHeight) e nenhum teste olhava para a tela.
//
// O teste que vale de verdade é o último: projetar cada peça da mão com a MESMA câmera
// que desenha o quadro e conferir que ela caiu dentro do frustum. Ele teria pego o
// retrato sozinho, sem ninguém abrir screenshot.
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOGO = 'file:///' + path.join(import.meta.dirname, '..', 'index.html').split(path.sep).join('/');

const TELAS = [
  { nome: 'retrato 390×844', width: 390, height: 844, touch: true },
  { nome: 'retrato 360×640', width: 360, height: 640, touch: true },
  { nome: 'paisagem 844×390', width: 844, height: 390, touch: true },
  { nome: 'tablet 820×1180', width: 820, height: 1180, touch: true },
  { nome: 'wide 1600×900', width: 1600, height: 900, touch: false },
];

// As situações que mais apertam o HUD: a mão cheia, a mão de 14 do Duelo, e a barra de
// confirmação aberta — que é quando o rodapé tem três coisas disputando a mesma faixa.
const CASOS = [
  { nome: 'mão de 7', montar: `mesa('classico', 3); auto(6);` },
  { nome: 'mão de 14', montar: `mesa('duelo', 2); auto(1);` },
  { nome: 'confirmando', montar: `mesa('classico', 3); escolherUma();` },
  // Tabuleiro comprido: é quando a linha se espalha até a borda da mesa e o círculo dos
  // adversários fica mais apertado. Se algo vai sair do quadro, sai aqui.
  { nome: 'mesa cheia', montar: `mesa('classico', 4); ateALinha(13);` },
];

const AJUDA = `
  const mesa = (modo, n) => {
    const j = window.__jogo;
    j.MESA.modo = modo; j.MESA.n = n;
    for (let i = 1; i < 4; i++) { j.MESA.cadeiras[i].tipo = 'bot'; j.MESA.cadeiras[i].nivel = 'normal'; }
    j.comecarLocal();
  };
  const auto = (n) => {
    const j = window.__jogo;
    for (let i = 0; i < n; i++) {
      const P = j.P;
      if (!P || P.fase !== 'mao') break;
      j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
    }
  };
  // Joga até chegar a sua vez com o tabuleiro já formado, e levanta uma peça: é o
  // estado em que #confirmar, #acoes e #vez brigam pelo mesmo rodapé.
  const escolherUma = () => {
    const j = window.__jogo;
    for (let i = 0; i < 300; i++) {
      const v = j.vista;
      if (v && v.fase === 'mao' && v.vez === v.cadeira && v.linha.length && v.acoes.jogadas.length) {
        j.selecionar(j.naMao.findIndex(m => m.jogavel));
        return;
      }
      auto(1);
      if (!j.P || j.P.fase !== 'mao') mesa('classico', 3);
    }
  };
  const ateALinha = (quantas) => {
    const j = window.__jogo;
    for (let i = 0; i < 400 && j.P.linha.length < quantas; i++) {
      auto(1);
      if (!j.P || j.P.fase !== 'mao') mesa('classico', 4);
    }
  };
`;

// Roda DENTRO da página. Devolve só números e nomes — nada de nó do DOM, que não
// sobrevive à serialização do puppeteer.
const MEDIR = `(() => {
  const j = window.__jogo;
  const vis = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width < 1 || r.height < 1 || getComputedStyle(el).display === 'none') ? null
      : { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  };
  const paineis = {};
  for (const id of ['topo', 'jogadores', 'vez', 'acoes', 'confirmar', 'btSom', 'log']) {
    const r = vis(document.getElementById(id));
    if (r) paineis[id] = r;
  }

  // Cada peça da mão projetada com a câmera que desenha o quadro. Fora de |1| é fora
  // da tela — literalmente, é a definição de frustum em coordenadas normalizadas.
  const V = j.naMao.length ? j.naMao[0].obj.position.constructor : null;
  const pecas = j.naMao.map(m => {
    const v = new V(m.xBase, m.yBase, m.zBase);
    v.project(j.camera);
    return { peca: m.peca.join('|'), x: v.x, y: v.y };
  });

  // O mesmo tratamento para o que está na mesa: o tabuleiro cresce até dobrar na borda,
  // e as mãos dos outros ficam num círculo de raio 4.9 — os dois cabem folgados numa
  // tela larga e não têm por que caber numa estreita.
  const extremo = grupo => {
    let pior = 0;
    for (const o of grupo.children) {
      const v = new V(); o.getWorldPosition(v); v.project(j.camera);
      pior = Math.max(pior, Math.abs(v.x));
    }
    return pior;
  };

  return {
    transbordo: document.documentElement.scrollWidth - window.innerWidth,
    largura: window.innerWidth, altura: window.innerHeight,
    fov: j.camera.fov, paineis, pecas,
    fileiras: new Set(j.naMao.map(m => m.yBase.toFixed(3))).size,
    naLinha: j.vista ? j.vista.linha.length : 0,
    mesa: extremo(j.grupoMesa), outros: extremo(j.grupoOutros), monte: extremo(j.grupoMonte),
  };
})()`;

const ALVO_TOQUE = 40;                    // 44 é a recomendação; 40 tolera a borda
const sobrepoem = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) *
                            Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('    ✗ ' + msg); falhas++; } };

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files'],
});

for (const tela of TELAS) {
  console.log(`\n${tela.nome}`);
  for (const caso of CASOS) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({
      width: tela.width, height: tela.height,
      isMobile: tela.touch, hasTouch: tela.touch, deviceScaleFactor: 1,
    });
    const erros = [];
    pagina.on('pageerror', e => erros.push(e.message));
    pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

    await pagina.goto(JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
    await pagina.waitForFunction('window.__jogo && window.__jogo.pronto',
      { timeout: 30000, polling: 400 });
    await pagina.evaluate(AJUDA + caso.montar);
    await pagina.evaluate(() => new Promise(r => setTimeout(r, 350)));

    const m = await pagina.evaluate(MEDIR);
    const onde = `${tela.nome} · ${caso.nome}`;

    ok(!erros.length, `${onde}: erro no console — ${erros[0]}`);
    ok(m.transbordo <= 0, `${onde}: a página transbordou ${m.transbordo}px na horizontal`);

    // 1. nenhum painel do HUD pode sair da viewport
    for (const [id, r] of Object.entries(m.paineis)) {
      ok(r.x >= -1 && r.r <= m.largura + 1 && r.y >= -1 && r.b <= m.altura + 1,
        `${onde}: #${id} saiu da tela (${r.x.toFixed(0)},${r.y.toFixed(0)} até ${r.r.toFixed(0)},${r.b.toFixed(0)} numa tela de ${m.largura}×${m.altura})`);
    }

    // 2. nenhum par de painéis pode se sobrepor
    const ids = Object.keys(m.paineis);
    for (let i = 0; i < ids.length; i++) {
      for (let k = i + 1; k < ids.length; k++) {
        const area = sobrepoem(m.paineis[ids[i]], m.paineis[ids[k]]);
        ok(area < 40, `${onde}: #${ids[i]} e #${ids[k]} se sobrepõem em ${area.toFixed(0)}px²`);
      }
    }

    // 3. o botão de som é o menor alvo de toque da tela
    if (tela.touch && m.paineis.btSom) {
      const s = m.paineis.btSom;
      ok(Math.min(s.w, s.h) >= ALVO_TOQUE,
        `${onde}: #btSom tem ${s.w.toFixed(0)}×${s.h.toFixed(0)}px, menos que os ${ALVO_TOQUE} do dedo`);
    }

    // 4. O QUE IMPORTA: toda peça da mão dentro do quadro.
    ok(m.pecas.length > 0, `${onde}: a mão não foi desenhada`);
    for (const p of m.pecas) {
      ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
        `${onde}: a peça ${p.peca} caiu FORA da tela (ndc ${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }

    // 5. e o que está na mesa também tem de caber
    ok(m.mesa <= 1, `${onde}: o tabuleiro passou da borda da tela (ndc.x ${m.mesa.toFixed(2)}, com ${m.naLinha} peças na linha)`);
    ok(m.outros <= 1, `${onde}: a mão de um adversário saiu da tela (ndc.x ${m.outros.toFixed(2)})`);
    ok(m.monte <= 1, `${onde}: o monte saiu da tela (ndc.x ${m.monte.toFixed(2)})`);

    const larguraNaTela = m.pecas.length
      ? (Math.max(...m.pecas.map(p => p.x)) - Math.min(...m.pecas.map(p => p.x))) : 0;
    console.log(`  ${caso.nome.padEnd(12)} fov ${m.fov.toFixed(0).padStart(2)}° · ` +
      `${m.pecas.length} peças em ${m.fileiras} fileira(s) · ocupam ${(larguraNaTela * 50).toFixed(0)}% · ` +
      `mesa ${m.mesa.toFixed(2)} outros ${m.outros.toFixed(2)} monte ${m.monte.toFixed(2)}`);

    await pagina.close();
  }
}

await navegador.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
