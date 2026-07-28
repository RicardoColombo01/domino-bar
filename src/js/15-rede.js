// Online sem servidor: PeerJS (WebRTC), com o anfitrião mandando na partida.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// O ANFITRIÃO É A AUTORIDADE. Ele embaralha, guarda o estado e valida tudo. O
// convidado não tem partida nenhuma na memória: ele manda INTENÇÃO ("quero jogar 3|5
// na esquerda") e recebe de volta a visaoDe dele — que nunca inclui a mão dos outros.
// Trapacear pelo DevTools não é difícil, é impossível: o dado não está lá.
//
//   convidado ──{t:'acao'}──►  anfitrião ──valida com acoesDe()──► aplica
//   convidado  ◄─{t:'vista'}── anfitrião ──uma visão diferente para cada cadeira

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sem I/O/0/1: código é para ditar em voz alta
const PREFIXO = 'dominobar-';
const OPCOES_PEER = { config: { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
] } };

let peer = null;
let conexoes = new Map();      // cadeira → conn (no anfitrião)
let linkAnfitriao = null;      // conn (no convidado)

const codigoNovo = () => Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
const temPeerJS = () => typeof Peer !== 'undefined';

function erroOnline(txt) {
  el('onlineErro').textContent = txt;
}

function encerrarRede() {
  conexoes.forEach(c => { try { c.close(); } catch (e) { void e; } });
  conexoes.clear();
  if (linkAnfitriao) { try { linkAnfitriao.close(); } catch (e) { void e; } linkAnfitriao = null; }
  if (peer) { try { peer.destroy(); } catch (e) { void e; } peer = null; }
  modo = 'local';
}

// ─── anfitrião ───────────────────────────────────────────────────────────────
function abrirMesaOnline() {
  if (!temPeerJS()) { avisar('A biblioteca de rede não carregou — sem internet, só dá para jogar local.'); return; }
  encerrarRede();
  modo = 'anfitriao';
  mostrarTela('telaOnline');
  el('onlineTitulo').textContent = 'Mesa aberta';
  el('onlineSub').textContent = 'Passe este código para quem vai jogar.';
  el('onlineEntrada').classList.add('oculta');
  el('btConectar').classList.add('oculta');
  el('btIniciarOnline').classList.remove('oculta');
  el('onlineCodigo').textContent = '····';
  erroOnline('');
  tentarAbrir(0);
}

function tentarAbrir(tentativa) {
  const codigo = codigoNovo();
  peer = new Peer(PREFIXO + codigo, OPCOES_PEER);

  peer.on('open', () => {
    el('onlineCodigo').textContent = codigo;
    listarSala();
  });

  peer.on('connection', conn => {
    const cadeira = MESA.cadeiras.slice(0, MESA.n)
      .findIndex((c, i) => c.tipo === 'online' && !conexoes.has(i));
    if (cadeira < 0) { conn.on('open', () => { conn.send({ t: 'cheio' }); setTimeout(() => conn.close(), 0); }); return; }

    conexoes.set(cadeira, conn);
    conn.on('open', () => {
      conn.send({ t: 'sentou', cadeira, cadeiras: MESA.cadeiras.slice(0, MESA.n).map(c => c.nome) });
      listarSala();
      if (P) publicar();                                  // entrou no meio da partida: já recebe a mesa
    });
    conn.on('data', m => {
      if (m.t === 'nome') { MESA.cadeiras[cadeira].nome = String(m.nome).slice(0, 14) || 'Visita'; listarSala(); if (P) publicar(); }
      if (m.t === 'acao' && P) aplicarIntencao(cadeira, m);
    });
    conn.on('close', () => {
      conexoes.delete(cadeira);
      // Caiu no meio do jogo? A cadeira vira bot em vez de travar a mesa inteira.
      if (P && P.fase !== 'fim') {
        P.cadeiras[cadeira].tipo = 'bot';
        P.cadeiras[cadeira].nivel = 'normal';
        anotar(`${P.cadeiras[cadeira].nome} caiu — um bot assumiu a cadeira.`);
        publicar();
        seguirOTurno();
      }
      listarSala();
    });
  });

  peer.on('error', e => {
    // Código sorteado já em uso: tenta outro. Qualquer outro erro, avisa em português.
    if (e.type === 'unavailable-id' && tentativa < 4) { peer.destroy(); tentarAbrir(tentativa + 1); return; }
    erroOnline(explicarErroDeRede(e));
  });
}

function listarSala() {
  const faltam = MESA.cadeiras.slice(0, MESA.n).filter((c, i) => c.tipo === 'online' && !conexoes.has(i)).length;
  el('onlineLista').innerHTML = MESA.cadeiras.slice(0, MESA.n).map((c, i) => {
    const estado = c.tipo === 'online' ? (conexoes.has(i) ? 'chegou' : 'esperando…') : (ETIQUETA[c.tipo] || c.tipo);
    return `<div><span>${c.nome}</span><b>${estado}</b></div>`;
  }).join('');
  el('btIniciarOnline').textContent = faltam ? `Faltam ${faltam} · começar assim mesmo` : 'Começar a partida';
}

el('btIniciarOnline').onclick = () => {
  // Cadeira online vazia na hora de começar vira bot: melhor jogar do que esperar.
  MESA.cadeiras.slice(0, MESA.n).forEach((c, i) => {
    if (c.tipo === 'online' && !conexoes.has(i)) { c.tipo = 'bot'; c.nivel = 'normal'; }
  });
  comecarLocal();
};

el('btCancelarOnline').onclick = () => { encerrarRede(); mostrarTela('telaMenu'); };

// ─── convidado ───────────────────────────────────────────────────────────────
function entrarNumaMesa() {
  if (!temPeerJS()) { avisar('A biblioteca de rede não carregou — sem internet, só dá para jogar local.'); return; }
  encerrarRede();
  mostrarTela('telaOnline');
  el('onlineTitulo').textContent = 'Entrar numa mesa';
  el('onlineSub').textContent = 'Digite o código que o anfitrião passou.';
  el('onlineCodigo').textContent = '';
  el('onlineEntrada').classList.remove('oculta');
  el('onlineEntrada').value = '';
  el('onlineEntrada').focus();
  el('btConectar').classList.remove('oculta');
  el('btIniciarOnline').classList.add('oculta');
  el('onlineLista').innerHTML = '';
  erroOnline('');
}

el('btConectar').onclick = () => {
  const codigo = el('onlineEntrada').value.trim().toUpperCase();
  if (codigo.length < 3) { erroOnline('Faltou o código.'); return; }
  erroOnline('Procurando a mesa…');
  modo = 'convidado';
  peer = new Peer(OPCOES_PEER);
  peer.on('open', () => {
    linkAnfitriao = peer.connect(PREFIXO + codigo, { reliable: true });
    linkAnfitriao.on('open', () => {
      erroOnline('Conectado. Esperando o anfitrião começar…');
      linkAnfitriao.send({ t: 'nome', nome: MESA.cadeiras[0].nome });
    });
    linkAnfitriao.on('data', m => {
      if (m.t === 'cheio') { erroOnline('Essa mesa já está cheia.'); return; }
      if (m.t === 'sentou') { euNaTela = m.cadeira; erroOnline(`Você é a cadeira ${m.cadeira + 1}.`); }
      if (m.t === 'vista') { esconderTelas(); ligarMurmuro(); atualizarVista(m.v); }
      if (m.t === 'log') anotar(m.txt);
    });
    linkAnfitriao.on('close', () => { avisar('A mesa fechou.'); mostrarTela('telaMenu'); modo = 'local'; });
  });
  peer.on('error', e => erroOnline(explicarErroDeRede(e)));
};

function explicarErroDeRede(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Não achei essa mesa. Confira o código — e o anfitrião precisa estar com a página aberta.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error')
    return 'O servidor gratuito de encontro do PeerJS não respondeu. Tente de novo em alguns segundos.';
  if (t === 'browser-incompatible') return 'Este navegador não tem WebRTC.';
  if (t === 'unavailable-id') return 'Não consegui reservar um código. Tente de novo.';
  if (t === 'webrtc' || t === 'disconnected')
    return 'A conexão direta não fechou. Redes de empresa e alguns provedores bloqueiam WebRTC — num 4G ou noutra rede costuma passar.';
  return 'Falha de rede: ' + (t || 'desconhecida') + '.';
}

// Chamado pelo anfitrião depois de cada mudança: cada cadeira recebe a SUA visão.
function espalharVistas() {
  for (const [cadeira, conn] of conexoes) {
    if (conn.open) conn.send({ t: 'vista', v: visaoDe(P, cadeira) });
  }
}
function espalharLog(txt) {
  for (const conn of conexoes.values()) if (conn.open) conn.send({ t: 'log', txt });
}
