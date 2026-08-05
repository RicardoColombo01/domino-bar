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
function largarMira() {
  apontada = null;
  ponteiro.set(9, 9);                 // fora de qualquer coisa
}
const soltarMira = ev => {
  if (ev.pointerType === 'mouse') return;
  largarMira();
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

// O CURSOR DE TECLADO. É um índice na mão, irmão do `apontada` do raycast — e é de
// propósito que ele alimenta a MESMA variável: o realce da peça focada, que a fila previa
// como "o custo real" deste item, já existia inteiro. `animarMao(dt, apontada)` levanta a
// peça apontada em 0.2 desde sempre, e ela nunca soube que aquilo vinha de um mouse.
//
// O dono do `apontada` passa a ser O ÚLTIMO DISPOSITIVO QUE FALOU. Sem essa regra os dois
// brigam a 60 quadros por segundo: `atualizarPonteiro` roda em todo quadro e reescreve o
// `apontada` a partir do raycast, então um cursor de teclado seria apagado no quadro
// seguinte ao de ter sido posto. Mexer o ponteiro larga o teclado; teclar larga o ponteiro.
let cursorTeclado = null;
addEventListener('pointermove', () => { cursorTeclado = null; });

function atualizarPonteiro() {
  // Durante o arrasto o realce de "passando por cima" briga com a peça erguida no dedo.
  if (emArrasto()) { apontada = null; renderer.domElement.style.cursor = 'grabbing'; return; }
  // O teclado manda enquanto for ele o último a falar. Não mexe no `cursor` do CSS: quem
  // não está usando o mouse não tem seta na tela para mudar de forma.
  if (cursorTeclado !== null) {
    if (cursorTeclado >= naMao.length) cursorTeclado = naMao.length ? naMao.length - 1 : null;
    apontada = cursorTeclado;
    return;
  }
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
let arrasto = null;                 // { id, k, x0, y0, arrastando, mexeu, capturado }

// O dedo TREME e o mouse não. 9 px é uma mão apoiada numa mesa; num celular na mão é
// menos que a oscilação de um toque PARADO — o toque virava arrasto sozinho, soltava sem
// ter reordenado nada e nunca contava como clique. Era o defeito de campo do item 7:
// "às vezes o clique não joga a peça", só no celular. A assimetria era a evidência.
const LIMIAR_ARRASTO = { mouse: 9, dedo: 18 };   // px
const limiarDe = ev => ev.pointerType === 'mouse' ? LIMIAR_ARRASTO.mouse : LIMIAR_ARRASTO.dedo;

// Passar do limiar não é o mesmo que ARRASTAR, e essa diferença é a rede embaixo do
// número acima: um limiar é sempre um chute, 18 px serve para a maioria dos dedos e vai
// continuar sendo pouco para alguém. Aqui a pergunta é pelo RESULTADO — um gesto que
// atravessou o limiar e não trocou nenhuma peça de lugar não arrumou nada, e a única
// intenção que sobra é a de tocar.
const foiMesmoArrasto = g => g.arrastando && g.mexeu;

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
  // Um dedo de cada vez. Sem isto, um segundo toque sobrescrevia `arrasto` e a peça do
  // primeiro dedo ficava com `arrastando = true` para sempre — animarMao a ignora, e ela
  // congelava no ar. Dois dedos na tela é acidente comum no celular.
  //
  // Mas "de cada vez" precisa ACABAR, e era o item 6: um dedo que sai pela beirada da tela
  // ainda apoiado nunca manda `pointerup`, `arrasto` fica preenchido para sempre e todo
  // toque seguinte cai neste `return`. O render loop continua rodando — por isso parece
  // congelado sem estar. A captura é quem sabe a verdade: se pedimos captura daquele
  // ponteiro e o navegador já a tirou de nós, o dedo foi embora sem avisar.
  if (arrasto) {
    if (arrasto.capturado && !renderer.domElement.hasPointerCapture(arrasto.id)) encerrarArrasto();
    else return;
  }
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
  arrasto = { id: ev.pointerId, k: chave(naMao[alvo.i].peca), x0: ev.clientX, y0: ev.clientY,
              arrastando: false, mexeu: false, capturado: false };
  if (renderer.domElement.setPointerCapture) {
    // `capturado` guarda se o pedido PEGOU. Sem essa marca, o guarda acima não saberia
    // distinguir "a captura sumiu" de "nunca houve captura", e num navegador sem captura
    // ele largaria o arrasto do primeiro dedo a cada segundo toque — trocando o toque
    // preso pela peça congelada no ar, que é o bug que aquele guarda existe para impedir.
    try { renderer.domElement.setPointerCapture(ev.pointerId); arrasto.capturado = true; } catch (e) { void e; }
  }
});

addEventListener('pointermove', ev => {
  if (!arrasto || ev.pointerId !== arrasto.id) return;
  const m = naMaoPorChave(arrasto.k);
  if (!m) { encerrarArrasto(); return; }              // a mão mudou embaixo do dedo

  if (!arrasto.arrastando) {
    if (Math.hypot(ev.clientX - arrasto.x0, ev.clientY - arrasto.y0) < limiarDe(ev)) return;
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
  // `mexeu` é o que separa arrastar de tremer: ver `foiMesmoArrasto`.
  if (destino >= 0 && destino !== atual) { moverNaMao(atual, destino); arrasto.mexeu = true; }
});

function soltarArrasto(ev) {
  if (!arrasto || (ev && ev.pointerId !== arrasto.id)) return;
  const foiArrasto = foiMesmoArrasto(arrasto);
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
  if (!naMao[i].jogavel) { avisar(porQueNaoDa(naMao[i].peca)); return; }
  selecionarPeca(i);
}
addEventListener('pointerup', soltarArrasto);
addEventListener('pointercancel', () => encerrarArrasto());

// O gesto pode acabar sem que o navegador avise pelo PONTEIRO: a aba vai para o fundo, o
// sistema abre a gaveta de notificações, o aparelho troca de app. Nenhum desses manda
// `pointerup`, e sem isto o `arrasto` sobrevive ao gesto e tranca todo toque seguinte —
// o item 6. Não existia um único `visibilitychange` no projeto inteiro; é o gancho que
// faltava, e o `blur` cobre a janela que perde o foco sem chegar a ser escondida.
//
// Repare que aqui NÃO se pergunta se foi arrasto ou toque: um gesto interrompido pelo
// sistema não é escolha de ninguém, e completá-lo como toque jogaria por você.
function desistirDoGesto() { encerrarArrasto(); largarMira(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) desistirDoGesto(); });
addEventListener('blur', desistirDoGesto);

// ─── jogar sem apontador ─────────────────────────────────────────────────────
// Até aqui não havia como ESCOLHER UMA PEÇA sem mouse ou dedo — o jogo tinha três teclas
// (Esc, A, D) e nenhuma delas jogava. Os botões de confirmar sempre foram <button> de
// verdade e sempre pegaram Tab; faltava a metade de cima do ciclo.
//
//   ← →            passeia pela mão (a peça levanta, igual ao passar o mouse)
//   Enter / espaço  escolhe a que está sob o cursor
//   1 … 9           pula direto para a n-ésima peça e escolhe
//   Esc             cancela  (já existia)
//
// AS DUAS PORTAS EXISTEM DE PROPÓSITO, e não é redundância. O número é o caminho rápido
// de quem já sabe onde a peça está, e é o que a fila pedia; mas ele para no 9, e o Duelo
// dá CATORZE peças na mão. As setas não têm teto, então elas são as que fazem o modo
// inteiro ser jogável — o número sozinho deixaria cinco peças inalcançáveis num dos três
// modos da casa.
function moverCursor(passo) {
  if (!naMao.length) return;
  // Começa de onde os olhos já estão: da peça levantada, se houver, senão da ponta que
  // faz sentido para o sentido do passo. Começar sempre no zero faria a primeira seta
  // saltar a mão inteira para quem estava olhando a última peça.
  const de = cursorTeclado !== null ? cursorTeclado
    : escolhida !== null ? naMao.findIndex(m => chave(m.peca) === escolhida)
    : passo > 0 ? -1 : naMao.length;
  // Não dá a volta: a mão tem duas beiradas de verdade, e bater nelas é como se sabe onde
  // se está sem olhar. Circular, o cursor some do canto e reaparece no outro.
  cursorTeclado = Math.max(0, Math.min(naMao.length - 1, de + passo));

  // LARGA O BOTÃO DE CONFIRMAR, e esta linha vale um parágrafo porque o furo só aparece
  // olhando o ciclo inteiro: escolher uma peça põe o foco no botão de confirmar (é o que
  // faz `3`+`Enter` funcionar). Se daí o jogador aperta `→` para ver outra peça, o cursor
  // anda mas o FOCO não — e o Enter seguinte é entregue ao navegador, que aciona o botão
  // focado e joga a peça ANTIGA. Seta significa "voltei a passear pela mão", então o
  // teclado tem de retomar a tecla.
  const foco = document.activeElement;
  if (foco && foco.blur && foco.closest && foco.closest('#confirmar')) foco.blur();
}

// Escolher pelo teclado é o MESMO caminho do toque, e é por isso que esta função repete a
// ordem de `soltarArrasto`: mesma peça cancela, peça que não dá explica por quê, e só
// então seleciona. Um segundo caminho com regras próprias é como as duas metades passam a
// discordar — foi literalmente o defeito 3 da Fila 6 (duas cópias da regra da revanche).
function escolherPeloTeclado(i) {
  if (i < 0 || i >= naMao.length) return;
  cursorTeclado = i;
  if (!podeAgirAgora()) return;
  const m = naMao[i];
  if (chave(m.peca) === escolhida) { cancelarEscolha(); return; }
  // O silêncio é o defeito, não a recusa. `selecionarPeca` desiste calada quando a peça
  // não é jogável — no mouse quem diz o porquê é o `soltarArrasto`, e sem esta linha o
  // teclado teria a doença que os itens 6, 7 e a Fila 6 inteira passaram consertando.
  if (!m.jogavel) { avisar(porQueNaoDa(m.peca)); return; }
  selecionarPeca(i);
  // FECHA O CICLO. Sem isto o jogador escolhe a peça e fica sem saber para onde ir: o Tab
  // teria de atravessar a barra de ações inteira (comprar, passar, dica, arrumar, contar)
  // antes de chegar na confirmação. Com o foco aqui, jogar é `3` e `Enter`.
  const b = el('confBotoes').querySelector('button');
  if (b && b.focus) b.focus();
}

// Enter e espaço são as teclas que ATIVAM um botão focado. Se o foco já está num <button>
// — e depois de escolher uma peça ele está, de propósito —, quem trata a tecla é o
// navegador, e agir aqui também jogaria duas vezes com um toque só.
const emControle = ev => /^(BUTTON|SELECT|A|SUMMARY|DETAILS)$/.test((ev.target || {}).tagName || '');

addEventListener('keydown', ev => {
  if (/^(INPUT|TEXTAREA)$/.test((ev.target || {}).tagName || '')) return;
  if (!vistaAtual || !naMao.length) return;

  if (ev.key === 'ArrowRight') { moverCursor(1); ev.preventDefault(); return; }
  if (ev.key === 'ArrowLeft') { moverCursor(-1); ev.preventDefault(); return; }

  if ((ev.key === 'Enter' || ev.key === ' ') && !emControle(ev)) {
    if (cursorTeclado !== null) { escolherPeloTeclado(cursorTeclado); ev.preventDefault(); }
    return;
  }

  // '1'…'9' e não '0': a mão é contada como as pessoas contam, do um. O 0 seria a décima
  // peça só para quem já pensa em índice, e quem pensa em índice usa as setas.
  if (ev.key >= '1' && ev.key <= '9' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
    escolherPeloTeclado(Number(ev.key) - 1);
    ev.preventDefault();
  }
});

// POR QUE esta peça não dá. São três motivos diferentes e o jogador merece o certo:
// dizer "não encaixa em nenhuma ponta" com a mesa vazia — onde toda peça encaixa — é
// mentira, e era o que acontecia na primeira mão, em que só o 6|6 é jogável.
function porQueNaoDa(peca) {
  const v = vistaAtual;
  if (v && v.pecaObrigatoria) return `Esta mão abre com o ${v.pecaObrigatoria.join('|')}.`;
  const pt = v && v.pontas;
  const encaixa = !!pt && (peca[0] === pt[0] || peca[1] === pt[0] || peca[0] === pt[1] || peca[1] === pt[1]);
  // Encaixa numa ponta e mesmo assim o motor não a ofereceu: quem a tirou da lista foi
  // a regra do fechamento.
  return encaixa ? 'Essa peça fecharia o jogo de propósito.' : 'Essa peça não encaixa em nenhuma ponta.';
}
