#!/usr/bin/env node
/**
 * Valida PDF do catálogo Formigres: layout mobile em retrato (cards).
 * Uso: node scripts/catalogo/test-pdf-formigres.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-formigres/index.html');
const OUT_PDF = '/opt/cursor/artifacts/formigres-pedido-test.pdf';

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-formigres');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });

  const codes = await page.evaluate(() => {
    const pick = (n) => CATALOGO.itens.slice(0, n).map((i) => i.codigo_tintao).filter(Boolean);
    return pick(6);
  });

  await page.evaluate((list) => {
    const qty = {};
    for (const code of list) qty[String(code)] = 2;
    localStorage.setItem('formigres-catalog-qty-v1', JSON.stringify(qty));
    localStorage.setItem('formigres-catalog-desconto-v1', '5');
    localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({
      enabled: true,
      destino: 'zfm',
      tributario: 'lucro_presumido',
      compradorUf: 'AM',
    }));
  }, codes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const layoutProbe = await page.evaluate(() => {
    const src = [...document.scripts].map((s) => s.textContent || '').join('\n');
    const portraitWidth = src.includes('const PDF_PAGE_WIDTH_PX = 390');
    const cardPdf = src.includes('pedido-card-pdf');
    const printCards = src.includes('<div class="print-cards">');
    const portrait = src.includes("orientation: 'portrait'");
    const dynamicPage = src.includes('format: [pageWmm, pageHmm]');
    const scale2 = src.includes('const PDF_CANVAS_SCALE = 2');
    const printFooter = src.includes('print-footer');
    const fmtResumo = src.includes('print-fmt-resumo-table');
    return {
      portraitWidth,
      cardPdf,
      printCards,
      portrait,
      dynamicPage,
      scale2,
      printFooter,
      fmtResumo,
    };
  });

  await page.click('#cart-fab');
  await page.waitForSelector('#pedido-overlay.open');
  await page.click('#pdf-pedido-panel');
  await page.waitForSelector('#pedido-pdf-sheet.open', { timeout: 120000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('#pedido-pdf-download'),
  ]);
  await download.saveAs(OUT_PDF);

  const pdfBuf = fs.readFileSync(OUT_PDF);
  const pdfText = pdfBuf.toString('latin1');
  const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g) || [];
  const hasImages = pdfText.includes('/Subtype /Image') || pdfText.includes('/DCTDecode');
  const ok = layoutProbe.portraitWidth
    && layoutProbe.cardPdf
    && layoutProbe.printCards
    && layoutProbe.portrait
    && layoutProbe.dynamicPage
    && layoutProbe.scale2
    && layoutProbe.printFooter
    && layoutProbe.fmtResumo
    && pdfBuf.length > 20000
    && hasImages
    && pageMatches.length >= 1;

  console.log(JSON.stringify({
    ok,
    pdf: OUT_PDF,
    pdfBytes: pdfBuf.length,
    pdfPages: pageMatches.length,
    pdfHasImages: hasImages,
    codesTestados: codes,
    layoutProbe,
  }, null, 2));

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
