#!/usr/bin/env node
/**
 * Valida PDF do catálogo Tintão: thumbs embutidos + geração end-to-end.
 * Uso: node scripts/catalogo/test-pdf-tintao.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../docs/imports-local/tintao/Catálogo B2B Tintão - Formigres.html');
const OUT_PDF = '/tmp/tintao-pedido-test.pdf';

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:html-tintao');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });

  const embedCheck = await page.evaluate(() => {
    const el = document.getElementById('pdf-thumbs-data');
    if (!el?.textContent) return { ok: false, reason: 'missing pdf-thumbs-data' };
    const thumbs = JSON.parse(el.textContent);
    const keys = Object.keys(thumbs);
    const dataUris = keys.filter((k) => String(thumbs[k]).startsWith('data:image/'));
    return { ok: dataUris.length > 0, thumbKeys: keys.length, dataUris: dataUris.length };
  });

  if (!embedCheck.ok) {
    console.error(JSON.stringify({ ok: false, embedCheck }, null, 2));
    process.exit(1);
  }

  const cod = await page.evaluate(() => {
    const item = CATALOGO.itens.find((i) => i.imagem_url || (i.imagens || [])[0]?.url);
    return item?.codigo_tintao || null;
  });

  await page.evaluate((code) => {
    localStorage.setItem('tintao-pedido-qty-v1', JSON.stringify({ [String(code)]: 2 }));
  }, cod);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  await page.click('#pdf-pedido-panel');
  await page.waitForSelector('#pedido-pdf-sheet.open', { timeout: 90000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#pedido-pdf-download'),
  ]);
  await download.saveAs(OUT_PDF);

  const pdfBuf = fs.readFileSync(OUT_PDF);
  const pdfText = pdfBuf.toString('latin1');
  const hasImages = pdfText.includes('/Subtype /Image') || pdfText.includes('/DCTDecode');
  const pdfBytes = pdfBuf.length;
  const ok = embedCheck.dataUris > 0 && pdfBytes > 10000 && hasImages;

  console.log(JSON.stringify({
    ok,
    pdf: OUT_PDF,
    pdfBytes,
    pdfHasImages: hasImages,
    codTestado: cod,
    embedCheck,
  }, null, 2));

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
