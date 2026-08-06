// O que o navegador lembra, testado do único jeito que dá: RECARREGANDO A PÁGINA.
//
// Existe porque este é o primeiro comportamento do projeto que não cabe numa carga só.
// O harness em Node não tem localStorage nenhum (de propósito — o jogo roda com os
// padrões lá), e as outras suítes de navegador abrem a página uma vez e pronto. Um
// "lembrar" que funciona na mesma sessão e falha na volta não é lembrar nada, e nenhum
// teste existente conseguiria notar a diferença.
//
// A preferência guardada também é ENTRADA DE FORA: pode vir de uma versão antiga, de um
// modo que morreu, ou de alguém editando o armazenamento à mão. Um Trio de 4 jogadores
// guardado estoura no distribuir(), então há caso para isso.
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOGO = 'file:///' + path.join(import.meta.dirname, '..', 'index.html').split(path.sep).join('/');

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

// Joga por bots até chegar a SUA vez. É o único estado parado que existe numa mesa com
// bot: `seguirOTurno` só arma temporizador para cadeira de bot, então na sua vez não há
// nada pendente e o guardado para de mudar debaixo do teste.
// AS CHAVES SÃO POR JOGO desde a v4.1: `dominobar.mesa` virou `dominobar.mesa.domino`, para
// que espiar a aba do truco não leve a mesa nem a partida do dominó junto. Elas estão
// escritas à mão aqui, e não lidas do jogo, de propósito: uma asserção que pergunta ao jogo
// qual é a chave dele concorda com qualquer resposta, inclusive com a errada.
const CHAVE_MESA = 'dominobar.mesa.domino';
const CHAVE_PARTIDA = 'dominobar.partida.domino';

const AJUDA = `
  const j = window.__jogo;
  // Limpa as novas E as antigas: uma chave antiga esquecida aqui MIGRARIA na próxima carga
  // e ressuscitaria uma mesa que o teste acabou de apagar.
  const limpar = () => {
    try {
      localStorage.removeItem('${CHAVE_PARTIDA}'); localStorage.removeItem('${CHAVE_MESA}');
      localStorage.removeItem('dominobar.partida'); localStorage.removeItem('dominobar.mesa');
    } catch (e) { void e; }
  };
  const soBots = (modo, n) => {
    j.MESA.modo = modo; j.MESA.n = n;
    for (let i = 1; i < 4; i++) { j.MESA.cadeiras[i].tipo = 'bot'; j.MESA.cadeiras[i].nivel = 'normal'; }
    j.comecarLocal();
  };
  const ateMinhaVez = () => {
    for (let i = 0; i < 400; i++) {
      const P = j.P;
      if (!P || P.fase !== 'mao') return false;
      if (P.vez === 0) return true;
      j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
    }
    return false;
  };
  const guardado = () => { try { return JSON.parse(localStorage.getItem('${CHAVE_PARTIDA}')); } catch (e) { return null; } };
`;

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files'],
});

const erros = [];
const pagina = await navegador.newPage();
await pagina.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
pagina.on('pageerror', e => erros.push(e.message));
pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

const abrir = async () => {
  await pagina.goto(JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
  await pagina.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
  await pagina.evaluate(AJUDA);
};
// Recarregar é o que este arquivo testa: é a aba fechada, o erro de script, o celular
// matando a página. Nada de estado de JavaScript sobrevive — só o localStorage.
const recarregar = async () => { await pagina.reload({ waitUntil: 'networkidle2', timeout: 45000 }); await pagina.evaluate(AJUDA); };
// Abrir com uma busca na URL. `?jogo=` é o handle compartilhável da casa de jogos, e é a
// única entrada do mecanismo que não dá para exercitar recarregando a mesma página.
const abrirCom = async busca => {
  await pagina.goto(JOGO + busca, { waitUntil: 'networkidle2', timeout: 45000 });
  await pagina.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
  await pagina.evaluate(AJUDA);
};

console.log(`testando ${JOGO}`);

try {
  await abrir();

  // ─── 1. preferências ───────────────────────────────────────────────────────
  console.log('\na mesa da última vez volta na próxima');
  {
    await pagina.evaluate(() => {
      limpar();
      // Pelo caminho do jogador: clicar nos botões, não escrever no MESA. É o clique que
      // tem de gravar, e um teste que chama lembrarMesa() na mão não provaria isso.
      // A ORDEM IMPORTA, e é ela que este bloco passou a provar de quebra: a compra livre
      // só existe onde existe monte, e o Trio não tem — os botões dela ficam `disabled`
      // lá, e `.click()` num botão desabilitado não dispara nada. Então liga-se a compra
      // ENQUANTO a mesa ainda é Clássico, e só depois troca-se para Trio.
      //
      // Com isso a asserção lá embaixo passa a exigir mais do que antes: que a preferência
      // SOBREVIVA a uma passada por um modo sem monte. Desligar o botão não pode apagar a
      // escolha — quem joga Clássico de 2 com compra livre e espia o Trio espera a marca
      // de volta ao voltar.
      document.querySelector('#compraLivre button[data-livre="1"]').click();
      document.querySelector('#modoMesa button[data-modo="trio"]').click();
      document.querySelector('#alvoPontos button[data-alvo="10"]').click();
      const nome = document.querySelector('#cadeiras input.nome[data-i="1"]');
      nome.value = 'Bigodinho';
      nome.oninput();
    });

    // A CHAVE, medida direto. Com um jogo jogável só, gravar a mesa na chave comum
    // continuaria funcionando — a migração a traz de volta a cada carga —, então nenhuma
    // asserção de COMPORTAMENTO consegue distinguir as duas escritas hoje. A que distingue é
    // esta, e ela vale até o truco ter motor: aí a mesa dele passaria por cima da do dominó,
    // e a distinção volta a ser visível de fora.
    const onde = await pagina.evaluate(() => ({
      porJogo: localStorage.getItem('dominobar.mesa.domino') !== null,
      comum: localStorage.getItem('dominobar.mesa') !== null,
    }));
    ok(onde.porJogo, 'a mesa não foi guardada na chave DO JOGO (dominobar.mesa.domino)');
    ok(!onde.comum, 'a mesa foi guardada na chave comum — o truco passaria por cima dela');

    await recarregar();
    const m = await pagina.evaluate(() => ({
      modo: j.MESA.modo, n: j.MESA.n, alvo: j.MESA.alvo, compra: j.MESA.compraVoluntaria,
      nome1: j.MESA.cadeiras[1].nome,
      // O QUE A TELA DIZ, que é coisa diferente do que o MESA guarda. Os botões nascem
      // marcados no HTML com o padrão: se a marca não andar, o jogo começa num Trio até
      // 10 enquanto a tela promete Clássico até 6 — o pior tipo de bug, o silencioso.
      marcado: {
        modo: document.querySelector('#modoMesa button.on').dataset.modo,
        alvo: document.querySelector('#alvoPontos button.on').dataset.alvo,
        livre: document.querySelector('#compraLivre button.on').dataset.livre,
        n: document.querySelector('#qtdJogadores button.on').dataset.n,
      },
      naCaixa: document.querySelector('#cadeiras input.nome[data-i="1"]').value,
    }));

    ok(m.modo === 'trio', `o modo não foi lembrado: veio ${m.modo}`);
    ok(m.alvo === 10, `o alvo não foi lembrado: veio ${m.alvo}`);
    ok(m.compra === true, 'a compra livre não foi lembrada');
    ok(m.nome1 === 'Bigodinho', `o nome não foi lembrado: veio ${m.nome1}`);
    ok(m.naCaixa === 'Bigodinho', `a caixa de nome não mostrou o lembrado: ${m.naCaixa}`);
    ok(m.marcado.modo === 'trio' && m.marcado.alvo === '10' && m.marcado.livre === '1',
      `a tela mente: marcado ${JSON.stringify(m.marcado)}`);
    // Trio é só para três: o número de jogadores tem de ter acompanhado o modo.
    ok(m.n === 3 && m.marcado.n === '3', `o Trio deveria fixar 3 jogadores, veio ${m.n}`);
    console.log(`  modo ${m.modo}, até ${m.alvo}, compra livre, cadeira 2 = ${m.nome1} — e a tela concorda`);
  }

  // ─── 2. preferência estragada ──────────────────────────────────────────────
  console.log('\npreferência inválida não derruba o jogo');
  {
    await pagina.evaluate(() => {
      // Um modo que não existe, um número de jogadores impossível, um tipo de cadeira
      // inventado e um nível de bot que ninguém reconhece. É o que sobra de uma versão
      // antiga — ou de alguém mexendo no armazenamento.
      localStorage.setItem('dominobar.mesa.domino', JSON.stringify({
        modo: 'xadrez', n: 9, alvo: 999, compraVoluntaria: 'talvez',
        cadeiras: [{ nome: '', tipo: 'voce' }, { nome: 'x'.repeat(80), tipo: 'trapaceiro', nivel: 'divino' }],
      }));
    });
    await recarregar();
    const m = await pagina.evaluate(() => ({
      modo: j.MESA.modo, n: j.MESA.n, alvo: j.MESA.alvo, compra: j.MESA.compraVoluntaria,
      tipo1: j.MESA.cadeiras[1].tipo, nivel1: j.MESA.cadeiras[1].nivel,
      tam: j.MESA.cadeiras[1].nome.length,
      nome0: j.MESA.cadeiras[0].nome, tipo0: j.MESA.cadeiras[0].tipo,
    }));
    ok(m.modo === 'classico', `modo inválido deveria cair no padrão, veio ${m.modo}`);
    ok([2, 3, 4].includes(m.n), `número de jogadores inválido passou: ${m.n}`);
    ok(m.alvo === 6, `alvo inválido deveria cair em 6, veio ${m.alvo}`);
    ok(m.compra === false, 'compraVoluntaria só pode ser verdadeiro se for exatamente true');
    ok(m.tipo1 === 'bot' && m.nivel1 === 'normal', `cadeira inválida deveria virar bot normal, veio ${m.tipo1}/${m.nivel1}`);
    ok(m.tam <= 14, `nome guardado sem corte: ${m.tam} caracteres`);
    ok(m.nome0 && m.tipo0 === 'voce', 'a cadeira 0 tem de continuar sendo você, com nome');
    // E, o que importa de verdade: com isso tudo, ainda dá para jogar.
    const jogou = await pagina.evaluate(() => { soBots('classico', 3); return !!(j.P && j.P.fase === 'mao'); });
    ok(jogou, 'depois de uma preferência estragada a partida não começou');
    console.log('  tudo caiu no padrão e a mesa ainda monta');
  }

  // ─── 2a. o "Você" gravado por uma versão antiga ────────────────────────────
  // A cadeira 0 chamava-se "Você" por padrão até a v2, e é dela que sai o nome que o
  // convidado manda ao anfitrião: uma mesa de dois pela internet ficava "Você × Você", com
  // as duas falas da conversa começando igual.
  //
  // Trocar o padrão não bastava, e é o que esta cena existe para provar: `lembrarMesa()`
  // persiste as quatro cadeiras assim que alguém encosta no menu, então quem já jogou UMA
  // vez tem "Você" no armazenamento e o padrão novo nunca chega até ele — ou seja, o
  // conserto seria invisível justamente para quem jogou o bastante para se incomodar.
  //
  // Esta é a única suíte que RECARREGA a página, e sem recarregar não há como distinguir
  // "o padrão mudou" de "o guardado foi migrado".
  console.log('\no "Você" gravado por uma versão antiga não sobrevive');
  {
    await pagina.evaluate(() => {
      localStorage.setItem('dominobar.mesa.domino', JSON.stringify({
        modo: 'classico', n: 2, alvo: 6, compraVoluntaria: false,
        // A cadeira 1 também se chama "Você" — e ali é ESCOLHA, porque "Você" nunca foi
        // padrão fora da cadeira 0. O par separa migrar de apagar nome alheio.
        cadeiras: [{ nome: 'Você', tipo: 'voce' }, { nome: 'Você', tipo: 'bot', nivel: 'normal' }],
      }));
    });
    await recarregar();
    const m = await pagina.evaluate(() => ({
      nome0: j.MESA.cadeiras[0].nome, nome1: j.MESA.cadeiras[1].nome,
      // E a tela tem de concordar com o dado, senão é o `refletirMesaNosBotoes` de novo:
      // o jogo certo e o campo mentindo.
      campo0: (document.querySelector('#cadeiras .nome[data-i="0"]') || {}).value,
    }));
    ok(m.nome0 !== 'Você',
      'o "Você" gravado na sua cadeira sobreviveu à recarga — quem já jogou nunca veria o nome novo');
    ok(m.campo0 === m.nome0, `o campo do menu mostra "${m.campo0}" e a mesa guarda "${m.nome0}"`);
    ok(m.nome1 === 'Você',
      `"Você" na cadeira 1 é nome ESCOLHIDO (nunca foi padrão ali) e foi apagado: veio "${m.nome1}"`);
    console.log(`  a sua cadeira virou "${m.nome0}" e o nome escolhido da outra ficou`);
  }

  // ─── 2b. a preferência estragada com CHAVE DE PROTÓTIPO ────────────────────
  // O caso acima usa valores inventados ('xadrez', 'divino') e a validação os barrava.
  // Mas ela perguntava `MODOS[g.modo] ?`, e MODOS é objeto literal: `MODOS['constructor']`
  // é TRUTHY e passava. `MODOS['constructor'].cadeiras` é undefined, a linha seguinte
  // lançava TypeError — e como `mesaLembrada()` roda no TOPO do módulo, a exceção matava o
  // script concatenado inteiro. Tela preta, e que VOLTAVA a cada recarregamento, porque a
  // causa estava guardada. O jogador não tinha como sair disso sem limpar o armazenamento.
  //
  // Vale como caso separado justamente porque o teste de cima já existia e passava: a
  // validação estava lá, com um buraco do tamanho do protótipo do Object.
  console.log('\nchave de protótipo no armazenamento não mata o jogo');
  {
    await pagina.evaluate(() => {
      localStorage.setItem('dominobar.mesa.domino', JSON.stringify({
        modo: 'constructor', n: 4,
        cadeiras: [{ nome: 'Eu', tipo: 'voce' }, { nome: 'Bot', tipo: 'bot', nivel: 'toString' }],
      }));
    });
    await recarregar();
    // Se o script tivesse morrido, `window.__jogo` nem existiria — é esta a asserção que
    // separa "caiu no padrão" de "não abriu".
    const vivo = await pagina.evaluate(() => !!(window.__jogo && window.__jogo.pronto));
    ok(vivo, 'o jogo não carregou: a chave de protótipo derrubou o script inteiro');
    if (vivo) {
      const m = await pagina.evaluate(() => ({
        modo: j.MESA.modo, nivel1: j.MESA.cadeiras[1].nivel,
      }));
      ok(m.modo === 'classico', `modo 'constructor' deveria cair no padrão, veio ${m.modo}`);
      ok(m.nivel1 === 'normal', `nível 'toString' deveria cair em normal, veio ${m.nivel1}`);
      const jogou = await pagina.evaluate(() => { soBots('classico', 3); return !!(j.P && j.P.fase === 'mao'); });
      ok(jogou, 'depois da chave de protótipo a partida não começou');
      console.log('  o jogo abriu no padrão em vez de morrer na carga');
    }
  }

  // A PARTIDA guardada é entrada de fora tanto quanto a MESA — e era o único validador de
  // armazenamento do projeto que nunca tinha sido endurecido. `partidaGuardada` conferia
  // quatro campos e entregava o resto cru, enquanto o `mesaLembrada` do bloco acima confere
  // campo a campo. A diferença de rigor entre os dois era acidental, não decidida.
  //
  // O dano é o pior que este projeto conhece: `atualizarBotaoRetomar` roda no TOPO do
  // módulo, então um `g.P.regras` faltando lança e mata o script concatenado inteiro. Tela
  // preta que VOLTA a cada recarregamento, porque a causa está guardada — e sem saída a não
  // ser limpar o armazenamento à mão. É o defeito 5 da Fila 6 no arquivo vizinho.
  console.log('\npartida guardada corrompida não dá tela preta');
  {
    const CASOS = [
      ['sem regras', { cadeiras: [{}, {}], maos: [[], []], placar: [0, 0], linha: [], monte: [], n: 2, vez: 0 }],
      ['modo que não existe mais', { regras: { modo: 'buraco', alvo: 6 }, cadeiras: [{}, {}], maos: [[], []], placar: [0, 0], linha: [], monte: [], n: 2, vez: 0 }],
      ['chave de protótipo no modo', { regras: { modo: 'constructor', alvo: 6 }, cadeiras: [{}, {}], maos: [[], []], placar: [0, 0], linha: [], monte: [], n: 2, vez: 0 }],
      ['cadeiras que não é array', { regras: { modo: 'classico', alvo: 6 }, cadeiras: 'oi', maos: [], placar: [], linha: [], monte: [], n: 2, vez: 0 }],
      ['vez fora da faixa', { regras: { modo: 'classico', alvo: 6 }, cadeiras: [{}, {}], maos: [[], []], placar: [0, 0], linha: [], monte: [], n: 2, vez: 9 }],
      ['n discordando das cadeiras', { regras: { modo: 'classico', alvo: 6 }, cadeiras: [{}, {}], maos: [[], []], placar: [0, 0], linha: [], monte: [], n: 4, vez: 0 }],
      ['Trio com 4 jogadores', { regras: { modo: 'trio', alvo: 6 }, cadeiras: [{}, {}, {}, {}], maos: [[], [], [], []], placar: [0, 0, 0, 0], linha: [], monte: [], n: 4, vez: 0 }],
    ];
    for (const [rotulo, P] of CASOS) {
      await pagina.evaluate(g => {
        localStorage.setItem('dominobar.partida.domino', JSON.stringify(g));
      }, { quando: Date.now(), euNaTela: 0, P });
      await recarregar();
      // Se o script tivesse morrido, `window.__jogo` nem existiria — é esta a asserção que
      // separa "recusou o guardado" de "não abriu". A mesma do bloco da chave de protótipo.
      const vivo = await pagina.evaluate(() => !!(window.__jogo && window.__jogo.pronto));
      ok(vivo, `partida guardada ${rotulo}: o jogo não carregou — tela preta que volta a cada recarregamento`);
      if (!vivo) continue;
      const oferece = await pagina.evaluate(
        () => !document.getElementById('btRetomar').classList.contains('oculta'));
      ok(!oferece, `partida guardada ${rotulo}: o jogo oferece retomar uma partida que não fecha`);
      // E o jogo continua JOGÁVEL: recusar o guardado é degradação graciosa, não avaria.
      const jogou = await pagina.evaluate(() => { soBots('classico', 2); return !!(j.P && j.P.fase === 'mao'); });
      ok(jogou, `partida guardada ${rotulo}: depois de recusar o guardado a partida não começou`);
    }
    await pagina.evaluate(() => { try { localStorage.removeItem('dominobar.partida.domino'); } catch (e) { void e; } });
    console.log(`  ${CASOS.length} formas de guardado corrompido, e o jogo abre em todas`);
  }

  // ─── 3. voltar para a mesma partida ────────────────────────────────────────
  console.log('\na partida volta igual depois de recarregar');
  {
    // Procura um estado com TRÊS propriedades ao mesmo tempo: mão em jogo, a vez sendo
    // sua (é o único momento parado — `seguirOTurno` só arma temporizador para bot) e
    // `faltaNo` com conteúdo.
    //
    // O último é o que importa: `faltaNo` é array de Set, e Set virava `{}` no JSON. A
    // marca de "passou no número" voltava vazia sem ninguém notar, até o bot pedir `.has`
    // e a mesa estourar. Clássico de 4 porque ele não tem monte — quem trava PASSA, em
    // vez de comprar até conseguir, então alguém passa cedo e a mão não precisa acabar.
    const achou = await pagina.evaluate(() => {
      limpar();
      soBots('classico', 4);
      const serve = () => j.P && j.P.fase === 'mao' && j.P.vez === 0 && j.P.faltaNo.some(s => s.size > 0);
      for (let i = 0; i < 3000; i++) {
        if (serve()) return true;
        const P = j.P;
        if (!P || P.fase !== 'mao') { soBots('classico', 4); continue; }
        if (P.vez === 0) {
          const a = j.vista.acoes;
          if (a.jogadas.length) j.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
          else if (a.comprar) j.pedirAcao({ acao: 'comprar' });
          else j.pedirAcao({ acao: 'passar' });
        } else j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
      }
      return serve();
    });
    ok(achou, 'montagem: não achei uma vez sua, com a mão em jogo e alguém já tendo passado');

    // O guardado é lido AGORA e serve de gabarito: a pergunta não é "voltou algo", é
    // "voltou exatamente o que estava gravado".
    const antes = await pagina.evaluate(() => {
      const g = guardado();
      return g && {
        maoNum: g.P.maoNum, placar: g.P.placar, vez: g.P.vez, euNaTela: g.euNaTela,
        linha: JSON.stringify(g.P.linha), maos: JSON.stringify(g.P.maos), monte: g.P.monte.length,
        // No armazenamento faltaNo é array de ARRAY; na memória tem de voltar a ser Set.
        faltaNo: JSON.stringify(g.P.faltaNo),
      };
    });
    ok(antes && antes.linha, 'a partida não foi guardada durante o jogo');

    await recarregar();
    const botao = await pagina.evaluate(() => {
      const b = document.getElementById('btRetomar');
      return { oculto: b.classList.contains('oculta'), txt: b.textContent };
    });
    ok(!botao.oculto, 'o botão de continuar não apareceu com partida guardada');
    ok(/mão \d/.test(botao.txt), `o botão não disse o que vai retomar: "${botao.txt}"`);

    await pagina.evaluate(() => document.getElementById('btRetomar').click());
    const depois = await pagina.evaluate(() => ({
      maoNum: j.P.maoNum, placar: j.P.placar, vez: j.P.vez, euNaTela: j.vista.cadeira,
      linha: JSON.stringify(j.P.linha), maos: JSON.stringify(j.P.maos), monte: j.P.monte.length,
      naTela: j.maoNaTela.length, menuAberto: !document.getElementById('telaMenu').classList.contains('oculta'),
      // Set de novo, e com o mesmo conteúdo: é isto que o bot consulta e que o painel de
      // contagem mostra como "passou no número".
      ehSet: j.P.faltaNo.every(s => s instanceof Set),
      faltaNo: JSON.stringify(j.P.faltaNo.map(s => Array.from(s))),
    }));

    ok(depois.maoNum === antes.maoNum, `mão ${antes.maoNum} voltou como ${depois.maoNum}`);
    ok(JSON.stringify(depois.placar) === JSON.stringify(antes.placar), 'o placar não voltou igual');
    ok(depois.linha === antes.linha, 'a linha da mesa não voltou igual');
    ok(depois.maos === antes.maos, 'as mãos não voltaram iguais');
    ok(depois.monte === antes.monte, `o monte tinha ${antes.monte} e voltou com ${depois.monte}`);
    ok(depois.vez === antes.vez, `a vez era da cadeira ${antes.vez} e voltou na ${depois.vez}`);
    ok(depois.euNaTela === antes.euNaTela, 'a tela voltou para outra cadeira');
    ok(depois.ehSet, 'faltaNo voltou como objeto solto em vez de Set — o bot estoura nisso');
    ok(depois.faltaNo === antes.faltaNo,
      `quem passou em qual número não voltou: era ${antes.faltaNo}, veio ${depois.faltaNo}`);
    // Retomar tem de DESENHAR, não só restaurar o objeto: a mão na cena é o que prova.
    ok(depois.naTela > 0, 'a partida voltou mas nenhuma peça foi desenhada na mão');
    ok(!depois.menuAberto, 'o menu continuou por cima da partida retomada');
    ok(!erros.length, `erro no console ao retomar — ${erros[0]}`);
    console.log(`  mão ${depois.maoNum}, placar ${depois.placar.join('×')}, ` +
      `${JSON.parse(depois.linha).length} peças na mesa, ${depois.naTela} na sua mão`);
  }

  // ─── 4. a partida acabada não é oferecida ──────────────────────────────────
  console.log('\npartida terminada não fica oferecida');
  {
    await pagina.evaluate(() => {
      limpar();
      soBots('classico', 2);
      const quase = () => j.P.placar.forEach((_, i) => { j.P.placar[i] = j.P.regras.alvo - 1; });
      quase();
      for (let i = 0; i < 800 && j.P.fase !== 'fim'; i++) {
        if (j.P.fase === 'fimDeMao') { quase(); document.getElementById('btProxima').click(); continue; }
        j.aplicarIntencao(j.P.vez, j.jogadaDoBot(j.P, j.P.vez));
      }
    });
    const acabou = await pagina.evaluate(() => j.P && j.P.fase === 'fim');
    ok(acabou, 'montagem: a partida não chegou ao fim');

    await recarregar();
    const oculto = await pagina.evaluate(() => document.getElementById('btRetomar').classList.contains('oculta'));
    ok(oculto, 'o jogo ofereceu continuar uma partida que já tinha acabado');
    console.log('  o botão não aparece — a final que você já viu não volta');
  }

  // ─── 5. a mesa online que morreu ───────────────────────────────────────────
  console.log('\nretomar uma mesa que era online não trava');
  {
    await pagina.evaluate(() => {
      limpar();
      soBots('classico', 4);
      // A cadeira 1 passa a ser de gente online e a partida é gravada assim. É o que o
      // anfitrião guardaria antes de a aba morrer — e ao voltar não existe mais ninguém
      // do outro lado do fio para responder por ela.
      j.P.cadeiras[1].tipo = 'online';
      j.publicar();
    });
    const tinhaOnline = await pagina.evaluate(() => guardado().P.cadeiras.some(c => c.tipo === 'online'));
    ok(tinhaOnline, 'montagem: a cadeira online não foi guardada');

    await recarregar();
    await pagina.evaluate(() => document.getElementById('btRetomar').click());
    const tipos = await pagina.evaluate(() => j.P.cadeiras.map(c => c.tipo));
    ok(!tipos.includes('online'), `sobrou cadeira online numa partida local: ${tipos.join()}`);

    // O QUE IMPORTA: a partida tem de ANDAR. Uma cadeira que ninguém joga deixa o motor
    // esperando para sempre, e a mesa morre em silêncio — foi por isso que comecarLocal
    // já fazia esta conversão.
    const andou = await pagina.evaluate(() => {
      const linha0 = j.P.linha.length;
      for (let i = 0; i < 60; i++) {
        const P = j.P;
        if (!P || P.fase !== 'mao') break;
        j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
      }
      return { linha0, linha: j.P.linha.length, fase: j.P.fase };
    });
    ok(andou.fase !== 'mao' || andou.linha > andou.linha0,
      'a partida retomada não andou: alguma cadeira ficou sem quem jogue');
    console.log(`  cadeiras ${tipos.join(', ')} — e a mesa andou até ${andou.linha} peças`);
  }

  // ─── 5. o código da mesa sobrevive à recarga ───────────────────────────────
  // O ESPERA_VOLTA guarda a sua cadeira por 30s, e até aqui quem fechava a aba não tinha
  // mais o código para digitar: metade do mecanismo. O botão é irmão do de retomar, e
  // como aquele tem prazo — 2h, mais curto que as 12h da partida, porque a sala depende
  // de o anfitrião ainda estar de pé.
  console.log('\no código da mesa volta depois de recarregar');
  {
    await pagina.evaluate(() => {
      limpar();
      localStorage.setItem('dominobar.sala', JSON.stringify({ quando: Date.now(), codigo: 'XJCR' }));
    });
    await recarregar();
    const b = await pagina.evaluate(() => {
      j.mostrarTela('telaMenu');
      const bt = document.getElementById('btVoltarMesa');
      return { oculto: bt.classList.contains('oculta'), texto: bt.textContent };
    });
    ok(!b.oculto, 'o botão de voltar para a mesa não apareceu com código guardado e no prazo');
    ok(/XJCR/.test(b.texto), `o botão não mostrou o código: "${b.texto}"`);

    // Pré-preenchido: quem volta quase sempre volta para a mesma mesa, e o campo era
    // zerado justamente no `entrarNumaMesa`.
    const campo = await pagina.evaluate(() => {
      document.getElementById('btEntrar').click();
      return document.getElementById('onlineEntrada').value;
    });
    ok(campo === 'XJCR', `o campo do código não veio pré-preenchido (veio "${campo}")`);
    console.log(`  botão: "${b.texto.trim()}" · campo pré-preenchido com ${campo}`);

    // VENCIDO não pode aparecer. Um código de ontem é uma mesa que não existe mais, e o
    // botão viraria uma promessa falsa — a mesma razão do prazo da partida guardada.
    await pagina.evaluate(() => {
      localStorage.setItem('dominobar.sala',
        JSON.stringify({ quando: Date.now() - 3 * 3600e3, codigo: 'XJCR' }));
    });
    await recarregar();
    const venceu = await pagina.evaluate(() => {
      j.mostrarTela('telaMenu');
      return { oculto: document.getElementById('btVoltarMesa').classList.contains('oculta'), g: j.salaGuardada() };
    });
    ok(venceu.oculto && !venceu.g, 'o botão ofereceu uma mesa de 3h atrás — o prazo não valeu');
    console.log('  vencido não aparece — mesa de 3h atrás não volta');

    await pagina.evaluate(() => { try { localStorage.removeItem('dominobar.sala'); } catch (e) { void e; } });
  }

  // ─── 6. o que estava guardado sem sufixo era do dominó ─────────────────────
  // Da v4.1 em diante a mesa e a partida são guardadas POR JOGO. Sem migrar, o conserto
  // seria invisível justamente para quem jogou o bastante para ter preferência guardada: a
  // mesa dele voltaria ao padrão e a partida de antes sumiria do menu. É a mesma lição que o
  // "Você" gravado pagou na v2.0.0.
  console.log('\na mesa e a partida da v4.0 sobrevivem à chegada da aba');
  {
    // Uma partida de verdade, e não um objeto escrito à mão: o que se quer provar é que o
    // guardado ANTIGO ainda serve, e um objeto inventado aqui provaria só que ele passa no
    // validador que eu mesmo escrevi.
    await pagina.evaluate(() => {
      limpar();
      // O clique no modo é o que GRAVA a mesa (`lembrarMesa`); `soBots` só mexe em `MESA` na
      // memória. Sem ele haveria só a partida para migrar, e a asserção mediria metade.
      j.mostrarTela('telaMenu');
      document.querySelector('#modoMesa button[data-modo="trio"]').click();
      soBots('trio', 3); ateMinhaVez();
    });
    const virou = await pagina.evaluate(() => {
      // Vira um jogador da v4.0: as duas chaves voltam a se chamar como se chamavam.
      let n = 0;
      for (const c of ['mesa', 'partida']) {
        const v = localStorage.getItem('dominobar.' + c + '.domino');
        if (v === null) continue;
        localStorage.setItem('dominobar.' + c, v);
        localStorage.removeItem('dominobar.' + c + '.domino');
        n++;
      }
      return n;
    });
    ok(virou === 2, `montagem: esperava duas chaves para renomear, renomeei ${virou}`);

    await recarregar();
    const m = await pagina.evaluate(() => ({
      modo: j.MESA.modo,
      oferece: !document.getElementById('btRetomar').classList.contains('oculta'),
      // As antigas têm de ter SUMIDO, e isto não é limpeza: `esquecerDoJogo('partida')` roda
      // no fim de toda partida, e uma chave antiga intacta ressuscitaria na leitura seguinte
      // a partida que acabou de acabar.
      sobrouMesa: localStorage.getItem('dominobar.mesa') !== null,
      sobrouPartida: localStorage.getItem('dominobar.partida') !== null,
      temNova: localStorage.getItem('dominobar.partida.domino') !== null,
    }));
    ok(m.modo === 'trio', `a mesa da v4.0 não migrou: esperava trio, veio ${m.modo}`);
    ok(m.oferece, 'a partida da v4.0 não migrou — o menu não ofereceu retomar');
    ok(m.temNova, 'a partida migrou mas não foi gravada na chave do jogo');
    ok(!m.sobrouMesa && !m.sobrouPartida,
      'a chave antiga ficou para trás — ela ressuscita a partida que o jogo acabou de esquecer');
    console.log('  mesa e partida da v4.0 vieram para `…​.domino`, e as antigas sumiram');
  }

  // ─── 7. a aba escolhe o jogo ───────────────────────────────────────────────
  console.log('\na aba escolhe o jogo, e cada mesa fica onde estava');
  {
    // A URL manda: um link `?jogo=truco` mandado no grupo abre o truco, mesmo com dominó
    // guardado como preferência.
    await abrirCom('?jogo=truco');
    const t = await pagina.evaluate(() => ({
      titulo: document.getElementById('tituloJogo').textContent,
      abas: [...document.querySelectorAll('#abasJogos button')].map(b => b.dataset.jogo),
      ativa: document.querySelector('#abasJogos button.on').dataset.jogo,
      // REGISTRADO não é JOGÁVEL: sem motor não pode haver montagem de mesa na tela.
      montagem: !document.getElementById('montagemDaMesa').classList.contains('oculta'),
      vemAi: document.getElementById('vemAi').textContent.length,
      regras: document.querySelectorAll('#regrasLista li').length,
    }));
    ok(t.abas.length === 2, `a faixa deveria listar os dois jogos, veio ${t.abas.join()}`);
    ok(t.ativa === 'truco', `?jogo=truco deveria abrir o truco, abriu ${t.ativa}`);
    ok(/Truco/.test(t.titulo), `o cartão não é o do truco: "${t.titulo}"`);
    ok(!t.montagem, 'jogo sem motor mostrou a montagem da mesa — um "Sentar e jogar" que não senta');
    ok(t.vemAi > 20, 'o truco não disse o que falta para ele — botão apagado sem explicação');
    ok(t.regras > 4, `as regras do truco não vieram do registro (${t.regras} itens)`);

    // Nome inventado na URL é ENTRADA DE FORA e cai no padrão, sem derrubar a carga. A chave
    // de protótipo é o caso que já deu tela preta permanente uma vez (defeito 5 da Fila 6).
    //
    // A PREFERÊNCIA SAI DA FRENTE PRIMEIRO, e isso é asserção e não arrumação: com 'truco'
    // guardado pelo bloco acima, uma URL inválida cai na PREFERÊNCIA e não no padrão — que é
    // o desenho, e é exatamente o que faria este teste medir o degrau errado da escada.
    await pagina.evaluate(() => { try { localStorage.removeItem('dominobar.jogo'); } catch (e) { void e; } });
    for (const ruim of ['xadrez', 'constructor', '__proto__']) {
      await abrirCom('?jogo=' + ruim);
      // `dataset` é um `DOMStringMap` e atravessa o CDP como `{}` — devolvê-lo daqui faria a
      // asserção comparar contra objeto vazio e reprovar com o jogo certíssimo na tela. É a
      // armadilha do "comparado contra um dublê vazio", num meio novo: o que sai de um
      // `evaluate` tem de ser dado puro.
      const v = await pagina.evaluate(() => {
        const b = document.querySelector('#abasJogos button.on');
        return { vivo: !!(window.__jogo && window.__jogo.pronto), ativa: b ? b.dataset.jogo : '' };
      });
      ok(v.vivo, `?jogo=${ruim} matou a carga — tela preta`);
      ok(v.ativa === 'domino', `?jogo=${ruim} deveria cair no dominó, veio "${v.ativa}"`);
    }

    // A MESA DE CADA JOGO É A DELE. Guarda uma mesa de dominó, passa pelo truco, volta.
    await abrirCom('');
    await pagina.evaluate(() => {
      limpar();
      j.mostrarTela('telaMenu');
      document.querySelector('#modoMesa button[data-modo="duelo"]').click();
    });
    const ida = await pagina.evaluate(() => {
      document.querySelector('#abasJogos button[data-jogo="truco"]').click();
      return { ativa: document.querySelector('#abasJogos button.on').dataset.jogo, busca: location.search };
    });
    ok(ida.ativa === 'truco', 'o clique na aba não trocou de jogo');
    ok(/jogo=truco/.test(ida.busca), `a URL não passou a dizer qual jogo está na mesa: "${ida.busca}"`);

    const volta = await pagina.evaluate(() => {
      document.querySelector('#abasJogos button[data-jogo="domino"]').click();
      return { modo: j.MESA.modo, busca: location.search };
    });
    ok(volta.modo === 'duelo', `a mesa do dominó não estava onde ficou: veio ${volta.modo}`);
    // O padrão SAI da URL: o endereço limpo tem de continuar sendo o endereço de sempre.
    ok(!/jogo=/.test(volta.busca), `o jogo padrão não devia sujar a URL: "${volta.busca}"`);

    // E A PREFERÊNCIA SOBREVIVE À RECARGA — é o que faz a aba valer alguma coisa amanhã.
    await pagina.evaluate(() => { document.querySelector('#abasJogos button[data-jogo="truco"]').click(); });
    await abrirCom('');
    const lembrou = await pagina.evaluate(() => document.querySelector('#abasJogos button.on').dataset.jogo);
    ok(lembrou === 'truco', `a aba escolhida não foi lembrada: abriu no ${lembrou}`);

    // MESA OCUPADA NÃO TROCA DE JOGO, e diz por quê.
    await pagina.evaluate(() => {
      document.querySelector('#abasJogos button[data-jogo="domino"]').click();
      limpar(); soBots('classico', 2); ateMinhaVez();
      j.mostrarTela('telaMenu');
    });
    const ocupada = await pagina.evaluate(() => {
      const b = document.querySelector('#abasJogos button[data-jogo="truco"]');
      return { travado: b.disabled, porque: b.title, emJogo: !!(j.P && j.P.fase === 'mao') };
    });
    ok(ocupada.emJogo, 'montagem: não havia partida em andamento');
    ok(ocupada.travado, 'a aba trocaria de jogo com uma partida viva — a partida de um jogo iria para a chave do outro');
    ok(ocupada.porque.length > 10, 'a aba travada não disse por quê');
    await pagina.evaluate(() => { limpar(); });
    console.log(`  ${t.abas.join(' | ')} · a URL manda, a preferência lembra, e a mesa ocupada não troca`);
  }
} catch (e) {
  console.error('  ✗ ' + e.message);
  falhas++;
}

await pagina.close();
await navegador.close();

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
