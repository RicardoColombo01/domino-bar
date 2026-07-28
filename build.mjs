// Junta src/pagina.html + src/js/*.js num index.html autossuficiente.
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
import { execFileSync } from 'child_process';

const raiz = import.meta.dirname;
const DIR_JS = path.join(raiz, 'src', 'js');
const MOLDE = path.join(raiz, 'src', 'pagina.html');
const SAIDA = path.join(raiz, 'index.html');

const partes = fs.readdirSync(DIR_JS).filter(f => f.endsWith('.js')).sort();
if (!partes.length) throw new Error('nenhum arquivo em src/js/');

const ler = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const corpo = partes.map(f => {
  // o cabeçalho de cada fonte vira o separador aqui, para não duplicar
  const txt = ler(path.join(DIR_JS, f)).replace(/^\/\/ [^\n]*\n\/\/ \(parte de[^\n]*\n+/, '');
  return `/* ····· ${f} ····· */\n${txt.trim()}`;
}).join('\n\n');

const aviso = '/* GERADO por build.mjs a partir de src/ — não edite este bloco à mão. */';
const html = ler(MOLDE).replace('__JOGO__', `${aviso}\n${corpo}`);

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

if (process.argv.includes('--check')) {
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
  if (atual !== html) {
    console.error('index.html está desatualizado em relação a src/ — rode `npm run build`.');
    process.exit(1);
  }
  console.log('index.html está em dia com src/');
} else {
  fs.writeFileSync(SAIDA, html);
  const linhas = html.split('\n').length;
  console.log(`index.html gerado de ${partes.length} arquivos (${linhas} linhas)`);
}
