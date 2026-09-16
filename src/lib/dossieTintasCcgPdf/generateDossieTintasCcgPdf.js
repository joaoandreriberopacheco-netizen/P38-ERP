import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';

export const PDF_BUILD = 'dossie-tintas-ccg-v1';

const BRL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QTD = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const COLORS = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [220, 220, 224],
  accent: [39, 39, 42],
};

const FONT = {
  title: 15,
  subtitle: 10,
  kpi: 14.5,
  kpiLabel: 8.2,
  section: 11.5,
  tableHead: 9,
  tableRow: 9,
  footer: 8.5,
};

const GRID = {
  lineWidth: 0.1,
  rowH: 7.4,
  headerH: 8.6,
  padX: 2.2,
  padY: 1.6,
};

const LAYOUT = {
  sectionGapBetween: 6,
  titleToTable: 4.8,
  sectionTitleH: 5.2,
  blockGapBefore: 5,
};

const FOOTER_RESERVE = 10;
const FOOTER_TEXT_OFFSET = 6.5;

function brl(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `R$ ${BRL.format(Number(value))}`;
}

function priceRange(range) {
  if (!range) return '—';
  if (range.min === range.max) return brl(range.min);
  return `${brl(range.min)} – ${brl(range.max)}`;
}

function setTextColor(doc, c) {
  doc.setTextColor(...c);
}

function lineHeightMm(fontSize) {
  return fontSize * 0.3528;
}

function cellTextY(cellTop, cellHeight, fontSize) {
  const lh = lineHeightMm(fontSize);
  return cellTop + Math.max(GRID.padY, (cellHeight - lh) / 2);
}

function truncateTextToFit(doc, text, maxWidth) {
  const raw = String(text ?? '—');
  if (maxWidth <= 0) return '';
  if (doc.getTextWidth(raw) <= maxWidth) return raw;
  let clipped = raw;
  const ellipsis = '…';
  while (clipped.length > 0 && doc.getTextWidth(`${clipped}${ellipsis}`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped ? `${clipped}${ellipsis}` : ellipsis;
}

function drawGridLines(doc, x, y, width, rowHeights, colWidths) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  const totalH = rowHeights.reduce((s, h) => s + h, 0);
  let yy = y;
  for (let i = 0; i <= rowHeights.length; i += 1) {
    doc.line(x, yy, x + width, yy);
    if (i < rowHeights.length) yy += rowHeights[i];
  }
  let xx = x;
  for (let i = 0; i <= colWidths.length; i += 1) {
    doc.line(xx, y, xx, y + totalH);
    if (i < colWidths.length) xx += colWidths[i];
  }
}

function drawCellText(doc, fontFamily, {
  text, x, y, width, cellHeight = GRID.rowH, align = 'left', style = 'normal',
  fontSize = FONT.tableRow, color = COLORS.ink, bold = false,
}) {
  doc.setFont(fontFamily, bold ? 'bold' : style);
  doc.setFontSize(fontSize);
  setTextColor(doc, color);
  const maxW = Math.max(0, width - GRID.padX * 2);
  const fitted = truncateTextToFit(doc, text, maxW);
  const cellX = align === 'right'
    ? x + width - GRID.padX
    : align === 'center'
      ? x + width / 2
      : x + GRID.padX;
  doc.text(fitted, cellX, cellTextY(y, cellHeight, fontSize), { align, baseline: 'top' });
}

function drawGridTable(doc, fontFamily, { x, y, width, columns, rows }) {
  const colWidths = columns.map((c) => width * c.width);
  const rowHeights = [GRID.headerH, ...rows.map(() => GRID.rowH)];
  const tableH = rowHeights.reduce((s, h) => s + h, 0);
  drawGridLines(doc, x, y, width, rowHeights, colWidths);

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(FONT.tableHead);
  setTextColor(doc, COLORS.muted);
  let cursorX = x;
  for (let i = 0; i < columns.length; i += 1) {
    drawCellText(doc, fontFamily, {
      text: columns[i].label,
      x: cursorX,
      y,
      width: colWidths[i],
      cellHeight: GRID.headerH,
      align: columns[i].align || 'left',
      style: 'bold',
      fontSize: FONT.tableHead,
      color: COLORS.muted,
    });
    cursorX += colWidths[i];
  }

  let cursorY = y + GRID.headerH;
  for (const row of rows) {
    cursorX = x;
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      drawCellText(doc, fontFamily, {
        text: row[col.key] ?? '—',
        x: cursorX,
        y: cursorY,
        width: colWidths[i],
        cellHeight: GRID.rowH,
        align: col.align || 'left',
        color: col.key === 'valor' || col.key === 'gl' || col.key === 'lt' || col.key === 'bd'
          ? COLORS.accent
          : COLORS.ink,
        bold: ['valor', 'gl', 'lt', 'bd'].includes(col.key),
      });
      cursorX += colWidths[i];
    }
    cursorY += GRID.rowH;
  }
  return y + tableH;
}

function estimateTableHeight(rowCount) {
  return GRID.headerH + rowCount * GRID.rowH;
}

function drawPageFooter(doc, fontFamily, normalize, M, CW, pageH, pageNum, totalPages, label) {
  const footerY = pageH - FOOTER_TEXT_OFFSET;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, footerY - 3, M + CW, footerY - 3);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.footer);
  setTextColor(doc, COLORS.muted);
  doc.text(normalize(`P38 · ${label} · p.${pageNum}/${totalPages} · ${PDF_BUILD}`), M, footerY);
  doc.text(normalize('Tabela CCG — preços distribuidor'), M + CW, footerY, { align: 'right' });
}

function drawSectionTitle(doc, fontFamily, normalize, x, y, title) {
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(FONT.section);
  setTextColor(doc, COLORS.ink);
  doc.text(normalize(title), x, y);
  return y + LAYOUT.sectionTitleH;
}

function drawPageHeroHeader(doc, fontFamily, normalize, layout, y, {
  title, subtitleLines = [], kpiLabel, kpiValue, kpiNotes = [],
}) {
  const { M, CW } = layout;
  const gap = 6;
  const leftWidth = (CW - gap) * 0.52;
  const rightEdge = M + CW;

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.title);
  setTextColor(doc, COLORS.ink);
  doc.text(normalize(title), M, y);

  let leftY = y + 7;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  for (const line of subtitleLines) {
    doc.text(normalize(line), M, leftY, { maxWidth: leftWidth });
    leftY += 4;
  }

  let rightY = y + 1;
  if (kpiLabel) {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(FONT.kpiLabel);
    setTextColor(doc, COLORS.muted);
    doc.text(normalize(kpiLabel), rightEdge, rightY, { align: 'right', maxWidth: CW - leftWidth - gap });
    rightY += 5.5;
    doc.setFont(fontFamily, 'heavy');
    doc.setFontSize(FONT.kpi);
    setTextColor(doc, COLORS.ink);
    doc.text(normalize(kpiValue), rightEdge, rightY, { align: 'right' });
    rightY += 6.5;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(FONT.subtitle);
    setTextColor(doc, COLORS.muted);
    for (const note of kpiNotes) {
      doc.text(normalize(note), rightEdge, rightY, { align: 'right', maxWidth: CW - leftWidth - gap });
      rightY += 4;
    }
  }

  const endY = Math.max(leftY, rightY) + 3;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, endY, M + CW, endY);
  return endY + LAYOUT.sectionGapBetween;
}

function cleanSharedColorName(name) {
  const u = String(name ?? '').toUpperCase();
  if (!u || u.startsWith('TINTA ECONOMICA') || u.startsWith('TINTA ECONÔMICA')) {
    if (u.includes('AZUL PAVAO') || u.includes('AZUL PAVÃO')) return 'Azul pavão';
    if (u.includes('PALHA')) return 'Palha';
    if (u.includes('PEROLA') || u.includes('PÉROLA')) return 'Pérola';
    if (u.includes('AMAZONAS')) return 'Verde Amazonas';
    if (u.includes('PRIMAVERA')) return 'Verde Primavera';
    return null;
  }
  return String(name);
}

function sharedColorsList(entry) {
  const raw = (entry.shared_colors_clean?.length ? entry.shared_colors_clean : entry.shared_colors) || [];
  return [...new Set(raw.map(cleanSharedColorName).filter(Boolean))];
}

function formatsToCells(formats) {
  const byAp = { GL: [], LT: [], BD: [], Fr: [], Out: [] };
  for (const f of formats) {
    (byAp[f.ap] ?? byAp.Out).push(`${f.vol ? `${f.vol} ` : ''}${brl(f.price)}`);
  }
  return {
    gl: byAp.GL.length ? byAp.GL.join(' / ') : '—',
    lt: byAp.LT.length ? byAp.LT.join(' / ') : '—',
    bd: byAp.BD.length ? byAp.BD.join(' / ') : '—',
    extra: [...byAp.Fr, ...byAp.Out].join(' / '),
  };
}

function yesNo(flag) {
  return flag ? 'Sim' : '—';
}

function buildPages(data) {
  const brands = ['Iquine', 'Hidracor', 'Hipercor'];
  const totalSkus = brands.reduce((s, b) => s + (data.brands[b]?.skus || 0), 0);
  const pages = [];

  pages.push({
    type: 'overlap',
    title: 'Dossiê Tintas CCG',
    subtitleLines: [
      'Iquine · Hidracor · Hipercor — comparativo para abastecimento P-38',
      `${data.source} · ${data.generated}`,
    ],
    kpiLabel: 'SKUs NA TABELA CCG',
    kpiValue: QTD.format(totalSkus),
    kpiNotes: ['Preços = tabela distribuidor · GL / LT / BD'],
    overlap: data.overlap,
  });

  for (const brand of brands) {
    const info = data.brands[brand];
    if (!info) continue;
    pages.push({
      type: 'brand',
      brand,
      skus: info.skus,
      lines: info.lines,
      lines_data: info.lines_data,
    });
  }
  return pages;
}

function renderOverlapPage(doc, fontFamily, normalize, layout, page) {
  const { M, CW } = layout;
  let y = M;
  y = drawPageHeroHeader(doc, fontFamily, normalize, layout, y, {
    title: page.title,
    subtitleLines: page.subtitleLines,
    kpiLabel: page.kpiLabel,
    kpiValue: page.kpiValue,
    kpiNotes: page.kpiNotes,
  });

  y = drawSectionTitle(doc, fontFamily, normalize, M, y + LAYOUT.blockGapBefore, 'Superposição entre marcas') + LAYOUT.titleToTable;

  const overlapRows = (page.overlap?.lines || [])
    .filter((l) => l.brands?.length)
    .map((l) => {
      const shared = sharedColorsList(l);
      const sharedText = shared.length
        ? `${shared.length}: ${shared.slice(0, 6).join(', ')}${shared.length > 6 ? '…' : ''}`
        : '—';
      return {
        linha: l.line,
        iquine: yesNo(l.iquine),
        hidracor: yesNo(l.hidracor),
        hipercor: yesNo(l.hipercor),
        ci: l.colors_i || '—',
        ch: l.colors_h || '—',
        cp: l.colors_p || '—',
        comum: sharedText,
      };
    });

  const stats = page.overlap?.stats || {};
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  doc.text(
    normalize(`${stats.lines_all_three || 0} linhas nas 3 marcas · ${stats.lines_two || 0} em 2 marcas`),
    M,
    y - 2,
  );
  y += 3;

  drawGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: [
      { key: 'linha', label: 'LINHA', width: 0.22, align: 'left' },
      { key: 'iquine', label: 'IQUINE', width: 0.08, align: 'center' },
      { key: 'hidracor', label: 'HIDRACOR', width: 0.09, align: 'center' },
      { key: 'hipercor', label: 'HIPERCOR', width: 0.09, align: 'center' },
      { key: 'ci', label: 'C.I', width: 0.06, align: 'center' },
      { key: 'ch', label: 'C.H', width: 0.06, align: 'center' },
      { key: 'cp', label: 'C.P', width: 0.06, align: 'center' },
      { key: 'comum', label: 'CORES EM COMUM', width: 0.34, align: 'left' },
    ],
    rows: overlapRows,
  });
}

function ensureSpace(doc, layout, y, needed, onNewPage) {
  const { pageH } = layout;
  if (y + needed <= pageH - FOOTER_RESERVE) return y;
  onNewPage();
  return layout.M;
}

function renderBrandPages(doc, fontFamily, normalize, layout, page) {
  const { M, CW } = layout;
  let y = M;

  const newPage = () => {
    doc.addPage();
    y = M;
  };

  y = drawPageHeroHeader(doc, fontFamily, normalize, layout, y, {
    title: page.brand,
    subtitleLines: [
      'Linhas, cores e preços na tabela CCG',
      `${page.skus} SKUs · ${page.lines} linhas de produto`,
    ],
    kpiLabel: 'MARCA',
    kpiValue: page.brand,
    kpiNotes: ['Unfold por cor na sequência'],
  });

  y = drawSectionTitle(doc, fontFamily, normalize, M, y + LAYOUT.blockGapBefore, 'Resumo das linhas') + LAYOUT.titleToTable;
  const summaryRows = (page.lines_data || []).map((l) => ({
    linha: l.name,
    cores: String(l.colors),
    skus: String(l.skus),
    gl: priceRange(l.price_gl),
    lt: priceRange(l.price_lt),
    bd: priceRange(l.price_bd),
  }));

  const summaryH = estimateTableHeight(summaryRows.length);
  y = ensureSpace(doc, layout, y, summaryH + 10, newPage);
  y = drawGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: [
      { key: 'linha', label: 'LINHA', width: 0.28, align: 'left' },
      { key: 'cores', label: 'CORES', width: 0.08, align: 'center' },
      { key: 'skus', label: 'SKUs', width: 0.08, align: 'center' },
      { key: 'gl', label: 'GL (3–3,6 L)', width: 0.18, align: 'right' },
      { key: 'lt', label: 'LT (0,75–0,9 L)', width: 0.18, align: 'right' },
      { key: 'bd', label: 'BD / kg', width: 0.20, align: 'right' },
    ],
    rows: summaryRows,
  }) + LAYOUT.sectionGapBetween;

  for (const [idx, line] of (page.lines_data || []).entries()) {
    const colorRows = (line.colors_detail || []).map((c) => {
      const cells = formatsToCells(c.formats);
      const extra = cells.extra && cells.extra !== '—' ? ` · ${cells.extra}` : '';
      return {
        cor: c.color,
        gl: cells.gl + (cells.gl !== '—' && extra ? '' : ''),
        lt: cells.lt,
        bd: cells.bd + extra,
      };
    });

    const blockH = LAYOUT.blockGapBefore + LAYOUT.sectionTitleH + LAYOUT.titleToTable
      + estimateTableHeight(colorRows.length) + 6;
    y = ensureSpace(doc, layout, y, blockH, newPage);

    y += LAYOUT.blockGapBefore;
    const faixa = `Faixa GL: ${priceRange(line.price_gl)} · LT: ${priceRange(line.price_lt)}${line.price_bd ? ` · BD: ${priceRange(line.price_bd)}` : ''}`;
    y = drawSectionTitle(
      doc,
      fontFamily,
      normalize,
      M,
      y,
      `${idx + 1}. ${line.name} — ${line.colors} cores · ${line.skus} SKUs`,
    );
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(FONT.subtitle);
    setTextColor(doc, COLORS.muted);
    doc.text(normalize(faixa), M, y);
    y += LAYOUT.titleToTable;

    y = drawGridTable(doc, fontFamily, {
      x: M,
      y,
      width: CW,
      columns: [
        { key: 'cor', label: 'COR', width: 0.24, align: 'left' },
        { key: 'gl', label: 'GL (3–3,6 L)', width: 0.25, align: 'left' },
        { key: 'lt', label: 'LT (0,75–0,9 L)', width: 0.25, align: 'left' },
        { key: 'bd', label: 'BD / kg / fr.', width: 0.26, align: 'left' },
      ],
      rows: colorRows,
    }) + LAYOUT.sectionGapBetween;
  }
}

export async function generateDossieTintasCcgPdf(data) {
  const pagePlan = buildPages(data);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const layout = { M: 12, CW: pageW - 24, pageH };

  renderOverlapPage(doc, fontFamily, normalizePdfText, layout, pagePlan[0]);

  for (const plan of pagePlan.slice(1)) {
    doc.addPage();
    renderBrandPages(doc, fontFamily, normalizePdfText, layout, plan);
  }

  const finalTotal = doc.getNumberOfPages();
  for (let p = 1; p <= finalTotal; p += 1) {
    doc.setPage(p);
    const { M, CW } = layout;
    drawPageFooter(doc, fontFamily, normalizePdfText, M, CW, pageH, p, finalTotal, 'Dossiê tintas CCG');
  }

  const bytes = doc.output('arraybuffer');
  return { data: new Uint8Array(bytes), build: PDF_BUILD, pages: finalTotal };
}
