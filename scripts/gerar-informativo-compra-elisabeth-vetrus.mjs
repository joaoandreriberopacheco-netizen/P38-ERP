#!/usr/bin/env node
/**
 * Informativo de compra — pedido 9H2-57F (Vetrus) · cliente Elisabeth Prieto Navas
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
const M2_POR_CAIXA = 2.38;
const DATA_DOCUMENTO = '13/03/2026';

const META = {
  cliente: 'Elisabeth Prieto Navas',
  pedido: '9H2-57F',
  embarque: '9H2-57F-01',
  fornecedor: 'VETRUS DO BRASIL',
};

/** Nomes comerciais usados com a cliente → produto do embarque → destino da obra */
const LINHAS = [
  {
    modeloCliente: 'Galícia',
    produto: 'REV 34X50 EURO GALICIA MARROM EXT.',
    destino: 'Jacuzzis',
    m2: 99.96,
  },
  {
    modeloCliente: 'Taipa',
    produto: 'REV. 34X50 FILETO RÚSTICO - MIX',
    destino: 'Habitaciones (quartos)',
    m2: 199.92,
  },
  {
    modeloCliente: 'Calcário',
    produto: 'REV. 34X50 FILETO PIETRA CLARO',
    destino: 'Áreas comuns e locais comerciais',
    m2: 199.92,
  },
  {
    modeloCliente: 'Medice',
    produto: 'REV. 34X50 FILETO DINAMARCA MIX',
    destino: 'Paredes do banheiro',
    m2: 199.92,
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

function prepareLinhas() {
  return LINHAS.map((linha) => {
    const caixas = Math.round((linha.m2 / M2_POR_CAIXA) * 100) / 100;
    const caixasInt = Math.round(linha.m2 / M2_POR_CAIXA);
    const total = Math.round(linha.m2 * PRECO_M2 * 100) / 100;
    return { ...linha, caixas: caixasInt, m2Fmt: brNum(linha.m2), total, totalFmt: brl(total) };
  });
}

function drawTableHeader(doc, font, y, col) {
  doc.setFont(font, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(72, 72, 72);
  doc.text('MODELO', col.modelo, y);
  doc.text('PRODUTO', col.produto, y);
  doc.text('DESTINO / USO', col.destino, y);
  doc.text('R$/M²', col.preco, y, { align: 'right' });
  doc.text('CAIXAS', col.caixas, y, { align: 'right' });
  doc.text('M²', col.m2, y, { align: 'right' });
  doc.text('TOTAL', col.total, y, { align: 'right' });
  const lineY = y + 2;
  doc.setDrawColor(110, 110, 110);
  doc.setLineWidth(0.15);
  doc.line(col.left, lineY, col.right, lineY);
  return lineY + 5;
}

function splitLines(doc, text, width, fontSize, font) {
  doc.setFont(font, 'normal');
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(normalizePdfText(text), width);
}

function measureRowHeight(doc, row, font, col) {
  const blocks = [
    splitLines(doc, row.modeloCliente, col.modeloW, 9, font),
    splitLines(doc, row.produto, col.produtoW, 8.2, font),
    splitLines(doc, row.destino, col.destinoW, 8.2, font),
  ];
  const lines = Math.max(...blocks.map((b) => b.length), 1);
  return 4 + lines * 4.2;
}

function drawRow(doc, row, font, y, col) {
  const rowH = measureRowHeight(doc, row, font, col);
  const modeloLines = splitLines(doc, row.modeloCliente, col.modeloW, 9, font);
  const produtoLines = splitLines(doc, row.produto, col.produtoW, 8.2, font);
  const destinoLines = splitLines(doc, row.destino, col.destinoW, 8.2, font);

  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(modeloLines, col.modelo, y);

  doc.setFont(font, 'normal');
  doc.setFontSize(8.2);
  doc.text(produtoLines, col.produto, y);
  doc.text(destinoLines, col.destino, y);

  doc.setFontSize(8.8);
  doc.text(brl(PRECO_M2), col.preco, y, { align: 'right' });
  doc.text(String(row.caixas), col.caixas, y, { align: 'right' });
  doc.text(row.m2Fmt, col.m2, y, { align: 'right' });
  doc.setFont(font, 'bold');
  doc.text(row.totalFmt, col.total, y, { align: 'right' });

  const bottom = y + rowH - 1;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.08);
  doc.line(col.left, bottom, col.right, bottom);
  return bottom + 2.5;
}

export async function generateInformativoCompraElisabethPdf(outputPath) {
  const linhas = prepareLinhas();
  const totalM2 = linhas.reduce((acc, l) => acc + l.m2, 0);
  const totalCaixas = linhas.reduce((acc, l) => acc + l.caixas, 0);
  const totalGeral = linhas.reduce((acc, l) => acc + l.total, 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const M = 14;
  const col = {
    left: M,
    right: pageW - M,
    modelo: M,
    modeloW: 18,
    produto: M + 20,
    produtoW: 52,
    destino: M + 74,
    destinoW: 48,
    preco: pageW - M - 44,
    caixas: pageW - M - 34,
    m2: pageW - M - 22,
    total: pageW - M,
  };

  let y = 18;
  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(normalizePdfText('INFORMATIVO DE COMPRA'), M, y);

  y += 8;
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(72, 72, 72);
  doc.text(normalizePdfText(`Data: ${DATA_DOCUMENTO}`), M, y);
  doc.text(normalizePdfText(`Cliente: ${META.cliente}`), M, y + 5);
  doc.text(normalizePdfText(`Fornecedor: ${META.fornecedor}`), M, y + 10);
  doc.text(normalizePdfText(`Pedido / Embarque: ${META.pedido} · ${META.embarque}`), M, y + 15);

  y += 24;
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(normalizePdfText('Revestimentos 34×50 cm · 2,38 m² por caixa'), M, y);

  y += 6;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(72, 72, 72);
  doc.text(
    normalizePdfText('Valores de venda acordados com a cliente. Preço único de R$ 76,00/m² em todos os modelos.'),
    M,
    y,
  );

  y += 8;
  y = drawTableHeader(doc, font, y, col);
  for (const linha of linhas) {
    y = drawRow(doc, linha, font, y, col);
  }

  y += 4;
  doc.setDrawColor(110, 110, 110);
  doc.setLineWidth(0.2);
  doc.line(M, y, pageW - M, y);
  y += 7;

  doc.setFont(font, 'bold');
  doc.setFontSize(10.5);
  doc.text(normalizePdfText('TOTAIS'), M, y);
  doc.text(normalizePdfText(`${totalCaixas} caixas`), col.caixas, y, { align: 'right' });
  doc.text(brNum(totalM2), col.m2, y, { align: 'right' });
  doc.text(brl(totalGeral), col.total, y, { align: 'right' });

  y += 10;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(72, 72, 72);
  const nota = normalizePdfText(
    'Documento informativo para registo da operação comercial. Não substitui nota fiscal nem pedido de venda formal.',
  );
  const notaLines = doc.splitTextToSize(nota, pageW - M * 2);
  doc.text(notaLines, M, y);

  const pdfBytes = doc.output('arraybuffer');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(pdfBytes));
  return { outputPath, totalM2, totalCaixas, totalGeral, linhas };
}

async function main() {
  const defaultOut = path.join(ROOT, 'docs', 'exports', 'informativo-compra-elisabeth-vetrus-9h2-13-03-2026.pdf');
  const artifactOut = '/opt/cursor/artifacts/informativo-compra-elisabeth-vetrus-9h2-13-03-2026.pdf';
  const outArg = process.argv[2];

  const result = await generateInformativoCompraElisabethPdf(outArg || defaultOut);
  if (!outArg) {
    await generateInformativoCompraElisabethPdf(artifactOut);
  }

  console.log('PDF gerado:', result.outputPath);
  if (!outArg) console.log('Cópia em:', artifactOut);
  console.log('Totais:', result.totalCaixas, 'caixas |', brNum(result.totalM2), 'm² |', brl(result.totalGeral));
  for (const l of result.linhas) {
    console.log(`- ${l.modeloCliente}: ${l.caixas} cx | ${l.m2Fmt} m² | ${l.destino}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
