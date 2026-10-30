import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';

export const PDF_BUILD = 'dossie-tintas-ccg-v2';

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
  tableHead: 8.5,
  tableRow: 8.5,
  footer: 8.5,
};

const GRID = {
  lineWidth: 0.1,
  rowH: 7.4,
  headerH: 9.2,
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

const LINE_ORDER = [
  'Esmalte',
  'Tinta semibrilho',
  'Acrílica econômica',
  'Tinta piso',
  'Tinta (outras)',
  'Verniz',
  'Selador',
  'Fundo preparador',
  'Zarcão',
  'Zarcofer anticorrosivo',
  'Sela & Pinta',
  'Massa corrida',
  'Massa acrílica',
  'Textura decorativa',
  'Tinta em pó',
];

const AP_RANK = { GL: 0, LT: 1, BD: 2, Fr: 3, Out: 4 };

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

function getPageLayout(doc, margin = 12) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  return { M: margin, CW: pageW - margin * 2, pageH };
}

function presentationKey(ap, vol) {
  const v = String(vol ?? '').trim();
  return v ? `${ap}|${v}` : String(ap);
}

function compactVolume(vol) {
  return String(vol ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/litros?/gi, 'L');
}

function presentationLabel(key) {
  const [ap, vol] = key.split('|');
  const v = compactVolume(vol);
  return v ? `${ap}\n${v}` : ap;
}

function sortPresentationKeys(keys) {
  return [...keys].sort((a, b) => {
    const [apA, volA] = a.split('|');
    const [apB, volB] = b.split('|');
    const rA = AP_RANK[apA] ?? 9;
    const rB = AP_RANK[apB] ?? 9;
    if (rA !== rB) return rA - rB;
    return String(volA || '').localeCompare(String(volB || ''), 'pt-BR', { numeric: true });
  });
}

function collectPresentations(colorsDetail) {
  const keys = new Set();
  for (const entry of colorsDetail || []) {
    for (const f of entry.formats || []) {
      keys.add(presentationKey(f.ap, f.vol));
    }
  }
  return sortPresentationKeys(keys);
}

function sortLines(linesData, { excludeOutros = false } = {}) {
  const lines = excludeOutros
    ? (linesData || []).filter((l) => l.name !== 'Outros')
    : [...(linesData || [])];
  const rank = (name) => {
    const i = LINE_ORDER.indexOf(name);
    return i >= 0 ? i : 999;
  };
  return lines.sort(
    (a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

function sortColors(colorsDetail) {
  return [...(colorsDetail || [])].sort((a, b) =>
    String(a.color).localeCompare(String(b.color), 'pt-BR', { sensitivity: 'base' }),
  );
}

function wrapLines(doc, fontFamily, text, maxWidth, fontSize, style = 'normal') {
  doc.setFont(fontFamily, style);
  doc.setFontSize(fontSize);
  const raw = String(text ?? '—');
  if (maxWidth <= 0) return [raw];
  return doc.splitTextToSize(raw, maxWidth);
}

function measureCellLines(doc, fontFamily, text, maxWidth, fontSize, style, wrap) {
  if (!wrap) return 1;
  return wrapLines(doc, fontFamily, text, maxWidth, fontSize, style).length;
}

function rowHeightFromLineCount(lineCount, fontSize) {
  const lh = lineHeightMm(fontSize);
  return GRID.padY * 2 + Math.max(1, lineCount) * lh;
}

function drawWrappedCellText(doc, fontFamily, {
  text, x, y, width, cellHeight, align = 'left', style = 'normal',
  fontSize = FONT.tableRow, color = COLORS.ink, bold = false, wrap = true,
}) {
  doc.setFont(fontFamily, bold ? 'bold' : style);
  doc.setFontSize(fontSize);
  setTextColor(doc, color);
  const maxW = Math.max(0, width - GRID.padX * 2);
  const lines = wrap
    ? wrapLines(doc, fontFamily, text, maxW, fontSize, bold ? 'bold' : style)
    : [String(text ?? '—')];
  const lh = lineHeightMm(fontSize);
  let textY = y + GRID.padY;
  for (const line of lines) {
    const cellX = align === 'right'
      ? x + width - GRID.padX
      : align === 'center'
        ? x + width / 2
        : x + GRID.padX;
    doc.text(line, cellX, textY, { align, baseline: 'top' });
    textY += lh;
  }
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

function drawWrappedGridTable(doc, fontFamily, { x, y, width, columns, rows }) {
  const colWidths = columns.map((c) => width * c.width);

  const headerLineCounts = columns.map((col, i) =>
    measureCellLines(
      doc,
      fontFamily,
      col.label,
      colWidths[i] - GRID.padX * 2,
      FONT.tableHead,
      'bold',
      true,
    ),
  );
  const headerH = rowHeightFromLineCount(Math.max(...headerLineCounts, 1), FONT.tableHead);

  const bodyHeights = rows.map((row) => {
    let maxLines = 1;
    columns.forEach((col, i) => {
      const lines = measureCellLines(
        doc,
        fontFamily,
        row[col.key] ?? '—',
        colWidths[i] - GRID.padX * 2,
        FONT.tableRow,
        'normal',
        col.wrap !== false,
      );
      maxLines = Math.max(maxLines, lines);
    });
    return rowHeightFromLineCount(maxLines, FONT.tableRow);
  });

  const rowHeights = [headerH, ...bodyHeights];
  const tableH = rowHeights.reduce((s, h) => s + h, 0);
  drawGridLines(doc, x, y, width, rowHeights, colWidths);

  let cursorX = x;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    drawWrappedCellText(doc, fontFamily, {
      text: col.label,
      x: cursorX,
      y,
      width: colWidths[i],
      cellHeight: headerH,
      align: col.align || 'left',
      style: 'bold',
      fontSize: FONT.tableHead,
      color: COLORS.muted,
      wrap: true,
    });
    cursorX += colWidths[i];
  }

  let cursorY = y + headerH;
  rows.forEach((row, rowIdx) => {
    cursorX = x;
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      drawWrappedCellText(doc, fontFamily, {
        text: row[col.key] ?? '—',
        x: cursorX,
        y: cursorY,
        width: colWidths[i],
        cellHeight: bodyHeights[rowIdx],
        align: col.align || 'left',
        fontSize: FONT.tableRow,
        color: col.price ? COLORS.accent : COLORS.ink,
        bold: Boolean(col.price),
        wrap: col.wrap !== false,
      });
      cursorX += colWidths[i];
    }
    cursorY += bodyHeights[rowIdx];
  });

  return y + tableH;
}

function estimateWrappedTableHeight(doc, fontFamily, columns, rows, width) {
  const colWidths = columns.map((c) => width * c.width);
  const headerLineCounts = columns.map((col, i) =>
    measureCellLines(doc, fontFamily, col.label, colWidths[i] - GRID.padX * 2, FONT.tableHead, 'bold', true),
  );
  const headerH = rowHeightFromLineCount(Math.max(...headerLineCounts, 1), FONT.tableHead);
  const bodyH = rows.reduce((sum, row) => {
    let maxLines = 1;
    columns.forEach((col, i) => {
      maxLines = Math.max(
        maxLines,
        measureCellLines(
          doc,
          fontFamily,
          row[col.key] ?? '—',
          colWidths[i] - GRID.padX * 2,
          FONT.tableRow,
          'normal',
          col.wrap !== false,
        ),
      );
    });
    return sum + rowHeightFromLineCount(maxLines, FONT.tableRow);
  }, 0);
  return headerH + bodyH;
}

function buildPresentationColumns(presentations, { descWidth = 0.30 } = {}) {
  const n = presentations.length || 1;
  const priceWidth = (1 - descWidth) / n;
  return [
    { key: 'descricao', label: 'DESCRIÇÃO / COR', width: descWidth, align: 'left', wrap: true },
    ...presentations.map((key) => ({
      key,
      label: presentationLabel(key),
      width: priceWidth,
      align: 'right',
      wrap: true,
      price: true,
    })),
  ];
}

function buildPresentationRows(colorsDetail, presentations) {
  return sortColors(colorsDetail).map((entry) => {
    const byKey = {};
    for (const f of entry.formats || []) {
      const k = presentationKey(f.ap, f.vol);
      if (!byKey[k]) byKey[k] = [];
      byKey[k].push(brl(f.price));
    }
    const row = { descricao: entry.color };
    for (const k of presentations) {
      row[k] = byKey[k]?.length ? byKey[k].join('\n') : '—';
    }
    return row;
  });
}

function drawPageFooter(doc, fontFamily, normalize, pageNum, totalPages, label) {
  const { M, CW, pageH } = getPageLayout(doc);
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
    kpiNotes: ['Preços = tabela distribuidor · uma coluna por apresentação'],
    overlap: data.overlap,
  });

  for (const brand of brands) {
    const info = data.brands[brand];
    if (!info) continue;
    const outros = info.lines_data?.find((l) => l.name === 'Outros');
    pages.push({
      type: 'brand',
      brand,
      skus: info.skus,
      lines: info.lines,
      lines_data: info.lines_data,
      excludeOutros: brand === 'Iquine',
      outrosSkus: brand === 'Iquine' && outros ? outros.skus : 0,
    });
  }

  const iquineOutros = data.brands?.Iquine?.lines_data?.find((l) => l.name === 'Outros');
  if (iquineOutros) {
    pages.push({ type: 'iquine_anexo', line: iquineOutros });
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
        ? shared.join(', ')
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

  drawWrappedGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: [
      { key: 'linha', label: 'LINHA', width: 0.18, align: 'left', wrap: true },
      { key: 'iquine', label: 'IQUINE', width: 0.07, align: 'center', wrap: false },
      { key: 'hidracor', label: 'HIDRACOR', width: 0.08, align: 'center', wrap: false },
      { key: 'hipercor', label: 'HIPERCOR', width: 0.08, align: 'center', wrap: false },
      { key: 'ci', label: 'C.I', width: 0.05, align: 'center', wrap: false },
      { key: 'ch', label: 'C.H', width: 0.05, align: 'center', wrap: false },
      { key: 'cp', label: 'C.P', width: 0.05, align: 'center', wrap: false },
      { key: 'comum', label: 'CORES EM COMUM', width: 0.44, align: 'left', wrap: true },
    ],
    rows: overlapRows,
  });
}

function ensureSpace(doc, y, needed, onNewPage) {
  const { pageH, M } = getPageLayout(doc);
  if (y + needed <= pageH - FOOTER_RESERVE) return y;
  onNewPage();
  return M;
}

function addPageSameOrientation(doc) {
  const w = doc.internal.pageSize.getWidth();
  const orientation = w > 210 ? 'landscape' : 'portrait';
  doc.addPage('a4', orientation);
}

function renderLineUnfold(doc, fontFamily, normalize, line, lineIndex, ctx) {
  const presentations = collectPresentations(line.colors_detail);
  if (!presentations.length) return;

  const useLandscape = presentations.length > 4;
  if (useLandscape && !ctx.landscape) {
    doc.addPage('a4', 'landscape');
    ctx.landscape = true;
    ctx.y = getPageLayout(doc).M;
  } else if (!useLandscape && ctx.landscape) {
    doc.addPage('a4', 'portrait');
    ctx.landscape = false;
    ctx.y = getPageLayout(doc).M;
  }

  const layout = getPageLayout(doc);
  const { M, CW } = layout;
  let y = ctx.y;

  const descWidth = presentations.length > 6 ? 0.26 : presentations.length > 4 ? 0.28 : 0.32;
  const columns = buildPresentationColumns(presentations, { descWidth });
  const rows = buildPresentationRows(line.colors_detail, presentations);

  const titleBlock = LAYOUT.blockGapBefore + LAYOUT.sectionTitleH + 5 + LAYOUT.titleToTable;
  const tableH = estimateWrappedTableHeight(doc, fontFamily, columns, rows, CW);
  y = ensureSpace(doc, y, titleBlock + tableH, () => {
    addPageSameOrientation(doc);
    ctx.landscape = doc.internal.pageSize.getWidth() > 210;
    y = getPageLayout(doc).M;
  });

  y += LAYOUT.blockGapBefore;
  const faixa = `Faixa GL: ${priceRange(line.price_gl)} · LT: ${priceRange(line.price_lt)}${line.price_bd ? ` · BD: ${priceRange(line.price_bd)}` : ''}`;
  y = drawSectionTitle(
    doc,
    fontFamily,
    normalize,
    M,
    y,
    `${lineIndex + 1}. ${line.name} — ${line.colors} itens · ${line.skus} SKUs`,
  );
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  doc.text(normalize(faixa), M, y, { maxWidth: CW });
  y += LAYOUT.titleToTable;

  y = drawWrappedGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns,
    rows,
  }) + LAYOUT.sectionGapBetween;

  ctx.y = y;
}

function renderBrandPages(doc, fontFamily, normalize, page) {
  const layout = getPageLayout(doc);
  const { M, CW } = layout;
  let y = M;
  const ctx = { y, landscape: false };

  const mainLines = sortLines(page.lines_data, { excludeOutros: page.excludeOutros });
  const outrosNote = page.outrosSkus
    ? ` · ${page.outrosSkus} SKUs em anexo (colas, massas, etc.)`
    : '';

  const newPage = () => {
    doc.addPage('a4', 'portrait');
    ctx.landscape = false;
    y = getPageLayout(doc).M;
    ctx.y = y;
  };

  y = drawPageHeroHeader(doc, fontFamily, normalize, layout, y, {
    title: page.brand,
    subtitleLines: [
      'Linhas ordenadas · uma coluna por apresentação (GL, LT, BD…)',
      `${mainLines.length} linhas · ${mainLines.reduce((s, l) => s + l.skus, 0)} SKUs${outrosNote}`,
    ],
    kpiLabel: 'MARCA',
    kpiValue: page.brand,
    kpiNotes: ['Descrições completas · sem corte'],
  });
  ctx.y = y;

  y = drawSectionTitle(doc, fontFamily, normalize, M, y + LAYOUT.blockGapBefore, 'Resumo das linhas') + LAYOUT.titleToTable;
  const summaryRows = mainLines.map((l) => ({
    linha: l.name,
    cores: String(l.colors),
    skus: String(l.skus),
    gl: priceRange(l.price_gl),
    lt: priceRange(l.price_lt),
    bd: priceRange(l.price_bd),
  }));

  const summaryColumns = [
    { key: 'linha', label: 'LINHA', width: 0.28, align: 'left', wrap: true },
    { key: 'cores', label: 'ITENS', width: 0.08, align: 'center', wrap: false },
    { key: 'skus', label: 'SKUs', width: 0.08, align: 'center', wrap: false },
    { key: 'gl', label: 'GL', width: 0.18, align: 'right', wrap: false, price: true },
    { key: 'lt', label: 'LT', width: 0.18, align: 'right', wrap: false, price: true },
    { key: 'bd', label: 'BD / kg', width: 0.20, align: 'right', wrap: false, price: true },
  ];
  const summaryH = estimateWrappedTableHeight(doc, fontFamily, summaryColumns, summaryRows, CW);
  y = ensureSpace(doc, y, summaryH + 10, newPage);
  y = drawWrappedGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: summaryColumns,
    rows: summaryRows,
  }) + LAYOUT.sectionGapBetween;
  ctx.y = y;

  mainLines.forEach((line, idx) => {
    renderLineUnfold(doc, fontFamily, normalize, line, idx, ctx);
  });
}

function renderIquineAnexo(doc, fontFamily, normalize, line) {
  doc.addPage('a4', 'landscape');
  const layout = getPageLayout(doc);
  const { M, CW } = layout;
  let y = M;

  y = drawPageHeroHeader(doc, fontFamily, normalize, layout, y, {
    title: 'Anexo — Iquine · outros produtos',
    subtitleLines: [
      'Colas, massas, bases, limpa fácil e demais itens fora das linhas de tinta',
      `${line.skus} SKUs · ${line.colors} itens na tabela CCG`,
    ],
    kpiLabel: 'SEÇÃO',
    kpiValue: 'Outros',
    kpiNotes: ['Ordenado por descrição · coluna por apresentação'],
  });

  const presentations = collectPresentations(line.colors_detail);
  const descWidth = presentations.length > 7 ? 0.34 : 0.30;
  const columns = buildPresentationColumns(presentations, { descWidth });
  const rows = buildPresentationRows(line.colors_detail, presentations);

  y = drawSectionTitle(doc, fontFamily, normalize, M, y + LAYOUT.blockGapBefore, 'Lista completa') + LAYOUT.titleToTable;

  const chunkSize = 14;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    let layoutNow = getPageLayout(doc);
    const tableH = estimateWrappedTableHeight(doc, fontFamily, columns, chunk, layoutNow.CW);
    if (y + tableH > layoutNow.pageH - FOOTER_RESERVE) {
      doc.addPage('a4', 'landscape');
      layoutNow = getPageLayout(doc);
      y = layoutNow.M;
      if (i > 0) {
        y = drawSectionTitle(doc, fontFamily, normalize, layoutNow.M, y, 'Lista completa (continuação)') + LAYOUT.titleToTable;
      }
    }
    y = drawWrappedGridTable(doc, fontFamily, {
      x: layoutNow.M,
      y,
      width: layoutNow.CW,
      columns,
      rows: chunk,
    }) + LAYOUT.sectionGapBetween;
  }
}

export async function generateDossieTintasCcgPdf(data) {
  const pagePlan = buildPages(data);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfBarlowFonts(doc);

  renderOverlapPage(doc, fontFamily, normalizePdfText, getPageLayout(doc), pagePlan[0]);

  for (const plan of pagePlan.slice(1)) {
    if (plan.type === 'brand') {
      doc.addPage('a4', 'portrait');
      renderBrandPages(doc, fontFamily, normalizePdfText, plan);
    } else if (plan.type === 'iquine_anexo') {
      renderIquineAnexo(doc, fontFamily, normalizePdfText, plan.line);
    }
  }

  const finalTotal = doc.getNumberOfPages();
  for (let p = 1; p <= finalTotal; p += 1) {
    doc.setPage(p);
    drawPageFooter(doc, fontFamily, normalizePdfText, p, finalTotal, 'Dossiê tintas CCG');
  }

  const bytes = doc.output('arraybuffer');
  return { data: new Uint8Array(bytes), build: PDF_BUILD, pages: finalTotal };
}
