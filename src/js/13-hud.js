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
};

const ETIQUETA = { voce: 'você', local: 'nesta tela', bot: 'bot', online: 'online' };

function mostrarTela(id) {
  for (const t of ['telaMenu', 'telaFimMao', 'telaFimPartida', 'telaPasse', 'telaOnline'])
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
    .join('<span class="x">×</span>') + `<span class="ate">até ${vista.alvo}</span>`;

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
  HUD.acoes.classList.toggle('oculta', !a.comprar && !a.passar);
  // Quando a única saída é comprar, o botão precisa gritar: o jogador está travado.
  HUD.comprar.classList.toggle('principal', a.comprar && !a.jogadas.length);
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

function mostrarFimDeMao(vista) {
  const r = vista.resultado;
  const bateu = r.motivo === 'batida';
  el('fimTitulo').textContent = bateu ? 'Bateu!' : 'Trancou';
  el('fimTipo').textContent = NOME_BATIDA[r.tipo];
  el('fimQuem').textContent = r.time === null
    ? 'Empate na contagem — ninguém marca.'
    : `${nomeDoTime(vista, r.time)} ${r.pontos === 1 ? 'faz 1 ponto' : `faz ${r.pontos} pontos`}` +
      (bateu ? '' : ` · mão mais leve com ${vista.cadeiras[r.vencedor].nome}`);
  el('fimSomas').innerHTML = r.somas
    .map((s, i) => `<div><span>${vista.cadeiras[i].nome}</span><b>${s}</b></div>`).join('');
  // Quem manda na mesa é o anfitrião: o convidado não tem partida na memória, e o
  // botão chamaria novaMao(null). Ele vê o resultado e espera a próxima chegar.
  el('btProxima').classList.toggle('oculta', modo === 'convidado');
  mostrarTela('telaFimMao');
}

function mostrarFimDePartida(vista) {
  const campeao = vista.placar.indexOf(Math.max(...vista.placar));
  el('campeao').textContent = nomeDoTime(vista, campeao);
  el('campeaoTitulo').textContent = campeao === (vista.duplas ? vista.cadeira % 2 : vista.cadeira)
    ? 'Você ganhou a partida' : 'Fim de partida';
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
