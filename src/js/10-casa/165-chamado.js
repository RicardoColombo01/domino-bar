// O CHAMADO DA VEZ: a aba está no fundo e a mesa está esperando por você.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// O caso é o do celular, e é o mais comum que existe numa mesa online: você sai para
// responder uma mensagem enquanto os outros jogam, e volta sem saber se a vez chegou. Do
// lado de lá, três pessoas olhando uma mesa parada.
//
// SÃO DOIS CANAIS, e eles falham por motivos diferentes — o título da aba (que sobrevive ao
// aparelho no silencioso e é o que aparece na lista de abas) e um som curto (que alcança quem
// nem está olhando para a tela). Quem desligou o som continua recebendo o título: calar não é
// pedir para perder a vez.
//
// NADA DE `Notification`, e a decisão é do Ricardo (12/08): ela pede permissão — uma caixa
// que interrompe justamente quem acabou de sentar — e no iOS só funciona com o jogo instalado
// pela tela de início. Título e som não pedem nada a ninguém e funcionam em todo lugar.
//
// ESTE ARQUIVO É DA CASA e não sabe o que é peça, carta, ponta ou vaza: ele pergunta
// `podeAgirAgora()`, que é o mesmo predicado que libera o seu clique. Um terceiro jogo herda
// isto sem escrever uma linha.

// O TÍTULO ORIGINAL, lido UMA VEZ na carga. Nunca uma string escrita aqui: no dia em que o
// `pagina.html` mudasse, o jogo restauraria um título que não é mais o dele — e o defeito
// apareceria numa suíte que fala de outra coisa (ver o parágrafo do segundo dono, abaixo).
const TITULO_DA_PAGINA = document.title;

// 1200 ms porque o navegador ESTRANGULA temporizador de aba em segundo plano para no mínimo
// ~1 s: pedir menos não pisca mais rápido, só desperdiça acorda-dormes.
const PISCA_MS = 1200;

let vezEraMinha = false;      // a borda: só a TROCA vale, nunca o estado
let timerChamado = 0;
let chamando = false;

// `setTimeout` AUTO-REAGENDADO, e nunca `requestAnimationFrame` — a armadilha nº 1 desta
// casa, que já congelou a mesa de todo mundo quando o relógio do bot morava no quadro. O rAF
// PARA em aba de fundo, ou seja, o pisca não funcionaria exatamente quando é necessário.
// (E `setInterval` também não: um relógio que ninguém drena é um teste que não termina.)
function pararDeChamar() {
  clearTimeout(timerChamado);
  timerChamado = 0;
  chamando = false;
  // Só escreve quando MUDA. É a regra do `aria-live` do `#vez` aplicada ao título, que também
  // é lido em voz alta na troca de aba — reescrever o mesmo texto é anunciar uma troca que
  // não houve.
  if (document.title !== TITULO_DA_PAGINA) document.title = TITULO_DA_PAGINA;
}

function tiqueDoChamado() {
  // A TERCEIRA PORTA DE SAÍDA, e é ela que paga este desenho. As duas óbvias são a aba voltar
  // e a vez passar; sem esta, existe um estado real e alcançável em que o título pisca para
  // sempre apontando para uma mesa que não existe mais — `{t:'expulso'}` e "a mesa fechou"
  // põem o jogador de volta no menu SEM passar por `atualizarVista`, e os dois acontecem
  // justamente com a aba escondida, que é quando o chamado está armado.
  //
  // É o "quem zera o x" do item 7 da Fila 5, resolvido pelo próprio tique perguntando de novo
  // o que o armou.
  if (!chamando || !document.hidden || !podeAgirAgora()) { pararDeChamar(); return; }
  const alvo = document.title === TITULO_DA_PAGINA ? `▶ Sua vez — ${TITULO_DA_PAGINA}` : TITULO_DA_PAGINA;
  if (document.title !== alvo) document.title = alvo;
  timerChamado = setTimeout(tiqueDoChamado, PISCA_MS);
}

// Chamada de dentro de `atualizarVista`, que é por onde TODA vista passa — inclusive as que
// chegam pelo fio, dezenas por jogada. Por isso o que dispara é a BORDA e não o estado: um
// aviso por publicação seria um metrônomo.
function chamarPelaVez() {
  const agora = podeAgirAgora();
  const virou = agora && !vezEraMinha;
  vezEraMinha = agora;

  if (!agora || !document.hidden) { pararDeChamar(); return; }
  // A vez virou enquanto você OLHAVA e só depois você trocou de aba? Então você já sabe que é
  // a sua vez, e chamar seria avisar de uma novidade que não é novidade.
  if (!virou || chamando) return;

  chamando = true;
  // `if (mudo)` explícito, e não confiar no AudioContext suspenso: o contexto só nasce no
  // primeiro som e o silêncio guardado só é aplicado em `ligarMurmuro`. Quem abriu a página
  // com o mudo lembrado e ainda não passou por lá receberia a chamada num contexto recém
  // criado e RODANDO — este seria o único som que toca no mudo.
  if (!mudo) tocarChamado();
  tiqueDoChamado();
}

// A VOLTA. `document.hidden` já vale o valor novo quando este evento chega, então o próprio
// `chamarPelaVez` resolveria — mas ele só roda quando chega vista, e ao voltar para a aba
// pode não chegar nenhuma (a mesa está esperando POR VOCÊ; ninguém mais vai publicar nada).
// Sem este ouvinte o título ficaria piscando com a aba na frente do jogador.
//
// É o quinto `visibilitychange` do projeto, e o primeiro da casa que fala de TURNO — os
// outros repintam textura e largam gesto interrompido.
document.addEventListener('visibilitychange', () => { if (!document.hidden) pararDeChamar(); });

// O TÍTULO TEM DOIS DONOS, e vale saber antes de mexer aqui: `tests/test-app.mjs` usa
// `document.title` como RÉGUA da versão publicada (ele exige `/^v2 /` depois de trocar o
// bundle no meio da rodada, que é a asserção mais importante daquela suíte). Um chamado que
// esqueça de restaurar o título a deixa vermelha com uma mensagem sobre service worker —
// longe da causa. Quem mexer neste arquivo roda `npm run app` junto.
