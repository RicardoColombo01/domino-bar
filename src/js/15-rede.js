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

// TETOS DO QUE CHEGA PELO FIO. O chat já tinha os dois (`TAMANHO_FALA`, `INTERVALO_FALA`,
// lá embaixo) e o nome não tinha nenhum — dez linhas de distância no mesmo arquivo. Era
// isso que deixava um convidado congelar a mesa de TODOS com uma linha: `{t:'nome'}` é a
// mensagem mais cara do protocolo (reescreve a lista da sala, espalha vista para a mesa
// inteira e grava a partida no armazenamento, síncrono), e nada limitava o tamanho nem a
// frequência dela.
//
// O teto é generoso de propósito — o corte que vale é o dos 14 do `nomeUnico`. Este aqui
// existe só para o trabalho CARO (normalizar, colapsar espaço) não rodar sobre megabytes.
const TAMANHO_NOME = 64;
const INTERVALO_NOME = 600;    // ms, o mesmo do chat: trocar de nome não é coisa de rajada
const ULTIMO_NOME = new Map(); // cadeira → quando trocou de nome pela última vez
// O clienteId vai para `donoDaCadeira`, que é PERSISTIDO. Sem teto, um id de megabytes
// estoura a cota do localStorage — e `guardar` (01-constantes.js) engole o erro CALADO, o
// que faz a cadeira deixar de ser reservada: é o vazamento de mão do item 4 da Fila 5
// voltando pela porta dos fundos. 64 é folga larga para um id sorteado.
const TAMANHO_ID = 64;

let peer = null;
let conexoes = new Map();      // cadeira → conn (no anfitrião)
let esperando = new Map();     // cadeira → temporizador de volta (no anfitrião)
let donoDaCadeira = new Map(); // cadeira → clienteId (no anfitrião)
let linkAnfitriao = null;      // conn (no convidado)

// O CÓDIGO DA MESA, que até aqui não existia em lugar nenhum. Ele era variável local do
// `tentarAbrir` e do clique de entrar, e o único lugar onde sobrevivia era o texto de
// `#onlineCodigo` — dentro da `telaOnline`, que o `esconderTelas()` apaga no primeiro
// `t:'vista'`. Ou seja: no instante em que a partida começava, o código sumia da vida de
// todo mundo, e com ele a chance de voltar.
let codigoDaSala = '';

function usarCodigo(codigo) {
  codigoDaSala = codigo || '';
  pintarSala(codigoDaSala);
}

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

// SAIR DE PROPÓSITO É UM ESTADO, e ele dura os 400 ms entre o `desisto` sair e o peer
// morrer. Nessa janela o anfitrião ainda publica — a vista do abandono, justamente —, o
// peer ainda dispara o próprio `close`, e o jogador já está no menu. Sem esta marca a vista
// o arrancaria de volta para a derrota que ele acabou de aceitar, e o `close` avisaria "A
// mesa fechou", que é mentira: quem fechou foi ele.
let deixandoAMesa = false;

// A GERAÇÃO DA REDE. Toda sessão — uma mesa aberta, uma tentativa de entrar numa — é uma
// geração, e ela vira quando alguém passa a mandar na rede. Quem agenda um temporizador
// anota a geração em que estava; quem acorda pergunta se ainda é aquela, e vai embora
// calado se não for.
//
// É o `deixandoAMesa` aí em cima, generalizado: lá a pergunta do disparo é "ainda estou
// saindo?", aqui é "esta rede ainda é a MINHA?". E é a resposta que o item 7 da Fila 5
// manda dar sobre todo `if (x) return` — quem zera o x. Aqui o x tem dono.
//
// CONTADOR E NÃO BOOLEANO: um booleano diria "há rede ligada", e as três vezes em que isto
// doeu não foram rede desligada — foram rede ligada de OUTRA mesa. A pergunta não é "ainda
// há rede", é "ainda é a mesma".
//
// DECLARADO AQUI EM CIMA, e não junto de quem usa: `encerrarRede` roda em pontos do
// carregamento, e um `let` mais abaixo estaria na zona morta — onde o `++` LANÇA, e não
// devolve `undefined`. É a armadilha que o comentário do `pararDeConectar` já registra.
let geracaoRede = 0;

// OS DOIS TEMPORIZADORES QUE CRIAM PEER SOZINHOS, agora com nome. Eram anônimos, e era isso
// que os tornava incanceláveis: `encerrarRede` limpa o `esperando`, que é outro mapa, e não
// tinha o que fazer com estes. O da reserva acordava 1,5 s depois do "Voltar" e reivindicava
// um código que já não interessava a ninguém; o da volta acordava 4 s depois e matava a
// mesa NOVA.
let reservaDoCodigo = null;   // o anfitrião insistindo no código que era dele (tentarAbrir)
let voltaAgendada = null;     // o convidado tentando voltar sozinho (voltarSozinho)

// PARAR DE RESERVAR O CÓDIGO — as duas camadas num lugar só, porque são duas as portas que
// precisam disto: o `encerrarRede` (a sessão acabou) e o "Começar a partida" (a mesa é esta
// agora; o código que se dane). Bumpar a geração duas vezes no mesmo caminho não custa
// nada; ter a regra escrita em dois lugares custa — foi assim que a conversão de cadeira
// online em bot durou com defeito.
//
// As DUAS camadas e não uma: cancelar faz o temporizador deixar de existir, a geração só o
// faz calar. Falham de jeitos diferentes, e é por isso que são duas — item 7 da Fila 5.
function pararDeReservar() {
  clearTimeout(reservaDoCodigo); reservaDoCodigo = null;
  geracaoRede++;
}

// A ESCADA DE VOLTAS RECOMEÇA DO ZERO QUANDO O DEDO AGE — e só então. `voltando` tinha dois
// lugares que o zeravam (o `sentou`, quando dá certo, e o próprio limite, quando acaba) e
// nenhum para o caso mais comum: o jogador desistindo pelo botão. A escada ficava em 5, e a
// queda seguinte — noutra mesa, noutro dia — começava em 6/8, sem uma palavra explicando.
//
// ONDE ISTO NÃO PODE MORAR, e é a parte que custa: nem no `encerrarRede`, nem no
// `conectarNaMesa`. O temporizador do `voltarSozinho` chama OS DOIS no próprio corpo, então
// zerar em qualquer um deles reiniciaria a escada a cada degrau e o convidado tentaria
// voltar PARA SEMPRE — trocaria um defeito visível por um laço eterno. Os caminhos abaixo
// são os únicos que o temporizador nunca percorre: são CLIQUES.
function recomecarAsVoltas() {
  clearTimeout(voltaAgendada); voltaAgendada = null;
  voltando = 0;
}

// O ANFITRIÃO GUARDA A MESA — o código E o mapa de quem é dono de qual cadeira. Sem o
// mapa, reabrir com o mesmo código devolveria o código certo e as cadeiras ERRADAS:
// `donoDaCadeira` só existia em memória, e memória morre com a página. É o item 4 um
// nível acima — de nada adianta o convidado saber quem é se o anfitrião esqueceu.
//
// PRAZO DE 12 h, e não as 2 h do convidado. A assimetria de antes existia porque a sala
// do convidado depende de o anfitrião estar de pé; aqui o anfitrião é você, e o que a
// mesa acompanha é a partida guardada — que dura 12 h. Prazos diferentes fariam o botão
// de reabrir sumir com a partida ainda viva.
function guardarMesaDoAnfitriao() {
  if (modo !== 'anfitriao' || !codigoDaSala) return;
  guardar('sala', {
    quando: Date.now(), codigo: codigoDaSala, anfitriao: true,
    donos: Array.from(donoDaCadeira.entries()),
  });
}

function encerrarRede() {
  // A SESSÃO MORRE AQUI, e com ela os dois temporizadores que criam peer por conta própria.
  // `pararDeReservar` é quem carrega o `geracaoRede++` — ler o nome como "coisa do
  // anfitrião" é engano: ele é o ponto onde a geração vira, e por isso a volta agendada
  // logo abaixo também fica órfã.
  pararDeReservar();
  clearTimeout(voltaAgendada); voltaAgendada = null;

  // `voltando` NÃO É ZERADO AQUI, e a tentação é grande porque tudo o mais desta função é
  // "esqueça a mesa". O temporizador do `voltarSozinho` chama o `encerrarRede` NO PRÓPRIO
  // CORPO, antes de tentar outra vez: zerar o contador aqui reiniciaria a escada a cada
  // degrau e o convidado tentaria voltar para sempre. Quem zera é o clique, em
  // `recomecarAsVoltas`.

  // Desarma a saída em curso: qualquer outro caminho de rede (entrar noutra mesa, abrir uma,
  // cancelar) tem de cancelar o temporizador pendente de `largarAMesa`, senão ele acorda 400
  // ms depois e destrói o peer NOVO.
  deixandoAMesa = false;
  usarCodigo('');
  esperando.forEach(t => clearTimeout(t));
  esperando.clear();
  donoDaCadeira.clear();
  // O carimbo do último nome é POR CADEIRA, como todos os mapas acima — e cadeira 1 de uma
  // mesa nova é outra pessoa. Sem limpar, quem chega herda o relógio de quem sentou ali
  // antes e leva um limite de frequência de graça no primeiro nome que manda.
  ULTIMO_NOME.clear();
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
  el('onlineNome').classList.add('oculta');     // quem abre a mesa nomeia as cadeiras no menu
  el('btConectar').classList.add('oculta');
  el('btIniciarOnline').classList.remove('oculta');
  el('onlineCodigo').textContent = '····';
  erroOnline('');
  tentarAbrir(0);
}

// `codigoDesejado` é o item 3(c): reabrir A MESMA mesa em vez de uma outra. Sem ele o
// anfitrião que recarregava abria uma mesa nova, e os convidados tentando voltar batiam
// numa porta que não existe — o "voltar para a mesa" do convidado só valia enquanto o
// anfitrião não tivesse caído, que é justamente quando ele é necessário.
function tentarAbrir(tentativa, codigoDesejado) {
  const codigo = codigoDesejado || codigoNovo();
  peer = new Peer(PREFIXO + codigo, OPCOES_PEER);

  peer.on('open', () => {
    el('onlineCodigo').textContent = codigo;
    usarCodigo(codigo);
    guardarMesaDoAnfitriao();
    listarSala();
    if (codigoDesejado) retomarComoAnfitriao();
  });

  peer.on('connection', conn => {
    // A CADEIRA NÃO É MAIS ESCOLHIDA AQUI, e essa é a mudança de fundo. Antes ela saía da
    // primeira vaga livre no instante da conexão — antes de o convidado ter dito uma
    // palavra —, o que é cedo demais: não existe ainda a informação para decidir. Agora
    // espera-se o aperto de mão, e quem senta é `sentar()`.
    let cadeira = -1;

    conn.on('data', m => {
      // TUDO QUE ENTRA AQUI É ENTRADA DE FORA, e até a v2.1 nada nesta função supunha o
      // contrário por escrito. `m` pode ser `null`, um número, um array — e `m.t` sobre
      // `null` LANÇA dentro do callback do PeerJS, que derruba o processamento da conexão
      // inteira. O `typeof` pega de quebra o array (que é objeto e passaria).
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      if (cadeira < 0) {
        // `ola` traz o clienteId. Um `nome` solto é convidado de versão antiga (uma
        // página em cache), e ele senta como anônimo — o comportamento de antes. Quebrar
        // quem não recarregou seria pior que a falta de identidade dele.
        if (m.t !== 'ola' && m.t !== 'nome') return;
        cadeira = sentar(conn, m.t === 'ola' ? String(m.id || '').slice(0, TAMANHO_ID) : '', m.nome);
        return;
      }
      if (m.t === 'nome') trocarDeNome(cadeira, m.nome);
      if (m.t === 'acao' && P) aplicarIntencao(cadeira, m);
      if (m.t === 'chat') receberChat(cadeira, m);
      if (m.t === 'desisto') desistiuDaMesa(cadeira);
    });
    conn.on('close', () => { if (cadeira >= 0) largar(cadeira, conn); });
  });

  peer.on('error', e => {
    if (e.type === 'unavailable-id') {
      // AQUI OS DOIS CAMINHOS SE INVERTEM, e é o que o item 3(c) custou. Abrindo mesa
      // nova, o código é descartável: sorteia outro e pronto. REIVINDICANDO o código de
      // uma mesa que era sua, sortear outro é exatamente o erro — o código é o ponto
      // inteiro, é o que os convidados vão digitar. Então insiste no mesmo.
      //
      // E insistir com ESPERA, não em rajada: o peer velho pode ainda estar morrendo no
      // servidor de sinalização, que só larga o id quando o socket cai de fato. Em
      // setTimeout, nunca em requestAnimationFrame — a aba pode estar em segundo plano.
      if (codigoDesejado) {
        peer.destroy();
        if (tentativa < 6) {
          erroOnline(`Reservando o código ${codigo}… (${tentativa + 1}/6)`);
          // A GERAÇÃO VAI JUNTO. Este é o único ponto do jogo que cria um peer sem dedo
          // nenhum em cima, e 1,5 s é tempo de sobra para o jogador ter clicado "Voltar"
          // (menu), "Começar a partida" (mesa local) ou ter entrado noutra mesa. Sem a
          // conferência ele abria um peer reivindicando o código velho, e o
          // `retomarComoAnfitriao` do 'open' arrancava a tela para a partida guardada com
          // `modo` já 'local' — e aí `espalharVistas`, que está atrás de
          // `if (modo === 'anfitriao')`, nunca roda: mesa parada, sem mensagem e sem botão.
          // Ainda sobrava um peer vivo reivindicando o código, para quem o tivesse sentar
          // e nunca receber vista nenhuma.
          const geracao = geracaoRede;
          reservaDoCodigo = setTimeout(() => {
            reservaDoCodigo = null;                // disparou: o handle não vale mais nada
            if (geracao !== geracaoRede) return;   // esta mesa não é mais a da vez
            tentarAbrir(tentativa + 1, codigoDesejado);
          }, 1500);
          return;
        }
        erroOnline(`O código ${codigo} ainda está ocupado. Se você acabou de fechar a mesa, ` +
                   `espere alguns segundos e tente de novo — ou abra uma mesa nova.`);
        return;
      }
      if (tentativa < 4) { peer.destroy(); tentarAbrir(tentativa + 1); return; }
    }
    erroOnline(explicarErroDeRede(e));
  });
}

// Reabrir a mesa que era sua. O código volta pelo `tentarAbrir` acima; aqui volta o
// RESTO — o mapa de donos e a partida —, e é a soma dos dois que faz o convidado sentar
// na cadeira dele com a mão dele.
function reabrirMesaOnline() {
  const g = salaGuardada();
  if (!g || !g.anfitriao) { avisar('Não há mesa sua para reabrir.'); atualizarBotaoVoltarMesa(); return; }
  if (!temPeerJS()) { avisar('A biblioteca de rede não carregou — sem internet, só dá para jogar local.'); return; }
  encerrarRede();
  modo = 'anfitriao';
  mostrarTela('telaOnline');
  el('onlineTitulo').textContent = 'Reabrindo a sua mesa';
  el('onlineSub').textContent = 'Quem estava na mesa volta com o mesmo código.';
  el('onlineEntrada').classList.add('oculta');
  el('onlineNome').classList.add('oculta');
  el('btConectar').classList.add('oculta');
  el('btIniciarOnline').classList.remove('oculta');
  el('onlineCodigo').textContent = g.codigo;
  erroOnline('Reservando o código…');
  // O mapa ANTES de abrir: a primeira conexão pode chegar no mesmo instante do 'open', e
  // um `sentar()` sem os donos daria a primeira vaga livre — o bug do item 4 de volta,
  // pela porta dos fundos.
  donoDaCadeira = new Map(Array.isArray(g.donos) ? g.donos.filter(
    d => Array.isArray(d) && Number.isInteger(d[0]) && typeof d[1] === 'string') : []);
  tentarAbrir(0, g.codigo);
}

// A partida de volta, com as cadeiras online CONTINUANDO online. O `retomarPartida`
// comum as converte em bot, e tem de converter mesmo: fora daqui a mesa de antes não
// existe mais e o motor esperaria para sempre por quem não vai responder. Aqui ela
// existe — é esta que está sendo reaberta.
function retomarComoAnfitriao() {
  const g = partidaGuardada();
  if (!g) { erroOnline('Mesa reaberta. Comece quando todos voltarem.'); return; }
  retomarPartida({ mantendoOnline: true });
  narrar(`Mesa ${codigoDaSala} reaberta — esperando quem estava jogando voltar.`);
  publicar();
}

// SAIU DE PROPÓSITO: não há prazo de volta, a partida acaba perdida para ele. E a cadeira
// deixa de ser dele — quem desiste não volta com o mesmo clienteId, ao contrário de quem
// cai, cuja cadeira fica reservada pelo ESPERA_VOLTA.
//
// Mora FORA do `peer.on('connection')`, e a extração não é cosmética: lá dentro ela é
// inalcançável para o harness de Node, e é justamente esta função que põe o defeito
// relatado — sair e não conseguir voltar — dentro da suíte que roda em segundos.
function desistiuDaMesa(cadeira) {
  if (!P || P.fase === 'fim') return;
  clearTimeout(esperando.get(cadeira)); esperando.delete(cadeira);
  donoDaCadeira.delete(cadeira); guardarMesaDoAnfitriao();
  // A CONEXÃO SAI JUNTO, e não só quando o `close` chegar. `desisto` é sinal mais forte que
  // o `close`: ele DIZ que a pessoa foi embora, enquanto o outro é o link caindo — e entre
  // um e outro há o tempo de o peer do convidado morrer. Nessa janela `conexoes` ainda
  // apontava para alguém que não existe mais, e o anfitrião que clicasse Revanche depressa
  // montava a partida com a cadeira ainda `online`: a mesa nasce esperando quem não vai
  // responder, que é exatamente o defeito 3 da Fila 6 entrando por outra porta.
  const conn = conexoes.get(cadeira);
  conexoes.delete(cadeira);
  if (conn) { try { conn.close(); } catch (e) { void e; } }
  abandonar(P, cadeira);
  narrar(`${P.cadeiras[cadeira].nome} saiu da mesa — a partida foi dada como perdida para ele.`);
  publicar();
}

// DOIS JOGADORES COM O MESMO NOME. Duas pessoas podem legitimamente digitar "Ricardo", e
// duas que não digitaram nada chegam com o MESMO padrão: a mesa fica com dois nomes iguais
// no placar, na lista da sala e no começo de toda linha da conversa, e não há como saber
// quem é quem. Quem desempata é o ANFITRIÃO, porque ele é o único que vê os dois — o
// convidado não conhece a lista de cadeiras alheia. E é por isso que o desempate NÃO se
// estende às cadeiras locais do menu: lá a pessoa digitou os dois nomes e vê os dois na
// mesma tela, e renomear o que ela escreveu seria surpresa. Aqui a colisão é invisível para
// quem a causou, que é a definição da fronteira da rede.
//
// Devolve `nome` se ele já for único entre `ocupados`, ou uma variação numerada que não
// colida. Duas armadilhas que o corpo tem de respeitar, e as duas já custaram caro nesta
// casa:
//
//   · O NÚMERO VAI NO PRIMEIRO NOME — "Ricardo2 Neves", nunca "Ricardo Neves 2".
//     `nomeEmPartes` (13-hud.js) corta na PALAVRA em tela estreita: some tudo depois do
//     primeiro espaço. Um sufixo no fim desapareceria justamente no retrato de quatro
//     cartões, que é onde a confusão dói.
//   · QUEM ENCOLHE PARA CABER É A BASE, NUNCA O DESEMPATE. O nome é cortado em 14 (é o
//     `maxlength` do menu e o corte que `sentar` aplica do outro lado do fio); um sufixo
//     comido pelo corte devolve dois nomes iguais, que é o defeito de volta em silêncio.
//
// Comparação por CHAVE e não por igualdade crua: "ricardo" e "Ricardo " são a mesma pessoa
// para quem lê a mesa. E a mesa tem quatro cadeiras, então não há por que ir longe.
//
// O contrato, que é o que o teste cobra (test-jogo.mjs, em milissegundos — a função é pura):
//   nomeUnico('Zé', ['Tião'])                 → 'Zé'           (não colide: não muda)
//   nomeUnico('Zé', ['Zé'])                   → 'Zé2'
//   nomeUnico('Zé', ['Zé', 'Zé2'])            → 'Zé3'          (pula o que já existe)
//   nomeUnico('Ana Paula', ['Ana Paula'])     → 'Ana2 Paula'   (não 'Ana Paula 2')
//   nomeUnico('Maria Fernanda', [idem])       → 'Maria2'       (ver o encolhimento, abaixo)
//   nomeUnico('Sebastiãozinho', [idem])       → 'Sebastiãozinh2'
function nomeUnico(nome, ocupados) {
  // 14 é o `maxlength` dos DOIS campos de nome (o do menu e o do saguão) e o corte que o
  // `btConectar` já aplica do outro lado do fio. Fica local: neste escopo concatenado todo
  // nome no topo é mais um para colidir, e esta conta não é lida em outro lugar.
  const TETO = 14;

  // A CHAVE é o nome como a mesa o LÊ. `NFC` porque o mesmo "Zé" chega composto no Windows
  // e decomposto no iPhone: dois códigos para a MESMA letra passam batidos por uma
  // comparação crua, e a mesa fica com dois "Zé" — que é justamente o que esta função
  // existe para impedir. Espaço repetido no meio também não faz duas pessoas, e o `\s`
  // pega o espaço-duro que vem colado quando se copia um nome de aplicativo de conversa.
  const chaveDoNome = s => String(s == null ? '' : s)
    .normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

  // Vizinho sem nome não ocupa nada: cadeira em branco não pode ser o motivo de renumerar
  // alguém. E o `Array.isArray` é porque isto roda dentro do `conn.on('data')`, onde uma
  // exceção não estraga um nome — derruba a conexão inteira.
  const tomados = new Set(
    (Array.isArray(ocupados) ? ocupados : []).map(chaveDoNome).filter(Boolean));

  // O nome vai NORMALIZADO para a mesa, e não só para a comparação: quem o fatia depois é
  // o `nomeEmPartes` (13-hud.js), no primeiro espaço, e os dois têm de achar o mesmo.
  const base = String(nome == null ? '' : nome).normalize('NFC').replace(/\s+/g, ' ').trim();
  const corte = base.indexOf(' ');
  const primeiro = corte < 0 ? base : base.slice(0, corte);
  const resto    = corte < 0 ? ''   : base.slice(corte);   // o espaço vai junto, como no HUD

  // Cortar por unidade UTF-16 parte emoji ao meio e deixa meio par substituto solto — e
  // este nome ainda vira JSON no fio e texto na tela. O `Math.max` não é enfeite: tamanho
  // negativo faz o `slice` contar do FIM e devolver outra string, plausível e errada.
  const cortar = (s, n) => {
    const t = s.slice(0, Math.max(0, n));
    return /[\uD800-\uDBFF]$/.test(t) ? t.slice(0, -1) : t;
  };

  // Um candidato, já cortado. O número entra no PRIMEIRO nome, e QUEM ENCOLHE É A BASE,
  // nesta ordem: primeiro o sobrenome sai INTEIRO — nada de palavra cortada pela metade,
  // que é o que faria "Maria2 Fernand" —, e só quando o primeiro nome sozinho ainda não
  // cabe é que ele cede, porque aí não há mais nada para ceder. O `i === 1` é o nome
  // pedido sem número, e passa por aqui como os outros: também precisa caber nos 14.
  const montar = i => {
    const sufixo = i === 1 ? '' : String(i);
    const inteiro = primeiro + sufixo + resto;
    if (inteiro.length <= TETO) return inteiro;
    const semSobrenome = primeiro + sufixo;
    if (semSobrenome.length <= TETO) return semSobrenome;
    return cortar(primeiro, TETO - sufixo.length) + sufixo;
  };

  // A CONFERÊNCIA VEM DEPOIS DO CORTE, e é o ponto todo. Perguntar por `nome + número`
  // antes de encolher deixa passar a colisão que o próprio encolhimento cria: com
  // "Sebastiãozinh2" já sentado, o "Sebastiãozinho" que chega viraria "Sebastiãozinho2",
  // que cortado em 14 é "Sebastiãozinh2" outra vez — dois nomes iguais, e em silêncio.
  //
  // O laço acaba por conta, e não por sorte: cada volta produz uma string diferente das
  // anteriores (o número muda de valor numa posição fixa), e n+1 nomes distintos não
  // cabem em n chaves ocupadas.
  for (let i = 1; i <= tomados.size + 1; i++) {
    const candidato = montar(i);
    if (!tomados.has(chaveDoNome(candidato))) return candidato;
  }
  return montar(tomados.size + 2);   // não se alcança; existe para o laço ter fim visível
}

// UMA CADEIRA É VAGA DE VISITANTE se está marcada `online`, ou se virou bot por falta de
// gente e guardou a marca (`comecarLocal`, 16-loop.js). A marca é o que separa "bot que a
// mesa escolheu" de "bot que a mesa improvisou": um "Bot · difícil" posto de propósito no
// menu continua fechado a quem tem o código, e a cadeira de quem saiu volta a ser dele.
const vagaDeVisita = c => c.tipo === 'online' || c.vagaOnline === true;

// As outras cadeiras da mesa — é contra elas que o nome que chega tem de ser único. Exclui
// a PRÓPRIA cadeira, e não é detalhe: `nomeUnico` roda de novo a cada `{t:'nome'}`, então
// um vizinho que se incluísse veria o próprio nome e escalaria "Ricardo2" → "Ricardo22" a
// cada troca.
//
// O que sustenta a comparação de `nomeUnico` é o invariante "TODO NOME NA MESA CABE EM 14":
// o candidato dele nunca passa de 14, então um ocupado mais comprido jamais seria igual a
// candidato nenhum e escaparia do desempate. Hoje os cinco lugares que escrevem nome cortam
// em 14 (os dois `maxlength`, o `mesaLembrada`, o `btConectar` e o próprio `nomeUnico`).
// Quem acrescentar um sexto sem cortar reabre isso.
const nomesVizinhos = cadeira =>
  MESA.cadeiras.slice(0, MESA.n).filter((c, i) => i !== cadeira).map(c => c.nome);

// TROCAR DE NOME NO MEIO DA MESA, com os dois guardas que o `receberChat` já tinha dez
// linhas abaixo e este caminho não tinha nenhum. Vale a pena dizer o que cada um evita,
// porque os três defeitos eram diferentes:
//
//   tipo       `String(m.nome)` sobre `undefined` dá a string "undefined", que é TRUTHY —
//              então o `|| 'Visita'` NUNCA disparava e a cadeira passava a se chamar
//              literalmente "undefined". Nome que não é texto não é troca de nome: ignora.
//              (`sentar` já fazia certo, com `if (nome !== undefined)`. O irmão é que não.)
//   tamanho    cortar ANTES de normalizar. O trabalho caro do `nomeUnico` é o
//              `.normalize('NFC').replace(/\s+/g,' ')`, e ele rodava sobre a string inteira.
//   frequência sem ela, cada mensagem custa um `publicar()` para a mesa TODA — vinte
//              mensagens viram vinte rodadas de publicação, e o anfitrião é a autoridade:
//              quando ele para, a mesa inteira para.
//
// Extraída do `conn.on('data')` de propósito, pelo mesmo motivo do `desistiuDaMesa`: lá
// dentro ela seria inalcançável para quem quiser exigir uma regra dela isoladamente.
function trocarDeNome(cadeira, nome) {
  if (typeof nome !== 'string') return false;
  const agora = Date.now();
  if (agora - (ULTIMO_NOME.get(cadeira) || 0) < INTERVALO_NOME) return false;
  const pedido = nome.slice(0, TAMANHO_NOME).trim();
  ULTIMO_NOME.set(cadeira, agora);
  MESA.cadeiras[cadeira].nome = nomeUnico(pedido || 'Visita', nomesVizinhos(cadeira));
  listarSala(); if (P) publicar();
  return true;
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

  // 2. Senão, a primeira VAGA livre — e vaga é a cadeira online E também a que virou bot
  //    por falta dela. `comecarLocal` converte a cadeira online sem ninguém vivo do outro
  //    lado para a mesa não nascer esperando quem não responde (é o defeito 3 da Fila 6, e
  //    a conversão fica), mas ela deixa a marca: sem reconverter, sair da mesa uma vez
  //    custava a cadeira PARA SEMPRE e a mesa respondia "cheia" com um bot improvisado
  //    sentado nela. `donoDaCadeira` continua sendo o que RESERVA o assento durante o
  //    ESPERA_VOLTA de quem caiu.
  if (cadeira < 0) {
    cadeira = cadeiras.findIndex((c, i) => vagaDeVisita(c) && !conexoes.has(i) && !donoDaCadeira.has(i));
  }
  if (cadeira < 0) {
    try { conn.send({ t: 'cheio', porque: porQueNaoSentou(cadeiras) }); } catch (e) { void e; }
    setTimeout(() => conn.close(), 0);
    return -1;
  }

  if (id) { donoDaCadeira.set(cadeira, id); guardarMesaDoAnfitriao(); }
  conexoes.set(cadeira, conn);

  // A CADEIRA VOLTA A SER DE GENTE, e nos DOIS lugares. `MESA.cadeiras` é o que o próximo
  // `sentar` e o `comecarLocal` consultam; `P.cadeiras` é o que `seguirOTurno` lê — e
  // enquanto ele disser 'bot', o relógio do bot continua jogando por cima da pessoa que
  // acabou de sentar. Dois donos para a mesma vez.
  //
  // Vale para o ramo 1 também, e não só para o 2: se o `desisto` se perdeu no caminho, a
  // cadeira ainda é dele E já pode ter virado bot pela revanche.
  const reconvertida = MESA.cadeiras[cadeira].tipo !== 'online';
  if (reconvertida) {
    MESA.cadeiras[cadeira].tipo = 'online';
    MESA.cadeiras[cadeira].vagaOnline = false;
    if (P && P.cadeiras[cadeira]) P.cadeiras[cadeira].tipo = 'online';
  }
  // O nome passa pelo desempate: sem ele, dois convidados que não trocaram o padrão sentam
  // com o MESMO nome e a mesa não sabe dizer quem é quem. O `|| 'Visita'` vem ANTES do corte
  // agora — ele é a guarda de um cliente de outra versão, ou escrito à mão, mandando string
  // vazia; `nomeUnico` já corta em 14.
  if (nome !== undefined) {
    MESA.cadeiras[cadeira].nome = nomeUnico(String(nome).trim() || 'Visita', nomesVizinhos(cadeira));
  }

  // Voltou dentro do prazo: cancela o relógio. Funciona porque a cadeira continua marcada
  // como 'online' — é justamente por isso que ela não vira bot na hora da queda.
  if (esperando.has(cadeira)) {
    clearTimeout(esperando.get(cadeira));
    esperando.delete(cadeira);
    if (P && P.fase !== 'fim') narrar(`${MESA.cadeiras[cadeira].nome} voltou para a mesa.`);
  }
  conn.send({ t: 'sentou', cadeira, cadeiras: cadeiras.map(c => c.nome),
              esperando: !!(P && P.fase === 'fim') });
  listarSala();
  // PARTIDA ACABADA NÃO É PARTIDA PARA MOSTRAR A QUEM CHEGA. Quem senta agora não jogou
  // esta — e se ele for justamente o `desistiu`, a vista o levaria direto de volta à tela
  // da derrota que ele já aceitou, sobrando "Trocar a mesa" (a Revanche é botão de
  // anfitrião). O lugar de quem chega entre duas partidas é o saguão, e é onde ele já está:
  // quem o tira da telaOnline é o `t:'vista'`, então não mandar vista nenhuma o deixa lá.
  if (P && P.fase !== 'fim') {
    if (reconvertida) {
      narrar(`${MESA.cadeiras[cadeira].nome} voltou e assumiu a cadeira — o bot jogava por ele.`);
      // avancar() e não publicar(): `seguirOTurno` tem de rodar de novo para o relógio do
      // bot largar a vez. O temporizador já agendado vira no-op sozinho (ele confere o tipo
      // da cadeira na hora de disparar), e este é o segundo guarda.
      avancar();
    } else publicar();                                  // entrou no meio da partida: já recebe a mesa
  }
  return cadeira;
}

// POR QUE NÃO SENTOU. Um `t:'cheio'` para três situações diferentes fazia a mesa dizer "já
// está cheia" com uma cadeira VAZIA à espera de quem caiu e — depois da revanche — com um
// bot de mentira sentado na vaga de quem tentava voltar. Recusar está certo nos três casos;
// mentir o motivo é o que faz quem tentou desistir de tentar de novo.
//
// O motivo vai num campo NOVO da mensagem de sempre: convidado de versão antiga ignora o
// campo e mostra o texto de antes, e anfitrião antigo faz o convidado novo cair no padrão.
// É a mesma tolerância que o aperto de mão legado já pratica ali em cima.
function porQueNaoSentou(cadeiras) {
  if (!cadeiras.some(vagaDeVisita)) return 'semvaga';
  if (cadeiras.some((c, i) => vagaDeVisita(c) && !conexoes.has(i) && donoDaCadeira.has(i))) return 'guardadas';
  return 'cheio';
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

// Cadeira online vazia na hora de começar vira bot: melhor jogar do que esperar. A
// conversão MUDOU DE CASA e agora mora no `comecarLocal` — ela era feita aqui, certa, e
// lá era feita errada (condicionada a `modo === 'local'`), o que travava a revanche do
// anfitrião. Duas cópias da mesma regra, uma delas com defeito, é como o defeito dura.
// E COMEÇAR A PARTIDA DESLIGA A RESERVA DO CÓDIGO. Este botão fica visível na tela de
// reabertura, e é a ÚNICA porta de lá que não passa pelo `encerrarRede` — o "Voltar" passa.
// Sem esta linha, o anfitrião que cansa de esperar o código e começa a jogar vê a reserva
// acordar 1,5 s depois e trocar a partida que ele acabou de montar pela guardada.
el('btIniciarOnline').onclick = () => { pararDeReservar(); comecarLocal(); };

el('btCancelarOnline').onclick = () => { recomecarAsVoltas(); encerrarRede(); mostrarTela('telaMenu'); };

// ─── convidado ───────────────────────────────────────────────────────────────
function entrarNumaMesa() {
  if (!temPeerJS()) { avisar('A biblioteca de rede não carregou — sem internet, só dá para jogar local.'); return; }
  encerrarRede();
  mostrarTela('telaOnline');
  el('onlineTitulo').textContent = 'Entrar numa mesa';
  el('onlineSub').textContent = 'Digite o código que o anfitrião passou.';
  el('onlineCodigo').textContent = '';
  el('onlineEntrada').classList.remove('oculta');
  // O NOME, que só o convidado precisa dizer. Pré-preenchido com o do menu — que é
  // exatamente o que ele já mandava calado —, então o campo não inventa caminho novo: ele
  // torna visível e editável o que sempre viajou. Era esta ausência que fazia a mesa de
  // dois virar "Você × Você" sem que ninguém soubesse onde mudar.
  el('onlineNome').classList.remove('oculta');
  el('onlineNome').value = MESA.cadeiras[0].nome;
  // Pré-preenchido com a última mesa em que você sentou: quem volta quase sempre volta
  // para a mesma, e antes o campo era zerado justamente aqui.
  const guardada = salaGuardada();
  el('onlineEntrada').value = guardada ? guardada.codigo : '';
  el('onlineEntrada').focus();
  el('btConectar').classList.remove('oculta');
  el('btIniciarOnline').classList.add('oculta');
  el('onlineLista').innerHTML = '';
  // Destrava o botão: a tentativa anterior pode ter deixado 'Entrando…' ou 'Na mesa'.
  // Aqui e não no `encerrarRede`, que roda em pontos do carregamento onde `conectando`
  // ainda estaria na zona morta — e `typeof` sobre `let` na zona morta LANÇA.
  pararDeConectar('');
  // Trocar de mesa começa escada nova. Cobre também o "voltar para a mesa" do menu, que
  // passa por aqui — e é clique, portanto muito depois da carga.
  recomecarAsVoltas();
}

// O QUE A MESA RESPONDE QUANDO NÃO DÁ PARA SENTAR. Era uma frase só para os três casos, e
// ela mentia em dois deles: "já está cheia" com uma cadeira vazia guardada para quem caiu,
// e "já está cheia" com um bot improvisado sentado na vaga de quem tinha acabado de sair.
// Recusar estava certo; o motivo é que não.
const RECUSA = {
  cheio: 'Essa mesa já está cheia — todas as cadeiras têm gente jogando.',
  guardadas: 'A cadeira desta mesa está guardada para quem caiu. Tente de novo em alguns segundos.',
  semvaga: 'Essa mesa não tem cadeira de visitante agora — quem abriu a mesa precisa deixar uma vaga.',
};

// LARGAR A MESA, do lado de quem é convidado. Mora aqui e não no 16-loop porque conhece o
// `codigoDaSala` e o `linkAnfitriao`.
//
// O CÓDIGO FICA GUARDADO, e é a mudança de fundo: sair entrega a PARTIDA, não a MESA. A
// cadeira deixa de ser sua na hora (quem apaga a reserva é o `desistiuDaMesa`, do outro
// lado), e a derrota fica registrada — mas o caminho de volta continua de pé para a
// próxima. Era um `esquecer('sala')` aqui, e com ele sumiam as TRÊS portas de volta de uma
// vez: o painel "Mesa" do HUD, o botão do menu e o campo pré-preenchido do saguão. Quem não
// tinha decorado as quatro letras ficava de fora com a sala ainda aberta.
function largarAMesa() {
  if (linkAnfitriao && linkAnfitriao.open) linkAnfitriao.send({ t: 'desisto' });
  if (codigoDaSala) guardar('sala', { quando: Date.now(), codigo: codigoDaSala, anfitriao: false });
  deixandoAMesa = true;
  // A MESMA FOLGA DO RAMO DO ANFITRIÃO, e pelo mesmo motivo escrito lá: `peer.destroy()`
  // aborta o que ainda não saiu do SCTP, e o que ainda não saiu é justamente o `desisto` —
  // a mensagem que registra a derrota e devolve a cadeira à mesa. Perdida, o anfitrião só
  // descobre pelo `close`, e aí a cadeira fica RESERVADA 30 s para quem já foi embora.
  setTimeout(() => { if (deixandoAMesa) encerrarRede(); }, 400);
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
  // A GERAÇÃO TROCA AQUI TAMBÉM, e não só no `encerrarRede`. Esta é a OUTRA porta por onde
  // nasce um peer: na tela "A mesa caiu" o botão Entrar está clicável (o `close` chama
  // `pararDeConectar` antes de agendar a volta) e o campo do código continua lá, então dá
  // para entrar noutra mesa sem passar pelo `encerrarRede` — e era justamente essa a volta
  // que acordaria para matar a conexão nova. Bumpar aqui é dizer "quem manda na rede agora
  // sou eu"; o que foi agendado antes que se cale.
  geracaoRede++;
  el('btConectar').disabled = true;
  el('btConectar').textContent = 'Entrando…';
  erroOnline('Procurando a mesa…');
  modo = 'convidado';
  usarCodigo(codigo);
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
      // Já saiu: o que chegar nos 400 ms de folga é da mesa que ele acabou de deixar, e a
      // vista do abandono o levaria do menu de volta para a tela da derrota.
      if (deixandoAMesa) return;
      if (m.t === 'cheio') { pararDeConectar(RECUSA[m.porque] || RECUSA.cheio); return; }
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
        voltando = 0;                      // sentou: a próxima queda começa a contar do zero
        // Sentado NÃO é ocioso: `conectando` fica de pé e o botão fica travado. Solto,
        // ele reconectaria — e como o clienteId é o mesmo, o jogador faria take-over da
        // própria cadeira. O texto muda porque a tela não muda até o anfitrião começar, e
        // era essa espera muda que convidava ao segundo clique.
        el('btConectar').disabled = true;
        el('btConectar').textContent = 'Na mesa';
        // A ESPERA TEM DE TER NOME. Sentar entre duas partidas é o caso de quem sai e
        // volta: o anfitrião de propósito não manda vista de partida acabada (ela levaria
        // o convidado direto para a tela da derrota que ele já aceitou), então a tela fica
        // parada — e tela parada sem explicação é o que faz clicar de novo.
        erroOnline(m.esperando
          ? `Você é a cadeira ${m.cadeira + 1} — a partida anterior acabou. Esperando o anfitrião começar a próxima.`
          : `Você é a cadeira ${m.cadeira + 1}.`);
        // Guardado no ponto do SENTOU, e não no do clique: sentar de fato é o que prova
        // que o código presta. `anfitriao: false` é o que separa este guardado do que o
        // `guardarMesaDoAnfitriao` escreve — a mesma chave serve aos dois papéis, e o
        // botão do menu lê essa marca para saber se oferece "voltar" ou "reabrir".
        guardar('sala', { quando: Date.now(), codigo: codigoDaSala, anfitriao: false });
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
      // Quem fechou foi você. Sem esta linha, sair de propósito ainda levava um "A mesa
      // fechou" na cara — e, pior, tentava VOLTAR SOZINHO para a mesa que acabou de largar.
      if (deixandoAMesa) { pararDeConectar(''); return; }
      pararDeConectar();
      // A MESA FECHOU, OU O ANFITRIÃO ESTÁ RECARREGANDO — e daqui de fora as duas coisas
      // são idênticas: o link cai igual. Como agora ele reabre com o MESMO código
      // (item 3(c)), desistir na primeira queda desperdiçaria justamente o mecanismo que
      // acabou de ser construído. Então tenta voltar sozinho, e só desiste depois.
      if (voltarSozinho(codigoDaSala)) return;
      avisar('A mesa fechou.'); mostrarTela('telaMenu'); modo = 'local';
    });
  });
  peer.on('error', e => pararDeConectar(explicarErroDeRede(e)));
}

// O NOME VALE PARA A MESA E PARA O MENU. Quem se apresentou como "Lia" aqui não quer voltar
// a ser "Careca" na próxima partida local — e é `lembrarMesa()` que faz isso durar, o mesmo
// caminho do campo do menu. Um segundo lugar que gravasse nome é como as duas telas passam
// a discordar. Campo vazio não apaga nada: fica o que o menu já dizia.
el('btConectar').onclick = () => {
  // A porta que NÃO passa por `entrarNumaMesa`: Entrar direto, da tela "A mesa caiu". Quem
  // digita um código e clica está começando de novo, e a escada tem de acompanhar.
  recomecarAsVoltas();
  const nome = el('onlineNome').value.trim().slice(0, 14);
  if (nome && nome !== MESA.cadeiras[0].nome) {
    MESA.cadeiras[0].nome = nome;
    lembrarMesa();
    montarCadeiras();                     // o menu atrás desta tela mostra o nome novo
  }
  conectarNaMesa(el('onlineEntrada').value.trim().toUpperCase());
};

// ─── o convidado voltando sozinho ────────────────────────────────────────────
// Quantas vezes e de quanto em quanto tempo. O anfitrião recarregando leva alguns
// segundos para reivindicar o código de volta (o servidor de sinalização só larga o id
// quando o socket cai de fato), então a janela tem de cobrir isso com folga — mas não
// pode ser eterna: anfitrião que desistiu de vez não volta nunca, e ficar tentando de
// graça é pior do que dizer que a mesa fechou.
const VOLTAS = 8;
const ESPERA_VOLTAR = 4000;
let voltando = 0;

function voltarSozinho(codigo) {
  if (modo !== 'convidado' || !codigo || voltando >= VOLTAS) { voltando = 0; return false; }
  voltando++;
  mostrarTela('telaOnline');
  el('onlineTitulo').textContent = 'A mesa caiu';
  el('onlineSub').textContent = 'Tentando voltar — o anfitrião pode estar recarregando.';
  erroOnline(`Tentando voltar para a mesa ${codigo}… (${voltando}/${VOLTAS})`);
  // UMA VOLTA PENDENTE DE CADA VEZ, como o `largar` já faz com o relógio da cadeira: dois
  // degraus armados ao mesmo tempo são dois peers nascendo com 4 s de diferença.
  clearTimeout(voltaAgendada);
  // A GERAÇÃO É A GUARDA QUE O `modo` NÃO CONSEGUIA DAR. O `modo !== 'convidado'` não separa
  // "desistiu no meio" de "entrou noutra mesa" — quem entrou noutra mesa TAMBÉM é convidado,
  // porque `conectarNaMesa` repõe o `modo`. O comentário que ficava nesta linha descrevia
  // uma proteção que ela não dava. Era esse buraco que fazia o temporizador da mesa velha
  // matar a NOVA: o `encerrarRede` derrubava o peer recém-criado e o `conectarNaMesa`
  // seguinte batia no `if (conectando) return` e desistia CALADO — botão "Entrando…"
  // travado para sempre, zero peers, e a tela ainda dizendo "Conectado".
  const geracao = geracaoRede;
  voltaAgendada = setTimeout(() => {
    voltaAgendada = null;
    if (geracao !== geracaoRede) return;   // outra mesa assumiu a rede: esta volta não tem dono
    // O `modo` FICA, e não por superstição: ele pega o que a geração não pega. O
    // `{t:'expulso'}` e o "A mesa fechou" põem `modo = 'local'` SEM passar pelo
    // `encerrarRede`, e nesses caminhos a geração continua a mesma. Duas guardas com falhas
    // diferentes é o desenho, não redundância.
    if (modo !== 'convidado') return;
    // O peer VELHO tem de morrer antes: `conectarNaMesa` não o derruba (quem fazia isso
    // era o `entrarNumaMesa` da tela), e sem isto cada tentativa deixaria um peer vivo —
    // o mesmo vazamento que o item 5 consertou no botão de entrar.
    //
    // E este `encerrarRede` SOBE A GERAÇÃO, o que é seguro POR ORDEM: a conferência acima já
    // passou, e o `conectarNaMesa` de baixo anota a geração nova quando for a vez dele.
    // Trocar a conferência de lugar — pô-la depois do `encerrarRede` — mataria a escada no
    // primeiro degrau, em silêncio.
    encerrarRede();
    conectarNaMesa(codigo);                // ele próprio devolve `modo` a 'convidado'
  }, ESPERA_VOLTAR);
  return true;
}

// ─── voltar para a mesa ──────────────────────────────────────────────────────
// Prazo mais curto que as 12h da partida guardada, e por um motivo: a partida é SUA e não
// depende de ninguém, enquanto a sala depende de o anfitrião ainda estar de pé. Uma mesa
// de ontem vira um botão que mente.
const HORAS_SALA = 2;

function salaGuardada() {
  const g = lido('sala', null);
  if (!g || typeof g.codigo !== 'string' || !/^[A-Z0-9]{3,8}$/.test(g.codigo)) return null;
  // Prazos diferentes por papel, e a diferença é de quem a mesa depende. Ver o comentário
  // de `guardarMesaDoAnfitriao`: a sua mesa acompanha a partida guardada (12 h); a mesa de
  // outra pessoa depende de ela ainda estar de pé (2 h).
  const horas = g.anfitriao ? 12 : HORAS_SALA;
  if (!g.quando || Date.now() - g.quando > horas * 3600e3) return null;
  return g;
}

function atualizarBotaoVoltarMesa() {
  const g = salaGuardada();
  el('btVoltarMesa').classList.toggle('oculta', !g);
  // REABRIR e VOLTAR são coisas diferentes, e o botão tem de dizer qual é: no anfitrião a
  // mesa nasce de novo dele; no convidado ele vai bater na porta de alguém.
  if (g) el('btVoltarMesa').textContent = g.anfitriao
    ? `Reabrir a sua mesa ${g.codigo}` : `Voltar para a mesa ${g.codigo}`;
}

el('btVoltarMesa').onclick = () => {
  const g = salaGuardada();
  if (!g) { avisar('O código daquela mesa venceu.'); atualizarBotaoVoltarMesa(); return; }
  tocarClique();
  if (g.anfitriao) { reabrirMesaOnline(); return; }
  entrarNumaMesa();                       // prepara a tela; ela já pré-preenche o campo
  conectarNaMesa(g.codigo);
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
