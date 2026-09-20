import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts } from '@/lib/jspdfNotoFont';

export const CATALOG_TAG_WIDTH_MM = 43;
export const CATALOG_TAG_HEIGHT_MM = 48;
export const CATALOG_TAGS_PER_PAGE = 20;
export const CATALOG_TAG_GAP_MM = 0;

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const COLUMNS = 4;
const ROWS = 5;
const GRID_WIDTH_MM = COLUMNS * CATALOG_TAG_WIDTH_MM;
const GRID_HEIGHT_MM = ROWS * CATALOG_TAG_HEIGHT_MM;
const START_X_MM = (A4_WIDTH_MM - GRID_WIDTH_MM) / 2;
const START_Y_MM = (A4_HEIGHT_MM - GRID_HEIGHT_MM) / 2;
const CATEGORY_MARKER_X_MM = START_X_MM / 2;
const CATEGORY_LABEL_X_MM = CATEGORY_MARKER_X_MM - 2.2;

export const getCatalogTagCode = (produto) => {
  const codigo = produto?.codigo_interno || produto?.codigo_barras || '';
  return String(codigo || '').trim();
};

export const getCatalogTagDescription = (produto) => {
  const descricao = produto?.nome || '';
  return String(descricao || '').trim();
};

const getCatalogTagCategory = (produto) => {
  const categoria = produto?.categoria_nome || '';
  return String(categoria || '').trim();
};

const collator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

export const sortCatalogTagProducts = (products = []) => {
  if (!Array.isArray(products)) return [];

  return [...products].sort((a, b) => {
    const categoryCompare = collator.compare(getCatalogTagCategory(a), getCatalogTagCategory(b));
    if (categoryCompare !== 0) return categoryCompare;

    const descriptionCompare = collator.compare(getCatalogTagDescription(a), getCatalogTagDescription(b));
    if (descriptionCompare !== 0) return descriptionCompare;

    return collator.compare(getCatalogTagCode(a), getCatalogTagCode(b));
  });
};

const normalizePdfText = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...');

const categoryMarkerKey = (produto) => getCatalogTagCategory(produto).toLocaleLowerCase('pt-BR');

function buildPageCategoryMarkers(pageProducts = []) {
  if (!pageProducts.length) return [];

  const markers = [];
  let startSlot = 0;
  let currentKey = categoryMarkerKey(pageProducts[0]);
  let currentLabel = getCatalogTagCategory(pageProducts[0]) || 'Sem categoria';

  for (let slot = 1; slot < pageProducts.length; slot += 1) {
    const nextKey = categoryMarkerKey(pageProducts[slot]);
    if (nextKey === currentKey) continue;

    markers.push({
      label: currentLabel,
      rowStart: Math.floor(startSlot / COLUMNS),
      rowEnd: Math.floor((slot - 1) / COLUMNS),
    });
    startSlot = slot;
    currentKey = nextKey;
    currentLabel = getCatalogTagCategory(pageProducts[slot]) || 'Sem categoria';
  }

  markers.push({
    label: currentLabel,
    rowStart: Math.floor(startSlot / COLUMNS),
    rowEnd: Math.floor((pageProducts.length - 1) / COLUMNS),
  });

  return markers;
}

function drawCategoryMarginMarker(doc, marker) {
  const yTop = START_Y_MM + marker.rowStart * CATALOG_TAG_HEIGHT_MM + 0.9;
  const yBottom = START_Y_MM + (marker.rowEnd + 1) * CATALOG_TAG_HEIGHT_MM - 0.9;
  const normalizedLabel = normalizePdfText(marker.label || 'Sem categoria')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  const availableHeight = Math.max(8, yBottom - yTop - 2.4);
  const labelX = CATEGORY_LABEL_X_MM;
  const labelY = (yTop + yBottom) / 2;
  const maxTextLength = availableHeight - 0.8;
  const minFontSize = 4.6;

  doc.setDrawColor(74, 82, 64);
  doc.setLineWidth(0.18);
  doc.line(CATEGORY_MARKER_X_MM, yTop, CATEGORY_MARKER_X_MM, yBottom);

  doc.setFont('DIN1451', 'bold');
  let fontSize = 8.4;
  let labelText = normalizedLabel || 'SEM CATEGORIA';
  doc.setFontSize(fontSize);

  while (fontSize > minFontSize && doc.getTextWidth(labelText) > maxTextLength) {
    fontSize -= 0.2;
    doc.setFontSize(fontSize);
  }

  // Se ainda não couber no mínimo, corta com reticências para evitar sobreposição.
  if (doc.getTextWidth(labelText) > maxTextLength) {
    while (labelText.length > 3 && doc.getTextWidth(`${labelText}…`) > maxTextLength) {
      labelText = labelText.slice(0, -1);
    }
    labelText = `${labelText}…`;
  }

  doc.setTextColor(74, 82, 64);
  doc.text(labelText, labelX, labelY, {
    align: 'center',
    baseline: 'middle',
    angle: 90,
  });
}

function fitDescription(doc, description, maxWidth) {
  let fontSize = 10.5;
  let lines = [];

  while (fontSize >= 7.5) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(description, maxWidth);
    if (lines.length <= 4) break;
    fontSize -= 0.5;
  }

  if (lines.length > 4) {
    lines = lines.slice(0, 4);
    let lastLine = String(lines[3] || '');
    while (lastLine.length > 1 && doc.getTextWidth(`${lastLine}...`) > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[3] = `${lastLine.trimEnd()}...`;
  }

  return { fontSize, lines };
}

function drawCatalogTag(doc, produto, x, y) {
  const description = normalizePdfText(getCatalogTagDescription(produto) || 'SEM DESCRIÇÃO');
  const code = normalizePdfText(getCatalogTagCode(produto) || 'SEM CÓDIGO');
  const centerX = x + CATALOG_TAG_WIDTH_MM / 2;

  doc.setDrawColor(100, 100, 100);
  doc.setLineDashPattern([0.7, 0.7], 0);
  doc.circle(centerX, y + 5, 1.65, 'S');
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  const { fontSize, lines } = fitDescription(doc, description, CATALOG_TAG_WIDTH_MM - 7);
  const lineHeightMm = fontSize * 0.3528 * 1.12;
  const descriptionAreaTop = y + 12;
  const descriptionAreaHeight = 23;
  const textHeight = lines.length * lineHeightMm;
  const firstBaseline = descriptionAreaTop + (descriptionAreaHeight - textHeight) / 2 + lineHeightMm * 0.78;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(fontSize);
  lines.forEach((line, index) => {
    doc.text(String(line), centerX, firstBaseline + index * lineHeightMm, { align: 'center' });
  });

  doc.setDrawColor(205, 205, 205);
  doc.setLineWidth(0.15);
  doc.line(x + 6, y + 38, x + CATALOG_TAG_WIDTH_MM - 6, y + 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(55, 65, 81);
  const codeLines = doc.splitTextToSize(code, CATALOG_TAG_WIDTH_MM - 6).slice(0, 2);
  const codeStartY = codeLines.length > 1 ? y + 41 : y + 43;
  codeLines.forEach((line, index) => {
    doc.text(String(line), centerX, codeStartY + index * 3.8, { align: 'center' });
  });
}

function drawCatalogTagCutLines(doc, x, y, row, column) {
  const right = x + CATALOG_TAG_WIDTH_MM;
  const bottom = y + CATALOG_TAG_HEIGHT_MM;

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);

  // Cada aresta é desenhada uma única vez: direita/baixo da célula atual,
  // mais o topo da primeira linha e a esquerda da primeira coluna.
  if (row === 0) doc.line(x, y, right, y);
  if (column === 0) doc.line(x, y, x, bottom);
  doc.line(right, y, right, bottom);
  doc.line(x, bottom, right, bottom);
}

export async function generateCatalogTagsPdf({ products = [], filtrosResumo = '' } = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Nenhum produto para gerar etiquetas.');
  }

  const sortedProducts = sortCatalogTagProducts(products);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.setProperties({
    title: 'Etiquetas do catálogo',
    subject: normalizePdfText(filtrosResumo || 'Produtos filtrados do catálogo'),
    creator: 'P38 ERP',
  });

  await registerJsPdfDin1451Fonts(doc);

  for (let pageStart = 0; pageStart < sortedProducts.length; pageStart += CATALOG_TAGS_PER_PAGE) {
    if (pageStart > 0) {
      doc.addPage('a4', 'portrait');
    }

    const pageProducts = sortedProducts.slice(pageStart, pageStart + CATALOG_TAGS_PER_PAGE);
    const pageMarkers = buildPageCategoryMarkers(pageProducts);
    pageMarkers.forEach((marker) => drawCategoryMarginMarker(doc, marker));

    pageProducts.forEach((produto, pageIndex) => {
      const column = pageIndex % COLUMNS;
      const row = Math.floor(pageIndex / COLUMNS);
      const x = START_X_MM + column * CATALOG_TAG_WIDTH_MM;
      const y = START_Y_MM + row * CATALOG_TAG_HEIGHT_MM;
      drawCatalogTagCutLines(doc, x, y, row, column);
      drawCatalogTag(doc, produto, x, y);
    });
  }

  return doc.output('blob');
}
