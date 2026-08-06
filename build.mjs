// Junta src/pagina.html + src/css/estilo.css + src/js/**/*.js num index.html AUTOSSUFICIENTE.
//
// Por que existe: o jogo precisa continuar abrindo por duplo-clique, e navegadores
// bloqueiam `<script type="module" src="...">` em file:// por CORS. Ou seja, o código
// TEM de chegar embutido na página. Este passo permite escrever em arquivos curtos e
// mesmo assim entregar um arquivo só.
//
// Os arquivos de src/js/ são pedaços do MESMO módulo, na ordem do número no nome —
// eles compartilham escopo, então não têm import/export entre si.
//
//   node build.mjs          (ou: npm run build)
//   node build.mjs --check  só confere se o index.html está em dia
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const raiz = import.meta.dirname;
const DIR_JS = path.join(raiz, 'src', 'js');
const MOLDE = path.join(raiz, 'src', 'pagina.html');
const CSS = path.join(raiz, 'src', 'css', 'estilo.css');
const SAIDA = path.join(raiz, 'index.html');
const MOLDE_SW = path.join(raiz, 'src', 'sw.js');
const SAIDA_SW = path.join(raiz, 'sw.js');

// As fontes vivem em PASTAS POR DONO (`10-casa/`, `30-domino/`, e amanhã `40-truco/`), mas
// a ORDEM continua saindo do NÚMERO do arquivo — nunca do caminho. Isso não é preferência
// de estilo, é o invariante 1 sobrevivendo à mudança de pastas:
//
// `140-menu.js` (casa) chama `mesaLembrada()` no TOPO do módulo, e ela valida o nível de bot
// contra a tabela `NIVEIS`, que mora em `050-bot.js` (dominó). Ordenando por CAMINHO, toda a
// `10-casa/` viria antes de toda a `30-domino/`, o `NIVEIS` estaria na zona morta e a linha
// estouraria com ReferenceError na carga — tela preta, e do tipo que não depende de dado
// guardado nenhum para acontecer.
//
// Ou seja: a pasta organiza para quem LÊ, e o número manda em quem EXECUTA. Um arquivo novo
// escolhe o número pela dependência de carga, não pela pasta em que cai.
const numeroDe = f => {
  const m = path.basename(f).match(/^(\d+)-/);
  if (!m) throw new Error(`fonte sem número no nome: ${f} — é o número que dá a ordem`);
  return Number(m[1]);
};

const varrer = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const cheio = path.join(dir, e.name);
  return e.isDirectory() ? varrer(cheio) : (e.name.endsWith('.js') ? [cheio] : []);
});

const partes = varrer(DIR_JS).sort((a, b) => numeroDe(a) - numeroDe(b));
if (!partes.length) throw new Error('nenhum arquivo em src/js/');

// Dois arquivos com o mesmo número deixariam a ordem ao acaso do sistema de arquivos, e o
// sintoma seria uma tela preta que vai e volta conforme a máquina. Estoura aqui em vez disso.
partes.forEach((f, i) => {
  if (i && numeroDe(f) === numeroDe(partes[i - 1]))
    throw new Error(`número repetido: ${path.relative(DIR_JS, partes[i - 1])} e ${path.relative(DIR_JS, f)}`);
});

const ler = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ─── nome de topo repetido entre arquivos ────────────────────────────────────
// O escopo é UM SÓ, então dois arquivos que declaram o mesmo nome estão brigando pela
// mesma gaveta. Isto passa a ser reprovado aqui porque a linguagem só reclama de PARTE
// dos casos, e a parte de que ela não reclama é a perigosa:
//
//   const naMao … const naMao   → SyntaxError, o `node --check` abaixo já pega
//   function f() … function f() → SILENCIOSO: a segunda vence, e some uma implementação
//   var x … var x               → SILENCIOSO: viram a mesma variável
//
// Ou seja, o risco real de um segundo jogo (`40-truco/`) não é o que estava anotado — é
// `function` e `var`. Vinte linhas aqui fecham a família inteira e devolvem o nome do
// culpado e os dois donos, que é o que faltava para o erro ser diagnosticável.
//
// Só olha a COLUNA 0, que é onde mora declaração de topo neste projeto. Nome dentro de
// função é escopo de função e não colide com nada.
const declaracoesDeTopo = fonte => {
  const nomes = new Set();
  const anotar = n => { if (/^[A-Za-z_$][\w$]*$/.test(n)) nomes.add(n); };
  for (const m of fonte.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) anotar(m[1]);
  for (const m of fonte.matchAll(/^class\s+([A-Za-z_$][\w$]*)/gm)) anotar(m[1]);
  for (const m of fonte.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) anotar(m[1]);
  // desestruturação: `const { a, b: c } = …` e `const [ a, b ] = …`
  for (const m of fonte.matchAll(/^(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/gm))
    m[1].split(',').forEach(p => anotar(p.split(':').pop().split('=')[0].trim()));
  return nomes;
};

const donoDoNome = new Map();
const brigas = [];
for (const f of partes) {
  const curto = path.relative(DIR_JS, f).split(path.sep).join('/');
  for (const n of declaracoesDeTopo(ler(f))) {
    if (donoDoNome.has(n)) brigas.push(`  ${n} — ${donoDoNome.get(n)} e ${curto}`);
    else donoDoNome.set(n, curto);
  }
}
if (brigas.length)
  throw new Error(`nome de topo declarado em dois arquivos (o escopo é um só):\n${brigas.join('\n')}`);

const corpo = partes.map(f => {
  // o cabeçalho de cada fonte vira o separador aqui, para não duplicar
  const txt = ler(f).replace(/^\/\/ [^\n]*\n\/\/ \(parte de[^\n]*\n+/, '');
  // O separador leva o CAMINHO agora, que é o que diz de quem é o pedaço — e é o único
  // lugar em que a reorganização aparece no bundle gerado.
  return `/* ····· ${path.relative(DIR_JS, f).split(path.sep).join('/')} ····· */\n${txt.trim()}`;
}).join('\n\n');

// O CSS ENTRA NO BUNDLE, e com isso a palavra "autossuficiente" da primeira linha deste
// arquivo deixa de ser mentira. Ela era falsa desde sempre — em três arquivos de uma vez
// (aqui, no README e no CLAUDE.md): o `index.html` carregava `css/estilo.css` por `<link>`,
// então o duplo-clique dependia de um segundo arquivo estar do lado.
//
// Resolve quatro coisas de uma vez: a promessa vira verdade, a fonte do CSS passa a morar
// em `src/` junto com o resto, cai uma requisição HTTP, e o service worker do PWA passará a
// ter um arquivo local a cachear em vez de dois.
const estilo = fs.readFileSync(CSS, 'utf8').replace(/\r\n/g, '\n');

const aviso = '/* GERADO por build.mjs a partir de src/ — não edite este bloco à mão. */';
const html = ler(MOLDE)
  .replace('__ESTILO__', `<style>\n${aviso}\n${estilo.trim()}\n</style>`)
  .replace('__JOGO__', `${aviso}\n${corpo}`);

// Marcador que não foi trocado é fonte editada à mão sem o build acompanhar, e o sintoma
// seria a página mostrar `__ESTILO__` como texto. Barato conferir, caro descobrir depois.
for (const marca of ['__ESTILO__', '__JOGO__'])
  if (html.includes(marca)) throw new Error(`${marca} sobrou no molde — src/pagina.html mudou de forma?`);

// Conferência de sintaxe antes de escrever: um erro aqui viraria tela preta no navegador.
const tmp = path.join(raiz, '.build-check.mjs');
fs.writeFileSync(tmp, corpo);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  fs.unlinkSync(tmp);
  console.error('ERRO de sintaxe no código montado:\n' + (e.stderr || e.stdout || e.message));
  process.exit(1);
} finally {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
}

// ─── o service worker, com a versão amarrada ao bundle ───────────────────────
// O nome do cache é um resumo do `index.html` publicado. Cache de service worker que não
// troca de nome é o defeito mais cruel desta família: o jogador fica preso numa versão
// antiga para sempre. Amarrando o nome ao conteúdo, publicar correção JÁ é publicar cache
// novo — e "esquecer de bumpar a versão" deixa de ser uma coisa que existe.
const moldeSW = ler(MOLDE_SW);
// O resumo cobre o index.html E O PRÓPRIO MOLDE DO WORKER, e a segunda metade veio de uma
// auditoria: mudando só a estratégia de cache, o `index.html` fica igual, o nome do cache
// não troca, e a lógica nova passa a mandar num cache montado pela lógica velha. Não há
// auto-referência aqui — o resumo é do MOLDE (`src/sw.js`), que não contém o resumo; quem o
// contém é o `sw.js` gerado.
const versao = crypto.createHash('sha256').update(html).update(moldeSW).digest('hex').slice(0, 12);
// EXIGE UMA ocorrência, e o motivo é uma cicatriz: `String.replace` troca a PRIMEIRA, e
// bastou o marcador aparecer também num comentário para o comentário ficar com o resumo e o
// `const VERSAO` ficar com o marcador — cache chamado `dominobar-__VERSAO__`, o mesmo nome
// para sempre, que é exatamente o defeito que este mecanismo existe para impedir. Contar
// antes de trocar é a mesma disciplina que este projeto já exige das mutações de teste.
const quantos = moldeSW.split('__VERSAO__').length - 1;
if (quantos !== 1)
  throw new Error(`src/sw.js tem ${quantos} marcadores __VERSAO__ e precisa de exatamente 1`);
const sw = moldeSW.replace('__VERSAO__', versao);

const saidas = [[SAIDA, html, 'index.html'], [SAIDA_SW, sw, 'sw.js']];

if (process.argv.includes('--check')) {
  const velhos = saidas.filter(([arq, novo]) =>
    (fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : '') !== novo);
  if (velhos.length) {
    console.error(`${velhos.map(s => s[2]).join(' e ')} desatualizado em relação a src/ — rode \`npm run build\`.`);
    process.exit(1);
  }
  console.log('index.html e sw.js estão em dia com src/');
} else {
  saidas.forEach(([arq, txt]) => fs.writeFileSync(arq, txt));
  const linhas = html.split('\n').length;
  console.log(`index.html gerado de ${partes.length} arquivos (${linhas} linhas) · sw.js versão ${versao}`);
}
