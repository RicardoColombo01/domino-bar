// MUTADOR — aplica UMA troca no código, roda uma suíte, e desfaz sempre.
//
//   node tests/mutar.mjs <arquivo> <de.txt> <para.txt> -- <comando...>
//
// Existe porque a conferência por mutação é o único jeito honesto de provar uma asserção que
// NASCE VERDE — e este projeto escreve muitas, já que a maior parte do trabalho recente é
// cobrir comportamento que já está certo. "Asserção que não fica vermelha antes do conserto
// não prova nada" é a armadilha nº 1 desta casa; a prova equivalente é quebrar a linha que
// ela deveria proteger e conferir que ela cai.
//
// ELE É VERSIONADO DE PROPÓSITO. Até a v4.6 todo mutador deste projeto viveu num script de
// uma vez só, no scratchpad, e era perdido no dia seguinte — o `CLAUDE.md` registra isso duas
// vezes como perda. O que se perdia junto não era o código, eram as TRÊS GUARDAS abaixo, cada
// uma paga com uma conferência inteira que mentiu.
//
// ─── guarda 1 · EXIGIR QUE O CASAMENTO ACONTECEU ─────────────────────────────
// Um `replace` que não casa não estoura e deixa o arquivo intacto: a suíte passa, e "tudo
// certo" fica indistinguível de "não mexi em nada". Aqui o padrão tem de aparecer EXATAMENTE
// uma vez, senão o script sai não-zero sem rodar coisa nenhuma.
//
// ─── guarda 2 · DETECTAR A QUEBRA DE LINHA DO PRÓPRIO ARQUIVO ────────────────
// Este repositório tem arquivos em CRLF **e** em LF. Um padrão cravado com `\n` não casa nos
// CRLF e um com `\r\n` não casa nos LF — nos dois casos, silêncio. Foi assim que cinco
// mutações do `nomeUnico` foram dadas como aplicadas sem terem tocado no arquivo.
//
// ─── guarda 3 · CLASSIFICAR A SAÍDA ──────────────────────────────────────────
// **SAÍDA NÃO-ZERO NÃO PROVA QUE A ASSERÇÃO PEGOU — prova que o COMANDO falhou.** É a terceira
// forma de a conferência mentir, e a pior, porque mente na direção TRANQUILIZADORA: as outras
// duas sub-relatam (e sub-relatar assusta), esta super-relata. Na v4.6 os comandos levavam
// `>/dev/null`, que é sintaxe Unix, e o `execSync` no Windows usa `cmd.exe` — todas as rodadas
// morriam em "O sistema não pode encontrar o caminho especificado", saíam com código 1, e o
// script declarava "a asserção pegou". DUAS MUTAÇÕES DE VAZAMENTO DE MÃO foram dadas como
// verificadas sem que a suíte tivesse rodado uma linha. Refeitas com esta guarda, as duas
// mataram a asserção de verdade — mas isso só se soube depois.
//
// Sem `✗` no texto, a rodada é INCONCLUSIVA, e inconclusivo tem de ser barulhento.
//
// ─── guarda 4 · O `finally` DESFAZ A FONTE, NÃO O QUE O COMANDO GEROU ────────
// Achado testando este próprio arquivo: um comando que inclui `node build.mjs` gera o
// `index.html` e o `sw.js` A PARTIR DO CÓDIGO MUTADO, e eles sobrevivem ao desfazer — o
// `git status` fica sujo com um bundle que contém a mutação. Commitar aquilo seria publicar
// código que ninguém escreveu, que é precisamente o que o `merge=ours` do `.gitattributes` e
// o `npm run check` existem para impedir. Aqui o aviso é barulhento; quem decide é você.
//
// ─── guarda 5 · O COMANDO TEM DE CONSTRUIR — as suítes leem o BUNDLE ─────────
// Achado na v4.7, e é a QUINTA forma de esta conferência mentir. `buildModule` (harness.mjs)
// lê o `index.html` GERADO, não o `src/`: um comando sem `node build.mjs` na frente roda
// contra o bundle da última construção, e a mutação — aplicada, casada, confirmada em `src/`
// — simplesmente não chega ao teste. Sai "a mutação SOBREVIVEU", e é mentira.
//
// Ela mente na direção ALARMANTE, ao contrário da guarda 3, e por isso é menos perigosa: um
// falso "sobreviveu" faz olhar, um falso "pegou" faz seguir em frente. Mas as duas medem o
// código errado, e o remédio é o mesmo — use os scripts do `package.json`
// (`npm test`, `npm run truco`, `npm run online`), que já começam com `node build.mjs`.
// Rodar `node tests/test-jogo.mjs` na mão é justamente o atalho que não serve aqui.
//
// Repare que ela e a guarda 4 são as duas metades do mesmo fato: o bundle é gerado, então ou
// ele entra no meio do caminho (guarda 5) ou sobra sujo no fim (guarda 4).
//
// ─── guarda 6 · O QUE ESTE SCRIPT NÃO CONSEGUE GARANTIR ──────────────────────
// **Se o PROCESSO for morto de fora, o `finally` não roda e a mutação FICA NO CÓDIGO.** É a
// sexta forma de esta conferência mentir e a pior de todas: as outras cinco mentem no
// RELATÓRIO, e esta contamina a FONTE. Aconteceu em 13/08/2026 — um comando estourou um prazo
// de 10 minutos, o processo levou SIGTERM, e a linha mutada de `150-rede.js` ficou lá. O
// `npm test` seguinte passou, porque aquela mutação era compatível com as asserções que
// restavam, e quem acusou foi um `git diff`.
//
// Não há conserto do lado de dentro: um processo morto não executa mais nada. O que existe é
// disciplina, e ela é a mesma da guarda 4 — **depois de mutar, olhe o `git status`.** Se o
// arquivo estiver sujo, o que está nele é código que ninguém escreveu.

// ─── e uma coisa que NÃO é defeito do mutador ────────────────────────────────
// Quando o conserto tem DUAS camadas, mutar UMA delas sai verde — a irmã segura o caso. Isso
// é o desenho, não asserção fraca. A prova honesta é mutar o PAR. Quem mexer numa camada e
// vir a suíte verde não descobriu que ela é inútil: descobriu que a irmã está de pé.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [arquivo, deArq, paraArq, ...resto] = process.argv.slice(2);
if (!arquivo || !deArq || !paraArq || !resto.includes('--')) {
  console.error('uso: node tests/mutar.mjs <arquivo> <de.txt> <para.txt> -- <comando...>');
  process.exit(2);
}
const comando = resto.slice(resto.indexOf('--') + 1).join(' ');

const original = readFileSync(arquivo, 'utf8');
const crlf = original.includes('\r\n');                                       // guarda 2
const ajustar = t => (crlf ? t.replace(/\r?\n/g, '\r\n') : t.replace(/\r\n/g, '\n'));

const de = ajustar(readFileSync(deArq, 'utf8').replace(/\n$/, ''));
const para = ajustar(readFileSync(paraArq, 'utf8').replace(/\n$/, ''));

const quantas = original.split(de).length - 1;                                // guarda 1
if (quantas !== 1) {
  console.error(`MUTAÇÃO NÃO APLICADA: ${quantas} ocorrência(s) do padrão em ${arquivo} ` +
    `(o arquivo é ${crlf ? 'CRLF' : 'LF'}). Esperava exatamente 1, e não rodei nada.`);
  process.exit(3);
}

writeFileSync(arquivo, original.replace(de, para));
console.log(`── mutação aplicada em ${arquivo} (${crlf ? 'CRLF' : 'LF'})`);

let codigo = 0, texto = '';
try {
  texto = execSync(comando, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  codigo = e.status == null ? 1 : e.status;
  texto = (e.stdout || '') + (e.stderr || '');
} finally {
  writeFileSync(arquivo, original);           // no `finally`: desfaz mesmo se o comando morrer
  console.log('── desfeita');
}

const interessa = texto.split('\n').filter(l => /✗|falha|tudo certo|asserç/.test(l));
if (interessa.length) console.log(interessa.join('\n'));

const reprovouDeVerdade = /✗|falha\(s\)/.test(texto);                         // guarda 3
if (codigo && !reprovouDeVerdade) {
  console.error(`── INCONCLUSIVO: o comando saiu ${codigo} e NENHUMA asserção reprovou. ` +
    'Isto é o comando quebrado, não a mutação pega. Conserte o comando e rode de novo.');
  console.error(texto.split('\n').slice(-12).join('\n'));
  process.exit(4);
}
console.log(reprovouDeVerdade
  ? '── a asserção PEGOU a mutação'
  : '── a mutação SOBREVIVEU — é este o alerta, e ele merece uma olhada');

// guarda 4: o desfazer alcança a fonte, e o bundle ficou gerado do código mutado.
if (/build(\.mjs)?\b/.test(comando)) {
  console.log('── ATENÇÃO: o comando construiu o bundle a partir do código MUTADO, e o ' +
    'desfazer não o alcança. Rode `npm run build` antes de commitar qualquer coisa.');
}
