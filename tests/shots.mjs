// Abre o jogo de verdade no Chrome instalado (headless), monta cenas específicas,
// fotografa e reprova se o console acusar erro. A suíte em Node valida a lógica;
// só isto aqui enxerga textura, enquadramento e "está feio".
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOGO = 'file:///' + path.join(import.meta.dirname, '..', 'index.html').split(path.sep).join('/');
const DIR = path.join(import.meta.dirname, 'shots');

const TELAS = {
  wide: { width: 1600, height: 900 },
  // Celular de verdade, não uma janela alta: 900×1250 tem aspect 0.72 e nunca chegou a
  // exercitar o enquadramento de retrato, que é onde o jogo quebrava.
  retrato: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

// Roda a partida no piloto automático: o mesmo aplicarIntencao das jogadas de verdade.
const AUTO = `
  const auto = (n) => {
    const j = window.__jogo;
    for (let i = 0; i < n; i++) {
      const P = j.P;
      if (!P || P.fase !== 'mao') break;
      j.aplicarIntencao(P.vez, j.jogadaDoBot(P, P.vez));
    }
  };
  // O localStorage é do file:// inteiro: uma cena que liga a contagem contamina as
  // seguintes, e a foto sai mentindo. Cada cena diz o que quer.
  const contar = (ligado) => {
    const b = document.getElementById('btContagem');
    if (b.classList.contains('on') !== ligado) b.click();
  };
  // A partida agora fica guardada, e pelo mesmo motivo do contar(): uma cena que jogou
  // deixa "Continuar a partida de antes" aparecendo na foto do menu da cena seguinte.
  const semGuardado = () => {
    try { localStorage.removeItem('dominobar.partida'); } catch (e) { void e; }
    window.__jogo.atualizarBotaoRetomar();
  };
  const soBots = (n) => {
    const j = window.__jogo;
    j.MESA.n = n;
    for (let i = 1; i < 4; i++) { j.MESA.cadeiras[i].tipo = 'bot'; j.MESA.cadeiras[i].nivel = 'normal'; }
    j.comecarLocal();
  };
  // Deixa todo mundo a um ponto do alvo e joga até a partida fechar. É a mão em que
  // fecharMao põe fase='fim' direto — o caso em que a tela dos pontos era pulada.
  const ateODecisivo = (n) => {
    const j = window.__jogo;
    soBots(n);
    const quase = () => j.P.placar.forEach((_, i) => { j.P.placar[i] = j.P.regras.alvo - 1; });
    quase();
    for (let i = 0; i < 600 && j.P.fase !== 'fim'; i++) {
      if (j.P.fase === 'fimDeMao') { quase(); document.getElementById('btProxima').click(); continue; }
      auto(1);
    }
  };
`;

const CENAS = [
  { nome: 'menu', telas: ['wide', 'retrato'], montar: `semGuardado(); window.__jogo.mostrarTela('telaMenu');` },
  // O menu de quem tem partida por terminar: é o botão a mais, e ele é verde para não
  // competir com o âmbar do "Sentar e jogar".
  {
    nome: 'menu-com-partida-guardada', telas: ['wide'],
    montar: `soBots(3); auto(9); window.__jogo.mostrarTela('telaMenu');`,
  },
  { nome: 'inicio-3', telas: ['wide'], montar: `soBots(3); contar(false); auto(2);` },
  { nome: 'meio-de-mao', telas: ['wide', 'retrato'], montar: `soBots(3); contar(false); auto(9);` },
  { nome: 'duplas-4', telas: ['wide'], montar: `soBots(4); contar(false); auto(13);` },
  {
    nome: 'tabuleiro-dobrado', telas: ['wide'],
    montar: `soBots(2); contar(false);
      // Joga até a linha ficar longa o bastante para dobrar na borda da mesa — e
      // RECOMEÇA se a mão acabar antes. Sem isto a foto virava a tela de fim de mão:
      // desde que o bot ficou bom (v1.4.0), ele fecha antes de a linha chegar a 14.
      for (let i = 0; i < 400 && window.__jogo.P.linha.length < 14; i++) {
        if (window.__jogo.P.fase !== 'mao') soBots(2); else auto(1);
      }`,
  },
  // Procura na SUA vez uma peça que sirva em exatamente `quantas` pontas e a seleciona,
  // que é o mesmo que o seu clique faz: levanta a peça, põe o fantasma e abre a barra.
  ...[['confirmar-uma-ponta', '=== 1'], ['confirmar-duas-pontas', '> 1']].map(([nome, teste]) => ({
    nome, telas: ['wide'],
    montar: `soBots(3);
      for (let i = 0; i < 400; i++) {
        const v = window.__jogo.vista;
        if (v && v.vez === v.cadeira && v.fase === 'mao') {
          const conta = {};
          v.acoes.jogadas.forEach(j => { const k = j.peca.join('|'); conta[k] = (conta[k]||0)+1; });
          const achou = v.mao.findIndex(p => conta[p.join('|')] ${teste});
          if (achou >= 0 && v.linha.length >= 3) { window.__jogo.selecionar(v.mao[achou]); break; }
        }
        auto(1);
        if (window.__jogo.P.fase !== 'mao') soBots(3);
      }`,
  })),
  // Os modos novos: 14 peças na mão (duas fileiras) e o trio sem a bucha de zero.
  { nome: 'duelo-14', telas: ['wide', 'retrato'], montar: `window.__jogo.MESA.modo = 'duelo'; soBots(2); auto(3);` },
  { nome: 'trio-9', telas: ['wide'], montar: `window.__jogo.MESA.modo = 'trio'; soBots(3); auto(5);` },
  // Mesa de 4 com a linha comprida: o pior caso do enquadramento em pé.
  { nome: 'mesa-cheia', telas: ['retrato'], montar: `soBots(4); for (let i = 0; i < 200 && window.__jogo.P.linha.length < 13; i++) auto(1);` },
  // As ajudas de mesa: contagem ligada e a mão arrumada por naipe.
  {
    nome: 'contando', telas: ['wide', 'retrato'],
    montar: `soBots(3); auto(11); contar(true);`,
  },
  {
    nome: 'mao-arrumada', telas: ['wide'],
    montar: `soBots(3); contar(false); auto(6); window.__jogo.arrumarMao();`,
  },
  // A peça que ACABOU de cair: acesa, com a marca no tampo. A foto é tirada 700ms
  // depois de montar, e o clarão dura 500 — então aqui se vê a marca, não o clarão.
  { nome: 'ultima-jogada', telas: ['wide', 'retrato'], montar: `soBots(4); contar(false); auto(9);` },
  { nome: 'fim-de-mao', telas: ['wide'], montar: `soBots(3); auto(400);` },
  // Em duplas, porque é onde o "sobrou na mão" precisa mostrar o subtotal do time.
  { nome: 'fim-de-mao-decisivo', telas: ['wide'], montar: `ateODecisivo(4);` },
  {
    nome: 'fim-de-partida', telas: ['wide'],
    montar: `ateODecisivo(4); document.getElementById('btProxima').click();`,
  },
];

fs.mkdirSync(DIR, { recursive: true });
for (const f of fs.readdirSync(DIR)) fs.unlinkSync(path.join(DIR, f));

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',      // WebGL por software quando não há GPU
    '--use-angle=swiftshader',
    '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files',
  ],
});

const problemas = [];
const offline = [];
let fotos = 0;

for (const cena of CENAS) {
  for (const tela of cena.telas) {
    const pagina = await navegador.newPage();
    await pagina.setViewport(TELAS[tela]);
    const daPagina = [];
    pagina.on('console', m => { if (m.type() === 'error') daPagina.push('console: ' + m.text()); });
    pagina.on('pageerror', e => daPagina.push('exceção: ' + e.message));
    pagina.on('requestfailed', r => {
      const erro = (r.failure() && r.failure().errorText) || '';
      const linha = 'rede: ' + r.url().slice(0, 80) + ' — ' + erro;
      /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(erro)
        ? offline.push(linha) : daPagina.push(linha);
    });
    pagina.on('response', r => {
      if (r.status() >= 400) daPagina.push(`http ${r.status()}: ${r.url().slice(0, 80)}`);
    });

    await pagina.goto(JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
    await pagina.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000 })
      .catch(() => daPagina.push('o jogo não inicializou (window.__jogo nunca apareceu)'));

    if (await pagina.evaluate(() => !!window.__jogo)) {
      await pagina.evaluate(AUTO + cena.montar);
      // Deixa as peças chegarem no lugar: a animação é interpolada, não instantânea.
      await pagina.evaluate(() => new Promise(r => setTimeout(r, 700)));
    }

    await pagina.screenshot({ path: path.join(DIR, `${cena.nome}-${tela}.png`) });
    fotos++;
    if (daPagina.length) problemas.push(`[${cena.nome}/${tela}]\n   ` + daPagina.join('\n   '));
    await pagina.close();
  }
}

await navegador.close();

console.log(`${fotos} fotos em tests/shots/`);
if (offline.length) console.log(`\nAVISO: ${offline.length} requisições não saíram (rede indisponível).`);
if (problemas.length) {
  console.log('\nPROBLEMAS DETECTADOS:\n' + problemas.join('\n'));
  process.exit(1);
}
console.log('nenhum erro de console, exceção ou requisição falha');
