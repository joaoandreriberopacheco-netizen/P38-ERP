#!/usr/bin/env node
/**
 * Valida badge de gêmeas (mesmo modelo em várias marcas) no catálogo Formigres.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-formigres/index.html');

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-formigres');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const stats = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('.model-gemeas-badge')];
    const fenix = [...document.querySelectorAll('.model-row')].find((row) =>
      row.textContent?.includes('FENIX HD') && row.textContent?.includes('20X60')
    );
    return {
      badgeCount: badges.length,
      sampleBadge: badges[0]?.textContent?.trim() || null,
      fenixFound: !!fenix,
      fenixBadge: fenix?.querySelector('.model-gemeas-badge')?.textContent?.trim() || null,
    };
  });

  if (!stats.badgeCount) {
    console.error('FAIL: nenhum badge .model-gemeas-badge encontrado');
    process.exit(1);
  }

  const fenixRow = page.locator('.model-row', { hasText: 'FENIX HD' }).first();
  const fenixBadge = fenixRow.locator('.model-gemeas-badge');
  const badgeVisible = await fenixBadge.count();
  if (!badgeVisible) {
    console.error('FAIL: FENIX HD sem badge de gêmeas');
    process.exit(1);
  }

  const badgeText = (await fenixBadge.textContent())?.trim();
  await fenixBadge.click();
  await page.waitForTimeout(200);

  const panel = page.locator('#gemeas-panel-' + (await fenixRow.getAttribute('data-cod')));
  const panelVisible = await panel.evaluate((el) => el && !el.classList.contains('hidden'));
  const brandRows = panelVisible ? await panel.locator('tbody tr').count() : 0;

  await browser.close();

  const ok = badgeText === '4' && panelVisible && brandRows === 4;
  console.log(JSON.stringify({ ok, badgeCount: stats.badgeCount, badgeText, panelVisible, brandRows }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
