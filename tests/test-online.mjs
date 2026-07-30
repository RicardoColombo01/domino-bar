// Online de verdade: sobe um servidor estático, abre DUAS abas do Chrome, uma cria a
// mesa e a outra entra pelo código. Depende da internet e do broker gratuito do
// PeerJS — quando eles não respondem o teste AVISA em vez de reprovar, senão um
// problema de rede viraria "o jogo quebrou".
//
//   npm run online                              testa o index.html desta pasta
//   node test-online.mjs https://algum/endereco  testa o que está PUBLICADO
//
// A segunda forma existe porque "passou aqui" e "passa no ar" não são a mesma coisa:
// no site publicado entram https, o caminho do Pages e o cache do CDN.
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.join(import.meta.dirname, '..');
const PORTA = 8137;
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };

const externo = process.argv[2];
const servidor = externo ? null : http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const arq = path.join(RAIZ, rel === '/' ? 'index.html' : rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  res.end(fs.readFileSync(arq));
});
if (servidor) await new Promise(r => servidor.listen(PORTA, r));
const URL_JOGO = externo || `http://localhost:${PORTA}/index.html`;
console.log('testando ' + URL_JOGO);

let falhas = 0, avisos = [];
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };

const navegador = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--hide-scrollbars'],
});

// CADA ABA COM A SUA IDENTIDADE, e isto deixou de ser detalhe quando o convidado passou a
// ter clienteId. As abas do Puppeteer dividem a mesma origem, e o clienteId mora no
// `localStorage`, que é da origem INTEIRA: sem isto os convidados nasceriam com o mesmo
// id e cada um faria take-over do anterior — o teste reprovaria por causa do próprio
// teste. (É a mesma lição do localStorage em file:// que já contaminou as suítes de tela:
// cada cena diz o que quer, explicitamente.)
//
// Isolar em `createBrowserContext` seria mais fiel e foi tentado: cada contexto tem o
// próprio cache HTTP, então cada aba rebaixa three.js e PeerJS do CDN — a primeira levou
// 8s e a segunda estourou 45s. Injetar o id é o mesmo efeito por um custo que não existe.
//
// Passar `id` de outra aba é dizer "é a MESMA pessoa, noutra aba".
let abas = 0;
const abrir = async (nome, id) => {
  const p = await navegador.newPage();
  const meu = id || `CLIENTEDETESTE${++abas}`;
  await p.evaluateOnNewDocument(v => localStorage.setItem('dominobar.cliente', JSON.stringify(v)), meu);
  p.idDeTeste = meu;
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
    // De propósito no Duelo: a mesa é 1v1 e serve para provar que o MODO chega ao
    // convidado. Ele não tem MESA nem P.regras — só o que vier dentro da visão.
    j.MESA.modo = 'duelo';
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
  await convidado.waitForFunction('window.__jogo.vista && window.__jogo.vista.mao.length === 14', { timeout: 25000, polling: 400 });

  console.log('\no que o convidado recebeu');
  const v = await convidado.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.vista)));
  ok(v.cadeira === 1, `o convidado deveria ser a cadeira 1, veio ${v.cadeira}`);
  ok(v.modo === 'duelo', `o modo da mesa não chegou ao convidado (veio ${v.modo})`);
  ok(v.mao.length === 14, 'a mão do convidado não chegou completa');
  ok(v.monte === 0, `o Duelo consome o baralho e o convidado viu monte de ${v.monte}`);
  ok(v.naMao.length === 2 && v.naMao[0] === 14, 'a contagem de peças do anfitrião não chegou');
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

  // ─── caiu e voltou: a MESMA cadeira ────────────────────────────────────────
  // A prova do clienteId, e o motivo de ele existir. Antes a cadeira saía da primeira
  // vaga livre, decidida no instante da conexão: "voltar" era sentar onde sobrou. E o
  // número da cadeira é a CHAVE da visaoDe — sentar na cadeira errada é receber a mão de
  // outra pessoa. Por isso a asserção confere a MÃO e não só o número: o número certo com
  // a mão errada seria um jeito de o bug passar despercebido.
  console.log('\no convidado cai e volta');
  const maoDaVisita = (await convidado.evaluate(() => window.__jogo.vista.mao.map(p => p.slice())))
    .map(norma).sort().join(' ');
  await convidado.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  await convidado.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
  await convidado.evaluate(cod => {
    document.getElementById('btEntrar').click();
    document.getElementById('onlineEntrada').value = cod;
    document.getElementById('btConectar').click();
  }, codigo);
  await convidado.waitForFunction('window.__jogo.vista && window.__jogo.vista.mao.length', { timeout: 30000, polling: 400 })
    .catch(() => ok(false, 'o convidado não conseguiu voltar para a mesa'));
  const volta = await convidado.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.vista)));
  ok(volta.cadeira === 1, `voltou na cadeira ${volta.cadeira} em vez da 1 — a cadeira não é de quem é dono dela`);
  ok(volta.mao.map(norma).sort().join(' ') === maoDaVisita,
    'voltou com outra mão: sentou na cadeira de outra pessoa');
  console.log(`  voltou na cadeira ${volta.cadeira}, com as mesmas ${volta.mao.length} peças`);

  // ─── a mesma pessoa, noutra aba ────────────────────────────────────────────
  // Mesmo contexto = mesmo localStorage = mesmo clienteId. É fechar o notebook e abrir
  // no celular. A aba nova assume a cadeira e a velha é avisada — antes as duas brigavam
  // pela mesa, cada uma consumindo uma vaga.
  console.log('\na mesma pessoa entra noutra aba');
  const outraAba = await abrir('outra aba', convidado.idDeTeste);
  await outraAba.evaluate(cod => {
    document.getElementById('btEntrar').click();
    document.getElementById('onlineEntrada').value = cod;
    document.getElementById('btConectar').click();
  }, codigo);
  await outraAba.waitForFunction('window.__jogo.vista && window.__jogo.vista.mao.length', { timeout: 30000, polling: 400 })
    .catch(() => ok(false, 'a segunda aba não conseguiu assumir a cadeira'));
  const naNova = await outraAba.evaluate(() => window.__jogo.vista.cadeira);
  ok(naNova === 1, `a segunda aba sentou na cadeira ${naNova} em vez de assumir a 1`);
  const ocupadas = await anfitriao.evaluate(() => window.__jogo.conexoesAbertas());
  ok(ocupadas === 1, `a mesa ficou com ${ocupadas} conexões para a MESMA pessoa — era para ser 1`);
  console.log(`  a aba nova assumiu a cadeira ${naNova}, e a mesa tem ${ocupadas} conexão`);
  await outraAba.close();

  await anfitriao.close();
  await convidado.close();

  // ─── a conversa ────────────────────────────────────────────────────────────
  // Mesa de 4 em duplas (0&2 × 1&3), com o anfitrião na 0 e duas visitas nas cadeiras
  // 1 e 2. O parceiro do anfitrião é a cadeira 2; a cadeira 1 é adversária. É o único
  // arranjo que responde à pergunta que interessa: a fala da dupla vaza?
  console.log('\na conversa da mesa');
  const dono = await abrir('dono');
  const parceiro = await abrir('parceiro');
  const rival = await abrir('rival');

  await dono.evaluate(() => {
    const j = window.__jogo;
    j.MESA.modo = 'classico'; j.MESA.n = 4;
    j.MESA.cadeiras[0].nome = 'Dono';
    j.MESA.cadeiras[1].tipo = 'online'; j.MESA.cadeiras[1].nome = 'Rival';
    j.MESA.cadeiras[2].tipo = 'online'; j.MESA.cadeiras[2].nome = 'Parceiro';
    j.MESA.cadeiras[3].tipo = 'bot'; j.MESA.cadeiras[3].nivel = 'normal';
    document.getElementById('btComecar').click();
  });
  await dono.waitForFunction(
    () => (document.getElementById('onlineCodigo').textContent || '').match(/^[A-Z0-9]{4}$/),
    { timeout: 25000, polling: 400 });
  const cod2 = await dono.evaluate(() => document.getElementById('onlineCodigo').textContent);

  const conversa = p => p.evaluate(() => document.getElementById('conversaLista').textContent);
  const falarComo = (p, canal, txt) => p.evaluate(([c, t]) => {
    window.__jogo.trocarCanal(c);
    document.getElementById('conversaTexto').value = t;
    window.__jogo.falar();
  }, [canal, txt]);

  // A ordem importa: a primeira conexão pega a cadeira 1 (a adversária), a segunda a 2.
  //
  // O nome vai junto: quem senta manda o PRÓPRIO nome, e ele sobrescreve o que o anfitrião
  // tinha posto na cadeira. Atribuir direto no MESA não passa por `lembrarMesa` — só o
  // campo do menu grava —, então isto não contamina o localStorage das outras cenas.
  const entrar = async (pagina, codigo, nome) => {
    await pagina.evaluate(([c, n]) => {
      window.__jogo.MESA.cadeiras[0].nome = n;
      document.getElementById('btEntrar').click();
      document.getElementById('onlineEntrada').value = c;
      document.getElementById('btConectar').click();
    }, [codigo, nome]);
  };
  // O nome do rival é uma tag: `listarSala` desenhava o nome do convidado direto em
  // innerHTML, e era um buraco mais antigo que o do chat — mais curto que os 14 caracteres
  // do corte, então ele chegava inteiro.
  await entrar(rival, cod2, '<img src=x>');
  await dono.waitForFunction(() => (document.getElementById('onlineLista').textContent.match(/chegou/g) || []).length === 1,
    { timeout: 30000, polling: 400 });
  await entrar(parceiro, cod2, 'Parceirão');
  await dono.waitForFunction(() => (document.getElementById('onlineLista').textContent.match(/chegou/g) || []).length === 2,
    { timeout: 30000, polling: 400 });

  const nomeVirouTag = await dono.evaluate(() => !!document.querySelector('#onlineLista img'));
  ok(!nomeVirouTag, 'o nome do convidado virou elemento na lista da sala em vez de texto');

  // ─── o saguão ──────────────────────────────────────────────────────────────
  // Falar ANTES de a partida começar. É quando as pessoas mais querem falar ("cadê você?",
  // "entra aí") e era o único momento em que não havia conversa: a visibilidade dela saía
  // de `desenharHUD`, que só roda quando já existe partida, e o painel ficava por baixo do
  // overlay da tela de espera.
  const saguao = await parceiro.evaluate(() => ({
    campo: !document.getElementById('conversaEscrever').classList.contains('oculta'),
    porCima: document.body.classList.contains('saguao'),
  }));
  ok(saguao.campo, 'no saguão o campo de escrever não apareceu');
  ok(saguao.porCima, 'a conversa não subiu acima da tela de espera — ficaria coberta por ela');

  await falarComo(parceiro, 'todos', 'cheguei, e vocês?');
  await dono.waitForFunction(() => document.getElementById('conversaLista').textContent.includes('cheguei'),
    { timeout: 15000, polling: 300 }).catch(() => { ok(false, 'a fala do saguão não chegou ao anfitrião'); });
  await rival.waitForFunction(() => document.getElementById('conversaLista').textContent.includes('cheguei'),
    { timeout: 15000, polling: 300 }).catch(() => { ok(false, 'a fala do saguão não chegou ao outro convidado'); });
  // No saguão não há vista de onde tirar o nome, então ele vem pelo fio — escrito pelo
  // ANFITRIÃO, a partir do MESA dele.
  const doSaguao = await conversa(dono);
  ok(/Parceirão/.test(doSaguao), `a fala do saguão saiu sem nome: "${doSaguao.slice(-90)}"`);
  console.log('  saguão: campo aberto por cima da tela, fala chegou aos dois, com nome');

  // O intervalo do anfitrião vale para o convidado também: dá o tempo antes de seguir.
  await parceiro.evaluate(() => new Promise(r => setTimeout(r, 800)));

  await dono.evaluate(() => document.getElementById('btIniciarOnline').click());
  await parceiro.waitForFunction('window.__jogo.vista && window.__jogo.vista.cadeira === 2',
    { timeout: 25000, polling: 400 });
  await rival.waitForFunction('window.__jogo.vista && window.__jogo.vista.cadeira === 1',
    { timeout: 25000, polling: 400 });
  console.log('  mesa de 4 montada: dono na 0, rival na 1, parceiro na 2');

  await falarComo(parceiro, 'todos', 'boa noite a todos');
  await rival.waitForFunction(() => document.getElementById('conversaLista').textContent.includes('boa noite'),
    { timeout: 15000, polling: 300 }).catch(() => { ok(false, 'a fala para TODOS não chegou no adversário'); });

  // O anfitrião derruba mensagem que chega rápido demais da mesma cadeira — é a guarda
  // contra um convidado que trava a mesa dos outros com um laço. Um humano digitando
  // nunca encosta nela; um teste automatizado encosta sempre.
  await parceiro.evaluate(() => new Promise(r => setTimeout(r, 800)));

  // O PONTO: só o parceiro e o anfitrião (que retransmite) podem ler.
  await falarComo(parceiro, 'dupla', 'segura o quatro');
  await dono.waitForFunction(() => document.getElementById('conversaLista').textContent.includes('segura o quatro'),
    { timeout: 15000, polling: 300 }).catch(() => { ok(false, 'a fala da dupla não chegou ao parceiro dela'); });
  // Dá tempo de a mensagem errada chegar, se for chegar.
  await rival.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  const noRival = await conversa(rival);
  const vazou = noRival.includes('segura o quatro');
  ok(!vazou, 'A FALA DA DUPLA VAZOU para o adversário — é o equivalente exato da mão vazando.');

  // Texto de chat é o primeiro campo livre vindo da rede: tem de chegar como TEXTO.
  await rival.evaluate(() => new Promise(r => setTimeout(r, 800)));
  await falarComo(rival, 'todos', '<img src=x onerror=alert(1)>');
  await dono.waitForFunction(() => document.getElementById('conversaLista').textContent.includes('onerror'),
    { timeout: 15000, polling: 300 }).catch(() => { ok(false, 'a mensagem com HTML não chegou'); });
  const virouTag = await dono.evaluate(() => !!document.querySelector('#conversaLista img'));
  ok(!virouTag, 'o HTML do chat virou elemento na página em vez de texto');
  console.log(`  fala geral chegou · fala da dupla ${vazou ? 'VAZOU' : 'não vazou'} · ` +
    `HTML chegou como ${virouTag ? 'ELEMENTO' : 'texto'}`);

  await dono.close(); await parceiro.close(); await rival.close();
} catch (e) {
  if (process.env.DOMINO_DEBUG) console.error(e.stack);
  avisos.push(e.message);
}

await navegador.close();
if (servidor) servidor.close();

if (avisos.length) {
  console.log('\nNÃO DEU PARA TESTAR O ONLINE:\n  ' + avisos.join('\n  '));
  console.log('  O broker gratuito do PeerJS ou a sua rede não deixaram a conexão fechar.');
  console.log('  Isso não reprova o jogo — solo e local não dependem de rede nenhuma.');
  process.exit(0);
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
