// O QUE A CASA PEDE, respondido em dominó.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// A Fase 1 tirou os nomes do dominó de dentro da casa e a Fase 2 tirou o texto. Sobrou uma
// terceira camada, e ela só apareceu quando o truco ficou pronto o bastante para sentar: a
// casa continuava sabendo a FORMA das coisas. Que uma jogada tem `peca` e `ponta`. Que uma
// ação se chama `comprar` ou `passar`. Que o topo da tela mostra "Pontas · Monte · Mão". Que
// uma mão acaba com alguém batendo. Que a partida vai até 6 ou até 10.
//
// Nada disso é nome de dominó — é o dominó desenhado em molde. Um truco que quisesse caber
// teria de fingir ter pontas.
//
// Este arquivo é onde o dominó responde a cada uma dessas perguntas. Ele é o irmão do
// `135-contagem.js`: lá é o CONTEÚDO do painel de apoio, aqui é o conteúdo de todo o resto.
// O `300-registro.js` continua sendo só a tabela de verbos.
//
// O número 137 o põe depois do HUD da casa (130, de onde vêm `escapar` e `nomeDoTime`) e
// depois de todo o dominó menos o registro. Nada aqui executa na carga — são declarações de
// função, içadas, então o `110-interacao.js` pode chamar `confirmacaoDoDomino` mesmo sendo
// concatenado antes.

// ─── os medidores do #topo ───────────────────────────────────────────────────
// Eram três `<div class="painel dado">` escritos no HTML da casa. As pontas com um `—`
// quando a mesa está vazia porque "nenhuma" não é zero: zero é uma ponta de valor zero.
const medidoresDoDomino = vista => [
  { rot: 'Pontas', val: vista.pontas ? vista.pontas.join('  ·  ') : '—' },
  { rot: 'Monte', val: vista.monte },
  { rot: 'Mão', val: vista.maoNum },
];

// ─── a barra de ações ────────────────────────────────────────────────────────
// Os dois botões que estavam cravados no `#acoes`. `acao` é a intenção pronta — a casa a
// devolve intacta para `aplicarNoDomino`, sem olhar dentro.
function barraDoDomino(vista) {
  const a = vista.acoes;
  const botoes = [];
  if (a.comprar) {
    botoes.push({
      rotulo: 'Comprar do monte',
      acao: { acao: 'comprar' },
      // Quando a única saída é comprar, o botão precisa gritar: o jogador está travado.
      principal: !a.jogadas.length,
    });
  }
  if (a.passar) botoes.push({ rotulo: 'Passar a vez', acao: { acao: 'passar' } });
  return botoes;
}

// ─── a barra de confirmação ──────────────────────────────────────────────────
// O rótulo diz o NÚMERO da ponta, e não "esquerda/direita" sozinho: na hora de decidir o que
// importa é em que número a peça vai encostar. `dado` é o lado, e volta intacto para
// `confirmarJogada`.
function confirmacaoDoDomino(vista, m) {
  const pt = vista.pontas;
  return {
    titulo: m.peca[0] + ' | ' + m.peca[1],
    botoes: m.pontas.map(lado => ({
      dado: lado,
      rotulo: !pt ? 'Abrir a mão com ela'
        : lado === 'esq' ? `◀ encaixar no ${pt[0]}` : `encaixar no ${pt[1]} ▶`,
    })),
  };
}

// ─── a tela de fim de mão ────────────────────────────────────────────────────
// O que sobrou na mão de cada um. Tinha rótulo nenhum e o mesmo âmbar do placar do topo,
// então lia-se como pontuação — e é o contrário: é o que ficou por jogar. Em duplas mostra o
// subtotal do time, porque quem pontua é a dupla.
function sobrouNaMao(vista) {
  const r = vista.resultado;
  // `somas` pode não vir: a vista do convidado é do fio, e o `vistaDoFio` cobra que
  // `resultado` EXISTA, não a forma dele — cobrar a forma ali seria a casa sabendo o
  // formato de um jogo (C3 da Fila 12). Quem conhece a forma é este arquivo, e a lista
  // vazia é degradação graciosa: o painel fica sem linhas em vez de a tela morrer.
  //
  // AS DUAS PELO MESMO CRITÉRIO, e a segunda é o irmão que ficou para trás no conserto
  // ORIGINAL — dentro da onda que existia justamente para caçar guarda esquecida no
  // vizinho. `somasPorTime` levava `|| []`, que não protege contra valor TRUTHY não-array:
  // uma string ali passava e o `.map` estourava, matando a tela do convidado em duplas.
  // Achado pela varredura seguinte, um dia depois. `Array.isArray` nas duas.
  const somas = Array.isArray(r.somas) ? r.somas : [];
  const porTime = Array.isArray(r.somasPorTime) ? r.somasPorTime : [];
  if (!vista.duplas) {
    return somas
      .map((s, i) => `<div><span>${escapar(nomeDaCadeira(vista, i))}</span><b>${escapar(s)}</b></div>`).join('');
  }
  return porTime.map((total, t) => {
    const parcelas = somas.filter((_, i) => timeDe(vista, i) === t).map(escapar).join(' + ');
    return `<div><span>${nomeDoTime(vista, t)}<i>${parcelas}</i></span><b>${escapar(total)}</b></div>`;
  }).join('');
}

function fimDeMaoDoDomino(vista) {
  const r = vista.resultado;
  const bateu = r.motivo === 'batida';
  // "Zé e Tião fazem", não "faz": em duplas o sujeito é a dupla.
  const fazem = vista.duplas ? 'fazem' : 'faz';
  return {
    titulo: bateu ? 'Bateu!' : 'Trancou',
    tipo: NOME_BATIDA[r.tipo] || '',
    quem: r.time === null
      ? 'Empate na contagem — ninguém marca.'
      : `${nomeDoTime(vista, r.time)} ${fazem} ${r.pontos === 1 ? '1 ponto' : `${r.pontos} pontos`}` +
        // `nomeDaCadeira` e não `vista.cadeiras[…].nome`: no convidado esta vista vem do fio,
        // e um `vencedor` torto estourava aqui dentro do desenho (C3 da Fila 12).
        (bateu ? '' : ` · mão mais leve com ${nomeDaCadeira(vista, r.vencedor)}`),
    detalhe: sobrouNaMao(vista),
  };
}

// ─── a vista sem a mão ───────────────────────────────────────────────────────
// A tela de troca do hotseat: as peças somem da vista, e com elas todas as ações. Zerar
// `acoes` exige saber quais são — e é por isso que esta linha não podia morar na casa.
const semAMaoNoDomino = v =>
  Object.assign({}, v, { mao: [], acoes: { jogadas: [], comprar: false, passar: false } });

// ─── a abertura da mão ───────────────────────────────────────────────────────
const aberturaDoDomino = P =>
  `Mão ${P.maoNum} · abre ${P.cadeiras[P.vez].nome}` +
  (P.pecaObrigatoria ? ` com o ${P.pecaObrigatoria.join('|')}` : '');

// ─── aplicar uma intenção ────────────────────────────────────────────────────
// O caminho único por onde passa o seu clique, o do bot e o que chega pela rede. Devolve o
// erro OU o que a mesa deve ouvir.
//
// A GUARDA DE FORMA MORA AQUI, e é o C3 da Fila 11 no lugar certo: `mesmaPeca` lê `b[0]` sem
// perguntar, e `undefined[0]` LANÇA — no online isso é a mesa inteira do anfitrião parando
// por causa de uma mensagem torta de um convidado. Não é sobre trapaça (peça inventada já
// devolvia 'jogada inválida', porque `jogar` valida contra a mão do próprio jogador); é sobre
// a partida dos outros continuar.
//
// E a cadeia é FECHADA no fim: `{t:'acao'}` sem campo nenhum caía num `else` e virava um
// PASSE válido — dava para passar a vez de alguém mandando uma mensagem vazia.
function aplicarNoDomino(P, cadeira, i) {
  if (P.fase !== 'mao') return { erro: 'a mão não está em jogo' };
  const nome = P.cadeiras[cadeira].nome;

  if (i.acao === 'jogar') {
    if (!jogadaDoFioDoDomino(i.peca) || (i.ponta !== 'esq' && i.ponta !== 'dir')) {
      return { erro: 'jogada inválida' };
    }
    const r = jogar(P, cadeira, i.peca, i.ponta);
    if (r.erro) return r;
    const narracao = [`${nome} jogou ${i.peca[0]}|${i.peca[1]}`];
    if (r.fim) {
      tocarBatida();
      narracao.push(r.fim.motivo === 'batida'
        ? `${nome} bateu — ${NOME_BATIDA[r.fim.tipo] || ''}`
        : 'Jogo trancado');
    }
    return { ok: true, narracao };
  }

  if (i.acao === 'comprar') {
    const r = comprar(P, cadeira);
    if (r.erro) return r;
    tocarCompra();
    return { ok: true, narracao: [`${nome} comprou do monte`] };
  }

  if (i.acao === 'passar') {
    const r = passar(P, cadeira);
    if (r.erro) return r;
    tocarPasse();
    return { ok: true, narracao: [`${nome} passou`] };
  }

  return { erro: 'ação desconhecida' };
}

// "Isto que chegou pelo fio tem forma de peça?" — dois inteiros de 0 a MAX_PINTAS.
const jogadaDoFioDoDomino = p => Array.isArray(p) && p.length === 2
  && p.every(n => Number.isInteger(n) && n >= 0 && n <= MAX_PINTAS);

// ─── a dica ──────────────────────────────────────────────────────────────────
// O que DIZER e o que FAZER. O fazer é uma função porque a dica termina exatamente onde o seu
// clique terminaria — levantando a peça, com os fantasmas nas pontas e a barra aberta —, e só
// o jogo sabe qual clique é esse.
function dicaDoDominoParaACasa(vista) {
  const d = dicaDaVista(vista);
  if (!d) return null;

  // Só os porquês que pesaram de verdade, do mais forte para o mais fraco, e no máximo dois:
  // uma lista de seis razões não ensina nada a quem está começando.
  const razoes = (d.porques || []).slice()
    .sort((a, b) => Math.abs(b.peso || 0) - Math.abs(a.peso || 0))
    .slice(0, 2).map(p => p.texto);

  if (d.acao !== 'jogar') {
    return {
      texto: `Dica: ${d.acao === 'comprar' ? 'comprar' : 'passar'} — ${razoes[0] || 'não há jogada'}`,
      aviso: d.acao === 'comprar' ? 'Dica: compre do monte.' : 'Dica: passe a vez.',
    };
  }

  // Procura na ORDEM DA TELA, que desde a arrumação não é a de `vista.mao` — é o mesmo
  // cuidado da ponte `selecionar` das suítes, e pela mesma razão.
  const i = naMao.findIndex(m => mesmaPeca(m.peca, d.peca));
  if (i < 0) return null;
  const onde = d.ponta === 'esq' ? 'na esquerda' : 'na direita';
  return {
    mostrar: () => { selecionarPeca(i); tocarSoltar(); },
    texto: `Dica: ${d.peca[0]}|${d.peca[1]} ${onde}${razoes.length ? ' — ' + razoes.join('; ') : ''}`,
    aviso: `Dica: ${d.peca[0]}|${d.peca[1]} ${onde}`,
  };
}

// ─── o menu ──────────────────────────────────────────────────────────────────
const ALVOS_DO_DOMINO = [6, 10];

// A compra livre. A casa desenha a linha, guarda o valor e desliga o botão onde a opção não
// vale; o que ela não sabe é o que "compra livre" quer dizer nem quando ela existe.
//
// A pergunta NÃO é "qual modo": o Clássico tem monte com 2 ou 3 jogadores e NENHUM com 4.
// Quem responde é `sobraDoBaralho`, pelo motivo de sempre — aritmética de baralho escrita à
// mão no menu já quebrou uma vez (`28 - 7 * MESA.n`).
const OPCOES_DO_DOMINO = [{
  id: 'compraLivre',
  dado: 'livre',
  campo: 'compraVoluntaria',
  rot: 'Compra livre',
  valores: [{ dado: '0', v: false, rotulo: 'não' }, { dado: '1', v: true, rotulo: 'sim' }],
  vale: mesa => sobraDoBaralho(MODOS[mesa.modo], mesa.n) > 0,
  porQueNao: 'sem monte nesta mesa',
}];

// O tamanho do baralho sai de `baralhoDoModo`, não de um 28 escrito à mão.
function notaDaMesaDoDomino(mesa) {
  const m = MODOS[mesa.modo];
  const baralho = baralhoDoModo(m).length;
  const monte = baralho - m.pecasPorMao * mesa.n;
  return `${baralho} peças, ${m.pecasPorMao} para cada · ` +
    (monte > 0 ? `monte com ${monte}` : 'sem monte — quem não pode jogar, passa');
}

// ─── a partida guardada ──────────────────────────────────────────────────────
// `P.faltaNo` é um array de `Set`, e Set NÃO sobrevive a JSON: `JSON.stringify(new Set())` dá
// `{}` — um objeto sem `.has` e sem `.indexOf`. Sem as duas conversões, a partida retomada
// perdia calada a marca de "passou no número" e o bot estourava na primeira consulta. É a
// MESMA conversão que `visaoDe` faz para o fio, pela mesma razão.
const guardarODomino = P => Object.assign({}, P, { faltaNo: P.faltaNo.map(s => Array.from(s)) });

const dominoDeVolta = g => Object.assign({}, g, {
  faltaNo: g.cadeiras.map((_, i) => {
    const f = (g.faltaNo || [])[i];
    return new Set(Array.isArray(f) ? f : []);
  }),
});

// Os campos DO DOMINÓ que a partida guardada precisa ter. A casa já cobrou os dela
// (`cadeiras`, `maos`, `placar`, `n`, `vez`, `regras`); estes são os que só este jogo
// desreferencia — e partida guardada é entrada de fora como qualquer outra.
const partidaDoDominoValida = p => Array.isArray(p.linha) && Array.isArray(p.monte);

// O IRMÃO DELE, para a vista que chega pelo FIO. Mesma divisão: a casa confere o continente
// comum (`cadeiras`, `vez`, `mao`…), e aqui fica o que só o dominó desreferencia.
//
// Os dois campos são os que a mesa lê SEM PERGUNTAR: `sincronizarTabuleiro` faz
// `vista.linha.map`, e `sincronizarMonte` usa `vista.monte` como limite de laço. `pontas` e
// `faltaNo` ficam de fora de propósito — os dois usos delas já têm guarda no lugar
// (`vista.pontas ? … : '—'`), e cobrar aqui o que já é opcional lá aperta a porta sem
// fechar buraco nenhum.
//
// E repare que `monte` é NÚMERO, não array: a vista manda `P.monte.length`. Copiar o
// `Array.isArray` da linha de cima recusaria toda vista de dominó — o defeito que este
// encaixe existe para consertar, refeito ao escrevê-lo.
//
// OS ELEMENTOS TAMBÉM, e é o achado da Fila 13. `Array.isArray(v.linha)` valida o
// CONTINENTE e deixa o conteúdo livre: `linha: [null]` passava e `sincronizarTabuleiro`
// estourava; `mao: [null]` matava `sincronizarMao`; `pontas: 'xx'` matava o HUD, apesar da
// guarda `vista.pontas ? …` — que protege contra AUSENTE e não contra TRUTHY DE OUTRO TIPO.
// O comentário acima dizia que `pontas` ficava de fora porque "o uso já tem guarda no
// lugar"; a guarda existia e não bastava.
//
// `[].every(…)` é `true`, então cobrar o elemento não recusa vista de fase nenhuma — que é
// a ressalva que faz o `vistaValida` do truco ser frouxo de propósito. Aqui não há esse
// custo: a forma de uma peça é a mesma em toda fase.
const vistaDoDominoValida = v => Array.isArray(v.linha) && Number.isInteger(v.monte) &&
  v.linha.every(jogadaDoFioDoDomino) &&
  v.mao.every(jogadaDoFioDoDomino) &&
  (v.pontas === null || v.pontas === undefined || Array.isArray(v.pontas));
