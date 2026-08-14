// O CONVITE: como alguém que não está aqui vem parar na sua mesa.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// O código de quatro letras existe desde a v1.6.0 e o caso de uso real sempre foi o mesmo:
// mandar pelo WhatsApp. Até aqui isso era `user-select: all` — que resolve o mouse e é
// sofrível no dedo, justamente no aparelho em que a conversa está aberta ao lado.
//
// SÃO TRÊS PORTAS EM CASCATA, e a última é o que já existia:
//
//   navigator.share       o celular — a folha de compartilhar do sistema, com o WhatsApp nela
//   navigator.clipboard   o computador — copia e avisa
//   a seleção             o resto — seleciona o código para o Ctrl+C
//
// A terceira não é decoração: em `file://` (o duplo-clique, que é meio motivo de este jogo
// existir) `navigator.clipboard` simplesmente não existe, porque não é contexto seguro.
//
// DEVOLVE QUAL PORTA CORREU, e isso não é enfeite de teste: sem o retorno, "o botão fez
// alguma coisa" é a asserção de "tem tinta em algum lugar" que este projeto já condena — a
// mesma que aprovava o naipe de paus com um furo no meio.

// O MESMO validador do `salaGuardada`, e de propósito: um código que vem pela URL é entrada
// de fora igual ao que vem do armazenamento, e este arquivo já pagou caro por ter a guarda
// num lugar e não no vizinho. Se um dia o alfabeto mudar, os dois têm de mudar juntos.
const CODIGO_DO_CONVITE = /^[A-Z0-9]{3,8}$/;

// O LINK só existe onde há endereço de verdade. Em `file://` o `location.origin` é a STRING
// "null", e o convite sairia com `null/index.html?sala=XJCR` colado na conversa de alguém —
// é o mesmo defeito do `String(undefined)` que já batizou uma cadeira de "undefined".
//
// E O `jogo=` É OBRIGATÓRIO: sem ele quem recebe abre na preferência DELE e leva um "essa
// mesa é de outro jogo" na cara — o mecanismo de recusa da v4.7 funcionando perfeitamente
// contra o próprio convite.
function linkDaMesa(codigo) {
  if (location.protocol.indexOf('http') !== 0) return '';
  const p = new URLSearchParams(location.search);
  p.set('jogo', JOGO_ID);
  p.set('sala', codigo);
  return location.origin + location.pathname + '?' + p.toString();
}

// O nome do jogo sai do CONTRATO (`JOGO.nome`), nunca escrito à mão: a casa não sabe o nome
// de jogo nenhum, e o `test-acoplamento` cobra isso inclusive em texto.
function conviteDaMesa(codigo) {
  const link = linkDaMesa(codigo);
  return `${JOGO.nome} — a mesa é ${codigo}` + (link ? `\n${link}` : '');
}

function selecionarOCodigo() {
  try { getSelection().selectAllChildren(HUD.sala); } catch (e) { void e; }
  avisar('Selecionei o código — copie com Ctrl+C.');
  return 'selecao';
}

function compartilharSala() {
  const codigo = codigoDaSala;
  if (!codigo) return '';                    // sem mesa aberta não há convite a mandar
  const txt = conviteDaMesa(codigo);
  if (navigator.share) {
    // CANCELAR NÃO É FALHAR. A folha do sistema rejeita com `AbortError` quando a pessoa
    // desiste, e cair para a cópia aqui copiaria pelas costas de quem acabou de fechar — e
    // ainda diria "copiado". É a família do `catch` tranquilizador que engole o defeito de
    // verdade, ao contrário: aqui o silêncio é a resposta certa.
    navigator.share({ title: JOGO.nome, text: txt }).catch(() => {});
    return 'share';
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => avisar('Convite copiado.'), () => selecionarOCodigo());
    return 'copia';
  }
  return selecionarOCodigo();
}

// ─── o outro lado: quem CHEGA pelo link ──────────────────────────────────────
// `?sala=XJCR` PRÉ-PREENCHE o campo do saguão, e não conecta sozinho. Três razões, em ordem
// de peso: conectar na carga criaria um `Peer` antes de qualquer gesto, num caminho que roda
// em toda suíte de navegador; a pessoa ainda não disse quem é, e o nome é justamente o que
// impede o placar de dizer "Você × Você"; e o `conectarNaMesa` tem uma máquina de estados
// própria que hoje só é alcançada por clique — um segundo dono dela na carga é a espécie de
// coisa que a Fila 11 inteira passou consertando.
//
// Um toque a mais custa um toque. O outro caminho custa uma classe de defeitos.
function salaDaURL() {
  const bruto = new URLSearchParams(location.search).get('sala');
  if (typeof bruto !== 'string') return '';
  const codigo = bruto.trim().toUpperCase();
  return CODIGO_DO_CONVITE.test(codigo) ? codigo : '';
}

// LIDO UMA VEZ NA CARGA e guardado, porque a URL é limpa logo em seguida: sem a limpeza, um
// F5 reabriria o saguão para sempre, e quem pergunta pelo código (a escada do saguão, em
// `entrarNumaMesa`) roda depois disso.
const salaDoConvite = salaDaURL();

// Chamado pelo arranque. Devolve se havia convite — é o que torna afirmável "abriu o saguão"
// contra "não fez nada", sem inventar um segundo estado só para o teste.
function entrarPeloConvite() {
  if (!salaDoConvite) return false;
  reescreverBusca(p => p.delete('sala'));
  entrarNumaMesa();
  return true;
}
