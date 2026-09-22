#!/usr/bin/env node
/**
 * Cotação PDF — estilo Cursor (mesmo layout tintao-orfaos-pdf-export.mjs)
 * Uso: node scripts/cotacao-miguel-pdf-export.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENTE = 'MIGUEL ALEJANDRO OSORIO';
const DATA_COTACAO = '22/09/2026';

const LINHAS = [
  {
    quantM2: 70.76,
    descricao: 'PORCELANATO 70×70 (2,44) DALLAS CEMENT TOUCH RÚSTICO ALTO TRÁFEGO USO XT DELTA',
    caixas: 29,
    valorUnitM2: 88.0,
  },
  {
    quantM2: 131.76,
    descricao: 'PORCELANATO 70×70 (2,44) DALLAS LIGHT GRAY POLIDO USO MT DELTA',
    caixas: 54,
    valorUnitM2: 106.0,
  },
];

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function numM2(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function buildHtml() {
  const linhas = LINHAS.map((l) => {
    const total = l.quantM2 * l.valorUnitM2;
    return { ...l, total };
  });
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  const totalCaixas = linhas.reduce((s, l) => s + l.caixas, 0);
  const totalM2 = linhas.reduce((s, l) => s + l.quantM2, 0);
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' });

  const rows = linhas.map((l) => `
      <tr>
        <td class="col-qty">${numM2(l.quantM2)}</td>
        <td class="col-desc">${l.descricao}</td>
        <td class="col-num">${l.caixas}</td>
        <td class="col-num">${brl(l.valorUnitM2)}</td>
        <td class="col-num">${brl(l.total)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Cotação — ${CLIENTE}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #111;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .doc { max-width: 680px; margin: 0 auto; padding: 8px 0 24px; }
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e8e8e8; }
    .header h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 6px; }
    .header .meta { font-size: 12px; color: #666; }
    .header .resumo { margin-top: 10px; font-size: 13px; color: #333; }
    .empresa { margin-bottom: 20px; font-size: 12px; color: #444; line-height: 1.5; }
    .empresa strong { color: #111; font-size: 13px; }
    .cliente { margin-bottom: 22px; }
    .cliente .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #666; margin-bottom: 4px; }
    .cliente .nome { font-size: 15px; font-weight: 600; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      font-size: 11px;
      font-weight: 600;
      color: #111;
      text-align: left;
      padding: 6px 0 8px;
      border-bottom: 1px solid #d9d9d9;
    }
    tbody td {
      padding: 8px 0;
      border-bottom: 1px solid #efefef;
      vertical-align: top;
    }
    .col-qty { width: 12%; text-align: right; white-space: nowrap; padding-right: 8px; }
    .col-desc { width: 40%; padding-right: 12px; }
    .col-num { width: 14%; text-align: right; white-space: nowrap; }
    thead .col-qty, thead .col-num { text-align: right; }
    .subtotal td {
      font-weight: 600;
      border-top: 1px solid #d9d9d9;
      border-bottom: none;
      padding-top: 10px;
    }
    .total td {
      font-weight: 600;
      font-size: 14px;
      border-top: 1px solid #bdbdbd;
      padding-top: 12px;
    }
    .obs { margin-top: 20px; font-size: 12px; color: #555; line-height: 1.55; }
    .obs strong { color: #333; }
  </style>
</head>
<body>
  <div class="doc">
    <header class="header">
      <h1>Cotação — porcelanato Dallas</h1>
      <p class="meta">Data ${DATA_COTACAO} · Gerado em ${geradoEm}</p>
      <p class="resumo"><strong>${numM2(totalM2)} M²</strong> · <strong>${totalCaixas} cx</strong> · <strong>${brl(totalGeral)}</strong></p>
    </header>

    <div class="empresa">
      <strong>Ausier E Mello Comer. de Mat. de Construç</strong><br />
      CNPJ 32.655.261/0001-36 · I.E. 041741153 · Fone (92) 3213-9657<br />
      Av. Max Teixeira, 819 — Col. Santo Antônio — Manaus, AM — CEP 69093-770
    </div>

    <div class="cliente">
      <div class="label">Cliente</div>
      <div class="nome">${CLIENTE}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-qty">Quant (M²)</th>
          <th class="col-desc">Descrição</th>
          <th class="col-num">Caixas</th>
          <th class="col-num">Valor unit. (M²)</th>
          <th class="col-num">Valor total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="subtotal">
          <td class="col-qty">${numM2(totalM2)}</td>
          <td class="col-desc">Subtotal</td>
          <td class="col-num">${totalCaixas}</td>
          <td class="col-num"></td>
          <td class="col-num">${brl(totalGeral)}</td>
        </tr>
        <tr class="subtotal">
          <td class="col-qty"></td>
          <td class="col-desc">Frete</td>
          <td class="col-num"></td>
          <td class="col-num">Incluso</td>
          <td class="col-num">—</td>
        </tr>
        <tr class="total">
          <td class="col-qty"></td>
          <td class="col-desc">Total</td>
          <td class="col-num"></td>
          <td class="col-num"></td>
          <td class="col-num">${brl(totalGeral)}</td>
        </tr>
      </tbody>
    </table>

    <p class="obs">
      <strong>Transporte incluso</strong> no valor total.<br />
      <strong>Adiantamento de 60%</strong> na confirmação do pedido; saldo conforme acordado.<br />
      <strong>Prazo de entrega:</strong> 06/10/2026.<br />
      Proposta válida por 03 dias (até 25/09/2026).
    </p>
  </div>
</body>
</html>`;
}

async function main() {
  const html = buildHtml();
  const slug = 'cotacao-miguel-alejandro-osorio';
  const htmlPath = path.join(__dirname, `${slug}.html`);
  const pdfWorkspace = path.join(__dirname, `${slug}.pdf`);
  const pdfArtifacts = `/opt/cursor/artifacts/${slug}-20260922.pdf`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  await page.pdf({
    path: pdfWorkspace,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
  });

  fs.copyFileSync(pdfWorkspace, pdfArtifacts);
  await browser.close();

  const total = LINHAS.reduce((s, l) => s + l.quantM2 * l.valorUnitM2, 0);
  console.log(JSON.stringify({
    ok: true,
    pdf: pdfArtifacts,
    html: htmlPath,
    cliente: CLIENTE,
    total: brl(total),
    kb: Math.round(fs.statSync(pdfArtifacts).size / 1024),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
