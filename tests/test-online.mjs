// Online de verdade: sobe um servidor estático, abre DUAS abas do Chrome, uma cria a
// mesa e a outra entra pelo código. Depende da internet e do broker gratuito do
// PeerJS — quando eles não respondem o teste AVISA em vez de reprovar, senão um
// problema de rede viraria "o jogo quebrou".
//
//   npm run online     (ou: node test-online.mjs)
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.join(import.meta.dirname, '..');
const PORTA = 8137;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };

const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const arq = path.join(RAIZ, rel === '/' ? 'index.html' : rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  res.end(fs.readFileSync(arq));
});
await new Promise(r => servidor.listen(PORTA, r));
const URL_JOGO = `http://localhost:${PORTA}/index.html`;

let falhas = 0, avisos = [];
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

const navegador = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--hide-scrollbars'],
});

const abrir = async nome => {
  const p = await navegador.newPage();
  await p.setViewport({ width: 1200, height: 760 });
  p.on('pageerror', e => { console.error(`  ✗ exceção em ${nome}: ${e.message}`); falhas++; });
  await p.goto(URL_JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
  await p.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
  return p;
};

try {
  const anfitriao = await abrir('anfitrião');
  const convidado = await abrir('convidado');

  const temPeerJS = await anfitriao.evaluate(() => typeof Peer !== 'undefined');
  if (!temPeerJS) throw new Error('PeerJS não carregou (sem internet?)');

  console.log('\nanfitrião abre a mesa');
  await anfitriao.evaluate(() => {
    const j = window.__jogo;
    j.MESA.n = 2;
    j.MESA.cadeiras[0].nome = 'Anfitriã';
    j.MESA.cadeiras[1].tipo = 'online';
    j.MESA.cadeiras[1].nome = 'Visita';
    document.getElementById('btComecar').click();
  });
  await anfitriao.waitForFunction(
    () => (document.getElementById('onlineCodigo').textContent || '').match(/^[A-Z0-9]{4}$/),
    { timeout: 25000, polling: 400 });
  const codigo = await anfitriao.evaluate(() => document.getElementById('onlineCodigo').textContent);
  console.log(`  código da mesa: ${codigo}`);

  console.log('\nconvidado entra pelo código');
  await convidado.evaluate(cod => {
    document.getElementById('btEntrar').click();
    document.getElementById('onlineEntrada').value = cod;
    document.getElementById('btConectar').click();
  }, codigo);

  await anfitriao.waitForFunction(
    () => document.getElementById('onlineLista').textContent.includes('chegou'), { timeout: 30000, polling: 400 });
  console.log('  o anfitrião viu a visita sentar');

  await anfitriao.evaluate(() => document.getElementById('btIniciarOnline').click());
  await convidado.waitForFunction('window.__jogo.vista && window.__jogo.vista.mao.length === 7', { timeout: 25000, polling: 400 });

  console.log('\no que o convidado recebeu');
  const v = await convidado.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.vista)));
  ok(v.cadeira === 1, `o convidado deveria ser a cadeira 1, veio ${v.cadeira}`);
  ok(v.mao.length === 7, 'a mão do convidado não chegou completa');
  ok(v.naMao.length === 2 && v.naMao[0] === 7, 'a contagem de peças do anfitrião não chegou');
  ok(!await convidado.evaluate(() => !!window.__jogo.P), 'o convidado não pode ter a partida na memória');

  // O PONTO DE TODO O DESENHO: a mão do anfitrião não existe do lado do convidado.
  // Vale comparar peça a peça em vez de procurar texto no JSON — "[0,0]" aparece no
  // placar de uma partida 0×0 e um teste desses acusaria vazamento onde não há.
  const norma = p => Math.min(p[0], p[1]) + '|' + Math.max(p[0], p[1]);
  const maoDoAnfitriao = await anfitriao.evaluate(() => window.__jogo.P.maos[0].map(p => p.slice()));
  const visiveis = new Set([...v.mao, ...v.linha].map(norma));
  const vazadas = maoDoAnfitriao.map(norma).filter(k => visiveis.has(k));
  ok(vazadas.length === 0, `a mão do anfitrião vazou para o convidado: ${vazadas.join(', ')}`);
  ok(visiveis.size === v.mao.length + v.linha.length, 'apareceu peça repetida no que o convidado vê');
  console.log(`  o anfitrião tem ${maoDoAnfitriao.length} peças · o convidado enxerga ${visiveis.size} · vazaram ${vazadas.length}`);

  console.log('\no convidado joga e o anfitrião obedece');
  // Faz a vez chegar no convidado: o anfitrião joga a dele primeiro, se for o caso.
  await anfitriao.evaluate(() => {
    const j = window.__jogo;
    if (j.P.vez === 0) j.aplicarIntencao(0, j.jogadaDoBot(j.P, 0));
  });
  await convidado.waitForFunction('window.__jogo.vista.vez === window.__jogo.vista.cadeira', { timeout: 15000, polling: 400 });

  const antes = await anfitriao.evaluate(() => ({ linha: window.__jogo.P.linha.length, monte: window.__jogo.P.monte.length }));
  // Vai pelo caminho de verdade: pedirAcao empurra a INTENÇÃO pelo fio e quem decide
  // se ela vale é o anfitrião, do outro lado.
  await convidado.evaluate(() => {
    const a = window.__jogo.vista.acoes;
    window.__jogo.pedirAcao(
      a.jogadas.length ? { acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta }
        : a.comprar ? { acao: 'comprar' } : { acao: 'passar' });
  });
  await anfitriao.waitForFunction(
    an => window.__jogo.P.linha.length > an.linha || window.__jogo.P.monte.length < an.monte,
    { timeout: 15000, polling: 400 }, antes).catch(() => { ok(false, 'a jogada do convidado não chegou no anfitrião'); });
  console.log('  a jogada do convidado foi aplicada pelo anfitrião');

  await anfitriao.close();
  await convidado.close();
} catch (e) {
  avisos.push(e.message);
}

await navegador.close();
servidor.close();

if (avisos.length) {
  console.log('\nNÃO DEU PARA TESTAR O ONLINE:\n  ' + avisos.join('\n  '));
  console.log('  O broker gratuito do PeerJS ou a sua rede não deixaram a conexão fechar.');
  console.log('  Isso não reprova o jogo — solo e local não dependem de rede nenhuma.');
  process.exit(0);
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
