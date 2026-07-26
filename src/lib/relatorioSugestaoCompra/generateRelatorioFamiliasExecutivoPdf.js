import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { prepareFamiliasExecutivoReport } from '@/lib/relatorioSugestaoCompra/prepareFamiliasExecutivoReport';

const safe = (text) => normalizePdfText(text);

export const FAMILIAS_EXECUTIVO_PDF_BUILD = 'familias_executivo_v1';

const M = 14;
const FOOTER_H = 10;
const TOP_Y = 18;
const LINE_H = 4.2;

const INK = {
  black: [20, 20, 20],
  muted: [90, 90, 90],
  line: [160, 160, 160],
  rule: [220, 220, 220],
  urgentBg: [255, 244, 244],
  warnBg: [255, 251, 235],
};

const FONT = {
  title: 16,
  lead: 10.5,
  body: 9.2,
  small: 8,
  col: 8.5,
  footer: 7.5,
};

function columnLayout(pageW) {
  const right = pageW - M;
  return {
    rank: M,
    rankW: 6,
    familia: M + 7,
    familiaW: 52,
    curva: M + 61,
    estoque: M + 70,
    media: M + 92,
    proj: M + 114,
    qtd: M + 134,
    msg: M + 152,
    right,
  };
}

function split(doc, text, width, size) {
  if (!text) return [];
  doc.setFontSize(size);
  return doc.splitTextToSize(safe(String(text)), width);
}

function drawLegend(doc, font, y, pageW) {
  doc.setFont(font, 'normal');
  doc.setFontSize(FONT.body);
  doc.setTextColor(...INK.muted);
  const lines = [
    'Cada linha é uma família de produto (ex.: PISO › 45×45) — não um SKU isolado.',
    'Média 30d = ritmo de venda recente. P.Futuro = estoque projetado daqui a 30 dias.',
    'P.Futuro negativo = risco de ruptura e venda perdida. Curva A tem prioridade sobre D.',
    'Ordem da lista: urgência (ruptura) → curva ABCD → velocidade.',
  ];
  let cy = y;
  for (const line of lines) {
    const wrapped = split(doc, line, pageW - M * 2, FONT.body);
    doc.text(wrapped, M, cy);
    cy += wrapped.length * LINE_H + 1.5;
  }
  return cy + 2;
}

function drawSummaryBox(doc, font, y, summary, pageW) {
  const boxH = 14;
  doc.setFillColor(248, 248, 248);
  doc.rect(M, y, pageW - M * 2, boxH, 'F');
  doc.setFont(font, 'bold');
  doc.setFontSize(FONT.body);
  doc.setTextColor(...INK.black);
  const s = summary || {};
  doc.text(
    safe(
      `${s.totalFamilias || 0} famílias  ·  ${s.comRuptura || 0} com ruptura prevista  ·  ${s.comAcao || 0} com quantidade sugerida`,
    ),
    M + 3,
    y + 9,
  );
  return y + boxH + 6;
}

function drawTableHeader(doc, font, y, col) {
  doc.setFont(font, 'bold');
  doc.setFontSize(FONT.col);
  doc.setTextColor(...INK.muted);
  doc.text('#', col.rank, y);
  doc.text('FAMÍLIA', col.familia, y);
  doc.text('AB', col.curva, y);
  doc.text('EST.', col.estoque, y, { align: 'right' });
  doc.text('MÉD.30D', col.media, y, { align: 'right' });
  doc.text('P.FUT.', col.proj, y, { align: 'right' });
  doc.text('QTD', col.qtd, y, { align: 'right' });
  doc.text('O QUE DIZ', col.msg, y);
  const ly = y + 2;
  doc.setDrawColor(...INK.line);
  doc.setLineWidth(0.15);
  doc.line(M, ly, col.right, ly);
  return ly + 5;
}

function rowHeight(doc, font, row, col) {
  doc.setFont(font, 'normal');
  const famLines = split(doc, row.familia, col.familiaW, FONT.body);
  const msgLines = split(doc, row.mensagem, col.right - col.msg - 1, FONT.small);
  const lines = Math.max(famLines.length, msgLines.length, 1);
  return 3.5 + lines * LINE_H;
}

function drawRow(doc, font, row, y, col) {
  const h = rowHeight(doc, font, row, col);
  const base = y + 3.5;

  if (row.projecao_negativa) {
    doc.setFillColor(...INK.urgentBg);
    doc.rect(M, y, col.right - M, h, 'F');
  } else if (row.mensagem_tom === 'warning') {
    doc.setFillColor(...INK.warnBg);
    doc.rect(M, y, col.right - M, h, 'F');
  }

  doc.setFont(font, 'normal');
  doc.setFontSize(FONT.body);
  doc.setTextColor(...INK.black);
  doc.text(String(row.rank), col.rank, base);

  const famLines = split(doc, row.familia, col.familiaW, FONT.body);
  famLines.forEach((ln, i) => doc.text(ln, col.familia, base + i * LINE_H));

  doc.setFont(font, 'bold');
  doc.text(row.curva, col.curva, base);

  doc.setFont(font, 'normal');
  doc.text(row.estoque, col.estoque, base, { align: 'right' });
  doc.text(row.media_30d, col.media, base, { align: 'right' });

  if (row.projecao_negativa) {
    doc.setFont(font, 'bold');
    doc.setTextColor(180, 30, 30);
  }
  doc.text(row.projecao, col.proj, base, { align: 'right' });
  doc.setTextColor(...INK.black);
  doc.setFont(font, 'normal');

  doc.text(row.qtd_sugerida, col.qtd, base, { align: 'right' });

  doc.setFontSize(FONT.small);
  doc.setTextColor(...INK.muted);
  const msgLines = split(doc, row.mensagem, col.right - col.msg - 1, FONT.small);
  msgLines.forEach((ln, i) => doc.text(ln, col.msg, base + i * LINE_H));

  const bottom = y + h;
  doc.setDrawColor(...INK.rule);
  doc.setLineWidth(0.05);
  doc.line(M, bottom, col.right, bottom);
  return bottom + 0.8;
}

/**
 * PDF executivo para leitura em papel — famílias nível 2, urgência primeiro.
 */
export async function generateRelatorioFamiliasExecutivoPdf(payload = {}) {
  const {
    linhas = [],
    ctx = {},
    filters_summary: filtersSummary = '',
    empresa_nome: empresaNome = 'P38',
    generated_at: generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const { rows, summary } = prepareFamiliasExecutivoReport(linhas, {
    incluirPedidosAprovados: ctx.incluirPedidosAprovados === true,
    salesVelocityMap: ctx.salesVelocityMap || {},
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const col = columnLayout(pageW);
  const bottom = () => pageH - FOOTER_H;

  let y = TOP_Y;
  let tableHeaderFn = null;

  const ensure = (need) => {
    if (y + need <= bottom()) return;
    doc.addPage();
    y = TOP_Y;
    if (tableHeaderFn) y = tableHeaderFn();
  };

  doc.setFont(font, 'bold');
  doc.setFontSize(FONT.title);
  doc.setTextColor(...INK.black);
  doc.text('Ritmo de compra — voz das famílias', M, y);
  y += 7;

  doc.setFont(font, 'normal');
  doc.setFontSize(FONT.lead);
  doc.setTextColor(...INK.muted);
  doc.text(safe(`${empresaNome} · Gerado em ${generatedAt}`), M, y);
  y += 8;

  y = drawLegend(doc, font, y, pageW);
  y = drawSummaryBox(doc, font, y, summary, pageW);

  if (filtersSummary) {
    doc.setFont(font, 'normal');
    doc.setFontSize(FONT.small);
    doc.setTextColor(...INK.muted);
    const fl = split(doc, `Filtros: ${filtersSummary}`, pageW - M * 2, FONT.small);
    doc.text(fl, M, y);
    y += fl.length * 3.8 + 4;
  }

  ensure(20);
  tableHeaderFn = () => drawTableHeader(doc, font, y, col);
  y = tableHeaderFn();

  for (const row of rows) {
    const rh = rowHeight(doc, font, row, col) + 1;
    ensure(rh);
    y = drawRow(doc, font, row, y, col);
  }

  if (!rows.length) {
    doc.setFont(font, 'normal');
    doc.setFontSize(FONT.body);
    doc.text('Nenhuma família com hierarquia nível 2 encontrada nos filtros actuais.', M, y + 4);
  }

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont(font, 'normal');
    doc.setFontSize(FONT.footer);
    doc.setTextColor(...INK.muted);
    doc.text(
      safe(`${FAMILIAS_EXECUTIVO_PDF_BUILD} · P38 · Página ${p}/${pages}`),
      pageW / 2,
      pageH - 5,
      { align: 'center' },
    );
  }

  return {
    data: doc.output('arraybuffer'),
    version: FAMILIAS_EXECUTIVO_PDF_BUILD,
    rowCount: rows.length,
    summary,
  };
}
