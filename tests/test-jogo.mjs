// O jogo inteiro montado em Node: cena, HUD, mão, tabuleiro e uma partida do começo
// ao fim. Só o `import` já vale como teste — ele constrói a cena Three.js de verdade,
// e geometria inválida ou variável indefinida estoura aqui em vez de virar tela preta.
import path from 'path';
import { installStubs, seedRandom, buildModule, frames, correrTimers, els, fire } from './harness.mjs';

installStubs();
seedRandom(99);

const mod = await import(buildModule([
  'MESA', 'comecarLocal', 'pedirAcao', 'aplicarIntencao', 'atualizarVista', 'jogadaDoBot',
  'visaoDe', 'novaMao', 'publicar', 'P', 'vistaAtual', 'euNaTela', 'travado', 'naMao', 'naMesa',
  'grupoMao', 'grupoOutros', 'grupoMonte', 'grupoMesa', 'scene', 'renderer', 'camera',
  'selecionarPeca', 'cancelarEscolha', 'confirmarJogada', 'escolhida', 'grupoPrevia', 'chave',
  'arrumarMao', 'moverNaMao', 'carroca',
  'guardarFala', 'soltarFalasGuardadas', 'falasGuardadas', 'donoLocalDaFala', 'limparConversa',
  'dicaDaVista', 'pedirDica',
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
  // jogo faz para mirar (11-interacao.js).
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

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
