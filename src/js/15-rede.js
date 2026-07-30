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
let donoDaCadeira = new Map(); // cadeira → clienteId (no anfitrião)
let linkAnfitriao = null;      // conn (no convidado)

// Quanto tempo a cadeira fica guardada para quem caiu. Curto o bastante para a mesa não
// morrer de tédio, longo o bastante para uma troca de wi-fi ou um túnel de metrô.
const ESPERA_VOLTA = 30000;

const codigoNovo = () => Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
const temPeerJS = () => typeof Peer !== 'undefined';

// QUEM É VOCÊ. Sorteado uma vez e guardado para sempre — é o que faz o anfitrião saber
// que você é VOCÊ voltando, e não alguém novo pegando a vaga que sobrou.
//
// Sem isto, a cadeira saía da primeira vaga livre e o número da cadeira é a CHAVE da
// `visaoDe`: quem pegasse a vaga recebia a mão de quem estava nela. Dois convidados que
// caem e voltam trocavam de mão — em duplas, de dupla. A `visaoDe` nunca vazou nada; o
// furo era o motor achar que você era outra pessoa.
//
// Não tem prazo, ao contrário de `partida`: identidade não vence.
//
// LIDO NA CARGA e guardado em memória, não relido a cada uso. Duas coisas dependem disso:
// a identidade desta aba não pode mudar no meio da partida porque outra aba escreveu no
// armazenamento (que é da origem inteira, não da aba); e o teste do online precisa dar um
// id a cada aba, coisa que só funciona se cada uma fixar o seu na carga.
//
// A GERAÇÃO é preguiçosa de propósito: sortear na carga gastaria Math.random, e no
// harness dos testes ele é semeado — o embaralho inteiro andaria, e uma suíte que depende
// de "quem abre" passaria a falhar sem que nada do que ela testa tivesse mudado.
let idCliente = lido('cliente', '');
function meuId() {
  if (typeof idCliente !== 'string' || !idCliente) {
    idCliente = Array.from({ length: 16 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    guardar('cliente', idCliente);
  }
  return idCliente;
}

function erroOnline(txt) {
  el('onlineErro').textContent = txt;
}

function encerrarRede() {
  esperando.forEach(t => clearTimeout(t));
  esperando.clear();
  donoDaCadeira.clear();
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
    // A CADEIRA NÃO É MAIS ESCOLHIDA AQUI, e essa é a mudança de fundo. Antes ela saía da
    // primeira vaga livre no instante da conexão — antes de o convidado ter dito uma
    // palavra —, o que é cedo demais: não existe ainda a informação para decidir. Agora
    // espera-se o aperto de mão, e quem senta é `sentar()`.
    let cadeira = -1;

    conn.on('data', m => {
      if (cadeira < 0) {
        // `ola` traz o clienteId. Um `nome` solto é convidado de versão antiga (uma
        // página em cache), e ele senta como anônimo — o comportamento de antes. Quebrar
        // quem não recarregou seria pior que a falta de identidade dele.
        if (m.t !== 'ola' && m.t !== 'nome') return;
        cadeira = sentar(conn, m.t === 'ola' ? String(m.id || '') : '', m.nome);
        return;
      }
      if (m.t === 'nome') { MESA.cadeiras[cadeira].nome = String(m.nome).slice(0, 14) || 'Visita'; listarSala(); if (P) publicar(); }
      if (m.t === 'acao' && P) aplicarIntencao(cadeira, m);
      if (m.t === 'chat') receberChat(cadeira, m);
      // Saiu de propósito: não há prazo de volta, a partida acaba perdida para ele. E a
      // cadeira deixa de ser dele: quem desiste não volta com o mesmo clienteId.
      if (m.t === 'desisto' && P && P.fase !== 'fim') {
        clearTimeout(esperando.get(cadeira)); esperando.delete(cadeira);
        donoDaCadeira.delete(cadeira);
        abandonar(P, cadeira);
        narrar(`${P.cadeiras[cadeira].nome} saiu da mesa — a partida foi dada como perdida para ele.`);
        publicar();
      }
    });
    conn.on('close', () => { if (cadeira >= 0) largar(cadeira, conn); });
  });

  peer.on('error', e => {
    // Código sorteado já em uso: tenta outro. Qualquer outro erro, avisa em português.
    if (e.type === 'unavailable-id' && tentativa < 4) { peer.destroy(); tentarAbrir(tentativa + 1); return; }
    erroOnline(explicarErroDeRede(e));
  });
}

// Quem senta onde. Chamada no aperto de mão, e não na conexão, porque é aqui que pela
// primeira vez se sabe QUEM chegou. Devolve a cadeira, ou -1 se a mesa estiver cheia.
function sentar(conn, id, nome) {
  const cadeiras = MESA.cadeiras.slice(0, MESA.n);

  // 1. A cadeira de quem já é dono dela. É esta linha que faz "voltar" ser VOLTAR, e não
  //    "entrar de novo em qualquer lugar".
  let cadeira = id ? cadeiras.findIndex((c, i) => donoDaCadeira.get(i) === id) : -1;

  // A mesma pessoa noutra aba — fechar o notebook e abrir no celular é o caso real. A
  // conexão NOVA ganha, porque a velha é justamente a que provavelmente já morreu sem
  // avisar. Recusar deixaria você trancado do lado de fora da sua própria cadeira.
  if (cadeira >= 0 && conexoes.has(cadeira)) {
    const velha = conexoes.get(cadeira);
    conexoes.delete(cadeira);
    try { velha.send({ t: 'expulso' }); velha.close(); } catch (e) { void e; }
  }

  // 2. Senão, a primeira vaga que não tem dono esperando por ela. `donoDaCadeira` é o que
  //    RESERVA o assento durante o ESPERA_VOLTA: antes o prazo só adiava o abandonar(),
  //    e um estranho com o código sentava na cadeira de quem tinha caído.
  if (cadeira < 0) {
    cadeira = cadeiras.findIndex((c, i) => c.tipo === 'online' && !conexoes.has(i) && !donoDaCadeira.has(i));
  }
  if (cadeira < 0) { try { conn.send({ t: 'cheio' }); } catch (e) { void e; } setTimeout(() => conn.close(), 0); return -1; }

  if (id) donoDaCadeira.set(cadeira, id);
  conexoes.set(cadeira, conn);
  if (nome !== undefined) MESA.cadeiras[cadeira].nome = String(nome).slice(0, 14) || 'Visita';

  // Voltou dentro do prazo: cancela o relógio. Funciona porque a cadeira continua marcada
  // como 'online' — é justamente por isso que ela não vira bot na hora da queda.
  if (esperando.has(cadeira)) {
    clearTimeout(esperando.get(cadeira));
    esperando.delete(cadeira);
    if (P && P.fase !== 'fim') narrar(`${MESA.cadeiras[cadeira].nome} voltou para a mesa.`);
  }
  conn.send({ t: 'sentou', cadeira, cadeiras: cadeiras.map(c => c.nome) });
  listarSala();
  if (P) publicar();                                    // entrou no meio da partida: já recebe a mesa
  return cadeira;
}

// Alguém largou a cadeira. Recebe a `conn` junto porque uma conexão VELHA, trocada por
// take-over ali em cima, ainda vai disparar o seu próprio 'close' — e sem esta conferência
// ela liberaria a cadeira que a conexão nova acabou de ocupar.
function largar(cadeira, conn) {
  if (conexoes.get(cadeira) !== conn) return;
  conexoes.delete(cadeira);

  // Caiu no meio do jogo? A CADEIRA FICA GUARDADA. Antes ela virava bot na hora, e com
  // isso fechar a aba era a saída de emergência de qualquer partida perdida: não custava
  // nada. Agora há um prazo para voltar — e, esgotado, a partida conta como derrota.
  if (P && P.fase !== 'fim') {
    const nome = P.cadeiras[cadeira].nome;
    narrar(`${nome} caiu — a cadeira fica guardada por ${ESPERA_VOLTA / 1000}s.`);
    clearTimeout(esperando.get(cadeira));
    // setTimeout e NÃO um contador no requestAnimationFrame: o rAF para em aba de fundo,
    // e o prazo tem de correr mesmo com o anfitrião noutra aba.
    esperando.set(cadeira, setTimeout(() => {
      esperando.delete(cadeira);
      if (!P || P.fase === 'fim' || conexoes.has(cadeira)) return;
      donoDaCadeira.delete(cadeira);                    // não voltou: a cadeira não é mais dele
      abandonar(P, cadeira);
      narrar(`${nome} não voltou — a partida foi dada como perdida para ele.`);
      publicar();
    }, ESPERA_VOLTA));
    publicar();
  } else {
    // No saguão a mesa ainda não começou: a cadeira volta a ser de quem chegar. Guardar
    // dono aqui faria a mesa encher de reservas de gente que só espiou e foi embora.
    donoDaCadeira.delete(cadeira);
  }
  listarSala();
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
  // Destrava o botão: a tentativa anterior pode ter deixado 'Entrando…' ou 'Na mesa'.
  // Aqui e não no `encerrarRede`, que roda em pontos do carregamento onde `conectando`
  // ainda estaria na zona morta — e `typeof` sobre `let` na zona morta LANÇA.
  pararDeConectar('');
}

// UMA TENTATIVA DE CADA VEZ. Sem esta guarda, cada clique fazia um `new Peer`, abandonava
// o peer anterior VIVO e consumia mais uma cadeira — e a mesa enchia de fantasmas do mesmo
// jogador. O convite ao clique repetido era de desenho: depois de conectar a tela não
// mudava (ela só sai quando o anfitrião começa), então ela ficava parada exatamente no
// instante em que parecia ter falhado. Por isso a guarda vem com retorno visual junto.
let conectando = false;

function pararDeConectar(recado) {
  conectando = false;
  el('btConectar').disabled = false;
  el('btConectar').textContent = 'Entrar';
  if (recado !== undefined) erroOnline(recado);
}

function conectarNaMesa(codigo) {
  if (conectando) return;
  if (!temPeerJS()) { avisar('A biblioteca de rede não carregou — sem internet, só dá para jogar local.'); return; }
  if (!codigo || codigo.length < 3) { erroOnline('Faltou o código.'); return; }

  conectando = true;
  el('btConectar').disabled = true;
  el('btConectar').textContent = 'Entrando…';
  erroOnline('Procurando a mesa…');
  modo = 'convidado';
  peer = new Peer(OPCOES_PEER);
  peer.on('open', () => {
    linkAnfitriao = peer.connect(PREFIXO + codigo, { reliable: true });
    linkAnfitriao.on('open', () => {
      erroOnline('Conectado. Esperando o anfitrião começar…');
      // `ola` e não `nome`: é o aperto de mão que diz QUEM chegou, e é ele que faz o
      // anfitrião devolver a cadeira certa em vez da que sobrou.
      linkAnfitriao.send({ t: 'ola', id: meuId(), nome: MESA.cadeiras[0].nome });
    });
    linkAnfitriao.on('data', m => {
      if (m.t === 'cheio') { pararDeConectar('Essa mesa já está cheia.'); return; }
      // A sua cadeira foi assumida por você mesmo, noutra aba ou noutro aparelho. Não é
      // erro nem queda: é o take-over do anfitrião, e dizer "a mesa fechou" seria mentira.
      if (m.t === 'expulso') {
        pararDeConectar('');
        avisar('Você entrou nesta mesa noutra aba — a cadeira foi para lá.');
        mostrarTela('telaMenu');
        modo = 'local';
        return;
      }
      if (m.t === 'sentou') {
        euNaTela = m.cadeira;
        // Sentado NÃO é ocioso: `conectando` fica de pé e o botão fica travado. Solto,
        // ele reconectaria — e como o clienteId é o mesmo, o jogador faria take-over da
        // própria cadeira. O texto muda porque a tela não muda até o anfitrião começar, e
        // era essa espera muda que convidava ao segundo clique.
        el('btConectar').disabled = true;
        el('btConectar').textContent = 'Na mesa';
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
    linkAnfitriao.on('close', () => {
      pararDeConectar();
      avisar('A mesa fechou.'); mostrarTela('telaMenu'); modo = 'local';
    });
  });
  peer.on('error', e => pararDeConectar(explicarErroDeRede(e)));
}

el('btConectar').onclick = () => conectarNaMesa(el('onlineEntrada').value.trim().toUpperCase());

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
