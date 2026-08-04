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

// ESCOLHER A CENA, pelo mesmo motivo do test-telas: esta suíte é linear, sobe um servidor,
// abre meia dúzia de abas e depende do broker público do PeerJS. Iterar num defeito de uma
// cena só custava a suíte inteira.
//
//   node test-online.mjs                       tudo, local
//   node test-online.mjs --so=saguao           só esta cena
//   node test-online.mjs https://… --so=conversa
//
// O corte é limpo porque cada cena abre a PRÓPRIA mesa e as próprias abas — a única coisa
// que atravessa a fronteira é o `codigo`, e ele nasce e morre dentro da primeira.
const args = process.argv.slice(2);
const externo = args.find(a => !a.startsWith('--'));
const so = (args.find(a => a.startsWith('--so=')) || '').slice(5).split(',').filter(Boolean);
// A lista existe para que uma cena inexistente REPROVE em vez de rodar zero asserção e
// imprimir "tudo certo" — verde vazio é a armadilha que o `diff` de arquivos vazios já
// pagou aqui. Quem acrescentar cena nova acrescenta o nome aqui, no mesmo commit.
const CENAS = ['duelo', 'conversa', 'saguao', 'nomes', 'voltar'];
for (const s of so) if (!CENAS.includes(s)) {
  // Cena que não existe é ERRO e não "rodar tudo": um erro de digitação daria a suíte
  // inteira quando se pediu uma cena, ou zero asserção — e as duas mentem.
  console.error(`não existe a cena "${s}" — havia: ${CENAS.join(', ')}`);
  process.exit(2);
}
const rodar = nome => !so.length || so.includes(nome);
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

  if (rodar('duelo')) {   // A mesa de DUELO, a reconexão dos dois lados e o take-over da mesma pessoa.
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

    // O ANFITRIÃO GUARDA A MESA, e tem de ser conferido AGORA — as abas do teste vivem na
    // mesma origem e portanto no MESMO localStorage, então o `guardar('sala')` do convidado
    // vai passar por cima deste daqui a poucas linhas. Não é defeito do jogo: na vida real
    // o anfitrião e a visita são navegadores diferentes.
    const salaDoAnfitriao = await anfitriao.evaluate(() => window.__jogo.salaGuardada());
    ok(salaDoAnfitriao && salaDoAnfitriao.anfitriao === true && salaDoAnfitriao.codigo === codigo,
      `o anfitrião não guardou a própria mesa: ${JSON.stringify(salaDoAnfitriao)}`);

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

    // ─── o ANFITRIÃO cai e reabre a MESMA mesa ─────────────────────────────────
    // O item 3(c), e é o que faz a reconexão do online valer de verdade: antes, o anfitrião
    // que recarregava abria uma mesa OUTRA (`codigoNovo()` a cada `tentarAbrir`), e os
    // convidados tentando voltar batiam numa porta que não existe. Metade do mecanismo sem
    // a outra. A asserção cobre as três coisas que têm de acontecer juntas: o MESMO código,
    // a partida de volta com as cadeiras ainda online, e o convidado sentando sozinho na
    // cadeira dele COM A MESMA MÃO.
    console.log('\no anfitrião cai e reabre a mesma mesa');
    const antesDaQueda = await anfitriao.evaluate(() => ({
      maoNum: window.__jogo.P.maoNum, naLinha: window.__jogo.P.linha.length }));
    const maoAntesDaQueda = (await convidado.evaluate(() => window.__jogo.vista.mao.map(p => p.slice())))
      .map(norma).sort().join(' ');

    await anfitriao.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await anfitriao.waitForFunction('window.__jogo && window.__jogo.pronto', { timeout: 30000, polling: 400 });
    // Recompõe o registro que o convidado sobrescreveu — artefato do localStorage
    // compartilhado explicado lá em cima, e não parte do que se está testando.
    await anfitriao.evaluate(s => {
      localStorage.setItem('dominobar.sala', JSON.stringify(s));
      window.__jogo.atualizarBotaoVoltarMesa();
    }, salaDoAnfitriao);

    const rotulo = await anfitriao.evaluate(() => document.getElementById('btVoltarMesa').textContent);
    ok(/Reabrir a sua mesa/.test(rotulo), `o menu ofereceu "${rotulo}" em vez de reabrir a mesa`);

    await anfitriao.evaluate(() => document.getElementById('btVoltarMesa').click());
    await anfitriao.waitForFunction(
      cod => document.getElementById('onlineCodigo').textContent === cod,
      { timeout: 40000, polling: 500 }, codigo)
      .catch(() => ok(false, 'o anfitrião não conseguiu reivindicar o mesmo código'));
    console.log(`  reabriu com o mesmo código: ${codigo}`);

    await anfitriao.waitForFunction(
      an => window.__jogo.P && window.__jogo.P.maoNum === an.maoNum && window.__jogo.P.linha.length === an.naLinha,
      { timeout: 30000, polling: 500 }, antesDaQueda)
      .catch(() => ok(false, 'a partida não voltou igual ao reabrir a mesa'));
    const cadeirasDepois = await anfitriao.evaluate(() => window.__jogo.P.cadeiras.map(c => c.tipo));
    ok(cadeirasDepois.includes('online'),
      `ao reabrir, as cadeiras viraram ${cadeirasDepois.join('/')} — quem reabre a mesa não pode transformar a visita em bot`);
    console.log(`  partida de volta na mão ${antesDaQueda.maoNum} com as cadeiras ${cadeirasDepois.join('/')}`);

    // E o convidado volta SOZINHO: daqui de fora, anfitrião recarregando e mesa fechando são
    // o mesmo evento (o link cai igual), então desistir na primeira queda desperdiçaria
    // justamente o mecanismo acima.
    await convidado.waitForFunction('window.__jogo.vista && window.__jogo.vista.mao.length',
      { timeout: 60000, polling: 500 })
      .catch(() => ok(false, 'o convidado não voltou sozinho depois de o anfitrião reabrir'));
    const depois = await convidado.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.vista)));
    ok(depois.cadeira === 1, `o convidado voltou na cadeira ${depois.cadeira} em vez da 1`);
    ok(depois.mao.map(norma).sort().join(' ') === maoAntesDaQueda,
      'o convidado voltou com outra mão depois de o anfitrião reabrir a mesa');
    console.log(`  o convidado voltou sozinho na cadeira ${depois.cadeira}, com as mesmas ${depois.mao.length} peças`);

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
  }

  await anfitriao.close();
  await convidado.close();

  if (rodar('conversa')) {   // A conversa: fala geral, fala da dupla e o nome hostil.
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

    // ...E O MESMO NOME NO MENU, que era o buraco que sobrou. `listarSala` foi consertado
    // (é a asserção acima); `montarCadeiras` ficou para trás, e é pior por ser dentro de um
    // ATRIBUTO `value=` — basta uma aspa para sair dele. O nome vem da rede e `lembrarMesa`
    // o persiste, então o anfitrião mexer no modo, no número de jogadores ou simplesmente
    // recarregar já bastava para o script do convidado rodar na máquina dele.
    const noMenu = await dono.evaluate(() => {
      const j = window.__jogo;
      // O NOME QUE QUEBRA PARA FORA DO ATRIBUTO. Repare que o `<img src=x>` que já circulou
      // acima NÃO serve aqui: sem aspa ele fica preso dentro do `value=` e não vira elemento
      // nem no código com defeito — a asserção passaria dos dois lados e não provaria nada.
      // Quem abre o atributo é a aspa, e é por isso que ela lidera este nome.
      //
      // Atribuir direto é o que `sentar()`/`{t:'nome'}` fazem quando o convidado se apresenta
      // (15-rede.js), com o mesmo corte de 14 caracteres; o caminho de rede já está provado
      // pela asserção do saguão logo acima.
      j.MESA.cadeiras[1].nome = '"><img src=x>';
      j.montarCadeiras();
      const virouTag = !!document.querySelector('#cadeiras img');

      // E a aspa sozinha, que nem precisa de má intenção: um jogador chamado Zé "O Rei"
      // fechava o atributo e o campo passava a mostrar o nome pela metade — com o nome já
      // corrompido gravado no armazenamento.
      j.MESA.cadeiras[1].nome = 'Zé "O" \'R\'';
      j.montarCadeiras();
      const campo = document.querySelector('#cadeiras .nome[data-i="1"]');
      return { virouTag, valor: campo ? campo.value : null };
    });
    ok(!noMenu.virouTag, 'o nome do convidado virou ELEMENTO na lista de cadeiras do menu');
    ok(noMenu.valor === 'Zé "O" \'R\'',
      `aspas no nome quebraram o atributo do campo: veio ${JSON.stringify(noMenu.valor)}`);
    console.log('  o nome hostil chegou como texto no saguão e no menu');

    // O <select> DE CADEIRA, A METADE QUE GRAVA. Ele é como se escolhe contra quem jogar
    // e nunca teve asserção. O `test-jogo.mjs` cobre o que o menu DESENHA (qual opção
    // nasce marcada); o `onchange` fica de fora lá porque o harness de Node não constrói
    // elementos a partir de innerHTML — `querySelectorAll` devolve vazio e o handler nunca
    // chega a ser ligado. Aqui há um DOM de verdade, então este é o lugar da outra metade.
    //
    // O que se exige é a IDA E VOLTA: o valor que o menu escreveu na opção tem de ser o
    // mesmo que o `onchange` sabe destrinchar. As duas pontas são strings montadas à mão
    // ('bot:' + nivel de um lado, split(':') do outro), e strings montadas à mão em dois
    // lugares é como duas metades passam a discordar em silêncio.
    // O `antes`/`restaurar` NÃO é zelo: esta página CONTINUA VIVA nas cenas seguintes, e
    // `MESA` é estado compartilhado. Sem devolver o que se pegou, a cena da mesa de 4 em
    // duplas herdava a cadeira 1 virada em bot e o modo deixado no Trio — e aí `duplas` é
    // falso, o canal da dupla vira canal geral, e a asserção de VAZAMENTO DE FALA reprova.
    // Foi o que aconteceu ao escrever isto: um teste novo derrubou um teste antigo, e por
    // um instante pareceu defeito no jogo. É a mesma lição do localStorage entre as cenas
    // do test-telas, noutro meio: cada cena diz o que quer, e devolve como encontrou.
    const doSelect = await dono.evaluate(async () => {
      const j = window.__jogo;
      const antes = { modo: j.MESA.modo, n: j.MESA.n,
                      c1: { tipo: j.MESA.cadeiras[1].tipo, nivel: j.MESA.cadeiras[1].nivel } };
      const restaurar = () => {
        j.MESA.modo = antes.modo; j.MESA.n = antes.n;
        j.MESA.cadeiras[1].tipo = antes.c1.tipo; j.MESA.cadeiras[1].nivel = antes.c1.nivel;
        j.montarCadeiras(); j.ajustarCompraAoModo();
      };
      j.MESA.cadeiras[1].tipo = 'bot'; j.MESA.cadeiras[1].nivel = 'normal';
      j.montarCadeiras();
      const sel = document.querySelector('#cadeiras select[data-i="1"]');
      if (!sel) return { erro: 'não achei o select da cadeira 1' };

      const escolher = valor => {
        sel.value = valor;
        // `dispatchEvent` e não chamar `sel.onchange()` na mão: o que se quer saber é se o
        // handler está LIGADO ao elemento, e não só se a função existe.
        sel.dispatchEvent(new Event('change'));
        const c = j.MESA.cadeiras[1];
        return { tipo: c.tipo, nivel: c.nivel === undefined ? null : c.nivel };
      };

      const opcoes = [...sel.options].map(o => o.value);
      const r = {
        opcoes,
        dificil: escolher('bot:dificil'),
        online: escolher('online'),
        local: escolher('local'),
        facil: escolher('bot:facil'),
        // Depois de mexer, o menu redesenhado tem de mostrar o que ficou valendo — é a ida
        // e a volta fechando o círculo.
        remarcado: (j.montarCadeiras(),
          document.querySelector('#cadeiras select[data-i="1"]').value),
      };
      restaurar();
      return r;
    });
    ok(!doSelect.erro, `o select de cadeira sumiu do menu: ${doSelect.erro}`);
    if (!doSelect.erro) {
      // Bot guarda tipo E nível; os outros dois não têm nível nenhum, e um nível
      // sobrando de uma escolha anterior faria a cadeira virar um bot fantasma.
      ok(doSelect.dificil.tipo === 'bot' && doSelect.dificil.nivel === 'dificil',
        `escolher "bot:dificil" gravou ${JSON.stringify(doSelect.dificil)}`);
      ok(doSelect.online.tipo === 'online' && doSelect.online.nivel === null,
        `escolher "online" gravou ${JSON.stringify(doSelect.online)} — o nível do bot anterior ficou para trás`);
      ok(doSelect.local.tipo === 'local' && doSelect.local.nivel === null,
        `escolher "local" gravou ${JSON.stringify(doSelect.local)}`);
      ok(doSelect.facil.tipo === 'bot' && doSelect.facil.nivel === 'facil',
        `voltar para bot devia trazer o nível junto, e gravou ${JSON.stringify(doSelect.facil)}`);
      ok(doSelect.remarcado === 'bot:facil',
        `o menu redesenhado devia mostrar "bot:facil" e mostra "${doSelect.remarcado}"`);
      ok(doSelect.opcoes.length === 5, `a cadeira devia oferecer 5 opções e oferece ${doSelect.opcoes.length}`);
    }
    console.log(`  o select grava e o menu confirma: ${doSelect.opcoes ? doSelect.opcoes.join(' ') : '—'}`);

    // A COMPRA LIVRE NÃO PODE SER PROMETIDA ONDE NÃO HÁ MONTE. O botão ficava aceso no
    // Duelo, no Trio e no Clássico de 4, e o motor descarta a regra em silêncio — `acoesDe`
    // exige `temMonte` antes de qualquer coisa. É a espécie de defeito que o
    // `refletirMesaNosBotoes` existe para impedir: o jogo está certo e a tela mente.
    //
    // Está aqui e não no test-jogo porque `disabled` precisa dos botões de verdade, e o
    // harness de Node não lê a página. A CONTA em si (quantas peças sobram) é pura e está
    // testada lá, com a mesma tabela.
    const compra = await dono.evaluate(() => {
      const j = window.__jogo;
      // Mesmo cuidado do bloco acima: a página segue viva, e este teste percorre os cinco
      // modos da casa. Deixar `MESA` no Trio quebraria a mesa de 4 da cena seguinte.
      const antes = { modo: j.MESA.modo, n: j.MESA.n };
      const estado = (modo, n) => {
        j.MESA.modo = modo; j.MESA.n = n;
        j.ajustarCompraAoModo();
        const bts = [...document.querySelectorAll('#compraLivre button')];
        return { botoes: bts.length, ligavel: bts.some(b => !b.disabled),
                 nota: document.getElementById('notaCompra').textContent };
      };
      const r = {
        c2: estado('classico', 2), c3: estado('classico', 3), c4: estado('classico', 4),
        duelo: estado('duelo', 2), trio: estado('trio', 3),
      };
      j.MESA.modo = antes.modo; j.MESA.n = antes.n;
      j.ajustarCompraAoModo();
      return r;
    });
    ok(compra.c2.botoes === 2, `o grupo da compra livre devia ter 2 botões e tem ${compra.c2.botoes}`);
    ok(compra.c2.ligavel && compra.c3.ligavel,
      'o Clássico de 2 e de 3 têm monte e a compra livre tinha de estar disponível');
    // O CASO QUE A LEITURA POR MODO ERRA: "modo com monte" não existe — o Clássico de 4
    // esgota o baralho igualzinho ao Duelo e ao Trio.
    ok(!compra.c4.ligavel, 'o Clássico de 4 não tem monte e a compra livre continuou prometida');
    ok(!compra.duelo.ligavel && !compra.trio.ligavel,
      'Duelo e Trio esgotam o baralho na distribuição e a compra livre continuou prometida');
    // Botão apagado sem explicação é o jogo emudecendo: a nota diz POR QUE não dá.
    ok(compra.duelo.nota && !compra.c2.nota,
      `a nota devia aparecer só onde não há monte (duelo="${compra.duelo.nota}", clássico de 2="${compra.c2.nota}")`);
    console.log('  a compra livre só é oferecida onde existe monte');

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
  }

  if (rodar('saguao')) {   // Três abas da MESMA pessoa, no saguão de uma mesa de 4.
    // ─── a mesma pessoa não lota a mesa ────────────────────────────────────────
    // Relato do Ricardo com foto: "Lia" aparecendo TRÊS vezes na lista da sala. A foto é
    // da v1.5.0 e o item 4 da v1.6.0 já resolveu isso (clienteId + sentar() +
    // donoDaCadeira), então:
    //
    //   ESTA CENA É VERDE NO CÓDIGO DE HOJE. É REGRESSÃO, NÃO CONSERTO.
    //
    // Está dito com todas as letras porque a casa trata asserção que nasce verde como
    // coisa que não prova conserto nenhum — e aqui isso é escolha, não descuido.
    //
    // O valor dela é cobrir três eixos que a asserção existente ("a mesma pessoa entra
    // noutra aba", lá em cima) não cobre, e que são exatamente os da foto:
    //   · SAGUÃO (P nulo) é o único lugar onde `largar()` APAGA o dono da cadeira, de
    //     propósito, para a mesa não encher de reserva de quem só espiou;
    //   · mesa de QUATRO, onde há três vagas online e o `findIndex` tem para onde errar —
    //     com duas cadeiras ele não tinha;
    //   · TRÊS abas encadeiam DOIS take-overs, e é no segundo que a conexão velha e a nova
    //     disputam a mesma entrada do mapa.
    //
    // O que ficaria VERMELHO e por que não se escreve assim: o aperto de mão legado
    // (convidado que manda `nome` sem `ola`) não registra dono, e três abas antigas pegam
    // três cadeiras. Mas isso é comportamento DESENHADO — quebrar quem não recarregou
    // seria pior —, e uma asserção em cima disso gravaria a regra errada, que é o erro que
    // os itens 1 e 2 da Fila 5 pagaram duas vezes.
    console.log('\ntrês abas da mesma pessoa, no saguão de uma mesa de 4');
    const anf4 = await abrir('anfitrião de 4');
    await anf4.evaluate(() => {
      const j = window.__jogo;
      j.MESA.modo = 'classico'; j.MESA.n = 4;
      j.MESA.cadeiras[0].nome = 'Ricardo';
      for (let i = 1; i < 4; i++) { j.MESA.cadeiras[i].tipo = 'online'; j.MESA.cadeiras[i].nome = `Vaga ${i}`; }
      document.getElementById('btComecar').click();
    });
    await anf4.waitForFunction(
      () => (document.getElementById('onlineCodigo').textContent || '').match(/^[A-Z0-9]{4}$/),
      { timeout: 25000, polling: 400 });
    const cod4 = await anf4.evaluate(() => document.getElementById('onlineCodigo').textContent);

    // Uma pessoa só, três abas: `abrir` injeta o MESMO clienteId nas três, que é como se
    // diz "é a mesma pessoa" sem pagar o cache HTTP de um contexto isolado.
    const MESMA = 'LIADETESTE';
    const sentar = async (nome) => {
      const p = await abrir(nome, MESMA);
      await p.evaluate(c => {
        window.__jogo.MESA.cadeiras[0].nome = 'Lia';
        document.getElementById('btEntrar').click();
        document.getElementById('onlineEntrada').value = c;
        document.getElementById('btConectar').click();
      }, cod4);
      await p.waitForFunction(() => /Você é a cadeira/.test(document.getElementById('onlineErro').textContent),
        { timeout: 30000, polling: 400 });
      return p;
    };
    const naCadeira = p => p.evaluate(() =>
      Number((document.getElementById('onlineErro').textContent.match(/cadeira (\d)/) || [])[1]));

    const ab1 = await sentar('aba 1'); const primeira = await naCadeira(ab1);
    const ab2 = await sentar('aba 2');
    const ab3 = await sentar('aba 3');

    // Dá tempo de as cadeiras a mais aparecerem, SE forem aparecer. Sem esta pausa a
    // asserção poderia medir antes de o terceiro `ola` chegar e passar por PRESSA — verde
    // de teste que não alcançou o estado interessante é a armadilha nº 3 do CLAUDE.md.
    await anf4.evaluate(() => new Promise(r => setTimeout(r, 1500)));

    const sala = await anf4.evaluate(() => ({
      chegaram: (document.getElementById('onlineLista').textContent.match(/chegou/g) || []).length,
      conexoes: window.__jogo.conexoesAbertas(),
    }));
    ok(sala.chegaram === 1,
      `no SAGUÃO a mesma pessoa ocupou ${sala.chegaram} das 3 cadeiras online — era para ser 1`);
    ok(sala.conexoes === 1,
      `a mesa ficou com ${sala.conexoes} conexões para a MESMA pessoa — era para ser 1`);
    // E é a MESMA cadeira: take-over não pode andar com a pessoa pela mesa. O número certo
    // é o que faz "voltar" ser VOLTAR e não "entrar de novo em qualquer lugar" — e no
    // começo da partida ele vira a chave da visaoDe.
    const ultima = await naCadeira(ab3);
    ok(ultima === primeira,
      `a terceira aba sentou na cadeira ${ultima} em vez de assumir a ${primeira}`);
    // As abas velhas foram AVISADAS. Sem isto, "1 conexão" também descreveria uma aba que
    // simplesmente caiu sem ninguém saber.
    const expulsa = p => p.evaluate(() =>
      /noutra aba/.test(document.getElementById('onlineErro').textContent) ||
      !document.getElementById('telaMenu').classList.contains('oculta'));
    ok(await expulsa(ab1) && await expulsa(ab2),
      'as abas antigas não foram avisadas de que a cadeira passou para a nova');

    console.log(`  1 pessoa · ${sala.chegaram} cadeira · ${sala.conexoes} conexão · sempre a ${primeira}`);
    await ab1.close(); await ab2.close(); await ab3.close(); await anf4.close();
  }

  if (rodar('nomes')) {   // DUAS PESSOAS DIFERENTES com o mesmo nome, pelo campo do saguão.
    // ─── quem é quem na mesa ───────────────────────────────────────────────────
    // O caso de campo, com foto: mesa de dois, placar "Você × Você", os dois cartões "Você"
    // e toda linha da conversa começando igual. A causa era a cadeira 0 chamar-se "Você" por
    // padrão e o convidado mandar esse nome sem nunca ter sido perguntado.
    //
    // Esta cena prova as DUAS metades que só existem com rede, e por isso não cabem no
    // test-jogo: (1) o campo #onlineNome está ligado ao fio — o que se digita nele é o que
    // chega do outro lado —, e (2) o desempate roda no ANFITRIÃO, que é o único que vê os
    // dois. As regras do desempate em si (onde entra o número, o que cede para caber nos 14)
    // são função pura e estão provadas no test-jogo, em milissegundos.
    console.log('\nduas pessoas com o mesmo nome, pelo campo do saguão');
    const anfN = await abrir('anfitrião dos nomes');
    await anfN.evaluate(() => {
      const j = window.__jogo;
      j.MESA.modo = 'classico'; j.MESA.n = 3;
      j.MESA.cadeiras[0].nome = 'Dona da mesa';
      for (let i = 1; i < 3; i++) { j.MESA.cadeiras[i].tipo = 'online'; j.MESA.cadeiras[i].nome = `Vaga ${i}`; }
      document.getElementById('btComecar').click();
    });
    await anfN.waitForFunction(
      () => (document.getElementById('onlineCodigo').textContent || '').match(/^[A-Z0-9]{4}$/),
      { timeout: 25000, polling: 400 });
    const codN = await anfN.evaluate(() => document.getElementById('onlineCodigo').textContent);

    // PELO CAMPO, e não atribuindo `MESA.cadeiras[0].nome` como as outras cenas fazem. É a
    // diferença entre provar o campo e provar o caminho velho que ele passou a alimentar:
    // atribuir no MESA testaria exatamente o que já funcionava antes de o campo existir.
    const entrarComCampo = async (pagina, nome) => {
      await pagina.evaluate(([c, n]) => {
        document.getElementById('btEntrar').click();
        document.getElementById('onlineNome').value = n;
        document.getElementById('onlineEntrada').value = c;
        document.getElementById('btConectar').click();
      }, [codN, nome]);
      await pagina.waitForFunction(() => /Você é a cadeira/.test(document.getElementById('onlineErro').textContent),
        { timeout: 30000, polling: 400 });
    };

    const um = await abrir('Ricardo 1');
    const dois = await abrir('Ricardo 2');
    await entrarComCampo(um, 'Ricardo');
    await entrarComCampo(dois, 'Ricardo');
    await anfN.evaluate(() => new Promise(r => setTimeout(r, 800)));

    const naMesa = await anfN.evaluate(() => window.__jogo.MESA.cadeiras.slice(1, 3).map(c => c.nome));
    ok(naMesa[0] === 'Ricardo',
      `o primeiro a chegar não podia ser renomeado: veio "${naMesa[0]}"`);
    ok(naMesa[1] && naMesa[1] !== naMesa[0],
      `os dois convidados ficaram com o mesmo nome na mesa: ${JSON.stringify(naMesa)}`);
    // O campo está LIGADO: se ele fosse decoração, os dois entrariam com o padrão do menu
    // deles ("Careca") e o nome digitado não apareceria em lugar nenhum.
    ok(naMesa.every(n => /^Ricardo/.test(n)),
      `o que se digitou no campo de nome não chegou ao anfitrião: ${JSON.stringify(naMesa)}`);
    // E a lista da sala mostra os dois separados — é ali que o jogador confere quem chegou.
    const listados = await anfN.evaluate(() =>
      [...document.querySelectorAll('#onlineLista span')].map(s => s.textContent.trim()).filter(Boolean));
    ok(listados.length > 0, 'a lista da sala veio vazia — a cena não mediu o que veio medir');
    ok(new Set(listados).size === listados.length,
      `a lista da sala repetiu nome: ${JSON.stringify(listados)}`);

    console.log(`  dois "Ricardo" viraram ${naMesa.join(' e ')}`);
    await um.close(); await dois.close(); await anfN.close();
  }

  if (rodar('voltar')) {   // SAIR DE PROPÓSITO E VOLTAR — as duas ordens, numa cena só.
    // ─── o convidado que saiu consegue voltar ─────────────────────────────────
    // Relato de campo: "saiu da sala e ao tentar voltar não conseguiu, mesmo com a sala
    // aberta". Eram DOIS defeitos somados num sintoma só, e é por isso que a cena percorre
    // os dois caminhos: sem revanche o problema é ele não ter mais o CÓDIGO (o
    // `esquecer('sala')` fechava as três portas de volta de uma vez); com revanche a cadeira
    // dele virou bot para sempre e a mesa respondia "já está cheia", que é mentira.
    console.log('\no convidado sai e volta para a mesa');
    const anfV = await abrir('anfitrião do voltar');
    await anfV.evaluate(() => {
      const j = window.__jogo;
      j.MESA.modo = 'classico'; j.MESA.n = 3;
      j.MESA.cadeiras[0].nome = 'Quem abriu';
      j.MESA.cadeiras[1].tipo = 'online'; j.MESA.cadeiras[1].nome = 'Visita';
      j.MESA.cadeiras[2].tipo = 'bot'; j.MESA.cadeiras[2].nivel = 'normal';
      document.getElementById('btComecar').click();
    });
    await anfV.waitForFunction(
      () => (document.getElementById('onlineCodigo').textContent || '').match(/^[A-Z0-9]{4}$/),
      { timeout: 25000, polling: 400 });
    const codV = await anfV.evaluate(() => document.getElementById('onlineCodigo').textContent);

    const visita = await abrir('a visita');
    const entrar = async () => {
      await visita.evaluate(c => {
        document.getElementById('btEntrar').click();
        document.getElementById('onlineNome').value = 'Visita';
        document.getElementById('onlineEntrada').value = c;
        document.getElementById('btConectar').click();
      }, codV);
      await visita.waitForFunction(() => /Você é a cadeira/.test(document.getElementById('onlineErro').textContent),
        { timeout: 30000, polling: 400 });
    };
    const temMao = () => visita.waitForFunction(
      () => window.__jogo.vista && window.__jogo.vista.fase === 'mao' && window.__jogo.vista.mao.length > 0,
      { timeout: 30000, polling: 300 });

    await entrar();
    await anfV.evaluate(() => document.getElementById('btIniciarOnline').click());
    await temMao();

    // SAIR. O `localStorage` é lido no MESMO evaluate do clique, e isso é de propósito: as
    // abas do teste vivem na mesma origem e portanto no MESMO armazenamento, então o
    // `guardarMesaDoAnfitriao()` que o anfitrião dispara ao receber o `desisto` passaria por
    // cima do registro da visita alguns milissegundos depois. `largarAMesa` grava de forma
    // síncrona, antes de a mensagem sequer sair — ler ali é ler o que ela escreveu, sem
    // corrida. Na vida real são navegadores diferentes e o problema não existe.
    const aoSair = await visita.evaluate(() => {
      document.getElementById('btSair').click();
      document.getElementById('btSairSim').click();
      const g = JSON.parse(localStorage.getItem('dominobar.sala') || 'null');
      return { g, noMenu: !document.getElementById('telaMenu').classList.contains('oculta') };
    });
    ok(aoSair.g && aoSair.g.codigo === codV && aoSair.g.anfitriao === false,
      `sair apagou o caminho de volta: a sala guardada ficou ${JSON.stringify(aoSair.g)}`);
    ok(aoSair.noMenu, 'sair da partida devia levar ao menu');
    const botao = await visita.evaluate(() => ({
      visivel: !document.getElementById('btVoltarMesa').classList.contains('oculta'),
      texto: document.getElementById('btVoltarMesa').textContent,
    }));
    ok(botao.visivel && botao.texto.includes(codV),
      `o botão de voltar não oferece a mesa ${codV}: ${JSON.stringify(botao)}`);

    // VOLTA SEM REVANCHE. A partida acabada não pode ser reapresentada a ele: quem chega
    // entre duas partidas vai para o saguão, não para a tela da derrota que ele já aceitou.
    await visita.evaluate(g => localStorage.setItem('dominobar.sala', JSON.stringify(g)), aoSair.g);
    await visita.evaluate(() => document.getElementById('btVoltarMesa').click());
    await visita.waitForFunction(() => /Você é a cadeira/.test(document.getElementById('onlineErro').textContent),
      { timeout: 30000, polling: 400 });
    const depoisDeVoltar = await visita.evaluate(() => ({
      erro: document.getElementById('onlineErro').textContent,
      naDerrota: !document.getElementById('telaFimPartida').classList.contains('oculta'),
      noSaguao: !document.getElementById('telaOnline').classList.contains('oculta'),
    }));
    ok(!depoisDeVoltar.naDerrota,
      'voltar para a mesa reapresentou a tela da derrota que ele já tinha aceitado');
    ok(depoisDeVoltar.noSaguao, 'quem volta entre duas partidas tinha de ficar no saguão');
    ok(/Esperando o anfitrião/.test(depoisDeVoltar.erro),
      `a espera ficou muda: "${depoisDeVoltar.erro}"`);

    // E A REVANCHE O ENCONTRA NA CADEIRA.
    await anfV.evaluate(() => document.getElementById('btRevanche').click());
    await temMao();
    console.log('  voltou sem revanche, esperou no saguão e a revanche o achou na cadeira');

    // AGORA A ORDEM QUE FAZIA O BECO SEM SAÍDA: sai, o anfitrião dá revanche (a cadeira vira
    // bot, e tem de virar — senão a mesa nasce esperando quem não responde), e ele volta.
    await visita.evaluate(() => {
      document.getElementById('btSair').click();
      document.getElementById('btSairSim').click();
    });
    await anfV.waitForFunction(() => window.__jogo.P && window.__jogo.P.fase === 'fim',
      { timeout: 20000, polling: 300 });
    await anfV.evaluate(() => document.getElementById('btRevanche').click());
    const virouBot = await anfV.evaluate(() => ({
      tipo: window.__jogo.MESA.cadeiras[1].tipo, vaga: window.__jogo.MESA.cadeiras[1].vagaOnline,
    }));
    ok(virouBot.tipo === 'bot' && virouBot.vaga === true,
      `montagem: a cadeira devia ter virado bot COM a marca de vaga, e veio ${JSON.stringify(virouBot)}`);

    await visita.evaluate(g => localStorage.setItem('dominobar.sala', JSON.stringify(g)), aoSair.g);
    await visita.evaluate(() => document.getElementById('btVoltarMesa').click());
    await visita.waitForFunction(
      () => /Você é a cadeira|cheia|vaga/.test(document.getElementById('onlineErro').textContent),
      { timeout: 30000, polling: 400 });
    const naVolta = await visita.evaluate(() => document.getElementById('onlineErro').textContent);
    ok(!/cheia/.test(naVolta),
      `a mesa disse que estava cheia com um bot improvisado sentado na vaga dele: "${naVolta}"`);
    ok(/Você é a cadeira/.test(naVolta), `não deu para voltar depois da revanche: "${naVolta}"`);
    const reconvertida = await anfV.evaluate(() => window.__jogo.MESA.cadeiras[1].tipo);
    ok(reconvertida === 'online',
      `a cadeira continuou "${reconvertida}" com gente sentada nela — o bot e a pessoa disputam a vez`);
    await temMao();

    console.log('  voltou depois da revanche e assumiu a cadeira que tinha virado bot');
    await visita.close(); await anfV.close();
  }
} catch (e) {
  if (process.env.DOMINO_DEBUG) console.error(e.stack);
  // DEFEITO NÃO É PROBLEMA DE REDE, e esta separação existe porque a alternativa já
  // enganou: um `j.ajustarCompraAoModo is not a function` — nome novo que a ponte do
  // 16-loop.js não expunha — saiu daqui com o recado "o broker gratuito do PeerJS ou a
  // sua rede não deixaram a conexão fechar", e a rede estava ótima.
  //
  // É a mesma lição que este arquivo já registrou de outro jeito (o `catch` que guardava
  // só a `message` escondia ONDE), cobrada de novo num degrau acima: o `catch` que existe
  // para transformar falha de rede em AVISO também engole os defeitos de verdade, e o
  // recado tranquilizador é justamente o que faz ninguém olhar.
  //
  // A regra é simples e não depende de adivinhar: TypeError e ReferenceError são erro de
  // PROGRAMA. Rede não produz nenhum dos dois.
  if (e instanceof TypeError || e instanceof ReferenceError) {
    console.error('\n✗ ISTO NÃO É A REDE — é defeito no jogo ou no teste:');
    console.error('  ' + e.stack);
    falhas++;
  } else {
    avisos.push(e.message);
  }
}

await navegador.close();
if (servidor) servidor.close();

if (avisos.length) {
  console.log('\nNÃO DEU PARA TESTAR O ONLINE:\n  ' + avisos.join('\n  '));
  console.log('  O broker gratuito do PeerJS ou a sua rede não deixaram a conexão fechar.');
  console.log('  Isso não reprova o jogo — solo e local não dependem de rede nenhuma.');
  // MAS O QUE JÁ REPROVOU CONTINUA REPROVADO. Este `exit(0)` era incondicional, e com ele
  // uma rodada que imprimiu quatro `✗` na tela saía com código ZERO só porque uma espera
  // estourou depois — a suíte dizia "não deu para testar" sobre coisas que ela já tinha
  // testado e reprovado. É a mesma doença que este arquivo já registra dois parágrafos
  // acima, num degrau adiante: o caminho que existe para perdoar a REDE perdoando o JOGO.
  // Conferido por mutação (o `esquecer('sala')` de volta no `largarAMesa`): antes desta
  // guarda, quatro asserções vermelhas saíam com sucesso.
  if (!falhas) process.exit(0);
  console.log(`\n…e ainda assim ${falhas} asserção(ões) reprovou/reprovaram ANTES disso — isso é defeito.`);
  process.exit(1);
}
// Como no test-telas: rodada parcial tem de DIZER que foi parcial, senão "tudo certo"
// descreve as cenas que não rodaram tão bem quanto as que rodaram.
console.log(falhas ? `\n${falhas} falha(s)`
  : so.length ? `\ntudo certo — RODADA PARCIAL: só ${so.join(', ')} de ${CENAS.join(', ')}`
              : '\ntudo certo');
process.exit(falhas ? 1 : 0);
