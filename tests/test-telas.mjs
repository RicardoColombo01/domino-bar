// O jogo aberto em cinco tamanhos de tela, no Chrome de verdade, com a pergunta que
// nenhuma suíte em Node consegue fazer: DÁ PARA VER A MÃO?
//
// Existe porque "adaptei para celular" era opinião. O bug do retrato viveu meses num
// projeto com 900 partidas testadas — porque o harness em Node roda sempre em 1600×900
// (tests/harness.mjs fixa innerWidth/innerHeight) e nenhum teste olhava para a tela.
//
// O teste que vale de verdade é o último: projetar cada peça da mão com a MESMA câmera
// que desenha o quadro e conferir que ela caiu dentro do frustum. Ele teria pego o
// retrato sozinho, sem ninguém abrir screenshot.
import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOGO = 'file:///' + path.join(import.meta.dirname, '..', 'index.html').split(path.sep).join('/');

const TELAS = [
  { nome: 'retrato 390×844', width: 390, height: 844, touch: true },
  { nome: 'retrato 360×640', width: 360, height: 640, touch: true },
  { nome: 'paisagem 844×390', width: 844, height: 390, touch: true },
  // O celular deitado PEQUENO. 844×390 é o maior deitado que existe em celular, e era o
  // único aqui — por isso a suíte jurava que o deitado estava bem. Em 640×360 o #topo
  // (454px, centrado) e o #jogadores (à direita) se encavalam em 58px, e nenhuma das duas
  // caixas sabe disso: cada uma cabe na tela sozinha. O item 8 mora exatamente aqui.
  { nome: 'paisagem 640×360', width: 640, height: 360, touch: true },
  { nome: 'tablet 820×1180', width: 820, height: 1180, touch: true },
  { nome: 'wide 1600×900', width: 1600, height: 900, touch: false },
];

// As situações que mais apertam o HUD: a mão cheia, a mão de 14 do Duelo, e a barra de
// confirmação aberta — que é quando o rodapé tem três coisas disputando a mesma faixa.
const CASOS = [
  { nome: 'mão de 7', montar: `mesa('classico', 3); contar(false); auto(6);` },
  { nome: 'mão de 14', montar: `mesa('duelo', 2); contar(false); auto(1);` },
  { nome: 'confirmando', montar: `mesa('classico', 3); contar(false); escolherUma();` },
  { nome: 'contando', montar: `mesa('classico', 4); auto(11); contar(true);` },
  // A conversa aberta é o painel que mais briga por espaço: tem campo dentro e fica no
  // mesmo canto que a barra de confirmação ocupa.
  { nome: 'conversando', montar: `mesa('classico', 3); contar(false); auto(6); window.__jogo.alternarConversa(true);` },
  // Tabuleiro comprido: é quando a linha se espalha até a borda da mesa e o círculo dos
  // adversários fica mais apertado. Se algo vai sair do quadro, sai aqui.
  { nome: 'mesa cheia', montar: `mesa('classico', 4); contar(true); ateALinha(13);` },
  // O QUINTO PAINEL DO TOPO. Mesa de 4 em duplas (placar com dois nomes) mais os três
  // dados mais o código: é o topo mais cheio que existe. Vale o cenário porque o #topo já
  // transbordou em 360px uma vez, e o comentário do CSS explica por que ninguém viu —
  // overflow negativo em elemento fixo não aparece no scrollWidth. Sem esta cena o painel
  // novo nasceria sem nenhuma foto, já que nenhum outro caso é de mesa online.
  { nome: 'mesa online', montar: `mesa('classico', 4); contar(true); auto(11); window.__jogo.pintarSala('XJCR');` },
  // NOMES NO LIMITE — item 8. Todas as cenas até aqui usavam os nomes padrão ("Você",
  // "Bot 1"), que cabem em qualquer coisa: é por isso que a suíte nunca viu o nome cortado
  // que o Ricardo relatou jogando. 14 é o `maxlength` do campo no menu (14-menu.js), então
  // este é o pior caso que o jogo DEIXA existir, e não um exagero inventado para o teste.
  // Em duplas o placar ainda soma dois deles ("Fulano e Sicrano"), que é onde o topo cresce.
  { nome: 'nomes longos', montar:
      `nomes('Ricardo Neves', 'Maria Fernanda', 'Sebastião Jr.', 'Ana Carolina');` +
      `mesa('classico', 4); contar(true); auto(11);` },
  // MESA DE 4 RECÉM-DADA — o pior caso das mãos dos ADVERSÁRIOS, e nenhuma cena tinha.
  // Toda cena de 4 aqui já jogou 11 peças, e aí cada montinho está com 4 e mede meia
  // largura 1.07. Recém-dada são 7 peças, e a fileira vai a 1.91 — quase o dobro. Quem
  // disputa espaço com o tabuleiro e com os copos é este tamanho, não o outro.
  { nome: 'mão cheia de 4', montar: `mesa('classico', 4); contar(false);` },
];

// ESCOLHER TELAS E CENAS PELA LINHA DE COMANDO.
//
//   node test-telas.mjs                       tudo — o padrão não muda
//   node test-telas.mjs 360x640,390x844       só estas telas
//   node test-telas.mjs 640x360 mao,cheia     estas telas, estas cenas
//   node test-telas.mjs "" nomes              todas as telas, uma cena
//
// A rodada cheia são 6 telas × N cenas de Chrome, e passou de 5 para mais de 10 minutos
// quando as cenas passaram a esperar a tela ASSENTAR em vez de contar 350 ms. Ela já foi
// interrompida por limite de tempo quatro vezes, e o contorno era cortar a lista `TELAS`
// à mão — que é editar o teste para rodar o teste, e deixa a metade cortada commitada se
// alguém esquecer.
//
// Casa por SUBSTRING, sem acento e sem caixa: os nomes têm "mão", "paisagem" e "×"
// (U+00D7, que ninguém digita), então exigir o nome exato faria ninguém usar. As telas
// casam também por `LxA`, que é como se fala delas.
// `\p{Diacritic}` e não o intervalo [U+0300-U+036F]: escrito com os acentos combinantes
// literais o intervalo fica INVISÍVEL no editor — dois caracteres sem forma própria
// dentro de um colchete —, e a primeira pessoa a "limpar" a linha os apaga sem saber que
// apagou. A classe nomeada é ASCII no fonte e diz o que quer dizer.
const semAcento = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const filtrar = (lista, arg, oque) => {
  const chaves = (arg || '').split(',').map(s => semAcento(s.trim())).filter(Boolean);
  if (!chaves.length) return lista;
  const achou = lista.filter(x => chaves.some(k =>
    semAcento(x.nome).includes(k) || `${x.width}x${x.height}`.includes(k)));
  // SELEÇÃO VAZIA É ERRO, e não "rodar tudo". Um argumento com erro de digitação daria ou
  // a suíte inteira (10 min quando se queria 1) ou zero asserção — e as duas mentem, cada
  // uma do seu jeito. É a mesma lição do `diff` de dois arquivos vazios: o teste tem de
  // exigir que HAJA o que medir.
  if (!achou.length) {
    console.error(`nenhuma ${oque} casa com "${arg}" — havia: ${lista.map(x => x.nome).join(', ')}`);
    process.exit(2);
  }
  return achou;
};
const TELAS_ESCOLHIDAS = filtrar(TELAS, process.argv[2], 'tela');
const CASOS_ESCOLHIDOS = filtrar(CASOS, process.argv[3], 'cena');
const PARCIAL = TELAS_ESCOLHIDAS.length < TELAS.length || CASOS_ESCOLHIDOS.length < CASOS.length;

const AJUDA = `
  // SEMEAR O SORTEIO, e esta é a linha que transforma esta suíte de intermitente em
  // teste. As cenas montam a mesa JOGANDO de verdade, e o Math.random do navegador não é
  // semeado como o do harness em Node: cada rodada montava um tabuleiro diferente, com
  // outra quantidade de linhas na conversa e outro comprimento de fileira. Vários casos
  // ficam na beirada do limite, e a moeda decidia.
  //
  // Três rodadas do mesmo commit chegaram a dar falha, passe limpo e uma falha DIFERENTE.
  // Isso é pior do que parece: teste que falha às vezes ensina a rodar de novo, e "rodar
  // de novo" é exatamente como uma regressão de verdade passa.
  //
  // Não precisou de nada no jogo — a página inteira usa Math.random, então trocá-lo aqui
  // basta. mulberry32: pequeno, sem dependência, e bom o bastante para embaralhar peça.
  const semear = (s) => {
    let a = s >>> 0;
    Math.random = () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // O localStorage é do file:// inteiro, então uma cena que liga a contagem contamina as
  // seguintes. Cada caso diz explicitamente o que quer.
  const contar = (ligado) => {
    const b = document.getElementById('btContagem');
    if (b.classList.contains('on') !== ligado) b.click();
  };
  // Nomes ANTES de mesa(): quem lê a cadeira é o comecarLocal lá dentro. Trocar depois
  // deixaria o placar e a lista pintados com o nome velho, e a cena mediria outra coisa.
  const nomes = (...ns) => {
    const j = window.__jogo;
    ns.forEach((n, i) => { if (j.MESA.cadeiras[i]) j.MESA.cadeiras[i].nome = n; });
  };
  const mesa = (modo, n) => {
    const j = window.__jogo;
    j.MESA.modo = modo; j.MESA.n = n;
    for (let i = 1; i < 4; i++) { j.MESA.cadeiras[i].tipo = 'bot'; j.MESA.cadeiras[i].nivel = 'normal'; }
    j.comecarLocal();
  };
  const auto = (n) => {
    const j = window.__jogo;
    for (let i = 0; i < n; i++) {
      const P = j.P;
      if (!P || P.fase !== 'mao') break;
      j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
    }
  };
  // Joga até chegar a sua vez com o tabuleiro já formado, e levanta uma peça: é o
  // estado em que #confirmar, #acoes e #vez brigam pelo mesmo rodapé.
  const escolherUma = () => {
    const j = window.__jogo;
    for (let i = 0; i < 300; i++) {
      const v = j.vista;
      if (v && v.fase === 'mao' && v.vez === v.cadeira && v.linha.length && v.acoes.jogadas.length) {
        j.selecionar(j.naMao.findIndex(m => m.jogavel));
        return;
      }
      auto(1);
      if (!j.P || j.P.fase !== 'mao') mesa('classico', 3);
    }
  };
  const ateALinha = (quantas) => {
    const j = window.__jogo;
    for (let i = 0; i < 400 && j.P.linha.length < quantas; i++) {
      auto(1);
      if (!j.P || j.P.fase !== 'mao') mesa('classico', 4);
    }
  };
`;

// Roda DENTRO da página. Devolve só números e nomes — nada de nó do DOM, que não
// sobrevive à serialização do puppeteer.
const MEDIR = `(() => {
  const j = window.__jogo;
  const vis = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width < 1 || r.height < 1 || getComputedStyle(el).display === 'none') ? null
      : { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  };
  const paineis = {};
  for (const id of ['topo', 'jogadores', 'vez', 'acoes', 'confirmar', 'contagem', 'conversa', 'btSom', 'btSair', 'btConversa']) {
    const r = vis(document.getElementById(id));
    if (r) paineis[id] = r;
  }

  // Cada peça da mão projetada com a câmera que desenha o quadro. Fora de |1| é fora
  // da tela — literalmente, é a definição de frustum em coordenadas normalizadas.
  const V = j.naMao.length ? j.naMao[0].obj.position.constructor : null;
  const pecas = j.naMao.map(m => {
    const v = new V(m.xBase, m.yBase, m.zBase);
    v.project(j.camera);
    return { peca: m.peca.join('|'), x: v.x, y: v.y };
  });

  // O mesmo tratamento para o que está na mesa: o tabuleiro cresce até dobrar na borda,
  // e as mãos dos outros ficam num círculo de raio 4.9 — os dois cabem folgados numa
  // tela larga e não têm por que caber numa estreita.
  const extremo = grupo => {
    let pior = 0;
    for (const o of grupo.children) {
      const v = new V(); o.getWorldPosition(v); v.project(j.camera);
      pior = Math.max(pior, Math.abs(v.x));
    }
    return pior;
  };

  // PEÇA POR BAIXO DE PAINEL. O teste sabia perguntar se a peça está dentro do quadro e se
  // dois painéis se sobrepõem — nunca se o painel está EM CIMA da peça. É outra pergunta:
  // uma peça no lugar certo, dentro da tela, pode estar simplesmente coberta.
  //
  // Mede as CAIXAS QUE PINTAM, não os contêineres: o #topo em retrato é uma faixa da
  // largura da tela com fundo transparente e os quadrinhos dentro. Usar o retângulo dele
  // acusaria cobertura no vão entre um painel e outro, onde dá para ver o jogo.
  const caixas = [];
  for (const n of document.querySelectorAll('.painel, button.canto, #acoes button, #confirmar')) {
    const r = vis(n);
    if (r) caixas.push({ id: n.id || n.className.split(' ')[0], ...r });
  }
  const naTela = v => ({ x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight });
  const cobrindo = t => {
    for (const c of caixas) if (t.x >= c.x && t.x <= c.r && t.y >= c.y && t.y <= c.b) return c.id;
    return null;
  };
  const cobertas = [];
  for (const m of j.naMao) {
    const v = new V(m.xBase, m.yBase, m.zBase); v.project(j.camera);
    const painel = cobrindo(naTela(v));
    if (painel) cobertas.push({ oque: 'a peça ' + m.peca.join('|') + ' da sua mão', painel });
  }
  for (const [nome, grupo] of [['a mão de um adversário', j.grupoOutros], ['o monte', j.grupoMonte], ['o tabuleiro', j.grupoMesa]]) {
    for (const o of grupo.children) {
      const v = new V(); o.getWorldPosition(v); v.project(j.camera);
      const painel = cobrindo(naTela(v));
      if (painel) { cobertas.push({ oque: nome, painel }); break; }   // um exemplo por grupo basta
    }
  }

  // 3D CONTRA 3D. Até aqui a suíte fazia duas perguntas de TELA: "está dentro do quadro"
  // (|ndc| <= 1) e "está por baixo de painel HTML". A linha da mesa atravessando a mão do
  // vizinho passa nas duas — as duas coisas estão no quadro, nenhum painel as cobre — e
  // mesmo assim ocupam o mesmo pedaço de tampo, no mesmo y = PECA_E/2.
  //
  // Compara CAIXAS, não centros: o tabuleiro e o assento ficam a ~2,7 um do outro e quem
  // se encosta são as bordas. E ignora o Y de propósito, porque não há altura para
  // ignorar — tabuleiro, mãos, monte e o pé dos copos nascem todos no tampo.
  const B = j.THREE.Box3;
  // A MARCA DA ÚLTIMA JOGADA fica de fora: é um disco de raio PECA_C*0.72 colado embaixo
  // da peça (09-tabuleiro.js), e incluí-lo infla a caixa do tabuleiro em 0.22 — a medida
  // passaria a ser do clarão, não da madeira.
  const corpo = o => (o.userData && o.userData.corpo) || o;
  const caixasDe = (filhos, nome, pular) => filhos
    .filter(o => o !== pular && o.visible)
    .map(o => ({ nome, b: new B().setFromObject(corpo(o)) }))
    .filter(c => !c.b.isEmpty());

  // Distância de SEPARAÇÃO no plano do tampo: positiva é vão, negativa é uma dentro da
  // outra, e o módulo é o quanto — pelo eixo de menor penetração.
  const folgaEntre = (a, b) => Math.max(
    Math.max(a.min.x - b.max.x, b.min.x - a.max.x),
    Math.max(a.min.z - b.max.z, b.min.z - a.max.z));

  const grupos = [
    // O fantasma da prévia não conta: ele pousa fora da linha por definição.
    caixasDe(j.grupoMesa.children, 'o tabuleiro', j.grupoPrevia),
    caixasDe(j.grupoOutros.children, 'a mão de um adversário'),
    caixasDe(j.grupoMonte.children, 'o monte'),
    caixasDe(j.tralhas || [], 'uma tralha da mesa'),
  ];
  // Peça contra peça do PRÓPRIO tabuleiro não entra: tests/test-mesa.mjs já faz isso, puro
  // e em 53 mil tabuleiros. Aqui a pergunta é entre grupos diferentes.
  let pior = { folga: 99, a: '—', b: '—' };
  for (let i = 0; i < grupos.length; i++)
    for (let k = i + 1; k < grupos.length; k++)
      for (const A of grupos[i]) for (const C of grupos[k]) {
        const f = folgaEntre(A.b, C.b);
        if (f < pior.folga) pior = { folga: f, a: A.nome, b: C.nome };
      }

  const cortina = document.getElementById('cortina');
  return {
    pior,
    transbordo: document.documentElement.scrollWidth - window.innerWidth,
    largura: window.innerWidth, altura: window.innerHeight,
    // Gaveta aberta muda o que se exige da tela: cobrir o jogo passa a ser o PONTO.
    gaveta: !!cortina && !cortina.classList.contains('oculta'),
    fov: j.camera.fov, paineis, pecas, cobertas,
    fileiras: new Set(j.naMao.map(m => m.yBase.toFixed(3))).size,
    naLinha: j.vista ? j.vista.linha.length : 0,
    mesa: extremo(j.grupoMesa), outros: extremo(j.grupoOutros), monte: extremo(j.grupoMonte),
  };
})()`;

const ALVO_TOQUE = 40;                    // 44 é a recomendação; 40 tolera a borda
const sobrepoem = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) *
                            Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('    ✗ ' + msg); falhas++; } };
// A pior folga de TODAS as células, impressa no fim. Uma linha, e é ela que responde
// "o número virou positivo em todas as telas?" sem ninguém ler 60 linhas de log.
let piorGlobal = { folga: 99, a: '—', b: '—', onde: '—' };

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files'],
});

for (const tela of TELAS_ESCOLHIDAS) {
  console.log(`\n${tela.nome}`);
  for (const caso of CASOS_ESCOLHIDOS) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({
      width: tela.width, height: tela.height,
      isMobile: tela.touch, hasTouch: tela.touch, deviceScaleFactor: 1,
    });
    const erros = [];
    pagina.on('pageerror', e => erros.push(e.message));
    pagina.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });

    await pagina.goto(JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
    await pagina.waitForFunction('window.__jogo && window.__jogo.pronto',
      { timeout: 30000, polling: 400 });
    // A MESMA semente para toda cena: o que muda entre elas é o tamanho da tela e o que a
    // cena monta, nunca o sorteio. Assim uma falha é sempre reproduzível — e uma cena que
    // ficar na beirada passa a ser uma decisão (cabe ou não cabe), não uma moeda.
    // `pararBots()` DEPOIS de montar, e é a outra metade do item 11. Semear o Math.random
    // tirou a variação do embaralho, mas a espera abaixo deixava passar um número variável
    // de temporizadores de bot: a mesma cena dava `mesa 0.27` numa rodada e `0.31` na
    // outra, e um caso na beirada do limite virava moeda. Com a mesa congelada, o
    // tabuleiro é função só do que a cena pediu — e uma falha volta a ser reproduzível.
    await pagina.evaluate(AJUDA + 'semear(20260730);' + caso.montar + ';window.__jogo.pararBots();');
    // ...e ESPERA A TELA PARAR, em vez de contar 350 ms. Era a outra metade da
    // intermitência, e a maior: as peças DESLIZAM até o lugar, então uma espera fixa pega
    // a animação no meio e quem decide onde a peça está é o relógio de parede e o jitter
    // do software rendering — não a cena. Comparando duas rodadas linha a linha, `mão de
    // 7` dava `mesa 0.48` e `0.66`, e `contando` dava `0.59` e `0.89`. Repare que só o
    // `mesa` variava: `outros`, `monte`, `fileiras` e `fov` já estavam parados, e foi esse
    // desenho que apontou para a animação em vez dos temporizadores.
    //
    // O teto de quadros existe para uma cena que nunca assente não travar a suíte: ela
    // segue com o que tem, que é o comportamento de antes.
    await pagina.evaluate(() => new Promise(pronto => {
      const j = window.__jogo;
      // A posição do GRUPO entra junto com a das peças, e não é detalhe: o `grupoMesa`
      // faz o próprio easing em z para manter o tabuleiro centrado (`09-tabuleiro.js`).
      // Olhando só os filhos, a foto ficaria parada enquanto o mundo inteiro ainda
      // deslizava — e a medida é em coordenadas de MUNDO, então é o grupo que manda.
      // A mão vem do `naMao`, e não de um `grupoMao`: a ponte nunca expôs esse grupo.
      const lugar = o => o.position.toArray().map(n => n.toFixed(4)).join(',');
      const foto = () =>
        [j.grupoMesa, j.grupoOutros, j.grupoMonte]
          .map(g => lugar(g) + '>' + g.children.map(lugar).join(';')).join('|') +
        '#' + j.naMao.map(m => lugar(m.obj)).join(';');
      let antes = '', parados = 0, quadros = 0;
      const olhar = () => {
        let agora;
        // Erro aqui dentro NÃO rejeita a promessa — ela simplesmente nunca resolve, e o
        // puppeteer só reclama 30 s depois com um ProtocolError que não fala da causa.
        // Foi assim que um `j.grupoMao` inexistente travou a suíte inteira, e o pior: a
        // captura ficou VAZIA, e dois arquivos vazios passam no `diff` como "idênticos".
        try { agora = foto(); } catch (e) { void e; return pronto(); }
        parados = agora === antes ? parados + 1 : 0;
        antes = agora;
        if (parados >= 8 || ++quadros > 240) return pronto();
        requestAnimationFrame(olhar);
      };
      requestAnimationFrame(olhar);
    }));

    const m = await pagina.evaluate(MEDIR);
    const onde = `${tela.nome} · ${caso.nome}`;

    ok(!erros.length, `${onde}: erro no console — ${erros[0]}`);
    ok(m.transbordo <= 0, `${onde}: a página transbordou ${m.transbordo}px na horizontal`);

    // 1. nenhum painel do HUD pode sair da viewport
    for (const [id, r] of Object.entries(m.paineis)) {
      ok(r.x >= -1 && r.r <= m.largura + 1 && r.y >= -1 && r.b <= m.altura + 1,
        `${onde}: #${id} saiu da tela (${r.x.toFixed(0)},${r.y.toFixed(0)} até ${r.r.toFixed(0)},${r.b.toFixed(0)} numa tela de ${m.largura}×${m.altura})`);
    }

    // 2. nenhum par de painéis pode se sobrepor
    const ids = Object.keys(m.paineis);
    for (let i = 0; i < ids.length; i++) {
      for (let k = i + 1; k < ids.length; k++) {
        const area = sobrepoem(m.paineis[ids[i]], m.paineis[ids[k]]);
        ok(area < 40, `${onde}: #${ids[i]} e #${ids[k]} se sobrepõem em ${area.toFixed(0)}px²`);
      }
    }

    // 3. o botão de som é o menor alvo de toque da tela
    if (tela.touch && m.paineis.btSom) {
      const s = m.paineis.btSom;
      ok(Math.min(s.w, s.h) >= ALVO_TOQUE,
        `${onde}: #btSom tem ${s.w.toFixed(0)}×${s.h.toFixed(0)}px, menos que os ${ALVO_TOQUE} do dedo`);
    }

    // 4. O QUE IMPORTA: toda peça da mão dentro do quadro.
    ok(m.pecas.length > 0, `${onde}: a mão não foi desenhada`);
    for (const p of m.pecas) {
      ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
        `${onde}: a peça ${p.peca} caiu FORA da tela (ndc ${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }

    // 5. e o que está na mesa também tem de caber
    ok(m.mesa <= 1, `${onde}: o tabuleiro passou da borda da tela (ndc.x ${m.mesa.toFixed(2)}, com ${m.naLinha} peças na linha)`);
    ok(m.outros <= 1, `${onde}: a mão de um adversário saiu da tela (ndc.x ${m.outros.toFixed(2)})`);
    ok(m.monte <= 1, `${onde}: o monte saiu da tela (ndc.x ${m.monte.toFixed(2)})`);

    // 5b. …e nada do que está no tampo pode ocupar o lugar de outra coisa. Esta é a
    //     pergunta 3D CONTRA 3D, e ela não existia: as duas asserções acima são sobre a
    //     MOLDURA, e a linha da mesa correndo por dentro da mão do vizinho passa nas duas.
    //
    //     O limiar não é zero de propósito. "Sete pixels de folga não são um conserto, são
    //     sorte" (item 8), e 0.15 de mundo é um sexto de peça — vão de verdade, do tamanho
    //     que um dedo precisa para pegar a peça sem esbarrar na do lado.
    ok(m.pior.folga >= 0.15,
      `${onde}: ${m.pior.a} e ${m.pior.b} ocupam o mesmo tampo (folga ${m.pior.folga.toFixed(2)})`);

    // 6. nada do jogo POR BAIXO de painel — a pergunta que faltava, e a família de defeito
    //    que já reincidiu (o comentário do 07-cena.js registra o copo movido à mão uma vez
    //    pelo mesmo motivo).
    //
    //    MAS a exigência muda com o estado, e essa distinção é o coração do conserto: uma
    //    GAVETA existe para cobrir o jogo. Com a cortina no ar, cobrir é o comportamento
    //    certo — o defeito era cobrir sem dizer. Então:
    //      gaveta fechada → nada do jogo pode estar coberto;
    //      gaveta aberta  → ela manda na tela sozinha, sem HUD boiando por cima.
    if (!m.gaveta) {
      for (const c of m.cobertas) ok(false, `${onde}: ${c.oque} está por baixo de #${c.painel}`);
    } else {
      for (const id of ['acoes', 'vez', 'confirmar']) {
        ok(!m.paineis[id], `${onde}: #${id} continua visível por cima da gaveta — ela não está modal`);
      }
    }

    const larguraNaTela = m.pecas.length
      ? (Math.max(...m.pecas.map(p => p.x)) - Math.min(...m.pecas.map(p => p.x))) : 0;
    console.log(`  ${caso.nome.padEnd(13)} fov ${m.fov.toFixed(0).padStart(2)}° · ` +
      `${m.pecas.length} peças em ${m.fileiras} fileira(s) · ocupam ${(larguraNaTela * 50).toFixed(0)}% · ` +
      `mesa ${m.mesa.toFixed(2)} outros ${m.outros.toFixed(2)} monte ${m.monte.toFixed(2)} · ` +
      // A FOLGA SAI SEMPRE, mesmo verde: é a margem que encolhe em silêncio, e foi
      // exatamente uma folga de sete pixels que passou por conserto no item 8.
      `folga ${m.pior.folga.toFixed(2)}`);
    if (m.pior.folga < piorGlobal.folga) piorGlobal = { ...m.pior, onde };

    await pagina.close();
  }
}

await navegador.close();
console.log(`\nfolga mínima ${piorGlobal.folga.toFixed(2)} — ${piorGlobal.a} × ${piorGlobal.b} (${piorGlobal.onde})`);
// O RODAPÉ TEM DE GRITAR QUE A RODADA FOI PARCIAL. Sem isto, quem rodar duas telas para
// iterar num defeito lê "tudo certo" e acha que a suíte passou inteira — que é
// exatamente o que o contorno de cortar a lista à mão já fazia, só que agora sem deixar
// rastro no diff. Um teste que não diz o que NÃO mediu mente por omissão.
console.log(falhas ? `\n${falhas} falha(s)`
  : PARCIAL ? `\ntudo certo — RODADA PARCIAL: ${TELAS_ESCOLHIDAS.length}/${TELAS.length} telas` +
              ` × ${CASOS_ESCOLHIDOS.length}/${CASOS.length} cenas`
            : '\ntudo certo');
process.exit(falhas ? 1 : 0);
