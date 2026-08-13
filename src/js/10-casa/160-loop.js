// A costura: estado da aplicação, o turno, o revezamento na mesma tela e o loop.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Existe UM caminho para uma jogada acontecer, venha ela de onde vier:
//
//   seu clique ─┐
//   bot        ─┼─► pedirAcao ─► aplicarIntencao ─► motor ─► publicar ─► tela + rede
//   rede       ─┘                (valida com acoesDe)
//
// Nada de "se for online faça diferente". O convidado é a única exceção e ela é de
// uma linha: ele não tem a partida na memória, então empurra a intenção pelo fio.

let P = null;                  // a partida — existe no anfitrião e no jogo local
let vistaAtual = null;         // o que a tela está desenhando
let euNaTela = 0;              // qual cadeira a tela mostra agora (o hotseat troca isto)
let modo = 'local';            // 'local' | 'anfitriao' | 'convidado'
let travado = false;           // tela de troca no ar: não desenha mão nenhuma
let viuOFimDaMao = false;      // já passou pelo fim de mão que encerrou a partida
let saindo = false;            // a pergunta "sair mesmo?" está no ar
let timerBot = 0;

// `fase === 'mao'` era o dominó escrito na casa, e o truco o denunciou: lá existe uma fase
// inteira — a mão de 11 — em que a vez é sua, o motor espera por você e não há carta nenhuma
// a jogar. `emJogo` é a pergunta que serve aos dois: "há uma vez de alguém agir?".
//
// Ela aceita tanto a PARTIDA quanto a VISTA, e de propósito: as duas carregam `fase` e `vez`,
// então um verbo só cobre o `seguirOTurno` (que olha `P`) e este aqui (que olha a vista).
const podeAgirAgora = () =>
  !!vistaAtual && !travado && JOGO.motor.emJogo(vistaAtual) && vistaAtual.vez === vistaAtual.cadeira;

function comecarLocal() {
  // CADEIRA ONLINE SEM NINGUÉM VIVO NELA VIRA BOT. Senão a partida nasce com uma cadeira
  // que ninguém joga — nem bot, nem troca de tela —, `seguirOTurno` não faz nada quando
  // chega a vez dela, e a mesa morre em silêncio.
  //
  // A pergunta era `modo === 'local'` e estava condicionada ao lugar errado. Ela cobria a
  // revanche depois de SAIR de uma mesa, e deixava passar a revanche DENTRO de uma: o
  // anfitrião clicando "Revanche" com um convidado que já fechou a aba montava a mesma
  // partida travada. A pergunta certa nunca foi "em que modo estou", é "esta cadeira tem
  // alguém do outro lado" — e quem sabe isso é `conexoes`, que em mesa local está vazio e
  // portanto converte tudo, como antes.
  //
  // É também a conversão que o `btIniciarOnline` fazia por conta própria; com ela aqui,
  // aquele botão voltou a ser só `comecarLocal()`. Uma regra em vez de duas.
  MESA.cadeiras.slice(0, MESA.n).forEach((c, i) => {
    if (c.tipo === 'online' && !conexoes.has(i)) {
      c.tipo = 'bot'; c.nivel = c.nivel || 'normal';
      // A VAGA NÃO SOME COM O TIPO. Converter continua obrigatório — é a linha acima que
      // impede a revanche de nascer esperando quem não responde —, e o que faltava era
      // LEMBRAR que aquela cadeira é de gente, para o `sentar()` poder devolvê-la. Sem a
      // marca, sair da mesa uma vez custava a cadeira para sempre: quem tentava voltar
      // ouvia "essa mesa já está cheia" com um bot improvisado sentado no lugar dele.
      c.vagaOnline = true;
    }
  });
  const cadeiras = MESA.cadeiras.slice(0, MESA.n)
    .map(c => ({ nome: c.nome, tipo: c.tipo, nivel: c.nivel }));
  // `compraVoluntaria` estava escrito nesta linha, e é uma regra de dominó: as opções que a
  // mesa carrega são as que o JOGO declarou no menu, e a casa só as repassa.
  const regras = { alvo: MESA.alvo, modo: MESA.modo };
  for (const o of JOGO.menu.OPCOES) regras[o.campo] = MESA[o.campo];
  P = JOGO.motor.nova(cadeiras, regras);
  euNaTela = 0;
  travado = false;
  JOGO.mesa.esquecerArrumacao();               // mesa nova, mão nova: a arrumação de antes não vale
  limparConversa();
  tocarEmbaralho();
  anunciarAbertura();
  avancar();
}

// `P.pecaObrigatoria` era dominó puro dentro da casa — o truco abre com uma VIRA, que é
// outra frase inteiramente. O jogo escreve a linha; a casa só a narra.
function anunciarAbertura() {
  narrar(JOGO.motor.abertura(P));
}

function narrar(txt) {
  anotar(txt);
  if (modo === 'anfitriao') espalharLog(txt);
}

// Primeiro decide de quem é a vez (pode abrir a tela de troca), só então desenha —
// invertido, a mão do jogador anterior pisca por um quadro antes de sumir.
function avancar() {
  seguirOTurno();
  publicar();
}

function publicar() {
  if (!P) return;
  if (modo === 'anfitriao') espalharVistas();
  const v = JOGO.motor.visao(P, euNaTela);
  // A VISTA SEM A MÃO, para a tela de troca do hotseat. Ela zerava `acoes` com os campos do
  // dominó escritos aqui (`jogadas`, `comprar`, `passar`) — e "zerar as ações" é uma frase
  // que só o jogo sabe escrever, porque só ele sabe quais são.
  atualizarVista(travado ? JOGO.motor.semAMao(v) : v);
  guardarPartida();
}

function atualizarVista(v) {
  vistaAtual = v;
  // A MESA ESTÁ ESPERANDO POR VOCÊ E VOCÊ NÃO ESTÁ OLHANDO? Aqui, e não em `publicar`, porque
  // é esta linha acima que instala a vista — e é dela que `podeAgirAgora()` tira a resposta.
  // Quem decide se algo acontece é a BORDA da vez, lá dentro (165-chamado.js).
  chamarPelaVez();
  // UM VERBO, e não os quatro `sincronizar*` de antes. O dominó tem tabuleiro, mão, mãos
  // dos outros e monte; o truco tem três vazas e nenhum monte. O que a casa precisa dizer é
  // "ponha a mesa de acordo com esta vista" — como, é problema de quem conhece o jogo.
  JOGO.mesa.sincronizar(v);
  desenharHUD(v);
  JOGO.toque.reavaliar(v);
  // A mão que fecha a partida também mostra os pontos: fase 'fim' cai primeiro na tela
  // de fim de mão, e só depois do clique é que o campeão entra.
  //
  // O flag é obrigatório, e não dá para viver dentro do HUD: a tela é função pura da
  // fase e esta função roda em TODO publicar() — a cada jogada e, no online, a cada
  // vista que chega pelo fio. Sem memória, a publicação seguinte reabriria o fim de mão
  // por cima do campeão. Zerar quando a fase sai de 'fim' cobre revanche, próxima
  // partida e o convidado, que nunca passa por comecarLocal().
  if (v.fase !== 'fim') viuOFimDaMao = false;
  // Abandono não tem mão para mostrar: a partida foi interrompida, não terminou.
  // `saindo` é irmão do `viuOFimDaMao` logo acima, e pela mesma razão: a pergunta "sair
  // mesmo?" é estado de TELA, e esta função reescreve a tela a cada publicação. Sem o
  // flag, o primeiro bot a jogar fecharia o diálogo na cara do jogador.
  if (v.desistiu !== null && v.desistiu !== undefined) { saindo = false; mostrarFimDePartida(v); }
  else if (v.fase === 'fimDeMao' || (v.fase === 'fim' && !viuOFimDaMao)) { saindo = false; mostrarFimDeMao(v); }
  else if (v.fase === 'fim') { saindo = false; mostrarFimDePartida(v); }
  else if (!travado && !saindo) esconderTelas();
  // O botão de sair só existe enquanto há partida para sair.
  el('btSair').classList.toggle('oculta', !v || v.fase === 'fim');
}

function seguirOTurno() {
  clearTimeout(timerBot);
  if (!P || !JOGO.motor.emJogo(P) || modo === 'convidado') return;
  const c = P.cadeiras[P.vez];

  if (c.tipo === 'bot') {
    // setTimeout, e NÃO um contador dentro do requestAnimationFrame: navegador para o
    // rAF em aba de fundo. Com o relógio do bot preso ao quadro, o anfitrião trocar de
    // aba congelava a mesa inteira — inclusive para quem está jogando online.
    const quem = P.vez, naMao = P.maoNum;
    timerBot = setTimeout(() => {
      if (P && JOGO.motor.emJogo(P) && P.vez === quem && P.maoNum === naMao && P.cadeiras[quem].tipo === 'bot')
        aplicarIntencao(quem, JOGO.bot.jogada(P, quem));
    }, 550 + Math.random() * 600);                       // pausa para dar para acompanhar
    return;
  }

  if (c.tipo !== 'online' && P.vez !== euNaTela) pedirTroca(P.vez);
}

function pedirAcao(intencao) {
  if (!podeAgirAgora()) return;
  if (modo === 'convidado') {
    if (linkAnfitriao && linkAnfitriao.open) linkAnfitriao.send(Object.assign({ t: 'acao' }, intencao));
    else avisar('Sem conexão com a mesa.');
    return;
  }
  aplicarIntencao(vistaAtual.cadeira, intencao);
}

// O único lugar que mexe na partida. Vale para o seu clique, para o bot e para o que chega
// pela rede — e trata os três do mesmo jeito.
//
// A CASA DEIXOU DE SABER O QUE É UMA JOGADA. Ela decodificava `jogar` / `comprar` / `passar`,
// conferia `'esq'`/`'dir'`, e escrevia `${peca[0]}|${peca[1]}` na narração — três coisas que
// no truco não querem dizer nada. Hoje ela entrega a intenção inteira ao motor do jogo e
// recebe de volta o que houve:
//
//   { erro }                        recusa, com o motivo
//   { ok, narracao: ['…', '…'] }    aconteceu, e é isto que a mesa deve ouvir
//
// A guarda contra mensagem torta do fio (o C3 da Fila 11) foi JUNTO, e para o lugar certo:
// quem sabe se `{acao:'jogar', peca:undefined}` tem forma de jogada é quem conhece a forma.
// Isto não é sobre trapaça — o motor valida a jogada contra as ações da própria mão, e a
// fronteira do invariante 3 segue de pé — é sobre a mesa dos OUTROS não parar.
function aplicarIntencao(cadeira, i) {
  if (!P) return;
  const r = JOGO.motor.aplicar(P, cadeira, i || {});

  // O SILÊNCIO É O DEFEITO, NÃO A RECUSA. `avisar` fala com quem está NESTA tela, e o
  // convidado nunca está: para ele a peça simplesmente não ia, sem uma palavra. Recusar
  // continua certo; não dizer por quê é que não.
  if (r.erro) {
    if (cadeira === euNaTela) avisar(r.erro);
    else if (modo === 'anfitriao') avisarCadeira(cadeira, r.erro);
    return;
  }

  for (const linha of r.narracao || []) narrar(linha);
  avancar();
}

// ─── revezamento na mesma tela ───────────────────────────────────────────────
function pedirTroca(cadeira) {
  // Irmão dos três `saindo = false` de atualizarVista, e pelo mesmo motivo: esta tela
  // substitui a de sair, mas o flag ficava ligado — e aí o `!travado && !saindo` do
  // atualizarVista nunca mais chamava esconderTelas(). A tela de passe ficava para
  // sempre, sem botão nem tecla que saísse dela.
  saindo = false;
  travado = true;
  JOGO.mesa.esconderMao();                       // as peças somem da CENA, não só da vista
  el('passeNome').textContent = P.cadeiras[cadeira].nome;
  mostrarTela('telaPasse');
}

el('btPronto').onclick = () => {
  euNaTela = P.vez;
  travado = false;
  publicar();
  // Depois do publicar: quem solta a fala usa `vistaAtual`, e é o publicar que a põe de
  // pé para a cadeira nova. Antes dele, a fala sairia com o nome da cadeira anterior.
  soltarFalasGuardadas(euNaTela);
};

el('btProxima').onclick = () => {
  // O mesmo botão faz duas coisas. Com a partida encerrada ele é só navegação — se
  // caísse no novaMao(P) começaria uma mão nova e apagaria o fim que acabou de ser
  // mostrado. E o convidado não tem P: aqui ele redesenha a vista que já tem.
  if (vistaAtual && vistaAtual.fase === 'fim') {
    viuOFimDaMao = true;
    if (P) publicar(); else atualizarVista(vistaAtual);
    return;
  }
  JOGO.motor.proximaMao(P);
  tocarEmbaralho();
  anunciarAbertura();
  avancar();
};

el('btRevanche').onclick = () => comecarLocal();

// ─── sair no meio ────────────────────────────────────────────────────────────
// Antes não havia saída: quem sentava só saía fechando a aba — e no online isso não
// custava nada, a cadeira virava bot e o resultado sumia junto. Agora sair é uma ação
// do jogo, com o preço dito antes.
el('btSair').onclick = () => {
  el('sairAviso').textContent = modo === 'local'
    ? 'A partida acaba aqui e você volta para a montagem da mesa.'
    : 'A mesa continua sem você, e esta partida conta como derrota sua.';
  saindo = true;
  mostrarTela('telaSair');
};
el('btSairNao').onclick = () => {
  saindo = false;
  if (vistaAtual) atualizarVista(vistaAtual); else mostrarTela('telaMenu');
};
el('btSairSim').onclick = () => sairDaPartida();

function sairDaPartida() {
  saindo = false;
  if (modo === 'convidado') {
    // O anfitrião é a autoridade: ele é quem registra a derrota. `largarAMesa` avisa antes
    // de cair fora (e dá 400 ms para a mensagem sair), e GUARDA O CÓDIGO — sair entrega a
    // partida, não a mesa. Aqui havia um `esquecer('sala')`, e ele fechava as três portas de
    // volta ao mesmo tempo: o convidado não conseguia voltar nem com a sala ainda aberta.
    largarAMesa();
    P = null; vistaAtual = null;
    // Antes do encerrarRede atrasado de propósito: `mostrarTela('telaMenu')` recalcula o
    // botão "Voltar para a mesa XXXX", e ele lê a sala que o `largarAMesa` acabou de gravar.
    mostrarTela('telaMenu');
    return;
  }
  if (modo === 'anfitriao' && P && P.fase !== 'fim') {
    JOGO.motor.abandonar(P, euNaTela);
    publicar();                                   // a mesa fica sabendo por que acabou
    // A QUARTA CABEÇA DA MESMA HIDRA, achada ao consertar as outras três: um `setTimeout`
    // sem dono, sem guarda, e chamando `encerrarRede` incondicionalmente. Se o anfitrião
    // abrir OUTRA mesa nestes 400 ms, esta chamada acorda e destrói o peer que acabou de
    // nascer. Quem abriu já chamou `encerrarRede`, então a geração de lá é outra — e é
    // exatamente isso que a conferência pergunta.
    const geracao = geracaoRede;
    setTimeout(() => { if (geracao === geracaoRede) encerrarRede(); }, 400);
    return;
  }
  encerrarRede();
  P = null; vistaAtual = null;
  mostrarTela('telaMenu');
}

// HÁ GENTE DO OUTRO LADO ESPERANDO POR VOCÊ? A pergunta tem DUAS respostas, e é essa a
// armadilha deste item: o anfitrião tem a partida na memória, o convidado NUNCA tem `P` —
// para ele quem responde é a vista. Escrito só com `P`, que é o jeito óbvio de escrever, o
// aviso não existiria justamente para quem mais precisa dele: o convidado que fecha a aba e
// deixa a mesa dos outros parada os 30 s do `ESPERA_VOLTA`.
//
// É a mesma assimetria que o `btSair` já respeita (`:127` esconde o botão pela VISTA) e que o
// `partidaGuardada` aprendeu do jeito caro.
const mesaOnlineViva = () =>
  (modo === 'anfitriao' && !!P && P.fase !== 'fim') ||
  (modo === 'convidado' && !!vistaAtual && vistaAtual.fase !== 'fim');

// AVISAR ANTES DE FECHAR A ABA NO MEIO DE UMA MESA ONLINE. Decisão do Ricardo em 11/08 — o
// item estava na fila desde a Fila 5 esperando exatamente esta resposta, porque `beforeunload`
// é incômodo por natureza e isso é escolha de casa, não de programador.
//
// SÓ NO ONLINE, e nunca fora dele. Um aviso que aparece toda vez é o aviso que todo mundo
// aprende a ignorar — e aí ele não protege nem o caso que importa. Numa mesa local não há
// ninguém esperando, e a partida volta pelo "Continuar a partida de antes".
//
// A GUARDA VAI NO DISPARO, e o ouvinte é registrado uma vez só. É o padrão que a Fila 11
// escreveu com sangue (três `setTimeout` sem guarda no disparo custaram uma fila inteira), e
// aqui ele ainda evita um segundo lugar onde a mesma regra estaria escrita. Registrar e
// desregistrar conforme a partida seria mais elegante e intestável: o harness não apaga
// ouvinte de janela, e um desregistro sem prova é um ramo verde que nunca rodou.
//
// E ELE NÃO DISPARA QUANDO O JOGO SAI DE PROPÓSITO, sem flag nenhuma: pelas portas do jogo
// (`sairDaPartida`, `largarAMesa`) o estado JÁ é outro quando a página some — `P` é nulo,
// `vistaAtual` é nulo, `modo` voltou a 'local'. Quem responde é o estado, e não uma marca que
// alguém teria de lembrar de pôr. A faixa de abas também não navega: ela usa `replaceState`.
//
// O texto é do NAVEGADOR — nenhum deles deixa escolher a frase há anos. Quem explica o preço
// é a tela de sair, que já diz "a mesa continua sem você, e esta partida conta como derrota".
addEventListener('beforeunload', ev => {
  if (!mesaOnlineViva()) return;
  ev.preventDefault();
  ev.returnValue = '';                  // o canal legado, que alguns navegadores ainda exigem
});

// ─── voltar para a mesma partida ─────────────────────────────────────────────
// Fechar a aba sem querer, recarregar, o celular matar a página para poupar memória, um
// erro de script: nenhum desses é motivo para perder uma partida de doze mãos. A partida
// é dado PURO — arrays de números, nada de função nem de referência ao 3D —, então ela
// cabe inteira no localStorage e volta de um JSON.parse. É a mesma propriedade que faz o
// online funcionar; aqui ela paga pela segunda vez.
//
// Guarda em `publicar`, que é o funil por onde TODA mudança de estado passa — o mesmo
// motivo por que a tela também é desenhada ali. Guardar em `aplicarIntencao` deixaria de
// fora o fim de mão e a troca de jogador.
const HORAS_GUARDADA = 12;

// O QUE NÃO SOBREVIVE AO JSON É PROBLEMA DE QUEM O CRIOU. `P.faltaNo` é um array de `Set`, e
// `JSON.stringify(new Set())` dá `{}` — um objeto sem `.has` e sem `.indexOf`; sem a
// conversão nos dois sentidos, a partida retomada perdia calada quem passou em qual número e
// o bot estourava na primeira consulta. Mas `faltaNo` é uma palavra de dominó, e a casa a
// tinha escrita duas vezes.
//
// Um jogo cujo `P` já é dado puro — como o do truco — não põe as duas chaves e leva a
// identidade de graça.
const partidaParaGuardar = () => JOGO.motor.paraGuardar ? JOGO.motor.paraGuardar(P) : P;
const partidaDeVolta = g => JOGO.motor.deVolta ? JOGO.motor.deVolta(g) : g;

function guardarPartida() {
  // O convidado não tem partida na memória: é a invariante do online, não um esquecimento.
  if (!P || modo === 'convidado') return;
  // Partida acabada não é partida para voltar — e deixá-la guardada faria o menu oferecer
  // para sempre a revanche de uma final que você já viu.
  if (P.fase === 'fim') { esquecerDoJogo('partida'); return; }
  // POR JOGO, e não numa chave só: uma partida de dominó em andamento não pode sumir porque
  // alguém deu uma espiada na aba do truco. Ver `CHAVES_DO_JOGO`, em 010-constantes.js.
  guardarNoJogo('partida', { quando: Date.now(), euNaTela, P: partidaParaGuardar() });
}

// Devolve o guardado só se ele ainda serve. Prazo porque uma partida de anteontem não é
// mais "a partida de antes", é um estranho ocupando o botão.
//
// PARTIDA GUARDADA É ENTRADA DE FORA, exatamente como a mesa lembrada — e este era o único
// validador de `localStorage` do projeto que nunca tinha sido endurecido. Ele conferia
// quatro campos e entregava o resto CRU, enquanto o `mesaLembrada()` (140-menu.js) confere
// campo a campo com `Object.hasOwn`. A diferença de rigor entre os dois era acidental, não
// decidida.
//
// O que estava em jogo: sem `regras`, o `atualizarBotaoRetomar` desreferencia
// `g.P.regras.modo` e LANÇA — e ele roda no TOPO do módulo, então a exceção mata o script
// concatenado inteiro. Tela preta que volta a cada recarregamento, porque a causa está
// guardada, e sem saída a não ser limpar o armazenamento à mão. É o defeito 5 da Fila 6
// literalmente de novo, no arquivo vizinho.
//
// RECUSAR E NÃO REMENDAR, e é aqui que ele difere do `mesaLembrada`: uma preferência que
// não fecha pode cair no padrão porque "Clássico até 6" é uma mesa boa. Uma PARTIDA que não
// fecha não tem padrão nenhum — meia partida remendada é pior que partida nenhuma. Recusar
// só esconde o botão de retomar, que é degradação graciosa; o jogo abre normalmente.
function partidaGuardada() {
  // Jogo sem motor não tem partida para retomar, e nem tabela de modos contra a qual validar
  // — sem esta linha, a aba do truco derrubaria o menu em `JOGO.menu.MODOS` indefinido.
  if (!jogavel(JOGO)) return null;
  const g = lidoDoJogo('partida', null);
  if (!g || !g.P || !g.quando || Date.now() - g.quando > HORAS_GUARDADA * 3600e3) return null;

  const p = g.P;
  if (p.fase === 'fim') return null;
  // Os continentes que os consumidores desreferenciam sem perguntar. `partidaDeVolta` faz
  // `guardada.cadeiras.map`, `retomarPartida` lê `P.placar` e `P.maoNum`, o HUD lê tudo.
  //
  // `linha` e `monte` saíram desta lista: são campos DO DOMINÓ, e exigi-los aqui recusaria
  // toda partida de truco guardada — o botão "continuar a partida de antes" simplesmente
  // nunca apareceria naquela aba, calado, que é o defeito mais caro deste arquivo. Quem
  // confere os campos do jogo é o jogo, logo abaixo.
  for (const campo of ['cadeiras', 'maos', 'placar'])
    if (!Array.isArray(p[campo])) return null;
  if (!p.cadeiras.length || p.maos.length !== p.cadeiras.length) return null;
  if (!p.maos.every(Array.isArray)) return null;
  // `n` manda no laço de `retomarPartida` e na faixa de `euNaTela`.
  if (!Number.isInteger(p.n) || p.n !== p.cadeiras.length) return null;
  if (!Number.isInteger(p.vez) || p.vez < 0 || p.vez >= p.n) return null;

  // E as REGRAS, que é o campo cuja falta dava tela preta. `Object.hasOwn` e não
  // `MODOS[m] ?` pelo motivo que o `mesaLembrada` já registra: `MODOS['constructor']` é
  // truthy num objeto literal e passaria — deixar dois padrões de validação no mesmo
  // projeto é como o primeiro volta.
  if (!p.regras || typeof p.regras !== 'object') return null;
  if (!Object.hasOwn(JOGO.menu.MODOS, p.regras.modo)) return null;
  if (!JOGO.menu.MODOS[p.regras.modo].cadeiras.includes(p.n)) return null;

  // E O QUE SÓ O JOGO SABE CONFERIR. A casa cobra o que ELA desreferencia; o dominó cobra a
  // linha e o monte, o truco cobra a vira e as vazas. Recusar continua sendo degradação
  // graciosa: some o botão de retomar, e o jogo abre normalmente.
  if (JOGO.motor.partidaValida && !JOGO.motor.partidaValida(p)) return null;

  return g;
}

function atualizarBotaoRetomar() {
  const g = partidaGuardada();
  el('btRetomar').classList.toggle('oculta', !g);
  if (g) {
    const m = JOGO.menu.MODOS[g.P.regras.modo];
    el('btRetomar').textContent =
      `Continuar a partida de antes · ${m ? m.rotulo : g.P.regras.modo}, mão ${g.P.maoNum}`;
  }
}

// `mantendoOnline` é o item 3(c): quem chama é o anfitrião REABRINDO a própria mesa, e
// aí a mesa de antes não acabou — é ela que está voltando. Fora desse caso a conversão
// para bot é obrigatória, e é a diferença entre as duas situações que a opção nomeia.
function retomarPartida(opcoes) {
  const reabrindo = !!(opcoes && opcoes.mantendoOnline);
  const g = partidaGuardada();
  if (!g) { avisar('A partida guardada expirou.'); atualizarBotaoRetomar(); return; }
  // Reabrindo, o peer JÁ ESTÁ de pé com o código reivindicado: `encerrarRede` o destruiria
  // e com ele o mapa de donos que acabou de ser restaurado.
  if (!reabrindo) { encerrarRede(); modo = 'local'; }
  P = partidaDeVolta(g.P);

  // A mesa de antes acabou junto com a página. Cadeira que era de gente online passa a
  // ser bot, senão o motor espera para sempre por quem não vai responder — é a mesma
  // conversão que `comecarLocal` faz, e pela mesma razão.
  const viraramBot = reabrindo ? [] : P.cadeiras.filter(c => c.tipo === 'online');
  viraramBot.forEach(c => { c.tipo = 'bot'; c.nivel = c.nivel || 'normal'; });

  // A MESA acompanha a partida: é `MESA.cadeiras` que o `sentar()` consulta para achar
  // vaga online, e ela ficou com o que o menu tinha na tela — não com quem estava jogando.
  if (reabrindo) {
    MESA.n = P.n;
    P.cadeiras.forEach((c, i) => { if (MESA.cadeiras[i]) Object.assign(MESA.cadeiras[i], { tipo: c.tipo, nome: c.nome }); });
  }

  euNaTela = Number.isInteger(g.euNaTela) && g.euNaTela >= 0 && g.euNaTela < P.n ? g.euNaTela : 0;
  travado = false;
  viuOFimDaMao = false;
  saindo = false;
  JOGO.mesa.esquecerArrumacao();                 // a arrumação era da sessão que morreu
  limparConversa();
  ligarMurmuro();
  esconderTelas();
  narrar(`Partida retomada — mão ${P.maoNum}, placar ${P.placar.join(' × ')}.`);
  if (viraramBot.length) {
    narrar(viraramBot.length === 1
      ? 'A cadeira que era online virou bot: a mesa de antes não existe mais.'
      : `As ${viraramBot.length} cadeiras que eram online viraram bot: a mesa de antes não existe mais.`);
  }
  avancar();
}

el('btRetomar').onclick = () => { tocarClique(); retomarPartida(); };

// ─── a conversa ──────────────────────────────────────────────────────────────
function falar() {
  const txt = HUD.texto.value.trim();
  if (!txt) return;
  if (modo === 'convidado') {
    HUD.texto.value = '';
    // O anfitrião é quem valida e retransmite — a mensagem só volta para você depois de
    // passar por ele, e essa volta é a confirmação de que saiu.
    if (linkAnfitriao && linkAnfitriao.open) linkAnfitriao.send({ t: 'chat', canal: canalAtual, txt });
    else avisar('Sem conexão com a mesa.');
    return;
  }
  if (modo !== 'anfitriao') return;
  // O anfitrião entra pela MESMA porta que os convidados, com as mesmas guardas. Antes ele
  // chamava `espalharChat` direto e era o único que podia inundar a mesa.
  //
  // E o campo só é limpo se a fala passou: engolir o texto que a pessoa acabou de digitar
  // porque ela foi rápida demais é castigo duplo.
  if (receberChat(euNaTela, { canal: canalAtual, txt })) HUD.texto.value = '';
  else avisar('Devagar — uma fala por vez.');
}

HUD.texto.onkeydown = ev => {
  if (ev.key === 'Enter') { falar(); ev.preventDefault(); }
  if (ev.key === 'Escape') HUD.texto.blur();
};
HUD.canal.onclick = () => trocarCanal(canalAtual === 'dupla' ? 'todos' : 'dupla');
HUD.abrirConversa.onclick = () => alternarConversa();

// O jogo inteiro escuta o teclado no window, e nenhum dos dois handlers olhava para o
// alvo do evento: com um campo na tela, escrever "vamos" chamava arrumarMao() a cada
// 'a' digitado e Esc largava a peça levantada. (Já valia para o código da mesa, que tem
// letras — só não aparecia porque ali não há mão desenhada.)
// `SELECT` entrou junto: o menu gera um `<select>` por cadeira (`montarCadeiras`), e com um
// deles focado as setas escolhem o adversário enquanto `a`, `d` e `c` disparam por baixo. Era
// o mesmo defeito com um terceiro nome — e só ficou escrevível como asserção quando o dublê
// passou a dar `tagName` aos elementos, o que ele nunca fez em treze versões.
const digitando = ev => /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target || {}).tagName || '');

// A ESCADA DO ESCAPE, de fora para dentro — a mesma ordem que a cortina já pratica num toque:
// fecha o que está POR CIMA antes de mexer no que está por baixo. Com a gaveta aberta no
// celular, cancelar uma peça que ninguém consegue ver é um comando perdido, e o jogador
// aperta Esc de novo achando que a tecla não funciona.
//
// O terceiro degrau — foco dentro do campo — nem chega aqui: `digitando(ev)` devolve verdade
// e quem trata é o `onkeydown` do próprio campo, que só tira o foco e deixa a conversa aberta.
addEventListener('keydown', ev => {
  if (digitando(ev)) return;
  if (ev.key !== 'Escape') return;
  if (conversaAberta) { alternarConversa(false); return; }
  JOGO.toque.cancelar();
});

// Os dois `onclick` que moravam aqui — comprar e passar — foram embora com os botões: quem
// os gera agora é `desenharBarra`, e quem gera os botões liga os cliques deles.
// Arrumar e contar não passam pelo motor: são jeitos de OLHAR a sua própria mão, e
// funcionam fora da sua vez de propósito.
HUD.arrumar.onclick = () => { JOGO.mesa.arrumar(); tocarSoltar(); };
HUD.contar.onclick = () => {
  contando = !contando;
  guardar('contagem', contando);
  if (vistaAtual) atualizarVista(vistaAtual);
  atualizarCortina();                        // sem vista (saguão) o desenharHUD não roda
};

// ─── a dica ──────────────────────────────────────────────────────────────────
// A dica LEVANTA a peça em vez de só falar o nome dela: quem está aprendendo precisa ver
// onde ela cai, e levantar já mostra os fantasmas nas duas pontas e abre a barra de
// confirmar. Ou seja: a dica termina no mesmo lugar que um clique seu terminaria — você
// ainda confirma ou cancela, e ninguém joga por você.
// A dica devolve o que DIZER e o que FAZER, e o fazer é uma função porque só o jogo sabe
// qual clique é esse — no dominó ele levanta a peça e abre os fantasmas nas duas pontas.
//
//   null                                  não há o que sugerir
//   { texto, aviso, mostrar? }            a linha da conversa, o balão, e o gesto
function pedirDica() {
  if (!podeAgirAgora()) { avisar('A dica é para a sua vez.'); return; }
  const d = JOGO.bot.dica(vistaAtual);
  if (!d) { avisar('Nada a sugerir agora.'); return; }
  if (d.mostrar) d.mostrar();
  anotar(d.texto);
  avisar(d.aviso, 2600);
}

HUD.dica.onclick = () => pedirDica();

addEventListener('keydown', ev => {
  if (digitando(ev)) return;
  if (ev.key === 'a' || ev.key === 'A') JOGO.mesa.arrumar();
  if (ev.key === 'd' || ev.key === 'D') pedirDica();
  // `c` de conversa. Entra NESTE ouvinte e não num segundo: a guarda `digitando` já está
  // aqui, e um segundo dono do mesmo evento é como duas metades passam a discordar.
  if (ev.key === 'c' || ev.key === 'C') conversarPeloTeclado();
});

// ─── loop ────────────────────────────────────────────────────────────────────
// O primeiro `enquadrar()`, o `atualizarBotaoRetomar()` e o `requestAnimationFrame(quadro)`
// que ligava tudo foram para `900-arranque.js`. Os três dependem do jogo que está na mesa —
// o enquadramento lê a profundidade da mão, o botão de retomar lê a tabela de modos, e o
// loop anima a mesa —, e no primeiro tempo da carga não há jogo escolhido ainda.

let ultimoQuadro = performance.now();

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min((agora - ultimoQuadro) / 1000, 0.1);
  ultimoQuadro = agora;

  JOGO.toque.ponteiro();
  // `apontada` é lido AGORA, e não guardado: é um `let` que muda a cada movimento do
  // ponteiro, e um valor copiado no registro congelaria o realce da peça.
  JOGO.mesa.animar(dt, JOGO.toque.apontada());

  // A lâmpada respira de leve: mesa parada com luz parada parece render, não boteco.
  //
  // E ela era o PIOR item do jogo para sensibilidade vestibular, porque é o único
  // movimento que não acaba nunca — não depende de jogada, de vez nem de nada: enquanto a
  // aba estiver aberta, a luz oscila. Com a preferência ligada ela para no valor médio, e
  // repare que o boteco continua de pé: a luz fica quente e baixa, só não pulsa.
  const tremor = movimentoReduzido()
    ? 0.86
    : 0.86 + Math.sin(agora / 640) * 0.02 + Math.sin(agora / 197) * 0.012;
  bulbo.material.color.setHSL(0.1, 0.5, tremor);
  lampada.intensity = 280 + tremor * 30;

  renderer.render(scene, camera);
}

// Ponte para os testes de aparência (tests/shots.mjs): monta situações específicas —
// tabuleiro longo, lá-e-lô com as duas pontas acesas — sem ter de jogar de verdade.
window.__jogo = {
  pronto: true, MESA, comecarLocal, aplicarIntencao, pedirAcao, mostrarTela,
  // A CAMERA é da casa e fica aqui; o que ela projeta — as peças, os grupos, a mão — chega
  // pelo `JOGO.ponte`, que o arranque despeja por cima deste objeto. Foi assim que os nomes
  // do dominó saíram daqui: um teste que precisa de `grupoMonte` está pedindo uma coisa DO
  // JOGO, e quem sabe se ela existe é o jogo. As chaves continuam as mesmas, então nenhuma
  // suíte mudou de linha.
  camera, enquadrar,
  // THREE e as tralhas existem aqui para a asserção 3D CONTRA 3D do test-telas medir
  // CAIXAS em coordenadas de mundo. Sem o Box3 ela só saberia comparar centros, e centro
  // contra centro nunca acusa nada: os centros ficam a 2,7 um do outro e quem se toca são
  // as bordas.
  THREE, tralhas,
  publicar, alternarConversa, falar, trocarCanal,
  // Retomar precisa ser dirigível pelos testes: o caminho inteiro só existe entre duas
  // cargas da página, e é justamente aí que ninguém olha.
  retomarPartida, partidaGuardada, atualizarBotaoRetomar, lembrarMesa, mesaLembrada,
  pedirDica,
  // CONGELA A MESA: cancela o lance de bot que estiver agendado. As cenas do
  // tests/test-telas.mjs montam a mesa jogando de verdade e depois esperam a tela
  // assentar — e nessa janela um número VARIÁVEL de temporizadores de bot disparava, com
  // a mesma cena dando `mesa 0.27` numa rodada e `0.31` na outra. Semear o Math.random
  // matou a variação do EMBARALHO; isto mata a do RELÓGIO, que era a outra metade.
  // Uma chamada basta: nada reagenda sozinho, porque `seguirOTurno` só roda em
  // `publicar()`, e depois da montagem a cena não publica mais nada.
  pararBots: () => clearTimeout(timerBot),
  // Quantas conexões o anfitrião tem de pé. É como o teste do online prova que a mesma
  // pessoa em duas abas ocupa UMA cadeira, e não duas: sem isto, o take-over só daria
  // para conferir de fora pelo sintoma, que é a mesa lotar de fantasmas.
  conexoesAbertas: () => conexoes.size,
  // O painel do código da sala. Exposto para o test-telas montar a cena de mesa online
  // sem precisar de rede: ele chama a MESMA função que a rede chama, então o que a foto
  // mostra é o que o jogo faz.
  pintarSala, salaGuardada, atualizarBotaoVoltarMesa,
  // A TEXTURA é a única coisa do jogo cujo estado não está em `vista` nem em `P`: ela vive
  // num <canvas> que o sistema operacional pode jogar fora enquanto a aba está no fundo.
  // `texturas` é para a suíte perguntar pelo nome em vez de caçar material no grafo.
  texturas, conferirTexturas,
  // E este é para o CELULAR responder, que é a única medição que vale de verdade aqui: o
  // laboratório prova que o mecanismo existe, não que é o que acontece no aparelho do
  // Ricardo. Celular no chrome://inspect, sair para outro aplicativo, voltar, e chamar
  // isto — seis números. Os contadores moram no jogo porque quem volta do outro
  // aplicativo não tinha console aberto na hora do evento. Serializável de propósito.
  diagnosticoTexturas: () => ({
    perdas: perdasDeContexto, restauracoes, repinturas,
    texturas: texturas.map(t => ({
      nome: t.nome, w: t.canvas.width, h: t.canvas.height,
      alfa: t.canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3],
    })),
  }),
  // O menu redesenha a lista de cadeiras com o nome que o convidado mandou pela REDE —
  // e por isso o teste do online precisa poder forçar esse redesenho para conferir que
  // o nome chega como texto, e não como elemento.
  montarCadeiras,
  // As opções que o jogo oferece nem sempre valem na mesa que está montada (a compra livre
  // do dominó só existe onde existe monte), e `disabled` num <button> só existe com DOM de
  // verdade — daí a asserção morar no test-online e precisar chamar isto.
  ajustarOpcoesAoModo,
  // QUAL JOGO ESTÁ NA MESA. É da casa e não da ponte do jogo — um jogo não pode ser a fonte
  // da resposta "quem está na mesa", porque a pergunta existe justamente quando não se sabe.
  //
  // GETTER e não valor: `abrirJogo` troca o `JOGO_ID` em tempo de execução, e uma cópia
  // tirada no arranque seria uma fotografia do primeiro jogo para sempre — foi exatamente o
  // que o `Object.assign` comendo getters custou na Fase 1.
  get JOGO_ID() { return JOGO_ID; },
  get P() { return P; },
  get vista() { return vistaAtual; },
  // `maoNaTela` e `selecionar` foram para o `JOGO.ponte`: os dois falam de PEÇA — a ordem
  // das peças na tela, e escolher uma pela peça e não pelo índice. Uma carta de truco não
  // responde a nenhuma das duas perguntas do mesmo jeito.
};
