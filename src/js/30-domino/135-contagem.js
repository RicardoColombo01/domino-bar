// O painel de apoio do DOMINÓ: quantas peças de cada número ainda não apareceram.
// (parte de src/js — todos os arquivos compartilham o mesmo escopo)
//
// A gaveta que o mostra, o botão que a abre e a preferência lembrada são da casa
// (`10-casa/130-hud.js`); o que vai DENTRO é regra de dominó, e por isso mora aqui.
//
// O número 135 põe este arquivo logo depois do HUD, que é quem declara `painelDoJogo`,
// `HUD` e `escapar` — a linha de encaixe lá embaixo é uma ATRIBUIÇÃO e roda na carga, então
// ela não pode acontecer antes de o `let` existir.

// Quantas peças de cada número já apareceram — as da mesa MAIS as da sua mão, como o
// Ricardo pediu. Sai inteiro de `vista`: é exatamente o que o jogador enxerga, então não
// vaza nada e não precisou de nada novo no motor.
function desenharContagem(vista) {
  HUD.contagem.classList.toggle('oculta', !contando || !vista.mao);
  if (!contando || !vista.mao) return;

  const baralho = baralhoDoModo(MODOS[vista.modo] || MODOS[MODO_PADRAO]);
  const aparecidas = vista.linha.concat(vista.mao);
  const linhas = [];
  for (let n = 0; n <= MAX_PINTAS; n++) {
    // O total NÃO é 7 fixo: no Trio o 0|0 sai do baralho e o zero mora em 6 peças.
    const total = baralho.filter(p => p[0] === n || p[1] === n).length;
    if (!total) continue;
    const visto = aparecidas.filter(p => p[0] === n || p[1] === n).length;
    // Quem passou numa ponta provou não ter aquele número. É informação pública — a
    // mesa inteira viu o passe —, e até agora só o bot usava.
    const semEle = (vista.faltaNo || [])
      .map((nums, i) => (i !== vista.cadeira && nums.indexOf(n) >= 0 ? escapar(vista.cadeiras[i].nome) : null))
      .filter(Boolean);
    linhas.push(`<div${visto === total ? ' class="zerado"' : ''}>` +
      `<b>${n}</b>` +
      `<i>${'▮'.repeat(visto)}${'▯'.repeat(total - visto)}</i>` +
      `<s>${total - visto || '—'}</s>` +
      `<em>${semEle.join(', ')}</em></div>`);
  }
  HUD.contagem.innerHTML = '<span class="rot">faltam aparecer</span>' + linhas.join('');
}

// É por esta linha que o HUD da casa desenha um painel de dominó sem nunca citar dominó.
painelDoJogo = desenharContagem;
