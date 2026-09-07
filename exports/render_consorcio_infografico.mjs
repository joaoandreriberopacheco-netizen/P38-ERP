#!/usr/bin/env node
/**
 * Render Consórcio Missionário CBA infographic to PNG and PDF via Playwright.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'consorcio_missionario_infografico.html');
const pngWorkspace = path.join(__dirname, 'consorcio_missionario_INFOGRAFICO.png');
const pngArtifacts = '/opt/cursor/artifacts/consorcio_missionario_INFOGRAFICO.png';
const pdfWorkspace = path.join(__dirname, 'consorcio_missionario_INFOGRAFICO.pdf');

async function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML not found:', htmlPath);
    process.exit(1);
  }

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1520 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // allow Google Fonts to load

  const el = page.locator('#infographic');
  const box = await el.boundingBox();
  if (!box) throw new Error('Infographic element not found');

  await el.screenshot({ path: pngWorkspace, type: 'png' });
  fs.copyFileSync(pngWorkspace, pngArtifacts);

  await page.pdf({
    path: pdfWorkspace,
    width: '1080px',
    height: `${Math.ceil(box.height)}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  const stats = fs.statSync(pngWorkspace);
  console.log('PNG:', pngWorkspace, `(${Math.round(stats.size / 1024)} KB)`);
  console.log('PNG (artifacts):', pngArtifacts);
  console.log('PDF:', pdfWorkspace, `(${Math.round(fs.statSync(pdfWorkspace).size / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
