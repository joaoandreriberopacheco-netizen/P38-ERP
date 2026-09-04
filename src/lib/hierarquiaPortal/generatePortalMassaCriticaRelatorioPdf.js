import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';

const PDF_FONT_BOLD = 'bold';
const PDF_FONT_NORMAL = 'normal';
const M = 12;
const FOOTER_H = 12;
const TOP_Y = 16;
const LINE_H = 4.4;

const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  rowRule: [220, 220, 220],
  section: [240, 240, 240],
  group: [248, 248, 248],
};

const FONT = {
  title: 15,
  subtitle: 10,
  section: 11.5,
  group: 9.8,
  colHdr: 9,
  row: 9.2,
  rowSmall: 8.2,
  footer: 8.5,
};

const safe = (text) => normalizePdfText(text);
const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCx = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const moeda = (v) => `R$ ${fmtR(Number(v) || 0)}`;
const moedaOuTraco = (v) => (Number(v) > 0 ? moeda(v) : '—');

function buildTreeColumns(pageW) {
  const tableRight = pageW - M;
  return {
    label: M,
    labelW: 82,
    massa: M + 86,
    invest: M + 108,
    media: M + 144,
    skus: tableRight,
    childIndent: 5,
    tableRight,
  };
}

function buildSkuTreeColumns(pageW) {
  const tableRight = pageW - M;
  return {
    label: M,
    labelW: 88,
    estoque: M + 92,
    faltam: M + 114,
    custoCx: M + 136,
    invest: tableRight,
    childIndent: 5,
    tableRight,
  };
}

function groupEsquadrasByLinha(esquadras = []) {
  const map = new Map();
  for (const eq of esquadras) {
    const key = eq.linha_codigo || eq.linha_nome || '—';
    if (!map.has(key)) {
      map.set(key, {
        linha_nome: eq.linha_nome,
        linha_codigo: eq.linha_codigo,
        esquadras: [],
      });
    }
    map.get(key).esquadras.push(eq);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      esquadras: [...g.esquadras].sort((a, b) =>
        (a.produto_compra_nome || '').localeCompare(b.produto_compra_nome || '', 'pt-BR'),
      ),
      totais: {
        count: g.esquadras.length,
        saldaveis: g.esquadras.filter((e) => e.saldavel).length,
        invest: g.esquadras.reduce((s, e) => s + (e.custo_para_saldavel || 0), 0),
        skus: g.esquadras.reduce((s, e) => s + (e.sku_count || 0), 0),
      },
    }))
    .sort((a, b) => (a.linha_nome || '').localeCompare(b.linha_nome || '', 'pt-BR'));
}

function splitLines(doc, text, width, fontSize) {
  if (!text) return [];
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(safe(String(text)), width);
}

function drawTextBlock(doc, lines, x, y, align = 'left') {
  lines.forEach((line, idx) => {
    doc.text(line, x, y + idx * LINE_H, { align });
  });
  return lines.length;
}

function drawRule(doc, y, tableRight, weight = 0.06) {
  doc.setDrawColor(...ENXUTO.rowRule);
  doc.setLineWidth(weight);
  doc.line(M, y, tableRight, y);
}

function drawHeaderRule(doc, y, tableRight) {
  doc.setDrawColor(...ENXUTO.line);
  doc.setLineWidth(0.12);
  doc.line(M, y, tableRight, y);
}

function drawFooter(doc, fontFamily, pageNum, totalPages) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.footer);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Página ${pageNum} / ${totalPages}`, pageW - M, pageH - 6, { align: 'right' });
}

function drawTreeTableHeader(doc, fontFamily, y, col) {
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.colHdr);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('LINHA / ESQUADRA', col.label, y);
  doc.text('MASSA', col.massa, y, { align: 'right' });
  doc.text('INVEST.', col.invest, y, { align: 'right' });
  doc.text('MÉD/MOD', col.media, y, { align: 'right' });
  doc.text('SKUs', col.skus, y, { align: 'right' });
  const lineY = y + 2;
  drawHeaderRule(doc, lineY, col.tableRight);
  return lineY + 4.8;
}

function measureLinhaGroupRow(doc, grupo, col) {
  const title = `${grupo.linha_nome} (${grupo.totais.count} esquadra${grupo.totais.count !== 1 ? 's' : ''})`;
  const lines = splitLines(doc, title, col.labelW - 2, FONT.group);
  return 3.6 + Math.max(lines.length, 1) * LINE_H;
}

function drawLinhaGroupRow(doc, fontFamily, grupo, y, col) {
  const rowH = measureLinhaGroupRow(doc, grupo, col);
  doc.setFillColor(...ENXUTO.section);
  doc.rect(M, y, col.tableRight - M, rowH + 0.6, 'F');

  const baseline = y + 3.8;
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.group);
  doc.setTextColor(...ENXUTO.black);

  const title = `${grupo.linha_nome} (${grupo.totais.count} esquadra${grupo.totais.count !== 1 ? 's' : ''})`;
  const titleLines = splitLines(doc, title, col.labelW - 2, FONT.group);
  drawTextBlock(doc, titleLines, col.label + 2, baseline);

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.rowSmall);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(
    safe(`${grupo.totais.saldaveis} saldável(is)`),
    col.massa,
    baseline,
    { align: 'right' },
  );

  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.black);
  doc.text(moedaOuTraco(grupo.totais.invest), col.invest, baseline, { align: 'right' });
  doc.text('—', col.media, baseline, { align: 'right' });
  doc.text(String(grupo.totais.skus), col.skus, baseline, { align: 'right' });

  const bottom = y + rowH + 0.6;
  drawRule(doc, bottom, col.tableRight, 0.08);
  return bottom + 1;
}

function measureEsquadraChildRow(doc, eq, col) {
  const esquadraLines = splitLines(doc, eq.produto_compra_nome || '', col.labelW - col.childIndent - 2, FONT.row);
  return 3.6 + Math.max(esquadraLines.length, 1) * LINE_H;
}

function drawEsquadraChildRow(doc, fontFamily, eq, y, col) {
  const rowH = measureEsquadraChildRow(doc, eq, col);
  const baseline = y + 3.6;
  const xLabel = col.label + col.childIndent;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.black);

  doc.setTextColor(...ENXUTO.muted);
  doc.text('└', col.label + 1, baseline);
  doc.setTextColor(...ENXUTO.black);

  const esquadraLines = splitLines(doc, eq.produto_compra_nome || '', col.labelW - col.childIndent - 2, FONT.row);
  drawTextBlock(doc, esquadraLines, xLabel, baseline);

  doc.text(`${eq.linhas_com_massa}/${eq.min_linhas_saldavel}`, col.massa, baseline, { align: 'right' });
  doc.text(moedaOuTraco(eq.custo_para_saldavel), col.invest, baseline, { align: 'right' });
  doc.text(moedaOuTraco(eq.media_investimento_modelo), col.media, baseline, { align: 'right' });
  doc.text(String(eq.sku_count ?? 0), col.skus, baseline, { align: 'right' });

  const bottom = y + rowH;
  drawRule(doc, bottom, col.tableRight);
  return bottom + 1;
}

function drawLinhaDetailGroup(doc, fontFamily, grupo, y, col) {
  const title = `${grupo.linha_nome} (${grupo.esquadras.length} esquadra${grupo.esquadras.length !== 1 ? 's' : ''})`;
  const titleLines = splitLines(doc, title, col.labelW - 2, FONT.group);
  const rowH = 3.6 + Math.max(titleLines.length, 1) * LINE_H;

  doc.setFillColor(...ENXUTO.section);
  doc.rect(M, y, col.tableRight - M, rowH + 0.4, 'F');
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.group);
  doc.setTextColor(...ENXUTO.black);
  drawTextBlock(doc, titleLines, col.label + 2, y + 3.6);

  const bottom = y + rowH + 0.4;
  drawRule(doc, bottom, col.tableRight, 0.08);
  return bottom + 1;
}

function drawSkuTreeHeader(doc, fontFamily, y, col) {
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.colHdr);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('ESQUADRA / MODELO', col.label, y);
  doc.text('EST.', col.estoque, y, { align: 'right' });
  doc.text('FALTAM', col.faltam, y, { align: 'right' });
  doc.text('CUSTO/CX', col.custoCx, y, { align: 'right' });
  doc.text('INVEST.', col.invest, y, { align: 'right' });
  const lineY = y + 2;
  drawHeaderRule(doc, lineY, col.tableRight);
  return lineY + 4.8;
}

function measureEsquadraDetailGroup(doc, eq, col) {
  const title = `${eq.produto_compra_nome} — invest. ${moeda(eq.custo_para_saldavel)}`;
  const lines = splitLines(doc, title, col.labelW - 2, FONT.group);
  return 3.6 + Math.max(lines.length, 1) * LINE_H;
}

function drawEsquadraDetailGroup(doc, fontFamily, eq, y, col) {
  const rowH = measureEsquadraDetailGroup(doc, eq, col);
  doc.setFillColor(...ENXUTO.group);
  doc.rect(M, y, col.tableRight - M, rowH + 0.4, 'F');

  const baseline = y + 3.6;
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.group);
  doc.setTextColor(...ENXUTO.black);
  const title = `${eq.produto_compra_nome} — invest. ${moeda(eq.custo_para_saldavel)}`;
  const titleLines = splitLines(doc, title, col.labelW - 2, FONT.group);
  drawTextBlock(doc, titleLines, col.label + 2, baseline);

  const bottom = y + rowH + 0.4;
  drawRule(doc, bottom, col.tableRight, 0.08);
  return bottom + 1;
}

function measureSkuChildRow(doc, sku, col) {
  const label = sku.prioridade_saldavel ? `★ ${sku.eixos || sku.nome}` : (sku.eixos || sku.nome);
  const nameLines = splitLines(doc, label, col.labelW - col.childIndent - 2, FONT.row);
  return 3.6 + Math.max(nameLines.length, 1) * LINE_H;
}

function drawSkuChildRow(doc, fontFamily, sku, y, col) {
  const rowH = measureSkuChildRow(doc, sku, col);
  const baseline = y + 3.6;
  const xLabel = col.label + col.childIndent;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('└', col.label + 1, baseline);
  doc.setTextColor(...ENXUTO.black);

  const label = sku.prioridade_saldavel ? `★ ${sku.eixos || sku.nome}` : (sku.eixos || sku.nome);
  const nameLines = splitLines(doc, label, col.labelW - col.childIndent - 2, FONT.row);
  drawTextBlock(doc, nameLines, xLabel, baseline);

  doc.text(`${fmtCx(sku.cx_atual)} CX`, col.estoque, baseline, { align: 'right' });
  doc.text(`${fmtCx(sku.cx_faltam)} CX`, col.faltam, baseline, { align: 'right' });
  doc.text(moedaOuTraco(sku.custo_por_cx), col.custoCx, baseline, { align: 'right' });
  doc.text(moedaOuTraco(sku.custo_estimado), col.invest, baseline, { align: 'right' });

  const bottom = y + rowH;
  drawRule(doc, bottom, col.tableRight);
  return bottom + 1;
}

export async function generatePortalMassaCriticaRelatorioPdf(payload = {}) {
  const {
    esquadras = [],
    totais = {},
    parametros = {},
    filters_summary: filtersSummary = '',
    generated_at: generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const massa = parametros.massa_critica_cx ?? 16;
  const minLinhas = parametros.min_linhas_saldavel ?? 9;

  const colTree = buildTreeColumns(pageW);
  const colSkuTree = buildSkuTreeColumns(pageW);

  let y = TOP_Y;
  let activeTableHeader = null;

  const bottomLimit = () => pageH - FOOTER_H;

  const ensureSpace = (needed) => {
    if (y + needed <= bottomLimit()) return;
    doc.addPage();
    y = TOP_Y;
    if (typeof activeTableHeader === 'function') {
      y = activeTableHeader();
    }
  };

  const startEsquadraTree = () => {
    activeTableHeader = () => drawTreeTableHeader(doc, fontFamily, y, colTree);
    y = activeTableHeader();
  };

  const startSkuTree = () => {
    activeTableHeader = () => drawSkuTreeHeader(doc, fontFamily, y, colSkuTree);
    y = activeTableHeader();
  };

  const stopTable = () => {
    activeTableHeader = null;
  };

  // —— Cabeçalho ——
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.title);
  doc.setTextColor(...ENXUTO.black);
  doc.text(safe('Investimento massa crítica — Portal cerâmica'), M, y);
  y += 7;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.subtitle);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(safe(`Gerado em ${generatedAt} · ${esquadras.length} esquadra(s)`), M, y);
  y += 5.5;

  if (filtersSummary) {
    const filterLines = doc.splitTextToSize(safe(`Filtros: ${filtersSummary}`), pageW - M * 2);
    doc.text(filterLines, M, y);
    y += filterLines.length * 4.2 + 2;
  }

  doc.setFontSize(FONT.rowSmall);
  doc.text(
    safe(
      `Meta saldável: ${minLinhas} modelos × ${massa} CX · MÉD/MOD = média custo/CX × ${massa} · invest. saldável = MÉD/MOD × modelos em falta (mín. ${minLinhas} modelos)`,
    ),
    M,
    y,
  );
  y += 8;

  // —— Resumo KPI (tabela enxuta) ——
  ensureSpace(28);
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.section);
  doc.setTextColor(...ENXUTO.black);
  doc.text('Resumo', M, y);
  y += 6;

  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.colHdr);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('INDICADOR', M, y);
  doc.text('VALOR', M + 72, y);
  y += 4.5;
  drawHeaderRule(doc, y - 1.5, colTree.tableRight);
  y += 2;

  const kpiRows = [
    ['Esquadras filtradas', String(totais.esquadras ?? 0)],
    ['Já saldáveis', String(totais.esquadras_saldaveis ?? 0)],
    ['Investimento p/ saldável', moeda(totais.custo_para_saldavel)],
    ['Completar todos abaixo da massa', moeda(totais.custo_completar_abaixo)],
  ];

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.black);
  for (const [label, value] of kpiRows) {
    ensureSpace(5.5);
    doc.text(safe(label), M, y);
    doc.text(safe(value), M + 72, y);
    y += 4.8;
    drawRule(doc, y - 0.8, colTree.tableRight);
  }
  y += 6;

  // —— Tabela esquadras ——
  ensureSpace(16);
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.section);
  doc.setTextColor(...ENXUTO.black);
  doc.text('Por esquadra (produto compra)', M, y);
  y += 6;

  const gruposLinha = groupEsquadrasByLinha(esquadras);
  startEsquadraTree();
  for (const grupo of gruposLinha) {
    ensureSpace(measureLinhaGroupRow(doc, grupo, colTree) + 2);
    y = drawLinhaGroupRow(doc, fontFamily, grupo, y, colTree);
    for (const eq of grupo.esquadras) {
      ensureSpace(measureEsquadraChildRow(doc, eq, colTree) + 2);
      y = drawEsquadraChildRow(doc, fontFamily, eq, y, colTree);
    }
  }
  stopTable();
  y += 4;

  // —— Detalhe SKUs prioritários (tree: linha → esquadra → modelos) ——
  const detalheEsquadras = esquadras.filter(
    (eq) => !eq.saldavel && (eq.custo_para_saldavel > 0 || eq.skus?.some((s) => s.prioridade_saldavel)),
  );

  if (detalheEsquadras.length) {
    ensureSpace(16);
    doc.setFont(fontFamily, PDF_FONT_BOLD);
    doc.setFontSize(FONT.section);
    doc.setTextColor(...ENXUTO.black);
    doc.text('Detalhe — modelos prioritários', M, y);
    y += 7;

    startSkuTree();

    const detalheGrupos = groupEsquadrasByLinha(detalheEsquadras);
    for (const grupo of detalheGrupos) {
      const esquadrasComSkus = grupo.esquadras
        .map((eq) => ({
          eq,
          skus: (eq.skus || []).filter((s) => s.prioridade_saldavel || !s.atinge_massa),
        }))
        .filter(({ skus }) => skus.length > 0);

      if (!esquadrasComSkus.length) continue;

      ensureSpace(12);
      y = drawLinhaDetailGroup(doc, fontFamily, { ...grupo, esquadras: esquadrasComSkus.map((x) => x.eq) }, y, colSkuTree);

      for (const { eq, skus } of esquadrasComSkus) {
        ensureSpace(measureEsquadraDetailGroup(doc, eq, colSkuTree) + 4);
        y = drawEsquadraDetailGroup(doc, fontFamily, eq, y, colSkuTree);

        for (const sku of skus) {
          ensureSpace(measureSkuChildRow(doc, sku, colSkuTree) + 2);
          y = drawSkuChildRow(doc, fontFamily, sku, y, colSkuTree);
        }
      }

      y += 2;
    }

    stopTable();
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooter(doc, fontFamily, p, totalPages);
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portal-massa-critica-${stamp}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  return { ok: true, esquadras: esquadras.length };
}
