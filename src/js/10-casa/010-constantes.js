// O que a CASA sabe e jogo nenhum precisa saber: o boteco, o movimento e o que fica guardado.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Este arquivo começava com a linha "Números fixos do dominó de bar" e guardava `PECA_C`,
// `MAX_PINTAS`, `PONTOS` e a tabela `MODOS` — ou seja, as regras de um jogo dentro da pasta
// que promete não saber que jogo é. Isso foi para `30-domino/015-constantes.js`.
//
// O que sobrou é o que o truco, o pife e o vinte-e-um herdam sem mudar uma letra.

// ─── a casa e os jogos que sentam nela ───────────────────────────────────────
// A casa sabe de cadeiras, de online, de placar e de boteco — e não sabe que jogo está na
// mesa. Até a v3 isso era só uma AFIRMAÇÃO da pasta: o código chamava o dominó pelo nome
// (`novaPartida`, `visaoDe`, `sincronizarMao`), o que funciona enquanto houver um jogo só.
//
// `JOGOS` é o balcão onde cada jogo se apresenta; `JOGO` é quem está na mesa agora.
// `130-hud.js` já tinha o primeiro encaixe desse tipo — `painelDoJogo`, da v3.0.0 — e isto
// generaliza aquilo de um encaixe para um contrato.
//
// A CARGA PASSA A TER TRÊS TEMPOS, e é isso que torna o terceiro e o quarto jogo baratos:
//
//   1. DECLARAR   010…160   a casa. Só define; nada que dependa de JOGO roda aqui.
//   2. REGISTRAR  300…      cada jogo pendura o seu contrato em JOGOS.
//   3. ARRANCAR   900       escolhe o jogo, monta a tela e liga o loop.
//
// Sem o terceiro tempo não haveria resposta para "qual `MODOS`?" durante a carga:
// `140-menu.js` valida a mesa guardada contra a tabela de modos, e com dois jogos essa
// pergunta tem duas respostas. O arranque é o instante em que ela passa a ter uma.
const JOGOS = {};
let JOGO = null;
// O ID do jogo na mesa — a chave dele em `JOGOS`, não o nome que aparece na tela. `JOGO.nome`
// é 'Dominó de Bar' e serve para o jogador ler; isto aqui é o que vai para a URL e para o
// armazenamento, então tem de ser curto, estável e sem acento.
let JOGO_ID = '';

// Trocar o jogo da mesa. É por aqui que a aba passa, e é por aqui que o arranque escolhe.
//
// `Object.hasOwn` e não `JOGOS[nome]`: o nome pode vir do armazenamento ou da URL, ou seja
// é ENTRADA DE FORA, e `JOGOS['constructor']` é truthy — foi exatamente esse buraco que deu
// tela preta permanente no defeito 5 da Fila 6.
function trocarDeJogo(nome) {
  if (!Object.hasOwn(JOGOS, nome)) return false;
  JOGO = JOGOS[nome];
  JOGO_ID = nome;
  return true;
}

// Um jogo REGISTRADO ainda não é um jogo JOGÁVEL. O truco aparece na aba desde a v4.1 e só
// ganha motor na v6 — enquanto isso ele tem nome, resumo e regras, e nada mais. A pergunta
// mora aqui, e não num `if (id === 'truco')` espalhado: quem sabe se um jogo está pronto é o
// registro dele.
const jogavel = j => !!j && !j.emBreve;

// ─── quem pediu menos movimento ──────────────────────────────────────────────
// Sensibilidade vestibular não é preferência estética: para quem tem, movimento na tela
// dá enjoo de verdade. Este jogo era o pior conjunto possível — a lâmpada respira PARA
// SEMPRE, as peças deslizam até o lugar e a câmera reenquadra sozinha.
//
// A CONSULTA É FEITA UMA VEZ e o objeto guardado, em vez de chamar `matchMedia` a cada
// quadro: a `MediaQueryList` é VIVA (o `.matches` acompanha o sistema), então guardá-la
// custa uma alocação em vez de sessenta por segundo — e continua respondendo se a pessoa
// mudar a preferência com o jogo aberto, sem listener nenhum.
//
// Mora no PRIMEIRO arquivo porque quem pergunta são o 090 (a suavização) e o 160 (a
// lâmpada), e no escopo concatenado o primeiro arquivo é o único lugar de onde todos
// enxergam.
const MQ_MOVIMENTO = matchMedia('(prefers-reduced-motion: reduce)');
const movimentoReduzido = () => MQ_MOVIMENTO.matches;

// A paleta do boteco. `luz` e `parede` são do cenário (070-cena.js); `marfim` é a cor de
// quem senta na mesa, e hoje quem senta é peça de dominó — quando houver carta, ela pede a
// dela aqui do lado, e é por isso que a paleta é da casa e não do jogo.
//
// Tinha mais três chaves — `feltro`, `madeira` e `pinta` — e NENHUMA era lida por linha
// alguma do projeto. Saíram: paleta é documentação da aparência, e chave que ninguém lê
// documenta uma aparência que não existe.
const CORES = {
  marfim: 0xf4ecd9,
  luz: 0xffd7a0,
  parede: 0x241a16,
};

// ─── o que o navegador lembra ────────────────────────────────────────────────
// Mora aqui, no primeiro arquivo, porque o 130-hud lê preferência na hora em que é
// concatenado — quem chama tem de já existir.
//
// Um lugar só para falar com o localStorage. Ele falha de quatro jeitos e todos
// silenciosos: desligado pelo usuário, modo privado que recusa gravar, cota cheia, e
// JSON estragado por uma versão anterior do jogo. Quem chama nunca quer saber de nada
// disso — quer o valor, ou o padrão.
//
// O harness de teste não tem localStorage nenhum, e é de propósito que isto não
// reclame: em Node cada chamada cai no catch e o jogo roda com os padrões.
const GUARDA = 'dominobar.';

function guardar(chave, valor) {
  try { localStorage.setItem(GUARDA + chave, JSON.stringify(valor)); } catch (e) { void e; }
}

function lido(chave, padrao) {
  try {
    const txt = localStorage.getItem(GUARDA + chave);
    if (txt === null) return padrao;
    const v = JSON.parse(txt);
    return v === null || v === undefined ? padrao : v;
  } catch (e) { void e; return padrao; }
}

function esquecer(chave) {
  try { localStorage.removeItem(GUARDA + chave); } catch (e) { void e; }
}

// ─── o que é guardado POR JOGO ───────────────────────────────────────────────
// A maior parte do que o navegador lembra é da casa e vale para a mesa toda: quem você é no
// online (`cliente`), o som, o painel aberto, a última sala. Duas coisas NÃO são:
//
//   mesa      quantas cadeiras, quem senta nelas, e o MODO — e modo do dominó não é modo do
//             truco. Um 'classico' guardado não quer dizer nada numa mesa de truco.
//   partida   a partida em andamento. Uma só, e do jogo em que ela começou.
//
// Sem isto, trocar de aba apagaria a partida guardada EM SILÊNCIO — que é exatamente o que
// esta fase existe para não fazer. O jogador que está no meio de uma partida de dominó, dá
// uma espiada no truco e volta, tem de achar a mesa dele lá.
const CHAVES_DO_JOGO = ['mesa', 'partida'];

const chaveDoJogo = chave => `${chave}.${JOGO_ID}`;
const guardarNoJogo = (chave, valor) => guardar(chaveDoJogo(chave), valor);
const lidoDoJogo = (chave, padrao) => lido(chaveDoJogo(chave), padrao);
const esquecerDoJogo = chave => esquecer(chaveDoJogo(chave));

// O QUE JÁ ESTAVA GUARDADO ERA DO DOMINÓ, porque até aqui não havia outro jogo. Sem esta
// migração o conserto seria invisível justamente para quem jogou o bastante para ter
// preferência guardada: a mesa dele voltaria ao padrão e a partida de antes sumiria do menu.
// É a mesma lição que o "Você" gravado pagou na v2.0.0.
//
// MIGRA E APAGA, e não "lê a antiga quando a nova falta". A leitura preguiçosa parece mais
// barata e arma uma cilada: `esquecerDoJogo('partida')` roda no fim de toda partida, e na
// leitura seguinte a chave antiga — intacta — ressuscitaria a partida que acabou de acabar.
// Copiar uma vez e apagar a origem não tem esse estado intermediário.
//
// QUEM DIZ QUE HERDA É O JOGO, e não um `if (JOGO_ID === 'domino')` aqui. A primeira versão
// tinha o literal, e ele passava batido pela varredura de acoplamento — que mede
// IDENTIFICADORES — sendo exatamente a mesma coisa que ela existe para impedir: a casa
// sabendo o nome de um jogo. Hoje o dominó declara `herdaOGuardadoSemSufixo` no registro dele,
// e a casa só pergunta. Nenhum jogo novo pode declarar isso: as chaves sem sufixo são de
// antes de existir mais de um jogo, e portanto só de quem estava aqui.
function migrarOGuardadoSemSufixo() {
  if (!JOGO || !JOGO.herdaOGuardadoSemSufixo) return;
  for (const chave of CHAVES_DO_JOGO) {
    const antigo = lido(chave, null);
    if (antigo === null) continue;
    // Se a chave nova já existe, ela é a verdadeira — a antiga é sobra de uma versão que
    // ficou aberta noutra aba. Apaga do mesmo jeito, senão ela migra de novo amanhã.
    if (lido(chaveDoJogo(chave), null) === null) guardar(chaveDoJogo(chave), antigo);
    esquecer(chave);
  }
}
