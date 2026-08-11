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

function buildEsquadraColumns(pageW) {
  const tableRight = pageW - M;
  return {
    linha: M,
    linhaW: 36,
    esquadra: M + 38,
    esquadraW: 50,
    massa: M + 92,
    invest: M + 108,
    media: M + 138,
    skus: tableRight,
    tableRight,
  };
}

function buildSkuColumns(pageW) {
  const tableRight = pageW - M;
  return {
    modelo: M,
    modeloW: 72,
    estoque: M + 74,
    faltam: M + 96,
    custoCx: M + 116,
    invest: tableRight,
    tableRight,
  };
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

function drawGroupBar(doc, fontFamily, title, y, tableRight) {
  doc.setFillColor(...ENXUTO.group);
  doc.rect(M, y - 3.6, tableRight - M, 7.2, 'F');
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.group);
  doc.setTextColor(...ENXUTO.black);
  const lines = splitLines(doc, title, tableRight - M - 4, FONT.group);
  drawTextBlock(doc, lines.slice(0, 2), M + 2, y + 0.8);
  return y + 7.2 + (lines.length > 1 ? 2 : 0);
}

function drawEsquadraTableHeader(doc, fontFamily, y, col) {
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.colHdr);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('LINHA', col.linha, y);
  doc.text('ESQUADRA', col.esquadra, y);
  doc.text('MASSA', col.massa, y, { align: 'right' });
  doc.text('INVEST.', col.invest, y, { align: 'right' });
  doc.text('MÉD/MOD', col.media, y, { align: 'right' });
  doc.text('SKUs', col.skus, y, { align: 'right' });
  const lineY = y + 2;
  drawHeaderRule(doc, lineY, col.tableRight);
  return lineY + 4.8;
}

function measureEsquadraRow(doc, eq, col) {
  const linhaLines = splitLines(doc, eq.linha_nome || '', col.linhaW - 2, FONT.row);
  const esquadraLines = splitLines(doc, eq.produto_compra_nome || '', col.esquadraW - 2, FONT.row);
  return 3.6 + Math.max(linhaLines.length, esquadraLines.length, 1) * LINE_H;
}

function drawEsquadraRow(doc, fontFamily, eq, y, col) {
  const rowH = measureEsquadraRow(doc, eq, col);
  const baseline = y + 3.6;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.black);

  const linhaLines = splitLines(doc, eq.linha_nome || '', col.linhaW - 2, FONT.row);
  const esquadraLines = splitLines(doc, eq.produto_compra_nome || '', col.esquadraW - 2, FONT.row);
  drawTextBlock(doc, linhaLines, col.linha, baseline);
  drawTextBlock(doc, esquadraLines, col.esquadra, baseline);

  doc.text(`${eq.linhas_com_massa}/${eq.min_linhas_saldavel}`, col.massa, baseline, { align: 'right' });
  doc.text(moedaOuTraco(eq.custo_para_saldavel), col.invest, baseline, { align: 'right' });
  doc.text(moedaOuTraco(eq.media_investimento_modelo), col.media, baseline, { align: 'right' });
  doc.text(String(eq.sku_count ?? 0), col.skus, baseline, { align: 'right' });

  const bottom = y + rowH;
  drawRule(doc, bottom, col.tableRight);
  return bottom + 1;
}

function drawSkuTableHeader(doc, fontFamily, y, col) {
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.colHdr);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('MODELO', col.modelo, y);
  doc.text('EST.', col.estoque, y, { align: 'right' });
  doc.text('FALTAM', col.faltam, y, { align: 'right' });
  doc.text('CUSTO/CX', col.custoCx, y, { align: 'right' });
  doc.text('INVEST.', col.invest, y, { align: 'right' });
  const lineY = y + 2;
  drawHeaderRule(doc, lineY, col.tableRight);
  return lineY + 4.8;
}

function measureSkuRow(doc, sku, col) {
  const label = sku.prioridade_saldavel ? `★ ${sku.eixos || sku.nome}` : (sku.eixos || sku.nome);
  const nameLines = splitLines(doc, label, col.modeloW - 2, FONT.row);
  return 3.6 + Math.max(nameLines.length, 1) * LINE_H;
}

function drawSkuRow(doc, fontFamily, sku, y, col) {
  const rowH = measureSkuRow(doc, sku, col);
  const baseline = y + 3.6;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  doc.setTextColor(...ENXUTO.black);

  const label = sku.prioridade_saldavel ? `★ ${sku.eixos || sku.nome}` : (sku.eixos || sku.nome);
  const nameLines = splitLines(doc, label, col.modeloW - 2, FONT.row);
  drawTextBlock(doc, nameLines, col.modelo, baseline);

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

  const colEq = buildEsquadraColumns(pageW);
  const colSku = buildSkuColumns(pageW);

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

  const startEsquadraTable = () => {
    activeTableHeader = () => drawEsquadraTableHeader(doc, fontFamily, y, colEq);
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
    safe(`Meta saldável: ${minLinhas} modelos com ≥ ${massa} CX · custo = preco_custo_calculado (por CX)`),
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
  drawHeaderRule(doc, y - 1.5, colEq.tableRight);
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
    drawRule(doc, y - 0.8, colEq.tableRight);
  }
  y += 6;

  // —— Tabela esquadras ——
  ensureSpace(16);
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.section);
  doc.setTextColor(...ENXUTO.black);
  doc.text('Por esquadra (produto compra)', M, y);
  y += 6;

  startEsquadraTable();
  for (const eq of esquadras) {
    ensureSpace(measureEsquadraRow(doc, eq, colEq) + 2);
    y = drawEsquadraRow(doc, fontFamily, eq, y, colEq);
  }
  stopTable();
  y += 4;

  // —— Detalhe SKUs prioritários ——
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

    for (const eq of detalheEsquadras) {
      const skusPrioritarios = (eq.skus || []).filter((s) => s.prioridade_saldavel || !s.atinge_massa);
      if (!skusPrioritarios.length) continue;

      ensureSpace(18);
      y = drawGroupBar(
        doc,
        fontFamily,
        `${eq.linha_nome} · ${eq.produto_compra_nome} — invest. saldável ${moeda(eq.custo_para_saldavel)}`,
        y,
        colSku.tableRight,
      );

      activeTableHeader = () => drawSkuTableHeader(doc, fontFamily, y, colSku);
      y = activeTableHeader();

      for (const sku of skusPrioritarios) {
        ensureSpace(measureSkuRow(doc, sku, colSku) + 2);
        y = drawSkuRow(doc, fontFamily, sku, y, colSku);
      }

      stopTable();
      y += 3;
    }
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
