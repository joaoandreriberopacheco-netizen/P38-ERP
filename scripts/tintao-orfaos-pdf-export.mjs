#!/usr/bin/env node
/**
 * PDF órfãos Tintão — layout estilo Cursor (fundo branco, linhas cinza finas).
 * Uso: node scripts/tintao-orfaos-pdf-export.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Base PDF 18/09 + ajuste 22/09 (PW8 embarcado, +1 Roble 7MW). Valores Comp. */
const GRUPOS = [
  {
    formato: '34x60',
    linhas: [
      { modelo: 'Azulejo Pt HD', quant: 1, precoUnit: 59.81, total: 59.81 },
      { modelo: 'Folha HD', quant: 1, precoUnit: 60.69, total: 60.69 },
      { modelo: 'Windsor BR', quant: 1, precoUnit: 63.53, total: 63.53 },
    ],
  },
  {
    formato: '45x45',
    linhas: [
      { modelo: 'Java Azul PEI 5', quant: 1, precoUnit: 48.46, total: 48.46 },
      { modelo: 'Java Verde PEI 5', quant: 1, precoUnit: 48.46, total: 48.46 },
      { modelo: 'Lapa PEI 3', quant: 1, precoUnit: 48.46, total: 48.46 },
      { modelo: 'Travertino CZ', quant: 10, precoUnit: 48.46, total: 484.60 },
    ],
  },
  {
    formato: '50x50',
    linhas: [
      { modelo: 'Naturale Bege PEI 3', quant: 1, precoUnit: 60.58, total: 60.58 },
      { modelo: 'Verona Cinza PEI 4', quant: 6, precoUnit: 60.58, total: 363.45 },
      { modelo: 'Naturale Marrom PEI 3', quant: 1, precoUnit: 60.58, total: 60.58 },
      { modelo: 'Allegro HD50 PEI 3', quant: 2, precoUnit: 60.58, total: 121.15 },
      { modelo: 'Bianco 50', quant: 1, precoUnit: 60.58, total: 60.58 },
      { modelo: 'Bilbao PEI 3', quant: 3, precoUnit: 60.58, total: 181.73 },
      { modelo: 'Castano PEI 3', quant: 2, precoUnit: 60.58, total: 121.15 },
      { modelo: 'Selva PEI 3', quant: 2, precoUnit: 60.58, total: 121.15 },
      { modelo: 'Sem Artico HD PEI 5', quant: 1, precoUnit: 60.58, total: 60.58 },
    ],
  },
  {
    formato: '60x120',
    linhas: [
      { modelo: 'Gran Polar RT Pol', quant: 1, precoUnit: 118.43, total: 118.43 },
      { modelo: 'Bella Gold RT Pol', quant: 1, precoUnit: 109.25, total: 109.25 },
      { modelo: 'Pompei Pol', quant: 4, precoUnit: 107.42, total: 429.67 },
    ],
  },
  {
    formato: '66x66',
    linhas: [
      { modelo: 'Roble Retif Polido', quant: 1, precoUnit: 93.59, total: 93.59 },
    ],
  },
];

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function subtotais(grupo) {
  const quant = grupo.linhas.reduce((s, l) => s + l.quant, 0);
  const total = grupo.linhas.reduce((s, l) => s + l.total, 0);
  return { quant, total };
}

function buildHtml() {
  const geralQuant = GRUPOS.reduce((s, g) => s + subtotais(g).quant, 0);
  const geralTotal = GRUPOS.reduce((s, g) => s + subtotais(g).total, 0);
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' });

  const blocos = GRUPOS.map((grupo) => {
    const sub = subtotais(grupo);
    const rows = grupo.linhas.map((l) => `
      <tr>
        <td class="col-modelo">${l.modelo}</td>
        <td class="col-num">${l.quant}</td>
        <td class="col-num">${brl(l.precoUnit)}</td>
        <td class="col-num">${brl(l.total)}</td>
      </tr>`).join('');

    return `
    <section class="grupo">
      <h2 class="formato">${grupo.formato}</h2>
      <table>
        <thead>
          <tr>
            <th class="col-modelo">Modelo</th>
            <th class="col-num">Quant</th>
            <th class="col-num">Preço unit</th>
            <th class="col-num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="subtotal">
            <td class="col-modelo">Subtotal ${grupo.formato}</td>
            <td class="col-num">${sub.quant}</td>
            <td class="col-num"></td>
            <td class="col-num">${brl(sub.total)}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Órfãos Tintão — ${geradoEm}</title>
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
    .header { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #e8e8e8; }
    .header h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 6px; }
    .header .meta { font-size: 12px; color: #666; }
    .header .resumo { margin-top: 10px; font-size: 13px; color: #333; }
    .grupo { margin-bottom: 26px; }
    .formato {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 8px;
      color: #111;
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      font-size: 12px;
      font-weight: 600;
      color: #111;
      text-align: left;
      padding: 6px 0 8px;
      border-bottom: 1px solid #d9d9d9;
    }
    tbody td {
      padding: 7px 0;
      border-bottom: 1px solid #efefef;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    .col-modelo { width: 46%; padding-right: 12px; }
    .col-num { width: 18%; text-align: right; white-space: nowrap; }
    thead .col-num { text-align: right; }
    .subtotal td {
      font-weight: 600;
      border-top: 1px solid #d9d9d9;
      border-bottom: none;
      padding-top: 9px;
      padding-bottom: 4px;
    }
    .geral { margin-top: 8px; padding-top: 4px; }
    .geral h2 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .geral .subtotal td { border-top: 1px solid #bdbdbd; }
  </style>
</head>
<body>
  <div class="doc">
    <header class="header">
      <h1>Órfãos Tintão — itens residuais pós-recepção</h1>
      <p class="meta">Gerado em ${geradoEm} · Pedidos emissão &gt; 20/07/2026 · Ajuste 22/09 (PW8 embarcado, +1 Roble avariada)</p>
      <p class="resumo"><strong>${geralQuant} cx</strong> · <strong>${brl(geralTotal)}</strong></p>
    </header>
    ${blocos}
    <section class="grupo geral">
      <h2>Total geral</h2>
      <table>
        <thead>
          <tr>
            <th class="col-modelo"></th>
            <th class="col-num">Quant</th>
            <th class="col-num"></th>
            <th class="col-num">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr class="subtotal">
            <td class="col-modelo">Geral</td>
            <td class="col-num">${geralQuant} cx</td>
            <td class="col-num"></td>
            <td class="col-num">${brl(geralTotal)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
}

async function main() {
  const html = buildHtml();
  const htmlPath = path.join(__dirname, 'tintao-orfaos-residual.html');
  const pdfWorkspace = path.join(__dirname, 'tintao-orfaos-residual.pdf');
  const pdfArtifacts = '/opt/cursor/artifacts/tintao-orfaos-residual-20260922.pdf';

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

  const kb = Math.round(fs.statSync(pdfArtifacts).size / 1024);
  console.log(JSON.stringify({
    ok: true,
    pdf: pdfArtifacts,
    pdfWorkspace,
    html: htmlPath,
    kb,
    totalCx: GRUPOS.reduce((s, g) => s + subtotais(g).quant, 0),
    totalValor: GRUPOS.reduce((s, g) => s + subtotais(g).total, 0),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
