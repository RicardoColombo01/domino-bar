// O JOGO COMO APLICATIVO: manifest, ícones e o service worker.
//
//   npm run app        (~30 s)
//
// Por que esta suíte existe. O `#semCarga` promete, em português, na tela do jogador:
// "depois de carregar uma vez, o jogo abre offline". Até agora isso dependia SÓ do cache
// HTTP, que o navegador esvazia quando quer — era promessa, não garantia. O service worker
// a torna verdadeira, e uma promessa sem asserção volta a ser promessa na primeira mexida.
//
// A asserção que vale por todas é a última: DESLIGA A REDE e recarrega. Se o jogo ficar
// pronto assim, o resto é detalhe.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.resolve(import.meta.dirname, '..');
const PORTA = 8124;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
};

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

// ─── o que dá para conferir sem navegador ────────────────────────────────────
console.log('o manifest e os ícones');
const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.webmanifest'), 'utf8'));

// CAMINHO RELATIVO NÃO É ESTILO: o jogo mora numa project page
// (`ricardocolombo01.github.io/domino-bar/`), e um `start_url` absoluto apontaria para a
// raiz do domínio — 404, e o aplicativo instalado abriria numa página que não existe.
for (const campo of ['start_url', 'scope'])
  ok(manifesto[campo].startsWith('./'), `${campo} tem de ser relativo (é "${manifesto[campo]}")`);

ok(manifesto.icons.length >= 2, 'o manifest precisa de pelo menos dois tamanhos de ícone');
// A instalação em Android EXIGE 192 e 512. Faltando um, o navegador simplesmente não
// oferece instalar — e não diz por quê, que é o que torna isto caro de descobrir depois.
for (const n of ['192x192', '512x512'])
  ok(manifesto.icons.some(i => i.sizes === n), `falta o ícone ${n}, e sem ele não dá para instalar`);
// MASKABLE é o que impede o sistema de recortar o ícone num círculo e comer as pintas.
ok(manifesto.icons.some(i => (i.purpose || '').includes('maskable')),
  'nenhum ícone é maskable — o Android recorta e come a peça');

// Ícone que o manifest promete e não existe é 404 na instalação, e ninguém olha o console
// da tela inicial do celular.
for (const i of manifesto.icons) {
  const arq = path.join(RAIZ, i.src);
  ok(fs.existsSync(arq), `o manifest aponta ${i.src} e o arquivo não existe`);
}
// OS ATALHOS, pela mesma razão do `start_url`: um atalho absoluto aponta para a raiz do
// domínio, que é 404 numa project page — e ele só é exercitado por quem segura o ícone na
// tela inicial, ou seja quase nunca. O ícone dele tem de existir pelo mesmo motivo do de
// cima. E o `url` tem de conter o `?jogo=`, senão o atalho é um segundo botão que faz
// exatamente o que o primeiro já fazia.
for (const a of manifesto.shortcuts || []) {
  ok(a.url.startsWith('./'), `o atalho "${a.name}" tem url absoluta ("${a.url}") — 404 numa project page`);
  ok(/\?jogo=/.test(a.url), `o atalho "${a.name}" não escolhe jogo nenhum: "${a.url}"`);
  for (const i of a.icons || [])
    ok(fs.existsSync(path.join(RAIZ, i.src)), `o atalho "${a.name}" aponta ${i.src} e o arquivo não existe`);
}
console.log(`  ${manifesto.icons.length} ícones declarados, todos em disco · start_url ${manifesto.start_url}` +
  ` · ${(manifesto.shortcuts || []).length} atalho(s)`);

// ─── a versão do cache acompanha o bundle ────────────────────────────────────
// Cache de service worker que não troca de nome é o defeito mais cruel desta família: o
// jogador fica preso numa versão antiga para sempre. Aqui se cobra o mecanismo que impede
// isso — o nome do cache é um resumo do index.html, então publicar correção JÁ é publicar
// cache novo, e "esquecer de bumpar" deixa de existir como categoria de erro.
console.log('\na versão do cache');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const versao = (sw.match(/const VERSAO = '([^']*)'/) || [])[1];
ok(versao && /^[a-f0-9]{12}$/.test(versao), `o sw.js não tem versão carimbada (achei "${versao}")`);
ok(!sw.includes('__VERSAO__'), 'o marcador __VERSAO__ sobrou no sw.js — o build não carimbou');

// Esta refaz a conta do build, e é de propósito que ela seja modesta sobre o que prova: o
// trabalho dela é pegar ARTEFATO VELHO — alguém que mexeu em `src/` e não rodou o build,
// e cujo `sw.js` publicado aponta para um cache que não corresponde ao que está no ar.
// Não é uma asserção sobre criptografia, é sobre frescor.
//
// O resumo cobre o index.html E o molde do worker: mudando só a estratégia de cache, o
// index.html fica igual, e sem a segunda metade o nome do cache não trocaria — a lógica
// nova mandaria num cache montado pela lógica velha.
const crypto = await import('node:crypto');
const semFimDeLinha = f => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const esperada = crypto.createHash('sha256')
  .update(semFimDeLinha('index.html')).update(semFimDeLinha('src/sw.js')).digest('hex').slice(0, 12);
ok(versao === esperada,
  `a versão do sw.js (${versao}) não corresponde ao que está publicado (${esperada}) — rode npm run build`);
console.log(`  cache dominobar-${versao}, amarrado ao index.html + src/sw.js`);

// ─── e agora o navegador ─────────────────────────────────────────────────────
const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const arq = path.join(RAIZ, rel === '/' ? 'index.html' : rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  // SIMULA UMA PUBLICAÇÃO: quando `publicado` sobe, o servidor passa a entregar um
  // index.html e um sw.js diferentes — que é exatamente o que uma release faz, já que o
  // nome do cache dentro do sw.js é um resumo do index.html.
  let corpo = fs.readFileSync(arq);
  if (publicado > 1 && /index\.html$/.test(arq))
    corpo = Buffer.from(String(corpo).replace('<title>', `<title>v${publicado} `));
  if (publicado > 1 && /sw\.js$/.test(arq))
    corpo = Buffer.from(String(corpo).replace(/const VERSAO = '([^']*)'/, `const VERSAO = 'v${publicado}$1'`));
  res.end(corpo);
});
let publicado = 1;
await new Promise(r => servidor.listen(PORTA, r));

const nav = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio'],
});
const pag = await nav.newPage();
const URL_JOGO = `http://localhost:${PORTA}/index.html`;
const pronto = (prazo = 30000) =>
  pag.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: prazo, polling: 300 });

try {
  console.log('\no service worker assume a página');
  await pag.goto(URL_JOGO, { waitUntil: 'networkidle2', timeout: 45000 });
  await pronto();

  // O worker só passa a INTERCEPTAR na carga seguinte à instalação. É por isso que a
  // primeira visita não enche o cache das bibliotecas: quem as busca é a página, e naquele
  // momento ainda não há ninguém no meio. A segunda carga é a que guarda — e é também a
  // razão de o `install` não baixar as bibliotecas por conta própria: seriam 763 KB
  // baixados DUAS vezes na visita em que o jogador está esperando para jogar.
  await pag.waitForFunction('navigator.serviceWorker.controller !== null || true', { timeout: 5000 });
  await pag.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  await pronto();

  const mandando = await pag.evaluate(() => !!navigator.serviceWorker.controller);
  ok(mandando, 'o service worker não assumiu a página nem depois de recarregar');

  const guardado = await pag.evaluate(async () => {
    const nomes = await caches.keys();
    const c = await caches.open(nomes[0]);
    return { caches: nomes, urls: (await c.keys()).map(r => r.url) };
  });
  ok(guardado.caches.length === 1,
    `devia haver UM cache e há ${guardado.caches.length}: ${guardado.caches.join(', ')}`);
  const tem = t => guardado.urls.some(u => u.includes(t));
  ok(tem('index.html'), 'o index.html não está no cache');
  ok(tem('three.module.min.js'), 'o three não está no cache — offline não abre');
  // ESTA nasceria VERMELHA sem o `crossorigin` no <script> do PeerJS: sem ele a resposta é
  // OPACA, o worker recusa guardar (não dá para conferir se deu certo), e o jogo abriria
  // offline SEM o online. O sintoma seria "o botão de mesa online sumiu depois que instalei".
  ok(tem('peerjs'), 'o peerjs não está no cache — offline abriria sem o online');
  console.log(`  ${guardado.urls.length} respostas guardadas em ${guardado.caches[0]}`);

  // ─── a asserção que vale por todas ─────────────────────────────────────────
  console.log('\ncom a rede desligada');
  await pag.setOfflineMode(true);
  await pag.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await pronto(20000);
  const offline = await pag.evaluate(() => ({
    pronto: !!(window.__jogo && window.__jogo.pronto),
    peer: typeof Peer !== 'undefined',
    // O #semCarga é o recado de "não carregou". Ele aparecendo aqui seria a contradição
    // exata desta suíte: o jogo pronto e a tela dizendo que não carregou.
    recado: !document.getElementById('semCarga').classList.contains('oculta'),
  }));
  ok(offline.pronto, 'o jogo NÃO abriu offline — é a promessa que o #semCarga faz na tela');
  ok(offline.peer, 'offline o PeerJS sumiu: dava para jogar, mas não dava para abrir mesa');
  ok(!offline.recado, 'o jogo abriu offline e mesmo assim mostrou o recado de "não carregou"');
  console.log('  o jogo abriu sem rede, com o PeerJS junto');
  await pag.setOfflineMode(false);

  // ─── a correção publicada chega NA PRIMEIRA visita ─────────────────────────
  // A ASSERÇÃO MAIS IMPORTANTE DESTA SUÍTE, e ela existe por causa de um dia perdido:
  // em 31/07/2026 o Ricardo testou o github.io e viu os mesmos defeitos que já estavam
  // consertados — o trabalho não tinha saído da máquina. O service worker abre uma
  // SEGUNDA porta para exatamente esse engano, e pior, uma que não se resolve com
  // `git push`: cache primeiro na PÁGINA faz a correção publicada só aparecer na
  // segunda visita, e quem testa vê o defeito que acabou de consertar.
  //
  // Por isso a página é rede-primeiro e o resto é cache-primeiro. Não é inconsistência:
  // as URLs do three e do peerjs têm a versão no caminho e são imutáveis — buscá-las de
  // novo nunca traria nada diferente. O index.html é o único arquivo que muda de conteúdo
  // sem mudar de nome, e é justamente por isso que ele não pode ser servido do cache
  // enquanto houver rede.
  console.log('\ndepois de publicar uma correção');
  publicado = 2;
  await pag.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  await pronto();
  const titulo = await pag.title();
  ok(/^v2 /.test(titulo),
    `a versão publicada NÃO chegou na primeira visita — a página ainda diz "${titulo}"`);
  console.log(`  a página recarregou já na versão nova: "${titulo}"`);

  // E o que a rede-primeiro NÃO pode custar: offline continua abrindo, agora servindo do
  // cache a última versão que chegou a ser baixada.
  await pag.setOfflineMode(true);
  await pag.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await pronto(20000);
  const depois = await pag.evaluate(() => ({ pronto: !!(window.__jogo && window.__jogo.pronto), t: document.title }));
  ok(depois.pronto, 'depois da atualização o jogo deixou de abrir offline');
  console.log(`  e offline continua abrindo, na versão guardada: "${depois.t}"`);
  await pag.setOfflineMode(false);
} finally {
  await nav.close();
  servidor.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
