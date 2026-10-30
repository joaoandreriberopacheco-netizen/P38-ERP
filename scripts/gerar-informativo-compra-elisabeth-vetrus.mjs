#!/usr/bin/env node
/**
 * Informativo de compra — pedido 8YU-MLP · cliente Elisabeth Prieto Navas
 *
 * Uso: node scripts/gerar-informativo-compra-elisabeth-vetrus.mjs [caminho-saida.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PRECO_M2 = 76;
const DATA_DOCUMENTO = '13/03/2026';

const META = {
  cliente: 'Elisabeth Prieto Navas',
  pedido: '8YU-MLP',
  embarque: '8YU-MLP-01',
};

const PALETTE = {
  ink: [24, 24, 24],
  muted: [92, 92, 92],
  faint: [130, 130, 130],
  line: [205, 205, 205],
  headerFill: [242, 242, 242],
  rowAlt: [250, 250, 250],
  accent: [34, 34, 34],
  totalFill: [235, 235, 235],
};

const LINHAS = [
  {
    modeloCliente: 'Medice',
    produto: 'Porcelanato 76×76 Medici Act White',
    destino: 'Paredes do banheiro',
    m2: 221.44,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Taipa',
    produto: 'Porcelanato 76×76 Solo Mate Taipa',
    destino: 'Habitaciones (quartos)',
    m2: 318.32,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Calcário',
    produto: 'Porcelanato 76×76 Solo Mate Calcário',
    destino: 'Áreas comuns e locais comerciais',
    m2: 226.63,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Galícia',
    produto: 'Rev 34×50 Galicia Marrom Ext.',
    destino: 'Jacuzzis',
    m2: 52.36,
    m2PorCaixa: 2.38,
  },
  {
    modeloCliente: 'Slate',
    produto: 'Porcelanato 60×120 Slate Soft AS Bege',
    destino: '',
    m2: 51.84,
    m2PorCaixa: 1.44,
  },
];

const NOTO_REGULAR_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const NOTO_BOLD_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

function normalizePdfText(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFC')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

async function loadFontBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao carregar fonte: ${url}`);
  return arrayBufferToBase64(await response.arrayBuffer());
}

async function registerFonts(doc) {
  try {
    const [regular, bold] = await Promise.all([
      loadFontBase64(NOTO_REGULAR_URL),
      loadFontBase64(NOTO_BOLD_URL),
    ]);
    doc.addFileToVFS('NotoSans-Regular.ttf', regular);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', bold);
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    doc.setFont('NotoSans', 'normal');
    return 'NotoSans';
  } catch {
    doc.setFont('helvetica', 'normal');
    return 'helvetica';
  }
}

function brl(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function brNum(value, digits = 2) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function setFill(doc, rgb) {
  doc.setFillColor(...rgb);
}

function setStroke(doc, rgb, width = 0.2) {
  doc.setDrawColor(...rgb);
  doc.setLineWidth(width);
}

function setText(doc, rgb) {
  doc.setTextColor(...rgb);
}

function buildColumns(pageW, margin) {
  const left = margin;
  const right = pageW - margin;
  return {
    left,
    right,
    modelo: left,
    modeloW: 17,
    desc: left + 18,
    descW: 78,
    preco: right - 62,
    caixas: right - 48,
    m2: right - 32,
    total: right,
  };
}

function prepareLinhas() {
  return LINHAS.map((linha) => {
    const caixasInt = Math.round(linha.m2 / linha.m2PorCaixa);
    const total = Math.round(linha.m2 * PRECO_M2 * 100) / 100;
    return {
      ...linha,
      caixas: caixasInt,
      m2Fmt: brNum(linha.m2),
      total,
      totalFmt: brl(total),
      destino: linha.destino || '',
    };
  });
}

function splitText(doc, font, style, size, text, width) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  return doc.splitTextToSize(normalizePdfText(text), width);
}

function measureRowHeight(doc, font, row, col) {
  const produtoLines = splitText(doc, font, 'normal', 7.6, row.produto, col.descW);
  let lines = produtoLines.length;
  if (row.destino) {
    const destinoLines = splitText(doc, font, 'normal', 7, row.destino, col.descW);
    lines += destinoLines.length;
  }
  return Math.max(7.5, 3.5 + lines * 3.5 + (row.destino ? 1 : 0));
}

function drawMetaBlock(doc, font, y, col) {
  const blockH = 18;
  setFill(doc, PALETTE.headerFill);
  setStroke(doc, PALETTE.line, 0.12);
  doc.rect(col.left, y, col.right - col.left, blockH, 'FD');

  const mid = col.left + (col.right - col.left) / 2;
  const ty = y + 6.5;

  doc.setFont(font, 'normal');
  doc.setFontSize(6.8);
  setText(doc, PALETTE.faint);
  doc.text('CLIENTE', col.left + 4, ty);
  doc.text('DATA', mid, ty);
  doc.text('REFERÊNCIA', col.right - 4, ty, { align: 'right' });

  doc.setFont(font, 'bold');
  doc.setFontSize(8.8);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText(META.cliente), col.left + 4, ty + 4.5);
  doc.text(normalizePdfText(DATA_DOCUMENTO), mid, ty + 4.5);
  doc.text(normalizePdfText(`${META.pedido} · ${META.embarque}`), col.right - 4, ty + 4.5, { align: 'right' });

  return y + blockH + 7;
}

function drawTableHeader(doc, font, y, col) {
  const headerH = 7.5;
  setFill(doc, PALETTE.headerFill);
  setStroke(doc, PALETTE.line, 0.12);
  doc.rect(col.left, y - 4.5, col.right - col.left, headerH, 'F');

  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  setText(doc, PALETTE.muted);
  doc.text('MODELO', col.modelo, y);
  doc.text('PRODUTO / DESTINO', col.desc, y);
  doc.text('R$/M²', col.preco, y, { align: 'right' });
  doc.text('CX', col.caixas, y, { align: 'right' });
  doc.text('M²', col.m2, y, { align: 'right' });
  doc.text('TOTAL', col.total, y, { align: 'right' });

  setStroke(doc, PALETTE.accent, 0.25);
  doc.line(col.left, y + 1.8, col.right, y + 1.8);
  return y + 5.5;
}

function drawTableRow(doc, font, row, y, col, index) {
  const rowH = measureRowHeight(doc, font, row, col);
  const top = y - 3.2;

  if (index % 2 === 1) {
    setFill(doc, PALETTE.rowAlt);
    doc.rect(col.left, top, col.right - col.left, rowH, 'F');
  }

  doc.setFont(font, 'bold');
  doc.setFontSize(7.8);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText(row.modeloCliente), col.modelo, y);

  let descY = y;
  const produtoLines = splitText(doc, font, 'normal', 7.6, row.produto, col.descW);
  setText(doc, PALETTE.ink);
  doc.text(produtoLines, col.desc, descY);
  descY += produtoLines.length * 3.5;

  if (row.destino) {
    const destinoLines = splitText(doc, font, 'normal', 7, row.destino, col.descW);
    setText(doc, PALETTE.faint);
    doc.text(destinoLines, col.desc, descY + 0.5);
  }

  doc.setFont(font, 'normal');
  doc.setFontSize(7.6);
  setText(doc, PALETTE.ink);
  doc.text(brNum(PRECO_M2), col.preco, y, { align: 'right' });
  doc.text(String(row.caixas), col.caixas, y, { align: 'right' });
  doc.text(row.m2Fmt, col.m2, y, { align: 'right' });

  doc.setFont(font, 'bold');
  doc.text(row.totalFmt, col.total, y, { align: 'right' });

  setStroke(doc, PALETTE.line, 0.08);
  doc.line(col.left, top + rowH, col.right, top + rowH);

  return y + rowH - 1.5;
}

function drawTableFooter(doc, font, y, col, totals) {
  const footerH = 9;
  setFill(doc, PALETTE.totalFill);
  setStroke(doc, PALETTE.accent, 0.2);
  doc.rect(col.left, y - 4, col.right - col.left, footerH, 'FD');

  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  setText(doc, PALETTE.ink);
  doc.text('TOTAIS', col.modelo, y);
  doc.text(String(totals.totalCaixas), col.caixas, y, { align: 'right' });
  doc.text(brNum(totals.totalM2), col.m2, y, { align: 'right' });
  doc.setFontSize(8.8);
  doc.text(brl(totals.totalGeral), col.total, y, { align: 'right' });

  return y + footerH;
}

export async function generateInformativoCompraElisabethPdf(outputPath) {
  const linhas = prepareLinhas();
  const totalM2 = linhas.reduce((acc, l) => acc + l.m2, 0);
  const totalCaixas = linhas.reduce((acc, l) => acc + l.caixas, 0);
  const totalGeral = linhas.reduce((acc, l) => acc + l.total, 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const col = buildColumns(pageW, M);

  let y = 16;

  doc.setFont(font, 'bold');
  doc.setFontSize(17);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText('Informativo de Compra'), M, y);

  y += 4.5;
  setStroke(doc, PALETTE.accent, 0.4);
  doc.line(M, y, pageW - M, y);

  y += 6;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  setText(doc, PALETTE.muted);
  doc.text(normalizePdfText('Materiais, quantidades e valores acordados · R$ 76,00/m²'), M, y);

  y += 7;
  y = drawMetaBlock(doc, font, y, col);
  y = drawTableHeader(doc, font, y, col);

  for (let i = 0; i < linhas.length; i += 1) {
    y = drawTableRow(doc, font, linhas[i], y, col, i);
  }

  y += 2;
  y = drawTableFooter(doc, font, y, col, { totalM2, totalCaixas, totalGeral });

  doc.setFont(font, 'normal');
  doc.setFontSize(7);
  setText(doc, PALETTE.faint);
  doc.text(
    normalizePdfText('Documento informativo. Não substitui nota fiscal nem pedido de venda formal.'),
    M,
    pageH - 9,
  );

  const pdfBytes = doc.output('arraybuffer');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  return { outputPath, totalM2, totalCaixas, totalGeral, linhas };
}

const OUTPUT_BASENAME = 'informativo-compra-elisabeth-vetrus-8yu-mlp-13-03-2026.pdf';

async function main() {
  const defaultOut = path.join(ROOT, 'docs', 'exports', OUTPUT_BASENAME);
  const artifactOut = path.join('/opt/cursor/artifacts', OUTPUT_BASENAME);
  const outArg = process.argv[2];

  const result = await generateInformativoCompraElisabethPdf(outArg || defaultOut);
  if (!outArg) {
    await generateInformativoCompraElisabethPdf(artifactOut);
  }

  console.log('PDF gerado:', result.outputPath);
  if (!outArg) console.log('Cópia em:', artifactOut);
  console.log('Totais:', result.totalCaixas, 'caixas |', brNum(result.totalM2), 'm² |', brl(result.totalGeral));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
