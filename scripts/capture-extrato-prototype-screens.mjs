#!/usr/bin/env node
/**
 * PNGs do protótipo HTML estático (fluxo-caixa-extrato-prototype.html).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'docs/prototypes/fluxo-caixa-extrato-prototype.html');
const OUT = path.join(ROOT, 'docs/prototypes');
const FILE_URL = `file://${HTML}`;

const SHOTS = [
  { file: 'fluxo-caixa-extrato-prototype-light-top.png', view: 'light', scroll: 0 },
  { file: 'fluxo-caixa-extrato-prototype-light-collapsed.png', view: 'light', scroll: 320 },
  { file: 'fluxo-caixa-extrato-prototype-light.png', view: 'light', scroll: 0, fullPhone: false },
  { file: 'fluxo-caixa-extrato-prototype-light-fab-open.png', view: 'light', scroll: 0, fab: true },
  { file: 'fluxo-caixa-extrato-prototype-dark-top.png', view: 'dark', scroll: 0 },
  { file: 'fluxo-caixa-extrato-prototype-dark-scrolled.png', view: 'dark', scroll: 320 },
  { file: 'fluxo-caixa-extrato-prototype-dark.png', view: 'dark', scroll: 0 },
  { file: 'fluxo-caixa-extrato-prototype-dark-fab-open.png', view: 'dark', scroll: 0, fab: true },
];

async function setView(page, mode) {
  const id = mode === 'light' ? 'view-light' : 'view-dark';
  await page.locator(`#${id}`).click();
  await page.waitForTimeout(300);
}

async function phoneLocator(page, mode) {
  const sel = mode === 'light' ? '#phone-light' : '#phone-dark';
  return page.locator(sel);
}

async function main() {
  if (!fs.existsSync(HTML)) throw new Error(`Missing ${HTML}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'pt-BR' });
  const page = await context.newPage();
  await page.goto(FILE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  for (const shot of SHOTS) {
    await setView(page, shot.view);
    const phone = await phoneLocator(page, shot.view);
    await phone.waitFor({ state: 'visible' });

    const scrollId = shot.view === 'light' ? '#scroll-light' : '#scroll-dark';
    await page.evaluate(
      ({ sel, top }) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollTop = top;
          el.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
      },
      { sel: scrollId, top: shot.scroll || 0 },
    );
    await page.waitForTimeout(shot.scroll > 0 ? 500 : 200);

    if (shot.fab) {
      const fab = phone.locator('[data-fab] .fab-main').first();
      await fab.click();
      await page.waitForTimeout(400);
    }

    const outPath = path.join(OUT, shot.file);
    await phone.screenshot({ path: outPath, type: 'png' });
    console.log('[capture]', shot.file);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
