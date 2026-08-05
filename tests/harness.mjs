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

// As media queries que o teste declarou verdadeiras. Vazio por padrão, que é o mesmo que
// dizer "tela de computador, sem preferência nenhuma" — o estado em que o harness sempre
// viveu, então nenhuma suíte antiga muda de comportamento.
const preferencias = new Set();

// Liga/desliga uma media query para o jogo. A consulta tem de ser LITERALMENTE a mesma
// string que o jogo passa para o matchMedia — é chato de propósito: se alguém trocar a
// consulta no jogo, o teste para de casar e a asserção fica vermelha, em vez de continuar
// verde testando um mundo que não existe mais.
export function preferir(consulta, ligada = true) {
  if (ligada) preferencias.add(consulta);
  else preferencias.delete(consulta);
}

function makeEl(id) {
  const e = {
    id, textContent: '', innerHTML: '', className: '', value: '', title: '', offsetWidth: 1,
    onclick: null, style: {}, dataset: {}, _cls: new Set(), children: [],
    // Os atributos. É a SEXTA vez que o dublê fica para trás do jogo (as outras foram
    // matchMedia, a captura de ponteiro, o AudioContext, o Peer e os eventos de contexto
    // WebGL), e a lição já está escrita no CLAUDE.md: a tentação é guardar no JOGO com um
    // `if (b.setAttribute)`, e isso troca um defeito por um ramo que o teste nunca alcança.
    // Guardar de verdade é aqui.
    _attr: new Map(),
    setAttribute(k, v) { e._attr.set(k, String(v)); },
    getAttribute: k => (e._attr.has(k) ? e._attr.get(k) : null),
    removeAttribute(k) { e._attr.delete(k); },
    hasAttribute: k => e._attr.has(k),
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
  //
  // OITAVA VEZ da série, e desta vez o buraco não era um método faltando: era o dublê
  // responder SEMPRE a mesma coisa. `matches: false` fixo é o padrão certo para as media
  // queries de celular (o harness roda em 1600×900), e vira um problema no instante em que
  // o jogo passa a perguntar por uma PREFERÊNCIA — `prefers-reduced-motion` —, porque aí
  // o ramo ligado fica inalcançável e um verde não quer dizer nada.
  //
  // A `MediaQueryList` devolvida é VIVA de propósito: o jogo guarda o objeto uma vez
  // (01-constantes.js) e lê `.matches` a cada quadro, que é como o navegador funciona.
  // Um dublê que congelasse o valor na primeira leitura faria `preferir()` não ter efeito
  // e mentiria sobre o jogo.
  global.matchMedia = consulta => ({
    get matches() { return preferencias.has(consulta); },
    media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  });
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
  //
  // MAS ELE GRAVA OS OUVINTES, e é a décima vez que este dublê fica para trás (matchMedia,
  // captura de ponteiro, AudioContext, Peer, contexto WebGL, setAttribute, preventDefault,
  // matchMedia de novo, conn.open — e agora este). O `on()` devolvia `this` e ENGOLIA o
  // registro, então o `conn.on('data')` que o anfitrião instala dentro de
  // `peer.on('connection')` era inalcançável do Node: nenhuma linha de teste jamais entregou
  // uma mensagem malformada à mesa, que é o buraco por onde passaram o C3, o C4 e o C7.
  //
  // Continua não disparando NADA sozinho — quem decide quando a conexão chega é o teste,
  // por `disparar()`. É o que preserva a intenção do parágrafo acima e o que garante que
  // nenhuma suíte existente muda de comportamento ao ganhar isto.
  const gravador = alvo => Object.assign(alvo, {
    ouvintes: new Map(),
    on(evento, cb) {
      if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, []);
      this.ouvintes.get(evento).push(cb);
      return this;
    },
    // Devolve quantos ouvintes correram: zero é informação (ninguém registrou aquele
    // evento), e sem esse número um teste que erra o nome do evento fica verde à toa.
    disparar(evento, ...args) {
      const cbs = this.ouvintes.get(evento) || [];
      cbs.forEach(cb => cb(...args));
      return cbs.length;
    },
  });
  // Nomeada, e não anônima: o `Peer.ultimo` abaixo precisa do vínculo interno da classe —
  // sem ele a linha dependeria de o dublê continuar pendurado no global com este nome.
  global.Peer = class Peer {
    constructor() {
      this.destruido = false;
      gravador(this);
      // O jogo cria o peer lá dentro e não o expõe. Sem este registro o teste não teria
      // como alcançar o que acabou de nascer — e expor pela ponte do jogo seria mudar o
      // código de produção por causa do teste.
      Peer.ultimo = this;
    }
    connect() { return gravador({ send() {}, close() {} }); }
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

// `preventDefault` e `stopPropagation` entram por padrão porque TODO evento de navegador
// os tem: sem eles, código novo que chame um dos dois estoura aqui com TypeError e a
// falha aponta para o teste em vez de para o dublê. É a mesma lição que este arquivo já
// pagou com o matchMedia, a captura de ponteiro, o AudioContext, o Peer, os eventos de
// contexto WebGL e o setAttribute: quem estava incompleto era o dublê, não o jogo.
// O `??=` deixa o teste sobrescrever quando ele quiser ESPIAR se o jogo preveniu.
export function fire(type, ev = {}) {
  ev.preventDefault ??= () => { ev.defaultPrevented = true; };
  ev.stopPropagation ??= () => {};
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
    // `addEventListener` no domElement é a QUINTA vez que este dublê fica para trás do
    // jogo (matchMedia, captura de ponteiro, AudioContext, Peer — e agora os eventos de
    // contexto WebGL). O jogo passou a escutar `webglcontextlost`/`webglcontextrestored`
    // para repintar as texturas de canvas que o Android descarta, e sem isto as três
    // suítes de Node estourariam com TypeError na CARGA do módulo. A tentação é guardar no
    // jogo (`if (domElement.addEventListener)`), e é errado pelo mesmo motivo de sempre:
    // quem está incompleto é o dublê. Guardar os ouvintes num Map deixa o teste DISPARAR o
    // evento, que é o que faz o caminho existir aqui dentro.
    `const renderer = { shadowMap: {}, domElement: { style: {}, _cap: new Set(), _ouv: new Map(),
       setPointerCapture(id){ this._cap.add(id); },
       releasePointerCapture(id){ this._cap.delete(id); },
       hasPointerCapture(id){ return this._cap.has(id); },
       addEventListener(t, f){ if (!this._ouv.has(t)) this._ouv.set(t, []); this._ouv.get(t).push(f); },
       removeEventListener(t, f){ const l = this._ouv.get(t) || []; const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); },
       dispatchEvent(e){ for (const f of this._ouv.get(e && e.type) || []) f(e); return true; } },
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
