#!/usr/bin/env node
/**
 * PDF 2 páginas — sazonalidade de vendas (6 meses, 3 partes iguais/mês, dias úteis seg–sáb).
 * Página 1: completo | Página 2: orgânico (sem dias outlier no valor diário).
 * node scripts/gerar-pdf-vendas-sazonalidade-6m.mjs
 */
import { mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38SupabaseAdminConfig } from './p38-supabase-admin.mjs';
import { PARTES_NO_MES, runVendasSazonalidadeAnalise } from './lib/vendas-sazonalidade-analise.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/exports');
const ARTIFACTS_DIR = '/opt/cursor/artifacts';

const PART_COLORS = ['#3b4d5c', '#2563eb', '#a4ce33'];
const PART_LABELS = {
  1: 'P1 início',
  2: 'P2 meio',
  3: 'P3 fim',
};
const PARTES_LIST = Array.from({ length: PARTES_NO_MES }, (_, i) => i + 1);

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctStr(p) {
  return `${Number(p || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stackedBarHtml(pctPartes, { compact = false } = {}) {
  const segs = PARTES_LIST
    .map((p) => {
      const w = Math.max(0, Number(pctPartes[p]) || 0);
      if (w <= 0) return '';
      const show = w >= 6 && !compact;
      return `<div class="seg" style="width:${w}%;background:${PART_COLORS[p - 1]}" title="${PART_LABELS[p]} ${pctStr(w)}">${show ? pctStr(w) : ''}</div>`;
    })
    .join('');
  return `<div class="stack-bar">${segs || '<span class="empty">—</span>'}</div>`;
}

function margemInline(m) {
  const mg = m?.margem;
  if (!mg?.margemContribuicaoPct && !mg?.markupPct) return '';
  return `<span class="margem-inline">m.c. ${pctStr(mg.margemContribuicaoPct)} · MK ${pctStr(mg.markupPct)}</span>`;
}

function margemCells(m) {
  const mg = m?.margem;
  if (!mg) {
    return '<td class="num muted">—</td><td class="num muted">—</td>';
  }
  return `<td class="num">${pctStr(mg.margemContribuicaoPct)}</td><td class="num">${pctStr(mg.markupPct)}</td>`;
}

function tableRowMes(m, getPct, getVal, getTotal) {
  const total = getTotal(m);
  const cells = PARTES_LIST.map((p) => {
    const pct = getPct(m, p);
    const val = getVal(m, p);
    return `<td class="num">${pctStr(pct)}<br><span class="sub">R$ ${brl(val)}</span></td>`;
  }).join('');
  const parcial = m.mesParcial ? ' *' : '';
  return `<tr>
    <td class="mes">${esc(m.label)}${parcial}</td>
    <td class="num">R$ ${brl(total)}</td>
    ${cells}
    ${margemCells(m)}
  </tr>`;
}

function htmlTabelaMeses(rows, bruto, margemMedia = null) {
  const body = rows
    .map((m) => {
      if (bruto) {
        return tableRowMes(
          m,
          (_, p) => m.pctPartes[p],
          (_, p) => m.partesValor[p],
          (x) => x.total,
        );
      }
      return tableRowMes(
        m,
        (_, p) => m.pctPartesOrganico[p],
        (_, p) => m.partesValorOrganico[p],
        () => m.totalSemOutliers,
      );
    })
    .join('');

  const footer =
    margemMedia ?
      `<tr class="totais">
        <td><strong>Média da janela</strong></td>
        <td colspan="4" class="muted">ponderada por receita</td>
        <td class="num"><strong>${pctStr(margemMedia.margemContribuicaoPct)}</strong></td>
        <td class="num"><strong>${pctStr(margemMedia.markupPct)}</strong></td>
      </tr>`
    : '';

  return `<table class="data">
    <thead>
      <tr>
        <th>Mês</th>
        <th>Total vendas</th>
        <th>P1</th><th>P2</th><th>P3</th>
        <th>m.c.</th>
        <th>Markup</th>
      </tr>
    </thead>
    <tbody>${body}${footer}</tbody>
  </table>`;
}

function htmlStackedBlock(rows, bruto) {
  return rows
    .map((m) => {
      const pct = bruto ? m.pctPartes : m.pctPartesOrganico;
      return `<div class="stack-row">
        <div class="stack-label">${esc(m.label)}${m.mesParcial ? ' *' : ''} ${margemInline(m)}</div>
        ${stackedBarHtml(pct)}
      </div>`;
    })
    .join('');
}

function htmlMediaGeral(padrao, tipo) {
  const rows = padrao[tipo];
  const bar = {};
  for (const r of rows) bar[r.parte] = r.pctMedio;
  return `<div class="media-geral">
    <div class="stack-label">Média ${tipo === 'bruto' ? 'completa' : 'orgânica'}</div>
    ${stackedBarHtml(bar)}
    <div class="media-chips">${rows.map((r) => `<span>P${r.parte} ${pctStr(r.pctMedio)}</span>`).join('')}</div>
  </div>`;
}

function htmlOutliers(list) {
  if (!list.length) return '<p class="note">Nenhum dia outlier no período.</p>';
  const rows = list
    .map(
      (o) =>
        `<tr><td>${esc(o.data)}</td><td class="num">R$ ${brl(o.valor)}</td><td class="num">R$ ${brl(o.mediaMes)}</td><td class="num">R$ ${brl(o.limite)}</td></tr>`,
    )
    .join('');
  return `<table class="data mini"><thead><tr><th>Dia removido</th><th>Valor</th><th>Média/dia (mês)</th><th>Limite Q3+1,5×IQR</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildHtml(report) {
  const gerado = new Date().toLocaleString('pt-BR', { timeZone: 'America/Rio_Branco' });
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Barlow, sans-serif; font-size: 9pt; color: #18181b; margin: 0; line-height: 1.35; }
    h1 { font-size: 14pt; margin: 0 0 4px; font-weight: 700; }
    h2 { font-size: 11pt; margin: 0 0 6px; font-weight: 700; color: #3f3f46; }
    .meta { color: #71717a; margin: 0 0 10px; font-size: 8.5pt; }
    .page { page-break-after: always; padding-bottom: 4px; }
    .page:last-child { page-break-after: auto; }
    .legend { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 12px; font-size: 8pt; }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .stack-row { margin-bottom: 7px; }
    .stack-label { font-size: 8pt; font-weight: 600; text-transform: capitalize; margin-bottom: 2px; }
    .stack-bar { display: flex; width: 100%; height: 18px; border-radius: 4px; overflow: hidden; background: #f4f4f5; border: 0.5px solid #e4e4e7; }
    .seg { display: flex; align-items: center; justify-content: center; font-size: 6.5pt; font-weight: 600; color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.35); min-width: 2px; }
    .media-geral { margin: 10px 0; padding: 8px; background: #fafafa; border-radius: 6px; border: 0.5px solid #e4e4e7; }
    .media-chips { margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; font-size: 8pt; color: #52525b; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8pt; }
    table.data th, table.data td { border: 0.35px solid #e4e4e7; padding: 4px 6px; text-align: left; vertical-align: top; }
    table.data th { background: #f4f4f5; font-weight: 600; }
    table.data td.num { text-align: right; font-variant-numeric: tabular-nums; }
    table.data td.mes { text-transform: capitalize; font-weight: 600; white-space: nowrap; }
    table.data .sub { color: #71717a; font-size: 7pt; }
    table.data tr.totais td { border-top: 1px solid #d4d4d8; background: #fafafa; }
    .margem-inline { font-weight: 400; color: #52525b; font-size: 7.5pt; margin-left: 6px; }
    td.muted { color: #a1a1aa; }
    table.mini { font-size: 7.5pt; margin-top: 8px; }
    .note { font-size: 8pt; color: #71717a; margin: 8px 0 0; }
    .foot { font-size: 7.5pt; color: #a1a1aa; margin-top: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .section-title { font-weight: 700; font-size: 9pt; margin: 12px 0 4px; color: #27272a; }
  </style>
</head>
<body>
  <section class="page">
    <h1>Sazonalidade de vendas — visão completa</h1>
    <p class="meta">Janela ${esc(report.janela)} · corte ${esc(report.dataCorte)} · ${PARTES_NO_MES} partes iguais no mês · ${esc(report.regras?.diasContados || 'segunda a sábado')}</p>
    <div class="legend">
      ${PARTES_LIST.map((p) => `<span><i class="dot" style="background:${PART_COLORS[p - 1]}"></i>${PART_LABELS[p]}</span>`).join('')}
    </div>
    <h2>Gráficos empilhados (% do mês)</h2>
    ${htmlStackedBlock(report.pagina1_bruto, true)}
    ${htmlMediaGeral(report.padraoPartes, 'bruto')}
    <div class="section-title">Tabela</div>
    ${htmlTabelaMeses(report.pagina1_bruto, true, report.margemMediaJanela)}
    <p class="note">* Mês parcial (ainda não fechou).</p>
    <p class="foot">Página 1 de 2 · P38 · Gerado ${esc(gerado)} (Tabatinga)</p>
  </section>

  <section class="page">
    <h1>Sazonalidade de vendas — média orgânica</h1>
    <p class="meta">Mesma janela · dias com faturamento diário acima de Q3+1,5×IQR removidos dentro de cada mês; partes recalculadas.</p>
    <h2>Gráficos empilhados (filtrado)</h2>
    ${htmlStackedBlock(report.pagina2_organico, false)}
    ${htmlMediaGeral(report.padraoPartes, 'organico')}
    <div class="section-title">Tabela</div>
    ${htmlTabelaMeses(report.pagina2_organico, false, report.margemMediaJanela)}
    <p class="note">m.c. = margem de contribuição (lucro ÷ receita líquida). Markup = lucro ÷ custo. Fonte: KPI mensal, snapshot de margem ou Relatório de Margem (Supabase).</p>
    <div class="section-title">Dias excluídos (outliers)</div>
    ${htmlOutliers(report.outliersDiarios)}
    <p class="note">Compare com a página 1: com 3 partes e dias úteis, a média orgânica tende a ~33% por terço quando o mês está fechado.</p>
    <p class="foot">Página 2 de 2 · Estudo offline — não altera o ERP · Gerado ${esc(gerado)}</p>
  </section>
</body>
</html>`;
}

async function renderPdf(html, outPath) {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });
  } finally {
    await browser.close();
  }
}

loadDotEnvFiles();
const { url, serviceRoleKey } = resolveP38SupabaseAdminConfig();
if (!url || !serviceRoleKey) {
  console.error('Credenciais Supabase em falta.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const report = await runVendasSazonalidadeAnalise(supabase, { enrichMargem: true });
const fileName = `P38-vendas-sazonalidade-6m-${report.dataCorte}.pdf`;
const outPath = path.join(OUT_DIR, fileName);

const html = buildHtml(report);
await renderPdf(html, outPath);

try {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  copyFileSync(outPath, path.join(ARTIFACTS_DIR, fileName));
} catch {
  /* artifacts opcional */
}

console.log(`PDF gerado: ${outPath}`);