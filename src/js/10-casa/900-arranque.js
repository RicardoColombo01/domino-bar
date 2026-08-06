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
  // 1. A FAIXA DE ABAS, montada a partir de quem se registrou. Antes de escolher, porque
  //    `abrirJogo` marca a aba ativa e ela precisa existir para receber a marca.
  montarAbas();

  // 2. QUEM ESTÁ NA MESA: a URL, senão a preferência, senão o primeiro do balcão. Tudo o que
  //    era feito aqui — a mesa guardada, os modos, as cadeiras, o botão de retomar e a ponte
  //    das suítes — mora dentro de `abrirJogo` (141-abas.js), porque a aba faz exatamente a
  //    mesma coisa e duas cópias da mesma sequência é como o defeito 3 da Fila 6 durou.
  if (!abrirJogo(jogoEscolhido())) throw new Error('nenhum jogo se registrou em JOGOS');

  // 3. O ENQUADRAMENTO. Depois de a mão existir: `enquadrar()` lê a profundidade dela e manda
  //    refazer o leque.
  enquadrar();

  // 4. E O LOOP.
  requestAnimationFrame(quadro);
}

arrancar();
