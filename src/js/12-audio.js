// Som sem nenhum arquivo: tudo sintetizado no WebAudio na hora.
// (parte de src/js — mesmo escopo, concatenado por build.mjs)
//
// Uma peça batendo na madeira é um estalo curto de ruído filtrado somado a um baque
// grave — dá para descrever isso em dez linhas, e aí o jogo continua sendo um arquivo
// só, sem pasta de mp3 e sem esperar download nenhum para começar.

let ac = null, ruidoBuf = null, murmuro = null;

function ligarAudio() {
  if (ac || typeof AudioContext === 'undefined') return ac;
  ac = new AudioContext();
  const n = Math.floor(ac.sampleRate * 2);
  ruidoBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return ac;
}
// Navegador só deixa tocar som depois de um gesto do usuário — este é o gesto.
addEventListener('pointerdown', () => { ligarAudio(); if (ac && ac.state === 'suspended') ac.resume(); });

function estalo({ dur = 0.09, freq = 1500, q = 1.1, vol = 0.3, tipo = 'bandpass' }) {
  if (!ligarAudio()) return;
  const s = ac.createBufferSource(); s.buffer = ruidoBuf;
  s.loop = true;
  const f = ac.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(t); s.stop(t + dur + 0.02);
}

function nota(freq, dur, vol, onda = 'triangle', atraso = 0) {
  if (!ligarAudio()) return;
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + atraso;
  o.type = onda; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

const tocarBaque = (f = 1) => { estalo({ dur: 0.08, freq: 1700, vol: 0.26 * f }); nota(96, 0.11, 0.16 * f, 'sine'); };
const tocarClique = () => estalo({ dur: 0.035, freq: 2600, q: 2, vol: 0.13 });
const tocarCompra = () => estalo({ dur: 0.13, freq: 900, q: 0.7, vol: 0.16 });
const tocarPasse = () => { estalo({ dur: 0.05, freq: 420, q: 0.8, vol: 0.2 }); estalo({ dur: 0.05, freq: 420, q: 0.8, vol: 0.18 }); };
const tocarEmbaralho = () => estalo({ dur: 0.85, freq: 2300, q: 0.35, vol: 0.15 });
function tocarBatida() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, 0.32, 0.16, 'triangle', i * 0.075));
}

// Murmurinho do salão: ruído grave filtrado, bem baixo. Mantém o silêncio de estúdio
// longe sem virar trilha sonora.
function ligarMurmuro() {
  if (murmuro || !ligarAudio()) return;
  const s = ac.createBufferSource(); s.buffer = ruidoBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 330;
  const g = ac.createGain(); g.gain.value = 0.022;
  s.connect(f).connect(g).connect(ac.destination);
  s.start();
  murmuro = g;
}

function silenciar(mudo) {
  if (ac) ac[mudo ? 'suspend' : 'resume']();
}
