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

const podeAgirAgora = () =>
  !!vistaAtual && !travado && vistaAtual.fase === 'mao' && vistaAtual.vez === vistaAtual.cadeira;

function comecarLocal() {
  // Sem rede não existe cadeira online: depois de sair de uma mesa, MESA.cadeiras ainda
  // guarda o tipo 'online' e a revanche montava uma partida com uma cadeira que ninguém
  // jogava — nem bot, nem troca de tela — e a mesa morria em silêncio. É a mesma
  // conversão que o btIniciarOnline faz quando a vaga não é preenchida.
  if (modo === 'local') {
    MESA.cadeiras.slice(0, MESA.n).forEach(c => {
      if (c.tipo === 'online') { c.tipo = 'bot'; c.nivel = c.nivel || 'normal'; }
    });
  }
  const cadeiras = MESA.cadeiras.slice(0, MESA.n)
    .map(c => ({ nome: c.nome, tipo: c.tipo, nivel: c.nivel }));
  P = novaPartida(cadeiras, {
    alvo: MESA.alvo, compraVoluntaria: MESA.compraVoluntaria, modo: MESA.modo,
  });
  euNaTela = 0;
  travado = false;
  esquecerArrumacao();               // mesa nova, mão nova: a arrumação de antes não vale
  limparConversa();
  tocarEmbaralho();
  anunciarAbertura();
  avancar();
}

function anunciarAbertura() {
  narrar(`Mão ${P.maoNum} · abre ${P.cadeiras[P.vez].nome}` +
    (P.pecaObrigatoria ? ` com o ${P.pecaObrigatoria.join('|')}` : ''));
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
  const v = visaoDe(P, euNaTela);
  atualizarVista(travado
    ? Object.assign({}, v, { mao: [], acoes: { jogadas: [], comprar: false, passar: false } })
    : v);
  guardarPartida();
}

function atualizarVista(v) {
  vistaAtual = v;
  sincronizarTabuleiro(v);
  sincronizarMao(v);
  sincronizarOutros(v);
  sincronizarMonte(v);
  desenharHUD(v);
  reavaliarEscolha(v);
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
  if (!P || P.fase !== 'mao' || modo === 'convidado') return;
  const c = P.cadeiras[P.vez];

  if (c.tipo === 'bot') {
    // setTimeout, e NÃO um contador dentro do requestAnimationFrame: navegador para o
    // rAF em aba de fundo. Com o relógio do bot preso ao quadro, o anfitrião trocar de
    // aba congelava a mesa inteira — inclusive para quem está jogando online.
    const quem = P.vez, naMao = P.maoNum;
    timerBot = setTimeout(() => {
      if (P && P.fase === 'mao' && P.vez === quem && P.maoNum === naMao && P.cadeiras[quem].tipo === 'bot')
        aplicarIntencao(quem, jogadaDoBot(P, quem));
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

// O único lugar que mexe na partida. Vale para o seu clique, para o bot e para o que
// chega pela rede — e valida os três do mesmo jeito.
function aplicarIntencao(cadeira, i) {
  if (!P || P.fase !== 'mao') return;
  let r;
  if (i.acao === 'jogar') r = jogar(P, cadeira, i.peca, i.ponta);
  else if (i.acao === 'comprar') r = comprar(P, cadeira);
  else r = passar(P, cadeira);

  if (r.erro) { if (cadeira === euNaTela) avisar(r.erro); return; }

  const nome = P.cadeiras[cadeira].nome;
  if (i.acao === 'jogar') narrar(`${nome} jogou ${i.peca[0]}|${i.peca[1]}`);
  else if (i.acao === 'comprar') { tocarCompra(); narrar(`${nome} comprou do monte`); }
  else { tocarPasse(); narrar(`${nome} passou`); }

  if (r.fim) {
    tocarBatida();
    narrar(r.fim.motivo === 'batida' ? `${nome} bateu — ${NOME_BATIDA[r.fim.tipo]}` : 'Jogo trancado');
  }
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
  esconderMao();                       // as peças somem da CENA, não só da vista
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
  novaMao(P);
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
    // O anfitrião é a autoridade: ele é quem registra a derrota. Avisar antes de cair
    // fora evita depender de o `close` chegar — mas o prazo de volta cobre se não.
    if (linkAnfitriao && linkAnfitriao.open) linkAnfitriao.send({ t: 'desisto' });
    // Sair de propósito é dizer que aquela mesa acabou para você: o botão de voltar não
    // pode continuar oferecendo a partida que você mesmo entregou. Cair é outra coisa —
    // ali o código FICA guardado, que é o motivo de tudo isto existir.
    esquecer('sala');
    encerrarRede();
    P = null; vistaAtual = null;
    mostrarTela('telaMenu');
    return;
  }
  if (modo === 'anfitriao' && P && P.fase !== 'fim') {
    abandonar(P, euNaTela);
    publicar();                                   // a mesa fica sabendo por que acabou
    setTimeout(encerrarRede, 400);                // e dá tempo de a mensagem sair
    return;
  }
  encerrarRede();
  P = null; vistaAtual = null;
  mostrarTela('telaMenu');
}

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

// `P.faltaNo` é um array de Set, e Set NÃO sobrevive a JSON: `JSON.stringify(new Set())`
// dá `{}` — um objeto sem `.has` e sem `.indexOf`. Sem estas duas conversões a partida
// retomada perdia calada quem passou em qual número (a marca da Fila 4) e o bot estourava
// na primeira consulta, em `05-bot.js`. É a MESMA conversão que `visaoDe` faz para o fio,
// e pela mesma razão: o que não sobrevive à serialização não existe do outro lado.
const partidaParaGuardar = () =>
  Object.assign({}, P, { faltaNo: P.faltaNo.map(s => Array.from(s)) });

const partidaDeVolta = guardada => Object.assign({}, guardada, {
  faltaNo: guardada.cadeiras.map((_, i) => {
    const g = (guardada.faltaNo || [])[i];
    return new Set(Array.isArray(g) ? g : []);
  }),
});

function guardarPartida() {
  // O convidado não tem partida na memória: é a invariante do online, não um esquecimento.
  if (!P || modo === 'convidado') return;
  // Partida acabada não é partida para voltar — e deixá-la guardada faria o menu oferecer
  // para sempre a revanche de uma final que você já viu.
  if (P.fase === 'fim') { esquecer('partida'); return; }
  guardar('partida', { quando: Date.now(), euNaTela, P: partidaParaGuardar() });
}

// Devolve o guardado só se ele ainda serve. Prazo porque uma partida de anteontem não é
// mais "a partida de antes", é um estranho ocupando o botão.
function partidaGuardada() {
  const g = lido('partida', null);
  if (!g || !g.P || !Array.isArray(g.P.cadeiras) || !Array.isArray(g.P.maos)) return null;
  if (g.P.fase === 'fim') return null;
  if (!g.quando || Date.now() - g.quando > HORAS_GUARDADA * 3600e3) return null;
  return g;
}

function atualizarBotaoRetomar() {
  const g = partidaGuardada();
  el('btRetomar').classList.toggle('oculta', !g);
  if (g) {
    const m = MODOS[g.P.regras.modo];
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
  esquecerArrumacao();                 // a arrumação era da sessão que morreu
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
const digitando = ev => /^(INPUT|TEXTAREA)$/.test((ev.target || {}).tagName || '');

addEventListener('keydown', ev => {
  if (digitando(ev)) return;
  if (ev.key === 'Escape') cancelarEscolha();
});

HUD.comprar.onclick = () => pedirAcao({ acao: 'comprar' });
HUD.passar.onclick = () => pedirAcao({ acao: 'passar' });
// Arrumar e contar não passam pelo motor: são jeitos de OLHAR a sua própria mão, e
// funcionam fora da sua vez de propósito.
HUD.arrumar.onclick = () => { arrumarMao(); tocarSoltar(); };
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
function pedirDica() {
  if (!podeAgirAgora()) { avisar('A dica é para a sua vez.'); return; }
  const d = dicaDaVista(vistaAtual);
  if (!d) { avisar('Nada a sugerir agora.'); return; }

  // Só os porquês que pesaram de verdade, do mais forte para o mais fraco, e no máximo
  // dois: uma lista de seis razões não ensina nada a quem está começando.
  const razoes = (d.porques || []).slice()
    .sort((a, b) => Math.abs(b.peso || 0) - Math.abs(a.peso || 0))
    .slice(0, 2).map(p => p.texto);

  if (d.acao !== 'jogar') {
    anotar(`Dica: ${d.acao === 'comprar' ? 'comprar' : 'passar'} — ${razoes[0] || 'não há jogada'}`);
    avisar(d.acao === 'comprar' ? 'Dica: compre do monte.' : 'Dica: passe a vez.');
    return;
  }

  // Procura na ORDEM DA TELA, que desde a arrumação não é a de vista.mao — é o mesmo
  // cuidado da ponte `selecionar` dos testes, e pela mesma razão.
  const i = naMao.findIndex(m => mesmaPeca(m.peca, d.peca));
  if (i < 0) { avisar('Nada a sugerir agora.'); return; }
  selecionarPeca(i);
  tocarSoltar();
  const onde = d.ponta === 'esq' ? 'na esquerda' : 'na direita';
  anotar(`Dica: ${d.peca[0]}|${d.peca[1]} ${onde}${razoes.length ? ' — ' + razoes.join('; ') : ''}`);
  avisar(`Dica: ${d.peca[0]}|${d.peca[1]} ${onde}`, 2600);
}

HUD.dica.onclick = () => pedirDica();

addEventListener('keydown', ev => {
  if (digitando(ev)) return;
  if (ev.key === 'a' || ev.key === 'A') arrumarMao();
  if (ev.key === 'd' || ev.key === 'D') pedirDica();
});

// ─── loop ────────────────────────────────────────────────────────────────────
// Primeiro enquadramento. Fica aqui, e não no fim de 07-cena.js, porque enquadrar() lê
// a profundidade da mão (10-mao.js) e manda refazer o leque — nada disso existe ainda
// quando o arquivo da cena termina de rodar.
enquadrar();

// O menu já nasce visível pelo HTML, então `mostrarTela` nunca roda na carga — e sem esta
// chamada o botão de retomar só apareceria depois da primeira volta ao menu, que é
// justamente quando ele não é mais necessário. Fica aqui, no fim, pelo mesmo motivo do
// `enquadrar()` acima: depende de tudo já estar declarado.
atualizarBotaoRetomar();

let ultimoQuadro = performance.now();

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min((agora - ultimoQuadro) / 1000, 0.1);
  ultimoQuadro = agora;

  atualizarPonteiro();
  animarTabuleiro(dt);
  animarMao(dt, apontada);

  // A lâmpada respira de leve: mesa parada com luz parada parece render, não boteco.
  const tremor = 0.86 + Math.sin(agora / 640) * 0.02 + Math.sin(agora / 197) * 0.012;
  bulbo.material.color.setHSL(0.1, 0.5, tremor);
  lampada.intensity = 280 + tremor * 30;

  renderer.render(scene, camera);
}
requestAnimationFrame(quadro);

// Ponte para os testes de aparência (tests/shots.mjs): monta situações específicas —
// tabuleiro longo, lá-e-lô com as duas pontas acesas — sem ter de jogar de verdade.
window.__jogo = {
  pronto: true, MESA, comecarLocal, aplicarIntencao, pedirAcao, jogadaDoBot, mostrarTela, grupoPrevia,
  // camera e naMao existem aqui para tests/test-telas.mjs projetar cada peça da mão para
  // coordenadas de tela e reprovar se alguma cair fora — que é o teste que prova "dá
  // para ver a mão" sem ninguém olhar screenshot.
  camera, naMao, enquadrar, grupoMesa, grupoOutros, grupoMonte,
  arrumarMao, moverNaMao, publicar, alternarConversa, falar, trocarCanal,
  // Retomar precisa ser dirigível pelos testes: o caminho inteiro só existe entre duas
  // cargas da página, e é justamente aí que ninguém olha.
  retomarPartida, partidaGuardada, atualizarBotaoRetomar, lembrarMesa, mesaLembrada,
  pedirDica, dicaDaVista,
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
  get P() { return P; },
  get vista() { return vistaAtual; },
  // A ORDEM DA TELA, que desde a arrumação não é mais a de vista.mao. Quem quiser
  // selecionar uma peça tem de procurar aqui.
  get maoNaTela() { return naMao.map(m => m.peca); },
  // Faz exatamente o que o clique faria: levanta a peça, mostra os fantasmas e a barra.
  // Recebe a PEÇA e não o índice — igual ao motor, e pelo mesmo motivo: índice de tela
  // era o único acoplamento do repositório que quebrava calado quando a mão reordenava.
  selecionar: peca => selecionarPeca(naMao.findIndex(m => mesmaPeca(m.peca, peca))),
};
