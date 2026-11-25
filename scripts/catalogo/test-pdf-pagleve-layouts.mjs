#!/usr/bin/env node
/**
 * Valida PDF PagLeve nos modos A4 (desktop) e Celular.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-pagleve/index.html');
const OUT_DIR = '/opt/cursor/artifacts';

function sampleCodes() {
  const html = fs.readFileSync(HTML, 'utf8');
  const a = html.indexOf('<script id="catalogo-data"');
  const jsonStart = html.indexOf('>', a) + 1;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  const data = JSON.parse(html.slice(jsonStart, jsonEnd));
  return data.itens.filter((i) => i.imagem_url).slice(0, 12).map((i) => String(i.codigo_tintao));
}

function pdfPageSize(pdfPath) {
  const data = fs.readFileSync(pdfPath).toString('latin1');
  const m = data.match(/\/MediaBox\s*\[([^\]]+)\]/);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/).map(Number);
  return { w: parts[2], h: parts[3] };
}

async function genPdf(page, layout, codes) {
  await page.setViewportSize(layout === 'a4' ? { width: 1280, height: 900 } : { width: 390, height: 844 });
  await page.evaluate((mode) => localStorage.setItem('pagleve-catalog-pdf-layout-v1', mode), layout);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 120000 });
  await page.evaluate((list) => {
    const qty = {};
    for (const c of list) qty[c] = 2;
    localStorage.setItem('pagleve-catalog-qty-v1', JSON.stringify(qty));
    localStorage.setItem('pagleve-catalog-tour-v2', 'done');
  }, codes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 120000 });
  await page.waitForSelector('#cart-fab.has-items', { timeout: 120000 });
  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  const pressed = await page.evaluate(() =>
    document.querySelector('[data-pdf-layout="a4"]')?.getAttribute('aria-pressed'),
  );
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#pdf-pedido-panel'),
  ]);
  const out = path.join(OUT_DIR, `pagleve-pdf-${layout}-test.pdf`);
  await download.saveAs(out);
  const buf = fs.readFileSync(out);
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { out, bytes: buf.length, pages, box: pdfPageSize(out), layoutUiA4: pressed };
}

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('Gere o HTML: node scripts/catalogo/gerar-html-tintao-catalogo.mjs --modo pagleve');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const codes = sampleCodes();
  const baseUrl = process.env.CATALOGO_PDF_TEST_URL || pathToFileURL(HTML).href;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 120000 });

  const a4 = await genPdf(page, 'a4', codes);
  const mobile = await genPdf(page, 'mobile', codes);

  const ok = a4.bytes > 80000
    && mobile.bytes > 80000
    && a4.pages >= 2
    && mobile.pages >= 1
    && (a4.box?.w ?? 0) >= 200
    && (mobile.box?.w ?? 999) < 120;

  console.log(JSON.stringify({ ok, a4, mobile }, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});