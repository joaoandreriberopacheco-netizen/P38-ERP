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
  faint: [140, 140, 140],
  line: [210, 210, 210],
  headerFill: [245, 245, 245],
  cardFill: [252, 252, 252],
  cardFillAlt: [248, 248, 248],
  accent: [34, 34, 34],
  totalFill: [238, 238, 238],
};

/** Pedido 8YU-MLP — embarque 01 */
const LINHAS = [
  {
    modeloCliente: 'Medice',
    produto: 'Porcelanato 76×76 Ret Medici Act White',
    destino: 'Paredes do banheiro',
    m2: 221.44,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Taipa',
    produto: 'Porcelanato 76×76 Ret Solo Mate Taipa',
    destino: 'Habitaciones (quartos)',
    m2: 318.32,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Calcário',
    produto: 'Porcelanato 76×76 Ret Solo Mate Calcário',
    destino: 'Áreas comuns e locais comerciais',
    m2: 226.63,
    m2PorCaixa: 1.73,
  },
  {
    modeloCliente: 'Galícia',
    produto: 'Rev 34×50 Euro Galicia Marrom Ext.',
    destino: 'Jacuzzis',
    m2: 52.36,
    m2PorCaixa: 2.38,
  },
  {
    modeloCliente: 'Slate',
    produto: 'Porcelanato 60×120 Ret Slate Soft AS Bege',
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

function measureCardHeight(doc, font, row, innerW) {
  let h = 10;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  const produtoLines = doc.splitTextToSize(normalizePdfText(row.produto), innerW);
  h += produtoLines.length * 4.1;
  if (row.destino) {
    doc.setFontSize(8.2);
    const destinoLines = doc.splitTextToSize(normalizePdfText(row.destino), innerW);
    h += 1.5 + destinoLines.length * 3.8;
  }
  h += 9;
  return h;
}

function drawCard(doc, font, row, y, layout, index) {
  const { left, right, width } = layout;
  const innerPad = 5;
  const innerW = width - innerPad * 2;
  const cardH = measureCardHeight(doc, font, row, innerW);
  const fill = index % 2 === 0 ? PALETTE.cardFill : PALETTE.cardFillAlt;

  setFill(doc, fill);
  setStroke(doc, PALETTE.line, 0.15);
  doc.roundedRect(left, y, width, cardH, 2, 2, 'FD');

  let cy = y + 6.5;
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText(row.modeloCliente.toUpperCase()), left + innerPad, cy);

  doc.setFont(font, 'bold');
  doc.setFontSize(10.5);
  doc.text(row.totalFmt, right - innerPad, cy, { align: 'right' });

  cy += 5.5;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  setText(doc, PALETTE.muted);
  const produtoLines = doc.splitTextToSize(normalizePdfText(row.produto), innerW);
  doc.text(produtoLines, left + innerPad, cy);
  cy += produtoLines.length * 4.1;

  if (row.destino) {
    cy += 1.2;
    doc.setFont(font, 'normal');
    doc.setFontSize(8.2);
    setText(doc, PALETTE.faint);
    const destinoLines = doc.splitTextToSize(normalizePdfText(row.destino), innerW);
    doc.text(destinoLines, left + innerPad, cy);
    cy += destinoLines.length * 3.8;
  }

  cy += 3.5;
  setStroke(doc, PALETTE.line, 0.08);
  doc.line(left + innerPad, cy, right - innerPad, cy);
  cy += 4.5;

  doc.setFont(font, 'normal');
  doc.setFontSize(8.4);
  setText(doc, PALETTE.muted);
  const metrics = [
  `${row.caixas} caixas`,
  `${row.m2Fmt} m²`,
  `${brl(PRECO_M2)}/m²`,
  ];
  const metricText = metrics.join('   ·   ');
  doc.text(normalizePdfText(metricText), left + innerPad, cy);

  return y + cardH + 3.5;
}

function drawMetaBlock(doc, font, y, layout) {
  const { left, right, width } = layout;
  const blockH = 22;

  setFill(doc, PALETTE.headerFill);
  setStroke(doc, PALETTE.line, 0.15);
  doc.roundedRect(left, y, width, blockH, 2, 2, 'FD');

  const colMid = left + width / 2;
  const textY = y + 8;

  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  setText(doc, PALETTE.faint);
  doc.text(normalizePdfText('CLIENTE'), left + 5, textY);
  doc.text(normalizePdfText('DATA'), colMid + 5, textY);
  doc.text(normalizePdfText('REFERÊNCIA'), right - 5, textY, { align: 'right' });

  doc.setFont(font, 'bold');
  doc.setFontSize(9.5);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText(META.cliente), left + 5, textY + 5.5);
  doc.text(normalizePdfText(DATA_DOCUMENTO), colMid + 5, textY + 5.5);
  doc.text(normalizePdfText(`${META.pedido} · ${META.embarque}`), right - 5, textY + 5.5, { align: 'right' });

  return y + blockH + 8;
}

function drawTotalsBox(doc, font, y, layout, totals) {
  const { left, right, width } = layout;
  const boxH = 18;

  setFill(doc, PALETTE.totalFill);
  setStroke(doc, PALETTE.accent, 0.35);
  doc.roundedRect(left, y, width, boxH, 2, 2, 'FD');

  doc.setFont(font, 'bold');
  doc.setFontSize(10);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText('TOTAL GERAL'), left + 5, y + 7);

  doc.setFont(font, 'normal');
  doc.setFontSize(8.6);
  setText(doc, PALETTE.muted);
  doc.text(
    normalizePdfText(`${totals.totalCaixas} caixas   ·   ${brNum(totals.totalM2)} m²   ·   ${brl(PRECO_M2)}/m²`),
    left + 5,
    y + 12.5,
  );

  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  setText(doc, PALETTE.ink);
  doc.text(brl(totals.totalGeral), right - 5, y + 10.5, { align: 'right' });

  return y + boxH + 8;
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
  const M = 16;
  const layout = { left: M, right: pageW - M, width: pageW - M * 2 };

  let y = 18;

  doc.setFont(font, 'bold');
  doc.setFontSize(20);
  setText(doc, PALETTE.ink);
  doc.text(normalizePdfText('Informativo de Compra'), M, y);

  y += 5;
  setStroke(doc, PALETTE.accent, 0.5);
  doc.line(M, y, pageW - M, y);

  y += 7;
  doc.setFont(font, 'normal');
  doc.setFontSize(9.5);
  setText(doc, PALETTE.muted);
  doc.text(
    normalizePdfText('Relação de materiais, quantidades e valores acordados.'),
    M,
    y,
  );

  y += 8;
  y = drawMetaBlock(doc, font, y, layout);

  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  setText(doc, PALETTE.muted);
  doc.text(normalizePdfText('ITENS'), M, y);
  y += 5;

  for (let i = 0; i < linhas.length; i += 1) {
    const cardH = measureCardHeight(doc, font, linhas[i], layout.width - 10);
    if (y + cardH > pageH - 36) {
      doc.addPage();
      y = 18;
    }
    y = drawCard(doc, font, linhas[i], y, layout, i);
  }

  if (y + 26 > pageH - 14) {
    doc.addPage();
    y = 18;
  }

  y = drawTotalsBox(doc, font, y, layout, { totalM2, totalCaixas, totalGeral });

  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  setText(doc, PALETTE.faint);
  const nota = normalizePdfText(
    'Documento informativo. Não substitui nota fiscal nem pedido de venda formal.',
  );
  doc.text(nota, M, pageH - 10);

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
