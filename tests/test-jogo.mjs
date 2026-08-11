// O jogo inteiro montado em Node: cena, HUD, mão, tabuleiro e uma partida do começo
// ao fim. Só o `import` já vale como teste — ele constrói a cena Three.js de verdade,
// e geometria inválida ou variável indefinida estoura aqui em vez de virar tela preta.
import path from 'path';
import { installStubs, seedRandom, buildModule, frames, correrTimers, els, fire, preferir } from './harness.mjs';

installStubs();
seedRandom(99);

const mod = await import(buildModule([
  'MESA', 'comecarLocal', 'pedirAcao', 'aplicarIntencao', 'atualizarVista', 'jogadaDoBot',
  'visaoDe', 'novaMao', 'publicar', 'P', 'vistaAtual', 'euNaTela', 'travado', 'naMao', 'naMesa',
  'grupoMao', 'grupoOutros', 'grupoMonte', 'grupoMesa', 'scene', 'renderer', 'camera',
  'selecionarPeca', 'cancelarEscolha', 'confirmarJogada', 'escolhida', 'grupoPrevia', 'chave',
  'arrumarMao', 'moverNaMao', 'carroca',
  'guardarFala', 'soltarFalasGuardadas', 'falasGuardadas', 'donoLocalDaFala', 'limparConversa',
  'dicaDaVista', 'pedirDica', 'receberChat', 'atualizarConversa',
  // `ac` é o AudioContext, e é o único jeito de perguntar se o jogo está MESMO calado —
  // o botão mostrar ✕ não prova nada, era exatamente esse o defeito. `conexoes` diz
  // quais cadeiras online têm alguém vivo do outro lado.
  'ac', 'conexoes', 'montarCadeiras', 'abrirMesaOnline', 'encerrarRede',
  // `JOGOS` e `JOGO_ID` para a cena do jogo no protocolo: o teste descobre o OUTRO jogo em
  // vez de escrever 'truco' à mão, senão ele morre no dia em que a casa ganhar o pife.
  'JOGOS', 'JOGO_ID', 'salaGuardada', 'vistaDoFio',
  // `apontada` é o realce da peça — o mesmo campo que o mouse alimenta e que o teclado
  // passou a alimentar também. Perguntar por ele é como se vê o cursor de teclado sem
  // inventar um segundo estado só para o teste.
  'apontada', 'porQueNaoDa',
  // O painel de contagem só era testado por FORA (se cobre a mesa, nas suítes de tela).
  // Ele é ferramenta de decisão: contar errado é pior que não contar.
  // O painel de apoio é chamado pelo ENCAIXE da casa, não pela função do jogo: quem o
  // desenha de verdade é `painelDoJogo`, que `30-domino/135-contagem.js` preenche na carga.
  // Testar `desenharContagem` direto deixaria a linha do encaixe sem uma única asserção —
  // e sem ela o painel simplesmente não aparece, calado. Conferido por mutação: tirando o
  // `painelDoJogo = desenharContagem`, três asserções reprovam e a QUARTA mata a suíte, ao
  // ler `t['3'].vistos` de um painel que ficou vazio. Reprovar MENOS do que devia é o
  // sintoma que este projeto já registra — aqui a causa é conhecida e está escrita, e não
  // uma asserção fraca.
  'painelDoJogo',
  // `bulbo` é a lâmpada, e é a única maneira de perguntar se ela parou de respirar — a
  // preferência não pode ser testada por uma variável de configuração, tem de ser pelo
  // MOVIMENTO que ela promete tirar da tela.
  'bulbo', 'movimentoReduzido',
  // `sentar` e `largar` são a LÓGICA de quem ocupa qual cadeira; o encanamento de PeerJS
  // à volta delas é do test-online, num Chrome com duas abas. Dirigi-las daqui com uma
  // `conn` de mentira é o que torna o prazo de 30s testável sem esperar 30 segundos —
  // o harness enfileira os setTimeout e o teste os drena quando quer.
  'sentar', 'largar', 'esperando', 'donoDaCadeira', 'ESPERA_VOLTA',
  // `nomeUnico` é pura e por isso a prova fina dela mora aqui e não no Chrome: o desempate
  // de nomes tem regras (onde entra o número, o que cede para caber nos 14) que não
  // precisam de rede nenhuma para serem exigidas.
  'nomeUnico',
  // `desistiuDaMesa` é o corpo do `{t:'desisto'}`, extraído de dentro do
  // `peer.on('connection')` — lá dentro ele é inalcançável no harness, e é justamente ele
  // que põe o defeito relatado (sair e não conseguir voltar) dentro da suíte rápida.
  'desistiuDaMesa',
  'ajustarOpcoesAoModo', 'sobraDoBaralho',
  // `acoesDe` entra para a cena do despachante PODER PROVAR que alcançou o ramo perigoso:
  // fora da vez (ou com peça obrigatória de fora da mão) ela devolve `jogadas: []`, o
  // `.some` de `jogar` curto-circuita e o TypeError do C3 nunca acontece — seis asserções
  // verdes sem ter exercitado nada. Foi exatamente o que aconteceu na primeira rodada.
  'acoesDe',
  // O ENCANAMENTO DA REDE que vive dentro dos callbacks do PeerJS, e que por isso era
  // inalcançável daqui — a mesma justificativa do `desistiuDaMesa`. É onde moram os três
  // `setTimeout` sem dono (C1, C2, S5 da Fila 11): o defeito é um temporizador acordando
  // depois de o jogador já ter mudado de ideia, e isso só se enxerga drenando os timers.
  'modo', 'peer', 'conectando', 'voltando', 'codigoDaSala', 'VOLTAS',
  'tentarAbrir', 'conectarNaMesa', 'voltarSozinho', 'pararDeConectar', 'entrarNumaMesa',
  // `desenharHUD` e `mostrarFimDeMao` escrevem `innerHTML` a partir da VISTA, e a vista do
  // convidado vem inteira do fio. Chamá-los direto é o que permite envenenar um campo de
  // cada vez numa vista de verdade — pela `atualizarVista` o teste mediria de quebra a mão,
  // o tabuleiro e o monte, e uma falha ali falaria de outra coisa.
  'desenharHUD', 'mostrarFimDeMao', 'escapar', 'JOGO',
  // A Fila 12: `nomeDoTime` devolve HTML e `nomeDoTimeTexto` devolve texto — a separação é
  // o conserto do C1 e do C2, e sem as duas expostas não há como afirmar qual é qual.
  // `linhasDoLog` e `limparConversa` medem o TAMANHO do que o convidado recebe (C4).
  'nomeDoTime', 'nomeDoTimeTexto', 'linhasDoLog', 'mostrarFimDePartida',
  // `linkAnfitriao` é o lado CONVIDADO do fio, e ele não tinha uma linha de teste: o
  // `linkAnfitriao.on('data')` mora dentro de dois callbacks aninhados do PeerJS. Com o
  // dublê gravando ouvintes dá para dirigi-lo, e é onde entra a vista que vem de fora.
  'linkAnfitriao',
], undefined, path.join(import.meta.dirname, '.gerado', 'built-jogo.mjs')));

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); falhas++; } };
const contarMalhas = raiz => { let n = 0; raiz.traverse(o => { if (o.isMesh) n++; }); return n; };

console.log('\ncena e HUD montaram');
{
  ok(mod.scene.children.length > 8, 'a cena ficou vazia');
  frames(3);
  ok(mod.renderer.calls >= 3, 'o loop de render não rodou');
}

console.log('\npartida solo contra bots');
{
  mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'dificil';
  mod.comecarLocal();

  ok(mod.P, 'a partida não começou');
  ok(mod.naMao.length === 7, `a mão desenhada tem ${mod.naMao.length} peças, esperado 7`);
  ok(contarMalhas(mod.grupoMonte) === 7, 'o monte de 3 jogadores deveria mostrar 7 peças');

  // Nada do que está na tela pode revelar a mão dos outros: as peças dos adversários
  // e as do monte são o corpo liso, sem a textura de pintas.
  const semPinta = raiz => {
    let limpo = true;
    raiz.traverse(o => { if (o.isMesh && o.material.map) limpo = false; });
    return limpo;
  };
  ok(semPinta(mod.grupoOutros), 'peça de adversário desenhada com as pintas à mostra');
  ok(semPinta(mod.grupoMonte), 'peça do monte desenhada com as pintas à mostra');

  let jogadas = 0, maos = 0;
  for (let passo = 0; mod.P.fase !== 'fim'; passo++) {
    if (passo > 3000) { ok(false, 'a partida não terminou'); break; }

    if (mod.P.fase === 'fimDeMao') { maos++; els.get('btProxima').onclick(); continue; }

    const vez = mod.P.vez;
    if (mod.P.cadeiras[vez].tipo === 'bot') {
      // Comprar NÃO passa a vez, então "andou o turno" não serve de prova de que o bot
      // agiu. O que muda em qualquer um dos três casos é o tamanho da mão dele.
      const antes = mod.P.maos[vez].length + mod.P.linha.length;
      // Nas primeiras vezes vai pelo temporizador de verdade, para testar esse caminho;
      // depois usa o atalho, senão o teste vira uma sequência de esperas.
      if (jogadas < 4) { frames(2); correrTimers(); }
      else mod.aplicarIntencao(vez, mod.jogadaDoBot(mod.P, vez));
      const agiu = mod.P.fase !== 'mao' || mod.P.vez !== vez ||
        mod.P.maos[vez].length + mod.P.linha.length !== antes;
      ok(agiu, 'o bot travou sem jogar, comprar nem passar');
    } else {
      const a = mod.vistaAtual.acoes;
      if (a.jogadas.length) mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
      else if (a.comprar) mod.pedirAcao({ acao: 'comprar' });
      else mod.pedirAcao({ acao: 'passar' });
    }
    jogadas++;

    if (mod.P.fase === 'mao') {
      ok(contarMalhas(mod.grupoMesa) >= mod.P.linha.length, 'faltou peça no tabuleiro desenhado');
      ok(mod.naMao.length === mod.P.maos[mod.euNaTela].length,
        `a mão na tela (${mod.naMao.length}) não bate com a do motor (${mod.P.maos[mod.euNaTela].length})`);
    }
    frames(2);
  }
  console.log(`  ${maos} mãos, ${jogadas} jogadas até alguém fechar a partida`);
  ok(maos >= 1, 'a partida acabou na primeira mão sem passar pelo fim de mão');
}

console.log('\na mão que decide a partida mostra os pontos');
{
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.comecarLocal();

  // Deixa todo mundo a um ponto do alvo: a próxima mão a fechar encerra a partida. É
  // exatamente o caso em que fecharMao põe fase='fim' direto — e em que a tela dos
  // pontos vinha sendo pulada, então você caía no campeão sem saber de onde veio.
  const quaseLa = () => mod.P.placar.forEach((_, i) => { mod.P.placar[i] = mod.P.regras.alvo - 1; });
  quaseLa();

  for (let passo = 0; mod.P.fase !== 'fim'; passo++) {
    if (passo > 3000) { ok(false, 'a partida não terminou'); break; }
    if (mod.P.fase === 'fimDeMao') { quaseLa(); els.get('btProxima').onclick(); continue; }
    const vez = mod.P.vez;
    if (mod.P.cadeiras[vez].tipo === 'bot') { mod.aplicarIntencao(vez, mod.jogadaDoBot(mod.P, vez)); continue; }
    const a = mod.vistaAtual.acoes;
    if (a.jogadas.length) mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
    else if (a.comprar) mod.pedirAcao({ acao: 'comprar' });
    else mod.pedirAcao({ acao: 'passar' });
  }

  const fimMao = els.get('telaFimMao'), fimPartida = els.get('telaFimPartida');
  ok(!fimMao._cls.has('oculta'),
     'a mão que encerrou a partida pulou a tela de pontos e caiu direto no campeão');
  ok(fimPartida._cls.has('oculta'), 'as duas telas de fim apareceram ao mesmo tempo');
  ok(els.get('btProxima').textContent === 'Ver o resultado',
     `com a partida encerrada o botão deveria dizer "Ver o resultado", e diz "${els.get('btProxima').textContent}"`);
  ok(/\d/.test(els.get('fimSobrou').innerHTML), 'não listou o que sobrou na mão de cada um');

  els.get('btProxima').onclick();
  ok(!fimPartida._cls.has('oculta'), 'o clique não abriu a tela de campeão');
  ok(fimMao._cls.has('oculta'), 'a tela de fim de mão continuou por cima do campeão');
  ok(/\d/.test(els.get('placarFinal').innerHTML), 'a tela de campeão não mostrou o placar final');
  ok(mod.P.fase === 'fim', 'o botão começou uma mão nova numa partida já encerrada');

  // A REGRESSÃO QUE IMPORTA: a tela é função pura da fase e atualizarVista roda em todo
  // publicar() — a cada jogada e, no online, a cada vista que chega pelo fio. Sem o
  // flag de memória, esta única linha traria o fim de mão de volta por cima do campeão.
  mod.publicar();
  ok(!fimPartida._cls.has('oculta') && fimMao._cls.has('oculta'),
     'publicar() de novo reabriu o fim de mão por cima da tela de campeão');
}

console.log('\na prévia promete onde a peça cai');
{
  mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();

  let conferidas = 0, comDuasPontas = 0;
  for (let passo = 0; passo < 900 && conferidas < 25; passo++) {
    if (mod.P.fase !== 'mao') { mod.comecarLocal(); continue; }
    const v = mod.vistaAtual;

    if (v.vez === v.cadeira && v.acoes.jogadas.length && v.linha.length) {
      const i = mod.naMao.findIndex(m => m.jogavel);
      mod.selecionarPeca(i);
      const m = mod.naMao[i];

      // um fantasma por ponta onde a peça serve — nem mais, nem menos
      ok(mod.grupoPrevia.children.length === m.pontas.length,
        `${m.pontas.length} ponta(s) possíveis mas ${mod.grupoPrevia.children.length} fantasma(s)`);
      if (m.pontas.length === 2) comDuasPontas++;

      // O TESTE QUE VALE: guarda a promessa e depois confere contra a realidade.
      const lado = m.pontas[0];
      const prometido = mod.grupoPrevia.children.find(g => g.userData.lado === lado);
      const px = prometido.position.x, pz = prometido.position.z;
      const prot = prometido.children[1].rotation.y;
      const k = mod.chave(m.peca);

      mod.confirmarJogada(lado);
      ok(mod.escolhida === null && mod.grupoPrevia.children.length === 0,
        'confirmar deveria limpar a escolha e os fantasmas');

      const posta = mod.naMesa.get(k);
      if (posta) {
        const erro = Math.hypot(posta.alvo.x - px, posta.alvo.z - pz);
        ok(erro < 1e-9, `o fantasma prometeu (${px.toFixed(3)}, ${pz.toFixed(3)}) e a peça caiu em (${posta.alvo.x.toFixed(3)}, ${posta.alvo.z.toFixed(3)})`);
        const dr = Math.abs(((posta.alvo.rotY - prot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
        ok(dr < 1e-9 || Math.abs(dr - Math.PI * 2) < 1e-9, 'o fantasma prometeu outra orientação');
        conferidas++;
      }
      continue;
    }
    mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
  }
  console.log(`  ${conferidas} promessas conferidas · ${comDuasPontas} vezes com as duas pontas acesas`);
  ok(conferidas >= 20, 'poucas jogadas conferidas para o teste valer');
  ok(comDuasPontas > 0, 'nunca apareceu o caso de servir nas duas pontas');

  // cancelar não pode deixar rastro
  const i = mod.naMao.findIndex(m => m.jogavel);
  if (i >= 0) {
    mod.selecionarPeca(i);
    mod.cancelarEscolha();
    ok(mod.grupoPrevia.children.length === 0 && mod.escolhida === null, 'cancelar deixou fantasma na mesa');
  }
}

console.log('\nrevezamento na mesma tela');
{
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'local';
  mod.MESA.cadeiras[1].nome = 'Zé';
  mod.comecarLocal();

  // Faz a vez andar até cair na cadeira do outro humano.
  for (let i = 0; i < 40 && mod.P.vez === 0; i++) {
    const a = mod.vistaAtual.acoes;
    if (a.jogadas.length) mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
    else if (a.comprar) mod.pedirAcao({ acao: 'comprar' });
    else mod.pedirAcao({ acao: 'passar' });
  }
  ok(mod.P.vez === 1, 'a vez nunca chegou no segundo jogador');
  ok(mod.travado, 'deveria estar travado esperando a troca de jogador');
  ok(els.get('passeNome').textContent === 'Zé', 'a tela de troca não disse o nome de quem joga');
  // O ponto crítico: as peças do jogador anterior somem da CENA, não só da vista.
  ok(mod.naMao.length === 0 && contarMalhas(mod.grupoMao) === 0,
     'a mão do jogador anterior continuou na cena durante a troca');
  ok(!els.get('telaPasse')._cls.has('oculta'), 'a tela de troca não apareceu');

  els.get('btPronto').onclick();
  ok(!mod.travado && mod.euNaTela === 1, 'a troca não passou a tela para o segundo jogador');
  ok(mod.naMao.length === mod.P.maos[1].length, 'a mão do segundo jogador não foi desenhada');
}

console.log('\ndesenho a partir de uma visão que veio da rede');
{
  // O convidado não tem partida nenhuma: ele desenha só o que o anfitrião mandou.
  // Passar pelo JSON é justamente o teste — o que não sobrevive à serialização não
  // existe do outro lado, e o que sobrevive é exatamente o que ele pode ver.
  const pacote = JSON.parse(JSON.stringify(mod.visaoDe(mod.P, 0)));
  ok(!('maos' in pacote) && !('monte' in pacote && Array.isArray(pacote.monte)),
     'a visão serializada carregou dados que o convidado não pode ver');
  ok(typeof pacote.monte === 'number', 'o monte deveria trafegar como contagem, não como peças');
  mod.atualizarVista(pacote);
  ok(mod.naMao.length === pacote.mao.length, 'a mão não foi desenhada a partir do pacote da rede');
  frames(4);
}

console.log('\na mão de 14 do Duelo cabe na tela');
{
  mod.MESA.modo = 'duelo';
  mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.comecarLocal();

  ok(mod.naMao.length === 14, `a mão desenhada tem ${mod.naMao.length} peças, esperado 14`);
  ok(contarMalhas(mod.grupoMonte) === 0, 'o Duelo consome o baralho e mesmo assim desenhou monte');

  const ys = mod.naMao.map(m => m.yBase);
  const frente = Math.min(...ys);
  ok(new Set(ys).size === 2, `14 peças deveriam ficar em 2 fileiras, ficaram em ${new Set(ys).size}`);
  ok(mod.naMao.every(m => m.yBase === frente || m.zBase < mod.naMao.find(o => o.yBase === frente).zBase),
     'a fileira de trás não recuou — ela ficaria escondida atrás da da frente');

  // O que a mão de 14 quebrava: espremida numa fileira só, cada peça cobria a beirada
  // DIREITA da anterior — e como a peça nasce com o [0] à esquerda, o que sumia era
  // sempre o segundo número. Aqui o passo entre peças tem de ser >= a peça inteira.
  // `escalaBase` e não `obj.scale`: desde que a mão passou a ser reconciliada em vez de
  // recriada, a escala do objeto é interpolada e uma peça que sobreviveu da mão anterior
  // ainda está a caminho do tamanho novo. Quem diz o tamanho do slot é a base.
  const escala = mod.naMao[0].escalaBase;
  const daFrente = mod.naMao.filter(m => m.yBase === frente).map(m => m.xBase).sort((a, b) => a - b);
  const passo = daFrente[1] - daFrente[0];
  ok(passo >= escala - 1e-9,
     `as peças da fileira se sobrepõem: passo ${passo.toFixed(3)} contra peça de ${escala.toFixed(3)}`);

  // E a mão inteira tem de caber na largura visível na frente da câmera.
  const usada = daFrente[daFrente.length - 1] - daFrente[0] + escala;
  ok(usada <= 8.2 + 1e-9, `a mão ocupou ${usada.toFixed(2)} de largura, mais que os 8.2 visíveis`);
}

console.log('\narrumar a mão');
{
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();
  // Anda até ser a sua vez com jogada na mão: quem abre é quem tem o 6|6, então isso
  // não pode depender da semente.
  for (let i = 0; i < 200; i++) {
    const v = mod.vistaAtual;
    if (v && v.fase === 'mao' && v.vez === v.cadeira && v.acoes.jogadas.length) break;
    if (!mod.P || mod.P.fase !== 'mao') { mod.comecarLocal(); continue; }
    mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
  }

  const naTela = () => mod.naMao.map(m => mod.chave(m.peca));
  const ordenado = a => a.slice().sort().join();
  const inicial = naTela();

  mod.moverNaMao(0, 3);
  mod.arrumarMao();
  const arrumada = naTela();
  ok(ordenado(arrumada) === ordenado(inicial), 'arrumar perdeu ou inventou peça');
  mod.arrumarMao();
  ok(naTela().join() === arrumada.join(), 'arrumar duas vezes deveria dar exatamente o mesmo');

  // O naipe mais forte abre a mão num BLOCO — é o que faz a arrumação servir para
  // alguma coisa: bater o olho e saber em que número você aguenta responder. Com empate
  // na contagem, qualquer um dos empatados serve; o que não serve é ficar espalhado.
  const quantos = new Array(7).fill(0);
  mod.naMao.forEach(m => { quantos[m.peca[0]]++; quantos[m.peca[1]]++; });
  const maior = Math.max(...quantos);
  const abreEmBloco = quantos.some((q, n) => {
    if (q !== maior) return false;
    const onde = mod.naMao.map((m, i) => (m.peca[0] === n || m.peca[1] === n ? i : -1)).filter(i => i >= 0);
    return onde.length && onde[0] === 0 && onde[onde.length - 1] === onde.length - 1;
  });
  ok(abreEmBloco, `nenhum naipe de ${maior} peças abre a mão em bloco: ${naTela()}`);

  // E a arrumação sobrevive à jogada: some a peça jogada, o resto na mesma ordem.
  const a = mod.vistaAtual.acoes;
  ok(a.jogadas.length > 0, 'o cenário não deu jogada nenhuma para testar');
  if (a.jogadas.length) {
    const jogada = mod.chave(a.jogadas[0].peca);
    const esperado = arrumada.filter(k => k !== jogada);
    mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
    ok(naTela().join() === esperado.join(),
      `depois de jogar o ${jogada} a ordem deveria ser ${esperado} e ficou ${naTela()}`);
  }
}

// O arrasto não tinha um único teste, e é o que deixou passar dois bugs: a peça
// abandonada pelo segundo dedo e a arrumação apagada na troca de jogador. O harness já
// registra os listeners de window, então dá para disparar o gesto de verdade.
console.log('\narrastar a peça');
{
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();

  // Duas coisas que no navegador acontecem sozinhas e aqui não:
  // 1. o leque precisa ASSENTAR — peça que sobrevive de uma mão para a outra é
  //    reaproveitada e desliza até o lugar novo, e o raycast mira onde ela ESTÁ;
  // 2. quem atualiza as matrizes de mundo é o renderer a cada quadro, e aqui ele é um
  //    stub que não faz nada — sem isto o raycast trabalha com a câmera na origem.
  frames(40);
  mod.scene.updateMatrixWorld(true);
  mod.camera.updateMatrixWorld(true);

  const V = mod.naMao[0].obj.position.constructor;
  // Onde o slot de repouso de uma peça cai na tela — o inverso exato da conta que o
  // jogo faz para mirar (110-interacao.js).
  const naTela = m => {
    const v = new V(m.xBase, m.yBase, m.zBase).project(mod.camera);
    return { x: (v.x + 1) / 2 * 1600, y: (1 - v.y) / 2 * 900 };
  };
  const chaves = () => mod.naMao.map(m => mod.chave(m.peca));
  const alvo = mod.renderer.domElement;

  const de = 0, para = 3;
  const antes = chaves();
  const a = naTela(mod.naMao[de]), b = naTela(mod.naMao[para]);

  fire('pointerdown', { target: alvo, pointerId: 1, clientX: a.x, clientY: a.y });
  // O primeiro move é curto de propósito: abaixo do limiar ainda é toque, não arrasto.
  fire('pointermove', { pointerId: 1, clientX: a.x + 3, clientY: a.y });
  ok(chaves().join() === antes.join(), 'um movimento de 3px não podia ter reordenado nada');

  fire('pointermove', { pointerId: 1, clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
  fire('pointermove', { pointerId: 1, clientX: b.x, clientY: b.y });
  const arrastada = antes[de];
  ok(chaves()[para] === arrastada,
    `a peça ${arrastada} deveria ter ido para o índice ${para}, e a ordem ficou ${chaves()}`);
  ok(chaves().slice().sort().join() === antes.slice().sort().join(), 'o arrasto perdeu ou inventou peça');

  fire('pointerup', { pointerId: 1 });
  ok(!mod.naMao.some(m => m.arrastando), 'sobrou peça marcada como arrastando depois do pointerup');

  // O SEGUNDO DEDO: com um arrasto em curso, um toque em outra peça abandonava a
  // primeira com arrastando=true para sempre — e animarMao a ignora, então ela ficava
  // congelada no ar até a mão ser reconstruída.
  const p0 = naTela(mod.naMao[0]), p2 = naTela(mod.naMao[2]);
  fire('pointerdown', { target: alvo, pointerId: 7, clientX: p0.x, clientY: p0.y });
  fire('pointermove', { pointerId: 7, clientX: p0.x + 40, clientY: p0.y });
  fire('pointerdown', { target: alvo, pointerId: 8, clientX: p2.x, clientY: p2.y });
  fire('pointerup', { pointerId: 7 });
  ok(!mod.naMao.some(m => m.arrastando),
    'um segundo dedo deixou a peça do primeiro congelada no ar');
}

// Até a v1.8.0 não havia como ESCOLHER UMA PEÇA sem mouse ou dedo: o jogo tinha três
// teclas (Esc, A, D) e nenhuma delas jogava. Estas asserções cobrem o ciclo novo — passear
// com as setas, pular com os números — e a mais importante delas é a do SILÊNCIO: um
// caminho novo de entrada que desiste calado é a doença que os itens 6 e 7 da Fila 5 e a
// Fila 6 inteira passaram consertando.
//
// SETE DAS NOVE REPROVAM no código sem teclado — foram rodadas contra ele. As duas que
// não: "mexer o ponteiro largou o cursor" e "digitar no campo não escolheu peça" passam
// sem a funcionalidade porque lá nada acontecia mesmo. Elas são GUARDA contra regressão,
// não prova do conserto, e ficam ditas assim para ninguém as contar como evidência.
console.log('\njogar sem apontador');
{
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
  mod.comecarLocal();
  // A vez pode nascer num bot — a primeira mão abre com o 6|6, e ele cai onde cair. Sem
  // esta espera as `acoes.jogadas` vêm vazias, nenhuma peça é jogável, e a suíte reprovaria
  // por causa do sorteio em vez de por causa do teclado.
  for (let i = 0; i < 60 && mod.P.fase === 'mao' && mod.P.vez !== 0; i++) { frames(2); correrTimers(); }
  frames(40);

  const tecla = k => { fire('keydown', { key: k }); frames(1); };
  const aviso = els.get('aviso');

  // Uma seta e a peça levantada é a primeira da mão. `apontada` é o MESMO campo do hover
  // do mouse: se um dia ele deixar de ser, o realce some sem ninguém perceber.
  mod.cancelarEscolha();
  tecla('ArrowRight');
  ok(mod.apontada === 0, `a primeira seta devia apontar a peça 0 e apontou ${mod.apontada}`);
  tecla('ArrowRight'); tecla('ArrowRight');
  ok(mod.apontada === 2, `três setas à direita deviam parar na peça 2 e pararam em ${mod.apontada}`);
  tecla('ArrowLeft');
  ok(mod.apontada === 1, `a seta à esquerda devia voltar para 1 e foi para ${mod.apontada}`);

  // A BEIRADA NÃO DÁ A VOLTA. Circular, o cursor some de um canto e reaparece no outro —
  // e quem joga sem ver a tela perde a única referência que tem de onde está.
  for (let i = 0; i < 30; i++) fire('keydown', { key: 'ArrowLeft' });
  frames(1);
  ok(mod.apontada === 0, `trinta setas à esquerda deviam parar na beirada 0 e pararam em ${mod.apontada}`);
  for (let i = 0; i < 40; i++) fire('keydown', { key: 'ArrowRight' });
  frames(1);
  ok(mod.apontada === mod.naMao.length - 1,
    `quarenta setas à direita deviam parar na última peça (${mod.naMao.length - 1}) e pararam em ${mod.apontada}`);

  // MEXER O PONTEIRO LARGA O TECLADO. Sem esta regra os dois donos do `apontada` brigam a
  // 60 quadros por segundo e o cursor de teclado é apagado no quadro seguinte ao de nascer.
  fire('pointermove', { clientX: 5, clientY: 5 });
  frames(1);
  ok(mod.apontada === null, 'mexer o ponteiro devia ter largado o cursor de teclado');

  // O NÚMERO ESCOLHE. Procuro uma peça jogável para não depender do sorteio.
  const jogavel = mod.naMao.findIndex(m => m.jogavel);
  ok(jogavel >= 0 && jogavel < 9, 'o cenário não deu peça jogável ao alcance das teclas 1..9');
  if (jogavel >= 0 && jogavel < 9) {
    mod.cancelarEscolha();
    tecla(String(jogavel + 1));
    ok(mod.escolhida === mod.chave(mod.naMao[jogavel].peca),
      `a tecla ${jogavel + 1} devia ter levantado a peça ${mod.naMao[jogavel].peca.join('|')}`);
    // A mesma tecla de novo larga a peça, como o segundo toque nela.
    tecla(String(jogavel + 1));
    ok(mod.escolhida === null, 'apertar a mesma tecla de novo devia ter cancelado a escolha');
  }

  // O SILÊNCIO É O DEFEITO, NÃO A RECUSA. `selecionarPeca` desiste calada quando a peça
  // não dá — no mouse quem explica é o `soltarArrasto`. Sem uma linha equivalente aqui, o
  // teclado apertaria o número e não aconteceria nada, para sempre, sem uma palavra.
  const naoDa = mod.naMao.findIndex(m => !m.jogavel);
  if (naoDa >= 0 && naoDa < 9) {
    mod.cancelarEscolha();
    aviso.textContent = '';
    tecla(String(naoDa + 1));
    ok(mod.escolhida === null, 'a tecla de uma peça que não dá não podia ter levantado nada');
    ok(aviso.textContent === mod.porQueNaoDa(mod.naMao[naoDa].peca),
      `a peça que não dá devia dizer POR QUE, e o aviso ficou "${aviso.textContent}"`);
  }

  // ESCREVER NA CONVERSA NÃO É JOGAR. O projeto já pagou isto uma vez com o 'a' de
  // arrumar e o 'd' de dica (160-loop.js): com um campo na tela, digitar "vamos" chamava
  // arrumarMao() a cada 'a'. Um caminho novo de teclado herda a mesma armadilha, e agora
  // ela é pior — os dígitos aparecem em qualquer texto.
  mod.cancelarEscolha();
  fire('keydown', { key: String(jogavel + 1), target: { tagName: 'INPUT' } });
  frames(1);
  ok(mod.escolhida === null, 'digitar um número dentro do campo da conversa escolheu uma peça');
}

// O painel de contagem tinha asserção só nas suítes de TELA, e lá a pergunta é se ele
// cobre a mesa — nunca se ele conta certo. É a ferramenta com que se decide a jogada:
// contar errado é pior que não contar, porque quem não conta desconfia e quem conta errado
// acredita.
console.log('\no painel de contagem conta certo');
{
  const painel = els.get('contagem');
  // Liga a contagem pelo botão, que é o caminho de verdade — `contando` é estado de
  // módulo e não dá para escrever de fora.
  if (painel.classList.contains('oculta')) els.get('btContagem').onclick();

  // Lê o painel de volta como uma tabela. Cada linha é <b>número</b><i>barrinha</i>
  // <s>faltam</s><em>quem passou</em>, e o `zerado` é a classe da linha.
  const ler = () => {
    const linhas = {};
    const re = /<div( class="zerado")?><b>(\d)<\/b><i>([^<]*)<\/i><s>([^<]*)<\/s><em>([^<]*)<\/em><\/div>/g;
    let m;
    while ((m = re.exec(painel.innerHTML))) {
      linhas[m[2]] = { zerado: !!m[1], vistos: (m[3].match(/▮/g) || []).length,
                       total: m[3].length, faltam: m[4], quemPassou: m[5] };
    }
    return linhas;
  };

  // O TOTAL NÃO É 7 FIXO, e este é o caso que a leitura de código erra: no Trio o 0|0 sai
  // do baralho, então o zero mora em SEIS peças e todos os outros números em sete. Um
  // painel que diga "faltam 7 zeros" no Trio manda o jogador esperar uma peça que não
  // existe — e é o tipo de erro que só aparece jogando.
  {
    const vista = {
      modo: 'trio', cadeira: 0, linha: [], mao: [], faltaNo: [[], [], []],
      cadeiras: [{ nome: 'eu' }, { nome: 'Zé' }, { nome: 'Ana' }],
    };
    mod.painelDoJogo(vista);
    const t = ler();
    ok(t['0'] && t['0'].total === 6,
      `no Trio o zero mora em 6 peças (o 0|0 sai do baralho) e o painel disse ${t['0'] && t['0'].total}`);
    ok(t['6'] && t['6'].total === 7,
      `no Trio os outros números continuam em 7 peças e o painel disse ${t['6'] && t['6'].total}`);
    ok(t['0'] && t['0'].faltam === '6', `o zero devia faltar 6 e o painel disse ${t['0'] && t['0'].faltam}`);
  }

  // O QUE JÁ APARECEU É A MESA MAIS A SUA MÃO. As duas, e é de propósito: a peça na sua
  // mão não vai sair do baralho para ninguém, então contá-la é o que torna a conta útil.
  {
    const vista = {
      modo: 'classico', cadeira: 0,
      linha: [[3, 3], [3, 5], [5, 6]],       // três 3, um 5, um 6 — e o 3|3 conta UMA vez
      mao: [[3, 0], [6, 6]],                 // mais um 3, mais um 6
      faltaNo: [[], [], []],
      cadeiras: [{ nome: 'eu' }, { nome: 'Zé' }, { nome: 'Ana' }],
    };
    mod.painelDoJogo(vista);
    const t = ler();
    // Peças com o 3: 3|3, 3|5, 3|0 = três peças. O 3|3 é UMA peça, não duas — contar por
    // metade daria quatro e o painel mentiria a favor do jogador.
    ok(t['3'].vistos === 3, `deviam ter aparecido 3 peças com o número 3 e o painel disse ${t['3'].vistos}`);
    ok(t['3'].faltam === '4', `deviam faltar 4 peças com o 3 e o painel disse ${t['3'].faltam}`);
    ok(t['6'].vistos === 2, `o 5|6 da mesa e o 6|6 da mão são 2, e o painel disse ${t['6'].vistos}`);
    ok(t['1'].vistos === 0 && t['1'].faltam === '7', 'o número que ninguém viu tem de mostrar os 7 inteiros');
  }

  // A LINHA ZERADA. Quando todas as sete apareceram não há mais nada a esperar daquele
  // número — o painel apaga a linha e o traço vira '—'. É informação, não enfeite: é ela
  // que diz "essa ponta está morta".
  {
    const todosOs2 = [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6]];
    const vista = {
      modo: 'classico', cadeira: 0, linha: todosOs2, mao: [], faltaNo: [[], [], []],
      cadeiras: [{ nome: 'eu' }, { nome: 'Zé' }, { nome: 'Ana' }],
    };
    mod.painelDoJogo(vista);
    const t = ler();
    ok(t['2'].zerado, 'o número que apareceu inteiro tinha de vir marcado como zerado');
    ok(t['2'].faltam === '—', `zerado, o "faltam" vira um traço, e veio "${t['2'].faltam}"`);
    ok(!t['5'].zerado, 'um número com peça faltando não podia estar marcado como zerado');
  }

  // QUEM PASSOU NUM NÚMERO provou não tê-lo, e isso é público — a mesa inteira viu o
  // passe. Mas VOCÊ nunca entra nessa lista: o painel é para saber dos outros, e ler o
  // próprio nome ali seria ruído no lugar do sinal.
  {
    const vista = {
      modo: 'classico', cadeira: 0, linha: [], mao: [],
      faltaNo: [[4], [4], [4]],              // os TRÊS passaram no 4, inclusive você
      cadeiras: [{ nome: 'eu' }, { nome: 'Zé' }, { nome: 'Ana' }],
    };
    mod.painelDoJogo(vista);
    const t = ler();
    ok(t['4'].quemPassou === 'Zé, Ana',
      `deviam aparecer só os outros dois, e o painel disse "${t['4'].quemPassou}"`);
    ok(t['4'].quemPassou.indexOf('eu') < 0, 'o painel listou VOCÊ como quem passou no número');
  }

  // O NOME DO CONVIDADO É ENTRADA DE FORA, e aqui ele vai para innerHTML. É a quarta
  // superfície do projeto a receber nome alheio (as outras: listarSala, o cartão do
  // jogador, e o value= do menu), e as três anteriores foram mordidas.
  {
    const vista = {
      modo: 'classico', cadeira: 0, linha: [], mao: [], faltaNo: [[], [6], []],
      cadeiras: [{ nome: 'eu' }, { nome: '<img src=x onerror=alert(1)>' }, { nome: 'Ana' }],
    };
    mod.painelDoJogo(vista);
    ok(painel.innerHTML.indexOf('<img') < 0,
      'o nome do convidado virou um elemento dentro do painel de contagem');
    ok(painel.innerHTML.indexOf('&lt;img') >= 0, 'o nome devia ter saído escapado, e não sumido');
  }
}

// O <select> de cadeira é COMO SE ESCOLHE CONTRA QUEM JOGAR, e não tinha asserção
// nenhuma. Ele tem duas metades: o que o menu DESENHA e o que o `onchange` GRAVA. Só a
// primeira é alcançável aqui — o harness não constrói elementos a partir de innerHTML,
// então o handler nunca é ligado (`querySelectorAll` devolve vazio). Está dito de frente
// em vez de contornado: a segunda metade continua sem cobertura, e o lugar de pagá-la é
// o `test-online.mjs`, que roda num Chrome de verdade.
//
// A metade que dá para exigir é justamente a do defeito que este projeto já pagou uma vez:
// os botões do menu nasciam marcados com o PADRÃO e a marca não andava até a preferência
// lembrada, então a tela prometia "Clássico até 6" e a partida começava num Trio até 10.
// `refletirMesaNosBotoes` existe por causa disso. O <select> tem a mesma armadilha —
// a marca `selected` sai de uma string montada à mão (`'bot:' + c.nivel`), e se ela
// discordar do que está em MESA, o jogo está certo e a tela mente.
console.log('\no select de cadeira mostra o que está valendo');
{
  const caixa = els.get('cadeiras');
  // Qual opção está marcada na cadeira `i`, lida do HTML que o menu acabou de escrever.
  const marcada = i => {
    const bloco = caixa.innerHTML.split(`<select data-i="${i}">`)[1];
    if (!bloco) return null;
    const m = /<option value="([^"]+)" selected>/.exec(bloco.split('</select>')[0]);
    return m ? m[1] : null;
  };

  mod.MESA.modo = 'classico'; mod.MESA.n = 4;
  const combinacoes = [
    ['bot', 'facil', 'bot:facil'],
    ['bot', 'normal', 'bot:normal'],
    ['bot', 'dificil', 'bot:dificil'],
    ['local', undefined, 'local'],
    ['online', undefined, 'online'],
  ];
  for (const [tipo, nivel, esperado] of combinacoes) {
    mod.MESA.cadeiras[1].tipo = tipo;
    mod.MESA.cadeiras[1].nivel = nivel;
    mod.montarCadeiras();
    ok(marcada(1) === esperado,
      `cadeira ${tipo}${nivel ? '/' + nivel : ''} devia aparecer marcada como "${esperado}" e veio "${marcada(1)}"`);
  }

  // UMA MARCA SÓ. Duas opções com `selected` é HTML que o navegador resolve escolhendo a
  // última — e aí a tela mostraria um bot difícil onde MESA guarda um fácil.
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.montarCadeiras();
  const bloco1 = caixa.innerHTML.split('<select data-i="1">')[1].split('</select>')[0];
  ok((bloco1.match(/ selected>/g) || []).length === 1,
    `a cadeira devia ter exatamente uma opção marcada e tem ${(bloco1.match(/ selected>/g) || []).length}`);

  // A CADEIRA 0 NÃO TEM <select>: ela é sempre você, nesta tela. Um seletor ali deixaria
  // montar uma mesa sem ninguém do lado de cá — e o motor esperaria para sempre.
  ok(caixa.innerHTML.indexOf('<select data-i="0">') < 0,
    'a cadeira 0 é sempre você e não podia ter seletor de tipo');

  // A COMPRA LIVRE onde não há monte é a mesma história do `onchange` logo acima: o
  // `disabled` dos botões precisa de um DOM de verdade e mora no test-online. O que dá para
  // exigir daqui é que a preferência SOBREVIVA a uma passada por um modo sem monte — quem
  // joga Clássico de 2 com compra livre e espia o Duelo espera a marca de volta ao voltar.
  {
    mod.MESA.modo = 'classico'; mod.MESA.n = 2; mod.MESA.compraVoluntaria = true;
    mod.MESA.modo = 'duelo'; mod.MESA.n = 2; mod.ajustarOpcoesAoModo();
    ok(mod.MESA.compraVoluntaria === true,
      'passar por um modo sem monte apagou a preferência de compra livre');
  }

  // AS OPÇÕES SÃO AS MESMAS EM TODA CADEIRA, e o número delas é o que o menu promete.
  // Uma cadeira com menos opções que outra seria a mesma classe de mentira, por omissão.
  for (const i of [1, 2, 3]) {
    const b = caixa.innerHTML.split(`<select data-i="${i}">`)[1];
    ok(b && (b.split('</select>')[0].match(/<option /g) || []).length === 5,
      `a cadeira ${i} devia oferecer as 5 opções de sempre`);
  }
}

// ─── a barra de ações do dominó ──────────────────────────────────────────────
// Ela virou ENCAIXE na v4.5 (`JOGO.hud.barra`), e até então não tinha uma linha de teste:
// "Comprar do monte" e "Passar a vez" estavam escritos no `src/pagina.html`, e um
// `classList.toggle('oculta', …)` invertido não derrubava suíte nenhuma. Agora a barra é
// DADO — uma lista de botões que o jogo devolve —, e dado se confere.
console.log('\na barra de ações oferece o que o motor aceita');
{
  const rotulos = (comprar, passar, jogadas) =>
    mod.JOGO.hud.barra({ acoes: { comprar, passar, jogadas } }).map(b => b.rotulo.toLowerCase());

  ok(rotulos(false, false, [{}]).length === 0,
    'a barra ofereceu botão sem haver o que comprar nem o que passar');
  ok(rotulos(true, false, [{}]).some(r => r.includes('comprar')), 'faltou "Comprar do monte"');
  ok(rotulos(false, true, []).some(r => r.includes('passar')), 'faltou "Passar a vez"');
  ok(!rotulos(false, true, []).some(r => r.includes('comprar')),
    'ofereceu comprar onde o motor não oferece — botão que promete e não cumpre');

  // "QUANDO A ÚNICA SAÍDA É COMPRAR, O BOTÃO PRECISA GRITAR." A regra é do dominó, e ela veio
  // junto com o botão quando ele saiu do HTML da casa — sem ela, o jogador travado não tem
  // para onde olhar.
  const travado = mod.JOGO.hud.barra({ acoes: { comprar: true, passar: false, jogadas: [] } });
  ok(travado[0] && travado[0].principal === true,
    'comprar sem jogada nenhuma devia ser o botão principal');
  const comJogada = mod.JOGO.hud.barra({ acoes: { comprar: true, passar: false, jogadas: [{}] } });
  ok(comJogada[0] && !comJogada[0].principal,
    'comprar virou principal mesmo havendo jogada — a ênfase perde o sentido');

  // E A INTENÇÃO CHEGA PRONTA: a casa a devolve ao motor sem olhar dentro, e é isso que faz
  // o mesmo `#acoes` servir a "Passar a vez" e a "Pedir seis".
  ok(travado[0] && travado[0].acao && travado[0].acao.acao === 'comprar',
    'o botão não trouxe a intenção pronta');
}

// Sensibilidade vestibular não é preferência estética: para quem tem, movimento na tela dá
// enjoo de verdade. E a asserção NÃO pode ser "a variável virou true" — isso testaria o
// interruptor, não a luz. O que se exige aqui é que o movimento PARE: a lâmpada segurando
// o mesmo valor entre dois quadros, e a peça já estando no lugar em vez de deslizar.
console.log('\nquem pediu menos movimento');
{
  const CONSULTA = '(prefers-reduced-motion: reduce)';
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();
  frames(30);

  const luz = () => mod.bulbo.material.color.getHSL({}).l;
  // Duas leituras separadas por quadros: a lâmpada oscila por seno do relógio, e o
  // `performance.now()` do harness AVANÇA a cada chamada, então quadros diferentes são
  // instantes diferentes de verdade.
  const oscila = () => { const a = luz(); frames(12); return Math.abs(luz() - a); };

  preferir(CONSULTA, false);
  ok(mod.movimentoReduzido() === false, 'montagem: a preferência devia começar desligada');
  const balancoNormal = oscila();
  ok(balancoNormal > 0, 'montagem: sem a preferência, a lâmpada tinha de estar respirando');

  preferir(CONSULTA, true);
  ok(mod.movimentoReduzido() === true,
    'ligar a preferência não chegou ao jogo — a MediaQueryList guardada não é viva');
  // UM QUADRO PARA ASSENTAR, e não é frescura: medir logo depois de ligar captura a
  // PRÓPRIA TRANSIÇÃO do valor oscilante para o valor parado, que é uma diferença real e
  // não é oscilação. A pergunta é "continua se mexendo?", e ela só faz sentido depois de
  // o novo regime começar.
  frames(2);
  // Guardado numa variável em vez de chamado duas vezes: `oscila()` GASTA QUADROS, então
  // chamá-lo de novo dentro da mensagem de erro mediria outro intervalo e a mensagem
  // contaria uma história diferente da que reprovou.
  const balancoParado = oscila();
  ok(balancoParado === 0,
    `com a preferência ligada a lâmpada tinha de PARAR, e ela varia ${balancoParado}`);

  // E A PEÇA NÃO DESLIZA: ela já está no lugar. Tiro a mão do lugar à força e peço UM
  // quadro — com suavização ela chegaria perto, sem suavização ela chega. A diferença
  // entre "perto" e "no lugar" é o item inteiro.
  {
    const m = mod.naMao[0];
    m.obj.position.x = m.xBase + 5;
    frames(1);
    ok(m.obj.position.x === m.xBase,
      `sem movimento a peça tinha de estar no lugar já no primeiro quadro, e ficou a ${(m.obj.position.x - m.xBase).toFixed(3)}`);
  }

  // DESLIGAR VOLTA A ANIMAR, no mesmo processo e sem recarregar nada. É o que prova que a
  // preferência é LIDA a cada quadro e não decidida uma vez na carga — quem muda a
  // configuração do sistema com o jogo aberto não devia precisar recarregar.
  preferir(CONSULTA, false);
  {
    const m = mod.naMao[0];
    m.obj.position.x = m.xBase + 5;
    frames(1);
    ok(m.obj.position.x !== m.xBase, 'desligar a preferência não devolveu a suavização');
  }
  const balancoDeVolta = oscila();
  ok(balancoDeVolta > 0, `desligar a preferência não fez a lâmpada voltar a respirar (varia ${balancoDeVolta})`);
}

// O PRAZO DE QUEM CAI, ESGOTANDO. Havia asserção de cair e VOLTAR (no test-online, com
// abas de verdade) e nenhuma de cair e NÃO voltar — que é justamente o ramo que faz o
// prazo significar alguma coisa. Sem ele, "a cadeira fica guardada por 30 s" seria uma
// promessa sem consequência, e fechar a aba voltaria a ser a saída de emergência de
// qualquer partida perdida.
//
// Não custa 30 segundos: o `setTimeout` do harness é uma fila que o teste drena com
// `correrTimers()`. O relógio de parede nunca entra nisto, e é por isso que esta asserção
// pode viver na suíte rápida em vez de na de navegador.
// Uma conexão de mentira que ANOTA o que recebeu. O que ela manda de volta importa: é
// por `expulso`/`cheio` que o jogo conversa com quem está do outro lado.
//
// Ela e o `montar()` abaixo moram FORA dos blocos que os usam porque três assuntos
// diferentes precisam da mesma mesa online de mentira: o prazo de quem cai, o desempate de
// nomes e o voltar depois de sair. Copiar a montagem em cada bloco é como duas cópias
// passam a discordar — foi literalmente o defeito 3 da Fila 6.
// `open: true` NÃO É ENFEITE, e a falta dele já valeu uma asserção que não podia falhar:
// `espalharVistas` e `espalharLog` conferem `conn.open` antes de mandar, então um dublê sem
// esse campo recebe o `sentou` e o `cheio` (mandados direto na conn) e NUNCA recebe vista
// nenhuma. A asserção "não mandaram a partida acabada para quem acabou de sentar" ficava
// verde por trivialidade, e a conferência por mutação foi quem contou. É a mesma lição que
// esta casa já pagou com o matchMedia, a captura de ponteiro, o AudioContext, o Peer, os
// eventos de contexto WebGL, o setAttribute, o preventDefault e o matchMedia de novo: quem
// estava incompleto era o dublê, não o jogo.
// E o `on` também GRAVA, pelo mesmo motivo do parágrafo acima levado até o fim: ele era
// `() => {}` e engolia o registro, então o `conn.on('data')` que o anfitrião instala dentro
// do `peer.on('connection')` não tinha como ser dirigido daqui. Era esse o buraco por onde
// entraram o C3, o C4 e o C7 da Fila 11 — nenhuma linha de teste jamais entregou uma
// mensagem malformada à mesa. Quem dispara é o teste, nunca o dublê sozinho.
const novaConn = () => { const c = { enviadas: [], fechada: false, open: true, ouvintes: new Map() }; Object.assign(c, {
  send: m => c.enviadas.push(m), close: () => { c.fechada = true; c.open = false; },
  on(evento, cb) { if (!c.ouvintes.has(evento)) c.ouvintes.set(evento, []); c.ouvintes.get(evento).push(cb); return c; },
  disparar(evento, ...args) { const cbs = c.ouvintes.get(evento) || []; cbs.forEach(cb => cb(...args)); return cbs.length; },
}); return c; };

const montarMesaOnline = () => {
  mod.encerrarRede();
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  // COMEÇA DE UMA PARTIDA VIVA. `sentar()` publica, e publicar lê o `P` que estiver de pé —
  // inclusive um deixado por outro bloco. O bloco do prazo põe `P.fase = 'fim'` na mão para
  // testar o relógio disparando tarde, e aquilo é um estado que o jogo não produz (fim sem
  // resultado e sem desistente): a montagem seguinte estourava dentro do HUD, longe daqui.
  // É a mesma regra que as cenas do test-online já seguem — cada uma diz o que quer.
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
  mod.comecarLocal();
  mod.MESA.cadeiras[1].tipo = 'online'; mod.MESA.cadeiras[1].nome = 'Visita';
  mod.MESA.cadeiras[1].vagaOnline = false;
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
  mod.abrirMesaOnline();
  const conn = novaConn();
  const cadeira = mod.sentar(conn, 'cliente-A', 'Visita');
  // A partida SÓ nasce com a cadeira online de pé porque `conexoes` já tem alguém nela —
  // `comecarLocal` converte em bot toda cadeira online sem ninguém vivo do outro lado.
  mod.comecarLocal();
  return { conn, cadeira };
};

console.log('\no prazo de quem cai, esgotando');
{
  const montar = montarMesaOnline;
  {
    const { conn, cadeira } = montar();
    ok(cadeira === 1, `a visita devia sentar na cadeira 1 e sentou na ${cadeira}`);
    ok(mod.P.cadeiras[1].tipo === 'online',
      'montagem: a cadeira tinha de continuar online, senão não há queda para testar');

    mod.largar(cadeira, conn);
    // ENQUANTO O PRAZO CORRE, a cadeira é DELE e a partida continua de pé. A conexão saiu,
    // a reserva não: era exatamente esta a diferença que faltava no item 4 da Fila 5, onde
    // um estranho com o código sentava na cadeira de quem tinha acabado de cair.
    ok(!mod.conexoes.has(1), 'a conexão devia ter saído na hora da queda');
    ok(mod.donoDaCadeira.has(1), 'a cadeira devia continuar RESERVADA enquanto o prazo corre');
    ok(mod.esperando.has(1), 'o relógio dos 30s não foi armado');
    ok(mod.P.fase !== 'fim', 'a partida não podia acabar no instante da queda — há prazo para voltar');
    ok(mod.P.desistiu === null, 'ninguém desistiu ainda: o prazo mal começou');

    // ...E O PRAZO ESGOTA.
    correrTimers();
    ok(mod.P.fase === 'fim', `esgotado o prazo, a partida tinha de encerrar, e a fase é "${mod.P.fase}"`);
    ok(mod.P.desistiu === 1, `quem não voltou tinha de constar como desistente, e consta ${mod.P.desistiu}`);
    ok(!mod.donoDaCadeira.has(1), 'não voltou: a cadeira devia deixar de ser dele');
    ok(!mod.esperando.has(1), 'o relógio devia ter se apagado ao disparar');
  }

  // O PAR, e é ele que separa "o prazo funciona" de "o prazo é um pavio que sempre
  // queima": voltando ANTES, o relógio é desarmado e o disparo nunca acontece. Uma
  // asserção sem a outra deixaria passar tanto o prazo que não encerra quanto o prazo que
  // encerra mesmo com a pessoa de volta na cadeira.
  {
    const { conn, cadeira } = montar();
    mod.largar(cadeira, conn);
    ok(mod.esperando.has(1), 'montagem: o relógio tinha de estar armado');

    const volta = novaConn();
    const deVolta = mod.sentar(volta, 'cliente-A', 'Visita');
    ok(deVolta === 1, `voltando com o mesmo id devia ser a MESMA cadeira, e veio ${deVolta}`);
    ok(!mod.esperando.has(1), 'voltar dentro do prazo tinha de desarmar o relógio');

    correrTimers();
    // SÃO DOIS GUARDAS INDEPENDENTES, e a mutação mostrou isso: desligando o `clearTimeout`
    // do `sentar`, só a asserção de cima reprova — estas duas continuam verdes, porque o
    // próprio callback confere `conexoes.has(cadeira)` antes de encerrar a partida. Ou
    // seja, o desfecho está protegido duas vezes e por isso não distingue qual guarda
    // caiu; quem distingue é o `esperando` acima. As três juntas dizem a coisa toda, e é
    // por isso que nenhuma delas sai.
    ok(mod.P.fase !== 'fim', 'quem voltou dentro do prazo não podia perder a partida');
    ok(mod.P.desistiu === null, `voltou a tempo e mesmo assim consta como desistente (${mod.P.desistiu})`);
  }

  // E A PARTIDA QUE JÁ ACABOU não pode ser encerrada de novo pelo relógio de alguém que
  // caiu antes. `abandonar` recusa partida em `fim`, mas quem depende disso é este
  // callback — e ele roda 30 s depois, quando a mesa pode ter mudado inteira.
  {
    const { conn, cadeira } = montar();
    mod.largar(cadeira, conn);
    mod.P.fase = 'fim';
    correrTimers();
    ok(mod.P.desistiu === null,
      'o relógio de quem caiu marcou desistência numa partida que já tinha acabado');
  }

  mod.encerrarRede();
}

// DOIS JOGADORES COM O MESMO NOME. O caso de campo é o mais simples que existe: ninguém
// trocou o nome, os dois chegaram com o padrão, e a mesa ficou com o mesmo nome nos dois
// lados do placar, nos dois cartões e no começo de toda linha da conversa.
//
// A função é PURA e mora no escopo concatenado, então a prova fina cabe aqui, em
// milissegundos — o Chrome do test-online fica só com a ida e volta pelo fio, que é o que
// só dá para provar com duas abas de verdade. Lógica no Node, sessão no Chrome.
// QUEM SAIU DE PROPÓSITO CONSEGUE VOLTAR. Relato de campo: o convidado saiu da sala e não
// conseguiu voltar, com a sala ainda aberta. São dois defeitos somados num sintoma só, e
// este bloco cobre o segundo — o pior: o anfitrião clica Revanche, a cadeira do que saiu
// vira bot (e tem de virar mesmo, senão a mesa nasce esperando quem não responde: é o
// defeito 3 da Fila 6), e a partir daí ela nunca mais volta a ser de gente. Quem tenta
// voltar ouve "essa mesa já está cheia" com um bot improvisado sentado na vaga dele.
console.log('\nquem saiu de propósito consegue voltar');
{
  // Sair é `desisto` E o link caindo logo atrás — o convidado manda a mensagem e o peer
  // dele morre. Uma coisa sem a outra não é o que acontece na vida real: sem o `largar`, a
  // conexão continua em `conexoes` e a revanche nem chega a converter a cadeira.
  const montar = () => {
    const r = montarMesaOnline();
    mod.desistiuDaMesa(r.cadeira);
    mod.largar(r.cadeira, r.conn);
    return r;
  };

  // SEM REVANCHE: a cadeira ainda é `online`, ele volta, e a derrota que ele entregou FICA.
  // Sair entrega a partida, não a mesa — voltar é para a próxima.
  {
    const { cadeira } = montar();
    ok(mod.P.desistiu === cadeira, 'montagem: sair de propósito tinha de contar como derrota');
    ok(!mod.donoDaCadeira.has(1), 'montagem: quem sai de propósito perde a RESERVA da cadeira');

    const volta = novaConn();
    ok(mod.sentar(volta, 'cliente-A', 'Visita') === cadeira,
      'a mesa ainda estava aberta e mesmo assim não deixou voltar');
    ok(mod.P.desistiu === cadeira, 'voltar para a mesa desfez a derrota de quem tinha saído');
    // E ELE NÃO LEVA A VISTA DA DERROTA NA CARA. Quem chega entre duas partidas fica no
    // saguão: a partida acabada não é publicada, e o `sentou` diz que a espera é essa.
    ok(volta.enviadas.some(m => m.t === 'sentou' && m.esperando === true),
      'quem sentou depois do fim não foi avisado de que está esperando a próxima');
    ok(!volta.enviadas.some(m => m.t === 'vista'),
      'a mesa mandou a partida ACABADA para quem acabou de sentar — ele cai na tela da derrota dele');
  }

  // COM REVANCHE: a cadeira virou bot, e é aqui que o beco sem saída morava.
  {
    const { cadeira } = montar();
    els.get('btRevanche').onclick();
    ok(mod.P.cadeiras[1].tipo === 'bot',
      'montagem: sem ninguém vivo a cadeira tinha de virar bot, senão a mesa congela (Fila 6)');
    ok(mod.MESA.cadeiras[1].vagaOnline === true,
      'a cadeira virou bot sem lembrar que era uma VAGA de gente — e vaga esquecida não volta');

    const volta = novaConn();
    const deVolta = mod.sentar(volta, 'cliente-A', 'Visita');
    ok(deVolta === 1, `voltar depois de sair devia devolver a cadeira 1, e veio ${deVolta}`);
    ok(!volta.enviadas.some(m => m.t === 'cheio'),
      'a mesa respondeu "cheia" com um bot improvisado sentado na vaga de quem tentou voltar');
    ok(mod.MESA.cadeiras[1].tipo === 'online' && mod.P.cadeiras[1].tipo === 'online',
      'sentou e a cadeira continuou bot: o relógio do bot e a pessoa viram dois donos da mesma vez');
    // A vaga foi CONSUMIDA: com a marca de pé, a próxima revanche a converteria de novo em
    // bot mesmo com o jogador vivo do outro lado.
    ok(mod.MESA.cadeiras[1].vagaOnline === false,
      'a marca de vaga sobreviveu a alguém ocupá-la — a cadeira já tem dono de novo');
  }

  // O BOT LARGA A VEZ DE QUEM VOLTOU. Reconverter só o `MESA` deixaria `P.cadeiras[1]`
  // dizendo 'bot', e o relógio continuaria jogando por cima da pessoa que acabou de sentar.
  {
    const { cadeira } = montar();
    els.get('btRevanche').onclick();
    // Até chegar a vez da cadeira que virou bot, jogando pelas outras.
    for (let i = 0; i < 40 && mod.P.vez !== cadeira; i++) {
      mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
    }
    ok(mod.P.vez === cadeira, 'montagem: era para a vez ter chegado na cadeira que virou bot');
    mod.sentar(novaConn(), 'cliente-A', 'Visita');
    const antes = mod.P.maos[cadeira].length;
    correrTimers();                          // drena o relógio do bot que já estava agendado
    ok(mod.P.maos[cadeira].length === antes && mod.P.vez === cadeira,
      'o bot jogou pela cadeira de quem acabou de voltar — a mão mudou sozinha');
  }

  // A MESA DIZ A VERDADE QUANDO RECUSA. Um `t:'cheio'` para três situações diferentes é o
  // que fazia a mesa afirmar "já está cheia" com uma cadeira VAZIA à espera. Recusar está
  // certo nos três casos; mentir o motivo é o que faz quem tentou desistir de tentar.
  {
    const { conn, cadeira } = montarMesaOnline();
    const cheia = novaConn();
    ok(mod.sentar(cheia, 'cliente-Z', 'Zé') === -1, 'montagem: a mesa estava cheia mesmo');
    ok(cheia.enviadas.some(m => m.porque === 'cheio'),
      'mesa realmente cheia tinha de dizer que está cheia, e com esse motivo');

    mod.largar(cadeira, conn);               // caiu: a cadeira fica RESERVADA por 30s
    const naJanela = novaConn();
    mod.sentar(naJanela, 'cliente-Z', 'Zé');
    ok(naJanela.enviadas.some(m => m.porque === 'guardadas'),
      'a mesa disse "cheia" para uma cadeira VAZIA, guardada para quem caiu');

    mod.encerrarRede();
    mod.MESA.n = 3;
    mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
    mod.MESA.cadeiras[1].vagaOnline = false;
    mod.abrirMesaOnline();
    const semVaga = novaConn();
    mod.sentar(semVaga, 'cliente-Z', 'Zé');
    ok(semVaga.enviadas.some(m => m.porque === 'semvaga'),
      'mesa sem cadeira de visitante tinha de dizer isso, e não "cheia"');
  }

  mod.encerrarRede();
}

console.log('\ndois jogadores com o mesmo nome');
{
  const u = (n, ...ocupados) => mod.nomeUnico(n, ocupados);

  ok(u('Zé', 'Tião') === 'Zé', `nome que não colide não podia mudar, e virou "${u('Zé', 'Tião')}"`);
  ok(u('Zé', 'Zé') === 'Zé2', `o segundo "Zé" tinha de virar "Zé2", e veio "${u('Zé', 'Zé')}"`);
  ok(u('Zé', 'Zé', 'Zé2') === 'Zé3', `o terceiro tinha de pular o Zé2, e veio "${u('Zé', 'Zé', 'Zé2')}"`);
  // Caixa e espaço nas pontas não fazem duas pessoas: para quem lê a mesa é o mesmo nome.
  ok(u('ricardo', 'Ricardo ') !== 'ricardo',
    'trocar a caixa do nome burlava o desempate — para quem lê a mesa os dois são o mesmo');

  // O NÚMERO NO PRIMEIRO NOME, e esta é a asserção que grava a decisão. `nomeEmPartes`
  // (130-hud.js) esconde tudo depois do primeiro espaço em tela estreita, então
  // "Ana Paula 2" volta a ser "Ana" na lista — os dois cartões iguais outra vez,
  // justamente no retrato de quatro, que é onde a confusão dói. Se alguém "simplificar"
  // para sufixo no fim, esta linha cai.
  const anas = u('Ana Paula', 'Ana Paula');
  ok(/^Ana2/.test(anas), `o desempate tinha de entrar no primeiro nome, e veio "${anas}"`);

  // E CABE NOS 14. Quem encolhe é a base, nunca o desempate: um sufixo comido pelo corte
  // devolve dois nomes iguais, que é o defeito de volta em silêncio.
  const longo = 'Sebastiãozinho';                    // 14 na bala, o máximo que o menu deixa
  const apertado = u(longo, longo);
  ok(apertado.length <= 14, `o desempate estourou o corte de 14: "${apertado}" tem ${apertado.length}`);
  ok(apertado !== longo, 'o desempate foi comido pelo corte de 14 e os dois nomes ficaram iguais');

  // E o mesmo com sobrenome: é a base que cede, não o número nem o resto.
  const dois = u('Sebastião Jr', 'Sebastião Jr');
  ok(dois.length <= 14 && dois !== 'Sebastião Jr' && /\d/.test(dois),
    `nome longo com sobrenome não desempatou direito: "${dois}"`);

  // O SOBRENOME SAI INTEIRO quando não cabe — nada de palavra cortada pela metade
  // ("Maria2 Fernand"). É decisão do Ricardo, 04/08/2026, e nenhuma leitura de código
  // chega a ela: o primeiro nome é a única parte que o cartão mostra em tela estreita,
  // então o pedaço que sobra tem de ser um nome de gente, não um toco.
  const maria = u('Maria Fernanda', 'Maria Fernanda');       // 14 na bala; com o número, 15
  ok(maria === 'Maria2', `o sobrenome tinha de sair inteiro, e veio "${maria}"`);

  // ESTÁVEL ENTRE CHAMADAS, e é o que faz o `{t:'nome'}` (150-rede.js) ser seguro: ele
  // reentra aqui a cada troca de nome em partida, e não só ao sentar. Funciona porque
  // `nomesVizinhos` exclui a própria cadeira — quem passar a mesa TODA cria um ratchet
  // "Ricardo2" → "Ricardo22" → "Ricardo222" que só aparece na segunda troca.
  let quemSou = u('Ricardo', 'Dona da mesa', 'Ricardo');
  for (let i = 0; i < 4; i++) quemSou = u('Ricardo', 'Dona da mesa', 'Ricardo');
  ok(quemSou === 'Ricardo2', `renomear repetido acumulou número: "${quemSou}"`);

  // A colisão que o PRÓPRIO ENCOLHIMENTO cria. Sem conferir o candidato já cortado, o
  // "Sebastiãozinho" que chega vira "Sebastiãozinho2", que cortado em 14 é
  // "Sebastiãozinh2" — o outro vizinho, de novo e em silêncio.
  const terceiro = u('Sebastiãozinho', 'Sebastiãozinho', 'Sebastiãozinh2');
  ok(terceiro !== 'Sebastiãozinh2' && terceiro.length <= 14,
    `o corte em 14 fabricou uma colisão nova: "${terceiro}"`);
}

console.log('\no mudo tem de durar');
{
  // O mudo é implementado suspendendo o AudioContext, e o listener de pointerdown que
  // existe para destravar o áudio (navegador exige um gesto) retomava o contexto em
  // QUALQUER toque, sem perguntar se o jogador tinha pedido silêncio. Resultado: clicar em
  // ♪ calava, e o toque seguinte religava tudo — com o botão ainda mostrando ✕. O silêncio
  // durava exatamente um clique.
  //
  // A asserção olha o CONTEXTO e não o botão: o botão mostrar ✕ é justamente o que fazia
  // o defeito passar despercebido.
  const som = els.get('btSom');
  const tocarNaMesa = () => fire('pointerdown', { target: mod.renderer.domElement, pointerType: 'touch', pointerId: 90, clientX: 5, clientY: 5 });

  tocarNaMesa();                                    // liga o áudio, como o navegador exige
  ok(mod.ac && mod.ac.state === 'running', 'montagem: o áudio devia estar ligado depois do primeiro toque');

  som.onclick();                                    // clica no ♪
  ok(mod.ac.state === 'suspended', 'clicar no botão de som não calou o áudio');
  // O QUE SE EXIGE AQUI É O REQUISITO, NÃO O DESENHO. A asserção dizia `=== '✕'` e
  // gravava o defeito: ✕ era o mesmo glifo do botão de SAIR DA PARTIDA, 22px ao lado —
  // dois botões idênticos com consequências opostas. Trocar o glifo fazia o teste
  // reprovar por ter melhorado, que é o sinal de que ele media a implementação.
  // Agora ele pede as duas coisas que importam: mudou de cara, e não virou a cara do
  // vizinho perigoso.
  ok(som.textContent !== '♪', 'o botão de som não mudou de cara ao calar');
  // O '✕' está ESCRITO AQUI de propósito, e não lido de `els.get('btSair')`: o harness não
  // lê a página, então o botão de sair é um dublê vazio e a comparação daria `'🔇' !== ''`
  // — verde por trivialidade, que é a armadilha nº 1 desta casa. Escrito à mão, isto
  // reprova no código antigo, que é o único jeito de a asserção querer dizer alguma coisa.
  // Se um dia o botão de sair trocar de glifo, esta linha fica desatualizada — e é por
  // isso que o motivo está escrito, não só o número.
  ok(som.textContent !== '✕', 'o botão de som virou ✕, o MESMO glifo do de sair da partida (22px ao lado)');
  ok(som.getAttribute('aria-pressed') === 'true',
    'o botão de som é um interruptor e não anunciou que está apertado');

  tocarNaMesa();                                    // ...e agora o toque seguinte
  ok(mod.ac.state === 'suspended',
    'o toque seguinte religou o som sozinho — o mudo durou um clique, e o botão continua mentindo ✕');

  som.onclick();                                    // desliga o mudo
  ok(mod.ac.state === 'running', 'clicar de novo no botão não devolveu o som');
  fire('pointerup', { pointerId: 90, pointerType: 'touch' });
}

console.log('\na revanche não pode congelar a mesa');
{
  // Cadeira online sem ninguém vivo nela tem de virar bot ao começar a partida. A conversão
  // existia condicionada a `modo === 'local'`, o que cobria a revanche depois de SAIR de uma
  // mesa e deixava passar a revanche DENTRO de uma: o anfitrião com um convidado que fechou
  // a aba montava uma partida com uma cadeira que ninguém joga. `seguirOTurno` não faz nada
  // quando chega a vez dela e a mesa para para sempre, sem mensagem e sem botão.
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'online'; mod.MESA.cadeiras[1].nome = 'Quem caiu';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';

  // ANFITRIÃO DE VERDADE, e é o que faz esta asserção valer: o ramo com defeito só existe
  // quando `modo !== 'local'`. Com o jogo em modo local — que era o único alcançável em
  // Node até o dublê de Peer existir — o código ANTIGO converte a cadeira do mesmo jeito e
  // o teste passa sem ter tocado no defeito. Foi exatamente o que aconteceu na primeira
  // tentativa desta asserção.
  mod.abrirMesaOnline();
  ok(mod.conexoes.size === 0, 'montagem: ninguém devia estar conectado nesta cadeira online');

  els.get('btRevanche').onclick();
  const tipos = mod.P.cadeiras.map(c => c.tipo);
  ok(!tipos.includes('online'),
    `sobrou cadeira online sem ninguém do outro lado (${tipos.join('/')}) — a mesa nasce travada`);

  // E a prova de que ela ANDA: sem isto, "virou bot" poderia ser só um rótulo.
  const vez = mod.P.vez;
  for (let i = 0; i < 40 && mod.P.vez === vez && mod.P.fase === 'mao'; i++) {
    const a = mod.vistaAtual.acoes;
    if (a.jogadas.length) mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
    else if (a.comprar) mod.pedirAcao({ acao: 'comprar' });
    else if (a.passar) mod.pedirAcao({ acao: 'passar' });
    else { mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez)); }
  }
  ok(mod.P.vez !== vez || mod.P.fase !== 'mao', 'a vez nunca saiu do lugar: a mesa está congelada');

  // DEVOLVE O JOGO AO MODO LOCAL. `modo` é global e os blocos seguintes deste arquivo
  // contam com ele ('sair de um jogo local', 'sem rede não há com quem conversar') — três
  // deles reprovaram na primeira vez que este bloco existiu, e não por defeito do jogo.
  // Cena que muda estado global limpa o que sujou, igual às cenas do test-telas.
  mod.encerrarRede();
}

console.log('\no toque no celular');
{
  // Os dois defeitos que o Ricardo relatou JOGANDO, e não lendo código (Fila 5, itens 6 e
  // 7). Os dois são do dedo e nenhum acontece no mouse — a assimetria é o que aponta para
  // onde olhar, e é ela que estas asserções congelam.
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();
  // A vez tem de ser SUA. O portão de turno mora no pointerup, então fora da sua vez todo
  // toque não seleciona nada — e o teste passaria verde sem ter exercitado coisa alguma.
  for (let i = 0; i < 60 && mod.P.fase === 'mao' && mod.P.vez !== 0; i++) {
    mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
  }
  frames(40);
  mod.scene.updateMatrixWorld(true);
  mod.camera.updateMatrixWorld(true);

  const V = mod.naMao[0].obj.position.constructor;
  const naTela = m => {
    const v = new V(m.xBase, m.yBase, m.zBase).project(mod.camera);
    return { x: (v.x + 1) / 2 * 1600, y: (1 - v.y) / 2 * 900 };
  };
  const alvo = mod.renderer.domElement;
  // O leque ANIMA: peça que volta de um arrasto desliza até o lugar, e o raycast mira
  // onde ela ESTÁ, não onde ela vai parar (é a armadilha que o teste de arrasto acima já
  // documenta). Todo gesto começa com a mão assentada, senão o toque erra a peça e a
  // falha não fala do defeito que se está medindo.
  const assentar = () => { frames(20); mod.scene.updateMatrixWorld(true); };
  // Reprocurada a cada gesto: um arrasto que reordena muda os índices embaixo do teste.
  const umaJogavel = () => {
    const i = mod.naMao.findIndex(m => m.jogavel);
    return i < 0 ? null : { k: mod.chave(mod.naMao[i].peca), p: naTela(mod.naMao[i]) };
  };
  ok(mod.P.vez === 0 && umaJogavel(), 'montagem do cenário: precisa da sua vez com peça jogável');

  // Um toque, com o gesto inteiro descrito: quem chama diz de quanto foi o tremor.
  const tocar = (id, tipo, dx, dy) => {
    mod.cancelarEscolha();
    assentar();
    const a = umaJogavel();
    fire('pointerdown', { target: alvo, pointerType: tipo, pointerId: id, clientX: a.p.x, clientY: a.p.y });
    fire('pointermove', { pointerType: tipo, pointerId: id, clientX: a.p.x + dx, clientY: a.p.y + dy });
    fire('pointerup', { pointerType: tipo, pointerId: id });
    return a.k;
  };

  // A peça sai numa linha PRÓPRIA, sempre. `ok(mod.escolhida === tocar(...))` lê o
  // operando da esquerda antes de chamar o da direita: compararia a escolha ANTERIOR com
  // a peça deste gesto, e passa por coincidência toda vez que as duas forem a mesma. Foi
  // exatamente assim que uma destas asserções nasceu verde sem testar nada.
  let k;

  // ITEM 7. 12 px passa dos 9 de antes e não chega aos 18 de hoje: é exatamente a faixa
  // em que o toque virava arrasto sozinho, soltava sem reordenar nada e sumia.
  k = tocar(21, 'touch', 12, 4);
  ok(mod.escolhida === k, 'um tremor de 12 px no dedo engoliu o toque — é o clique que não joga a peça');

  // O limiar do dedo não podia ter afrouxado o MOUSE: lá 12 px é gesto de verdade.
  mod.cancelarEscolha(); assentar();
  const m0 = umaJogavel();
  fire('pointerdown', { target: alvo, pointerType: 'mouse', pointerId: 22, clientX: m0.p.x, clientY: m0.p.y });
  fire('pointermove', { pointerType: 'mouse', pointerId: 22, clientX: m0.p.x + 12, clientY: m0.p.y + 4 });
  ok(mod.naMao.some(m => m.arrastando), 'no mouse 12 px tem de continuar sendo arrasto');
  fire('pointerup', { pointerType: 'mouse', pointerId: 22 });

  // A rede embaixo do limiar: 300 px para CIMA sai da mão inteira, então `slotSob` não
  // acha slot nenhum e nada troca de lugar. Gesto que não arrumou nada era para ser toque.
  k = tocar(23, 'touch', 0, -300);
  ok(mod.escolhida === k, 'um gesto longo que não trocou NENHUMA peça de lugar tinha de valer como toque');

  // ITEM 6, o toque preso. O dedo sai pela beirada da tela ainda apoiado: o sistema leva
  // a captura embora e o `pointerup` nunca chega. Antes, `arrasto` ficava preenchido para
  // sempre e todo toque seguinte caía no `if (arrasto) return`.
  assentar();
  const s0 = umaJogavel();
  fire('pointerdown', { target: alvo, pointerType: 'touch', pointerId: 31, clientX: s0.p.x, clientY: s0.p.y });
  fire('pointermove', { pointerType: 'touch', pointerId: 31, clientX: s0.p.x + 60, clientY: s0.p.y });
  alvo.releasePointerCapture(31);                  // o sistema levando o gesto embora
  k = tocar(32, 'touch', 0, 0);
  ok(mod.escolhida === k, 'depois do dedo perdido o jogo descartou o toque seguinte — parece congelado sem estar');

  // Mesma doença, outra porta: a aba vai para o fundo (notificação, troca de app).
  assentar();
  const s1 = umaJogavel();
  fire('pointerdown', { target: alvo, pointerType: 'touch', pointerId: 41, clientX: s1.p.x, clientY: s1.p.y });
  fire('pointermove', { pointerType: 'touch', pointerId: 41, clientX: s1.p.x + 60, clientY: s1.p.y });
  document.hidden = true;
  fire('visibilitychange', {});
  document.hidden = false;
  ok(!mod.naMao.some(m => m.arrastando), 'a aba indo para o fundo deixou a peça presa no dedo');
  k = tocar(42, 'touch', 0, 0);
  ok(mod.escolhida === k, 'depois de a aba voltar do fundo o toque continuou sendo descartado');
  mod.cancelarEscolha();
}

console.log('\na arrumação sobrevive à troca de jogador');
{
  // Mesa com DUAS pessoas nesta tela: é o único jeito de `pedirTroca` rodar, e era
  // justamente por isso que o bug passava — o teste de arrumação usava só bots.
  mod.MESA.modo = 'classico'; mod.MESA.n = 2;
  mod.MESA.cadeiras[1].tipo = 'local'; mod.MESA.cadeiras[1].nome = 'Zé';
  mod.comecarLocal();

  const minhas = () => mod.naMao.map(m => mod.chave(m.peca));
  const jogarUma = () => {
    const a = mod.vistaAtual.acoes;
    if (a.jogadas.length) mod.pedirAcao({ acao: 'jogar', peca: a.jogadas[0].peca, ponta: a.jogadas[0].ponta });
    else if (a.comprar) mod.pedirAcao({ acao: 'comprar' });
    else mod.pedirAcao({ acao: 'passar' });
  };

  // Quem abre é quem tem o 6|6, então a partida pode já começar na tela de troca.
  for (let i = 0; i < 10 && mod.travado; i++) els.get('btPronto').onclick();
  const euComecei = mod.euNaTela;
  mod.arrumarMao();
  const arrumada = minhas();
  ok(arrumada.length > 1, 'montagem do cenário: precisa de mão para arrumar');

  // Passa o computador para o outro...
  const outro = 1 - euComecei;
  for (let i = 0; i < 80 && !mod.travado; i++) jogarUma();
  ok(mod.travado, 'a tela de troca deveria ter aparecido');
  ok(mod.naMao.length === 0, 'as peças do jogador anterior continuaram na cena durante a troca');
  els.get('btPronto').onclick();
  ok(mod.euNaTela === outro, 'a troca não passou a tela para o outro jogador');

  // ...e volta.
  for (let i = 0; i < 80 && !mod.travado; i++) jogarUma();
  els.get('btPronto').onclick();
  ok(mod.euNaTela === euComecei, 'a vez não voltou para quem tinha arrumado');

  // A arrumação é por cadeira: a peça jogada saiu, e o resto continua na ordem escolhida.
  const agora = minhas();
  const esperado = arrumada.filter(k => agora.includes(k));
  ok(agora.length > 0 && agora.join() === esperado.join(),
    `a arrumação não sobreviveu à troca: esperava ${esperado} e veio ${agora}`);
}

// Bloco à parte porque ele CONGELA a mão, e a mão congelada é a do motor — que é
// exatamente o que ele prova. Depois dele não dá para jogar mais nesta partida.
console.log('\na arrumação não encosta na mão do motor');
{
  // Só bots à mesa: com uma cadeira 'local' herdada do bloco anterior, a partida pode
  // começar na tela de troca — e ali a vista é uma CÓPIA com a mão vazia, não a
  // referência do motor que este teste quer conferir.
  //
  // E não dá para contar com a sorte de o sorteio abrir numa cadeira boa: `performance.now()`
  // no harness AVANÇA o relógio falso a cada chamada, então qualquer código novo que o
  // consulte desloca os temporizadores do bot e com eles o embaralho inteiro. Foi o que
  // aconteceu quando a marca da última jogada entrou. Montar a mesa é o que segura.
  mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
  mod.comecarLocal();
  // `visaoDe` devolve a MESMA referência de P.maos[cadeira]. Se alguém um dia "resolver"
  // a arrumação com um vista.mao.sort(), terá ordenado a mão do anfitrião por causa da
  // preferência visual de um jogador — e no online nem funcionaria, porque a vista do
  // convidado é regenerada do JSON a cada publicação. Congelar transforma isso num erro
  // em vez de um bug silencioso.
  ok(mod.vistaAtual.mao === mod.P.maos[mod.euNaTela], 'a vista deveria entregar a mão do motor por referência');
  const noMotor = mod.P.maos[mod.euNaTela].map(mod.chave).join();
  Object.freeze(mod.vistaAtual.mao);
  let estourou = null;
  try { mod.moverNaMao(0, 2); mod.arrumarMao(); mod.publicar(); } catch (e) { estourou = e.message; }
  ok(!estourou, `arrumar tentou escrever na mão do motor: ${estourou}`);
  ok(mod.P.maos[mod.euNaTela].map(mod.chave).join() === noMotor, 'a mão do motor mudou de ordem');
}

// Fica por último de propósito: este bloco termina com a partida encerrada.
console.log('\nsair da partida');
{
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();

  ok(!els.get('btSair')._cls.has('oculta'), 'o ✕ deveria aparecer enquanto há partida');
  els.get('btSair').onclick();
  ok(!els.get('telaSair')._cls.has('oculta'), 'a pergunta "sair mesmo?" não apareceu');

  // A REGRESSÃO: a tela é reescrita a cada publicação, e um bot jogando fecharia o
  // diálogo na cara do jogador. É o mesmo caso do fim de mão, e precisa do mesmo flag.
  mod.publicar();
  ok(!els.get('telaSair')._cls.has('oculta'), 'uma publicação apagou a pergunta de sair');

  els.get('btSairNao').onclick();
  ok(els.get('telaSair')._cls.has('oculta'), '"continuar jogando" não fechou a pergunta');
  ok(mod.P && mod.P.fase === 'mao', 'desistir de sair não podia mexer na partida');

  els.get('btSair').onclick();
  els.get('btSairSim').onclick();
  ok(mod.P === null, 'sair de um jogo local deveria encerrar a partida');
  ok(!els.get('telaMenu')._cls.has('oculta'), 'sair deveria voltar para a montagem da mesa');
}

// A fala da dupla numa mesa MISTA: gente na mesma tela e gente online ao mesmo tempo.
// `euNaTela` não é "a cadeira do anfitrião", é a cadeira que a tela mostra — e o hotseat a
// troca. Mostrar a fala da dupla na hora errada seria entregá-la ao adversário que está
// olhando a mesma tela; o defeito era ela ser DESCARTADA em vez de guardada.
console.log('\na fala da dupla espera o hotseat voltar');
{
  // Duplas em cruz (0&2 × 1&3): você na 0, o adversário do lado na 1 (mesma tela), o seu
  // parceiro online na 2. É o único arranjo em que a fala do parceiro pode chegar com a
  // tela na mão de quem não pode ler.
  mod.MESA.modo = 'classico'; mod.MESA.n = 4;
  mod.MESA.cadeiras[1].tipo = 'local'; mod.MESA.cadeiras[1].nome = 'Vizinho';
  mod.MESA.cadeiras[2].tipo = 'online'; mod.MESA.cadeiras[2].nome = 'Parceiro';
  mod.MESA.cadeiras[3].tipo = 'bot'; mod.MESA.cadeiras[3].nivel = 'normal';
  mod.comecarLocal();
  for (let i = 0; i < 10 && mod.travado; i++) els.get('btPronto').onclick();

  ok(mod.donoLocalDaFala(2) === 0,
     `quem lê a fala do parceiro nesta tela é a cadeira 0, veio ${mod.donoLocalDaFala(2)}`);

  // `limparConversa` zera a fila; a contagem de filhos vem depois dela porque o stub de
  // DOM não apaga `children` num innerHTML = ''.
  mod.limparConversa();
  const base = els.get('conversaLista').children.length;
  const ditas = () => els.get('conversaLista').children.slice(base)
    .filter(d => /fala/.test(d.className)).map(d => d.innerHTML);

  for (const t of ['um', 'dois', 'tres', 'quatro', 'cinco']) mod.guardarFala(2, 'dupla', t, 0);
  ok(ditas().length === 0, 'fala guardada apareceu na tela antes de o hotseat voltar');

  mod.soltarFalasGuardadas(0);
  const soltas = ditas();
  ok(soltas.length === 3, `deveria soltar as 3 últimas falas, soltou ${soltas.length}`);
  ok(/tres/.test(soltas[0]) && /quatro/.test(soltas[1]) && /cinco/.test(soltas[2]),
     'as falas soltas saíram fora de ordem ou não são as três últimas');
  ok(mod.falasGuardadas.length === 0,
     'a fila não foi esvaziada — a fala repetiria no hotseat seguinte');

  const quantas = ditas().length;
  mod.soltarFalasGuardadas(0);
  ok(ditas().length === quantas, 'a fala reapareceu no hotseat seguinte');

  // A fila é POR CADEIRA: soltar a vez da 0 não pode consumir o que era da 1.
  mod.guardarFala(2, 'dupla', 'isto é do vizinho', 1);
  mod.soltarFalasGuardadas(0);
  ok(mod.falasGuardadas.length === 1, 'soltar a cadeira 0 consumiu fala que era da cadeira 1');

  // Sem hotseat não há o que guardar: o parceiro de quem falou é um convidado, e ele já
  // recebeu pelo fio — guardar aqui mostraria a fala a quem ela não pertence.
  mod.MESA.cadeiras[1].tipo = 'online'; mod.MESA.cadeiras[2].tipo = 'bot';
  mod.comecarLocal();
  ok(mod.donoLocalDaFala(1) === -1,
     'fala de convidado sem parceiro nesta tela não tem dono local, e não se guarda');
}

// A dica é o bot pensando com a SUA mão. O que este bloco prova não é que ela escolhe
// bem — isso é o `test-regras.mjs` medindo o bot —, é que ela não sabe nada que você não
// saiba: ela sai da VISTA, e a vista é a fronteira de segurança do projeto.
console.log('\na dica de jogada');
{
  mod.MESA.modo = 'classico'; mod.MESA.n = 3;
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
  mod.comecarLocal();

  // Um estado com jogada disponível na sua vez e a mesa já formada.
  let pronto = false;
  for (let i = 0; i < 400 && !pronto; i++) {
    const v = mod.vistaAtual;
    if (v && v.fase === 'mao' && v.vez === v.cadeira && v.linha.length && v.acoes.jogadas.length) { pronto = true; break; }
    if (!mod.P || mod.P.fase !== 'mao') { mod.comecarLocal(); continue; }
    mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
  }
  ok(pronto, 'montagem: não achei uma vez sua com jogada possível');

  const d = mod.dicaDaVista(mod.vistaAtual);
  ok(d && d.acao === 'jogar', 'a dica não sugeriu jogada nenhuma');
  // A sugestão tem de estar entre as que o motor aceita — inclusive a regra do
  // fechamento armado, que já filtra `acoes.jogadas`. Uma dica ilegal seria pior que
  // nenhuma: o jogador confirma e leva um erro na cara.
  const legal = mod.vistaAtual.acoes.jogadas
    .some(j => mod.chave(j.peca) === mod.chave(d.peca) && j.ponta === d.ponta);
  ok(legal, `a dica sugeriu ${d.peca}/${d.ponta}, que não está entre as jogadas válidas`);
  ok(d.porques.length > 0, 'a dica não explicou por quê — é o que ela existe para fazer');
  ok(d.porques.every(p => typeof p.texto === 'string' && p.texto),
    'algum porquê veio sem texto');

  // O PONTO. A visão passada por JSON é literalmente o que o convidado recebe: sem mão
  // alheia, sem monte, sem partida. Se a dica continua respondendo o MESMO, ela nunca
  // olhou para nada além do que você vê — e de graça ela passa a funcionar no online.
  const pacote = JSON.parse(JSON.stringify(mod.visaoDe(mod.P, mod.euNaTela)));
  const pelaRede = mod.dicaDaVista(pacote);
  ok(pelaRede && pelaRede.acao === 'jogar', 'a dica não funciona a partir da visão que trafega');
  ok(mod.chave(pelaRede.peca) === mod.chave(d.peca) && pelaRede.ponta === d.ponta,
    'a dica mudou de resposta quando a informação veio pelo fio — sinal de que lia a partida');

  // Fora da sua vez não há dica: ela levanta uma peça e abre a barra de confirmar, e
  // prometer uma jogada que o motor vai recusar é pior que não sugerir.
  const deOutro = Object.assign({}, mod.vistaAtual, { vez: (mod.vistaAtual.cadeira + 1) % 3 });
  ok(mod.dicaDaVista(deOutro) === null, 'deu dica na vez de outra pessoa');

  // E termina onde um clique seu terminaria: peça levantada, fantasmas nas pontas.
  mod.cancelarEscolha();
  mod.pedirDica();
  ok(mod.escolhida, 'a dica não levantou a peça');
  ok(mod.grupoPrevia.children.length > 0, 'a dica levantou a peça mas não mostrou onde ela cai');
  // `escolhida` é a CHAVE da peça e não um índice — é o que faz a seleção sobreviver à
  // arrumação da mão, e aqui dá para comparar direto.
  ok(mod.escolhida === mod.chave(d.peca),
    `a peça levantada (${mod.escolhida}) não é a que a dica sugeriu (${mod.chave(d.peca)})`);
  mod.cancelarEscolha();
  console.log(`  sugeriu ${d.peca[0]}|${d.peca[1]} ${d.ponta} · ${d.porques.length} porquê(s) · ` +
    'a mesma resposta pela vista que trafega');
}

// `receberChat` é a porta ÚNICA da conversa. O convidado sempre entrou por ela; o
// anfitrião passou a entrar. Antes ele chamava espalharChat direto e era o único da mesa
// que podia inundar os outros — a autoridade dele é sobre a PARTIDA, não sobre o ritmo.
console.log('\na guarda da conversa vale para todo mundo');
{
  mod.limparConversa();
  const antes = els.get('conversaLista').children.length;

  ok(mod.receberChat(0, { canal: 'todos', txt: 'primeira' }) === true,
     'a primeira fala de uma cadeira deveria passar');
  ok(mod.receberChat(0, { canal: 'todos', txt: 'na sequência' }) === false,
     'duas falas seguidas da mesma cadeira deveriam ser barradas pelo intervalo');
  // A guarda é POR CADEIRA: um jogador apressado não pode calar a mesa.
  ok(mod.receberChat(1, { canal: 'todos', txt: 'de outra cadeira' }) === true,
     'a guarda barrou uma cadeira diferente — ela é por cadeira, não da mesa toda');
  ok(mod.receberChat(2, { canal: 'todos', txt: '   ' }) === false, 'fala em branco não passa');
  ok(mod.receberChat(2, { canal: 'todos', txt: '' }) === false, 'fala vazia não passa');

  // O corte de tamanho é do anfitrião pelo mesmo motivo do intervalo.
  ok(mod.receberChat(3, { canal: 'todos', txt: 'x'.repeat(400) }) === true, 'fala longa deveria passar, cortada');
  const ultima = els.get('conversaLista').children.slice(-1)[0].innerHTML;
  const xs = (ultima.match(/x/g) || []).length;
  ok(xs === 160, `a fala deveria ser cortada em 160 caracteres, ficou com ${xs}`);

  const entraram = els.get('conversaLista').children.length - antes;
  ok(entraram === 3, `3 falas deveriam ter entrado na lista, entraram ${entraram}`);
  console.log(`  intervalo e corte valem para qualquer cadeira · ${entraram} de 7 tentativas passaram`);
}

// A conversa do saguão: `atualizarConversa` tem de funcionar SEM vista, que é a diferença
// que trouxe o chat para a espera. Antes ela só era chamada por `desenharHUD`, que só roda
// quando já existe partida — e ninguém conseguia falar enquanto a mesa enchia.
console.log('\na conversa existe antes da partida');
{
  // Sem vista e sem rede: não há com quem falar, o campo fica escondido.
  mod.atualizarConversa(undefined);
  ok(els.get('conversaEscrever')._cls.has('oculta'),
     'sem rede não há com quem conversar, o campo devia estar escondido');
  // E o importante: chamar sem vista não pode estourar. Era isso que faltava.
  ok(true, 'atualizarConversa(undefined) não estourou');
  console.log('  atualizarConversa roda sem vista, que é o que o saguão precisa');
}

// O DESPACHANTE, com mensagem malformada. Este bloco existe porque NENHUMA linha de teste
// jamais entregou uma mensagem torta ao anfitrião: o `conn.on('data')` mora dentro do
// `peer.on('connection')`, e o dublê `Peer` engolia o registro. As suítes chamavam
// `sentar`/`largar`/`receberChat` DIRETO, ou seja, sempre por dentro do despachante e nunca
// através dele — e era por ali que passavam o C3, o C4 e o C7 da Fila 11.
//
// Tudo aqui é entrada de fora: quem manda é o convidado, e um convidado pode ser uma aba
// modificada. A pergunta de cada asserção é a mesma — "isto derruba a mesa dos OUTROS?".
console.log('\nmensagem torta não derruba a mesa');
{
  // Monta a mesa e passa pelo caminho REAL: o peer do anfitrião registra 'connection',
  // e o teste é quem dispara. `Peer.ultimo` é o dublê do harness — o jogo não expõe o
  // peer, e expô-lo pela ponte seria mudar produção por causa de teste.
  const abrirMesa = () => {
    mod.encerrarRede();
    mod.MESA.modo = 'classico'; mod.MESA.n = 3;
    mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
    mod.MESA.cadeiras[2].tipo = 'bot'; mod.MESA.cadeiras[2].nivel = 'normal';
    mod.comecarLocal();
    mod.MESA.cadeiras[1].tipo = 'online'; mod.MESA.cadeiras[1].nome = 'Visita';
    mod.MESA.cadeiras[1].vagaOnline = false;
    mod.abrirMesaOnline();
    const conn = novaConn();
    const houve = Peer.ultimo.disparar('connection', conn);
    // Guarda do DUBLÊ, não do jogo: zero ouvintes quer dizer que o registro não chegou, e
    // sem esta linha tudo abaixo ficaria verde por não ter rodado nada. É a lição da
    // "asserção sobre uma coleção que primeiro exige que a coleção não esteja vazia".
    ok(houve === 1, `o anfitrião devia ter registrado 1 ouvinte de 'connection', e foram ${houve}`);
    ok(conn.ouvintes.has('data'), 'o despachante não foi instalado na conn — o resto do bloco não testaria nada');
    return conn;
  };

  // Entregar uma mensagem NUNCA pode lançar: uma exceção aqui sobe pelo callback do PeerJS
  // e mata o processamento da conexão inteira. Devolve o erro em vez de deixá-lo subir,
  // porque asserção que LANÇA trunca a suíte e faz a conferência por mutação sub-relatar.
  const entregar = (conn, m) => {
    try { conn.disparar('data', m); return null; } catch (e) { return e; }
  };

  {
    const conn = abrirMesa();
    // Sem sentar ainda: o primeiro ramo (`cadeira < 0`) tem de aguentar lixo.
    for (const m of [null, undefined, {}, 42, 'oi', []]) {
      const e = entregar(conn, m);
      ok(!e, `mensagem ${JSON.stringify(m)} antes de sentar derrubou o despachante: ${e && e.message}`);
    }
  }

  {
    // C7 — a cadeira passando a se chamar "undefined". `String(undefined)` é a string
    // "undefined", que é TRUTHY, então o `|| 'Visita'` nunca dispara.
    const conn = abrirMesa();
    entregar(conn, { t: 'ola', id: 'cliente-Z', nome: 'Zé' });
    ok(mod.MESA.cadeiras[1].nome === 'Zé', `montagem: a visita devia sentar como Zé e é ${mod.MESA.cadeiras[1].nome}`);

    for (const [rotulo, m] of [['sem campo', { t: 'nome' }], ['nulo', { t: 'nome', nome: null }],
                               ['número', { t: 'nome', nome: 42 }], ['objeto', { t: 'nome', nome: {} }]]) {
      const e = entregar(conn, m);
      ok(!e, `{t:'nome'} ${rotulo} derrubou o despachante: ${e && e.message}`);
      const nome = mod.MESA.cadeiras[1].nome;
      ok(nome !== 'undefined' && nome !== 'null' && nome !== '[object Object]' && nome !== '42',
         `{t:'nome'} ${rotulo} rebatizou a cadeira de "${nome}" — é o defeito da foto da Fila 10 por outra porta`);
    }
  }

  {
    // C4 — congelar a mesa de todos com uma linha. O nome não tinha limite de TAMANHO nem
    // de FREQUÊNCIA, e é a mensagem mais cara do protocolo: `listarSala()` mais `publicar()`,
    // que espalha vista para todo mundo e grava a partida no localStorage, síncrono.
    const conn = abrirMesa();
    entregar(conn, { t: 'ola', id: 'cliente-Z', nome: 'Zé' });

    const gigante = 'x'.repeat(4e6);
    let erro = null;
    for (let i = 0; i < 20; i++) erro = entregar(conn, { t: 'nome', nome: gigante + i }) || erro;
    ok(!erro, `a rajada de nomes gigantes derrubou o despachante: ${erro && erro.message}`);
    ok(mod.MESA.cadeiras[1].nome.length <= 14,
       `o nome ficou com ${mod.MESA.cadeiras[1].nome.length} caracteres — o corte tem de valer também aqui`);

    // NÃO SE MEDE TEMPO AQUI, e a tentação era grande. O custo real do C4 em produção é o
    // `publicar()` de cada mensagem gravando a partida inteira no localStorage, síncrono —
    // e o harness dubla o localStorage, então essa parte não existe em Node. Medido: os 20
    // nomes de 4 MB custam 382 ms aqui contra os ~9 s relatados no navegador. Um limiar de
    // tempo estaria medindo o DUBLÊ, não o jogo.
    //
    // O que se mede é a AMPLIFICAÇÃO, que é determinística e é o defeito em si: cada
    // `{t:'nome'}` espalha vista para a mesa toda. Vinte mensagens não podem virar vinte
    // rodadas de publicação.
    const vistas = m => m.enviadas.filter(x => x.t === 'vista').length;
    ok(vistas(conn) <= 2,
       `20 nomes viraram ${vistas(conn)} publicações para a mesa — é a amplificação que congela todo mundo`);

    // E a FREQUÊNCIA, que é o guarda irmão do `INTERVALO_FALA` do chat.
    const conn2 = abrirMesa();
    entregar(conn2, { t: 'ola', id: 'cliente-Y', nome: 'Ana' });
    entregar(conn2, { t: 'nome', nome: 'Bia' });
    entregar(conn2, { t: 'nome', nome: 'Cida' });
    ok(mod.MESA.cadeiras[1].nome !== 'Cida',
       'dois {t:\'nome\'} colados: o segundo tinha de ser recusado por frequência, como o chat já faz');

    // O CORTE ACONTECE ANTES DE NORMALIZAR, e esta asserção existe porque a mutação a
    // cobrou: tirando o `.slice(0, TAMANHO_NOME)` a suíte continuava verde, porque o limite
    // de FREQUÊNCIA já descartava 19 das 20 mensagens da rajada e o `nomeUnico` corta em 14
    // no fim de qualquer jeito. Ou seja: o guarda existia sem ninguém provar que existia.
    //
    // O jeito de enxergar a ordem é um nome cujos primeiros 64 caracteres são espaço: com o
    // corte antes, sobra string vazia e a cadeira vira 'Visita'; sem ele, o `trim` alcança o
    // "Zé" lá no fim e o nome passa. É a mesma pergunta do `receberChat`, onde `slice` vem
    // antes de `trim` — só que aqui dá para reprovar por ela.
    const conn3 = abrirMesa();
    entregar(conn3, { t: 'ola', id: 'cliente-X', nome: 'Ivo' });
    entregar(conn3, { t: 'nome', nome: ' '.repeat(200) + 'Zé' });
    ok(mod.MESA.cadeiras[1].nome !== 'Zé',
       'o nome foi normalizado ANTES do corte — é sobre essa string inteira que roda o trabalho caro');
  }

  {
    // C3 — `{t:'acao'}` sem `peca`. `mesmaPeca` (020-baralho.js:9) lê `b[0]` sem guarda, e o
    // TypeError sobe pelo `conn.on('data')`. NÃO é trapaça: `jogar` valida contra
    // `acoesDe(P, cadeira)`, que sai da mão do próprio jogador, então a fronteira do
    // invariante 3 continua de pé. O dano é o `publicar()` não rodar e a vez não andar.
    const conn = abrirMesa();
    entregar(conn, { t: 'ola', id: 'cliente-Z', nome: 'Zé' });
    mod.comecarLocal();                     // a partida com a cadeira online de pé
    // A VEZ TEM DE SER DELE, e sem isto o bloco inteiro é decoração: `acoesDe` (040-partida.js:68)
    // devolve `jogadas: []` fora da vez, e aí o `.some` de `jogar` curto-circuita antes de
    // chegar em `mesmaPeca` — o TypeError nunca acontece e as seis asserções nascem verdes
    // sem ter exercitado nada. Foi assim que este bloco passou na primeira rodada.
    mod.P.vez = 1;
    // E a peça obrigatória sai: ela só existe na PRIMEIRA jogada da primeira mão (040-partida.js:56,
    // limpa em :117), e se o 6|6 não estiver na mão desta cadeira ela filtra `jogadas` para
    // vazio — o mesmo curto-circuito por outra porta. Este é um estado que o jogo produz
    // sozinho em toda mão seguinte, não um estado inventado.
    mod.P.pecaObrigatoria = null;
    // A GUARDA QUE VALE: não "a vez é dele", e sim "existe jogada válida". É a única forma
    // de o teste afirmar que `mesmaPeca` vai mesmo ser chamada.
    const podeJogar = mod.acoesDe(mod.P, 1).jogadas.length;
    ok(podeJogar > 0,
       `montagem do C3: a cadeira 1 precisa ter jogada válida e tem ${podeJogar} — sem isso o ramo perigoso não roda`);

    for (const [rotulo, m] of [['sem peça', { t: 'acao', acao: 'jogar' }],
                               ['peça nula', { t: 'acao', acao: 'jogar', peca: null }],
                               ['peça string', { t: 'acao', acao: 'jogar', peca: '66' }],
                               ['peça curta', { t: 'acao', acao: 'jogar', peca: [3] }],
                               ['ação desconhecida', { t: 'acao', acao: 'voar' }],
                               ['sem ação', { t: 'acao' }]]) {
      const e = entregar(conn, m);
      ok(!e, `{t:'acao'} ${rotulo} derrubou o despachante: ${e && e.message}`);
    }

    // S3 — A RECUSA TEM DE CHEGAR NO CONVIDADO. `avisar` fala com quem está NESTA tela, e
    // ele nunca está: a peça simplesmente não ia, sem uma palavra. É a doença do silêncio
    // que a Fila 6 e o item 2 da Fila 8 passaram consertando, viva no único caminho que
    // atravessa a rede.
    // A jogada recusada é PROCURADA, não escolhida a dedo: uma peça fixa como a `6|6` pode
    // por acaso ser válida naquela mão, e a asserção passaria a medir o sorteio.
    const validas = new Set(mod.acoesDe(mod.P, 1).jogadas.map(j => mod.chave(j.peca) + j.ponta));
    let ruim = null;
    for (let a = 0; a <= 6 && !ruim; a++)
      for (let b = a; b <= 6 && !ruim; b++)
        for (const ponta of ['esq', 'dir'])
          if (!validas.has(mod.chave([a, b]) + ponta)) { ruim = { peca: [a, b], ponta }; break; }
    ok(ruim, 'montagem: não achei uma jogada inválida para recusar');

    conn.enviadas.length = 0;
    entregar(conn, { t: 'acao', acao: 'jogar', peca: ruim.peca, ponta: ruim.ponta });
    const erros = conn.enviadas.filter(x => x.t === 'erro');
    ok(erros.length === 1,
       `uma jogada recusada devia render 1 recado ao convidado e rendeu ${erros.length} — ele fica sem saber por quê`);
    ok(erros[0] && typeof erros[0].txt === 'string' && erros[0].txt.length > 0,
       'o recado da recusa chegou vazio, que é o mesmo silêncio com outro nome');

    // E o contrário: jogada BOA não pode render recado de erro nenhum. Sem esta, um
    // conserto que mandasse 'erro' sempre deixaria a de cima verde.
    const boa = mod.acoesDe(mod.P, 1).jogadas[0];
    conn.enviadas.length = 0;
    entregar(conn, { t: 'acao', acao: 'jogar', peca: boa.peca, ponta: boa.ponta });
    ok(conn.enviadas.filter(x => x.t === 'erro').length === 0,
       'uma jogada VÁLIDA rendeu recado de erro — o guarda está recusando o que devia passar');
  }

  {
    // S4 — o `P.log` crescia sem teto (347 entradas / 18,7 KB numa partida de 12 mãos), era
    // serializado a cada `publicar()` — 334 gravações síncronas por partida — e não tinha
    // UM ÚNICO LEITOR em `src/` nem em `tests/`. Peso morto puro. Esta asserção é o que
    // impede alguém de ressuscitá-lo por engano ao mexer no motor.
    mod.encerrarRede();
    mod.MESA.modo = 'classico'; mod.MESA.n = 2;
    mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
    mod.comecarLocal();
    for (let passo = 0; mod.P.fase === 'mao' && passo < 200; passo++)
      mod.aplicarIntencao(mod.P.vez, mod.jogadaDoBot(mod.P, mod.P.vez));
    ok(mod.P.log === undefined,
       'o P.log voltou — ele não tem leitor nenhum e é serializado em toda publicação');
  }
  console.log('  o despachante aguenta lixo do fio — e a mesa não para');
}

// ─── A MESA TEM JOGO, e o protocolo passou a dizer qual ──────────────────────
// Até a v4.6 nem o `ola` nem o `sentou` carregavam o id do jogo, e a sala guardada também
// não. Consequências, as duas reais: um convidado com o DOMINÓ aberto sentava numa mesa de
// TRUCO e recebia vistas que a mesa dele não sabe desenhar; e "Voltar à mesa" reabria a sala
// no jogo da PREFERÊNCIA, não no da mesa.
//
// A cena roda com o DOMINÓ na mesa (é o jogo padrão desta suíte), então o forasteiro é o
// truco. Ela usa o despachante de verdade — o mesmo caminho do bloco de cima.
// ─── e a vista do DOMINÓ continua sendo conferida pelo dominó ────────────────
// O outro lado do encaixe. `vistaDoFio` deixou de exigir `linha` na CASA — se o encaixe do
// dominó não a cobrar, ninguém mais cobra, e a guarda que existe para impedir "o jogo preto
// sem uma palavra" vira decoração. É o par que impede o conserto de virar a remoção da
// guarda, e é ele que a mutação mata.
console.log('\na vista de dominó continua conferida pelo dominó');
{
  mod.encerrarRede();
  mod.MESA.n = 2; mod.MESA.modo = 'classico';
  mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
  mod.comecarLocal();
  // Pelo JSON, que é como ela chega de verdade.
  const v = JSON.parse(JSON.stringify(mod.visaoDe(mod.P, 1)));
  ok(mod.vistaDoFio(v), 'a casa recusou uma vista de dominó boa');
  for (const campo of ['linha', 'monte']) {
    const torto = JSON.parse(JSON.stringify(v));
    delete torto[campo];
    ok(!mod.vistaDoFio(torto), `a casa aceitou uma vista de dominó sem ${campo}`);
  }
  // `monte` é NÚMERO na vista (a partida tem o array; a visão manda o tamanho). Copiar o
  // `Array.isArray` do validador da partida recusaria toda vista de dominó.
  const monteArray = JSON.parse(JSON.stringify(v)); monteArray.monte = [];
  ok(!mod.vistaDoFio(monteArray), 'a casa aceitou um monte que não é contagem');
  console.log('  o encaixe do dominó cobra linha e monte, e o monte é contagem');
}

console.log('\na mesa recusa quem chega no jogo errado');
{
  const abrirMesa = () => {
    mod.encerrarRede();
    mod.MESA.modo = 'classico'; mod.MESA.n = 3;
    for (const i of [1, 2]) { mod.MESA.cadeiras[i].tipo = 'bot'; mod.MESA.cadeiras[i].nivel = 'normal'; }
    mod.comecarLocal();
    mod.MESA.cadeiras[1].tipo = 'online'; mod.MESA.cadeiras[1].nome = 'Visita';
    mod.MESA.cadeiras[1].vagaOnline = false;
    mod.abrirMesaOnline();
    const conn = novaConn();
    const houve = Peer.ultimo.disparar('connection', conn);
    ok(houve === 1, `o anfitrião devia ter registrado 1 ouvinte de 'connection', e foram ${houve}`);
    return conn;
  };

  // O outro jogo, lido de `JOGOS` e não escrito à mão: um literal 'truco' aqui seria o
  // teste fixando um nome de jogo, e ele morre no dia em que a casa ganhar o pife.
  const outro = Object.keys(mod.JOGOS).find(id => id !== mod.JOGO_ID);
  ok(!!outro, 'a casa só tem um jogo registrado — esta cena não testaria nada');

  {
    const conn = abrirMesa();
    conn.disparar('data', { t: 'ola', id: 'cliente-forasteiro', nome: 'Visita', jogo: outro });
    const recusa = conn.enviadas.find(m => m && m.t === 'cheio');
    ok(!!recusa, 'a mesa aceitou calada um convidado de outro jogo');
    ok(recusa && recusa.porque === 'outrojogo',
      `a recusa saiu com o motivo errado (${recusa && recusa.porque}) — mentir o motivo é o defeito da Fila 10`);
    // O NOME DO JOGO TEM DE VIAJAR, senão o convidado é mandado adivinhar entre as abas.
    ok(recusa && recusa.jogo === mod.JOGO_ID, 'a recusa não disse de que jogo a mesa é');
    ok(!mod.conexoes || !mod.conexoes.size, 'o forasteiro ocupou uma cadeira mesmo recusado');
  }

  {
    // E O CONVIDADO DO JOGO CERTO CONTINUA SENTANDO — sem este par, tirar a guarda inteira
    // deixaria a suíte verde, e o conserto viraria "ninguém entra nunca".
    const conn = abrirMesa();
    conn.disparar('data', { t: 'ola', id: 'cliente-certo', nome: 'Visita', jogo: mod.JOGO_ID });
    const sentou = conn.enviadas.find(m => m && m.t === 'sentou');
    ok(!!sentou, 'a mesa recusou um convidado do MESMO jogo');
    ok(sentou && sentou.jogo === mod.JOGO_ID, 'o `sentou` não disse de que jogo a mesa é');
  }

  {
    // CONVIDADO DE VERSÃO ANTIGA não manda `jogo`, e tem de sentar como antes. É a mesma
    // tolerância que o `nome` solto já pratica: quebrar quem não recarregou é pior que a
    // falta do campo, e uma página em cache é o caso comum e não o exótico.
    const conn = abrirMesa();
    conn.disparar('data', { t: 'ola', id: 'cliente-antigo', nome: 'Visita' });
    ok(conn.enviadas.some(m => m && m.t === 'sentou'),
      'a mesa recusou um convidado de versão antiga — o campo novo virou obrigatório');
  }
  console.log('  a mesa diz de que jogo ela é, e recusa o forasteiro dizendo qual');
}

// TEMPORIZADOR QUE ACORDA DEPOIS DE O JOGADOR MUDAR DE IDEIA. Os três defeitos deste bloco
// são a MESMA doença, e este arquivo já tinha a regra escrita desde o item 7 da Fila 5:
// "para todo `if (x) return`, perguntar as duas coisas — quem zera o x, e o que acontece se
// esse alguém não vier". São três `setTimeout` sem dono e sem guarda no disparo — e o padrão
// certo já existia DUAS vezes no mesmo arquivo (`esperando`, e o `deixandoAMesa` dos 400 ms).
//
// O QUE A MUTAÇÃO PROVA AQUI, dito de frente porque é diferente do resto da suíte: o
// conserto tem DUAS camadas por defeito (cancelar o handle e conferir a geração no
// disparo), e removendo UMA delas isolada a suíte continua verde — a outra segura o caso.
// Isso não é asserção fraca, é o desenho: as camadas existem porque falham de jeitos
// diferentes (cancelar faz o temporizador deixar de existir; a geração só o faz calar, e é
// a única que alcança callback de peer, que `clearTimeout` não cancela). Conferido
// removendo os PARES: C1 cai com 3 falhas, C2 com 2. Quem mexer numa camada e a suíte
// continuar verde não descobriu que ela é inútil — descobriu que a irmã está de pé.
console.log('\ntemporizador de rede que perdeu o dono');
{
  // Cada bloco diz o que quer e devolve como encontrou — a mesma regra das cenas do
  // `test-telas` e do `test-online`, aqui dentro do harness. O `voltarSozinho('')` é o
  // caminho que o PRÓPRIO jogo usa para zerar a escada (código vazio cai no ramo de
  // desistência), e não um estado inventado: `encerrarRede` não a zera, e é exatamente esse
  // o defeito S5 — sem isto, o bloco seguinte herda a contagem do anterior e reprova com uma
  // mensagem que fala de outra coisa. O teste sofria do bug que testa.
  const zerar = () => { mod.encerrarRede(); mod.voltarSozinho(''); mod.pararDeConectar(''); Peer.todos.length = 0; };

  {
    // C1 — o anfitrião reivindicando o código que era dele desiste, e a reserva acorda
    // assim mesmo: 1,5 s depois o menu some sozinho e ele cai numa partida antiga com a
    // mesa parada, porque `retomarComoAnfitriao` roda com `modo` já 'local' e o
    // `espalharVistas` está atrás de `if (modo === 'anfitriao')`.
    zerar();
    mod.abrirMesaOnline();
    mod.tentarAbrir(0, 'ABCD');
    Peer.ultimo.disparar('error', { type: 'unavailable-id' });
    ok(els.get('onlineErro').textContent.includes('1/6'),
       `montagem: a reserva devia estar insistindo e o erro diz "${els.get('onlineErro').textContent}"`);

    const antes = Peer.todos.length;
    els.get('btCancelarOnline').onclick();          // o jogador desiste — "Voltar"
    ok(mod.modo === 'local', 'montagem: o Voltar devia ter desligado a rede');
    correrTimers();
    ok(Peer.todos.length === antes,
       `a reserva acordou depois do Voltar e abriu ${Peer.todos.length - antes} peer(s) novo(s)`);
    ok(mod.peer === null, 'sobrou peer vivo reivindicando o código de uma mesa abandonada');
  }

  {
    // A VARIANTE, e ela é o que prova que a guarda não pode morar só no `encerrarRede`:
    // "Começar a partida" é a única porta daquela tela que NÃO passa por ele. Sem uma
    // desligada própria, a reserva acorda e troca a partida recém-montada pela guardada.
    zerar();
    mod.abrirMesaOnline();
    mod.tentarAbrir(0, 'ABCD');
    Peer.ultimo.disparar('error', { type: 'unavailable-id' });
    const antes = Peer.todos.length;
    els.get('btIniciarOnline').onclick();
    correrTimers();
    ok(Peer.todos.length === antes,
       `"Começar a partida" não desligou a reserva: nasceram ${Peer.todos.length - antes} peer(s) depois`);
  }

  {
    // C2 — o convidado cuja mesa caiu entra NOUTRA nos 4 s seguintes, e o temporizador da
    // mesa velha acorda e mata a nova. A guarda `modo !== 'convidado'` do disparo não
    // separa "desistiu" de "entrou noutra mesa": quem entrou noutra mesa TAMBÉM é
    // convidado, e `conectarNaMesa` repõe `modo`. O comentário daquela linha descrevia uma
    // proteção que ela não dava.
    zerar();
    mod.entrarNumaMesa(); mod.conectarNaMesa('AAAA');
    mod.pararDeConectar();                          // é o que o `close` faz antes de agendar
    ok(mod.voltarSozinho('AAAA') === true, 'montagem: a volta devia ter sido agendada');

    mod.entrarNumaMesa(); mod.conectarNaMesa('BBBB');
    const daNova = mod.peer;
    ok(daNova, 'montagem: a mesa nova devia ter peer');

    correrTimers();
    ok(!daNova.destruido, 'a volta da mesa velha destruiu o peer da mesa NOVA');
    ok(mod.peer === daNova, 'a mesa nova ficou sem peer nenhum');
    ok(mod.codigoDaSala === 'BBBB',
       `a tela ficou apontando para a mesa velha (código "${mod.codigoDaSala}")`);
    ok(mod.conectando === false || mod.peer === daNova,
       'o botão Entrar ficou travado em "Entrando…" para sempre — nenhum clique volta a funcionar');
  }

  {
    // A OUTRA PORTA DO C2, e ela existe porque a conferência por MUTAÇÃO a cobrou: tirando o
    // `geracaoRede++` do `conectarNaMesa`, a suíte continuava verde. O bloco acima entra
    // sempre por `entrarNumaMesa`, que chama `encerrarRede` e já cancela o temporizador —
    // então ele nunca exercitava a guarda de geração daquele caminho.
    //
    // Aqui é o caminho de verdade da tela "A mesa caiu": o botão Entrar está clicável (o
    // `close` chamou `pararDeConectar` ANTES de agendar a volta) e o campo do código está
    // lá. Dá para entrar noutra mesa sem passar pelo `encerrarRede` uma única vez.
    zerar();
    mod.entrarNumaMesa(); mod.conectarNaMesa('AAAA');
    mod.pararDeConectar();
    ok(mod.voltarSozinho('AAAA') === true, 'montagem: a volta devia ter sido agendada');

    els.get('onlineEntrada').value = 'BBBB';
    els.get('onlineNome').value = '';
    els.get('btConectar').onclick();                  // Entrar DIRETO, sem passar pelo menu
    const daNova = mod.peer;
    ok(daNova && mod.codigoDaSala === 'BBBB',
       `montagem: o Entrar direto devia ter aberto a mesa BBBB e o código é "${mod.codigoDaSala}"`);

    correrTimers();
    ok(!daNova.destruido, 'a volta da mesa velha matou a mesa nova aberta pelo Entrar direto');
    ok(mod.peer === daNova, 'a mesa nova ficou sem peer — o Entrar direto não desligou a volta velha');
  }

  {
    // S5 — desistir pelo botão não zerava a escada, e a próxima queda começava no meio.
    zerar();
    mod.entrarNumaMesa(); mod.conectarNaMesa('AAAA');
    mod.pararDeConectar(); mod.voltarSozinho('AAAA');
    mod.pararDeConectar(); mod.voltarSozinho('AAAA');
    ok(mod.voltando === 2, `montagem: a escada devia estar em 2 e está em ${mod.voltando}`);

    els.get('btCancelarOnline').onclick();
    ok(mod.voltando === 0, 'o Voltar não zerou a escada: a próxima queda começa em 3/8');
  }

  {
    // E A ESCADA TEM FIM. Esta asserção PASSA hoje, e está aqui dita como o que é: guarda
    // contra o conserto ser feito no lugar errado. Zerar `voltando` dentro do `encerrarRede`
    // ou do `conectarNaMesa` deixaria a asserção do S5 verde por acidente — e como o
    // temporizador do `voltarSozinho` chama OS DOIS no próprio corpo, a escada reiniciaria a
    // cada degrau e o convidado tentaria voltar PARA SEMPRE. É o único jeito de a suíte
    // enxergar esse laço.
    zerar();
    mod.entrarNumaMesa(); mod.conectarNaMesa('CCCC');
    let degraus = 0;
    for (let i = 0; i < 20; i++) {
      // O `pararDeConectar` vem antes de propósito: é a ordem do jogo. Quem chama
      // `voltarSozinho` é o `linkAnfitriao.on('close')`, e ele destrava o botão ANTES. Sem
      // esse passo `conectando` fica de pé, o `conectarNaMesa` do degrau desiste calado e a
      // escada morre no primeiro — que é o C2 aparecendo dentro do teste do S5.
      mod.pararDeConectar();
      if (!mod.voltarSozinho('CCCC')) break;
      degraus++;
      correrTimers();
    }
    ok(degraus === mod.VOLTAS, `a escada devia parar em ${mod.VOLTAS} degraus e parou em ${degraus}`);
  }
  console.log('  temporizador que perdeu o dono acorda calado');
}

// A QUARTA MORDIDA DO innerHTML. A regra da casa — todo texto de fora passa pelo `escapar` —
// está escrita no comentário do próprio `130-hud.js`, e foi aplicada às STRINGS e nunca aos
// campos que se assume serem números. O desenho do defeito é a evidência: no mesmo template
// literal, o NOME passa por `escapar` e o número irmão ao lado não. "Numérico" foi tratado
// como sinônimo de "seguro".
//
// E eles não são seguros: no convidado, `atualizarVista(m.v)` recebe o objeto do fio sem uma
// única validação. Como qualquer aba pode ser anfitriã, um anfitrião modificado manda um
// placar que é uma string e roda script na máquina dos convidados.
console.log('\nnúmero que vem do fio também é texto de fora');
{
  const ATAQUE = '<img src=x onerror=alert(1)>';
  // Uma vista de VERDADE, e depois um campo envenenado de cada vez: assim a falha aponta
  // para o campo, e não para uma vista inventada que o jogo nunca produziria.
  const vistaViva = () => {
    mod.encerrarRede();
    mod.MESA.modo = 'classico'; mod.MESA.n = 2;
    mod.MESA.cadeiras[1].tipo = 'bot'; mod.MESA.cadeiras[1].nivel = 'normal';
    mod.comecarLocal();
    return JSON.parse(JSON.stringify(mod.visaoDe(mod.P, 0)));
  };

  const cru = () => els.get('placar').innerHTML + els.get('jogadores').innerHTML;

  {
    const base = vistaViva();
    ok(base.placar && base.naMao, 'montagem: a vista tinha de ter placar e naMao');

    for (const [campo, envenenar] of [
      ['placar', v => { v.placar = [ATAQUE, 0]; }],
      ['alvo', v => { v.alvo = ATAQUE; }],
      ['naMao', v => { v.naMao = [ATAQUE, 3]; }],
      ['tipo da cadeira', v => { v.cadeiras[1].tipo = ATAQUE; }],
    ]) {
      const v = vistaViva();
      envenenar(v);
      let e = null;
      try { mod.desenharHUD(v); } catch (err) { e = err; }
      ok(!e, `desenharHUD com ${campo} hostil estourou: ${e && e.message}`);
      ok(!cru().includes('<img'),
         `o ${campo} foi para o innerHTML SEM escapar — é script rodando na máquina dos convidados`);
    }
  }

  {
    // O `MODOS[vista.modo].rotulo` é o único ponto do arquivo que indexa `MODOS` cru. O
    // vizinho `:141` do mesmo arquivo já faz `MODOS[vista.modo] || MODOS[MODO_PADRAO]` —
    // guarda num lugar, esquecida no outro, que é o padrão que esta fila inteira persegue.
    for (const modo of ['inexistente', 'constructor', 42, { mau: 1 }]) {
      const v = vistaViva();
      v.modo = modo;
      let e = null;
      try { mod.desenharHUD(v); } catch (err) { e = err; }
      ok(!e, `um modo ${JSON.stringify(modo)} guardado derrubou o HUD inteiro: ${e && e.message}`);
    }
    const v = vistaViva();
    v.modo = 'constructor';
    try { mod.desenharHUD(v); } catch (err) { void err; }
    ok(!els.get('placar').innerHTML.includes('undefined'),
       'um modo de protótipo virou "undefined · até 6" na cara do jogador');
  }

  {
    // A tela de fim de mão, que é o outro innerHTML com números do fio. O resultado sai de
    // uma mão JOGADA ATÉ O FIM, e não escrito à mão: um `{motivo:'batida'}` sem `time` é um
    // estado que o jogo não produz, e a falha viria de dentro do HUD falando de outra coisa.
    // Esta casa já pagou isso — foi o bloco do prazo deixando `P.fase = 'fim'` posto à mão.
    vistaViva();
    for (let passo = 0; mod.P.fase !== 'fimDeMao' && mod.P.fase !== 'fim'; passo++) {
      if (passo > 3000) break;
      const vez = mod.P.vez;
      mod.aplicarIntencao(vez, mod.jogadaDoBot(mod.P, vez));
    }
    ok(mod.P.resultado, 'montagem: a mão precisava terminar para haver resultado de verdade');
    const v = JSON.parse(JSON.stringify(mod.visaoDe(mod.P, 0)));
    // Agora sim, um campo de cada vez, sobre o que o jogo produziu.
    v.resultado.somas = [ATAQUE, 3];
    v.resultado.pontos = ATAQUE;
    let e = null;
    try { mod.mostrarFimDeMao(v); } catch (err) { e = err; }
    ok(!e, `mostrarFimDeMao com somas hostis estourou: ${e && e.message}`);
    const html = els.get('fimSobrou').innerHTML + els.get('fimTitulo').innerHTML;
    ok(!html.includes('<img'), 'as somas do fim de mão foram para o innerHTML sem escapar');
  }
  {
    // A OUTRA PONTA, e ela é o lado do fio que NUNCA teve uma linha de teste: o
    // `linkAnfitriao.on('data')` do convidado, aninhado em dois callbacks do PeerJS.
    // `atualizarVista(m.v)` recebia o objeto cru — e três linhas acima o mesmo handler já
    // valida `m.cadeiras` com `Array.isArray`. O padrão existia e não tinha sido aplicado
    // ao objeto mais pesado que atravessa a rede.
    const boa = vistaViva();
    mod.encerrarRede();
    mod.conectarNaMesa('AAAA');
    Peer.ultimo.disparar('open');
    const link = mod.linkAnfitriao;
    ok(link && link.ouvintes, 'montagem: o convidado devia ter aberto o link com o anfitrião');
    const houve = link.disparar('open');
    ok(houve === 1, `montagem: o link devia ter 1 ouvinte de 'open' e tem ${houve}`);
    ok(link.ouvintes.has('data'), 'montagem: o handler de dados do convidado não foi instalado');

    for (const [rotulo, v] of [['ausente', undefined], ['nula', null], ['número', 7],
                               ['sem cadeiras', { linha: [], mao: [], naMao: [], placar: [] }],
                               ['vez fora da faixa', Object.assign({}, boa, { vez: 99 })],
                               ['mao que não é array', Object.assign({}, boa, { mao: 'oi' })]]) {
      let e = null;
      try { link.disparar('data', { t: 'vista', v }); } catch (err) { e = err; }
      ok(!e, `uma vista ${rotulo} vinda do fio matou a tela do convidado: ${e && e.message}`);
    }
    // E a vista BOA continua passando — guarda contra o conserto virar um "recusa tudo",
    // que deixaria as seis asserções acima verdes sem o jogo funcionar.
    let e = null;
    try { link.disparar('data', { t: 'vista', v: boa }); } catch (err) { e = err; }
    ok(!e, `a vista LEGÍTIMA foi recusada ou estourou: ${e && e.message}`);
    ok(mod.vistaAtual === boa, 'a vista boa não chegou à tela — o guarda está recusando o que devia passar');
  }
  console.log('  número do fio passa pelo escapar, como o nome ao lado dele');
}

// ─── FILA 12 ────────────────────────────────────────────────────────────────
// Os três achados da varredura de 11/08 que moram na casa. Todos NASCERAM VERMELHOS
// contra o código anterior — foram escritos depois de reproduzir cada um rodando.
console.log('\no fim de mão que chega pelo fio');
{
  mod.MESA.n = 2;
  mod.MESA.cadeiras[0].tipo = 'voce'; mod.MESA.cadeiras[0].nome = 'Ana';
  mod.MESA.cadeiras[1].tipo = 'bot';  mod.MESA.cadeiras[1].nome = 'Bot';
  mod.comecarLocal();
  const boa = JSON.parse(JSON.stringify(mod.visaoDe(mod.P, 1)));

  // C3 · `resultado` era o único campo que a tela de fim desreferencia DIRETO e que
  // nenhum validador cobria. `vistaDoFio` aceitava, e `mostrarFimDeMao` estourava —
  // no convidado isso é a tela parada, sem palavra e sem botão.
  //
  // As duas metades do conserto são medidas SEPARADAMENTE, porque falham de jeitos
  // diferentes e uma sozinha não cobre a outra: o `vistaDoFio` barra o continente
  // ausente, e o `nomeDaCadeira` barra o índice torto DENTRO de um continente válido.
  // Mutar só uma deixa a irmã segurando parte dos casos — é a lição do par
  // `clearTimeout`/geração, e por isso está escrita aqui.
  for (const [rotulo, r] of [['ausente', undefined], ['nulo', null]]) {
    const v = Object.assign({}, boa, { fase: 'fimDeMao' });
    if (r === undefined) delete v.resultado; else v.resultado = r;
    ok(!mod.vistaDoFio(v),
      `uma vista de fim de mão com resultado ${rotulo} passou pelo vistaDoFio — e quem a desenha estoura`);
  }
  // ...e o índice torto, que passa pelo continente e só quebra lá dentro.
  for (const [rotulo, res] of [
    ['vazio', {}],
    ['time fora da faixa', { motivo: 'batida', tipo: 'simples', time: 9, pontos: 1, vencedor: 9, somas: [3, 4] }],
    ['time de protótipo', { motivo: 'batida', tipo: 'simples', time: 'constructor', pontos: 1, somas: [3, 4] }],
  ]) {
    const v = Object.assign({}, boa, { fase: 'fimDeMao', resultado: res });
    let e = null;
    if (mod.vistaDoFio(v)) { try { mod.mostrarFimDeMao(v); } catch (err) { e = err; } }
    ok(!e, `resultado ${rotulo} matou a tela de fim de mão: ${e && e.message}`);
  }
  // E O CONTRÁRIO, senão o conserto vira um "recusa tudo" e as cinco acima ficam verdes
  // com o jogo quebrado — a mesma guarda que a cena da vista do fio já usa logo acima.
  ok(mod.vistaDoFio(boa), 'a vista LEGÍTIMA (fase de mão) foi recusada pelo guarda novo');
  const vFim = Object.assign({}, boa, { fase: 'fimDeMao', resultado: mod.P.resultado || { motivo: 'batida', tipo: 'simples', time: 0, pontos: 1, somas: [0, 9] } });
  ok(mod.vistaDoFio(vFim), 'uma vista de fim de mão COM resultado foi recusada — o guarda apertou demais');
  console.log('  vista de fim de mão sem resultado não passa, e com resultado torto não mata a tela');
}

// ─── FILA 13 ────────────────────────────────────────────────────────────────
console.log('\no CONTEÚDO da vista, e não só o continente');
{
  // A Fila 12 fez os validadores cobrarem que os campos EXISTEM e são arrays. A Fila 13
  // mediu o passo seguinte: `Array.isArray(v.linha)` deixa `linha: [null]` passar, e quem
  // desenha estoura. O `|| []` espalhado pelas telas protege contra o campo AUSENTE e
  // **não** contra o campo presente com outro tipo — `('xx' || [])` é `'xx'`.
  //
  // Vale para os DOIS jogos, e é por isso que as duas metades desta cena existem: consertar
  // um e esquecer o vizinho é o padrão que este repositório repete há seis filas.
  mod.MESA.n = 2;
  mod.MESA.cadeiras[0].tipo = 'voce'; mod.MESA.cadeiras[1].tipo = 'bot';
  mod.comecarLocal();
  mod.publicar();
  const boa = JSON.parse(JSON.stringify(mod.vistaAtual));
  ok(mod.vistaDoFio(boa), 'montagem: a vista boa de dominó já não passa — o resto não mediria nada');

  for (const [rot, f] of [
    ['linha[0] nulo',   v => { v.linha = [null]; }],
    ['linha[0] texto',  v => { v.linha = ['xx']; }],
    ['linha[0] curto',  v => { v.linha = [[1]]; }],
    ['mao[0] nulo',     v => { v.mao = [null]; }],
    ['pontas texto',    v => { v.pontas = 'xx'; }],
  ]) {
    const v = JSON.parse(JSON.stringify(boa)); f(v);
    ok(!mod.vistaDoFio(v),
      `uma vista com ${rot} passou pelo validador — e ela mata a tela de quem a desenha`);
  }
  // A PONTA AUSENTE CONTINUA VALENDO: `pontas` é nulo antes da primeira peça, e recusar
  // isso trancaria o convidado no saguão em toda mão nova. É a razão 2 do comentário do
  // truco, e ela vale aqui também — cobrar o que some numa fase é o defeito por dentro
  // do conserto.
  const semPontas = JSON.parse(JSON.stringify(boa));
  semPontas.pontas = null;
  ok(mod.vistaDoFio(semPontas), 'a vista SEM pontas foi recusada — ela é legítima no começo da mão');
  console.log('  peça torta dentro da linha não chega à mesa, e ponta ausente continua passando');
}

console.log('\no fim de mão em DUPLAS, com o resultado que vem do fio');
{
  // `somasPorTime` levava `|| []` enquanto o irmão `somas` ganhou `Array.isArray` — e os
  // dois estão na MESMA função, uma linha abaixo da outra. Foi o defeito que a Fila 12
  // existia para caçar, cometido DENTRO do conserto dela e achado pela varredura seguinte.
  //
  // SÓ APARECE EM DUPLAS: com dois jogadores o `sobrouNaMao` nem chega no ramo do time, e
  // toda a cena acima usa mesa de 2. Foi por isso que o conserto ficou sem asserção até a
  // mutação cobrar — a montagem é que não alcançava o ramo.
  mod.MESA.n = 4;
  for (let i = 0; i < 4; i++) { mod.MESA.cadeiras[i].tipo = i ? 'bot' : 'voce'; mod.MESA.cadeiras[i].nome = 'J' + i; }
  mod.comecarLocal();
  mod.publicar();
  const v = JSON.parse(JSON.stringify(mod.vistaAtual));
  ok(v.duplas === true, 'montagem: a mesa de 4 devia ser em duplas, senão o ramo do time não roda');
  v.fase = 'fimDeMao';
  v.resultado = { motivo: 'tranca', tipo: 'simples', time: 0, pontos: 1, vencedor: 0,
                  somas: [3, 4, 5, 6], somasPorTime: 'xx' };
  ok(mod.vistaDoFio(v), 'montagem: a vista precisa PASSAR, senão o teste mede a recusa e não o desenho');
  let e = null;
  try { mod.mostrarFimDeMao(v); } catch (err) { e = err; }
  ok(!e, `um somasPorTime que não é array matou a tela de fim de mão em duplas: ${e && e.message}`);
  console.log('  em duplas, o subtotal torto não derruba a tela');
}

console.log('\no nome do time: texto é texto, html é html');
{
  // C1 e C2 · `nomeDoTime` devolve HTML escapado e o nome dela não dizia isso. Quem monta
  // marcação usa essa; quem escreve `textContent` usa a de TEXTO. O valor está escrito à
  // mão de propósito: comparar com uma segunda chamada da mesma função seria comparar a
  // função com ela mesma, que é a armadilha do dublê vazio noutra forma.
  const vista = { duplas: false, cadeiras: [{ nome: 'Zé & Cia' }, { nome: 'Bot' }], cadeira: 0 };
  ok(mod.nomeDoTimeTexto(vista, 0) === 'Zé & Cia',
    `nomeDoTimeTexto devolveu ${JSON.stringify(mod.nomeDoTimeTexto(vista, 0))}, e texto não leva entidade`);
  ok(mod.nomeDoTime(vista, 0) === 'Zé &amp; Cia',
    `nomeDoTime devolveu ${JSON.stringify(mod.nomeDoTime(vista, 0))}, e html leva escape uma vez só`);
  // A guarda de faixa das duas, que é a segunda metade do C3.
  const vazio = { duplas: false, cadeiras: [] };
  ok(mod.nomeDoTimeTexto(vazio, 9) === 'Alguém' && mod.nomeDoTime(vazio, 9) === 'Alguém',
    'cadeira inexistente devia virar "Alguém" nas duas, e não estourar');
  // EM DUPLAS as duas metades passam pelo mesmo caminho — sem isto, o conserto poderia
  // ter arrumado só o ramo de 2 cadeiras, que é o que quase toda asserção deste arquivo usa.
  const dupla = { duplas: true, cadeiras: [{ nome: 'A & B' }, { nome: 'x' }, { nome: 'C' }, { nome: 'y' }] };
  ok(mod.nomeDoTimeTexto(dupla, 0) === 'A & B e C',
    `em duplas o texto saiu ${JSON.stringify(mod.nomeDoTimeTexto(dupla, 0))}`);
  ok(mod.nomeDoTime(dupla, 0) === 'A &amp; B e C',
    `em duplas o html saiu ${JSON.stringify(mod.nomeDoTime(dupla, 0))}`);

  // E A LINHA QUE CONSOME, que é o C2 de verdade. As quatro asserções acima medem as duas
  // FUNÇÕES, e a mutação provou que isso não basta: trocando `nomeDoTimeTexto` por
  // `nomeDoTime` na tela de campeão, a suíte inteira ficou VERDE. Asserção que não pega a
  // mutação não protege a linha — é a regra da casa, e ela cobrou aqui.
  mod.MESA.n = 2;
  mod.MESA.cadeiras[0].tipo = 'voce'; mod.MESA.cadeiras[0].nome = 'Zé & Cia';
  mod.MESA.cadeiras[1].tipo = 'bot';  mod.MESA.cadeiras[1].nome = 'Bot';
  mod.comecarLocal();
  const vFim = Object.assign({}, mod.visaoDe(mod.P, 0), {
    fase: 'fim', placar: [6, 0], alvo: 6, desistiu: null,
    resultado: { motivo: 'batida', tipo: 'simples', time: 0, pontos: 1, somas: [0, 9] },
  });
  mod.mostrarFimDePartida(vFim);
  const campeao = els.get('campeao').textContent;
  ok(campeao === 'Zé & Cia',
    `a tela de campeão mostrou ${JSON.stringify(campeao)} — em textContent o nome vai CRU, ` +
    `senão o jogador lê a entidade`);
  console.log('  o nome do time sai escapado uma vez no html, cru no texto, e a tela de campeão usa o certo');
}

console.log('\no que o convidado recebe tem teto');
{
  // C4 · `log` e `chat` entravam inteiros no DOM; só `erro`, a linha de cima, cortava.
  // NÃO se mede TEMPO aqui: o custo real é do navegador, e este harness dubla o DOM —
  // asserção de tempo mediria o dublê, que é a lição que a Fila 11 deixou escrita.
  // Mede-se o TAMANHO, que é o defeito em si e é determinístico.
  // Zerar as TRÊS, como as outras cenas de rede deste arquivo: só `encerrarRede` deixa
  // `conectando` de pé e o `conectarNaMesa` seguinte desiste calado, sem criar peer.
  mod.encerrarRede(); mod.voltarSozinho(''); mod.pararDeConectar('');
  mod.conectarNaMesa('AAAA');
  Peer.ultimo.disparar('open');
  const link = mod.linkAnfitriao;
  ok(link && link.ouvintes.has('data'), 'montagem: o despachante do convidado não foi instalado');

  const GIGANTE = 'A'.repeat(200000);
  mod.limparConversa();
  link.disparar('data', { t: 'log', txt: GIGANTE });
  const doLog = (mod.linhasDoLog[0] || {}).innerHTML || '';
  ok(mod.linhasDoLog.length === 1, 'montagem: a narração gigante não chegou à conversa');
  ok(doLog.length <= 200,
    `uma narração de 200 KB entrou na conversa com ${doLog.length} caracteres — o teto do vizinho é 160`);

  mod.limparConversa();
  link.disparar('data', { t: 'chat', de: 0, canal: 'geral', txt: GIGANTE, nome: 'Fulano' });
  const doChat = (mod.linhasDoLog[0] || {}).innerHTML || '';
  ok(mod.linhasDoLog.length === 1, 'montagem: a fala gigante não chegou à conversa');
  ok(doChat.length <= 300,
    `uma fala de 200 KB entrou na conversa com ${doChat.length} caracteres`);

  // E A MENSAGEM NORMAL CONTINUA INTEIRA — sem isto, cortar em zero passaria nas duas.
  mod.limparConversa();
  link.disparar('data', { t: 'log', txt: 'Sebastiãozinh0 correu — o outro time marca 3' });
  ok(((mod.linhasDoLog[0] || {}).innerHTML || '').includes('o outro time marca 3'),
    'a narração de tamanho normal foi cortada — o teto está apertado demais');
  mod.encerrarRede();
  console.log('  narração e fala que chegam pelo fio têm o mesmo teto do aviso ao lado');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
