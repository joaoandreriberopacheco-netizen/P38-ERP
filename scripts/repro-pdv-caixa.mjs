/**
 * Reproduz crash em /PDVCaixa — captura pageerror (ex.: ReferenceError, React #185).
 */
import { chromium } from 'playwright';

const BASE = process.env.P38_BASE_URL || 'http://localhost:3000';
const errors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  pageErrors.push(`[pageerror] ${err.message}`);
});

try {
  console.log(`A abrir ${BASE}/PDVCaixa ...`);
  await page.goto(`${BASE}/PDVCaixa`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText();
  const crashed =
    /Application error|client-side exception|Maximum update depth|before initialization/i.test(bodyText);

  console.log('Crash na UI:', crashed);
  console.log('Corpo:', bodyText.slice(0, 280).replace(/\n/g, ' | '));
} catch (e) {
  console.error('Script falhou:', e.message);
}

console.log('\n=== PAGE ERRORS ===');
for (const e of pageErrors) console.log(e);
console.log('\n=== CONSOLE ERRORS (top 10) ===');
for (const e of errors.slice(0, 10)) console.log(e);

await browser.close();
const bad =
  pageErrors.length > 0 ||
  errors.some((e) => /before initialization|Maximum update depth|#185/i.test(e));
process.exit(bad ? 1 : 0);
