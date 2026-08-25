#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-tintao/index.html');

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, isMobile: viewport.width < 500 });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });
  const cod = await page.evaluate(() => CATALOGO.itens.find((i) => i.imagem_url)?.codigo_tintao);
  await page.evaluate((code) => {
    localStorage.setItem('tintao-pedido-qty-v1', JSON.stringify({ [String(code)]: 3 }));
  }, cod);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(async () => {
    const thumbs = loadPdfThumbs();
    const mounted = mountPedidoPdfRender(thumbs);
    if (!mounted) return { error: 'no mount' };
    const { host, wrap, pageWpx } = mounted;
    host.style.visibility = 'visible';
    host.style.left = '0';
    host.style.width = pageWpx + 'px';
    await waitPrintImagesRoot(wrap);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sheet = wrap.querySelector('.print-sheet') || wrap;
    const cs = getComputedStyle(host);
    return {
      pageWpx,
      hostVisibility: cs.visibility,
      hostLeft: cs.left,
      wrapScrollH: wrap.scrollHeight,
      sheetScrollH: sheet.scrollHeight,
      sheetTextLen: (sheet.textContent || '').trim().length,
      imgCount: sheet.querySelectorAll('img').length,
      imgWithData: [...sheet.querySelectorAll('img')].filter((i) => i.src.startsWith('data:')).length,
    };
  });

  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  await page.click('#pdf-pedido-panel');
  await page.waitForSelector('#pedido-pdf-sheet.open', { timeout: 90000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#pedido-pdf-download'),
  ]);
  const out = `/tmp/tintao-pdf-${name}.pdf`;
  await download.saveAs(out);
  const buf = fs.readFileSync(out);
  await browser.close();
  return {
    name,
    viewport,
    metrics,
    pdfBytes: buf.length,
    pdfHasImages: buf.toString('latin1').includes('/Subtype /Image'),
    pdfHasText: buf.toString('latin1').includes('Pedido Formigres'),
  };
}

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'narrow', width: 320, height: 568 },
];

const results = [];
for (const vp of viewports) {
  results.push(await runViewport(vp.name, { width: vp.width, height: vp.height }));
}
console.log(JSON.stringify(results, null, 2));
