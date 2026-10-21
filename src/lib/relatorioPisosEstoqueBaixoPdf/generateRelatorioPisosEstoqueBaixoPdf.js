import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';

const PDF_FONT_NORMAL = 'normal';
const PDF_FONT_BOLD = 'bold';
const ROW_RULE_W = 0.07;
const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  rowRule: [210, 210, 210],
};
const FONT = {
  title: 13,
  colHdr: 6.8,
  row: 7.8,
  code: 7.4,
  footer: 8.5,
};
const DESC_LINE_LEAD = 4;
const COL_HDR_BLOCK = 9;
const TABLE_TOP_CONTINUATION = 14;
const ROW_H = 5.6;
const ROW_GAP = 1.05;
const ROW_STEP = ROW_H + ROW_GAP;
const BASELINE_RATIO = 0.72;

const fmtN = (n) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const safe = (text) => normalizePdfText(text);

/**
 * Tabela enxuta (linhas horizontais; sem moldura externa) — pisos com estoque abaixo do limite em m².
 */
export async function generateRelatorioPisosEstoqueBaixoPdf(payload = {}) {
  const {
    rows = [],
    limiteM2 = 20,
    generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfFontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 6;
  const CW = pageW - M * 2;
  const right = M + CW;

  const X = {
    codigo: M + 1.5,
    desc: M + 17,
    m2: M + 102,
    cx: M + 114,
    custo: M + 132,
    preco: M + 156,
    mk: right,
  };

  let y = 16;

  const drawRowSeparator = (yLine) => {
    doc.setDrawColor(...ENXUTO.rowRule);
    doc.setLineWidth(ROW_RULE_W);
    doc.line(M + 1.5, yLine, right, yLine);
  };

  const drawColumnHeaders = (topY) => {
    const line1 = topY + 4.2;
    const line2 = topY + 7.4;
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.colHdr);
    doc.setTextColor(...ENXUTO.muted);
    doc.text('COD', X.codigo, line1);
    doc.text('DESCRICAO', X.desc, line1);
    doc.text('M2', X.m2, line1, { align: 'right' });
    doc.text('CX', X.cx, line1, { align: 'right' });
    doc.text('CUSTO', X.custo, line1, { align: 'right' });
    doc.text('VENDA', X.preco, line1, { align: 'right' });
    doc.text('MK%', X.mk, line1, { align: 'right' });
    doc.setFontSize(FONT.colHdr - 0.5);
    doc.text('calc/CX', X.custo, line2, { align: 'right' });
    doc.text('/CX', X.preco, line2, { align: 'right' });
  };

  const beginTablePage = () => {
    drawColumnHeaders(y);
    y += COL_HDR_BLOCK;
  };

  const ensureTableSpace = (needed = ROW_STEP + 1) => {
    if (y + needed > pageH - 12) {
      doc.addPage();
      y = TABLE_TOP_CONTINUATION;
      beginTablePage();
    }
  };

  doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.title);
  doc.setTextColor(...ENXUTO.black);
  doc.text('Pisos em estoque — abaixo de 20 m2', M, y);
  y += 5.2;
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(8.2);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(
    safe(
      `Hierarquia PISO · ativos · estoque > 0 · menos de ${fmtN(limiteM2)} m2 · ordem alfabetica · ${rows.length} item(ns)`,
    ),
    M,
    y,
  );
  y += 4;
  doc.text(safe(`Gerado em ${generatedAt}`), M, y);
  y += 6;

  beginTablePage();

  const descMaxW = X.m2 - X.desc - 3;

  for (const row of rows) {
    const descLines = doc.splitTextToSize(safe(row.nome || ''), descMaxW);
    const lineCount = Math.max(1, descLines.length);
    const extraH = (lineCount - 1) * DESC_LINE_LEAD;
    const rowStep = ROW_STEP + extraH;
    ensureTableSpace(rowStep + 1);
    const drawY = y;
    const baseline =
      lineCount <= 1
        ? drawY + ROW_H * BASELINE_RATIO
        : drawY + (ROW_H + extraH) / 2 + FONT.row * 0.18;

    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.code);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe(row.codigo || '—'), X.codigo, baseline);

    doc.setFontSize(FONT.row);
    const descFirst = baseline - ((lineCount - 1) * DESC_LINE_LEAD) / 2;
    for (let i = 0; i < lineCount; i += 1) {
      doc.text(descLines[i], X.desc, descFirst + i * DESC_LINE_LEAD);
    }

    doc.text(fmtN(row.m2), X.m2, baseline, { align: 'right' });
    doc.text(fmtN(row.cx), X.cx, baseline, { align: 'right' });
    doc.text(Number(row.custo_calc_x_cx) > 0 ? fmtN(row.custo_calc_x_cx) : '—', X.custo, baseline, {
      align: 'right',
    });
    doc.text(Number(row.preco_venda_cx) > 0 ? fmtN(row.preco_venda_cx) : '—', X.preco, baseline, {
      align: 'right',
    });
    const mk =
      Number(row.markup_pct) > 0 && Number(row.preco_venda_cx) > 0
        ? `${fmtPct(row.markup_pct)}%`
        : '—';
    doc.text(mk, X.mk, baseline, { align: 'right' });

    drawRowSeparator(drawY + rowStep - ROW_GAP * 0.35);
    y = drawY + rowStep;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.footer);
    doc.setTextColor(...ENXUTO.muted);
    doc.text(`Pagina ${p} / ${totalPages}`, right, pageH - 6, { align: 'right' });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return { data: arrayBuffer, mimeType: 'application/pdf' };
}
