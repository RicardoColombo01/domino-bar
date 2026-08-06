// O BARALHO DE 40, testado no terminal. `40-cartas/045-baralho.js` é puro (invariante 4),
// então cabe inteiro aqui — sem navegador, sem WebGL, em milissegundos.
//
// POR QUE ELE EXISTE ANTES DO TRUCO. Enquanto não houver motor, nada no jogo chama estas
// funções, e código que existe e nunca rodou é a categoria de defeito que a Fila 9 inteira
// passou fechando. Um baralho errado só apareceria na Fase 4, no meio de regra de truco, e
// aí a suspeita cairia na regra.
//
// A TABELA DE REFERÊNCIA É ESCRITA AQUI, à mão. Ler `VALORES` do jogo para conferir `VALORES`
// seria conferir a tabela contra ela mesma — é a mesma razão pela qual o `test-textura`
// escreve a grade das pintas em vez de importá-la.
import { installStubs, seedRandom, buildModule } from './harness.mjs';

const VALORES_ESPERADOS = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'];
const NAIPES_ESPERADOS = ['ouros', 'espadas', 'copas', 'paus'];

installStubs();
seedRandom(7);
const mod = await import(buildModule([
  'VALORES', 'NAIPES', 'baralho40', 'distribuirCartas',
  'chaveCarta', 'mesmaCarta', 'cartaValida', 'nomeDaCarta', 'valorDaCarta', 'naipeDaCarta',
]));

let falhas = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

// ─── o baralho ───────────────────────────────────────────────────────────────
console.log('\no baralho de 40');
{
  ok(mod.VALORES.length === 10, `o baralho de 40 tem 10 valores por naipe, veio ${mod.VALORES.length}`);
  ok(mod.VALORES.join() === VALORES_ESPERADOS.join(),
    `os valores mudaram: ${mod.VALORES.join()} — o baralho de 40 não tem 8, 9 nem 10`);
  ok(mod.NAIPES.map(x => x.id).join() === NAIPES_ESPERADOS.join(),
    `os naipes mudaram: ${mod.NAIPES.map(x => x.id).join()}`);

  const b = mod.baralho40();
  ok(b.length === 40, `o baralho tem ${b.length} cartas`);
  // Sem repetida, e sem faltar nenhuma: as duas coisas juntas são o que prova que o laço
  // duplo cobre a grade inteira. Só o tamanho passaria com uma carta repetida e outra
  // faltando — que é exatamente o defeito que um `<=` trocado por `<` produz.
  ok(new Set(b.map(mod.chaveCarta)).size === 40, 'há carta repetida no baralho');
  for (let v = 0; v < 10; v++) for (let na = 0; na < 4; na++) {
    if (!b.some(c => mod.mesmaCarta(c, [v, na]))) {
      ok(false, `falta a carta [${v},${na}] (${mod.nomeDaCarta([v, na])})`);
    }
  }
  console.log(`  ${b.length} cartas, ${new Set(b.map(mod.chaveCarta)).size} distintas · ` +
    `${mod.nomeDaCarta(b[0])} … ${mod.nomeDaCarta(b[39])}`);
}

// ─── a identidade de uma carta ───────────────────────────────────────────────
// A DIFERENÇA PARA O DOMINÓ, e ela é a armadilha deste arquivo: a peça `[0,2]` e a `[2,0]`
// são a MESMA peça, e por isso lá existem `chave` e `mesmaPeca` fazendo coisas diferentes.
// Aqui não há simetria: `[0,2]` é o A de copas e `[2,0]` é o 3 de ouros. Quem copiar o
// `mesmaPeca` do dominó para cá faz duas cartas diferentes virarem a mesma.
console.log('\numa carta é o par ORDENADO');
{
  ok(mod.mesmaCarta([0, 2], [0, 2]), 'a mesma carta não se reconheceu');
  ok(!mod.mesmaCarta([0, 2], [2, 0]),
    'o A de copas e o 3 de ouros passaram por iguais — alguém trouxe a simetria do dominó');
  ok(mod.chaveCarta([0, 2]) !== mod.chaveCarta([2, 0]), 'as chaves de duas cartas diferentes colidiram');
  ok(mod.valorDaCarta([7, 0]) === 'Q', `valorDaCarta([7,0]) deu ${mod.valorDaCarta([7, 0])}`);
  ok(mod.naipeDaCarta([7, 3]).id === 'paus', `naipeDaCarta([7,3]) deu ${mod.naipeDaCarta([7, 3]).id}`);
  ok(mod.nomeDaCarta([9, 1]) === 'K de espadas', `nomeDaCarta([9,1]) deu "${mod.nomeDaCarta([9, 1])}"`);
  console.log(`  [0,2] é ${mod.nomeDaCarta([0, 2])} e [2,0] é ${mod.nomeDaCarta([2, 0])} — não são a mesma`);
}

// ─── carta que vem de FORA ───────────────────────────────────────────────────
// No online a jogada atravessa o fio, e o C3 da Fila 11 é a lembrança do que acontece quando
// o motor recebe `undefined` e desreferencia: a mesa do anfitrião para. `cartaValida` é a
// guarda que o `jogadaDoFio` do truco vai chamar.
console.log('\ncarta que vem de fora é conferida');
{
  const TORTAS = [undefined, null, [], [0], [0, 1, 2], ['0', 1], [0, '1'], [1.5, 0], [10, 0], [0, 4],
    [-1, 0], [0, -1], {}, 'A de ouros', [NaN, 0]];
  for (const t of TORTAS) {
    ok(mod.cartaValida(t) === false, `cartaValida(${JSON.stringify(t)}) devia ser falso`);
  }
  ok(mod.cartaValida([0, 0]) && mod.cartaValida([9, 3]), 'as cartas das pontas do baralho foram recusadas');
  // E `nomeDaCarta` não pode ESTOURAR com lixo — ela é o que vai para a narração da mesa, e
  // uma exceção ali derruba o `publicar()` de quem só queria mostrar o que aconteceu.
  for (const t of TORTAS) {
    try { mod.nomeDaCarta(t); } catch (e) { ok(false, `nomeDaCarta(${JSON.stringify(t)}) estourou: ${e.message}`); }
  }
  console.log(`  ${TORTAS.length} formas de carta torta recusadas, e nenhuma derrubou o nome`);
}

// ─── distribuir ──────────────────────────────────────────────────────────────
console.log('\ndistribuir');
{
  const d = mod.distribuirCartas(4, 3);
  ok(d.maos.length === 4, `esperava 4 mãos, vieram ${d.maos.length}`);
  ok(d.maos.every(m => m.length === 3), `mão com tamanho errado: ${d.maos.map(m => m.length).join()}`);
  ok(d.monte.length === 28, `o monte devia ficar com 28, ficou com ${d.monte.length}`);
  // NADA SE PERDE E NADA SE REPETE. É a asserção que pega o `splice` errado, que é o defeito
  // clássico daqui — o do dominó dava mãos curtas em silêncio pelo mesmo mecanismo.
  const tudo = d.maos.flat().concat(d.monte).map(mod.chaveCarta);
  ok(tudo.length === 40 && new Set(tudo).size === 40,
    `distribuir perdeu ou repetiu carta: ${tudo.length} cartas, ${new Set(tudo).size} distintas`);

  // ESTOURA em vez de entregar mão curta.
  let estourou = false;
  try { mod.distribuirCartas(14, 3); } catch (e) { estourou = /não cabem/.test(e.message); }
  ok(estourou, '14 jogadores × 3 cartas não cabem em 40 e mesmo assim distribuiu');
  for (const [j, p] of [[0, 3], [2, 0], [1.5, 3], [2, 1.5]]) {
    let bateu = false;
    try { mod.distribuirCartas(j, p); } catch (e) { bateu = /inválido/.test(e.message); }
    ok(bateu, `distribuirCartas(${j}, ${p}) devia recusar`);
  }

  // O EMBARALHO É DA CASA, e o teste do dominó já depende dele — se ele deixasse de
  // embaralhar, as duas suítes ficariam verdes e as partidas passariam a ser sempre iguais.
  // Duas distribuições seguidas não podem sair na mesma ordem.
  const a = mod.distribuirCartas(2, 3), b = mod.distribuirCartas(2, 3);
  ok(JSON.stringify(a.maos) !== JSON.stringify(b.maos),
    'duas distribuições saíram idênticas — o embaralho não embaralhou');
  console.log(`  4 × 3 e sobram ${d.monte.length} · 40 cartas inteiras, nenhuma repetida`);
}

// ─── e o 3D não estoura na carga ─────────────────────────────────────────────
// `085-carta3d.js` monta geometria e textura no TOPO do módulo, como o `080-peca3d.js`. Se
// ele estourasse, o script concatenado inteiro morria — tela preta, e não "a carta não
// apareceu". O harness tem dublês de THREE e de canvas, então isto roda de verdade aqui.
console.log('\na carta 3D se monta');
{
  const c = globalThis.window.__cartas;
  ok(!!c, 'a bancada `window.__cartas` não existe — ninguém alcança a carta 3D');
  if (c) {
    ok(typeof c.criarCarta === 'function' && typeof c.criarVersoDeCarta === 'function'
      && typeof c.criarFantasmaDeCarta === 'function', 'falta uma das fábricas na bancada');
    let deu = null;
    try { c.criarCarta([0, 0], true); c.criarCarta([9, 3], false); c.criarVersoDeCarta(); c.criarFantasmaDeCarta([4, 2]); }
    catch (e) { deu = e.message; }
    ok(!deu, `montar uma carta estourou: ${deu}`);
    // A UV é o que escolhe a célula do atlas: 40 cartas, uma textura. Duas cartas diferentes
    // não podem compartilhar a MESMA geometria de face — seria o atlas perfeito e a carta
    // mostrando o naipe do vizinho, que é o defeito que nenhuma foto denuncia.
    ok(c.faceDaCarta(0, 0) !== c.faceDaCarta(0, 1), 'duas cartas de naipes diferentes ganharam a mesma face');
    ok(c.faceDaCarta(0, 0) !== c.faceDaCarta(1, 0), 'duas cartas de valores diferentes ganharam a mesma face');
    ok(c.faceDaCarta(3, 2) === c.faceDaCarta(3, 2), 'a mesma carta pediu duas geometrias — o cache não pegou');

    // A UV EM NÚMERO, e não só "as faces são diferentes". Faces diferentes apontando para
    // as células ERRADAS passariam na asserção acima com a carta mostrando o naipe do
    // vizinho — e nenhuma foto denuncia isso, porque todas as células têm a mesma forma.
    //
    // O harness usa o three DE VERDADE (não um dublê), então `attributes.uv` tem os números
    // que a GPU vai ler. A conta é escrita AQUI: coluna = valor, e a linha é contada DE
    // BAIXO, porque o V da UV cresce para cima e o canvas desenha para baixo.
    const faixa = (g, eixo) => {
      const uv = g.attributes.uv;
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < uv.count; i++) {
        const x = eixo === 'x' ? uv.getX(i) : uv.getY(i);
        min = Math.min(min, x); max = Math.max(max, x);
      }
      return [+min.toFixed(4), +max.toFixed(4)];
    };
    const COLS = c.medidas.COLS_CARTA, LINS = c.medidas.LINS_CARTA;
    for (const [v, n] of [[0, 0], [9, 3], [3, 1], [7, 2]]) {
      const g = c.faceDaCarta(v, n);
      const ex = [+(v / COLS).toFixed(4), +((v + 1) / COLS).toFixed(4)];
      const ey = [+((LINS - 1 - n) / LINS).toFixed(4), +((LINS - n) / LINS).toFixed(4)];
      ok(JSON.stringify(faixa(g, 'x')) === JSON.stringify(ex),
        `a UV em X de [${v},${n}] é ${faixa(g, 'x')}, esperava ${ex} — a coluna é o VALOR`);
      ok(JSON.stringify(faixa(g, 'y')) === JSON.stringify(ey),
        `a UV em Y de [${v},${n}] é ${faixa(g, 'y')}, esperava ${ey} — a linha é o NAIPE, contada de baixo`);
    }
    console.log(`  carta ${c.medidas.CARTA_L}×${c.medidas.CARTA_C}×${c.medidas.CARTA_E} · ` +
      `atlas ${c.medidas.COLS_CARTA}×${c.medidas.LINS_CARTA} células de ${c.medidas.CEL_CARTA}px`);
  }
}

console.log(`\n${falhas ? falhas + ' falha(s)' : 'tudo certo'} — ${n} asserções`);
process.exit(falhas ? 1 : 0);
