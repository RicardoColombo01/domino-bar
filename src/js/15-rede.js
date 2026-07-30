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
let esperando = new Map();     // cadeira → temporizador de volta (no anfitrião)
let linkAnfitriao = null;      // conn (no convidado)

// Quanto tempo a cadeira fica guardada para quem caiu. Curto o bastante para a mesa não
// morrer de tédio, longo o bastante para uma troca de wi-fi ou um túnel de metrô.
const ESPERA_VOLTA = 30000;

const codigoNovo = () => Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
const temPeerJS = () => typeof Peer !== 'undefined';

function erroOnline(txt) {
  el('onlineErro').textContent = txt;
}

function encerrarRede() {
  esperando.forEach(t => clearTimeout(t));
  esperando.clear();
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
      // Voltou dentro do prazo: cancela o relógio e a cadeira é dele de novo. Funciona
      // porque a cadeira continua marcada como 'online' — é justamente por isso que ela
      // não vira bot na hora da queda.
      if (esperando.has(cadeira)) {
        clearTimeout(esperando.get(cadeira));
        esperando.delete(cadeira);
        if (P && P.fase !== 'fim') narrar(`${MESA.cadeiras[cadeira].nome} voltou para a mesa.`);
      }
      conn.send({ t: 'sentou', cadeira, cadeiras: MESA.cadeiras.slice(0, MESA.n).map(c => c.nome) });
      listarSala();
      if (P) publicar();                                  // entrou no meio da partida: já recebe a mesa
    });
    conn.on('data', m => {
      if (m.t === 'nome') { MESA.cadeiras[cadeira].nome = String(m.nome).slice(0, 14) || 'Visita'; listarSala(); if (P) publicar(); }
      if (m.t === 'acao' && P) aplicarIntencao(cadeira, m);
      if (m.t === 'chat') receberChat(cadeira, m);
      // Saiu de propósito: não há prazo de volta, a partida acaba perdida para ele.
      if (m.t === 'desisto' && P && P.fase !== 'fim') {
        clearTimeout(esperando.get(cadeira)); esperando.delete(cadeira);
        abandonar(P, cadeira);
        narrar(`${P.cadeiras[cadeira].nome} saiu da mesa — a partida foi dada como perdida para ele.`);
        publicar();
      }
    });
    conn.on('close', () => {
      conexoes.delete(cadeira);
      // Caiu no meio do jogo? A CADEIRA FICA GUARDADA. Antes ela virava bot na hora, e
      // com isso fechar a aba era a saída de emergência de qualquer partida perdida:
      // não custava nada. Agora há um prazo para voltar — e, esgotado, a partida conta
      // como derrota de quem saiu.
      if (P && P.fase !== 'fim') {
        const nome = P.cadeiras[cadeira].nome;
        narrar(`${nome} caiu — a cadeira fica guardada por ${ESPERA_VOLTA / 1000}s.`);
        clearTimeout(esperando.get(cadeira));
        // setTimeout e NÃO um contador no requestAnimationFrame: o rAF para em aba de
        // fundo, e o prazo tem de correr mesmo com o anfitrião noutra aba.
        esperando.set(cadeira, setTimeout(() => {
          esperando.delete(cadeira);
          if (!P || P.fase === 'fim' || conexoes.has(cadeira)) return;
          abandonar(P, cadeira);
          narrar(`${nome} não voltou — a partida foi dada como perdida para ele.`);
          publicar();
        }, ESPERA_VOLTA));
        publicar();
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
    // ESCAPADO: este nome foi escrito pelo convidado (`m.nome`, ali em cima) e ia direto
    // para innerHTML. É o mesmo buraco do texto do chat, na tela ao lado — e mais antigo
    // que ele. Um nome com <img onerror> rodava script na máquina do anfitrião.
    return `<div><span>${escapar(c.nome)}</span><b>${estado}</b></div>`;
  }).join('');
  el('btIniciarOnline').textContent = faltam ? `Faltam ${faltam} · começar assim mesmo` : 'Começar a partida';
  salaDuplas = MESA.n === 4;
  atualizarSaguao();
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
      if (m.t === 'sentou') {
        euNaTela = m.cadeira;
        erroOnline(`Você é a cadeira ${m.cadeira + 1}.`);
        // A partir daqui há com quem conversar, e `modo` já é 'convidado': a conversa do
        // saguão liga. O tamanho da lista de nomes é o número de cadeiras, e é dele que
        // sai se a mesa é em duplas — o convidado não tem MESA.n do anfitrião.
        salaDuplas = Array.isArray(m.cadeiras) && m.cadeiras.length === 4;
        atualizarSaguao();
      }
      if (m.t === 'vista') { esconderTelas(); ligarMurmuro(); atualizarVista(m.v); }
      if (m.t === 'log') anotar(m.txt);
      if (m.t === 'chat') dizer(vistaAtual, m.de, m.canal, m.txt, m.nome);
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

// ─── a conversa ──────────────────────────────────────────────────────────────
// Os convidados NÃO se enxergam: toda mensagem passa pelo anfitrião. Ele é quem escolhe
// quem recebe, exatamente como já faz com as visões — e é por isso que a conversa da
// dupla não é secreta PARA ELE. Quem escreve vê isso dito no campo.
const ULTIMA_FALA = new Map();          // cadeira → quando falou pela última vez
const INTERVALO_FALA = 600;             // ms
const TAMANHO_FALA = 160;

// Qual cadeira DESTA tela era a destinatária de uma fala de dupla vinda de `de`, ou -1.
// "Desta tela" é `voce` e `local`: as que o hotseat mostra. Bot não lê e online já
// recebeu pelo fio.
function donoLocalDaFala(de) {
  if (!P || !P.duplas) return -1;
  for (let c = 0; c < P.cadeiras.length; c++) {
    const t = MESA.cadeiras[c].tipo;
    if (t !== 'voce' && t !== 'local') continue;
    if (timeDe(P, c) === timeDe(P, de)) return c;
  }
  return -1;
}

// Quem é do time de quem, mesmo antes de existir partida: as duplas são em cruz, por
// CADEIRA, então a conta sai da mesa que está sendo montada. É o que faz o canal da dupla
// valer no saguão em vez de virar um "todos" disfarçado — que seria pior que não existir.
const mesaEmDuplas = () => (P ? { duplas: P.duplas } : { duplas: MESA.n === 4 });

function espalharChat(de, canal, txt) {
  const fala = String(txt).slice(0, TAMANHO_FALA);
  const quem = mesaEmDuplas();
  const mesmoTime = c => !quem.duplas || timeDe(quem, c) === timeDe(quem, de);
  // O nome vai no fio SÓ para o saguão, onde não existe vista de onde tirá-lo. Sai do
  // MESA do anfitrião, nunca do que o convidado mandou: com a partida de pé, `dizer`
  // ignora isto e usa a vista, como sempre.
  const nome = (MESA.cadeiras[de] && MESA.cadeiras[de].nome) || 'Alguém';
  // Quem está no anfitrião também lê, se a mensagem for para ele. `euNaTela` NÃO é "a
  // cadeira do anfitrião": é a cadeira que a tela mostra agora, e o hotseat a troca. Numa
  // mesa mista a fala da dupla pode chegar com a tela na mão de um adversário local — aí
  // ela fica guardada para quando a vez voltar, em vez de sumir.
  // Sem o `if (vistaAtual)` que havia aqui: no saguão não existe vista, e era por isso que
  // o anfitrião não lia nem a própria fala enquanto esperava. `dizer` aceita vista nula e
  // cai no nome do fio.
  if (canal === 'todos' || mesmoTime(euNaTela)) dizer(vistaAtual, de, canal, fala, nome);
  else {
    // A fala é da dupla e a tela não está com quem podia ler. Só vale guardar se o
    // dono for uma cadeira DESTA tela — se for um convidado, ele já recebeu pelo fio.
    const dono = donoLocalDaFala(de);
    if (dono >= 0) guardarFala(de, canal, fala, dono);
  }
  for (const [cadeira, conn] of conexoes) {
    if (!conn.open) continue;
    if (canal === 'dupla' && !mesmoTime(cadeira)) continue;
    conn.send({ t: 'chat', de, canal, txt: fala, nome });
  }
}

// As duas guardas são do ANFITRIÃO porque é ele a autoridade: sem elas um convidado
// trava a mesa dos outros com um laço de mensagens.
//
// E o anfitrião passa por aqui também. Antes ele falava direto no `espalharChat` e era o
// único da mesa que podia inundar os outros — assimetria sem razão de ser, porque a
// autoridade dele é sobre a PARTIDA, não sobre o ritmo da conversa. Devolve se a fala
// passou, para quem chamou poder avisar em vez de engolir o texto em silêncio.
function receberChat(cadeira, m) {
  const agora = Date.now();
  if (agora - (ULTIMA_FALA.get(cadeira) || 0) < INTERVALO_FALA) return false;
  const txt = String(m.txt || '').slice(0, TAMANHO_FALA).trim();
  if (!txt) return false;
  ULTIMA_FALA.set(cadeira, agora);
  espalharChat(cadeira, m.canal === 'dupla' ? 'dupla' : 'todos', txt);
  return true;
}
