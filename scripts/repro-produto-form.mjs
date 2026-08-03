/**
 * Reproduz crash do formulário de produto — captura erros de console (headless).
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
  pageErrors.push(`[pageerror] ${err.message}\n${err.stack || ''}`);
});

try {
  console.log(`A abrir ${BASE}/Produtos ...`);
  await page.goto(`${BASE}/Produtos`, { waitUntil: 'networkidle', timeout: 60000 });

  const bodyText = await page.locator('body').innerText();
  console.log('Estado inicial:', bodyText.slice(0, 200).replace(/\n/g, ' | '));

  if (/login|A carregar|CONFIGURAÇÃO/i.test(bodyText)) {
    console.log('Bloqueado por auth/config — tentar botão novo produto se existir');
  }

  const novoBtn = page.getByRole('button', { name: /novo|adicionar|criar/i }).first();
  if (await novoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicando em Novo produto...');
    await novoBtn.click();
    await page.waitForTimeout(3000);
  } else {
    const fab = page.locator('[class*="fab"], button.fixed').first();
    if (await fab.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicando FAB...');
      await fab.click();
      await page.waitForTimeout(1000);
      const menuNovo = page.getByText(/novo produto/i).first();
      if (await menuNovo.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuNovo.click();
        await page.waitForTimeout(3000);
      }
    }
  }

  const afterText = await page.locator('body').innerText();
  if (/Application error|client-side exception/i.test(afterText)) {
    console.log('REPRODUZIDO: tela de erro Next.js');
  }

  const formVisible = await page.getByText(/Novo Produto|Editar:/i).isVisible().catch(() => false);
  console.log('Formulário visível:', formVisible);
  console.log('Corpo após ação:', afterText.slice(0, 300).replace(/\n/g, ' | '));
} catch (e) {
  console.error('Script falhou:', e.message);
}

console.log('\n=== PAGE ERRORS ===');
for (const e of pageErrors) console.log(e);
console.log('\n=== CONSOLE ERRORS ===');
for (const e of errors.slice(0, 20)) console.log(e);

await browser.close();
process.exit(pageErrors.length > 0 ? 1 : 0);
