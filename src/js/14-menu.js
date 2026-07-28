// A montagem da mesa: quantas cadeiras e quem senta em cada uma.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Esta tela é a interface da ideia central do projeto: não se escolhe um "modo de
// jogo", escolhe-se quem ocupa cada cadeira. Solo é uma mesa em que as outras são
// bots; hotseat é uma mesa de gente na mesma tela; online é uma mesa com vaga aberta.
// Misturar (2 online + 1 bot) não é um caso especial — é só outro preenchimento.

const NOMES = ['Você', 'Zé', 'Dona Cida', 'Tião', 'Careca', 'Bigode'];
const TIPOS = [
  ['bot:facil', 'Bot · fácil'],
  ['bot:normal', 'Bot · normal'],
  ['bot:dificil', 'Bot · difícil'],
  ['local', 'Pessoa nesta tela'],
  ['online', 'Pessoa online'],
];

const MESA = {
  n: 3,
  modo: MODO_PADRAO,
  alvo: 6,
  compraVoluntaria: false,
  cadeiras: NOMES.slice(0, 4).map((nome, i) => (
    i === 0 ? { nome, tipo: 'voce' } : { nome, tipo: 'bot', nivel: 'normal' }
  )),
};

function montarCadeiras() {
  el('cadeiras').innerHTML = MESA.cadeiras.slice(0, MESA.n).map((c, i) => {
    const val = c.tipo === 'bot' ? 'bot:' + c.nivel : c.tipo;
    return `<div class="cadeira">
      <span class="num">${i === 0 ? 'Você' : 'Cadeira ' + (i + 1)}</span>
      <input class="entrada nome" data-i="${i}" value="${c.nome}" maxlength="14" />
      ${i === 0 ? '<span class="fixo">nesta tela</span>' :
        `<select data-i="${i}">${TIPOS.map(([v, t]) =>
          `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`).join('')}</select>`}
    </div>`;
  }).join('');

  el('cadeiras').querySelectorAll('input.nome').forEach(inp => {
    inp.oninput = () => { MESA.cadeiras[+inp.dataset.i].nome = inp.value.trim() || 'Sem nome'; };
  });
  el('cadeiras').querySelectorAll('select').forEach(sel => {
    sel.onchange = () => {
      const c = MESA.cadeiras[+sel.dataset.i];
      const [tipo, nivel] = sel.value.split(':');
      c.tipo = tipo;
      c.nivel = nivel || undefined;
      atualizarBotaoComecar();
    };
  });

  el('notaDuplas').textContent = notaDaMesa();
  atualizarBotaoComecar();
}

// O tamanho do baralho sai de baralhoDoModo, não de um 28 escrito aqui — foi assim que
// esta linha quebrou quando os modos chegaram.
function notaDaMesa() {
  const m = MODOS[MESA.modo];
  const baralho = baralhoDoModo(m).length;
  const monte = baralho - m.pecasPorMao * MESA.n;
  return (MESA.n === 4 ? 'em duplas: 1 e 3 contra 2 e 4' : 'sem duplas') +
    ` · ${baralho} peças, ${m.pecasPorMao} para cada · ` +
    (monte > 0 ? `monte com ${monte}` : 'sem monte — quem não pode jogar, passa');
}

// Duelo é 1v1 e Trio é para três porque o baralho divide EXATO nessas contas: fora
// delas não sobra peça, sobra erro. Em vez de deixar escolher e reclamar depois, as
// cadeiras que não fecham ficam apagadas.
function ajustarCadeirasAoModo() {
  const cabem = MODOS[MESA.modo].cadeiras;
  if (!cabem.includes(MESA.n)) MESA.n = cabem[0];
  el('qtdJogadores').querySelectorAll('button').forEach(b => {
    const n = +b.dataset.n;
    b.disabled = !cabem.includes(n);
    b.classList.toggle('on', !b.disabled && n === MESA.n);
  });
}

const cadeirasOnline = () => MESA.cadeiras.slice(0, MESA.n).filter(c => c.tipo === 'online').length;

function atualizarBotaoComecar() {
  const online = cadeirasOnline();
  el('btComecar').textContent = online
    ? `Abrir mesa e esperar ${online === 1 ? '1 pessoa' : online + ' pessoas'}`
    : 'Sentar e jogar';
}

// grupos de botões que só ligam/desligam um valor
function grupo(id, attr, aplicar) {
  el(id).querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      el(id).querySelectorAll('button').forEach(o => o.classList.remove('on'));
      b.classList.add('on');
      aplicar(b.dataset[attr]);
      tocarClique();
    };
  });
}
grupo('modoMesa', 'modo', v => { MESA.modo = v; ajustarCadeirasAoModo(); montarCadeiras(); });
grupo('qtdJogadores', 'n', v => { MESA.n = +v; montarCadeiras(); });
grupo('alvoPontos', 'alvo', v => { MESA.alvo = +v; });
grupo('compraLivre', 'livre', v => { MESA.compraVoluntaria = v === '1'; });

el('btComecar').onclick = () => {
  ligarMurmuro();
  tocarEmbaralho();
  if (cadeirasOnline()) abrirMesaOnline();
  else comecarLocal();
};
el('btEntrar').onclick = () => entrarNumaMesa();
el('btMenu').onclick = () => { encerrarRede(); mostrarTela('telaMenu'); };

ajustarCadeirasAoModo();
montarCadeiras();
