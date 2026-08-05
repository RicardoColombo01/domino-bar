// Motor de regras, sem gráfico nenhum: milhares de mãos bot×bot com semente fixa.
// Um erro de regra achado aqui custa segundos; achado depois do 3D, custa horas.
import { installStubs, seedRandom, buildModule } from './harness.mjs';

installStubs();
const mod = await import(buildModule([
  'baralhoCompleto', 'distribuir', 'embaralhar', 'quemAbre',
  'pontas', 'orientar', 'jogadasValidas', 'aplicar', 'tipoDaBatida',
  'novaPartida', 'novaMao', 'acoesDe', 'jogar', 'comprar', 'passar', 'visaoDe',
  'jogadaDoBot', 'timeDe', 'valor', 'carroca', 'chave', 'somaMao', 'mesmaPeca', 'PONTOS',
  'MODOS', 'MODO_PADRAO', 'MAX_EMBARALHOS', 'baralhoDoModo', 'maoRuim',
  'fechamentosArmados', 'pontasDepois', 'abandonar',
  // `fecharMao` é o que decide pontos, empate e quem abre a próxima — e em DUPLAS ele
  // faz três contas que não existem na mesa de 2. Nenhuma tinha asserção.
  'fecharMao', 'sobraDoBaralho',
]));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };
const secao = t => console.log('\n' + t);

// ─── baralho ────────────────────────────────────────────────────────────────
secao('baralho');
{
  const b = mod.baralhoCompleto();
  ok(b.length === 28, `baralho tem ${b.length} peças, esperado 28`);
  ok(new Set(b.map(mod.chave)).size === 28, 'peça repetida no baralho');
  ok(b.filter(mod.carroca).length === 7, 'deveriam existir 7 carroças');
  ok(mod.somaMao(b) === 168, `soma de todas as peças = ${mod.somaMao(b)}, esperado 168`);

  seedRandom(7);
  // Cada modo é uma conta fechada: o baralho dele dividido pelas cadeiras que aceita.
  for (const [nome, modo] of Object.entries(mod.MODOS)) {
    const baralho = mod.baralhoDoModo(modo);
    const tamanho = modo.semZeroZero ? 27 : 28;
    ok(baralho.length === tamanho, `baralho do ${nome} tem ${baralho.length} peças, esperado ${tamanho}`);
    ok(new Set(baralho.map(mod.chave)).size === tamanho, `peça repetida no baralho do ${nome}`);
    ok(baralho.filter(mod.carroca).length === (modo.semZeroZero ? 6 : 7), `carroças erradas no ${nome}`);
    // O 0|0 vale zero, então tirar ele não muda a soma — é a peça mais barata de sacar.
    ok(mod.somaMao(baralho) === 168, `soma do baralho do ${nome} = ${mod.somaMao(baralho)}, esperado 168`);
    ok(baralho.some(p => mod.mesmaPeca(p, [0, 0])) === !modo.semZeroZero, `o 0|0 no ${nome} está do lado errado`);

    for (const n of modo.cadeiras) {
      const { maos, monte } = mod.distribuir(n, { modo: nome });
      ok(maos.length === n && maos.every(m => m.length === modo.pecasPorMao),
        `${nome} com ${n}: mão de ${maos.map(m => m.length)}, esperado ${modo.pecasPorMao} para cada`);
      ok(monte.length === tamanho - modo.pecasPorMao * n,
        `${nome} com ${n}: monte de ${monte.length}`);
      const todas = maos.flat().concat(monte).map(mod.chave);
      ok(new Set(todas).size === tamanho, `${nome} com ${n}: duplicou ou perdeu peça`);
      // Quem abre a primeira mão é quem tem o 6|6 — ele não pode ter saído do baralho.
      ok(todas.includes('6|6'), `${nome} com ${n}: o 6|6 sumiu e ninguém abre a primeira mão`);
    }
  }

  // Duelo (2×14) e Trio (3×9) esgotam o baralho. É o que os faz cair sozinhos no
  // caminho "sem monte, quem trava passa" que a mesa de 4 já usava.
  ok(mod.distribuir(2, { modo: 'duelo' }).monte.length === 0, 'o Duelo deveria consumir as 28 peças');
  ok(mod.distribuir(3, { modo: 'trio' }).monte.length === 0, 'o Trio deveria consumir as 27 peças');

  // Antes o splice devolvia mão curta em silêncio.
  let barrou = false;
  try { mod.distribuir(4, { modo: 'duelo' }); } catch { barrou = true; }
  ok(barrou, '4 × 14 peças não cabem em 28 e deveria estourar, não dar mão curta');
}

// ─── a mão ruim volta para a mesa ───────────────────────────────────────────
secao('re-embaralho');
{
  const todasCarrocas = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]];
  if (!mod.maoRuim(todasCarrocas, mod.MODOS.duelo)) {
    console.log('  ⚠ maoRuim() ainda é o placeholder (devolve sempre false): as asserções');
    console.log('    abaixo passam vazias e viram teste de verdade quando o critério existir.');
  }

  seedRandom(4242);
  const RODADAS = 2000;
  for (const [nome, modo] of Object.entries(mod.MODOS)) {
    const n = modo.cadeiras[modo.cadeiras.length - 1];
    let gasto = 0, escaparam = 0;
    for (let i = 0; i < RODADAS; i++) {
      const { maos, embaralhos } = mod.distribuir(n, { modo: nome });
      gasto += embaralhos;
      if (maos.some(m => mod.maoRuim(m, modo))) escaparam++;
    }
    const media = gasto / RODADAS;
    ok(escaparam === 0, `${nome}: ${escaparam} mãos ruins escaparam do re-embaralho`);
    // Critério exigente demais faz o laço rodar à toa e a mesa demorar a distribuir.
    ok(media < 1.2, `${nome}: ${media.toFixed(2)} embaralhos por mão — critério exigente demais?`);
    console.log(`  ${nome}: ${media.toFixed(3)} embaralhos por distribuição`);
  }

  // A trava tem de segurar mesmo um critério impossível: entrega a última mão em vez
  // de deixar a mesa rodando para sempre.
  const impossivel = Object.assign({}, mod.MODOS.classico, { carrocasDemais: 0 });
  const r = mod.distribuir(2, { modo: impossivel });
  ok(r.maos.length === 2 && r.maos.every(m => m.length === 7), 'a distribuição tem de devolver mão mesmo assim');
  ok(r.embaralhos <= mod.MAX_EMBARALHOS, `o laço passou da trava: ${r.embaralhos} embaralhos`);
}

// ─── encaixe e orientação ───────────────────────────────────────────────────
secao('encaixe');
{
  ok(mod.pontas([]) === null, 'linha vazia não tem ponta');
  const l1 = mod.aplicar([], [6, 6], 'dir');
  ok(String(mod.pontas(l1)) === '6,6', 'linha com 6|6 deve ter pontas 6 e 6');

  const l2 = mod.aplicar(l1, [6, 3], 'dir');
  ok(String(l2[1]) === '6,3', 'peça na direita entra com o número que encosta primeiro');
  ok(String(mod.pontas(l2)) === '6,3', 'pontas viraram 6 e 3');

  const l3 = mod.aplicar(l2, [1, 6], 'esq');
  ok(String(l3[0]) === '1,6', 'peça na esquerda entra com o número que encosta por último');
  ok(String(mod.pontas(l3)) === '1,3', 'pontas viraram 1 e 3');

  for (let i = 0; i + 1 < l3.length; i++) ok(l3[i][1] === l3[i + 1][0], 'invariante da linha quebrou');

  ok(mod.orientar([2, 4], 'dir', 5) === null, '2|4 não encaixa numa ponta 5');
  ok(mod.jogadasValidas([[0, 0]], l3).length === 0, '0|0 não deveria ter jogada em pontas 1 e 3');
  ok(mod.jogadasValidas([[1, 3]], l3).length === 2, '1|3 serve nas duas pontas (lá-e-lô)');
}

// ─── os quatro tipos de batida ──────────────────────────────────────────────
secao('tipos de batida');
{
  const linha = [[2, 5], [5, 5], [5, 4]];                  // pontas 2 e 4
  ok(mod.tipoDaBatida([2, 6], linha) === 'simples', 'peça comum numa ponta só = simples');
  ok(mod.tipoDaBatida([2, 4], linha) === 'laelo', 'peça comum servindo nas duas = lá-e-lô');
  ok(mod.tipoDaBatida([2, 2], linha) === 'carroca', 'carroça numa ponta só = carroça');

  // PONTAS IGUAIS NÃO SÃO DOIS LADOS — regra da casa, e o contrário do que este teste
  // afirmava até a v1.5.0. Com as duas pontas em 3, a 3|6 encosta num 3 só e o outro
  // continua vivo: batida simples. A cruzada é o oposto e exige as pontas iguais, então
  // as duas linhas abaixo têm de discordar uma da outra — se concordassem, seria sinal
  // de que voltaram a compartilhar a mesma pergunta.
  const iguais = [[3, 5], [5, 5], [5, 3]];                 // pontas 3 e 3
  ok(mod.tipoDaBatida([3, 3], iguais) === 'cruzada', 'carroça com as duas pontas iguais = cruzada');
  ok(mod.tipoDaBatida([3, 6], iguais) === 'simples', 'pontas iguais não são dois lados: é batida simples');
  ok(mod.tipoDaBatida([6, 6], iguais) === 'carroca', 'carroça de outro número não cruza nada');

  // E o contraexemplo que prova que o `e !== d` não comeu o lá-e-lô junto.
  ok(mod.tipoDaBatida([2, 4], linha) === 'laelo', 'com as pontas DIFERENTES, aí sim é lá-e-lô');

  // A 3|6 cabe nos dois lados de verdade — `jogadasValidas` devolve duas. A regra é
  // sobre os NÚMEROS das pontas, não sobre a contagem de encaixes, e confundir as duas
  // coisas é exatamente o que criou o defeito.
  ok(mod.jogadasValidas([[3, 6]], iguais).length === 2,
    'a 3|6 encaixa nos dois lados mesmo não sendo lá-e-lô — a regra é sobre os números');
}

// ─── não dá para armar a tranca ─────────────────────────────────────────────
// Baralhos de mentira, pequenos e fechados: `fechamentosArmados` recebe o baralho de
// fora justamente para dar para montar a situação inteira à mão em vez de caçar, no
// meio de mil partidas, uma em que a tranca estava armável.
secao('fechar o jogo de propósito');
{
  const chaves = js => js.map(j => mod.chave(j.peca) + ':' + j.ponta).sort().join(' ');

  // A MESMA MESA LIDA DO OUTRO LADO tem de dar o mesmo veredito. Parece óbvio e não era:
  // `chave` é sensível à ordem e a linha guarda as peças JÁ ORIENTADAS, então quase 40%
  // delas ficam gravadas invertidas e não casavam com o baralho canônico — a regra
  // deixava passar o fechamento armado. O teste antigo passou por acidente, porque na
  // fileira que estava escrita à mão todas as peças com 3 caíram na ordem canônica.
  const espelhar = linha => linha.slice().reverse().map(p => [p[1], p[0]]);

  {
    // Você ainda responde às duas pontas: os outros passam, a vez volta, você joga de
    // novo. Isso é jogar sozinho, não fechar o jogo — e não pode ser barrado.
    const baralho = [[1, 2], [2, 3], [1, 3], [3, 4], [2, 5], [5, 5]];
    const linha = [[1, 2]];                                   // pontas 1 e 2
    const mao = [[2, 3], [1, 3], [3, 4], [2, 5]];
    const jogadas = mod.jogadasValidas(mao, linha);
    ok(jogadas.length === 3, `esperava 3 jogadas, deu ${jogadas.length}`);
    const armadas = mod.fechamentosArmados(linha, jogadas, mao, baralho);
    ok(armadas.length === 0,
      `com resposta na mão o jogo não trava, e nada devia ser barrado — veio ${chaves(armadas)}`);
  }

  {
    // Carroça nunca é fechamento armado: ela deixa a ponta no mesmo número, então não
    // TRANSFORMA ponta viva em morta — quando fecha, é por consumir a última do número.
    const baralho = [[1, 2], [2, 5], [5, 5], [1, 3], [3, 3]];
    const linha = [[2, 5]];                                   // pontas 2 e 5
    const mao = [[5, 5], [1, 2]];
    const armadas = mod.fechamentosArmados(linha, mod.jogadasValidas(mao, linha), mao, baralho);
    ok(armadas.length === 0, `carroça não pode contar como fechamento armado (${chaves(armadas)})`);
  }

  {
    // pontasDepois é a conta que a regra usa, e ela não monta a linha nova.
    ok(String(mod.pontasDepois([[1, 2]], [2, 3], 'dir')) === '1,3', 'jogar 2|3 à direita deixa 1 e 3');
    ok(String(mod.pontasDepois([[1, 2]], [1, 3], 'esq')) === '3,2', 'jogar 1|3 à esquerda deixa 3 e 2');
    ok(String(mod.pontasDepois([[2, 5]], [5, 5], 'dir')) === '2,5', 'carroça não muda o número da ponta');
    ok(String(mod.pontasDepois([], [6, 6], 'dir')) === '6,6', 'na mesa vazia as pontas são a própria peça');
  }

  // Pelo MOTOR, com o baralho de 28 de verdade. Este caso é bonito porque é a MESMA
  // peça: o 3|4 fecha o jogo pela esquerda (todos os sete 3 estariam contados) e não
  // fecha pela direita (o 4|4 continua solto). Prova que a regra discrimina por ponta.
  {
    const linha = [[4, 5], [5, 5], [5, 2], [2, 1], [1, 5], [5, 0], [0, 3], [3, 6], [6, 2], [2, 4],
      [4, 0], [0, 2], [2, 3], [3, 5], [5, 6], [6, 6], [6, 4], [4, 1], [1, 3], [3, 3]];
    const armar = extra => Object.assign({
      fase: 'mao', vez: 0, n: 2, duplas: false,
      regras: { alvo: 6, compraVoluntaria: false, modo: 'classico' },
      linha, monte: [], pecaObrigatoria: null,
      maos: [[[0, 0], [2, 2], [3, 4]], []],
    }, extra || {});

    ok(String(mod.pontas(linha)) === '4,3', 'montagem do cenário: as pontas deveriam ser 4 e 3');

    // O 3|4 fecha pela esquerda (os sete 3 ficariam contados) e não fecha pela direita
    // (o 4|4 continua solto). Mesma peça, vereditos diferentes: a regra discrimina por
    // PONTA. E a mão que sobra — 0|0 e 2|2 — não responde a 3 nenhum.
    const mao = [[0, 0], [2, 2], [3, 4]];
    const armadas = mod.fechamentosArmados(linha, mod.jogadasValidas(mao, linha), mao, mod.baralhoCompleto());
    ok(chaves(armadas) === '3|4:esq', `esperava 3|4:esq, veio ${chaves(armadas) || '(nenhuma)'}`);

    // A MESMA fileira lida do outro lado: a invariante continua valendo, as pontas
    // trocam de lado, e o veredito TEM de acompanhar.
    const outroLado = espelhar(linha);
    ok(outroLado.every((p, i) => i === 0 || outroLado[i - 1][1] === p[0]),
      'a fileira espelhada deveria continuar orientada');
    ok(String(mod.pontas(outroLado)) === '3,4', 'espelhada, as pontas deveriam ser 3 e 4');
    const daOutraPonta = mod.fechamentosArmados(outroLado, mod.jogadasValidas(mao, outroLado), mao, mod.baralhoCompleto());
    ok(chaves(daOutraPonta) === '3|4:dir',
      `a mesma mesa lida do outro lado deu outro veredito: ${chaves(daOutraPonta) || '(nenhuma)'}`);

    // E basta ter uma resposta na mão para deixar de ser fechamento.
    const comSaida = mao.concat([[1, 3]]);
    ok(mod.fechamentosArmados(linha, mod.jogadasValidas(comSaida, linha), comSaida, mod.baralhoCompleto()).length === 0,
      'com o 1|3 na mão o jogo não trava, e nada devia ser barrado');

    const P = armar();
    const j = mod.acoesDe(P, 0).jogadas;
    ok(j.length === 1 && j[0].ponta === 'dir',
      `só a direita deveria sobrar, e sobrou: ${chaves(j) || '(nada)'}`);
    ok(mod.jogar(P, 0, [3, 4], 'esq').erro, 'o motor tem de recusar o fechamento armado');

    // COM MONTE A REGRA CONTINUA VALENDO, e a pergunta é se o monte pode SALVAR alguém —
    // não se ele existe. Era esta asserção que gravava a regra errada do item 2: ela dizia
    // "com monte não há tranca para armar", e por causa dela bastava dar o lance antes de
    // o monte secar. As duas metades, e a diferença entre elas é a regra inteira:
    //
    //   monte com 0|1 → não joga em 3 nenhum, comprar não adianta, e a tranca acontece
    //                   igual: o fechamento continua barrado;
    //   monte com 1|3 → responde à ponta, então o 3 deixa de estar morto e ninguém trava.
    const monteInutil = armar({ monte: [[0, 1]] });
    ok(mod.acoesDe(monteInutil, 0).jogadas.length === 1,
      'monte que não responde à ponta não impede a tranca — o fechamento tinha de continuar barrado');

    // Para o 3 deixar de estar morto tem de existir um 3 que ninguém viu — e nesta linha
    // os seis 3 restantes estão todos nela, de propósito. Então o cenário salvador é a
    // MESMA mesa com o 3|3 tirado da fileira e posto no monte. As pontas não mudam (o
    // 3|3 é carroça e era a última peça), e é só isso que muda o veredito.
    const semACarroca = linha.slice(0, -1);
    ok(String(mod.pontas(semACarroca)) === '4,3', 'montagem: tirar o 3|3 não podia mudar as pontas');
    const monteSalvador = armar({ linha: semACarroca, monte: [[3, 3]] });
    ok(mod.acoesDe(monteSalvador, 0).jogadas.length === 2,
      'com o 3|3 ainda no monte o jogo não trava, e nada devia ser barrado');

    // Na última peça você está BATENDO, não fechando.
    const ultima = armar({ maos: [[[3, 4]], []] });
    ok(mod.acoesDe(ultima, 0).jogadas.length === 2, 'jogar a última peça é bater, não trancar');
  }
}

// ─── fim de mão EM DUPLAS ───────────────────────────────────────────────────
// A mesa de 4 é o modo clássico de boteco, e até aqui toda asserção de fim de mão foi
// escrita com `n = 2` — onde `timeDe` é a identidade e as três contas de duplas do
// `fecharMao` (somar o time, decidir a tranca pelo time, e escolher quem abre DENTRO do
// time) simplesmente não rodam. Testar a mesa de 2 é testar o caso em que a regra some.
secao('fim de mão em duplas');
{
  const quatro = () => Array.from({ length: 4 }, (_, i) => ({ nome: 'p' + i, tipo: 'bot', nivel: 'normal' }));
  // Uma mesa de 4 armada à mão, sem sorteio: partida semeada teria as mãos que o
  // embaralho quiser, e o que importa aqui são somas escolhidas a dedo.
  const mesa = maos => {
    const P = mod.novaPartida(quatro(), { alvo: 6 });
    P.maos = maos;
    return P;
  };
  ok(mod.novaPartida(quatro(), { alvo: 6 }).duplas === true, 'montagem: mesa de 4 tinha de nascer em duplas');
  ok(mod.timeDe({ duplas: true }, 2) === 0 && mod.timeDe({ duplas: true }, 3) === 1,
    'montagem: as duplas são em cruz — 0&2 contra 1&3');

  // BATIDA: o ponto é do TIME, não da cadeira. Numa mesa de 2 isto é indistinguível,
  // porque o time É a cadeira; aqui, quem bate na cadeira 2 tem de marcar no placar 0.
  {
    const P = mesa([[[3, 3]], [[6, 6]], [], [[5, 4]]]);
    mod.fecharMao(P, { motivo: 'batida', vencedor: 2, tipo: 'simples' });
    ok(P.placar[0] === 1 && P.placar[1] === 0,
      `a batida da cadeira 2 tinha de pontuar para o time 0, e o placar ficou ${P.placar}`);
    ok(P.resultado.time === 0, `o resultado devia dizer time 0 e disse ${P.resultado.time}`);
    // `somasPorTime` tem o MESMO índice do placar, e é o que a tela de fim de mão mostra:
    // quatro números soltos não dizem quem pagou mais caro.
    ok(String(P.resultado.somasPorTime) === '6,21',
      `os subtotais por time deviam ser 6 e 21, e vieram ${P.resultado.somasPorTime}`);
    ok(P.resultado.somas.length === 4, 'as somas individuais têm de continuar existindo, uma por cadeira');
  }

  // TRANCA: ganha o time de menor soma SOMADA, e não a cadeira de menor mão. Este cenário
  // separa as duas leituras de propósito — a mão mais leve da mesa (a cadeira 1, com 2) é
  // do time PERDEDOR, porque o parceiro dela carrega 24.
  {
    const P = mesa([[[4, 4]], [[1, 1]], [[3, 4]], [[6, 6], [6, 5]]]);
    //            time 0: 8 + 7 = 15          time 1: 2 + 23 = 25
    mod.fecharMao(P, { motivo: 'tranca' });
    ok(P.resultado.time === 0,
      `a tranca é do time de menor SOMA (0, com 15), e o motor deu ${P.resultado.time}`);
    ok(P.placar[0] === 1, `o time 0 devia ter marcado 1 ponto e o placar ficou ${P.placar}`);
    // E QUEM ABRE A PRÓXIMA é a mão mais leve DENTRO do time que ganhou — a cadeira 2,
    // com 7, e não a cadeira 1, que tem a mão mais leve da mesa inteira.
    ok(P.resultado.vencedor === 2 && P.abridor === 2,
      `quem abre é a mão mais leve do time vencedor (cadeira 2), e o motor escolheu ${P.resultado.vencedor}`);
  }

  // EMPATE POR TIME, e é o caso que só existe em duplas: as quatro mãos são todas
  // diferentes, nenhuma cadeira empata com nenhuma, e mesmo assim os dois times somam 14.
  // A mão morre. Numa mesa de 2 o empate exige duas mãos idênticas em soma, e testar isso
  // não exercita esta linha.
  {
    const P = mesa([[[6, 6]], [[5, 5]], [[1, 1]], [[2, 2]]]);
    //            time 0: 12 + 2 = 14         time 1: 10 + 4 = 14
    ok(mod.somaMao(P.maos[0]) + mod.somaMao(P.maos[2]) === mod.somaMao(P.maos[1]) + mod.somaMao(P.maos[3]),
      'montagem: os dois times tinham de empatar na soma');
    ok(new Set(P.maos.map(mod.somaMao)).size === 4,
      'montagem: as quatro cadeiras tinham de ter somas DIFERENTES, senão o empate seria por cadeira');
    mod.fecharMao(P, { motivo: 'tranca' });
    ok(P.resultado.time === null, `empate por time devia matar a mão, e o motor deu time ${P.resultado.time}`);
    ok(P.placar[0] === 0 && P.placar[1] === 0, `ninguém marca no empate, e o placar ficou ${P.placar}`);
  }

  // A CRUZADA VALE 4, e é a batida que só existe em mesa de 4 na prática. Aqui a
  // pergunta é só se o valor chega ao placar do time certo — a regra de QUANDO ela
  // acontece está testada em `tipoDaBatida`.
  {
    const P = mesa([[], [[0, 0]], [[1, 2]], [[3, 3]]]);
    mod.fecharMao(P, { motivo: 'batida', vencedor: 0, tipo: 'cruzada' });
    ok(P.placar[0] === mod.PONTOS.cruzada && mod.PONTOS.cruzada === 4,
      `a cruzada devia levar 4 ao time 0, e o placar ficou ${P.placar}`);
  }

  // O FIM DA PARTIDA sai do placar do TIME, não da cadeira. Com o alvo em 6 e o time 0
  // em 5, uma batida simples da cadeira 2 — a parceira de quem já pontuava — encerra.
  {
    const P = mesa([[[3, 3]], [[6, 6]], [], [[5, 4]]]);
    P.placar[0] = 5;
    mod.fecharMao(P, { motivo: 'batida', vencedor: 2, tipo: 'simples' });
    ok(P.fase === 'fim', `o ponto do parceiro tinha de fechar a partida, e a fase ficou "${P.fase}"`);
  }
}

// ─── compra voluntária ──────────────────────────────────────────────────────
// A LACUNA MAIS CURIOSA DO PROJETO: a regra existe no menu, é persistida, é validada,
// aparece na tela — e o ramo NUNCA RODAVA, porque o bot não compra tendo jogada e todas
// as partidas de teste são bot×bot. Uma regra da casa que talvez não funcionasse, e
// ninguém saberia. Estas asserções são a primeira vez que ela é exercitada.
secao('compra voluntária');
{
  // Mesa de 2 no clássico, que é onde existe monte. Armada à mão: o que importa aqui é
  // haver jogada possível E monte ao mesmo tempo, e sorteio não garante isso.
  const armar = extra => Object.assign({
    fase: 'mao', vez: 0, n: 2, duplas: false,
    regras: { alvo: 6, compraVoluntaria: false, modo: 'classico' },
    baralho: mod.baralhoCompleto(),
    linha: [[3, 4]], monte: [[6, 6], [5, 1]], pecaObrigatoria: null,
    maos: [[[4, 5], [0, 0]], [[2, 2]]],
    faltaNo: [new Set(), new Set()], passesSeguidos: 0, log: [],
    placar: [0, 0], abridor: null, iAncora: 0, maoNum: 1, cadeiras: [{}, {}],
  }, extra || {});

  // ONDE EXISTE MONTE, no papel. A tabela é escrita À MÃO de propósito: derivá-la de
  // `sobraDoBaralho` seria conferir a função contra ela mesma. E o caso que a leitura
  // apressada erra é o terceiro — "modo com monte" não existe: o CLÁSSICO tem monte com 2
  // ou 3 jogadores e nenhum com 4. É por isso que a pergunta leva o `n` junto, e é por isso
  // que ela mora em 020-baralho.js e não numa propriedade da tabela MODOS.
  for (const [modo, n, sobra] of [
    ['classico', 2, 14],    // 28 − 2×7
    ['classico', 3, 7],     // 28 − 3×7
    ['classico', 4, 0],     // 28 − 4×7   ← mesa de 4 NÃO tem monte
    ['duelo', 2, 0],        // 28 − 2×14
    ['trio', 3, 0],         // 27 − 3×9
  ]) {
    const deu = mod.sobraDoBaralho(mod.MODOS[modo], n);
    ok(deu === sobra, `${modo} de ${n} devia sobrar ${sobra} para o monte e sobrou ${deu}`);
  }

  // Montagem: a 4|5 encaixa na ponta 4. Se não houvesse jogada, o "voluntária" não teria
  // o que provar — a compra seria a obrigatória de sempre.
  ok(mod.acoesDe(armar(), 0).jogadas.length > 0,
    'montagem: precisava haver jogada possível, senão a compra seria a obrigatória');

  // DESLIGADA: podendo jogar, não dá para comprar. É a regra padrão, e ela também nunca
  // tinha sido afirmada — só acontecia.
  ok(mod.acoesDe(armar(), 0).comprar === false,
    'com a compra voluntária desligada e jogada na mão, comprar não podia ser oferecido');

  // LIGADA: podendo jogar, dá para comprar mesmo assim. É o ramo inteiro.
  const livre = () => armar({ regras: { alvo: 6, compraVoluntaria: true, modo: 'classico' } });
  ok(mod.acoesDe(livre(), 0).comprar === true,
    'com a compra voluntária ligada, comprar tinha de ser oferecido mesmo havendo jogada');

  // E COMPRAR DE VERDADE FUNCIONA: a peça sai do monte, entra na mão, e A VEZ NÃO ANDA.
  // Esta última é o coração da regra — comprar e perder a vez seria um castigo, não uma
  // opção, e ninguém usaria. `comprar` não mexe em P.vez de propósito.
  {
    const P = livre();
    const antesMao = P.maos[0].length, antesMonte = P.monte.length;
    const r = mod.comprar(P, 0);
    ok(r.ok, `a compra voluntária foi recusada: ${r.erro}`);
    ok(P.maos[0].length === antesMao + 1, 'a peça comprada não entrou na mão');
    ok(P.monte.length === antesMonte - 1, 'a peça comprada não saiu do monte');
    ok(P.vez === 0, `comprar não pode passar a vez, e a vez foi para ${P.vez}`);
    // O `r.peca &&` não é decoração defensiva: sem ele, uma compra RECUSADA faz
    // `chave(undefined)` LANÇAR, o processo morre no meio da suíte e as asserções
    // seguintes nunca rodam — foi o que aconteceu ao conferir isto por mutação, e
    // escondeu metade do resultado. Asserção tem de FALHAR, não explodir.
    ok(!!r.peca && mod.chave(r.peca) === mod.chave(P.maos[0][P.maos[0].length - 1]),
      'a peça devolvida pela compra não é a que entrou na mão');
  }

  // DÁ PARA COMPRAR O MONTE INTEIRO, e depois disso a oferta ACABA. É o limite natural da
  // regra — não há teto de compras, o teto é o monte. A pergunta que isto responde de
  // verdade é se o motor para a tempo: `P.monte.pop()` num monte vazio empurraria
  // `undefined` para dentro da mão, e a partida quebraria uma jogada depois, longe daqui.
  {
    const P = livre();
    let compras = 0;
    while (mod.acoesDe(P, 0).comprar && compras < 20) { mod.comprar(P, 0); compras++; }
    ok(compras === 2, `o monte tinha 2 peças e foram compradas ${compras}`);
    ok(P.monte.length === 0, 'o monte devia ter secado');
    ok(P.maos[0].every(p => Array.isArray(p) && p.length === 2),
      'entrou coisa que não é peça na mão — o motor comprou de um monte vazio');
    ok(mod.comprar(P, 0).erro, 'comprar de monte vazio tinha de ser recusado');
    // Com o monte seco e jogada na mão, ele joga: `passar` continua exigindo não haver
    // jogada. Comprar até o fim não pode deixar o jogador sem saída nenhuma.
    const a = mod.acoesDe(P, 0);
    ok(a.jogadas.length > 0 && a.passar === false,
      'depois de secar o monte, quem ainda tem jogada não pode ser mandado passar');
  }

  // SEM MONTE A REGRA NÃO EXISTE, e é o que impede o botão de prometer o que o motor
  // descarta: no Duelo e no Trio o baralho acaba na distribuição.
  ok(mod.acoesDe(armar({
    monte: [], regras: { alvo: 6, compraVoluntaria: true, modo: 'classico' },
  }), 0).comprar === false,
    'sem monte não há compra voluntária, por mais ligada que a regra esteja');

  // O BOT NÃO COMPRA TENDO JOGADA — e é exatamente por isso que este ramo nunca rodou.
  // Fica afirmado: se um dia ele passar a comprar por conta própria, as milhares de mãos
  // bot×bot mudariam de comprimento e a força medida do bot andaria junto, sem que nada
  // do que aquelas suítes testam tivesse mudado.
  {
    const P = livre();
    const escolha = mod.jogadaDoBot(P, 0);
    ok(escolha && escolha.acao === 'jogar',
      `o bot com jogada na mão devia jogar, e escolheu "${escolha && escolha.acao}"`);
  }
}

// ─── sair no meio ───────────────────────────────────────────────────────────
secao('abandono');
{
  const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'bot' + i, tipo: 'bot', nivel: 'normal' }));
  const P = mod.novaPartida(cadeiras(2), { alvo: 6 });
  ok(P.desistiu === null, 'partida nova não tem desistente');

  P.placar[0] = 4; P.placar[1] = 1;                    // quem vai sair está GANHANDO
  const r = mod.abandonar(P, 0);
  ok(r.ok && P.fase === 'fim' && P.desistiu === 0, 'abandonar deveria encerrar a partida');
  ok(P.placar[0] === 4 && P.placar[1] === 1,
    'abandonar não mexe no placar — quem sai simplesmente não leva, e quem decide o campeão é a tela');
  ok(P.resultado === null, 'abandono não tem resultado de mão: a partida foi interrompida, não terminou');
  ok(mod.visaoDe(P, 1).desistiu === 0, 'o desistente tem de chegar na visão de quem ficou');
  ok(mod.abandonar(P, 1).erro, 'não dá para abandonar uma partida já encerrada');
}

// ─── partidas inteiras ──────────────────────────────────────────────────────
secao('partidas bot × bot');
{
  const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'bot' + i, tipo: 'bot', nivel: 'normal' }));
  const vistos = new Set();
  let maos = 0, batidas = 0, trancas = 0, compras = 0, maiorLinha = 0;

  seedRandom(20260727);
  for (let partida = 0; partida < 900; partida++) {
    const n = 2 + (partida % 3);
    const P = mod.novaPartida(cadeiras(n), { alvo: 6, compraVoluntaria: partida % 7 === 0 });

    for (let passo = 0; P.fase !== 'fim'; passo++) {
      if (passo > 4000) { ok(false, `partida ${partida} não terminou`); break; }

      if (P.fase === 'fimDeMao') {
        maos++;
        const r = P.resultado;
        if (r.motivo === 'batida') { batidas++; vistos.add(r.tipo); } else trancas++;
        ok(r.pontos === (r.time === null ? 0 : mod.PONTOS[r.tipo]), 'pontos não batem com o tipo de batida');
        // Toda mão acaba com alguém sem peça (batida) ou com todo mundo travado (tranca).
        if (r.motivo === 'batida') ok(P.maos[r.vencedor].length === 0, 'bateu mas sobrou peça na mão');
        mod.novaMao(P);
        continue;
      }

      // Conservação: 28 peças, sempre, em algum lugar.
      const total = P.maos.reduce((s, m) => s + m.length, 0) + P.monte.length + P.linha.length;
      ok(total === 28, `sumiram peças: ${total} em vez de 28`);
      maiorLinha = Math.max(maiorLinha, P.linha.length);

      const vez = P.vez;
      const antes = P.maos[vez].length;
      const j = mod.jogadaDoBot(P, vez);
      let r;
      if (j.acao === 'jogar') r = mod.jogar(P, vez, j.peca, j.ponta);
      else if (j.acao === 'comprar') { r = mod.comprar(P, vez); compras++; }
      else r = mod.passar(P, vez);
      ok(!r.erro, `bot fez jogada recusada (${j.acao}): ${r.erro}`);

      if (j.acao === 'comprar') ok(P.maos[vez].length === antes + 1 && P.vez === vez, 'comprar não devia passar a vez');

      // A visão do jogador nunca pode conter a mão de outro.
      if (passo === 0) {
        const v = mod.visaoDe(P, vez);
        ok(v.mao === P.maos[vez], 'visaoDe deveria entregar a própria mão');
        ok(!JSON.stringify(v).includes('"maos"'), 'visaoDe vazou o objeto de mãos');
      }
    }

    ok(P.placar.some(v => v >= 6), 'partida acabou sem ninguém chegar a 6');
    if (n === 4) ok(P.placar.length === 2, 'mesa de 4 deveria pontuar por dupla');
  }

  console.log(`  ${maos} mãos · ${batidas} batidas · ${trancas} trancas · ${compras} compras · maior linha ${maiorLinha}`);
  for (const t of ['simples', 'carroca', 'laelo', 'cruzada'])
    ok(vistos.has(t), `nunca aconteceu uma ${t} em 900 partidas — regra provavelmente inalcançável`);
  ok(trancas > 0, 'nenhum jogo trancou em 900 partidas');
  ok(compras > 0, 'ninguém comprou do monte em 900 partidas');
}

// ─── o bot joga melhor do que jogaria por acaso ─────────────────────────────
// A única asserção do projeto que mede QUALIDADE, e não legalidade. O andaime dos
// níveis não troca de algoritmo: muda quanta informação o bot recebe (`faltaNo`) e
// quanto ele erra no impulso (`ruido`, 35% no fácil contra 0% no difícil). Se o
// difícil não ganhar do fácil, ou a heurística não vale nada, ou o `ruido` não está
// atrapalhando ninguém — os dois seriam defeito.
secao('difícil × fácil');
{
  const dupla = () => [
    { nome: 'craque', tipo: 'bot', nivel: 'dificil' },
    { nome: 'perna', tipo: 'bot', nivel: 'facil' },
  ];
  let craque = 0, perna = 0;
  seedRandom(777);
  for (let partida = 0; partida < 600; partida++) {
    const P = mod.novaPartida(dupla(), { alvo: 6 });
    for (let passo = 0; P.fase !== 'fim' && passo < 4000; passo++) {
      if (P.fase === 'fimDeMao') { mod.novaMao(P); continue; }
      const vez = P.vez;
      const j = mod.jogadaDoBot(P, vez);
      if (j.acao === 'jogar') mod.jogar(P, vez, j.peca, j.ponta);
      else if (j.acao === 'comprar') mod.comprar(P, vez);
      else mod.passar(P, vez);
    }
    P.placar[0] > P.placar[1] ? craque++ : perna++;
  }
  const taxa = craque / (craque + perna);
  // O desvio-padrão binomial com N partidas é sqrt(p(1-p)/N). Imprimir a margem é o que
  // impede que uma troca de semente pareça uma regressão: sem ela, um teste a um desvio
  // do limiar reprova sozinho de vez em quando e ninguém sabe por quê.
  const sigma = Math.sqrt(0.5 * 0.5 / (craque + perna));
  console.log(`  difícil ${craque} × ${perna} fácil (${(taxa * 100).toFixed(1)}%, ` +
    `${((taxa - 0.5) / sigma).toFixed(1)}σ acima do acaso)`);
  ok(taxa - 0.5 > 2 * sigma,
    `o bot difícil ganhou ${(taxa * 100).toFixed(1)}%, a menos de 2σ do acaso — a heurística não está valendo nada`);
}

// ─── os modos novos, do começo ao fim ───────────────────────────────────────
// Duelo e Trio nunca tinham rodado: são 2 e 3 jogadores SEM monte, um caminho que só
// a mesa de 4 exercitava. Se travar sem saída, trava aqui.
secao('partidas bot × bot no Duelo e no Trio');
{
  const cadeiras = n => Array.from({ length: n }, (_, i) => ({ nome: 'bot' + i, tipo: 'bot', nivel: 'normal' }));
  seedRandom(31415);

  for (const nome of ['duelo', 'trio']) {
    const modo = mod.MODOS[nome];
    const n = modo.cadeiras[0];
    const doBaralho = mod.baralhoDoModo(modo).length;
    let maos = 0, batidas = 0, trancas = 0, comprou = 0, maiorLinha = 0;

    for (let partida = 0; partida < 60; partida++) {
      const P = mod.novaPartida(cadeiras(n), { alvo: 6, modo: nome });
      ok(P.monte.length === 0, `${nome}: sobrou monte de ${P.monte.length}`);
      ok(P.maos.every(m => m.length === modo.pecasPorMao), `${nome}: mão inicial errada`);

      for (let passo = 0; P.fase !== 'fim'; passo++) {
        if (passo > 4000) { ok(false, `${nome}: partida ${partida} não terminou`); break; }
        if (P.fase === 'fimDeMao') {
          maos++;
          P.resultado.motivo === 'batida' ? batidas++ : trancas++;
          mod.novaMao(P);
          continue;
        }
        const total = P.maos.reduce((s, m) => s + m.length, 0) + P.monte.length + P.linha.length;
        ok(total === doBaralho, `${nome}: sumiram peças — ${total} em vez de ${doBaralho}`);
        maiorLinha = Math.max(maiorLinha, P.linha.length);

        const vez = P.vez;
        const j = mod.jogadaDoBot(P, vez);
        const r = j.acao === 'jogar' ? mod.jogar(P, vez, j.peca, j.ponta)
          : j.acao === 'comprar' ? mod.comprar(P, vez) : mod.passar(P, vez);
        ok(!r.erro, `${nome}: bot fez jogada recusada (${j.acao}): ${r.erro}`);
        if (j.acao === 'comprar') comprou++;
      }
      ok(P.placar.some(v => v >= 6), `${nome}: partida acabou sem ninguém chegar a 6`);
      ok(P.placar.length === n, `${nome}: placar deveria ser por cadeira, não por dupla`);
    }

    console.log(`  ${nome}: ${maos} mãos · ${batidas} batidas · ${trancas} trancas · maior linha ${maiorLinha}`);
    ok(comprou === 0, `${nome} não tem monte e mesmo assim houve ${comprou} compras`);
    ok(trancas > 0, `${nome}: nunca trancou em 60 partidas — sem monte, deveria acontecer`);
  }
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
