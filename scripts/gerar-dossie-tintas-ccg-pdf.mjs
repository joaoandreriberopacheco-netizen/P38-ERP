#!/usr/bin/env node
/**
 * Dossiê PDF — tintas CCG (Iquine, Hidracor, Hipercor)
 * Estilo escuro, linhas finas, fonte Inter (próxima ao Cursor).
 *
 * Uso: node scripts/gerar-dossie-tintas-ccg-pdf.mjs [--out=path.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'docs/exports/ccg-tintas-dossie-data.json');
const DEFAULT_OUT = path.join(ROOT, 'docs/exports/ccg-dossie-tintas-iquine-hidracor-hipercor.pdf');

function parseOutArg(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  return hit ? hit.slice('--out='.length) : DEFAULT_OUT;
}

function brl(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function priceRange(range) {
  if (!range) return '—';
  if (range.min === range.max) return brl(range.min);
  return `${brl(range.min)} – ${brl(range.max)}`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normaliza nomes longos de SKU (ex. TINTA ECONOMICA …) para cor legível no resumo. */
function cleanSharedColorName(name) {
  const u = String(name ?? '').toUpperCase();
  if (!u || u.startsWith('TINTA ECONOMICA') || u.startsWith('TINTA ECONÔMICA')) {
    if (u.includes('AZUL PAVAO') || u.includes('AZUL PAVÃO')) return 'Azul pavão';
    if (u.includes('PALHA')) return 'Palha';
    if (u.includes('PEROLA') || u.includes('PÉROLA')) return 'Pérola';
    if (u.includes('AMAZONAS')) return 'Verde Amazonas';
    if (u.includes('PRIMAVERA')) return 'Verde Primavera';
    if (u.includes('BRANCO NEVE')) return 'Branco neve';
    if (u.includes('BRANCO GELO')) return 'Branco gelo';
    return null;
  }
  return String(name);
}

function sharedColorsList(entry) {
  const raw = (entry.shared_colors_clean?.length ? entry.shared_colors_clean : entry.shared_colors) || [];
  const cleaned = [...new Set(raw.map(cleanSharedColorName).filter(Boolean))];
  return cleaned;
}

function brandMark(brand, active) {
  if (!active) return '<span class="mark off">—</span>';
  const cls = brand.toLowerCase();
  return `<span class="mark on ${cls}">●</span>`;
}

function formatsToCells(formats) {
  const byAp = { GL: [], LT: [], BD: [], Fr: [], Out: [] };
  for (const f of formats) {
    const bucket = byAp[f.ap] ?? byAp.Out;
    bucket.push(`${f.vol ? `${f.vol} ` : ''}${brl(f.price)}`);
  }
  const gl = byAp.GL.length ? byAp.GL.join('<br>') : '—';
  const lt = byAp.LT.length ? byAp.LT.join('<br>') : '—';
  const bd = byAp.BD.length ? byAp.BD.join('<br>') : '—';
  const extra = [...byAp.Fr, ...byAp.Out];
  const fr = extra.length ? extra.join('<br>') : '';
  return { gl, lt, bd, fr };
}

function renderOverlapSection(overlap) {
  const rows = overlap.lines
    .filter((l) => l.brands?.length)
    .map((l) => {
      const shared = sharedColorsList(l);
      const sharedText = shared.length
        ? `${shared.length} cor(es): ${shared.slice(0, 10).join(', ')}${shared.length > 10 ? '…' : ''}`
        : '—';
      return `<tr>
        <td>${esc(l.line)}</td>
        <td class="c">${brandMark('Iquine', l.iquine)}</td>
        <td class="c">${brandMark('Hidracor', l.hidracor)}</td>
        <td class="c">${brandMark('Hipercor', l.hipercor)}</td>
        <td class="c">${l.colors_i || '—'}</td>
        <td class="c">${l.colors_h || '—'}</td>
        <td class="c">${l.colors_p || '—'}</td>
        <td class="shared">${esc(sharedText)}</td>
      </tr>`;
    })
    .join('\n');

  const stats = overlap.stats;
  return `
    <section class="block">
      <h2>1. Superposição entre marcas</h2>
      <p class="lede">Linhas de produto presentes na tabela CCG (15/09/2026). ● = marca tem SKUs na linha.</p>
      <div class="stats">
        <div class="stat"><span class="n">${stats.lines_all_three}</span><span class="l">linhas nas 3 marcas</span></div>
        <div class="stat"><span class="n">${stats.lines_two}</span><span class="l">linhas em 2 marcas</span></div>
        <div class="stat"><span class="n">${stats.lines_exclusive.Iquine}</span><span class="l">exclusivas Iquine</span></div>
        <div class="stat"><span class="n">${stats.lines_exclusive.Hidracor}</span><span class="l">exclusivas Hidracor</span></div>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th>Linha</th>
            <th>Iquine</th>
            <th>Hidracor</th>
            <th>Hipercor</th>
            <th>Cores I</th>
            <th>Cores H</th>
            <th>Cores P</th>
            <th>Cores em comum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Preços = tabela CCG (preço distribuidor). Foco: planeamento de abastecimento (lotes 8–16 GL).</p>
    </section>`;
}

function renderLineSummary(brandName, lines) {
  const rows = lines
    .map((l) => `<tr>
      <td>${esc(l.name)}</td>
      <td class="c">${l.colors}</td>
      <td class="c">${l.skus}</td>
      <td>${priceRange(l.price_gl)}</td>
      <td>${priceRange(l.price_lt)}</td>
      <td>${priceRange(l.price_bd)}</td>
    </tr>`)
    .join('\n');

  return `
    <h3>Resumo das linhas — ${esc(brandName)}</h3>
    <table class="tbl compact">
      <thead>
        <tr><th>Linha</th><th>Cores</th><th>SKUs</th><th>GL (3–3,6 L)</th><th>LT (0,75–0,9 L)</th><th>BD (15–22 L / kg)</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderUnfold(brandName, lines) {
  return lines
    .map((line, idx) => {
      const colorRows = line.colors_detail
        .map((c) => {
          const { gl, lt, bd, fr } = formatsToCells(c.formats);
          const extra = fr ? `<br><span class="muted">${fr}</span>` : '';
          return `<tr>
            <td>${esc(c.color)}</td>
            <td>${gl}${extra}</td>
            <td>${lt}</td>
            <td>${bd}</td>
          </tr>`;
        })
        .join('\n');

      const glR = priceRange(line.price_gl);
      const ltR = priceRange(line.price_lt);
      return `
        <div class="line-block">
          <h4>${idx + 1}. ${esc(line.name)} — ${line.colors} cores · ${line.skus} SKUs</h4>
          <p class="faixa">Faixa GL: ${glR} · LT: ${ltR}${line.price_bd ? ` · BD: ${priceRange(line.price_bd)}` : ''}</p>
          <table class="tbl unfold">
            <thead><tr><th>Cor</th><th>GL (3–3,6 L)</th><th>LT (0,75–0,9 L)</th><th>BD / kg</th></tr></thead>
            <tbody>${colorRows}</tbody>
          </table>
        </div>`;
    })
    .join('\n');
}

function renderBrandSection(brandName, brandInfo, sectionNum) {
  const lines = brandInfo.lines_data || [];
  return `
    <section class="block brand-section page-break-before">
      <h2>${sectionNum}. ${esc(brandName)}</h2>
      <p class="lede">${brandInfo.skus} SKUs · ${brandInfo.lines} linhas de produto na CCG</p>
      ${renderLineSummary(brandName, lines)}
      <h3 class="unfold-title">Unfold por linha e cor</h3>
      ${renderUnfold(brandName, lines)}
    </section>`;
}

function buildHtml(data) {
  const brands = ['Iquine', 'Hidracor', 'Hipercor'];
  const brandSections = brands
    .map((b, i) => renderBrandSection(b, data.brands[b], i + 2))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Dossiê Tintas CCG — Iquine · Hidracor · Hipercor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #ffffff;
      --fg: #18181b;
      --muted: #71717a;
      --line: #d4d4d8;
      --line-fine: #e4e4e7;
      --accent: #2563eb;
      --iquine: #b45309;
      --hidracor: #047857;
      --hipercor: #6d28d9;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 40px 48px;
      background: var(--bg);
      color: var(--fg);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.02em; }
    h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; padding-top: 4px; border-top: 1px solid var(--line); }
    h3 { font-size: 13px; font-weight: 600; margin: 20px 0 10px; color: var(--fg); }
    h4 { font-size: 12px; font-weight: 600; margin: 0 0 6px; }
    .cover { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
    .meta { color: var(--muted); font-size: 10px; }
    .lede { color: var(--muted); margin: 0 0 14px; max-width: 72ch; }
    .note { color: var(--muted); font-size: 9.5px; margin-top: 12px; }
    .block { margin-bottom: 28px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat { border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; min-width: 110px; }
    .stat .n { display: block; font-size: 18px; font-weight: 600; }
    .stat .l { color: var(--muted); font-size: 9px; }
    table.tbl { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
    table.tbl th, table.tbl td {
      border: 1px solid var(--line-fine);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    table.tbl th {
      font-weight: 500;
      color: var(--muted);
      font-size: 9.5px;
      background: #f4f4f5;
    }
    table.tbl td.c, table.tbl th:nth-child(n+2):not(:last-child) { text-align: center; }
    table.tbl.compact td, table.tbl.compact th { padding: 5px 7px; }
    table.tbl.unfold td:first-child { font-weight: 500; white-space: nowrap; }
    .shared { font-size: 9.5px; color: var(--muted); }
    .mark { font-size: 10px; }
    .mark.on { color: var(--accent); }
    .mark.on.iquine { color: var(--iquine); }
    .mark.on.hidracor { color: var(--hidracor); }
    .mark.on.hipercor { color: var(--hipercor); }
    .mark.off { color: #d4d4d8; }
    .line-block { margin: 18px 0 22px; page-break-inside: avoid; }
    .faixa { color: var(--muted); font-size: 9.5px; margin: 0 0 8px; }
    .unfold-title { margin-top: 24px; }
    .muted { color: var(--muted); font-size: 9px; }
    .page-break-before { page-break-before: always; }
    .brand-section h2 { border-top: none; padding-top: 0; }
  </style>
</head>
<body>
  <header class="cover">
    <h1>Dossiê Tintas CCG</h1>
    <p class="meta">Iquine · Hidracor · Hipercor — ${esc(data.source)} — ${esc(data.generated)}</p>
    <p class="lede">Comparativo de linhas, cores e preços para abastecimento P-38. Apresentações: GL = galão · LT = lata · BD = balde.</p>
  </header>
  ${renderOverlapSection(data.overlap)}
  ${brandSections}
</body>
</html>`;
}

async function main() {
  const outPath = parseOutArg(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const html = buildHtml(data);
  const htmlPath = outPath.replace(/\.pdf$/i, '.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
  });
  await browser.close();

  const stat = fs.statSync(outPath);
  console.log(JSON.stringify({
    ok: true,
    pdf: outPath,
    html: htmlPath,
    bytes: stat.size,
    pages_estimate: 'multi',
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
