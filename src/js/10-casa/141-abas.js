// A FAIXA DE ABAS: qual jogo está na mesa.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// É a interface do contrato que a Fase 1 comprou. A casa já sabia falar com `JOGO.x` sem
// saber que jogo era; faltava alguém dizer QUAL. São três respostas possíveis, em ordem:
// a URL, a preferência guardada, e o primeiro do balcão.
//
// POR QUE ARQUIVO PRÓPRIO, e não mais um pedaço do 140-menu. O menu responde "quem senta em
// cada cadeira"; isto responde "que jogo é". São perguntas de donos diferentes — e no dia em
// que o truco tiver montagem própria, é este arquivo que continua igual.
//
// O NÚMERO 141 o põe depois do menu (140) e antes do saguão (145). Nada aqui roda na carga:
// são declarações de função, e quem as chama é o `900-arranque.js`. Chamar `montarCadeiras`
// daqui é seguro pelo mesmo motivo que o `140-menu.js` já registra — declaração de função é
// içada para o topo do escopo concatenado, e estes corpos só rodam depois de tudo existir.

// O jogo que abre quando ninguém disse nada. É o PRIMEIRO registrado, e não um literal
// 'domino': um literal aqui seria a casa sabendo o nome de um jogo, que é o acoplamento que
// a v4.0.0 gastou uma release inteira tirando — e que agora tem teste (`test-acoplamento`).
const jogoPadrao = () => Object.keys(JOGOS)[0];

// ─── qual jogo abrir ─────────────────────────────────────────────────────────
// A URL ganha da preferência, e a preferência ganha do padrão.
//
// A URL VEM PRIMEIRO porque ela é o único dos três que alguém acabou de digitar ou de
// receber: um link `?jogo=truco` mandado no grupo tem de abrir o truco, mesmo que a última
// coisa que você jogou tenha sido dominó. Preferência é o que você fez ontem; URL é o que
// estão te pedindo agora.
//
// OS DOIS SÃO ENTRADA DE FORA, e por isso os dois passam por `Object.hasOwn` — o da URL
// obviamente (qualquer um digita), mas o guardado também: pode ter sido escrito por uma
// versão em que existia um jogo que não existe mais. `JOGOS['constructor']` é truthy num
// objeto literal, e foi esse buraco exato que deu tela preta permanente no defeito 5 da
// Fila 6.
function jogoEscolhido() {
  const daURL = new URLSearchParams(location.search).get('jogo');
  if (typeof daURL === 'string' && Object.hasOwn(JOGOS, daURL)) return daURL;
  const guardado = lido('jogo', '');
  if (typeof guardado === 'string' && Object.hasOwn(JOGOS, guardado)) return guardado;
  return jogoPadrao();
}

// A barra de endereço passa a dizer a verdade — e é o que torna a escolha COMPARTILHÁVEL,
// que é a metade do motivo de a URL existir neste mecanismo.
//
// O padrão SAI da URL em vez de entrar: o endereço limpo tem de continuar sendo o endereço
// do jogo de sempre, senão todo link que alguém já mandou passa a parecer incompleto.
//
// `replaceState` e não `pushState`: trocar de aba não é navegar, e com `pushState` o botão
// Voltar do celular passaria a desfazer cliques de aba em vez de sair do jogo.
function urlDoJogo(id) {
  const p = new URLSearchParams(location.search);
  if (id === jogoPadrao()) p.delete('jogo'); else p.set('jogo', id);
  const busca = p.toString();
  // `file://` é o jeito como este jogo abre por duplo-clique, e ali o `replaceState` pode
  // recusar — não é motivo para o menu não montar.
  try { history.replaceState(null, '', location.pathname + (busca ? '?' + busca : '')); } catch (e) { void e; }
}

// ─── a faixa ─────────────────────────────────────────────────────────────────
// Montada a partir de `JOGOS`, e não escrita no HTML: o quarto jogo aparece na aba pelo só
// fato de se registrar, sem ninguém lembrar de mexer aqui.
function montarAbas() {
  const nav = el('abasJogos');
  nav.innerHTML = Object.keys(JOGOS).map(id => {
    const j = JOGOS[id];
    // `escapar` num nome que é NOSSO, escrito no registro, é cinto sobre suspensório — e
    // fica porque a regra da casa é "todo texto que vai para innerHTML passa por ele", e
    // exceção justificada é como a terceira mordida aconteceu.
    return `<button class="aba" role="tab" id="aba-${escapar(id)}" data-jogo="${escapar(id)}"`
      + ` aria-controls="cartaDoJogo" aria-selected="false" tabindex="-1"`
      // O `aria-label` leva o nome INTEIRO: a aba mostra o curto porque a faixa é estreita,
      // e quem ouve a tela não tem essa limitação. "Dominó" e "Dominó de Bar" são a mesma
      // aba; o que o olho perde por espaço o ouvido não precisa perder.
      + ` aria-label="${escapar(j.nome + (j.emBreve ? ' — em breve' : ''))}">`
      + `${escapar(j.curto || j.nome)}${j.emBreve ? '<i>em breve</i>' : ''}</button>`;
  }).join('');

  nav.querySelectorAll('button').forEach(b => {
    b.onclick = () => { if (abrirJogo(b.dataset.jogo)) tocarClique(); };
  });

  // `role="tab"` PROMETE seta, e promessa de acessibilidade não cumprida é pior que
  // semântica nenhuma: o leitor de tela anuncia "aba 1 de 2" e a seta não anda. Ativação
  // automática (a seta já troca de jogo) porque são duas abas de conteúdo instantâneo —
  // não há o que carregar que justifique separar mover de escolher.
  nav.onkeydown = ev => {
    const botoes = [...nav.querySelectorAll('button')];
    const i = botoes.indexOf(document.activeElement);
    if (i < 0) return;
    const passo = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: botoes.length - 1 - i }[ev.key];
    if (passo === undefined) return;
    ev.preventDefault();
    const alvo = botoes[(i + passo + botoes.length) % botoes.length];
    alvo.focus();
    alvo.click();
  };
}

// A marca da aba ativa. `aria-selected` E `tabindex` juntos: o segundo é o tabindex
// itinerante que o padrão de abas exige — Tab entra na faixa pela aba ativa, e as setas
// andam dentro dela, em vez de a faixa comer quatro paradas do Tab.
//
// MESA OCUPADA NÃO TROCA DE JOGO, e o motivo não é etiqueta. Com uma partida viva na
// memória, trocar de jogo faria duas coisas erradas ao mesmo tempo: o `guardarPartida()` do
// próximo `publicar()` gravaria a partida de dominó sob a chave do truco, e o `desenharHUD`
// leria `JOGO.menu.MODOS[vista.modo].rotulo` numa tabela que não tem aquele modo. Hoje o
// caminho é estreito — só o `btMenu` mostra o menu sem zerar `P` —, e "estreito hoje" é
// exatamente como o `!temMonte` da Fila 5 durou três releases.
//
// Barrar CALADO seria o defeito que esta casa passou quatro filas consertando, então o botão
// diz por quê. Partida ACABADA (`fase === 'fim'`) não ocupa nada: você está olhando o menu.
function pintarAbas() {
  const ocupada = !!(P && P.fase !== 'fim');
  el('abasJogos').querySelectorAll('button').forEach(b => {
    const minha = b.dataset.jogo === JOGO_ID;
    b.classList.toggle('on', minha);
    b.setAttribute('aria-selected', minha ? 'true' : 'false');
    b.setAttribute('tabindex', minha ? '0' : '-1');
    b.disabled = ocupada && !minha;
    b.title = b.disabled ? 'Termine ou saia da partida para trocar de jogo' : '';
  });
}

// ─── o cartão do jogo ────────────────────────────────────────────────────────
// Título, resumo e regras saem do REGISTRO. Estavam escritos à mão no `src/pagina.html`, que
// é da casa — o mesmo vazamento que a Fase 1 tirou do JavaScript, sobrevivendo no HTML porque
// a varredura por AST não enxerga marcação.
function pintarOJogoNoMenu() {
  el('tituloJogo').textContent = JOGO.nome;
  el('subJogo').textContent = JOGO.sub;

  // As regras vão CRUAS para o innerHTML, e é decidido: elas são marcação de propósito
  // (`<b>`, `&amp;`), escritas por nós no registro do jogo, e nunca vêm da rede nem do
  // armazenamento. É a diferença entre este `innerHTML` e os quatro que já morderam esta
  // casa — todos eles carregavam texto de um convidado.
  const regras = JOGO.regras || [];
  el('regrasLista').innerHTML = regras.map(r => `<li>${r}</li>`).join('');
  el('regrasJogo').classList.toggle('oculta', !regras.length);

  // REGISTRADO não é JOGÁVEL. Sem motor não há mesa para montar — e mostrar a montagem de
  // cadeiras com um botão "Sentar e jogar" que não senta seria a espécie de defeito que o
  // `refletirMesaNosBotoes` existe para impedir: o jogo está certo e a tela mente.
  const pronto = jogavel(JOGO);
  el('montagemDaMesa').classList.toggle('oculta', !pronto);
  el('vemAi').classList.toggle('oculta', pronto);
  if (!pronto) el('vemAi').textContent = JOGO.emBreve;
}

// ─── o que as suítes alcançam ────────────────────────────────────────────────
// `window.__jogo` (160-loop.js) nasce com o que é da casa e recebe o resto do jogo por cima.
// Isto rodava uma vez, no arranque; com aba, ele TROCA — e trocar sem tirar o que estava
// deixaria `grupoMonte` pendurado numa mesa de truco, que é uma ponte mentindo.
//
// `defineProperties` com os DESCRITORES, e não `Object.assign`: assign INVOCA os getters da
// origem e copia o valor. O `get maoNaTela()` virava uma fotografia da mão vazia tirada no
// arranque, e retomar uma partida guardada mostrava "0 na sua mão". Custou uma reprovação na
// Fase 1 e está escrito aqui para não custar duas.
let chavesDaPonteDoJogo = [];
function porAPonteDoJogo() {
  for (const k of chavesDaPonteDoJogo) delete window.__jogo[k];
  const ponte = JOGO.ponte || {};
  Object.defineProperties(window.__jogo, Object.getOwnPropertyDescriptors(ponte));
  chavesDaPonteDoJogo = Object.keys(ponte);
}

// ─── sentar noutro jogo ──────────────────────────────────────────────────────
// O caminho único: o arranque entra por aqui e a aba entra por aqui. Duas cópias da mesma
// sequência, uma delas esquecendo um passo, é literalmente como o defeito 3 da Fila 6 durou.
function abrirJogo(id) {
  if (!trocarDeJogo(id)) return false;

  // ANTES de qualquer leitura: o acervo guardado sem sufixo é de quem declarou herdá-lo, e a
  // partida de antes tem de sobreviver à chegada da aba.
  migrarOGuardadoSemSufixo();

  if (jogavel(JOGO)) {
    // `Object.assign` e não `MESA = …`: a referência tem de continuar a mesma, porque o
    // projeto inteiro lê `MESA.n` direto. Mesma razão do arranque.
    montarModos();
    Object.assign(MESA, mesaLembrada());
    refletirMesaNosBotoes();
    ajustarCadeirasAoModo();
    montarCadeiras();
  }

  atualizarBotaoRetomar();
  porAPonteDoJogo();
  pintarOJogoNoMenu();
  pintarAbas();

  // GUARDA SEMPRE, inclusive quando a escolha veio da URL — decisão do Ricardo em 06/08/2026,
  // e nenhuma leitura de código chega a ela. A outra saída era defensável e foi pesada: "link
  // é visita, clique é escolha", e aí o `?jogo=truco` que um amigo mandou não mexeria no seu
  // padrão. Ele escolheu que a URL e o clique valem a mesma coisa — quem chega pelo link e
  // quer ficar não precisa fazer mais nada. É regra de casa, como a cruzada valer 4.
  guardar('jogo', id);
  urlDoJogo(id);
  return true;
}
