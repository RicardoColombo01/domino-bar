// A TELA DO SAGUÃO: o código da mesa, quem já chegou, e os botões de abrir/entrar/voltar.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// Por que este arquivo existe. `150-rede.js` tinha 45 chamadas `el('…')` — mais que o
// próprio HUD, que é o arquivo cujo trabalho É desenhar. A dívida estava anotada como
// "dominó disfarçado de rede", e medindo os ids ela era outra coisa: os onze são TODOS do
// saguão (`onlineTitulo`, `onlineCodigo`, `btConectar`…), e saguão é da casa tanto quanto
// a rede é. O que estava misturado não era jogo com rede — era TRANSPORTE com APRESENTAÇÃO.
//
// A divisão que ficou: a rede decide o que É (esta cadeira chegou, aquela espera, faltam
// dois), o saguão decide como isso APARECE. Nenhuma das duas metades sabe que o jogo é
// dominó, e é isso que faz as duas irem para o truco sem uma linha nova.
//
// O número 145 põe a tela ANTES de quem a dirige, que é a ordem em que se lê. Funciona nos
// dois sentidos porque tudo aqui é `function` (içada) e os handlers só rodam ao clique,
// muito depois de a página inteira estar carregada.

// Os elementos, pegos UMA vez. Mesmo padrão do `HUD` em 130-hud.js, e pelo mesmo motivo:
// `el()` faz uma busca no documento, e estes onze são consultados a cada troca de estado.
const SAGUAO = {
  titulo: el('onlineTitulo'), sub: el('onlineSub'), codigo: el('onlineCodigo'),
  entrada: el('onlineEntrada'), nome: el('onlineNome'), lista: el('onlineLista'),
  erro: el('onlineErro'), entrar: el('btConectar'), comecar: el('btIniciarOnline'),
  cancelar: el('btCancelarOnline'), voltar: el('btVoltarMesa'),
};

// O canal de recado da tela. Nome antigo de propósito: são quinze chamadas em `150-rede.js`
// e renomear todas seria churn sem ganho — o que mudou é o arquivo em que ele mora.
function erroOnline(txt) {
  SAGUAO.erro.textContent = txt;
}

// ─── os três estados da tela ─────────────────────────────────────────────────
// São três telas de verdade, não variações: quem ABRE mesa mostra um código e um botão de
// começar; quem ENTRA mostra dois campos e um botão de entrar; quem CAIU mostra só o
// recado. Estavam escritas três vezes em `150-rede.js`, cada uma com seis linhas de
// `classList` — e a de reabrir era cópia byte a byte da de abrir, com outro título.
function saguaoDeAnfitriao(titulo, sub, codigo) {
  mostrarTela('telaOnline');
  SAGUAO.titulo.textContent = titulo;
  SAGUAO.sub.textContent = sub;
  SAGUAO.codigo.textContent = codigo;
  SAGUAO.entrada.classList.add('oculta');
  SAGUAO.nome.classList.add('oculta');       // quem abre a mesa nomeia as cadeiras no menu
  SAGUAO.entrar.classList.add('oculta');
  SAGUAO.comecar.classList.remove('oculta');
}

function saguaoDeConvidado(nomePadrao, codigoPadrao) {
  mostrarTela('telaOnline');
  SAGUAO.titulo.textContent = 'Entrar numa mesa';
  SAGUAO.sub.textContent = 'Digite o código que o anfitrião passou.';
  SAGUAO.codigo.textContent = '';
  SAGUAO.entrada.classList.remove('oculta');
  // O NOME, que só o convidado precisa dizer. Pré-preenchido com o do menu — que é
  // exatamente o que ele já mandava calado —, então o campo não inventa caminho novo: ele
  // torna visível e editável o que sempre viajou. Era esta ausência que fazia a mesa de
  // dois virar "Você × Você" sem que ninguém soubesse onde mudar.
  SAGUAO.nome.classList.remove('oculta');
  SAGUAO.nome.value = nomePadrao;
  // Pré-preenchido com a última mesa em que você sentou: quem volta quase sempre volta
  // para a mesma, e antes o campo era zerado justamente aqui.
  SAGUAO.entrada.value = codigoPadrao;
  SAGUAO.entrada.focus();
  SAGUAO.entrar.classList.remove('oculta');
  SAGUAO.comecar.classList.add('oculta');
  SAGUAO.lista.innerHTML = '';
}

function saguaoDeQueda() {
  mostrarTela('telaOnline');
  SAGUAO.titulo.textContent = 'A mesa caiu';
  SAGUAO.sub.textContent = 'Tentando voltar — o anfitrião pode estar recarregando.';
}

const saguaoCodigo = codigo => { SAGUAO.codigo.textContent = codigo; };

// ─── quem já chegou ──────────────────────────────────────────────────────────
// Recebe o que CADA cadeira é e devolve a lista pintada. A rede monta os estados porque só
// ela sabe quem conectou; o escape mora aqui porque é aqui que o texto vira HTML — e este
// nome foi escrito pelo convidado, então um `<img onerror>` rodava script na máquina do
// anfitrião. É o buraco mais antigo do projeto, e ele mora do lado da apresentação.
function saguaoLista(itens, rotuloComecar) {
  SAGUAO.lista.innerHTML = itens
    .map(i => `<div><span>${escapar(i.nome)}</span><b>${i.estado}</b></div>`).join('');
  SAGUAO.comecar.textContent = rotuloComecar;
}

// ─── o botão de entrar, e os três estados dele ───────────────────────────────
// 'solto' destrava; 'entrando' e 'namesa' travam. SENTADO NÃO É OCIOSO: o botão fica travado
// depois do `sentou`, porque solto ele reconectaria — e como o clienteId é o mesmo, o jogador
// faria take-over da própria cadeira. O texto muda porque a tela não muda até o anfitrião
// começar, e era essa espera muda que convidava ao segundo clique.
const ROTULO_ENTRAR = { solto: 'Entrar', entrando: 'Entrando…', namesa: 'Na mesa' };

function saguaoEntrar(estado) {
  SAGUAO.entrar.disabled = estado !== 'solto';
  SAGUAO.entrar.textContent = ROTULO_ENTRAR[estado];
}

// ─── o botão de voltar, que mora no MENU ─────────────────────────────────────
// REABRIR e VOLTAR são coisas diferentes, e o botão tem de dizer qual é: no anfitrião a
// mesa nasce de novo dele; no convidado ele vai bater na porta de alguém.
function atualizarBotaoVoltarMesa() {
  const g = salaGuardada();
  SAGUAO.voltar.classList.toggle('oculta', !g);
  if (g) SAGUAO.voltar.textContent = g.anfitriao
    ? `Reabrir a sua mesa ${g.codigo}` : `Voltar para a mesa ${g.codigo}`;
}

// ─── os quatro cliques ───────────────────────────────────────────────────────
// COMEÇAR A PARTIDA DESLIGA A RESERVA DO CÓDIGO. Este botão fica visível na tela de
// reabertura, e é a ÚNICA porta de lá que não passa pelo `encerrarRede` — o "Voltar" passa.
// Sem esta linha, o anfitrião que cansa de esperar o código e começa a jogar vê a reserva
// acordar 1,5 s depois e trocar a partida que ele acabou de montar pela guardada.
SAGUAO.comecar.onclick = () => { pararDeReservar(); comecarLocal(); };

SAGUAO.cancelar.onclick = () => { recomecarAsVoltas(); encerrarRede(); mostrarTela('telaMenu'); };

// O NOME VALE PARA A MESA E PARA O MENU. Quem se apresentou como "Lia" aqui não quer voltar
// a ser "Careca" na próxima partida local — e é `lembrarMesa()` que faz isso durar, o mesmo
// caminho do campo do menu. Um segundo lugar que gravasse nome é como as duas telas passam
// a discordar. Campo vazio não apaga nada: fica o que o menu já dizia.
SAGUAO.entrar.onclick = () => {
  // A porta que NÃO passa por `entrarNumaMesa`: Entrar direto, da tela "A mesa caiu". Quem
  // digita um código e clica está começando de novo, e a escada tem de acompanhar.
  recomecarAsVoltas();
  const nome = SAGUAO.nome.value.trim().slice(0, 14);
  if (nome && nome !== MESA.cadeiras[0].nome) {
    MESA.cadeiras[0].nome = nome;
    lembrarMesa();
    montarCadeiras();                     // o menu atrás desta tela mostra o nome novo
  }
  conectarNaMesa(SAGUAO.entrada.value.trim().toUpperCase());
};

SAGUAO.voltar.onclick = () => {
  const g = salaGuardada();
  if (!g) { avisar('O código daquela mesa venceu.'); atualizarBotaoVoltarMesa(); return; }
  tocarClique();
  if (g.anfitriao) { reabrirMesaOnline(); return; }
  entrarNumaMesa();                       // prepara a tela; ela já pré-preenche o campo
  conectarNaMesa(g.codigo);
};
