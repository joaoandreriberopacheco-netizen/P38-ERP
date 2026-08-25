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

async function waitForCatalogBoot(page) {
  await page.waitForFunction(() => window.__tintaoBootDone === 1 && document.querySelector('.acc-linha'));
}

async function main() {
  if (!fs.existsSync(HTML)) {
    console.error('HTML não encontrado. Rode: npm run catalogo:publicar-formigres');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'domcontentloaded' });
  await waitForCatalogBoot(page);

  const uiProbe = await page.evaluate(() => ({
    hasDialog: !!document.getElementById('regime-overlay'),
    hasEditBtn: !!document.getElementById('regime-edit-btn'),
    hasCompradorUf: !!document.getElementById('regime-comprador-uf'),
    hasInlineOptions: !!document.getElementById('regime-options'),
    hasSummary: !!document.getElementById('regime-summary'),
    compradorUfs: [...document.querySelectorAll('#regime-comprador-uf option')].map((o) => o.value),
  }));

  const regimeCases = [
    { destino: 'zfm', tributario: 'lucro_presumido', compradorUf: 'AM', incentivo: 16.25 },
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
    await waitForCatalogBoot(page);
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
  await waitForCatalogBoot(page);

  const compound = await page.evaluate(() => {
    const data = JSON.parse(document.getElementById('catalogo-data').textContent);
    const item = data.itens.find((i) => Number(i.preco_m2) > 0);
    const base = Number(item?.preco_m2 || 0);
    const inp = document.getElementById('desconto-pct');
    return {
      base,
      comercial: Number(inp?.value || 0),
      acumuladoPct: typeof descontoAcumuladoPct === 'function' ? descontoAcumuladoPct() : null,
      cod: item?.codigo_tintao,
    };
  });

  const expectedAcum = acumuladoPct(5, 16.25);
  const expectedPrice = precoFinal(compound.base, 5, 16.25);

  await page.evaluate((code) => {
    localStorage.setItem('formigres-catalog-qty-v1', JSON.stringify({ [String(code)]: 1 }));
  }, compound.cod);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForCatalogBoot(page);

  const priceProbe = await page.evaluate(({ code, expectedPrice }) => {
    const row = document.querySelector('.catalog-table-wrap .model-row[data-cod="' + code + '"]')
      || document.querySelector('.model-row[data-cod="' + code + '"]');
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
    && !uiProbe.hasInlineOptions
    && uiProbe.compradorUfs.length === 4
    && ['AM', 'RR', 'AP', 'AC'].every((uf) => uiProbe.compradorUfs.includes(uf));
  const acumOk = compound.comercial === 5
    && compound.acumuladoPct != null
    && Math.abs(compound.acumuladoPct - expectedAcum) < 0.02;
  const priceOk = priceProbe.precoEff != null && Math.abs(priceProbe.precoEff - expectedPrice) < 0.02;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForCatalogBoot(page);

  const mobileProbe = await page.evaluate(() => {
    const tableWrap = document.querySelector('.catalog-table-wrap');
    const cardsWrap = document.querySelector('.catalog-cards-wrap');
    const cards = document.querySelectorAll('.catalog-cards-wrap .catalog-card.model-row');
    const catalogo = document.getElementById('catalogo');
    const clearBtn = document.getElementById('clear-qty-main');
    const tableDisplay = tableWrap ? getComputedStyle(tableWrap).display : '';
    const cardsDisplay = cardsWrap ? getComputedStyle(cardsWrap).display : '';
    const overflowX = catalogo ? getComputedStyle(catalogo).overflowX : '';
    return {
      hasClearBtn: !!clearBtn,
      tableHidden: tableDisplay === 'none',
      cardsVisible: cardsDisplay !== 'none',
      cardCount: cards.length,
      overflowX,
      catalogScrollWidth: catalogo ? catalogo.scrollWidth : 0,
      catalogClientWidth: catalogo ? catalogo.clientWidth : 0,
    };
  });

  const mobileOk = mobileProbe.hasClearBtn
    && mobileProbe.tableHidden
    && mobileProbe.cardsVisible
    && mobileProbe.cardCount > 0
    && mobileProbe.catalogScrollWidth <= mobileProbe.catalogClientWidth + 2;

  let clearOk = false;
  if (compound.cod) {
    await page.evaluate((code) => {
      localStorage.setItem('formigres-catalog-qty-v1', JSON.stringify({ [String(code)]: 2 }));
    }, compound.cod);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForCatalogBoot(page);
    await page.click('#clear-qty-main');
    await page.waitForTimeout(200);
    clearOk = await page.evaluate(() => {
      const qty = localStorage.getItem('formigres-catalog-qty-v1');
      const parsed = qty ? JSON.parse(qty) : {};
      return Object.keys(parsed).length === 0;
    });
  }

  const ok = uiOk && results.every((r) => r.ok) && acumOk && priceOk && mobileOk && clearOk;
  console.log(JSON.stringify({
    ok,
    uiProbe: { ...uiProbe, uiOk },
    regimeCases: results,
    compound: { ...compound, expectedAcum, expectedPrice, acumOk, priceOk, priceProbe },
    mobileProbe: { ...mobileProbe, mobileOk },
    clearOk,
  }, null, 2));

  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
