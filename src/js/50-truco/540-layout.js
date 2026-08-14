// ONDE CADA CARTA FICA NA MESA. Puro cálculo — nada de Three.js aqui, o que deixa o
// posicionamento testável no terminal.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// O TRUCO É O OPOSTO DO DOMINÓ neste ponto, e é a diferença que manda no arquivo inteiro:
// a linha do dominó só CRESCE, e o serpenteio dela é o problema; a mesa do truco tem no
// máximo quatro cartas e ESVAZIA a cada vaza. Não há dobra, não há escala variável, não há
// braço. O que há é um lugar por cadeira, e um monte de vazas ganhas de cada lado.
//
//                       ┌─────────────────────────┐
//                       │          ▭ cad. 2       │   cada carta cai NA DIREÇÃO de quem a
//        vazas do   ▤   │   ▭             ▭       │   jogou — é assim que se sabe de quem
//        time 1         │ cad.1   ⊙vira  cad.3    │   é a carta sem ninguém dizer
//                       │          ▭ você         │   ⊙ a vira, no centro e virada
//                       └─────────────────────────┘
//                                                ▤ vazas do time 0
//
// A VIRA FICA NO CENTRO e as cartas em volta. Ela é a única carta pública do baralho e é o
// que diz qual é a manilha — sem ela na mesa, o jogador não tem como saber, e o jogo fica
// ilegível. Pôr as cartas EM VOLTA dela, e não por cima, é o que a mantém visível a mão
// inteira.

// O raio em que as cartas da vaza caem, a partir do centro. Sai do tamanho da carta, e não
// de um número escolhido a olho: é o mesmo argumento do espaçamento da mão no dominó — um
// número fixo menor que a carta faz uma cobrir a outra.
//
// ⚠ E ELE ERA PEQUENO DEMAIS — defeito de campo, relatado com foto em 13/08/2026 ("todo
// bugado"). A conta, que ninguém tinha feito:
//
//   a sua carta ocupa      x ∈ [−0.31, 0.31]   z ∈ [R − 0.44, R + 0.44]
//   a do vizinho (a 90°)   x ∈ [R − 0.44, R + 0.44]   z ∈ [−0.31, 0.31]
//   elas se cobrem em      0.75 − R,  nos DOIS eixos
//   a vira, deitada        x ∈ [−0.44, 0.44]   z ∈ [−0.31, 0.31]  →  o MESMO 0.75 − R
//
// Com `0.78` o raio era 0.686, e sobravam **0.064 de sobreposição** com o vizinho e com a
// vira. Medido na mesa de verdade, já escalado: 0.57 × 0.84 entre duas cartas vizinhas.
// `0.75 / CARTA_C` = 0.852 é o ponto em que elas apenas se encostam; `0.92` dá a folga que
// separa de fato — e é a mesma disciplina do "sete pixels de folga não são um conserto, são
// sorte".
//
// POR QUE NENHUMA SUÍTE VIA, e isto estava escrito no `590-registro.js` há uma release: o
// `folgaEntre` do `test-telas` **só compara ENTRE grupos, nunca dentro de um** — a vira e as
// cartas jogadas são irmãs dentro de `grupoMesaDoTruco`. Ponto cego declarado é ponto cego
// onde o defeito mora, e agora há asserção no `test-truco`, que é puro e instantâneo.
const RAIO_DA_VAZA = CARTA_C * 0.92;

// Onde a vira fica: no centro, deitada de lado. Deitada porque assim ela não se confunde
// com carta jogada nenhuma — a mesa inteira está de pé para alguém, e ela não está para
// ninguém.
const VIRA_ROT = Math.PI / 2;

// ─── a vira fica EM CIMA DO BARALHO ──────────────────────────────────────────
// Relato do Ricardo, olhando a mesa: dá para ver o naipe da vira e NÃO o valor. Ela é a
// única carta pública do baralho, e o painel do `#topo` mostra o DERIVADO (a manilha), não
// ela.
//
// E A MEDIÇÃO ACHOU MAIS DO QUE O RELATO DIZIA. O comentário logo acima afirmava que pôr as
// cartas "em volta dela, e não por cima" é o que a mantém visível — e a conta desmente:
//
//   vira deitada     x −0.440 a 0.440   z −0.310 a 0.310
//   a carta que VOCÊ joga    x −0.310 a 0.310   z  0.246 a 1.126
//   sobreposição             x  0.620           z  0.064
//
// As duas positivas quer dizer que elas se cobrem — e, pior, no MESMO plano, porque toda
// carta na mesa descansa em `y = CARTA_E/2`. Duas superfícies coplanares disputando o mesmo
// pixel é z-fighting, e ele pisca conforme a câmera respira. A razão estava escrita, era
// plausível, e estava errada; é a mesma espécie de afirmação não medida que a v4.7 pagou
// com o truco online "herdando de graça".
//
// Erguer a vira resolve as duas coisas com um gesto só, e é o gesto da mesa de verdade: o
// baralho fica no meio e a vira DEITADA EM CIMA DELE, atravessada. Ela sai do plano das
// cartas jogadas (some o z-fighting), fica mais perto da câmera (logo maior em tela) e ganha
// sombra própria, que é o que a descola do tampo.
//
// SETE CARTAS, e o número é de leitura e não de contagem: sobram 33 no baralho de uma mesa
// de 2, e desenhá-las viraria uma torre de 1.15 no meio da mesa. Sete é o que o olho lê como
// "um baralho" — a mesma escolha que o monte do dominó faz.
const CARTAS_NO_TOCO = 7;
// A vira DESCANSA no topo do toco, e a conta é a de empilhar: a carta `k` do toco tem o
// centro em `CARTA_E/2 + k·CARTA_E`, então a face de cima da última fica exatamente em
// `CARTAS_NO_TOCO · CARTA_E`. Como a animação põe o centro da carta em `alvo.y + CARTA_E/2`,
// este número é o `alvo.y` da vira — ela pousa colada, sem folga e sem afundar.
const ALTURA_DA_VIRA = CARTAS_NO_TOCO * CARTA_E;

// A cadeira `i` vista de quem senta em `eu`, numa mesa de `n`. É a MESMA conta do dominó
// (`anguloDaCadeira`), e ela mora lá porque é da mesa e não do jogo — quem senta à sua
// frente está à sua frente em qualquer jogo. Aqui só se usa.
//
// 0 é a SUA direção (para você, na frente da tela). Cresce no sentido da mesa.
function postaDaVaza(cadeira, eu, n) {
  const a = anguloDaCadeira(cadeira, eu, n);
  return {
    // A CONVENÇÃO É A DA CASA, e tinha de ser: `assentosDaMesa` (070-cena.js) põe o assento
    // da cadeira `i` em `sin(a), cos(a)`, e a carta dela tem de cair DO MESMO LADO em que a
    // pessoa está sentada. A primeira versão daqui tinha `-sin`, o que espelhava a mesa: o
    // vizinho da esquerda jogava e a carta aparecia à direita. Nenhuma foto denuncia isso —
    // a mesa continua simétrica e bonita —, e por isso há asserção amarrando um ao outro.
    //
    // O ângulo 0 aponta para VOCÊ, que em coordenadas de mundo é +z (a câmera olha de +z
    // para a origem), e é de onde vem o `cos` no z.
    x: Math.sin(a) * RAIO_DA_VAZA,
    z: Math.cos(a) * RAIO_DA_VAZA,
    // A carta fica de pé para quem a jogou. `rotY` é o mesmo ângulo, e é isso que faz a
    // carta do adversário aparecer de cabeça para baixo — como na mesa de verdade.
    rotY: a,
  };
}

// A mesa inteira de uma vaza: uma posta por carta jogada, na ordem em que caíram.
function layoutDaVaza(mesa, eu, n) {
  return mesa.map(j => Object.assign({ cadeira: j.cadeira, carta: j.carta }, postaDaVaza(j.cadeira, eu, n)));
}

// ─── as vazas já ganhas ──────────────────────────────────────────────────────
// Empilhadas de lado, uma pilha por time, viradas para baixo — é o que a mesa de verdade
// faz: quem ganha a vaza recolhe as cartas e põe na sua frente.
//
// POR QUE ISTO EXISTE, e não é enfeite: sem as vazas visíveis, o jogador tem de LEMBRAR
// quem ganhou o quê para saber em que pé está a mão. O truco é melhor de três, e a conta
// das vazas é a informação mais importante da mesa depois da própria mão.
//
// `time` é 0 ou 1; `null` (melou) empilha no MEIO, porque ela não é de ninguém.
const LADO_DA_PILHA = CARTA_L * 2.6;
const PASSO_DA_PILHA = CARTA_E * 1.4;

function postaDaVazaGanha(indice, time, eu, n) {
  // A pilha do SEU time fica do seu lado. Se você é do time 0, o time 0 empilha à direita.
  const meu = n === 4 ? eu % 2 : eu;
  const lado = time === null ? 0 : (time === meu ? 1 : -1);
  return {
    x: lado * LADO_DA_PILHA,
    // Empilha para trás, para a pilha não crescer por cima da vaza em curso.
    z: -CARTA_C * 0.55 - indice * CARTA_C * 0.12,
    y: indice * PASSO_DA_PILHA,
    rotY: lado === 0 ? VIRA_ROT : 0,
    // O melou fica levemente girado, para se distinguir de uma pilha comum sem precisar de
    // legenda: uma vaza que não foi de ninguém não pode parecer de alguém.
    inclinada: time === null,
  };
}

function layoutDasVazas(vazas, eu, n) {
  return vazas.map((v, i) => Object.assign({ time: v.time }, postaDaVazaGanha(i, v.time, eu, n)));
}

// ─── a caixa que tudo isso ocupa ─────────────────────────────────────────────
// Serve à mesma pergunta que o `larguraUtilDoTabuleiro` do dominó responde: cabe na tela?
// Aqui a resposta é mais simples porque a mesa não cresce — ela tem tamanho fixo, e o que
// varia é quantas cadeiras há.
//
// Devolve meia-largura e meia-profundidade, em unidades de mundo, a partir do centro.
function caixaDaMesaDoTruco(n) {
  const alcance = RAIO_DA_VAZA + Math.max(CARTA_C, CARTA_L) / 2;
  return {
    // A pilha das vazas é o que estica a mesa para os lados — mais que as cartas jogadas.
    x: Math.max(alcance, LADO_DA_PILHA + CARTA_L / 2),
    z: n === 2 ? alcance : alcance * 0.92,   // mesa de 2 só usa frente e fundo
  };
}
