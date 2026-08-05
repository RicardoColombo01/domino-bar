// Gera `icone-192.png` e `icone-512.png` na raiz, a partir de `src/icone.svg`.
//
//   npm run icones
//
// POR QUE EXISTE UM PASSO PARA ISSO. O manifest do PWA e a Play Store exigem PNG em
// ARQUIVO, nos dois tamanhos — e este projeto não tinha um único binário versionado, porque
// madeira, pintas e sons são gerados em canvas e WebAudio na hora. Os dois PNG são a única
// exceção, e ela é imposta de fora.
//
// Como o PNG é gerado e commitado, ele é artefato — e artefato precisa de um caminho de
// volta à fonte, senão daqui a um ano ninguém sabe como refazer o ícone. A fonte é o SVG;
// este script é o caminho.
//
// MORA EM `tests/` porque é aqui que o puppeteer está instalado. Não é teste, e está dito.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAIZ = path.resolve(import.meta.dirname, '..');
const TAMANHOS = [192, 512];

const svg = fs.readFileSync(path.join(RAIZ, 'src', 'icone.svg'), 'utf8');

const nav = await puppeteer.launch({ executablePath: CHROME, headless: true });
const pag = await nav.newPage();

for (const n of TAMANHOS) {
  await pag.setViewport({ width: n, height: n, deviceScaleFactor: 1 });
  // `margin:0` e o SVG esticado ao viewport: sem isso o Chrome deixa a margem do body e o
  // ícone sai com uma borda branca que só aparece depois de instalado no celular.
  await pag.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${n}px;height:${n}px}</style>${svg}`,
    { waitUntil: 'load' });
  const arq = path.join(RAIZ, `icone-${n}.png`);
  await pag.screenshot({ path: arq, omitBackground: false });
  console.log(`icone-${n}.png — ${fs.statSync(arq).size} bytes`);
}

await nav.close();
