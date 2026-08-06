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
  dica: el('btDica'),
  sala: el('salaVal'), salaPainel: el('salaPainel'),
};

// "Contar o jogo" é a conta que jogador bom faz de cabeça e novato não faz. Fica
// desligada por padrão e lembrada entre partidas — quem já conta sozinho não quer a
// tabela ocupando a tela.
// `lido` aceita o valor antigo sem conversão: '1' e '0' são JSON válido e dão 1 e 0,
// que já são o verdadeiro e o falso que interessam. Quem jogava antes não perde a escolha.
let contando = !!lido('contagem', false);

// ─── o encaixe do painel do jogo ─────────────────────────────────────────────
// A gaveta, o botão que a abre e o "lembrar se estava aberta" são da CASA — qualquer jogo
// de mesa quer um painel de apoio. O CONTEÚDO é do jogo: no dominó é quantas peças de cada
// número já apareceram, e essa é uma frase que só faz sentido com pinta e monte.
//
// Estava tudo aqui dentro (`desenharContagem`), que era a última regra de dominó morando na
// pasta que promete não conhecer o jogo. Agora a casa reserva o lugar e chama; quem sabe as
// regras entrega o seu no contrato (`JOGO.painel`), e o truco entrega o dele sem que um
// precise saber do outro.
//
// Era um `let` que o jogo reatribuía; passou a vir pelo contrato como todo o resto — assim
// não há duas maneiras de um jogo se apresentar à casa.
//
// Jogo sem painel simplesmente não põe a chave, e o `?.` cobre: ninguém paga um `if`
// perguntando qual jogo está na mesa.
const painelDoJogo = vista => JOGO.painel?.(vista);

const ETIQUETA ={ voce: 'você', local: 'nesta tela', bot: 'bot', online: 'online' };

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
  if (id === 'telaMenu') { atualizarBotaoRetomar(); atualizarBotaoVoltarMesa(); }
  // A conversa do saguão vive por cima desta tela, então quem abre e fecha a tela é quem
  // liga e desliga aquilo.
  atualizarSaguao(id === 'telaOnline');
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

// O nome em DUAS PARTES, para a tela decidir quanto dele cabe. Em faixa estreita o CSS
// esconde o resto e sobra o primeiro nome inteiro — "Maria Fernanda" vira "Maria", e não
// "Maria Fer…". Cortar no meio da palavra é o que fazia o nome deixar de identificar
// quem é, que era o ponto do item 8: com quatro jogadores em retrato a caixa dá 68px
// para 95px de texto.
//
// Quem escapa continua sendo o `escapar`, e as DUAS metades passam por ele: o nome do
// convidado é entrada de fora, e fatiar uma string não a torna segura. Repare que um
// nome-ataque como `<img src=x>` também tem espaço, então o corte cai no meio dele — e
// mesmo assim as duas bandas saem escapadas, cada uma por si.
function nomeEmPartes(nome) {
  const n = String(nome == null ? '' : nome);
  const corte = n.indexOf(' ');
  if (corte < 0) return escapar(n);
  return escapar(n.slice(0, corte)) + `<i class="resto">${escapar(n.slice(corte))}</i>`;
}

// O RÓTULO DO MODO, com a mesma guarda que o resto do arquivo já usava e esta linha não.
// `MODOS[vista.modo].rotulo` era o único ponto que indexava `MODOS` cru — o `:141` logo
// abaixo já fazia `MODOS[vista.modo] || MODOS[MODO_PADRAO]`, e `mesaLembrada` usa
// `Object.hasOwn`. Guarda num lugar, esquecida no vizinho, pela enésima vez nesta fila.
//
// As DUAS falhas eram diferentes, e por isso `Object.hasOwn` e não `||`: um modo que não
// existe LANÇA dentro do `desenharHUD` (o menu some, a mesa 3D aparece e o HUD não existe —
// sem placar, sem vez, sem botões); e `'constructor'` é TRUTHY num objeto literal, então
// passava pelo `||` e escrevia "undefined · até 6" na cara do jogador. É literalmente o
// defeito 5 da Fila 6, no único validador que nunca foi endurecido.
const rotuloDoModo = modo => Object.hasOwn(JOGO.menu.MODOS, modo) && modo !== JOGO.menu.MODO_PADRAO
  ? escapar(JOGO.menu.MODOS[modo].rotulo) + ' · ' : '';

function desenharHUD(vista) {
  HUD.pontas.textContent = vista.pontas ? vista.pontas.join('  ·  ') : '—';
  HUD.monte.textContent = vista.monte;
  HUD.maoN.textContent = vista.maoNum;

  // NÚMERO QUE VEM DO FIO TAMBÉM É TEXTO DE FORA, e foi por aqui que a regra do `escapar`
  // vazou pela quarta vez. Repare no desenho do defeito: o NOME ao lado já passava por
  // `escapar` e o número irmão, no mesmo template, não — "numérico" foi tratado como
  // sinônimo de "seguro". No convidado a `vista` chega inteira do fio, e qualquer aba pode
  // ser anfitriã: um placar que é string vira script na máquina de quem está na mesa.
  HUD.placar.innerHTML = vista.placar
    .map((p, i) => `<span class="time"><i>${nomeDoTime(vista, i)}</i><b>${escapar(p)}</b></span>`)
    // O rótulo do modo só aparece quando não é o clássico, e é a única coisa que diz
    // ao convidado em que mesa ele sentou — ele não tem MESA nem P.regras.
    .join('<span class="x">×</span>') +
    `<span class="ate">${rotuloDoModo(vista.modo)}até ${escapar(vista.alvo)}</span>`;

  // Um cartão por cadeira, na ordem em que a vez anda. O da vez acende.
  HUD.jogadores.innerHTML = vista.cadeiras.map((c, i) => `
    <div class="jog ${i === vista.vez ? 'davez' : ''} ${i === vista.cadeira ? 'euu' : ''}">
      <span class="nome">${nomeEmPartes(c.nome)}</span>
      <span class="tipo">${escapar(Object.hasOwn(ETIQUETA, c.tipo) ? ETIQUETA[c.tipo] : c.tipo)}</span>
      <span class="pecas">${'▮'.repeat(Math.max(0, Math.min(vista.naMao[i], 9) || 0))}<i>${escapar(vista.naMao[i])}</i></span>
    </div>`).join('');

  const minhaVez = vista.vez === vista.cadeira && vista.fase === 'mao';
  // ESCREVER SÓ QUANDO MUDA, e isto não é economia: o #vez é `aria-live`, e `desenharHUD`
  // roda em TODO `publicar()` — várias vezes por jogada, inclusive quando a vez não andou.
  // Atribuir `textContent` troca o nó de texto mesmo que a frase seja idêntica, e o leitor
  // de tela anuncia a troca, não a diferença: sem esta guarda ele repetiria "Vez de Tião"
  // a cada compra do bot, e a região viva viraria a razão de desligar o leitor.
  const frase = minhaVez ? 'Sua vez' : `Vez de ${vista.cadeiras[vista.vez].nome}`;
  if (HUD.vez.textContent !== frase) HUD.vez.textContent = frase;
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
  // A dica, ao contrário de arrumar e contar, SÓ vale na sua vez: ela levanta uma peça e
  // abre a barra de confirmar, e fora da vez isso seria prometer uma jogada que o motor
  // vai recusar.
  HUD.dica.classList.toggle('oculta', !temMao || !minhaVez || vista.fase !== 'mao');
  HUD.acoes.classList.toggle('oculta', !a.comprar && !a.passar && !temMao);
  // Quando a única saída é comprar, o botão precisa gritar: o jogador está travado.
  HUD.comprar.classList.toggle('principal', a.comprar && !a.jogadas.length);

  painelDoJogo(vista);
  desenharConversa(vista);
  // Depois das duas, porque é a visibilidade DELAS que decide se há gaveta aberta.
  atualizarCortina();
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
    b.onclick = () => JOGO.toque.confirmar(b.dataset.lado);
  });
  el('confirmar').classList.remove('oculta');
}

function esconderConfirmacao() {
  el('confirmar').classList.add('oculta');
}
el('btCancelar').onclick = () => JOGO.toque.cancelar();

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

// Uma fala. `de` é a cadeira de quem falou, e o nome sai da VISTA — nunca do que o
// convidado alega ser.
//
// `deSaguao` é a saída para o único momento em que não existe vista: a espera antes de a
// partida começar. Ele vem do ANFITRIÃO, tirado do MESA dele, e não de quem escreveu — a
// invariante continua de pé, porque quem fala não escolhe como aparece.
function dizer(vista, de, canal, txt, deSaguao) {
  const nome = (vista && vista.cadeiras[de] && vista.cadeiras[de].nome) || deSaguao || 'Alguém';
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

// Chamada quando o hotseat entrega a tela a `cadeira` (btPronto, em 160-loop.js).
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
  // O texto do botão é um NÚMERO quando há novidade, e "3" sozinho não quer dizer nada
  // fora da tela. O rótulo diz o que o número conta — e o corte em 9 é da tela, não da
  // contagem: quem tem 12 falas para ler merece ouvir 12.
  HUD.abrirConversa.setAttribute('aria-label', naoLidas
    ? `Conversa da mesa — ${naoLidas} ${naoLidas === 1 ? 'nova' : 'novas'}`
    : 'Conversa da mesa');
}

function alternarConversa(abrir) {
  conversaAberta = abrir === undefined ? !conversaAberta : abrir;
  HUD.conversa.classList.toggle('aberta', conversaAberta);
  if (conversaAberta) { naoLidas = 0; HUD.lista.scrollTop = HUD.lista.scrollHeight; }
  atualizarBotaoConversa();
  atualizarCortina();
}

// ─── a gaveta do celular ─────────────────────────────────────────────────────
// Numa tela de 360px a conversa tem 268px fixos: ela e a mão não cabem lado a lado. Não é
// margem mal ajustada — os dois não cabem, e encolher a mesa até caber deixaria o
// tabuleiro pequeno demais para ler. Então no celular estes painéis param de conviver com
// o jogo: abrem por cima, com cortina atrás, e fecham num toque.
//
// A cortina não é enfeite. Sem ela, painel em cima de peça parece DEFEITO — foi
// literalmente relatado assim ("peças bugadas em vertical"). Com ela, é uma gaveta aberta.
const modoGaveta = () => matchMedia('(max-width: 560px), (max-height: 560px)').matches;

// Olha a CLASSE e não a variável: a contagem também some quando não há mão (fim de mão,
// saguão), e uma cortina sobre painel nenhum seria um vidro fosco no meio do jogo.
const gavetaAberta = () =>
  (conversaAberta && HUD.conversa.classList.contains('aberta')) ||
  !HUD.contagem.classList.contains('oculta');

function atualizarCortina() {
  const aberta = modoGaveta() && gavetaAberta();
  el('cortina').classList.toggle('oculta', !aberta);
  // A classe no body é o que torna a gaveta MODAL: o CSS esconde o resto do HUD por ela.
  // Sem isso a barra de ações e o "sua vez" boiam por cima da cortina, que é a mesma
  // confusão de antes ao contrário.
  document.body.classList.toggle('gaveta', aberta);
}

function fecharGavetas() {
  if (conversaAberta) alternarConversa(false);
  if (contando) {
    contando = false;
    guardar('contagem', contando);
    if (vistaAtual) atualizarVista(vistaAtual);
  }
  atualizarCortina();
}

el('cortina').onclick = () => { tocarClique(); fecharGavetas(); };

// Girar o aparelho pode cruzar o limiar dos 560px nos dois sentidos, e aí a mesma
// conversa aberta deixa de ser gaveta (ou passa a ser). Sem isto sobra um vidro fosco por
// cima do jogo, ou a gaveta abre sem cortina. Listener próprio e não um gancho no
// `agendarEnquadre` do 070-cena.js: aquilo é sobre a câmera, isto é sobre o HUD.
addEventListener('resize', atualizarCortina);
addEventListener('orientationchange', atualizarCortina);

// Só há com quem conversar se houver gente online. E o canal "dupla" só existe onde
// existe dupla — o Clássico de 4 é o único modo em duplas.
//
// `vista` é OPCIONAL, e é essa a diferença que trouxe a conversa para o saguão: antes esta
// função só era chamada por `desenharHUD`, que só roda em `atualizarVista`, que só existe
// depois de haver partida. Resultado: quem esperava a mesa encher, olhando o código de
// quatro letras, não conseguia falar nada — justo quando mais se quer falar.
let salaDuplas = false;        // o saguão sabe se a mesa é em duplas antes de existir P
let noSaguao = false;          // a tela de espera está no ar

function atualizarConversa(vista) {
  const online = modo === 'anfitriao' || modo === 'convidado';
  HUD.escrever.classList.toggle('oculta', !online);
  HUD.abrirConversa.classList.toggle('oculta', !online && !linhasDoLog.length);
  // As duplas são por CADEIRA (em cruz), então dá para sabê-las antes de a partida
  // existir: com vista, quem manda é ela; sem vista, a mesa que está sendo montada.
  const duplas = vista ? !!vista.duplas : salaDuplas;
  HUD.canal.classList.toggle('oculta', !duplas);
  if (!duplas && canalAtual === 'dupla') trocarCanal('todos');
}

const desenharConversa = vista => atualizarConversa(vista);

// A tela de espera é um overlay de `z-index: 30` e cobria a conversa inteira — mexer em
// classe de visibilidade não resolveria nada, porque o problema era empilhamento. No
// saguão, e só nele, a conversa e o botão que a abre sobem por cima da tela.
function atualizarSaguao(naEspera) {
  if (naEspera !== undefined) noSaguao = naEspera;
  const online = modo === 'anfitriao' || modo === 'convidado';
  document.body.classList.toggle('saguao', noSaguao && online);
  atualizarConversa(vistaAtual);
}

// O que sobrou na mão de cada um. Tinha rótulo nenhum e o mesmo âmbar do placar do
// topo, então lia-se como pontuação — e é o contrário: é o que ficou por jogar. Em
// duplas mostra o subtotal do time, porque quem pontua é a dupla.
function sobrouNaMao(vista) {
  const r = vista.resultado;
  if (!vista.duplas) {
    return r.somas
      .map((s, i) => `<div><span>${escapar(vista.cadeiras[i].nome)}</span><b>${escapar(s)}</b></div>`).join('');
  }
  return (r.somasPorTime || []).map((total, t) => {
    const parcelas = r.somas.filter((_, i) => JOGO.motor.time(vista, i) === t).map(escapar).join(' + ');
    return `<div><span>${nomeDoTime(vista, t)}<i>${parcelas}</i></span><b>${escapar(total)}</b></div>`;
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
  el('fimTipo').textContent = JOGO.motor.nomeDoFim(r.tipo);
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
    ? -1 : JOGO.motor.time(vista, vista.desistiu);
  let campeao = 0;
  vista.placar.forEach((p, t) => {
    if (t === fora) return;
    if (campeao === fora || p > vista.placar[campeao]) campeao = t;
  });
  const meuTime = JOGO.motor.time(vista, vista.cadeira);
  el('campeao').textContent = nomeDoTime(vista, campeao);
  el('campeaoTitulo').textContent = fora >= 0
    ? (fora === meuTime ? 'Você saiu da mesa' : `${vista.cadeiras[vista.desistiu].nome} saiu da mesa`)
    : (campeao === meuTime ? 'Você ganhou a partida' : 'Fim de partida');
  // A tela dizia quem ganhou e não de quanto. Mesmo template do placar do topo.
  el('placarFinal').innerHTML = vista.placar
    .map((p, i) => `<span class="time${i === campeao ? ' venceu' : ''}">` +
      `<i>${nomeDoTime(vista, i)}</i><b>${escapar(p)}</b></span>`)
    .join('<span class="x">×</span>');
  el('fimResumo').textContent = fora >= 0
    ? `Partida encerrada na mão ${vista.maoNum} — quem sai no meio perde.`
    : `${vista.maoNum} ${vista.maoNum === 1 ? 'mão' : 'mãos'} · partida até ${vista.alvo}`;
  el('btRevanche').classList.toggle('oculta', modo === 'convidado');
  mostrarTela('telaFimPartida');
}

// O CÓDIGO DA MESA ENQUANTO ELA É ONLINE. Fica FORA de `desenharHUD` de propósito:
// aquela função só lê `vista`, e o código da sala não está na visão nem poderia estar —
// pô-lo lá seria furar a fronteira do `visaoDe` por um dado de tela. Irmã de
// `pintarBotaoSom`: quem muda o dado é quem chama.
function pintarSala(codigo) {
  HUD.salaPainel.classList.toggle('oculta', !codigo);
  HUD.sala.textContent = codigo || '—';
}

// Quem desligou o som desligou por um motivo — trabalho, gente dormindo, ou simplesmente
// não gostar. Perguntar de novo a cada visita é o jogo não escutar.
let mudo = !!lido('mudo', false);
// O glifo do mudo era `✕` — o MESMO do botão de sair da partida, 22px ao lado dele. Dois
// botões com o mesmo desenho e consequências opostas (calar o jogo × perder a partida) é
// convite a errar, e no celular o alvo tem 44px. 🔇 diz o que faz sozinho.
//
// `aria-pressed` porque isto é um interruptor, não um comando: o leitor de tela anuncia
// "Som, ativado/desativado" em vez de só ler o glifo. E o rótulo muda junto, porque
// `title` sozinho não diz o ESTADO — diz o assunto.
function pintarBotaoSom() {
  const b = el('btSom');
  b.textContent = mudo ? '🔇' : '♪';
  b.classList.toggle('desligado', mudo);
  b.setAttribute('aria-pressed', String(mudo));
  b.setAttribute('aria-label', mudo ? 'Som desligado — ligar' : 'Som ligado — desligar');
  b.title = mudo ? 'Ligar o som' : 'Desligar o som';
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
