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
let timerBot = 0;

const podeAgirAgora = () =>
  !!vistaAtual && !travado && vistaAtual.fase === 'mao' && vistaAtual.vez === vistaAtual.cadeira;

function comecarLocal() {
  const cadeiras = MESA.cadeiras.slice(0, MESA.n)
    .map(c => ({ nome: c.nome, tipo: c.tipo, nivel: c.nivel }));
  P = novaPartida(cadeiras, { alvo: MESA.alvo, compraVoluntaria: MESA.compraVoluntaria });
  euNaTela = 0;
  travado = false;
  linhasDoLog.length = 0;
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
}

function atualizarVista(v) {
  vistaAtual = v;
  sincronizarTabuleiro(v);
  sincronizarMao(v);
  sincronizarOutros(v);
  sincronizarMonte(v);
  desenharHUD(v);
  reavaliarEscolha(v);
  if (v.fase === 'fimDeMao') mostrarFimDeMao(v);
  else if (v.fase === 'fim') mostrarFimDePartida(v);
  else if (!travado) esconderTelas();
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
  travado = true;
  esconderMao();                       // as peças somem da CENA, não só da vista
  el('passeNome').textContent = P.cadeiras[cadeira].nome;
  mostrarTela('telaPasse');
}

el('btPronto').onclick = () => {
  euNaTela = P.vez;
  travado = false;
  publicar();
};

el('btProxima').onclick = () => {
  novaMao(P);
  tocarEmbaralho();
  anunciarAbertura();
  avancar();
};

el('btRevanche').onclick = () => comecarLocal();

addEventListener('keydown', ev => {
  if (ev.key === 'Escape') cancelarEscolha();
});

HUD.comprar.onclick = () => pedirAcao({ acao: 'comprar' });
HUD.passar.onclick = () => pedirAcao({ acao: 'passar' });

// ─── loop ────────────────────────────────────────────────────────────────────
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
  get P() { return P; },
  get vista() { return vistaAtual; },
  // Faz exatamente o que o clique faria: levanta a peça, mostra os fantasmas e a barra.
  selecionar: i => selecionarPeca(i),
};
