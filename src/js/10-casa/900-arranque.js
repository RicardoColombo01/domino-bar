// O TERCEIRO TEMPO DA CARGA: escolher o jogo, montar a tela e ligar o loop.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Os outros dois tempos estão descritos em `010-constantes.js`. Este arquivo é o último de
// todos de propósito — é o único lugar de onde se enxerga a casa inteira E todos os jogos
// registrados.
//
// POR QUE ISTO PRECISOU EXISTIR. Até a v3 estas chamadas moravam soltas no fim de
// `140-menu.js` e de `160-loop.js`, e funcionavam porque só havia um jogo: "a tabela de
// modos" era a do dominó, ponto. Com dois jogos a mesma linha passa a ter duas respostas
// possíveis, e a única hora em que ela tem UMA é depois de alguém escolher.
//
// Repare no que NÃO veio para cá: os `addEventListener` e os `onclick` continuam onde
// estavam. Eles não executam nada na carga — registram um corpo que só roda no clique, muito
// depois de tudo existir. Mover o que não precisa ser movido seria trocar risco por nada.

function arrancar() {
  // 1. QUEM ESTÁ NA MESA. Hoje é sempre o dominó; a aba que deixa o jogador escolher entra
  //    aqui, e é por isso que a escolha já passa por `trocarDeJogo` em vez de uma atribuição.
  if (!trocarDeJogo('domino')) throw new Error('nenhum jogo se registrou em JOGOS');

  // 2. A MESA GUARDADA. Só agora `mesaLembrada()` sabe contra qual tabela de modos validar.
  //    `Object.assign` e não `MESA = …`: a referência tem de continuar a mesma, porque o
  //    projeto inteiro lê `MESA.n` direto.
  Object.assign(MESA, mesaLembrada());

  // 3. A TELA. Os botões nascem marcados no HTML com o padrão, então sem `refletir` o jogo
  //    começaria num Trio até 10 enquanto a tela promete Clássico até 6.
  refletirMesaNosBotoes();
  ajustarCadeirasAoModo();
  montarCadeiras();

  // 4. O ENQUADRAMENTO. Depois da mão existir: `enquadrar()` lê a profundidade dela e manda
  //    refazer o leque.
  enquadrar();

  // 5. O BOTÃO DE RETOMAR. O menu já nasce visível pelo HTML, então `mostrarTela` nunca roda
  //    na carga — sem esta chamada o botão só apareceria depois da primeira volta ao menu,
  //    que é justamente quando ele não serve mais para nada.
  atualizarBotaoRetomar();

  // 6. O QUE AS SUÍTES ALCANÇAM. A ponte da casa (`window.__jogo`) nasce com o que é da
  //    casa; o jogo despeja o resto por cima, com as MESMAS chaves de antes — foi assim que
  //    `grupoMonte` e `naMao` saíram de `160-loop.js` sem uma linha de teste mudar.
  //
  //    NÃO É `Object.assign`, e a diferença custou uma reprovação: `Object.assign` INVOCA os
  //    getters da origem e copia o VALOR. O `get maoNaTela()` da ponte virava uma fotografia
  //    tirada neste instante — a mão vazia, porque ainda não há partida —, e depois de
  //    retomar uma partida guardada a suíte via "23 peças na mesa, 0 na sua mão". Copiar os
  //    DESCRITORES leva o getter inteiro, e ele continua sendo consultado na hora.
  Object.defineProperties(window.__jogo, Object.getOwnPropertyDescriptors(JOGO.ponte));

  // 7. E O LOOP.
  requestAnimationFrame(quadro);
}

arrancar();
