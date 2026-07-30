// O HUD: placar, quem é a vez, pontas, monte, botões e avisos.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Tudo aqui lê a VISÃO, nunca a partida. É o mesmo objeto que chega pela rede no
// modo online, então a tela do convidado não tem como mostrar mais do que ele pode
// saber — e não existe um caminho de desenho para local e outro para online.

const el = id => document.getElementById(id);
const HUD = {
  placar: el('placar'), pontas: el('pontasVal'), monte: el('monteVal'), maoN: el('maoVal'),
  jogadores: el('jogadores'), vez: el('vez'), aviso: el('aviso'),
  conversa: el('conversa'), lista: el('conversaLista'),
  escrever: el('conversaEscrever'), texto: el('conversaTexto'),
  canal: el('btCanal'), abrirConversa: el('btConversa'),
  comprar: el('btComprar'), passar: el('btPassar'), acoes: el('acoes'),
  arrumar: el('btArrumar'), contar: el('btContagem'), contagem: el('contagem'),
};

// "Contar o jogo" é a conta que jogador bom faz de cabeça e novato não faz. Fica
// desligada por padrão e lembrada entre partidas — quem já conta sozinho não quer a
// tabela ocupando a tela.
// `lido` aceita o valor antigo sem conversão: '1' e '0' são JSON válido e dão 1 e 0,
// que já são o verdadeiro e o falso que interessam. Quem jogava antes não perde a escolha.
let contando = !!lido('contagem', false);

const ETIQUETA = { voce: 'você', local: 'nesta tela', bot: 'bot', online: 'online' };

// Tudo que vem de fora passa por aqui antes de virar innerHTML. Até agora o único texto
// alheio era o nome, cortado em 14 caracteres — o texto do chat é o primeiro campo
// realmente livre chegando pela rede, e sem escape isso é script rodando na máquina dos
// outros jogadores.
const escapar = txt => String(txt)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function mostrarTela(id) {
  for (const t of ['telaMenu', 'telaFimMao', 'telaFimPartida', 'telaPasse', 'telaOnline', 'telaSair'])
    el(t).classList.toggle('oculta', t !== id);
  // O botão de retomar é recalculado a cada vez que o menu aparece, e não uma vez no
  // início: entre um e outro você pode ter acabado a partida guardada, ou o prazo dela
  // pode ter vencido com a aba aberta.
  if (id === 'telaMenu') atualizarBotaoRetomar();
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
  if (!vista.duplas) return escapar(vista.cadeiras[time].nome);
  return `${escapar(vista.cadeiras[time].nome)} e ${escapar(vista.cadeiras[time + 2].nome)}`;
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
      <span class="nome">${escapar(c.nome)}</span>
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
  desenharConversa(vista);
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
      .map((nums, i) => (i !== vista.cadeira && nums.indexOf(n) >= 0 ? escapar(vista.cadeiras[i].nome) : null))
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

// ─── a conversa da mesa ──────────────────────────────────────────────────────
// A narração do jogo e as falas no MESMO fio, em ordem: jogada em cinza, fala em âmbar
// com o nome de quem falou. Um lugar só para olhar — e resolve de quebra o log, que
// sumia em toda tela de celular por falta de canto onde caber.
//
// O painel ACRESCENTA em vez de ser reconstruído, e o <input> nunca é reescrito: quem
// desenha o HUD é atualizarVista, que roda a cada vista chegando pelo fio, e reconstruir
// aqui faria o campo perder o foco e o texto a cada jogada de bot.
const linhasDoLog = [];
let conversaAberta = false, naoLidas = 0;
let canalAtual = 'todos';

function trocarCanal(qual) {
  canalAtual = qual;
  HUD.canal.textContent = qual === 'dupla' ? 'Dupla' : 'Todos';
  HUD.canal.classList.toggle('on', qual === 'dupla');
  HUD.texto.placeholder = qual === 'dupla'
    // Dito na cara: quem retransmite é o anfitrião, então não há sigilo para ele.
    ? 'só o seu parceiro (e o anfitrião) leem…'
    : 'falar com a mesa…';
}

function porNaConversa(html, classe) {
  const div = document.createElement('div');
  div.className = classe;
  div.innerHTML = html;
  HUD.lista.appendChild(div);
  linhasDoLog.push(div);
  while (linhasDoLog.length > 40) HUD.lista.removeChild(linhasDoLog.shift());
  HUD.lista.scrollTop = HUD.lista.scrollHeight;
  if (!conversaAberta) { naoLidas++; atualizarBotaoConversa(); }
}

function anotar(txt) { porNaConversa(escapar(txt), 'doJogo'); }

function limparConversa() {
  linhasDoLog.length = 0;
  HUD.lista.innerHTML = '';
  falasGuardadas.length = 0;         // mesa nova: fala guardada da anterior não vale
  naoLidas = 0;
  atualizarBotaoConversa();
}

// Uma fala. `de` é a cadeira de quem falou, para o nome sair da vista e não do fio.
function dizer(vista, de, canal, txt) {
  const nome = (vista && vista.cadeiras[de] && vista.cadeiras[de].nome) || 'Alguém';
  porNaConversa(
    `<b>${escapar(nome)}</b>${canal === 'dupla' ? '<i>dupla</i>' : ''} ${escapar(txt)}`,
    canal === 'dupla' ? 'fala daDupla' : 'fala');
}

// Fala da dupla que chegou enquanto a tela mostrava OUTRA cadeira. Numa mesa mista
// (gente na mesma tela + gente online) o hotseat troca `euNaTela`, e mostrar a fala na
// hora seria entregá-la ao adversário que está olhando a mesma tela. Guardar é o certo;
// o que estava errado era DESCARTAR — a fala nunca voltava quando a vez voltava.
const falasGuardadas = [];               // { de, canal, txt, para } — `para` é a cadeira dona

function guardarFala(de, canal, txt, para) {
  falasGuardadas.push({ de, canal, txt, para });
}

// Chamada quando o hotseat entrega a tela a `cadeira` (btPronto, em 16-loop.js).
//
// Solta as TRÊS últimas. O limite é sobre ATENÇÃO e não sobre memória — `porNaConversa`
// já corta a lista em 40 —: quem volta de três rodadas de hotseat estaria lendo parede de
// texto no meio da própria vez, e o que decide uma jogada é o que o parceiro disse por
// último, não o que ele disse quatro jogadas atrás.
const FALAS_DE_VOLTA = 3;

function soltarFalasGuardadas(cadeira) {
  const minhas = [];
  // Consome tudo da cadeira, inclusive o que não vai aparecer: deixar o excedente na fila
  // faria fala velha reaparecer DEPOIS de fala nova no próximo hotseat.
  for (let i = falasGuardadas.length - 1; i >= 0; i--) {
    if (falasGuardadas[i].para !== cadeira) continue;
    minhas.unshift(falasGuardadas[i]);
    falasGuardadas.splice(i, 1);
  }
  if (!minhas.length || !vistaAtual) return;
  const mostrar = minhas.slice(-FALAS_DE_VOLTA);
  const engoliu = minhas.length - mostrar.length;
  if (engoliu) anotar(`(${engoliu} fala${engoliu > 1 ? 's' : ''} da dupla ficou para trás)`);
  for (const f of mostrar) dizer(vistaAtual, f.de, f.canal, f.txt);
}

function atualizarBotaoConversa() {
  HUD.abrirConversa.textContent = naoLidas ? String(Math.min(naoLidas, 9)) : '💬';
  HUD.abrirConversa.classList.toggle('temNovidade', naoLidas > 0);
}

function alternarConversa(abrir) {
  conversaAberta = abrir === undefined ? !conversaAberta : abrir;
  HUD.conversa.classList.toggle('aberta', conversaAberta);
  if (conversaAberta) { naoLidas = 0; HUD.lista.scrollTop = HUD.lista.scrollHeight; }
  atualizarBotaoConversa();
}

// Só há com quem conversar se houver gente online. E o canal "dupla" só existe onde
// existe dupla — o Clássico de 4 é o único modo em duplas.
function desenharConversa(vista) {
  const online = modo === 'anfitriao' || modo === 'convidado';
  HUD.escrever.classList.toggle('oculta', !online);
  HUD.abrirConversa.classList.toggle('oculta', !online && !linhasDoLog.length);
  HUD.canal.classList.toggle('oculta', !vista.duplas);
  if (!vista.duplas && canalAtual === 'dupla') trocarCanal('todos');
}

// O que sobrou na mão de cada um. Tinha rótulo nenhum e o mesmo âmbar do placar do
// topo, então lia-se como pontuação — e é o contrário: é o que ficou por jogar. Em
// duplas mostra o subtotal do time, porque quem pontua é a dupla.
function sobrouNaMao(vista) {
  const r = vista.resultado;
  if (!vista.duplas) {
    return r.somas
      .map((s, i) => `<div><span>${escapar(vista.cadeiras[i].nome)}</span><b>${s}</b></div>`).join('');
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

// Quem desligou o som desligou por um motivo — trabalho, gente dormindo, ou simplesmente
// não gostar. Perguntar de novo a cada visita é o jogo não escutar.
let mudo = !!lido('mudo', false);
function pintarBotaoSom() {
  el('btSom').textContent = mudo ? '✕' : '♪';
  el('btSom').classList.toggle('desligado', mudo);
}
el('btSom').onclick = () => {
  mudo = !mudo;
  silenciar(mudo);
  pintarBotaoSom();
  guardar('mudo', mudo);
};
pintarBotaoSom();
// `silenciar` mexe no AudioContext, que só nasce no primeiro som. Chamar aqui não
// adiantaria nada; quem aplica o silêncio guardado é `ligarMurmuro`, que roda quando o
// áudio de fato começa.
