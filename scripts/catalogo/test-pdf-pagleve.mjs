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

function sampleCodesFromDeployHtml() {
  const html = fs.readFileSync(HTML, 'utf8');
  const start = html.indexOf('<script id="catalogo-data" type="application/json">');
  if (start < 0) return [];
  const jsonStart = html.indexOf('>', start) + 1;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  const data = JSON.parse(html.slice(jsonStart, jsonEnd));
  return data.itens.filter((i) => i.imagem_url).slice(0, 8).map((i) => String(i.codigo_tintao));
}

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-pagleve');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });

  const codes = sampleCodesFromDeployHtml();
  if (!codes.length) {
    console.error('Não foi possível extrair códigos do HTML gerado.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript((list) => {
    try {
      const qty = {};
      for (const code of list) qty[String(code)] = 2;
      localStorage.setItem('pagleve-catalog-qty-v1', JSON.stringify(qty));
      localStorage.setItem('pagleve-catalog-theme-v1', 'dark');
      localStorage.setItem('pagleve-catalog-tour-v2', 'done');
    } catch { /* ignore */ }
  }, codes);
  const page = await context.newPage({ viewport: { width: 1280, height: 900 } });
  const baseUrl = process.env.CATALOGO_PDF_TEST_URL || pathToFileURL(HTML).href;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 120000 });
  await page.waitForSelector('#cart-fab.has-items', { timeout: 120000 });
  const themeDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const thumbsProbe = await page.evaluate(async () => {
    const res = await fetch('pdf-thumbs.json', { cache: 'no-store' });
    const data = res.ok ? await res.json() : {};
    const count = Object.values(data).filter((v) => String(v).startsWith('data:image/')).length;
    return { ok: res.ok, count };
  });

  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    page.click('#pdf-pedido-panel'),
  ]);
  await page.waitForSelector('#pedido-pdf-sheet.open', { timeout: 120000 });
  await download.saveAs(OUT_PDF);

  const pdfBuf = fs.readFileSync(OUT_PDF);
  const pageMatches = pdfBuf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || [];
  const hasImages = pdfBuf.includes('/Subtype /Image') || pdfBuf.includes('/DCTDecode');
  const thumbsKb = fs.existsSync(THUMBS) ? Math.round(fs.statSync(THUMBS).size / 1024) : 0;

  let pdfLightness = null;
  try {
    const { execSync } = await import('node:child_process');
    const pngBase = '/opt/cursor/artifacts/pagleve-pedido-test-page';
    execSync(`pdftoppm -png -f 1 -l 1 -singlefile "${OUT_PDF}" "${pngBase}"`, { stdio: 'pipe' });
    const pngPath = `${pngBase}.png`;
    if (fs.existsSync(pngPath)) {
      const stat = await import('node:child_process').then(({ execFileSync }) => {
        const out = execFileSync('convert', [pngPath, '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' }).trim();
        return Number(out);
      });
      pdfLightness = Math.round(stat * 255);
    }
  } catch {
    pdfLightness = null;
  }

  const ok = thumbsProbe.count >= 50
    && pdfBuf.length > 80000
    && hasImages
    && pageMatches.length >= 1
    && themeDark
    && (pdfLightness == null || pdfLightness >= 200);

  console.log(JSON.stringify({
    ok,
    themeDark,
    pdfLightness,
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