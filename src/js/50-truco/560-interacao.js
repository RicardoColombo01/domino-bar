// ESCOLHER A CARTA, VER ONDE ELA CAI, CONFIRMAR. Raycast puro.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Mesma disciplina do dominó, e ela vale ainda mais aqui: no truco a carta errada custa a mão
// inteira, e a mão inteira pode valer doze pontos. SEMPRE dois passos.
//
//   toque na carta        →  ela levanta e o fantasma aparece no lugar dela na mesa
//   toque no fantasma     →  joga
//   Esc, mesa vazia, ou a mesma carta de novo  →  cancela
//   toque em OUTRA carta  →  troca a seleção direto, sem cancelar antes
//
// O QUE NÃO EXISTE AQUI, e é de propósito: arrastar para arrumar. São TRÊS cartas, e o gesto
// de arrasto do dominó existe para uma mão de catorze — trazê-lo custaria o limiar por
// ponteiro, o `foiMesmoArrasto` e a captura, três mecanismos que o item 6 e o item 7 da Fila 5
// pagaram caro, para reordenar três cartas que o botão "Arrumar" já ordena por força.

const raioDoTruco = new THREE.Raycaster();
const ponteiroDoTruco = new THREE.Vector2();
let apontadaNoTruco = null;
let cursorDeTecladoNoTruco = null;

const mirarNoTruco = ev => {
  ponteiroDoTruco.x = (ev.clientX / innerWidth) * 2 - 1;
  ponteiroDoTruco.y = -(ev.clientY / innerHeight) * 2 + 1;
};
addEventListener('pointermove', ev => { if (estaNaMesa(JOGOS.truco)) mirarNoTruco(ev); });
// Mexeu o ponteiro, o teclado larga a vez: o dono do realce é o ÚLTIMO DISPOSITIVO QUE FALOU.
// Sem essa regra os dois brigam a 60 quadros por segundo, porque `atualizarPonteiroDoTruco`
// roda em todo quadro e reescreveria o cursor de teclado no quadro seguinte ao de nascer.
addEventListener('pointermove', () => { if (estaNaMesa(JOGOS.truco)) cursorDeTecladoNoTruco = null; });

// O dedo não fica em cima da tela como o mouse: sem soltar a mira, a carta em que você tocou
// por último ficaria erguida para sempre, como um hover que nunca acaba.
function largarMiraDoTruco() {
  apontadaNoTruco = null;
  ponteiroDoTruco.set(9, 9);
}
const soltarMiraDoTruco = ev => {
  if (estaNaMesa(JOGOS.truco) && ev.pointerType !== 'mouse') largarMiraDoTruco();
};
addEventListener('pointerup', soltarMiraDoTruco);
addEventListener('pointercancel', soltarMiraDoTruco);

function alvoSobNoTruco() {
  raioDoTruco.setFromCamera(ponteiroDoTruco, camera);

  if (temPreviaDoTruco()) {
    const nasPrevias = raioDoTruco.intersectObjects(grupoPreviaDoTruco.children, true);
    if (nasPrevias.length) {
      let o = nasPrevias[0].object;
      while (o && o.userData.confirma === undefined) o = o.parent;
      if (o) return { tipo: 'previa' };
    }
  }

  const naSua = raioDoTruco.intersectObjects(grupoMaoDoTruco.children, true);
  if (naSua.length) {
    let o = naSua[0].object;
    while (o && !naMaoDoTruco.some(m => m.obj === o)) o = o.parent;
    const i = naMaoDoTruco.findIndex(m => m.obj === o);
    if (i >= 0) return { tipo: 'carta', i };
  }
  return null;
}

function atualizarPonteiroDoTruco() {
  if (cursorDeTecladoNoTruco !== null) {
    if (cursorDeTecladoNoTruco >= naMaoDoTruco.length) {
      cursorDeTecladoNoTruco = naMaoDoTruco.length ? naMaoDoTruco.length - 1 : null;
    }
    apontadaNoTruco = cursorDeTecladoNoTruco;
    return;
  }
  const alvo = alvoSobNoTruco();
  apontadaNoTruco = alvo && alvo.tipo === 'carta' ? alvo.i : null;
  const clicavel = alvo && (alvo.tipo === 'previa' || naMaoDoTruco[alvo.i].jogavel);
  renderer.domElement.style.cursor = clicavel ? 'pointer' : 'default';
}

function selecionarCarta(i) {
  const m = naMaoDoTruco[i];
  if (!m || !m.jogavel || !vistaAtual) return;
  escolhidaNoTruco = chaveCarta(m.carta);
  mostrarPreviaDoTruco(vistaAtual);
  mostrarConfirmacao(confirmacaoDoTruco(vistaAtual, m));
  tocarClique();
}

// Chamado a cada redesenho. `sincronizarMesaDoTruco` apaga a prévia junto com a reconciliação;
// se a carta escolhida continua valendo, ela é reposicionada contra a mesa nova. É o que
// segura o caso do online: uma vista pode chegar do anfitrião enquanto você ainda decide, e
// sem isto o fantasma sumiria calado, deixando a barra prometendo uma jogada sem alvo.
function reavaliarEscolhaNoTruco(vista) {
  const m = escolhidaNoTruco === null ? null : naMaoDoTrucoPorChave(escolhidaNoTruco);
  if (!m || !m.jogavel || vista.vez !== vista.cadeira) { cancelarEscolhaNoTruco(); return; }
  mostrarPreviaDoTruco(vista);
  mostrarConfirmacao(confirmacaoDoTruco(vista, m));
}

function cancelarEscolhaNoTruco() {
  escolhidaNoTruco = null;
  esconderPreviaDoTruco();
  esconderConfirmacao();
}

function confirmarNoTruco() {
  const m = escolhidaNoTruco === null ? null : naMaoDoTrucoPorChave(escolhidaNoTruco);
  if (!m) return;
  const carta = m.carta;
  cancelarEscolhaNoTruco();
  if (navigator.vibrate) navigator.vibrate(12);
  pedirAcao({ acao: 'jogar', carta });
}

// O truco não tem arrasto, mas o hotseat continua podendo trocar de jogador com o dedo no ar
// — e `esconderMaoDoTruco` chama isto pela mesma razão que o dominó chama `encerrarArrasto`.
function encerrarGestoNoTruco() {
  largarMiraDoTruco();
}

addEventListener('pointerdown', ev => {
  if (!estaNaMesa(JOGOS.truco)) return;
  // Só reage a toque na MESA. Sem isto, clicar num botão da barra dispararia este handler
  // primeiro (pointerdown vem antes de click), o raycast não acharia nada, a escolha seria
  // cancelada — e o botão abriria uma jogada vazia.
  if (ev.target !== renderer.domElement) return;
  if (!vistaAtual) return;
  // O ponteiro só era atualizado no pointermove — o que no mouse é sempre verdade e no dedo
  // não é: o primeiro toque não move nada antes de tocar, então a mira ficaria na posição do
  // toque ANTERIOR e o raycast acertaria outra carta.
  mirarNoTruco(ev);

  const alvo = alvoSobNoTruco();
  if (!alvo) { if (podeAgirAgora()) cancelarEscolhaNoTruco(); return; }
  if (alvo.tipo === 'previa') { if (podeAgirAgora()) confirmarNoTruco(); return; }

  if (!podeAgirAgora()) return;
  const m = naMaoDoTruco[alvo.i];
  if (chaveCarta(m.carta) === escolhidaNoTruco) { cancelarEscolhaNoTruco(); return; }
  // O SILÊNCIO É O DEFEITO, NÃO A RECUSA — a doença que os itens 6 e 7 da Fila 5 e a Fila 6
  // inteira passaram consertando.
  if (!m.jogavel) { avisar(porQueNaoDaNoTruco(vistaAtual)); return; }
  selecionarCarta(alvo.i);
});

// ─── jogar sem apontador ─────────────────────────────────────────────────────
//   ← →            passeia pela mão      1 2 3   pula direto e escolhe
//   Enter/espaço   escolhe               Esc     cancela
function moverCursorNoTruco(passo) {
  if (!naMaoDoTruco.length) return;
  const de = cursorDeTecladoNoTruco !== null ? cursorDeTecladoNoTruco
    : escolhidaNoTruco !== null ? naMaoDoTruco.findIndex(m => chaveCarta(m.carta) === escolhidaNoTruco)
    : passo > 0 ? -1 : naMaoDoTruco.length;
  cursorDeTecladoNoTruco = Math.max(0, Math.min(naMaoDoTruco.length - 1, de + passo));
  // LARGA O BOTÃO DE CONFIRMAR: escolher põe o foco nele, e sem esta linha o Enter seguinte
  // seria entregue ao navegador, que acionaria o botão focado e jogaria a carta ANTIGA.
  const foco = document.activeElement;
  if (foco && foco.blur && foco.closest && foco.closest('#confirmar')) foco.blur();
}

function escolherCartaPeloTeclado(i) {
  if (i < 0 || i >= naMaoDoTruco.length) return;
  cursorDeTecladoNoTruco = i;
  if (!podeAgirAgora()) return;
  const m = naMaoDoTruco[i];
  if (chaveCarta(m.carta) === escolhidaNoTruco) { cancelarEscolhaNoTruco(); return; }
  if (!m.jogavel) { avisar(porQueNaoDaNoTruco(vistaAtual)); return; }
  selecionarCarta(i);
  // Fecha o ciclo: com o foco aqui, jogar é `2` e `Enter`.
  const b = el('confBotoes').querySelector('button');
  if (b && b.focus) b.focus();
}

const emControleNoTruco = ev =>
  /^(BUTTON|SELECT|A|SUMMARY|DETAILS)$/.test((ev.target || {}).tagName || '');

addEventListener('keydown', ev => {
  if (!estaNaMesa(JOGOS.truco)) return;
  if (/^(INPUT|TEXTAREA)$/.test((ev.target || {}).tagName || '')) return;
  if (!vistaAtual || !naMaoDoTruco.length) return;

  if (ev.key === 'ArrowRight') { moverCursorNoTruco(1); ev.preventDefault(); return; }
  if (ev.key === 'ArrowLeft') { moverCursorNoTruco(-1); ev.preventDefault(); return; }

  if ((ev.key === 'Enter' || ev.key === ' ') && !emControleNoTruco(ev)) {
    if (cursorDeTecladoNoTruco !== null) { escolherCartaPeloTeclado(cursorDeTecladoNoTruco); ev.preventDefault(); }
    return;
  }
  if (ev.key >= '1' && ev.key <= '9' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
    escolherCartaPeloTeclado(Number(ev.key) - 1);
    ev.preventDefault();
  }
});

// POR QUE esta carta não dá. São dois motivos, e o jogador merece o certo: fora da vez, ou
// com uma aposta na mesa esperando resposta — que é o estado em que o truco PARA, e é
// exatamente o que confunde quem está aprendendo.
function porQueNaoDaNoTruco(vista) {
  if (!vista) return 'Ainda não dá para jogar.';
  if (vista.pedido) return 'Tem aposta na mesa: aceite, aumente ou corra antes.';
  if (vista.fase === 'onze') return 'Mão de 11: diga se joga ou se entrega.';
  return 'Não é a sua vez.';
}
