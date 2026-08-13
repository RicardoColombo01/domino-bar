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

// QUAL É A TAG DE CADA ELEMENTO, lida do próprio HTML do jogo.
//
// É a DÉCIMA TERCEIRA vez que este dublê fica para trás, e a mais silenciosa da série: nenhum
// elemento jamais teve `tagName`, então a guarda `digitando(ev)` de `160-loop.js` — que existe
// para o atalho de teclado não disparar enquanto alguém escreve no chat — lia `undefined` e
// NUNCA bloqueava. Todo teste de atalho em Node passava medindo um mundo em que aquela guarda
// não existe, que é a definição de verde por trivialidade.
//
// Sai do HTML e não de uma lista escrita aqui, pela razão de sempre: lista de ids à mão apodrece
// calada no dia em que alguém acrescenta um campo — e apodrece na direção ruim, deixando o teste
// verde. Sem o arquivo, o mapa fica vazio e tudo se comporta como antes.
let tagsPorId = null;
function tagDe(id) {
  if (!tagsPorId) {
    tagsPorId = new Map();
    try {
      const html = fs.readFileSync(JOGO_HTML, 'utf8');
      for (const [, tag, alvo] of html.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/gi))
        tagsPorId.set(alvo, tag.toUpperCase());
    } catch (e) { void e; }
  }
  return tagsPorId.get(id) || 'DIV';
}

function makeEl(id, tag) {
  const e = {
    id, tagName: String(tag || tagDe(id)).toUpperCase(),
    textContent: '', innerHTML: '', className: '', value: '', title: '', offsetWidth: 1,
    // O `style` GRAVA as propriedades customizadas, e é a DÉCIMA SEGUNDA vez que o dublê fica
    // para trás do jogo. Ele era `{}` puro, e no dia em que a barra de confirmar passou a
    // publicar a própria altura (`style.setProperty('--alt-confirmar', …)`, em 130-hud.js) a
    // suíte inteira morreu com "removeProperty is not a function" — dentro do `publicar`, ou
    // seja longe de onde a causa estava.
    //
    // GRAVA em vez de engolir, pela mesma razão do `history.trocas`: um `setProperty` sem
    // rastro torna inescrevível a asserção "o rodapé se apoia na altura da barra". E o teto
    // continua sendo o de sempre — dublê que responde valor fixo é tão incompleto quanto
    // dublê sem método.
    onclick: null, dataset: {}, _cls: new Set(), children: [],
    style: (() => {
      const props = new Map();
      return {
        props,
        setProperty(k, v) { props.set(k, String(v)); },
        removeProperty(k) { props.delete(k); },
        getPropertyValue: k => (props.has(k) ? props.get(k) : ''),
      };
    })(),
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
    addEventListener() {}, removeEventListener() {}, remove() {}, select() {},
    // O FOCO GRAVA, em vez de ser um no-op. Mesma razão do `style.setProperty` e do
    // `history.trocas`: um `focus()` sem rastro torna inescrevível a asserção "o atalho abriu a
    // conversa E pôs o cursor no campo" — e sem essa metade o atalho abre uma caixa em que
    // ninguém consegue escrever, que é meia funcionalidade com cara de inteira.
    //
    // O `blur` NEM EXISTIA, e o jogo o chama desde a Fila 8 (`HUD.texto.blur()`, no Escape do
    // campo de conversa): qualquer teste que disparasse aquele Escape estouraria com
    // "blur is not a function" apontando para o teste em vez de para o dublê.
    focus() { if (global.document) global.document.activeElement = e; },
    blur() { if (global.document && global.document.activeElement === e) global.document.activeElement = null; },
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
    createElement: tag => (tag === 'canvas' ? makeCanvas() : makeEl(tag, tag)),
    getElementById: id => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    querySelectorAll: () => [],
    querySelector: () => null,
    body: makeEl('body', 'body'),
    addEventListener: (t, fn) => global.addEventListener(t, fn),
    // O TÍTULO DA ABA, com o valor de verdade do `pagina.html`. O `buildModule` extrai só o
    // `<script type="module">`, então nada do HTML chega aqui sozinho — e sem este campo a
    // asserção "voltar para a aba restaura o título original" partiria de `undefined` e não
    // teria contra o que comparar. Ela ficaria verde comparando nada com nada.
    title: 'Dominó de Bar · 2 a 4 jogadores',
    // A ABA ESTÁ NO FUNDO? Os dois campos andam JUNTOS de propósito. Hoje duas suítes escrevem
    // `document.hidden = true` na mão (o gesto interrompido pelo sistema, em test-jogo e
    // test-truco) e nada mantém o `visibilityState` coerente com ele — um jogo que passasse a
    // ler o segundo veria "visible" com a aba escondida. Quem troca os dois é `esconderAba()`.
    hidden: false,
    visibilityState: 'visible',
    // Quem está com o foco. Começa nulo, e só `el.focus()` escreve aqui.
    activeElement: null,
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
  // (010-constantes.js) e lê `.matches` a cada quadro, que é como o navegador funciona.
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
      // E a LISTA, que responde a pergunta que `ultimo` não responde: "nasceu peer novo?".
      // É essa a asserção do temporizador sem dono — um peer que aparece 1,5 s depois de o
      // jogador ter desistido não muda nada de visível, só existe. `Peer.todos.length` antes
      // e depois de `correrTimers()` é como isso vira número.
      Peer.todos.push(this);
    }
    connect() { return gravador({ send() {}, close() {} }); }
    destroy() { this.destruido = true; }
  };
  // Fora do construtor porque campo estático dentro de `class` expressão atribuída ao
  // global fica mais escondido do que ajuda. `ultimo` começa nulo de propósito: um teste
  // que o leia antes de o jogo criar peer nenhum tem de estourar, não devolver o peer de
  // uma cena anterior.
  global.Peer.ultimo = null;
  global.Peer.todos = [];
  // `search` e `history` entram na DÉCIMA PRIMEIRA vez que este dublê fica para trás
  // (matchMedia, captura de ponteiro, AudioContext, Peer, contexto WebGL, setAttribute,
  // preventDefault, matchMedia de novo, conn.open, o `on()` que engolia registro — e agora a
  // URL). A aba de escolher o jogo lê `?jogo=` e reescreve a barra de endereço; sem estas
  // duas linhas o ramo da URL seria inalcançável do Node e o `replaceState` estouraria com
  // TypeError apontando para o teste em vez de para o dublê.
  //
  // E ele GRAVA, como o `Peer` passou a gravar os ouvintes: um `replaceState` que não deixa
  // rastro faz a asserção "a URL passou a dizer qual jogo está na mesa" ser inescrevível. O
  // teste enche `location.search` antes de carregar e lê `history.trocas` depois.
  // O NAVIGATOR, e ele é a DÉCIMA QUARTA vez — com uma armadilha que nenhuma das treze
  // anteriores teve: `global.navigator = {…}` LANÇA neste Node. O `navigator` do Node 24 é um
  // getter sem setter, e o harness roda em ESM (modo estrito), onde atribuir a um getter é
  // TypeError em vez de silêncio. Só `defineProperty` entra por cima.
  //
  // Ele GRAVA o que foi compartilhado e o que foi copiado, pela razão de sempre: sem rastro, a
  // asserção "o convite levou o código e o link" não existe. E as duas portas são REMOVÍVEIS
  // (`semCompartilhar()`), porque o jogo tem três caminhos em cascata — share, clipboard,
  // seleção à mão — e um dublê que responde sempre a mesma coisa deixa dois deles inalcançáveis.
  // É literalmente a oitava lição desta lista, aplicada antes de custar alguma coisa.
  //
  // `vibrate` entra junto: ele é usado pelos dois jogos desde a v1.2 e vivia neste limbo — o
  // jogo o guarda com `navigator.vibrate &&`, então o ramo ligado nunca rodou em Node.
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      compartilhados: [], copiados: [], vibrou: [],
      share(dados) { this.compartilhados.push(dados); return Promise.resolve(); },
      clipboard: { writeText(txt) { globalThis.navigator.copiados.push(String(txt)); return Promise.resolve(); } },
      vibrate(ms) { this.vibrou.push(ms); return true; },
    },
    configurable: true, writable: true,
  });
  global.location = { protocol: 'file:', href: '', search: '', pathname: '/index.html' };
  global.history = {
    trocas: [],
    replaceState(estado, titulo, url) { this.trocas.push(url); global.location.search = String(url).replace(/^[^?]*/, ''); },
  };
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

// TROCAR DE APLICATIVO, e voltar. Os dois campos que o navegador mantém juntos são trocados
// juntos aqui, e o evento sai depois — que é a ordem do navegador de verdade: quando o
// `visibilitychange` chega, `document.hidden` JÁ vale o valor novo. Um teste que dispare o evento
// antes de trocar o campo mede o estado anterior e passa pelo motivo errado.
export function esconderAba() {
  global.document.hidden = true;
  global.document.visibilityState = 'hidden';
  fire('visibilitychange');
}

export function mostrarAba() {
  global.document.hidden = false;
  global.document.visibilityState = 'visible';
  fire('visibilitychange');
}

// AS DUAS PORTAS DO CONVITE, tiradas de cena. O jogo tenta `share`, cai para `clipboard` e cai
// para a seleção à mão; sem poder remover as de cima, os dois ramos de baixo são inalcançáveis —
// e ramo inalcançável é ramo que ninguém prova.
//
// DEVOLVE A FUNÇÃO QUE REPÕE, e isso não é conveniência: `installStubs()` roda UMA vez por suíte,
// então um `delete` sem volta contamina todos os blocos seguintes — que é a lição de "cena que
// mexe em estado compartilhado tem de devolver como encontrou", já paga três vezes aqui (o
// localStorage das telas, o MESA do online, o P do harness).
export function semCompartilhar({ share = true, clipboard = true } = {}) {
  const n = globalThis.navigator;
  const guardados = { share: n.share, clipboard: n.clipboard };
  if (share) delete n.share;
  if (clipboard) delete n.clipboard;
  return () => { n.share = guardados.share; n.clipboard = guardados.clipboard; };
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
// TUDO QUE É GERADO MORA NUM LUGAR SÓ. Antes os cinco `built*.mjs` e as fotos ficavam
// soltos em `tests/`, misturados com as suítes que uma pessoa escreveu — e dois deles
// (`built-dbg`, `built-busca`) eram sobras que ninguém sabia dizer se ainda serviam. Com a
// pasta, `tests/` mostra só o que é fonte, e o `.gitignore` vira uma linha em vez de três.
const GERADO = '.gerado';

export function buildModule(exportar, htmlPath = JOGO_HTML, outPath = path.join(import.meta.dirname, GERADO, 'built.mjs')) {
  // A pasta pode não existir num clone novo ou num worktree recém-criado, e ela é ignorada
  // pelo git — então quem escreve é quem a cria.
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
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
