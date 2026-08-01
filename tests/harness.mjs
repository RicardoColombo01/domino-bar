// Monta o jogo inteiro em Node: stub de DOM + canvas 2d + renderer, three.js real.
// Adaptado do harness do goleiro-3d. Assim a construção da cena roda de verdade e
// qualquer geometria inválida ou variável indefinida estoura aqui, no terminal.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export const els = new Map();
export const listeners = new Map();
export const rafQueue = [];
export const timers = new Map();
let proxTimer = 0;
let fakeTime = 0;

// Dispara os setTimeout pendentes. Só a leva atual: um callback que agenda outro fica
// para a próxima chamada, senão um temporizador que se reagenda travaria o teste.
export function correrTimers() {
  const leva = [...timers.entries()];
  timers.clear();
  for (const [, t] of leva) t.fn();
  return leva.length;
}

function makeEl(id) {
  const e = {
    id, textContent: '', innerHTML: '', className: '', value: '', offsetWidth: 1,
    onclick: null, style: {}, dataset: {}, _cls: new Set(), children: [],
    classList: {
      add: c => e._cls.add(c), remove: c => e._cls.delete(c),
      contains: c => e._cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !e._cls.has(c) : on; v ? e._cls.add(c) : e._cls.delete(c); return v; },
    },
    scrollTop: 0, scrollHeight: 0,
    appendChild(ch) { e.children.push(ch); return ch; },
    removeChild(ch) { const i = e.children.indexOf(ch); if (i >= 0) e.children.splice(i, 1); return ch; },
    addEventListener() {}, removeEventListener() {}, remove() {}, focus() {}, select() {},
    querySelectorAll: () => [], querySelector: () => null,
  };
  return e;
}

function makeCanvas() {
  const ctx = new Proxy({}, {
    get: (_, p) => {
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set: () => true,
  });
  return { width: 0, height: 0, getContext: () => ctx, style: {}, toDataURL: () => '' };
}

export function installStubs() {
  global.document = {
    createElement: tag => (tag === 'canvas' ? makeCanvas() : makeEl(tag)),
    getElementById: id => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    querySelectorAll: () => [],
    querySelector: () => null,
    body: makeEl('body'),
    addEventListener: (t, fn) => global.addEventListener(t, fn),
  };
  global.window = global;
  global.innerWidth = 1600;
  global.innerHeight = 900;
  global.devicePixelRatio = 1;
  // O harness roda sempre em 1600×900, então nenhuma media query de celular casa — e é
  // exatamente isso que este dublê devolve. Existe porque o HUD passou a perguntar à
  // tela se está em modo gaveta: guardar com `typeof matchMedia` no jogo seria peso morto
  // em qualquer navegador de verdade, já que quem não tem matchMedia também não tem WebGL.
  // Quem estava incompleto era o dublê, não o jogo.
  global.matchMedia = consulta => ({ matches: false, media: consulta,
    addEventListener: () => {}, removeEventListener: () => {} });
  global.performance = { now: () => (fakeTime += 1000 / 60) };
  global.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  };
  global.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };
  // setTimeout vai para uma fila que o teste drena quando quiser. Engolir o callback
  // (o que um stub vazio faria) esconderia justamente o que passou a depender dele —
  // a vez do bot, que saiu do requestAnimationFrame por causa de aba em segundo plano.
  global.setTimeout = (fn, ms) => { timers.set(++proxTimer, { fn, ms }); return proxTimer; };
  global.clearTimeout = id => timers.delete(id);
  // AudioContext DE VERDADE no que importa: o `state` e o par suspend/resume, que é como
  // o mudo é implementado. Antes isto era `undefined`, e com ele o áudio inteiro nunca
  // ligava — o mudo ficava sem teste nenhum, e foi assim que passou despercebido que ele
  // durava exatamente um clique. Mesma lição do matchMedia e da captura de ponteiro:
  // quem estava incompleto era o dublê, não o jogo.
  //
  // O resto (filtros, ganhos, osciladores) é um Proxy que responde qualquer coisa sem
  // fazer nada: o teste não mede som, mede a DECISÃO de tocar ou calar.
  const nada = () => new Proxy(function () {}, {
    get: (alvo, p) => {
      if (p === 'value') return 0;
      if (!(p in alvo)) alvo[p] = nada();
      return alvo[p];
    },
    set: () => true,
    apply: () => nada(),
  });
  global.AudioContext = class {
    constructor() {
      this.state = 'running';
      this.sampleRate = 44100;
      this.currentTime = 0;
      this.destination = nada();
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createBuffer(_canais, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBufferSource() { return nada(); }
    createGain() { return nada(); }
    createBiquadFilter() { return nada(); }
    createOscillator() { return nada(); }
  };
  global.Image = class {};
  // Peer que ABRE E NÃO FALA. Não serve para testar rede — o test-online.mjs faz isso no
  // Chrome, com duas abas e uma mesa de verdade. Serve para o jogo poder ENTRAR em modo
  // anfitrião aqui dentro, que é um estado com regras próprias e que até agora nenhum
  // teste em Node conseguia alcançar: `temPeerJS()` era falso, `abrirMesaOnline` desistia
  // na primeira linha, e `modo` ficava eternamente 'local'.
  //
  // Foi por isso que a revanche travada passou despercebida: o ramo com defeito só existe
  // quando `modo !== 'local'`. Um dublê que nunca deixa o código chegar no estado
  // interessante dá um verde que não quer dizer nada.
  //
  // Ele não dispara 'open' de propósito: o que se quer é o modo, não a sessão.
  global.Peer = class {
    constructor() { this.destruido = false; }
    on() { return this; }
    connect() { return { on() {}, send() {}, close() {} }; }
    destroy() { this.destruido = true; }
  };
  global.location = { protocol: 'file:', href: '' };
}

// Math.random determinístico: sem isso o mesmo teste passa numa rodada e falha na
// outra (ex.: uma partida em que nunca sai uma cruzada). Com semente fixa, uma falha
// é sempre reproduzível — e dá para medir estatística sobre milhares de mãos.
export function seedRandom(seed = 1) {
  let s = seed >>> 0;
  global.Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fire(type, ev = {}) {
  for (const fn of listeners.get(type) || []) fn(ev);
}

// O navegador passa o instante do quadro para o callback do requestAnimationFrame.
// Sem isso aqui o dt do jogo sai NaN e todo temporizador (o do bot, por exemplo)
// simplesmente nunca dispara — e o teste passaria sem nunca ter rodado o loop.
export function frames(n) {
  for (let i = 0; i < n; i++) {
    const cb = rafQueue.shift();
    if (!cb) throw new Error('loop parou de agendar frames no frame ' + i);
    cb(performance.now());
  }
}

export const JOGO_HTML = path.join(import.meta.dirname, '..', 'index.html');

// Transforma o módulo do jogo num .mjs importável: troca o renderer WebGL por um stub
// e acrescenta os exports que os testes pedem.
//
// A troca do renderer é OPCIONAL de propósito: enquanto o projeto ainda é só o motor
// de regras, não existe WebGLRenderer nenhum para trocar, e exigir isso deixaria os
// testes de regra reféns do 3D existir.
export function buildModule(exportar, htmlPath = JOGO_HTML, outPath = path.join(import.meta.dirname, 'built.mjs')) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  let src = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

  src = src.replace(
    /const renderer = new THREE\.WebGLRenderer\([^)]*\);/,
    // A captura de ponteiro é de VERDADE (um Set) porque o jogo passou a PERGUNTAR a ela
    // se o dedo ainda está na tela: é assim que ele descobre que um `pointerup` nunca vai
    // chegar. Um dublê que só tivesse os métodos vazios responderia "não tenho captura" e
    // o caminho inteiro do toque preso ficaria sem teste. Note que aqui a captura NÃO é
    // solta sozinha no pointerup, como o navegador faz — quem quiser simular o dedo
    // sumindo chama `releasePointerCapture` na mão, que é exatamente o que o sistema faz.
    `const renderer = { shadowMap: {}, domElement: { style: {}, _cap: new Set(),
       setPointerCapture(id){ this._cap.add(id); },
       releasePointerCapture(id){ this._cap.delete(id); },
       hasPointerCapture(id){ return this._cap.has(id); } },
       setSize(){}, setPixelRatio(){}, setClearColor(){}, render(){ this.calls=(this.calls||0)+1; } };`
  );
  // No navegador `three/addons/` vem do importmap; aqui tem de apontar para o pacote instalado.
  src = src.replace(/'three\/addons\//g, "'./node_modules/three/examples/jsm/");

  src += `\nexport { ${exportar.join(', ')} };\n`;
  fs.writeFileSync(outPath, src);
  // No Windows, import() de caminho absoluto ("C:\...") é recusado pelo loader ESM —
  // tem de ser uma URL file://. Devolver já convertido evita repetir isso em cada teste.
  return pathToFileURL(outPath).href;
}
