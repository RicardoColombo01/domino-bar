// O jogo inteiro montado em Node: cena, HUD, mão, tabuleiro e uma partida do começo
// ao fim. Só o `import` já vale como teste — ele constrói a cena Three.js de verdade,
// e geometria inválida ou variável indefinida estoura aqui em vez de virar tela preta.
import path from 'path';
import { installStubs, seedRandom, buildModule, frames, correrTimers, els } from './harness.mjs';

installStubs();
seedRandom(99);

const mod = await import(buildModule([
  'MESA', 'comecarLocal', 'pedirAcao', 'aplicarIntencao', 'atualizarVista', 'jogadaDoBot',
  'visaoDe', 'novaMao', 'publicar', 'P', 'vistaAtual', 'euNaTela', 'travado', 'naMao', 'naMesa',
  'grupoMao', 'grupoOutros', 'grupoMonte', 'grupoMesa', 'scene', 'renderer',
  'selecionarPeca', 'cancelarEscolha', 'confirmarJogada', 'escolhida', 'grupoPrevia', 'chave',
], undefined, path.join(import.meta.dirname, 'built-jogo.mjs')));

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
  const escala = mod.naMao[0].obj.scale.x;
  const daFrente = mod.naMao.filter(m => m.yBase === frente).map(m => m.xBase).sort((a, b) => a - b);
  const passo = daFrente[1] - daFrente[0];
  ok(passo >= escala - 1e-9,
     `as peças da fileira se sobrepõem: passo ${passo.toFixed(3)} contra peça de ${escala.toFixed(3)}`);

  // E a mão inteira tem de caber na largura visível na frente da câmera.
  const usada = daFrente[daFrente.length - 1] - daFrente[0] + escala;
  ok(usada <= 8.2 + 1e-9, `a mão ocupou ${usada.toFixed(2)} de largura, mais que os 8.2 visíveis`);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
