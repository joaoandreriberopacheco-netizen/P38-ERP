#!/usr/bin/env node
/**
 * Valida PDF do catálogo Formigres: tabela desktop A4 + linhas entre produtos.
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
    }));
  }, codes);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const layoutProbe = await page.evaluate(() => {
    const src = [...document.scripts].map((s) => s.textContent || '').join('\n');
    const m = src.match(/contentWpx = Math\.round\(contentWmm \* 96 \/ 25\.4\)/);
    const rowLine = src.includes("const rowLine = '#707070'");
    const tablePdf = src.includes('print-pedido-table pedido-table');
    const printCard = src.includes('print-pedido-item');
    const printFormatGroup = src.includes('print-format-group');
    const printGemeas = src.includes('print-pedido-item-ref-gemeas');
    const a4 = src.includes("format: 'a4'");
    const scale3 = src.includes('PDF_CANVAS_SCALE = 3');
    const printThumb72 = src.includes('PDF_PRINT_THUMB_PX = 72');
    const precoStack = src.includes('preco-stack-pdf');
    return { hasA4: a4, hasRowLine: rowLine, hasTablePdf: tablePdf, printCard, printFormatGroup, printGemeas, hasLayoutFn: !!m, scale3, printThumb72, precoStack };
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
  const ok = layoutProbe.hasA4
    && layoutProbe.hasRowLine
    && layoutProbe.printCard
    && layoutProbe.printFormatGroup
    && layoutProbe.printGemeas
    && layoutProbe.hasLayoutFn
    && layoutProbe.scale3
    && layoutProbe.printThumb72
    && layoutProbe.precoStack
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
