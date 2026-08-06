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

// Trocar o jogo da mesa. Hoje é chamada uma vez, no arranque; a aba que deixa o jogador
// escolher entra por aqui.
//
// `Object.hasOwn` e não `JOGOS[nome]`: o nome pode vir do armazenamento ou da URL, ou seja
// é ENTRADA DE FORA, e `JOGOS['constructor']` é truthy — foi exatamente esse buraco que deu
// tela preta permanente no defeito 5 da Fila 6.
function trocarDeJogo(nome) {
  if (!Object.hasOwn(JOGOS, nome)) return false;
  JOGO = JOGOS[nome];
  return true;
}

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
