// O service worker: é ele que faz a promessa do #semCarga — "depois de carregar uma vez, o
// jogo abre offline" — deixar de depender só do cache HTTP do navegador, que o sistema
// esvazia quando quer.
//
// GERADO por build.mjs a partir deste arquivo: o marcador logo abaixo vira um resumo do
// index.html publicado. Não edite `sw.js` na raiz — ele é artefato, como o index.html.
//
// O marcador aparece UMA vez neste arquivo, e o build exige que apareça uma só: escrevê-lo
// também aqui no comentário já custou um defeito, porque `String.replace` troca a PRIMEIRA
// ocorrência — o comentário ficou com o resumo e o `const` ficou com o marcador.
//
// POR QUE A VERSÃO É UM RESUMO DO BUNDLE, e não um número que alguém incrementa: cache de
// service worker que não troca de nome é o defeito mais cruel desta família — o jogador fica
// preso numa versão antiga para sempre, e nem limpar a aba resolve. Amarrando o nome ao
// conteúdo, publicar uma correção JÁ é publicar um cache novo. Esquecer de bumpar deixa de
// ser possível.
const VERSAO = '__VERSAO__';
const CACHE = `dominobar-${VERSAO}`;

// Os arquivos que são NOSSOS. O CSS e o JS não estão aqui porque não existem como arquivo:
// o build os embute no index.html, e é por isso que a lista é tão curta.
const DA_CASA = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png'];

// De onde vêm as duas bibliotecas. Elas NÃO são baixadas na instalação de propósito — são
// 763 KB, e baixá-las duas vezes (uma pela página, outra pelo worker) na primeira visita
// atrasaria justamente a visita que o jogador está esperando. O `fetch` abaixo as guarda de
// graça quando a própria página as pede, e o resultado final é o mesmo: depois de uma
// partida, o jogo abre sem internet.
const CDN = ['https://cdn.jsdelivr.net/', 'https://unpkg.com/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DA_CASA)).then(() => self.skipWaiting()));
});

// Cache velho é lixo que ocupa cota, e cota cheia faz `guardar()` falhar calado — que é
// exatamente o bug da cadeira errada, uma camada abaixo. Some tudo que não seja esta versão.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ns => Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

const nosso = url => url.startsWith(self.registration.scope) || CDN.some(c => url.startsWith(c));

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || !nosso(url)) return;

  // WebRTC e o broker do PeerJS NÃO passam por aqui (não são HTTP GET), e é bom que não
  // passem: o online não pode ser servido de cache nem por um instante.
  e.respondWith(caches.match(e.request).then(guardado => {
    // CACHE PRIMEIRO, e a razão é o bar: a rede que este jogo encontra é ruim, e uma
    // resposta guardada na hora vale mais que a versão de ontem chegando em cinco segundos.
    // A troca de versão vem do NOME do cache, não da idade da resposta.
    if (guardado) return guardado;
    return fetch(e.request).then(resp => {
      // `resp.ok` exclui o 404 e o 500; o `type` exclui resposta opaca, que não dá para
      // conferir e envenenaria o cache com um erro disfarçado de sucesso.
      if (resp.ok && (resp.type === 'basic' || resp.type === 'cors')) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return resp;
    // Offline e sem nada guardado: devolve o erro de rede de sempre. Quem explica isso ao
    // jogador é o #semCarga da página, que já existe e já sabe dizer a frase certa.
    }).catch(() => guardado || Response.error());
  }));
});
