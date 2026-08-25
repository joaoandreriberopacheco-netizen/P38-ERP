#!/usr/bin/env node
/**
 * Valida regime especial Suframa + desconto comercial acumulado (incentivo sobre valor já descontado).
 * UI: campos do regime na dialog; painel compacto (toggle + resumo + lápis).
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

  const uiProbe = await page.evaluate(() => ({
    hasDialog: !!document.getElementById('regime-overlay'),
    hasEditBtn: !!document.getElementById('regime-edit-btn'),
    hasCompradorUf: !!document.getElementById('regime-comprador-uf'),
    hasInlineOptions: !!document.getElementById('regime-options'),
    hasSummary: !!document.getElementById('regime-summary'),
  }));

  const regimeCases = [
    { destino: 'zfm', tributario: 'lucro_presumido', compradorUf: 'AM', incentivo: 15.65 },
    { destino: 'alc', tributario: 'lucro_real', compradorUf: 'AM', incentivo: 7 },
    { destino: 'amoc', tributario: 'lucro_presumido', compradorUf: 'AM', incentivo: 0 },
  ];

  const results = [];
  for (const c of regimeCases) {
    await page.evaluate(({ destino, tributario, compradorUf }) => {
      localStorage.setItem('formigres-catalog-desconto-v1', '0');
      localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({
        enabled: true,
        destino,
        tributario,
        compradorUf,
      }));
    }, c);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const probe = await page.evaluate(() => {
      const inp = document.getElementById('desconto-pct');
      const pill = document.getElementById('regime-aliquota-val');
      const summary = document.getElementById('regime-summary');
      return {
        descontoInput: Number(inp?.value || 0),
        descontoDisabled: !!inp?.disabled,
        pillText: pill?.textContent || '',
        summaryText: summary?.textContent || '',
        summaryVisible: summary ? !summary.hidden : false,
        incentivoPct: typeof descontoIncentivoPct === 'function' ? descontoIncentivoPct() : null,
      };
    });
    results.push({
      ...c,
      ...probe,
      ok: !probe.descontoDisabled
        && probe.descontoInput === 0
        && probe.summaryVisible
        && probe.incentivoPct === c.incentivo,
    });
  }

  await page.evaluate(() => {
    localStorage.setItem('formigres-catalog-desconto-v1', '5');
    localStorage.setItem('formigres-regime-especial-v1', JSON.stringify({
      enabled: true,
      destino: 'zfm',
      tributario: 'lucro_presumido',
      compradorUf: 'AM',
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const compound = await page.evaluate(() => {
    const item = CATALOGO.itens.find((i) => Number(i.preco_m2) > 0);
    const base = Number(item?.preco_m2 || 0);
    const inp = document.getElementById('desconto-pct');
    return {
      base,
      comercial: Number(inp?.value || 0),
      acumuladoPct: typeof descontoAcumuladoPct === 'function' ? descontoAcumuladoPct() : null,
      cod: item?.codigo_tintao,
    };
  });

  const expectedAcum = acumuladoPct(5, 15.65);
  const expectedPrice = precoFinal(compound.base, 5, 15.65);

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

  const uiOk = uiProbe.hasDialog
    && uiProbe.hasEditBtn
    && uiProbe.hasCompradorUf
    && uiProbe.hasSummary
    && !uiProbe.hasInlineOptions;
  const acumOk = compound.comercial === 5
    && compound.acumuladoPct != null
    && Math.abs(compound.acumuladoPct - expectedAcum) < 0.02;
  const priceOk = priceProbe.precoEff != null && Math.abs(priceProbe.precoEff - expectedPrice) < 0.02;

  const ok = uiOk && results.every((r) => r.ok) && acumOk && priceOk;
  console.log(JSON.stringify({
    ok,
    uiProbe: { ...uiProbe, uiOk },
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
