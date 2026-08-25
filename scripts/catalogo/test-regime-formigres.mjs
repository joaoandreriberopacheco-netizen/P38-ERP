#!/usr/bin/env node
/**
 * Valida toggle de regime especial Suframa no catálogo Formigres.
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
  await page.waitForTimeout(400);

  const hasPanel = await page.locator('#regime-panel').count();
  if (!hasPanel) {
    console.error(JSON.stringify({ ok: false, reason: 'regime-panel missing' }, null, 2));
    process.exit(1);
  }

  const cases = [
    { destino: 'zfm', tributario: 'lucro_presumido', expected: 16.25 },
    { destino: 'zfm', tributario: 'lucro_real', expected: 16.25 },
    { destino: 'alc', tributario: 'lucro_presumido', expected: 16.25 },
    { destino: 'alc', tributario: 'lucro_real', expected: 7 },
    { destino: 'amoc', tributario: 'lucro_presumido', expected: 0 },
  ];

  const results = [];
  for (const c of cases) {
    await page.evaluate(({ destino, tributario }) => {
      localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({
        enabled: true,
        destino,
        tributario,
      }));
    }, c);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const probe = await page.evaluate(() => {
      const inp = document.getElementById('desconto-pct');
      const pill = document.getElementById('regime-aliquota-val');
      return {
        descontoInput: Number(inp?.value || 0),
        descontoDisabled: !!inp?.disabled,
        pillText: pill?.textContent || '',
        optionsVisible: !document.getElementById('regime-options')?.hidden,
      };
    });
    results.push({
      ...c,
      ...probe,
      ok: probe.descontoDisabled && Math.abs(probe.descontoInput - c.expected) < 0.01,
    });
  }

  await page.evaluate(() => {
    localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({ enabled: true, destino: 'amoc', tributario: 'lucro_presumido' }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const amocHintVisible = await page.locator('#regime-hint-amoc:not([hidden])').count();

  const ok = results.every((r) => r.ok) && amocHintVisible === 1;
  console.log(JSON.stringify({ ok, results, amocHintVisible }, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
