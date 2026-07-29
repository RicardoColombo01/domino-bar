// Escolher a peça, ver onde ela cai, confirmar. Raycast puro, sem arrastar.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// SEMPRE dois passos, inclusive quando só existe uma ponta possível. Antes o clique na
// peça já a jogava nesses casos, e um deslize do mouse virava jogada — num jogo em que
// a peça errada custa a mão inteira, isso é caro demais para economizar um clique.
//
//   clique na peça  →  ela levanta, o fantasma aparece onde ela vai cair
//                      (um por ponta, quando serve nas duas), e a barra confirma
//   clique no fantasma ou no botão  →  joga
//   Esc, clique na mesa vazia, ou clique na mesma peça  →  cancela
//   clique em OUTRA peça  →  troca a seleção direto, sem cancelar antes
//
// Trocar direto é o que impede o passo a mais de virar dois passos a mais: passear pela
// mão vendo cada encaixe custa um clique por peça, não dois.

const raio = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let apontada = null;

// Reaproveitados a cada quadro do arrasto: alocar Vector3 dentro de um pointermove é
// lixo para o coletor a 120 eventos por segundo.
const planoDaMao = new THREE.Plane();
const _normal = new THREE.Vector3();
const _ondeEstava = new THREE.Vector3();
const _onde = new THREE.Vector3();

const mirar = ev => {
  ponteiro.x = (ev.clientX / innerWidth) * 2 - 1;
  ponteiro.y = -(ev.clientY / innerHeight) * 2 + 1;
};
addEventListener('pointermove', mirar);

// O dedo não fica em cima da tela como o mouse: sem soltar a mira, a peça em que você
// tocou por último ficava erguida para sempre, como um hover que nunca acaba.
const soltarMira = ev => {
  if (ev.pointerType === 'mouse') return;
  apontada = null;
  ponteiro.set(9, 9);                 // fora de qualquer coisa
};
addEventListener('pointerup', soltarMira);
addEventListener('pointercancel', soltarMira);

function alvoSob() {
  raio.setFromCamera(ponteiro, camera);

  if (temPrevia()) {
    const nasPrevias = raio.intersectObjects(grupoPrevia.children, true);
    if (nasPrevias.length) {
      let o = nasPrevias[0].object;
      while (o && o.userData.lado === undefined) o = o.parent;
      if (o) return { tipo: 'previa', lado: o.userData.lado };
    }
  }

  const naSua = raio.intersectObjects(grupoMao.children, true);
  if (naSua.length) {
    let o = naSua[0].object;
    while (o && !naMao.some(m => m.obj === o)) o = o.parent;
    const i = naMao.findIndex(m => m.obj === o);
    if (i >= 0) return { tipo: 'peca', i };
  }
  return null;
}

function atualizarPonteiro() {
  // Durante o arrasto o realce de "passando por cima" briga com a peça erguida no dedo.
  if (emArrasto()) { apontada = null; renderer.domElement.style.cursor = 'grabbing'; return; }
  const alvo = alvoSob();
  apontada = alvo && alvo.tipo === 'peca' ? alvo.i : null;
  const clicavel = alvo && (alvo.tipo === 'previa' || naMao[alvo.i].jogavel);
  // `grab` na peça da mão mesmo fora da sua vez: é o que anuncia que dá para arrumar.
  renderer.domElement.style.cursor = clicavel ? 'pointer' : (apontada !== null ? 'grab' : 'default');
}

function selecionarPeca(i) {
  const m = naMao[i];
  if (!m || !m.jogavel || !vistaAtual) return;
  escolhida = chave(m.peca);
  mostrarPrevia(vistaAtual, m.peca, m.pontas);
  mostrarConfirmacao(vistaAtual, m);
  tocarClique();
}

// Chamado a cada redesenho. O tabuleiro se reconcilia e apaga a prévia junto; se a peça
// escolhida continua valendo, ela é reposicionada contra a linha nova. É o que segura o
// caso do online: uma visão pode chegar do anfitrião enquanto você ainda decide, e sem
// isto o fantasma sumiria calado, deixando a barra prometendo uma jogada sem alvo.
function reavaliarEscolha(vista) {
  const m = escolhida === null ? null : naMaoPorChave(escolhida);
  if (!m || !m.jogavel || vista.fase !== 'mao' || vista.vez !== vista.cadeira) { cancelarEscolha(); return; }
  mostrarPrevia(vista, m.peca, m.pontas);
  mostrarConfirmacao(vista, m);
}

function cancelarEscolha() {
  escolhida = null;
  esconderPrevia();
  esconderConfirmacao();
}

function confirmarJogada(lado) {
  const m = escolhida === null ? null : naMaoPorChave(escolhida);
  if (!m || !m.pontas.includes(lado)) return;
  const peca = m.peca;
  cancelarEscolha();
  // Uma linha, e muda a sensação no celular: encaixar a peça tem um estalo no dedo.
  if (navigator.vibrate) navigator.vibrate(12);
  pedirAcao({ acao: 'jogar', peca, ponta: lado });
}

// ─── tocar para escolher, arrastar para arrumar ──────────────────────────────
// Um gesto só, dois significados, separados por DISTÂNCIA e não por tempo: passou de
// alguns pixels, virou arrasto; não passou, foi toque. Limiar de tempo (o "toque longo")
// atrasaria o gesto comum — escolher a peça — para servir ao raro.
let arrasto = null;                 // { id, k, x0, y0, arrastando }
const LIMIAR_ARRASTO = 9;           // px

const emArrasto = () => !!(arrasto && arrasto.arrastando);

function encerrarArrasto() {
  if (!arrasto) return;
  const m = naMaoPorChave(arrasto.k);
  if (m) m.arrastando = false;
  arrasto = null;
  posicionarMao();
}

addEventListener('pointerdown', ev => {
  // Só reage a clique na MESA. Sem isto, clicar num botão da barra de confirmação
  // dispararia este handler primeiro (pointerdown vem antes de click), o raycast não
  // acharia nada, a escolha seria cancelada — e o botão abriria uma jogada vazia.
  if (ev.target !== renderer.domElement) return;
  if (!vistaAtual) return;
  // O ponteiro só era atualizado no pointermove — o que no mouse é sempre verdade e no
  // dedo não é: o primeiro toque da tela não move nada antes de tocar, então a mira
  // ficava na posição do toque ANTERIOR e o raycast acertava outra peça.
  mirar(ev);

  const alvo = alvoSob();
  if (!alvo) { if (podeAgirAgora()) cancelarEscolha(); return; }
  if (alvo.tipo === 'previa') { if (podeAgirAgora()) confirmarJogada(alvo.lado); return; }

  // Abre o gesto SEMPRE, seja sua vez ou não: arrumar a mão enquanto os bots jogam é
  // metade da utilidade de poder arrumar. O portão de turno desceu para o toque, no
  // pointerup — são dois portões diferentes, e juntá-los num só quebra um dos dois.
  arrasto = { id: ev.pointerId, k: chave(naMao[alvo.i].peca), x0: ev.clientX, y0: ev.clientY, arrastando: false };
  if (renderer.domElement.setPointerCapture) {
    try { renderer.domElement.setPointerCapture(ev.pointerId); } catch (e) { void e; }
  }
});

addEventListener('pointermove', ev => {
  if (!arrasto || ev.pointerId !== arrasto.id) return;
  const m = naMaoPorChave(arrasto.k);
  if (!m) { encerrarArrasto(); return; }              // a mão mudou embaixo do dedo

  if (!arrasto.arrastando) {
    if (Math.hypot(ev.clientX - arrasto.x0, ev.clientY - arrasto.y0) < LIMIAR_ARRASTO) return;
    arrasto.arrastando = true;
    m.arrastando = true;
    cancelarEscolha();
    tocarClique();
  }

  // A peça segue o ponteiro num plano paralelo à tela que passa por onde ela estava.
  raio.setFromCamera(ponteiro, camera);
  planoDaMao.setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(_normal).clone().negate(),
    _ondeEstava.set(m.xBase, m.yBase + 0.5, m.zBase));
  if (raio.ray.intersectPlane(planoDaMao, _onde)) m.obj.position.copy(_onde);

  const destino = slotSob(ev.clientX, ev.clientY);
  const atual = naMao.indexOf(m);
  if (destino >= 0 && destino !== atual) moverNaMao(atual, destino);
});

function soltarArrasto(ev) {
  if (!arrasto || (ev && ev.pointerId !== arrasto.id)) return;
  const foiArrasto = arrasto.arrastando;
  const k = arrasto.k;
  encerrarArrasto();

  if (foiArrasto) {
    tocarSoltar();
    if (navigator.vibrate) navigator.vibrate(8);
    return;                            // arrastou: nunca seleciona junto
  }

  // Foi um toque. AQUI mora o portão de turno.
  if (!podeAgirAgora()) return;
  const i = naMao.findIndex(m => chave(m.peca) === k);
  if (i < 0) return;
  if (k === escolhida) { cancelarEscolha(); return; }
  if (!naMao[i].jogavel) {
    avisar(naMao[i].pontas && naMao[i].pontas.length === 0 && encaixaEmAlgumaPonta(naMao[i].peca)
      ? 'Essa peça fecharia o jogo de propósito.'
      : 'Essa peça não encaixa em nenhuma ponta.');
    return;
  }
  selecionarPeca(i);
}
addEventListener('pointerup', soltarArrasto);
addEventListener('pointercancel', () => encerrarArrasto());

// A peça encaixa numa ponta mas o motor não a ofereceu? Então quem a tirou da lista foi
// a regra do fechamento — e o aviso tem de dizer isso, não "não encaixa".
function encaixaEmAlgumaPonta(peca) {
  const pt = vistaAtual && vistaAtual.pontas;
  return !!pt && (peca[0] === pt[0] || peca[1] === pt[0] || peca[0] === pt[1] || peca[1] === pt[1]);
}
