// O QUE DÁ PARA CONFERIR DA FASE 5 SEM CELULAR E SEM ANDROID.
//
//   npm run twa
//
// Por que esta suíte existe. O único teste que PROVA o TWA é abrir o aplicativo no celular
// e ver que não há barra de URL — o Android decide isso em tempo de execução, buscando o
// `assetlinks.json` no domínio. Nenhum script substitui aquilo.
//
// O que um script substitui é a viagem até lá com um erro bobo: a pasta que o Jekyll comeu,
// o `content-type` errado, o fingerprint de modelo esquecido, o `package_name` que não bate.
// Cada um desses custa uma reinstalação no celular para descobrir, e todos são visíveis daqui.
//
// Enquanto a user page não existir, esta suíte NÃO REPROVA: ela diz o que falta e sai com
// zero. É a diferença entre "ainda não foi feito" e "foi feito errado" — reprovar o primeiro
// caso deixaria a suíte vermelha por meses e ninguém olharia mais para ela.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ORIGEM = 'https://ricardocolombo01.github.io';
const LINKS = `${ORIGEM}/.well-known/assetlinks.json`;

let falhas = 0, avisos = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };
const falta = msg => { console.log('  … ' + msg); avisos++; };

// `https.get` E NÃO `fetch`, e a razão é um defeito que quase passou batido.
//
// Com `fetch`, o Node 24 no Windows imprime
// `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c` depois do
// relatório — e aquilo **aborta o processo**: o código de saída vira 127 com a suíte tendo
// passado. Uma suíte que sai 127 sempre é uma suíte que reprova sempre, e dentro do `npm`
// ela derrubaria tudo o que viesse depois dela.
//
// Cheguei a escrever aqui que "o código de saída está certo" e a tratar o ruído como
// cosmético. Não estava e não era: medir os DOIS casos — passando e reprovando — deu 127
// nos dois. É a regra da casa cobrando de quem a estava escrevendo, e a lição é a de sempre
// neste arquivo: *afirmação não medida é palpite, inclusive a minha*.
//
// `https.get` não passa pelo dispatcher global do `fetch` e sai limpo.
import https from 'node:https';

const buscar = (url, ms = 20000) => new Promise(resolve => {
  const req = https.get(url, res => {
    let texto = '';
    res.setEncoding('utf8');
    res.on('data', p => { texto += p; });
    res.on('end', () => resolve({
      estado: res.statusCode,
      tipo: res.headers['content-type'] || '',
      texto,
    }));
  });
  req.setTimeout(ms, () => { req.destroy(); resolve({ estado: 0, erro: `sem resposta em ${ms} ms` }); });
  req.on('error', e => resolve({ estado: 0, erro: e.message }));
});

// ─── 1. o que está no repositório, e vale mesmo offline ──────────────────────
console.log('o que esta pasta prepara');
const local = path.join(RAIZ, 'twa', 'user-page');
ok(fs.existsSync(path.join(local, '.nojekyll')),
  'falta o .nojekyll em twa/user-page — sem ele o Jekyll come o .well-known/ EM SILÊNCIO');
const modeloArq = path.join(local, '.well-known', 'assetlinks.json');
ok(fs.existsSync(modeloArq), 'falta twa/user-page/.well-known/assetlinks.json');

let modelo = null;
if (fs.existsSync(modeloArq)) {
  try { modelo = JSON.parse(fs.readFileSync(modeloArq, 'utf8')); }
  catch (e) { ok(false, `o assetlinks.json modelo não é JSON válido: ${e.message}`); }
}
if (modelo) {
  ok(Array.isArray(modelo) && modelo.length > 0, 'o assetlinks tem de ser um ARRAY de declarações');
  const alvo = (modelo[0] || {}).target || {};
  ok((modelo[0] || {}).relation?.includes('delegate_permission/common.handle_all_urls'),
    'falta a relation `delegate_permission/common.handle_all_urls` — é ela que autoriza o app');
  ok(alvo.namespace === 'android_app', `namespace devia ser "android_app" e é "${alvo.namespace}"`);
  ok(typeof alvo.package_name === 'string' && alvo.package_name.includes('.'),
    `package_name inválido: "${alvo.package_name}"`);
  ok(Array.isArray(alvo.sha256_cert_fingerprints) && alvo.sha256_cert_fingerprints.length > 0,
    'falta sha256_cert_fingerprints');
  console.log(`  modelo pronto · package ${alvo.package_name}`);
}

// A KEYSTORE NÃO PODE SER COMMITADA, e a asserção é barata. Ela é a identidade permanente
// do aplicativo: vazou, qualquer um publica atualização em seu nome.
const ignora = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
ok(/\*\.keystore/.test(ignora) && /\*\.jks/.test(ignora),
  'o .gitignore precisa recusar *.keystore e *.jks — chave de assinatura não vai para o repositório');
const perdidas = fs.readdirSync(RAIZ).filter(f => /\.(keystore|jks)$/.test(f));
ok(perdidas.length === 0, `há chave de assinatura na raiz do repositório: ${perdidas.join(', ')}`);

// Se o Bubblewrap já rodou, o package_name dos dois arquivos tem de bater — senão o Android
// busca a declaração de um pacote que não é o que está instalado, e a barra de URL fica.
const manifestoTwa = path.join(RAIZ, 'twa', 'twa-manifest.json');
if (fs.existsSync(manifestoTwa) && modelo) {
  const t = JSON.parse(fs.readFileSync(manifestoTwa, 'utf8'));
  ok(t.packageId === modelo[0].target.package_name,
    `o twa-manifest diz "${t.packageId}" e o assetlinks diz "${modelo[0].target.package_name}" — têm de ser iguais`);
  console.log(`  twa-manifest.json presente · ${t.packageId}`);
}

// ─── 2. o que está NO AR ─────────────────────────────────────────────────────
console.log('\na user page');
const raiz = await buscar(ORIGEM + '/');
if (raiz.estado === 404 || raiz.estado === 0) {
  falta(`${ORIGEM}/ ainda não existe (${raiz.estado || raiz.erro}).`);
  falta('É o único bloqueio da Fase 5, e é conta e não código — ver twa/LEIA.md.');
  console.log(falhas ? `\n${falhas} FALHA(S)` : `\nnada errado — ${avisos} passo(s) ainda por fazer`);
  process.exit(falhas ? 1 : 0);
}
ok(raiz.estado === 200, `a user page respondeu ${raiz.estado}`);
console.log(`  ${ORIGEM}/ → ${raiz.estado}`);

const links = await buscar(LINKS);
ok(links.estado === 200,
  `${LINKS} respondeu ${links.estado || links.erro}. Se for 404 com a página no ar, ` +
  `o suspeito é o .nojekyll: o Jekyll ignora pasta que começa com ponto`);

if (links.estado === 200) {
  // O Android é exigente com o content-type; um `text/html` aqui é recusa silenciosa.
  ok(/json/.test(links.tipo), `o content-type é "${links.tipo}" e precisa ser de JSON`);
  let servido = null;
  try { servido = JSON.parse(links.texto); }
  catch (e) { ok(false, `o assetlinks servido não é JSON válido: ${e.message}`); }

  if (servido) {
    const fp = (((servido[0] || {}).target || {}).sha256_cert_fingerprints || [])[0] || '';
    ok(fp !== '__SHA256__',
      'o assetlinks NO AR ainda tem o fingerprint de modelo (__SHA256__) — o app vai abrir com barra de URL');
    ok(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(fp) || fp === '__SHA256__',
      `o fingerprint não tem a forma de um SHA-256 do keytool (32 pares em hex): "${fp.slice(0, 40)}…"`);
    if (modelo && fp !== '__SHA256__') {
      ok(servido[0].target.package_name === modelo[0].target.package_name,
        `o package_name no ar (${servido[0].target.package_name}) não é o do repositório ` +
        `(${modelo[0].target.package_name})`);
    }
    console.log(`  assetlinks no ar · package ${((servido[0] || {}).target || {}).package_name}` +
      ` · fingerprint ${fp === '__SHA256__' ? 'AINDA É O MODELO' : fp.slice(0, 17) + '…'}`);
  }
}

// A última milha, que só o celular responde.
console.log('\n  E O TESTE QUE ESTE SCRIPT NÃO FAZ: instalar o .apk e abrir.');
console.log('  Sem barra de URL no topo = o assetlinks está certo. Com barra, não está.');

console.log(falhas ? `\n${falhas} FALHA(S)` : (avisos ? `\nnada errado — ${avisos} passo(s) ainda por fazer` : '\ntudo certo'));
process.exit(falhas ? 1 : 0);
