// A montagem da mesa: quantas cadeiras e quem senta em cada uma.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Esta tela é a interface da ideia central do projeto: não se escolhe um "modo de
// jogo", escolhe-se quem ocupa cada cadeira. Solo é uma mesa em que as outras são
// bots; hotseat é uma mesa de gente na mesma tela; online é uma mesa com vaga aberta.
// Misturar (2 online + 1 bot) não é um caso especial — é só outro preenchimento.

// A CADEIRA 0 É SUA E POR ISSO NÃO SE CHAMA "VOCÊ". Quem é você já está dito em dois
// lugares que não dependem do nome: o rótulo da cadeira, no `montarCadeiras()` aqui
// embaixo, e a etiqueta "você" do cartão do HUD (`ETIQUETA`, 130-hud.js). O campo guarda um
// NOME, e nome existe para os OUTROS — no online ele viaja para o anfitrião e vira o
// placar, a lista da sala e o começo de toda linha da conversa.
//
// Com "Você" ali, uma mesa de dois pela internet ficava literalmente "Você × Você", com as
// duas falas da conversa começando igual: ninguém sabia quem era quem. E repare que trocar
// só este literal NÃO consertaria o online — os dois lados leem o mesmo NOMES[0], então
// viraria "Careca × Careca". Quem conserta a colisão é o campo de nome do saguão
// (pagina.html) e o desempate do anfitrião (`nomeUnico`, 150-rede.js); este literal conserta
// a semântica, que é o campo guardar um nome em vez de um pronome.
const NOMES = ['Careca', 'Zé', 'Dona Cida', 'Tião', 'Bigode'];
const TIPOS = [
  ['bot:facil', 'Bot · fácil'],
  ['bot:normal', 'Bot · normal'],
  ['bot:dificil', 'Bot · difícil'],
  ['local', 'Pessoa nesta tela'],
  ['online', 'Pessoa online'],
];

const TIPOS_VALIDOS = new Set(['local', 'bot', 'online']);   // a cadeira 0 é sempre 'voce'

// A mesa da última vez. Tudo é conferido contra as regras DE HOJE, e não só contra "é um
// número": preferência guardada é entrada de fora como qualquer outra — pode vir de uma
// versão antiga do jogo, de um modo que não existe mais, ou de alguém mexendo no
// armazenamento à mão. Um Trio de 4 jogadores guardado estouraria no `distribuir`.
//
// Valor que não fecha volta ao padrão em silêncio: aqui não há nada que valha assustar
// quem só quer jogar, e o menu mostra na tela o que ficou valendo.
function mesaLembrada() {
  const g = lido('mesa', null) || {};
  // `Object.hasOwn` e não `MODOS[g.modo] ?`, e a diferença é uma TELA PRETA PERMANENTE.
  // MODOS é objeto literal, então `MODOS['constructor']` é truthy e passava no teste — e
  // `MODOS['constructor'].cadeiras` é undefined, logo a linha de baixo lançava TypeError.
  // Como `mesaLembrada()` roda no TOPO do módulo, a exceção matava o script concatenado
  // inteiro: tela preta que voltava a cada recarregamento, até alguém limpar o
  // armazenamento à mão. É exatamente o "alguém mexendo no armazenamento" que o comentário
  // acima promete cobrir — a validação existia e tinha um buraco do tamanho do protótipo.
  const modo = Object.hasOwn(MODOS, g.modo) ? g.modo : MODO_PADRAO;
  const cabem = MODOS[modo].cadeiras;
  return {
    modo,
    n: cabem.includes(g.n) ? g.n : cabem[0],
    alvo: g.alvo === 10 ? 10 : 6,
    compraVoluntaria: g.compraVoluntaria === true,
    cadeiras: NOMES.slice(0, 4).map((nome, i) => {
      const c = (Array.isArray(g.cadeiras) && g.cadeiras[i]) || {};
      const tipo = i === 0 ? 'voce' : (TIPOS_VALIDOS.has(c.tipo) ? c.tipo : 'bot');
      const guardado = typeof c.nome === 'string' ? c.nome.trim() : '';
      // "VOCÊ" GRAVADO É LIXO DE VERSÃO ANTIGA, não escolha de ninguém. Ele foi o padrão da
      // cadeira 0 até a v2, e `lembrarMesa()` persiste as quatro cadeiras assim que alguém
      // encosta no menu — ou seja, quem já jogou uma vez tem "Você" no armazenamento e não
      // veria a troca nunca. Sem esta linha o conserto é invisível justamente para quem
      // jogou o bastante para se incomodar com ele.
      //
      // Quem tiver digitado "Você" de propósito perde o nome: é o defeito que está sendo
      // desfeito, não o dado. E só na cadeira 0 — nas outras "Você" nunca foi padrão, então
      // ali ele só pode ter sido escolhido.
      const nomeVale = i === 0 && guardado === 'Você' ? '' : guardado;
      return {
        nome: (nomeVale || nome).slice(0, 14),
        tipo,
        // Nível válido é o que o BOT reconhece, conferido na tabela dele — uma segunda
        // lista aqui apodreceria no dia em que aparecesse um nível novo. `hasOwn` pela
        // mesma razão do modo, ali em cima: aqui o efeito era brando (nível 'constructor'
        // passava e o bot jogava sem ruído e sem memória, degradação invisível), mas é o
        // mesmo furo, e deixar dois padrões de validação no mesmo arquivo é como o
        // primeiro volta.
        nivel: tipo === 'bot' ? (Object.hasOwn(NIVEIS, c.nivel) ? c.nivel : 'normal') : undefined,
        // DE SESSÃO, nunca do armazenamento — e por isso escrita como literal, e não
        // copiada de `c`. A marca diz "esta cadeira virou bot por falta de gente, NESTA
        // mesa que está de pé agora"; vinda de fora ela abriria ao primeiro estranho com o
        // código uma cadeira que o dono da mesa fechou de propósito. O objeto já é
        // construído campo a campo e portanto imune; a linha existe para continuar imune no
        // dia em que alguém achar que copiar `c` inteiro é mais curto.
        vagaOnline: false,
      };
    }),
  };
}

const MESA = mesaLembrada();

// Guarda as quatro cadeiras, e não só as `n` em uso: quem joga em três e volta para
// quatro esperava o nome do quarto de volta, não "Tião" outra vez.
function lembrarMesa() {
  guardar('mesa', {
    n: MESA.n, modo: MESA.modo, alvo: MESA.alvo, compraVoluntaria: MESA.compraVoluntaria,
    cadeiras: MESA.cadeiras.map(c => ({ nome: c.nome, tipo: c.tipo, nivel: c.nivel })),
  });
}

// O `escapar` no `value=` foi a TERCEIRA mordida da mesma classe. `listarSala` (150-rede)
// punha `c.nome` direto em innerHTML e foi consertado; esta linha ficou para trás, e é pior
// por ser dentro de um ATRIBUTO — basta uma aspa para sair dele.
//
// E `c.nome` vem de fora: o convidado manda o nome dele pela rede e `150-rede.js` escreve em
// `MESA.cadeiras[cadeira].nome`; `lembrarMesa()` persiste as quatro cadeiras, então o valor
// sobrevive à recarga. Sem escape, um convidado com nome `"><img src=x onerror=…>` roda
// script na máquina do ANFITRIÃO assim que ele mexe no modo ou no número de jogadores.
//
// Sem risco de zona morta: 130-hud é concatenado ANTES de 140-menu, então `escapar` já está
// de pé quando `montarCadeiras()` roda no fim deste arquivo.
function montarCadeiras() {
  el('cadeiras').innerHTML = MESA.cadeiras.slice(0, MESA.n).map((c, i) => {
    const val = c.tipo === 'bot' ? 'bot:' + c.nivel : c.tipo;
    return `<div class="cadeira">
      <span class="num">${i === 0 ? 'Você' : 'Cadeira ' + (i + 1)}</span>
      <input class="entrada nome" data-i="${i}" value="${escapar(c.nome)}" maxlength="14" />
      ${i === 0 ? '<span class="fixo">nesta tela</span>' :
        `<select data-i="${i}">${TIPOS.map(([v, t]) =>
          `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`).join('')}</select>`}
    </div>`;
  }).join('');

  el('cadeiras').querySelectorAll('input.nome').forEach(inp => {
    inp.oninput = () => {
      MESA.cadeiras[+inp.dataset.i].nome = inp.value.trim() || 'Sem nome';
      lembrarMesa();
    };
  });
  el('cadeiras').querySelectorAll('select').forEach(sel => {
    sel.onchange = () => {
      const c = MESA.cadeiras[+sel.dataset.i];
      const [tipo, nivel] = sel.value.split(':');
      c.tipo = tipo;
      c.nivel = nivel || undefined;
      // Tipo escolhido à mão FECHA a vaga: a marca do `comecarLocal` diz "esta cadeira
      // virou bot por falta de gente", e quem acabou de escolher o bot no menu não está
      // sem gente — está decidindo. Sem esta linha, um "Bot · difícil" posto de propósito
      // continuaria reivindicável por qualquer um com o código da mesa.
      c.vagaOnline = false;
      atualizarBotaoComecar();
      lembrarMesa();
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
  ajustarCompraAoModo();
}

// COMPRA LIVRE SÓ EXISTE ONDE EXISTE MONTE. O botão ficava aceso no Duelo, no Trio e no
// Clássico de 4, prometendo uma regra que o motor descarta em silêncio — `acoesDe` exige
// `temMonte` antes de qualquer coisa. É a mesma espécie de defeito que o
// `refletirMesaNosBotoes` existe para impedir: o jogo está certo e a tela mente.
//
// A pergunta NÃO é "qual modo": o Clássico tem monte com 2 ou 3 jogadores e nenhum com 4.
// Quem responde é `sobraDoBaralho`, em 020-baralho.js, pelo mesmo motivo de sempre —
// aritmética de baralho escrita à mão no menu já quebrou uma vez.
//
// A preferência guardada NÃO é apagada quando o botão desliga: quem jogava Clássico de 2 com
// compra livre e dá uma passada pelo Duelo esperava a marca de volta ao voltar. O motor
// ignora o valor onde não há monte, então guardá-lo não custa nada — e é o `disabled` que
// impede a promessa.
function ajustarCompraAoModo() {
  const temMonte = sobraDoBaralho(MODOS[MESA.modo], MESA.n) > 0;
  el('compraLivre').querySelectorAll('button').forEach(b => { b.disabled = !temMonte; });
  el('notaCompra').textContent = temMonte ? '' : 'sem monte nesta mesa';
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
grupo('modoMesa', 'modo', v => { MESA.modo = v; ajustarCadeirasAoModo(); montarCadeiras(); lembrarMesa(); });
// `ajustarCompraAoModo` entra aqui também, e não só no modo: o Clássico tem monte com 2 ou
// 3 jogadores e NENHUM com 4, então trocar só o número de jogadores muda a resposta.
grupo('qtdJogadores', 'n', v => { MESA.n = +v; montarCadeiras(); ajustarCompraAoModo(); lembrarMesa(); });
grupo('alvoPontos', 'alvo', v => { MESA.alvo = +v; lembrarMesa(); });
grupo('compraLivre', 'livre', v => { MESA.compraVoluntaria = v === '1'; lembrarMesa(); });

// Os botões nascem marcados no HTML com o PADRÃO. Se a preferência lembrada for outra, a
// marca tem de andar até ela — senão a tela diz "Clássico · 6 pontos" e a partida começa
// num Trio até 10, que é a pior espécie de bug: o jogo está certo e a tela mente.
// (`qtdJogadores` não entra aqui: quem o marca é `ajustarCadeirasAoModo`, que também
// apaga o que não cabe no modo.)
function marcarGrupo(id, attr, valor) {
  el(id).querySelectorAll('button')
    .forEach(b => b.classList.toggle('on', b.dataset[attr] === String(valor)));
}

function refletirMesaNosBotoes() {
  marcarGrupo('modoMesa', 'modo', MESA.modo);
  marcarGrupo('alvoPontos', 'alvo', MESA.alvo);
  marcarGrupo('compraLivre', 'livre', MESA.compraVoluntaria ? 1 : 0);
}

el('btComecar').onclick = () => {
  ligarMurmuro();
  tocarEmbaralho();
  if (cadeirasOnline()) abrirMesaOnline();
  else comecarLocal();
};
el('btEntrar').onclick = () => entrarNumaMesa();
// `recomecarAsVoltas` mora no 150-rede.js, que é concatenado DEPOIS deste arquivo — e isso
// está certo: declaração de função é içada para o topo do escopo, e este corpo só roda no
// clique. É o mesmo caminho que o `encerrarRede` ao lado já fazia.
el('btMenu').onclick = () => { recomecarAsVoltas(); encerrarRede(); mostrarTela('telaMenu'); };

refletirMesaNosBotoes();
ajustarCadeirasAoModo();
montarCadeiras();
