// O HUD: placar, quem é a vez, pontas, monte, botões e avisos.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Tudo aqui lê a VISÃO, nunca a partida. É o mesmo objeto que chega pela rede no
// modo online, então a tela do convidado não tem como mostrar mais do que ele pode
// saber — e não existe um caminho de desenho para local e outro para online.

const el = id => document.getElementById(id);
const HUD = {
  placar: el('placar'), pontas: el('pontasVal'), monte: el('monteVal'), maoN: el('maoVal'),
  jogadores: el('jogadores'), vez: el('vez'), aviso: el('aviso'), log: el('log'),
  comprar: el('btComprar'), passar: el('btPassar'), acoes: el('acoes'),
  arrumar: el('btArrumar'), contar: el('btContagem'), contagem: el('contagem'),
};

// "Contar o jogo" é a conta que jogador bom faz de cabeça e novato não faz. Fica
// desligada por padrão e lembrada entre partidas — quem já conta sozinho não quer a
// tabela ocupando a tela.
let contando = false;
try { contando = localStorage.getItem('dominobar.contagem') === '1'; } catch (e) { void e; }

const ETIQUETA = { voce: 'você', local: 'nesta tela', bot: 'bot', online: 'online' };

function mostrarTela(id) {
  for (const t of ['telaMenu', 'telaFimMao', 'telaFimPartida', 'telaPasse', 'telaOnline', 'telaSair'])
    el(t).classList.toggle('oculta', t !== id);
}
const esconderTelas = () => mostrarTela(null);

let avisoTimer = 0;
function avisar(txt, ms = 2200) {
  HUD.aviso.textContent = txt;
  HUD.aviso.classList.add('vendo');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => HUD.aviso.classList.remove('vendo'), ms);
}

function nomeDoTime(vista, time) {
  if (!vista.duplas) return vista.cadeiras[time].nome;
  return `${vista.cadeiras[time].nome} e ${vista.cadeiras[time + 2].nome}`;
}

function desenharHUD(vista) {
  HUD.pontas.textContent = vista.pontas ? vista.pontas.join('  ·  ') : '—';
  HUD.monte.textContent = vista.monte;
  HUD.maoN.textContent = vista.maoNum;

  HUD.placar.innerHTML = vista.placar
    .map((p, i) => `<span class="time"><i>${nomeDoTime(vista, i)}</i><b>${p}</b></span>`)
    // O rótulo do modo só aparece quando não é o clássico, e é a única coisa que diz
    // ao convidado em que mesa ele sentou — ele não tem MESA nem P.regras.
    .join('<span class="x">×</span>') +
    `<span class="ate">${vista.modo && vista.modo !== MODO_PADRAO ? MODOS[vista.modo].rotulo + ' · ' : ''}até ${vista.alvo}</span>`;

  // Um cartão por cadeira, na ordem em que a vez anda. O da vez acende.
  HUD.jogadores.innerHTML = vista.cadeiras.map((c, i) => `
    <div class="jog ${i === vista.vez ? 'davez' : ''} ${i === vista.cadeira ? 'euu' : ''}">
      <span class="nome">${c.nome}</span>
      <span class="tipo">${ETIQUETA[c.tipo] || c.tipo}</span>
      <span class="pecas">${'▮'.repeat(Math.min(vista.naMao[i], 9))}<i>${vista.naMao[i]}</i></span>
    </div>`).join('');

  const minhaVez = vista.vez === vista.cadeira && vista.fase === 'mao';
  HUD.vez.textContent = minhaVez ? 'Sua vez' : `Vez de ${vista.cadeiras[vista.vez].nome}`;
  HUD.vez.classList.toggle('minha', minhaVez);

  const a = vista.acoes;
  HUD.comprar.classList.toggle('oculta', !a.comprar);
  HUD.passar.classList.toggle('oculta', !a.passar);
  // Arrumar a mão e contar o jogo não dependem da vez — dá para se organizar enquanto
  // os outros jogam. Por isso a barra de ações passou a aparecer sempre que há mão.
  const temMao = vista.mao && vista.mao.length > 0;
  HUD.arrumar.classList.toggle('oculta', !temMao || vista.mao.length < 2);
  HUD.contar.classList.toggle('oculta', !temMao);
  HUD.contar.classList.toggle('on', contando);
  HUD.acoes.classList.toggle('oculta', !a.comprar && !a.passar && !temMao);
  // Quando a única saída é comprar, o botão precisa gritar: o jogador está travado.
  HUD.comprar.classList.toggle('principal', a.comprar && !a.jogadas.length);

  desenharContagem(vista);
}

// Quantas peças de cada número já apareceram — as da mesa MAIS as da sua mão, como o
// Ricardo pediu. Sai inteiro de `vista`: é exatamente o que o jogador enxerga, então não
// vaza nada e não precisou de nada novo no motor.
function desenharContagem(vista) {
  HUD.contagem.classList.toggle('oculta', !contando || !vista.mao);
  if (!contando || !vista.mao) return;

  const baralho = baralhoDoModo(MODOS[vista.modo] || MODOS[MODO_PADRAO]);
  const aparecidas = vista.linha.concat(vista.mao);
  const linhas = [];
  for (let n = 0; n <= MAX_PINTAS; n++) {
    // O total NÃO é 7 fixo: no Trio o 0|0 sai do baralho e o zero mora em 6 peças.
    const total = baralho.filter(p => p[0] === n || p[1] === n).length;
    if (!total) continue;
    const visto = aparecidas.filter(p => p[0] === n || p[1] === n).length;
    // Quem passou numa ponta provou não ter aquele número. É informação pública — a
    // mesa inteira viu o passe —, e até agora só o bot usava.
    const semEle = (vista.faltaNo || [])
      .map((nums, i) => (i !== vista.cadeira && nums.indexOf(n) >= 0 ? vista.cadeiras[i].nome : null))
      .filter(Boolean);
    linhas.push(`<div${visto === total ? ' class="zerado"' : ''}>` +
      `<b>${n}</b>` +
      `<i>${'▮'.repeat(visto)}${'▯'.repeat(total - visto)}</i>` +
      `<s>${total - visto || '—'}</s>` +
      `<em>${semEle.join(', ')}</em></div>`);
  }
  HUD.contagem.innerHTML = '<span class="rot">faltam aparecer</span>' + linhas.join('');
}

// A barra de confirmação. O rótulo diz o NÚMERO da ponta, não "esquerda/direita" sozinho:
// na hora de decidir o que importa é em que número a peça vai encostar.
function mostrarConfirmacao(vista, m) {
  el('confPeca').textContent = m.peca[0] + ' | ' + m.peca[1];
  const pt = vista.pontas;
  el('confBotoes').innerHTML = m.pontas.map(lado => {
    const rotulo = !pt ? 'Abrir a mão com ela'
      : lado === 'esq' ? `◀ encaixar no ${pt[0]}` : `encaixar no ${pt[1]} ▶`;
    return `<button class="btn peq principal" data-lado="${lado}">${rotulo}</button>`;
  }).join('');
  el('confBotoes').querySelectorAll('button').forEach(b => {
    b.onclick = () => confirmarJogada(b.dataset.lado);
  });
  el('confirmar').classList.remove('oculta');
}

function esconderConfirmacao() {
  el('confirmar').classList.add('oculta');
}
el('btCancelar').onclick = () => cancelarEscolha();

const linhasDoLog = [];
function anotar(txt) {
  linhasDoLog.push(txt);
  if (linhasDoLog.length > 5) linhasDoLog.shift();
  HUD.log.innerHTML = linhasDoLog.map(t => `<div>${t}</div>`).join('');
}

// O que sobrou na mão de cada um. Tinha rótulo nenhum e o mesmo âmbar do placar do
// topo, então lia-se como pontuação — e é o contrário: é o que ficou por jogar. Em
// duplas mostra o subtotal do time, porque quem pontua é a dupla.
function sobrouNaMao(vista) {
  const r = vista.resultado;
  if (!vista.duplas) {
    return r.somas
      .map((s, i) => `<div><span>${vista.cadeiras[i].nome}</span><b>${s}</b></div>`).join('');
  }
  return (r.somasPorTime || []).map((total, t) => {
    const parcelas = r.somas.filter((_, i) => timeDe(vista, i) === t).join(' + ');
    return `<div><span>${nomeDoTime(vista, t)}<i>${parcelas}</i></span><b>${total}</b></div>`;
  }).join('');
}

function mostrarFimDeMao(vista) {
  const r = vista.resultado;
  const bateu = r.motivo === 'batida';
  // Esta tela vinha sendo PULADA na mão que decide a partida: fecharMao põe fase='fim'
  // direto quando alguém chega ao alvo, e você caía no campeão sem nunca ver de onde
  // vieram os pontos. Agora ela aparece sempre, e o botão vira o passo para o resultado.
  const acabou = vista.fase === 'fim';
  el('fimTitulo').textContent = bateu ? 'Bateu!' : 'Trancou';
  el('fimTipo').textContent = NOME_BATIDA[r.tipo];
  // "Zé e Tião fazem", não "faz": em duplas o sujeito é a dupla.
  const fazem = vista.duplas ? 'fazem' : 'faz';
  el('fimQuem').textContent = r.time === null
    ? 'Empate na contagem — ninguém marca.'
    : `${nomeDoTime(vista, r.time)} ${fazem} ${r.pontos === 1 ? '1 ponto' : `${r.pontos} pontos`}` +
      (bateu ? '' : ` · mão mais leve com ${vista.cadeiras[r.vencedor].nome}`);
  el('fimSobrou').innerHTML = sobrouNaMao(vista);
  el('btProxima').textContent = acabou ? 'Ver o resultado' : 'Próxima mão';
  // São duas condições diferentes, não uma. "Próxima mão" mexe na partida e o convidado
  // não tem uma na memória — o botão chamaria novaMao(null). "Ver o resultado" é
  // navegação local pura e é dele também: sem isso ele fica preso aqui, sem campeão.
  el('btProxima').classList.toggle('oculta', modo === 'convidado' && !acabou);
  mostrarTela('telaFimMao');
}

function mostrarFimDePartida(vista) {
  // Quem saiu da mesa não leva a partida nem estando na frente: o time dele fica fora
  // da conta do campeão. É o que impede fechar a aba de virar saída de emergência.
  const fora = vista.desistiu === null || vista.desistiu === undefined
    ? -1 : timeDe(vista, vista.desistiu);
  let campeao = 0;
  vista.placar.forEach((p, t) => {
    if (t === fora) return;
    if (campeao === fora || p > vista.placar[campeao]) campeao = t;
  });
  const meuTime = timeDe(vista, vista.cadeira);
  el('campeao').textContent = nomeDoTime(vista, campeao);
  el('campeaoTitulo').textContent = fora >= 0
    ? (fora === meuTime ? 'Você saiu da mesa' : `${vista.cadeiras[vista.desistiu].nome} saiu da mesa`)
    : (campeao === meuTime ? 'Você ganhou a partida' : 'Fim de partida');
  // A tela dizia quem ganhou e não de quanto. Mesmo template do placar do topo.
  el('placarFinal').innerHTML = vista.placar
    .map((p, i) => `<span class="time${i === campeao ? ' venceu' : ''}">` +
      `<i>${nomeDoTime(vista, i)}</i><b>${p}</b></span>`)
    .join('<span class="x">×</span>');
  el('fimResumo').textContent = fora >= 0
    ? `Partida encerrada na mão ${vista.maoNum} — quem sai no meio perde.`
    : `${vista.maoNum} ${vista.maoNum === 1 ? 'mão' : 'mãos'} · partida até ${vista.alvo}`;
  el('btRevanche').classList.toggle('oculta', modo === 'convidado');
  mostrarTela('telaFimPartida');
}

let mudo = false;
el('btSom').onclick = () => {
  mudo = !mudo;
  silenciar(mudo);
  el('btSom').textContent = mudo ? '✕' : '♪';
  el('btSom').classList.toggle('desligado', mudo);
};
