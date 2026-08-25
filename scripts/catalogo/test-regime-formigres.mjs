#!/usr/bin/env node
/**
 * Valida regime especial Suframa + desconto comercial acumulado (incentivo sobre valor já descontado).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.resolve(__dirname, '../../deploy/catalogo-formigres/index.html');

function acumuladoPct(comercial, incentivo) {
  const c = comercial / 100;
  const i = incentivo / 100;
  return Math.round((1 - (1 - c) * (1 - i)) * 10000) / 100;
}

function precoFinal(base, comercial, incentivo) {
  let v = base;
  if (comercial) v *= 1 - comercial / 100;
  if (incentivo) v *= 1 - incentivo / 100;
  return Math.round(v * 100) / 100;
}

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-formigres');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });

  const regimeCases = [
    { destino: 'zfm', tributario: 'lucro_presumido', incentivo: 16.25 },
    { destino: 'alc', tributario: 'lucro_real', incentivo: 7 },
    { destino: 'amoc', tributario: 'lucro_presumido', incentivo: 0 },
  ];

  const results = [];
  for (const c of regimeCases) {
    await page.evaluate(({ destino, tributario }) => {
      localStorage.setItem('formigres-catalog-desconto-v1', '0');
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
      };
    });
    results.push({
      ...c,
      ...probe,
      ok: !probe.descontoDisabled && probe.descontoInput === 0,
    });
  }

  await page.evaluate(() => {
    localStorage.setItem('formigres-catalog-desconto-v1', '5');
    localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({
      enabled: true,
      destino: 'zfm',
      tributario: 'lucro_presumido',
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const compound = await page.evaluate(() => {
    const item = CATALOGO.itens.find((i) => Number(i.preco_m2) > 0);
    const base = Number(item?.preco_m2 || 0);
    const inp = document.getElementById('desconto-pct');
    const acumEl = document.getElementById('regime-acumulado-val');
    const acumNote = document.getElementById('regime-acumulado-note');
    return {
      base,
      comercial: Number(inp?.value || 0),
      acumuladoText: acumEl?.textContent || '',
      acumNoteVisible: acumNote ? !acumNote.hidden : false,
      cod: item?.codigo_tintao,
    };
  });

  const expectedAcum = acumuladoPct(5, 16.25);
  const expectedPrice = precoFinal(compound.base, 5, 16.25);

  await page.evaluate((code) => {
    localStorage.setItem('formigres-catalog-qty-v1', JSON.stringify({ [String(code)]: 1 }));
  }, compound.cod);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const priceProbe = await page.evaluate(({ code, expectedPrice }) => {
    const row = document.querySelector('.model-row[data-cod="' + code + '"]');
    const subCell = row?.querySelector('.model-col-sub');
    const precoDesc = row?.querySelector('.preco-desc');
    const subText = subCell?.textContent || '';
    const effText = precoDesc?.textContent || '';
    const parseMoney = (s) => {
      const m = String(s).match(/[\d.,]+/);
      if (!m) return null;
      return Number(m[0].replace(/\./g, '').replace(',', '.'));
    };
    return {
      subtotal: parseMoney(subText),
      precoEff: parseMoney(effText),
      expectedPrice,
    };
  }, { code: compound.cod, expectedPrice });

  const acumOk = compound.acumNoteVisible
    && compound.comercial === 5
    && compound.acumuladoText.includes('20,44');
  const priceOk = priceProbe.precoEff != null && Math.abs(priceProbe.precoEff - expectedPrice) < 0.02;

  const ok = results.every((r) => r.ok) && acumOk && priceOk;
  console.log(JSON.stringify({
    ok,
    regimeCases: results,
    compound: { ...compound, expectedAcum, expectedPrice, acumOk, priceOk, priceProbe },
  }, null, 2));

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
