#!/usr/bin/env node
/**
 * Valida PDF do catálogo PagLeve (fotos embutidas + páginas).
 * Uso: node scripts/catalogo/test-pdf-pagleve.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-pagleve/index.html');
const THUMBS = path.resolve(__dirname, '../../deploy/catalogo-pagleve/pdf-thumbs.json');
const OUT_PDF = '/opt/cursor/artifacts/pagleve-pedido-test.pdf';

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-pagleve');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const baseUrl = process.env.CATALOGO_PDF_TEST_URL || pathToFileURL(HTML).href;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.setItem('pagleve-catalog-tour-v2', 'done'); } catch { /* ignore */ }
  });

  const codes = await page.evaluate(() =>
    CATALOGO.itens.filter((i) => i.imagem_url).slice(0, 8).map((i) => i.codigo_tintao),
  );

  await page.evaluate((list) => {
    const qty = {};
    for (const code of list) qty[String(code)] = 2;
    localStorage.setItem('pagleve-catalog-qty-v1', JSON.stringify(qty));
  }, codes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const thumbsProbe = await page.evaluate(async () => {
    const rel = CFG && CFG.pdfThumbsUrl;
    if (!rel) return { hasUrl: false, count: 0 };
    const res = await fetch(rel);
    const data = res.ok ? await res.json() : {};
    const count = Object.values(data).filter((v) => String(v).startsWith('data:image/')).length;
    return { hasUrl: true, count };
  });

  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  await page.click('#pdf-pedido-panel');
  await page.waitForSelector('#pedido-pdf-sheet.open', { timeout: 120000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    page.click('#pdf-pedido-panel'),
  ]);
  await download.saveAs(OUT_PDF);

  const pdfBuf = fs.readFileSync(OUT_PDF);
  const pageMatches = pdfBuf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || [];
  const hasImages = pdfBuf.includes('/Subtype /Image') || pdfBuf.includes('/DCTDecode');
  const thumbsKb = fs.existsSync(THUMBS) ? Math.round(fs.statSync(THUMBS).size / 1024) : 0;

  const ok = thumbsProbe.count >= 50
    && pdfBuf.length > 80000
    && hasImages
    && pageMatches.length >= 1;

  console.log(JSON.stringify({
    ok,
    pdf: OUT_PDF,
    pdfBytes: pdfBuf.length,
    pdfPages: pageMatches.length,
    pdfHasImages: hasImages,
    thumbsProbe,
    thumbsKb,
    codesTestados: codes,
  }, null, 2));

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});