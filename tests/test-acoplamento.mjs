// A CASA NÃO ALCANÇA NOME NENHUM DE JOGO. É o invariante que a Fase 1 da v4 comprou e que
// nenhuma linha de teste guardava — o número saía de uma ferramenta que vivia no scratchpad
// e sumiu com a sessão. Um invariante medido uma vez é uma fotografia; medido a cada `npm
// test` é uma trava.
//
// POR QUE ISTO PRECISA DE AST, e não de `grep`. Este repositório já registra que o `grep`
// mentiu aqui: `chave`, `valor` e `pontas` também são palavras portuguesas, e aparecem em
// comentário e em nome de parâmetro. E há o erro inverso, que é o caro:
//
//     JOGO.mesa.naMao      ← o CONTRATO. É assim que a casa deve falar.
//     naMao                ← o ACOPLAMENTO. É o que a Fase 1 gastou uma release tirando.
//
// As duas linhas têm o mesmo texto. Só quem entende acesso a propriedade as separa — e só
// quem entende ESCOPO sabe que um `const naMao = …` dentro de uma função da casa é uma
// terceira coisa, que não é acoplamento nenhum.
//
// O QUE ELE MEDE, exatamente: para cada arquivo de `10-casa/`, os identificadores que ele
// referencia e não declara em nenhum escopo interno — ou seja, os que ele espera achar no
// escopo concatenado. Se um deles for declarado no topo de um arquivo de jogo, é acoplamento.
//
// E O TEXTO CONTA JUNTO. `if (JOGO_ID === 'domino')` não alcança identificador nenhum e é
// exatamente o mesmo acoplamento — a casa decidindo por um jogo em particular. A primeira
// versão desta suíte media só identificadores e deixou passar um caso real (a migração das
// chaves guardadas). Hoje os literais e os pedaços de template entram na conta.
//
// E o inverso também é cobrado: um jogo não pode alcançar nome do outro. Hoje isso é de graça
// (o truco ainda não tem código), e é justamente por isso que a asserção entra agora — ela
// nasce guardando o dia em que deixar de ser.
//
// O QUE ELE NÃO VÊ, dito de frente para ninguém confiar demais: HTML e CSS. A Fase 2 achou
// doze linhas de regra de dominó dentro de `src/pagina.html` com esta suíte dizendo zero, e
// ela estava certa — a pergunta é que era estreita. Toda ferramenta de medição tem borda.

import fs from 'node:fs';
import path from 'node:path';

// `acorn` é a PRIMEIRA dependência nova desde o puppeteer, e `tests/node_modules` NÃO é
// compartilhado entre worktrees nem versionado. Quem clonar o repositório, ou quem já tiver
// um worktree aberto de antes desta release, roda `npm test` e leva um `ERR_MODULE_NOT_FOUND`
// cru do Node — que não diz o que fazer, e é a doença que esta casa passou quatro filas
// consertando. O import vira dinâmico só para poder explicar.
let acorn;
try {
  acorn = await import('acorn');
} catch (e) {
  void e;
  console.error('\n  ✗ falta o `acorn`, que esta suíte usa para ler o código.\n' +
    '    `tests/node_modules` não é compartilhado entre worktrees nem versionado:\n\n' +
    '        cd tests && npm install\n');
  process.exit(1);
}

const RAIZ = path.join(import.meta.dirname, '..', 'src', 'js');
const CASA = '10-casa';

let falhas = 0, asserçoes = 0;
function ok(cond, msg) {
  asserçoes++;
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) falhas++;
}

// ─── o analisador de escopo ──────────────────────────────────────────────────
// Os arquivos de `src/js` são pedaços do MESMO escopo (invariante 1), então "livre" aqui
// quer dizer "não declarado dentro deste arquivo, em nenhum bloco ou função" — é o que o
// arquivo espera que o vizinho concatenado tenha declarado.

// Os nomes que um padrão de desestruturação AMARRA. O que estiver do lado direito de um
// default (`{a = b}`) ou dentro de uma chave computada (`{[k]: v}`) NÃO é amarrado: é
// referência, e por isso volta em `refs` para ser visitado normalmente.
function amarrados(no, nomes, refs) {
  if (!no) return;
  switch (no.type) {
    case 'Identifier': nomes.push(no.name); break;
    case 'ObjectPattern':
      for (const p of no.properties) {
        if (p.type === 'RestElement') { amarrados(p.argument, nomes, refs); continue; }
        if (p.computed) refs.push(p.key);
        amarrados(p.value, nomes, refs);
      }
      break;
    case 'ArrayPattern': for (const e of no.elements) amarrados(e, nomes, refs); break;
    case 'RestElement': amarrados(no.argument, nomes, refs); break;
    case 'AssignmentPattern': amarrados(no.left, nomes, refs); refs.push(no.right); break;
    // `[a.b] = x` e `({p: o.q} = x)`: o alvo é uma propriedade, não um nome novo.
    case 'MemberExpression': refs.push(no); break;
  }
}

// Filhos de um nó, sem os campos de posição. É o andar genérico do visitador: os tipos que
// precisam de tratamento especial são interceptados antes de chegar aqui.
function* filhos(no) {
  for (const chave of Object.keys(no)) {
    if (chave === 'type' || chave === 'start' || chave === 'end' || chave === 'loc') continue;
    const v = no[chave];
    if (Array.isArray(v)) { for (const f of v) if (f && typeof f.type === 'string') yield f; }
    else if (v && typeof v.type === 'string') yield v;
  }
}

// As declarações que sobem para o topo de um escopo de FUNÇÃO (`var` e `function`) ou de um
// BLOCO (`let`, `const`, `class`, e `function` em bloco). Não atravessa fronteira de função:
// um `var` dentro de uma função aninhada é dela, não nossa.
function declaracoes(corpo, deFuncao) {
  const nomes = [], lixo = [];
  const desce = no => {
    if (!no) return;
    if (no.type === 'FunctionDeclaration') {
      if (no.id) nomes.push(no.id.name);
      return;                                   // o corpo é outro escopo
    }
    if (no.type === 'FunctionExpression' || no.type === 'ArrowFunctionExpression'
      || no.type === 'ClassDeclaration' || no.type === 'ClassExpression') {
      if (no.type === 'ClassDeclaration' && no.id && !deFuncao) nomes.push(no.id.name);
      return;
    }
    // `import * as THREE from 'three'` amarra `THREE` no topo. Só o 070-cena tem um, e é o
    // único `import` do projeto — o resto do escopo é concatenado, não importado.
    if (no.type === 'ImportDeclaration') {
      if (deFuncao) for (const e of no.specifiers) nomes.push(e.local.name);
      return;
    }
    if (no.type === 'VariableDeclaration') {
      const meu = deFuncao ? no.kind === 'var' : no.kind !== 'var';
      if (meu) for (const d of no.declarations) amarrados(d.id, nomes, lixo);
      if (deFuncao) for (const d of no.declarations) desce(d.init);
      return;
    }
    // num escopo de bloco só o nível de cima conta; num de função, `var` desce tudo
    if (!deFuncao && no.type === 'BlockStatement') return;
    for (const f of filhos(no)) desce(f);
  };
  for (const no of corpo) desce(no);
  return nomes;
}

// Devolve { topo, livres } — os nomes declarados no topo do arquivo, e os que ele espera do
// escopo concatenado, cada um com as linhas em que aparece.
function analisar(codigo) {
  // `module` e não `script`: o bundle é um `<script type="module">` — é o que permite o
  // `import` do three em 070-cena.js, e é o escopo real em que estes arquivos rodam.
  const ast = acorn.parse(codigo, { ecmaVersion: 2022, sourceType: 'module', locations: true });
  const topo = new Set(declaracoes(ast.body, true).concat(declaracoes(ast.body, false)));
  const livres = new Map();
  // O TEXTO TAMBÉM CONTA. `if (JOGO_ID === 'domino')` não alcança identificador nenhum e é
  // exatamente o mesmo acoplamento — a casa sabendo o nome de um jogo. A primeira versão
  // desta suíte não via isso, e havia um caso real no código.
  const textos = new Map();
  const anotarTexto = (valor, linha) => {
    if (typeof valor !== 'string' || !valor) return;
    if (!textos.has(valor)) textos.set(valor, []);
    textos.get(valor).push(linha);
  };

  const visitar = (no, pilha) => {
    if (!no) return;
    const ver = f => visitar(f, pilha);

    switch (no.type) {
      case 'Identifier': {
        if (pilha.some(e => e.has(no.name))) return;      // amarrado num escopo interno
        if (!livres.has(no.name)) livres.set(no.name, []);
        livres.get(no.name).push(no.loc.start.line);
        return;
      }
      // `a.b` é uma referência a `a` e NUNCA a `b` — a não ser que seja `a[b]`.
      case 'MemberExpression':
        ver(no.object);
        if (no.computed) ver(no.property);
        return;
      // `{ jogadaDoBot }` é atalho: chave e valor são o MESMO nó, e o valor É referência.
      // Visitar os dois contaria duas vezes; visitar só a chave não contaria nenhuma.
      case 'Property':
        if (no.computed) ver(no.key);
        ver(no.value);
        return;
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (no.computed) ver(no.key);
        ver(no.value);
        return;
      case 'Literal': anotarTexto(no.value, no.loc.start.line); return;
      case 'TemplateLiteral':
        // Os pedaços de texto de um template contam como texto; as expressões seguem sendo
        // visitadas normalmente. `\`${chave}.domino\`` tem de ser pego.
        for (const q of no.quasis) anotarTexto(q.value.cooked, q.loc.start.line);
        for (const e of no.expressions) ver(e);
        return;
      case 'ImportDeclaration': return;      // os especificadores são amarração, não uso
      case 'LabeledStatement': ver(no.body); return;
      case 'BreakStatement': case 'ContinueStatement': return;   // rótulo não é nome
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const meu = new Set();
        const refs = [];
        if (no.id && no.type !== 'FunctionDeclaration') meu.add(no.id.name);
        for (const p of no.params) { const n = []; amarrados(p, n, refs); n.forEach(x => meu.add(x)); }
        const dentro = [...pilha, meu];
        // os defaults dos parâmetros veem os parâmetros
        for (const r of refs) visitar(r, dentro);
        if (no.body.type === 'BlockStatement') {
          declaracoes(no.body.body, true).forEach(x => meu.add(x));
          declaracoes(no.body.body, false).forEach(x => meu.add(x));
          for (const s of no.body.body) visitar(s, dentro);
        } else visitar(no.body, dentro);
        return;
      }
      case 'BlockStatement': {
        const meu = new Set(declaracoes(no.body, false));
        const dentro = [...pilha, meu];
        for (const s of no.body) visitar(s, dentro);
        return;
      }
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const cabeca = no.init || no.left;
        const meu = new Set(cabeca && cabeca.type === 'VariableDeclaration'
          ? declaracoes([cabeca], false).concat(declaracoes([cabeca], true)) : []);
        const dentro = [...pilha, meu];
        for (const f of filhos(no)) visitar(f, dentro);
        return;
      }
      case 'CatchClause': {
        const nomes = [], refs = [];
        if (no.param) amarrados(no.param, nomes, refs);
        const dentro = [...pilha, new Set(nomes)];
        visitar(no.body, dentro);
        return;
      }
      case 'VariableDeclarator': {
        const nomes = [], refs = [];
        amarrados(no.id, nomes, refs);      // o id é AMARRAÇÃO, não referência
        for (const r of refs) ver(r);
        ver(no.init);
        return;
      }
      case 'ClassDeclaration': case 'ClassExpression':
        ver(no.superClass); ver(no.body); return;
      default:
        for (const f of filhos(no)) ver(f);
    }
  };

  for (const no of ast.body) visitar(no, []);
  return { topo, livres, textos };
}

// ─── a varredura ─────────────────────────────────────────────────────────────
const pastas = fs.readdirSync(RAIZ, { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name).sort();

const arquivos = new Map();   // pasta → [{ nome, topo, livres }]
for (const pasta of pastas) {
  const lista = [];
  for (const f of fs.readdirSync(path.join(RAIZ, pasta)).filter(f => f.endsWith('.js')).sort()) {
    const codigo = fs.readFileSync(path.join(RAIZ, pasta, f), 'utf8');
    lista.push(Object.assign({ nome: `${pasta}/${f}` }, analisar(codigo)));
  }
  arquivos.set(pasta, lista);
}

// dono → Map(nome → arquivo que o declara)
const donoDoNome = new Map();
for (const [pasta, lista] of arquivos) {
  const m = new Map();
  for (const a of lista) for (const n of a.topo) m.set(n, a.nome);
  donoDoNome.set(pasta, m);
}

// ─── quem é o quê ────────────────────────────────────────────────────────────
// A primeira versão desta suíte supunha que **toda pasta que não é a casa é um jogo**, e
// reprovou honestamente na hora em que nasceu a primeira que não era: `40-cartas/` é uma
// BIBLIOTECA — naipe, valor e o desenho de uma carta servem ao truco, ao pife e ao
// vinte-e-um, e nenhum deles é ela. Foi o teste obrigando a dizer o que a pasta É.
//
// A classificação é INFERIDA e não escrita numa lista aqui: quem se pendura em `JOGOS` é
// jogo, quem não se pendura é biblioteca. Lista de nomes num teste apodrece — foi esse o
// argumento que tirou o literal 'domino' de dentro da casa duas horas atrás.
const naoCasa = pastas.filter(p => p !== CASA);
const jogos = naoCasa.filter(p => arquivos.get(p).some(a => a.livres.has('JOGOS')));
const bibliotecas = naoCasa.filter(p => !jogos.includes(p));

// A varredura conta o QUE ELA ACHOU antes de julgar. É a lição do "quando a sua conferência
// acusa TUDO, o errado é ela": um analisador quebrado devolve zero achados e passa por verde.
const totalCasa = [...donoDoNome.get(CASA).keys()].length;
const totalFora = naoCasa.reduce((s, j) => s + donoDoNome.get(j).size, 0);
console.log(`\nvarredura: ${pastas.length} pastas · ${[...arquivos.values()].flat().length} arquivos`);
console.log(`  ${CASA.padEnd(11)} a casa   · ${totalCasa} nomes de topo`);
for (const j of jogos) console.log(`  ${j.padEnd(11)} jogo     · ${donoDoNome.get(j).size}`);
// Quem USA cada biblioteca vai para o log, e não para uma asserção: uma biblioteca sem
// consumidor é um fato a saber (hoje o `40-cartas` é uma, e será até o truco ter motor), e
// asserção vermelha no tronco ensina a rodar de novo, que é o hábito que a Fila 5 condena.
for (const b of bibliotecas) {
  const usam = jogos.filter(j => arquivos.get(j).some(a =>
    [...a.livres.keys()].some(n => donoDoNome.get(b).has(n))));
  console.log(`  ${b.padEnd(11)} bibliot. · ${donoDoNome.get(b).size} · usada por: ${usam.join(', ') || '(ninguém ainda)'}`);
}

console.log('\na casa não alcança nome de jogo nem de biblioteca');
ok(totalCasa > 50, `o analisador achou nomes na casa (${totalCasa}) — zero aqui seria instrumento quebrado`);
ok(totalFora > 50, `o analisador achou nomes fora da casa (${totalFora})`);
// Sem nenhum jogo, "jogo" e "biblioteca" viram a mesma coisa e as três asserções abaixo
// passam por vacuidade. A mensagem é o FATO e não a falha, porque ela é impressa nos dois
// casos — mensagem escrita como reclamação sai com ✓ ao lado e confunde quem lê o log.
ok(jogos.length >= 1, `${jogos.length} pasta(s) se registram em JOGOS, ${bibliotecas.length} são biblioteca`);

// A CASA NÃO PODE ALCANÇAR A BIBLIOTECA TAMBÉM. Uma casa que sabe o que é uma carta é a
// mesma casa que sabia o que era uma peça, com outro nome — e é justamente o erro que fica
// fácil de cometer agora, porque `40-cartas/` "não é de nenhum jogo em particular".
const achados = [];
for (const a of arquivos.get(CASA)) {
  for (const [nome, linhas] of a.livres) {
    for (const j of naoCasa) {
      const dono = donoDoNome.get(j).get(nome);
      if (dono) achados.push({ nome, de: a.nome, linhas, dono });
    }
  }
}

for (const c of achados) {
  console.log(`    ✗ ${c.de}:${c.linhas.join(',')} alcança \`${c.nome}\` (de ${c.dono})`);
}
const refs = achados.reduce((s, c) => s + c.linhas.length, 0);
ok(achados.length === 0,
  `a casa alcança ${achados.length} nomes de fora, ${refs} vezes — o contrato JOGOS existe para que seja zero`);

// ─── e a casa não CITA o nome de um jogo, nem em texto ───────────────────────
// O id de cada jogo é o nome da pasta sem o número — `30-domino` → `domino` —, que é
// exatamente a chave com que ele se pendura em `JOGOS`, e o que vai para a URL e para o
// armazenamento. Um `if (JOGO_ID === 'domino')` na casa não alcança identificador nenhum e é
// o mesmo acoplamento: a casa decidindo por um jogo em particular.
//
// Havia um caso REAL quando esta asserção foi escrita — a migração das chaves guardadas
// perguntava pelo dominó pelo nome. Virou `JOGO.herdaOGuardadoSemSufixo`, declarado pelo jogo.
console.log('\na casa não cita o nome de um jogo nem em texto');
const idDoJogo = pasta => pasta.replace(/^\d+-/, '');
const citados = [];
for (const a of arquivos.get(CASA)) {
  for (const j of jogos) {
    const id = idDoJogo(j);
    const linhas = a.textos.get(id);
    if (linhas) citados.push({ id, de: a.nome, linhas });
  }
}
for (const c of citados) console.log(`    ✗ ${c.de}:${c.linhas.join(',')} escreve "${c.id}"`);
ok(citados.length === 0,
  `a casa escreve o nome de ${citados.length} jogo(s) em texto — quem sabe o nome do jogo é o jogo`);

// ─── e um jogo não alcança o outro ───────────────────────────────────────────
// Nasce de graça, com um jogo só de código. É de propósito: a asserção que só passa a valer
// depois tem de estar escrita antes, senão ela nunca é escrita.
console.log('\num jogo não alcança o nome do outro');
const cruzados = [];
for (const j of jogos) {
  for (const a of arquivos.get(j)) {
    for (const [nome, linhas] of a.livres) {
      for (const outro of jogos) {
        if (outro === j) continue;
        const dono = donoDoNome.get(outro).get(nome);
        if (dono) cruzados.push({ nome, de: a.nome, linhas, dono });
      }
    }
  }
}
for (const c of cruzados) console.log(`    ✗ ${c.de}:${c.linhas.join(',')} alcança \`${c.nome}\` (de ${c.dono})`);
ok(cruzados.length === 0, `nenhum jogo alcança o nome de outro (${cruzados.length} achados)`);

// ─── e a biblioteca não alcança o jogo ───────────────────────────────────────
// A seta tem UM sentido: o jogo usa a biblioteca, nunca o contrário. Uma `40-cartas/` que
// soubesse o que é uma manilha seria truco disfarçado de baralho, e o pife herdaria a regra
// do vizinho junto com a carta — que é exatamente o que esta pasta existe para não fazer.
console.log('\na biblioteca não alcança o nome de um jogo');
const invertidos = [];
for (const b of bibliotecas) {
  for (const a of arquivos.get(b)) {
    for (const [nome, linhas] of a.livres) {
      for (const j of jogos) {
        const dono = donoDoNome.get(j).get(nome);
        if (dono) invertidos.push({ nome, de: a.nome, linhas, dono });
      }
    }
  }
}
for (const c of invertidos) console.log(`    ✗ ${c.de}:${c.linhas.join(',')} alcança \`${c.nome}\` (de ${c.dono})`);
ok(invertidos.length === 0,
  `nenhuma biblioteca alcança o nome de um jogo (${invertidos.length} achados) — a seta tem um sentido só`);

// ─── e o contrato é o ÚNICO caminho de volta ─────────────────────────────────
// A casa fala com o jogo por `JOGO.x` e por `JOGOS`. Se ela parar de citar `JOGO`, o
// acoplamento é zero por não haver ligação nenhuma — que é zero pelo motivo errado.
//
// "Cada jogo se registra" NÃO é asserção aqui, e a diferença é sutil: registrar-se é o que
// DEFINE ser jogo, três blocos acima. Cobrá-lo seria conferir a classificação contra ela
// mesma — a mesma armadilha do teste que importa a tabela do próprio código para conferir a
// tabela. Quem responde por isso é o `jogos.length >= 1` lá em cima, e o log.
console.log('\no contrato está de pé');
const citaJOGO = arquivos.get(CASA).filter(a => a.livres.has('JOGO') || a.topo.has('JOGO'));
ok(citaJOGO.length >= 3,
  `${citaJOGO.length} arquivos da casa falam com o jogo por \`JOGO\` — zero seria casa sem jogo, não casa desacoplada`);

console.log(`\n${asserçoes} asserções, ${falhas} falharam`);
process.exit(falhas ? 1 : 0);
