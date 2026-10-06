/**
 * PDF A4 comercial com texto seleccionável (jsPDF) — espelha DocumentoComercialA4.jsx.
 */
import {
  buildResumoDocumentoComercial,
  fmtDataDocumento,
  fmtMoedaBRL,
  fmtNumeroPt,
  formatTituloApresentacao,
  itensTemColunaCaixas,
  labelColunaPrecoUnit,
  labelColunaQuantidade,
} from '@/lib/documentoComercialA4';
import { extractObservacoesUsuario, normalizeEmpresaCupom } from '@/lib/orcamentoRapidoCupom';
import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  drawLines,
  ensureVerticalSpace,
  loadJsPDF,
  splitLines,
} from '@/lib/pdf/pdfLayoutHelpers';

/** Margens alinhadas ao preview A4 (`documentoComercialA4PageStyle`: 18mm vertical, 16mm horizontal). */
const M = 16;
const CONTENT_W = A4_WIDTH_MM - M * 2;
const FOOTER_Y = A4_HEIGHT_MM - 12;
const TABLE_TOP = 20;
const ROW_LINE_H = 4.2;

/** Mesmas proporções da tabela em `DocumentoComercialA4.jsx` (12% / 40% / 10% cx / 14% / 14%). */
function buildTableColumns(comCaixas) {
  const sep = 2.5;
  const w = CONTENT_W;
  const qtyW = w * 0.12;
  const descW = w * (comCaixas ? 0.32 : 0.4);
  const cxW = comCaixas ? w * 0.1 : 0;
  const numW = w * 0.14;

  let x = M;
  const qtyRight = x + qtyW;
  x = qtyRight + sep;
  const descLeft = x;
  const descRight = descLeft + descW;
  x = descRight + sep;
  const cxRight = comCaixas ? x + cxW : null;
  if (comCaixas) x = cxRight + sep;
  const unitRight = x + numW;
  x = unitRight + sep;
  const totalRight = M + w;

  return { qtyRight, descLeft, descRight, descWidth: descW, cxRight, unitRight, totalRight };
}

function linhaItemTotal(item) {
  if (item.total_liquido != null) return Number(item.total_liquido) || 0;
  if (item.total != null) return Number(item.total) || 0;
  const qtd = Number(item.qtd ?? item.quantidade) || 0;
  const preco = Number(item.preco_unit ?? item.preco_unitario) || 0;
  return qtd * preco;
}

function linhaItemPrecoUnit(item) {
  if (item.preco_unit_liquido != null) return Number(item.preco_unit_liquido) || 0;
  return Number(item.preco_unit ?? item.preco_unitario) || 0;
}

function tituloDocumento(props) {
  const { tipo, titulo, numero } = props;
  if (titulo) return formatTituloApresentacao(titulo);
  if (tipo === 'pedido_venda') {
    return formatTituloApresentacao(`Pedido de venda${numero ? ` nº ${numero}` : ''}`);
  }
  return formatTituloApresentacao('Orçamento');
}

/** @param {Record<string, unknown>} props — mesmas props que DocumentoComercialA4 */
export async function createDocumentoComercialA4Pdf(props) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerJsPdfNotoFonts(doc);

  const lista = Array.isArray(props.itens) ? props.itens : [];
  const comCaixas = itensTemColunaCaixas(lista);
  const st = Number(props.subtotal) || lista.reduce((s, i) => s + linhaItemTotal(i), 0);
  const desc = Math.max(Number(props.desconto) || 0, 0);
  const tot = Number(props.total) || Math.max(st - desc, 0);
  const empresaNorm = normalizeEmpresaCupom(props.empresa);
  const observacoesUsuario = extractObservacoesUsuario(props.observacoes);
  const pagamentosLista = Array.isArray(props.pagamentos) ? props.pagamentos.filter((p) => p?.valor > 0) : [];
  const resumo = buildResumoDocumentoComercial(lista, tot);
  const metaData = fmtDataDocumento(props.data);
  const labelQty = labelColunaQuantidade(lista);
  const labelUnit = labelColunaPrecoUnit(lista);

  const freteValor = Number(props.frete);
  const temFreteLinha = Boolean(props.freteIncluso) || (Number.isFinite(freteValor) && freteValor > 0);

  let y = M;

  const drawHr = () => {
    doc.setDrawColor(232);
    doc.setLineWidth(0.2);
    doc.line(M, y, A4_WIDTH_MM - M, y);
    y += 4;
  };

  // Cabeçalho
  const titulo = normalizePdfText(tituloDocumento(props));
  const tituloLines = splitLines(doc, titulo, CONTENT_W * 0.46);
  const headerRightX = A4_WIDTH_MM - M;

  if (empresaNorm?.nome) {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(14);
    const nomeLines = splitLines(doc, normalizePdfText(formatTituloApresentacao(empresaNorm.nome)), CONTENT_W * 0.52);
    drawLines(doc, nomeLines, M, y + 4, 5.5);
    let yEmp = y + 4 + nomeLines.length * 5.5;
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(9);
    const metaEmpresa = [
      empresaNorm.razaoSocial,
      empresaNorm.cnpj ? `CNPJ ${empresaNorm.cnpj}` : '',
      empresaNorm.endereco,
      empresaNorm.complemento,
      empresaNorm.bairroCidade,
      empresaNorm.telefone,
      empresaNorm.email,
    ].filter(Boolean).map(normalizePdfText);
    for (const line of metaEmpresa) {
      doc.text(line, M, yEmp);
      yEmp += 4;
    }
    y = Math.max(yEmp, y);
  }

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(12);
  let yTit = M + 2;
  for (const line of tituloLines) {
    doc.text(line, headerRightX, yTit, { align: 'right' });
    yTit += 5.5;
  }
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (props.subtitulo) {
    doc.text(normalizePdfText(props.subtitulo), headerRightX, yTit, { align: 'right' });
    yTit += 4.5;
  }
  doc.text(`Data ${metaData}`, headerRightX, yTit, { align: 'right' });
  yTit += 4.5;
  if (props.vendedorNome) {
    doc.text(`Vendedor: ${normalizePdfText(props.vendedorNome)}`, headerRightX, yTit, { align: 'right' });
    yTit += 4.5;
  }
  if (lista.length > 0) {
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(20);
    doc.text(normalizePdfText(resumo), headerRightX, yTit + 2, { align: 'right' });
    yTit += 8;
  }
  doc.setTextColor(0);
  y = Math.max(y, yTit) + 6;
  drawHr();

  if (props.clienteNome) {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('CLIENTE', M, y);
    y += 4;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(normalizePdfText(formatTituloApresentacao(props.clienteNome)), M, y);
    y += 10;
  }

  const cols = buildTableColumns(comCaixas);

  const drawTableHeader = () => {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30);
    const headerY = y;
    doc.text(normalizePdfText(labelQty), cols.qtyRight, headerY, { align: 'right' });
    doc.text('DESCRIÇÃO', cols.descLeft, headerY);
    if (comCaixas) doc.text('CAIXAS', cols.cxRight, headerY, { align: 'right' });
    const unitLabelMaxW = Math.max(18, cols.totalRight - cols.unitRight - 6);
    const unitLabelLines = splitLines(doc, normalizePdfText(labelUnit), unitLabelMaxW);
    unitLabelLines.forEach((line, i) => {
      doc.text(line, cols.unitRight, headerY + i * (ROW_LINE_H - 0.5), { align: 'right' });
    });
    doc.text('VALOR TOTAL', cols.totalRight, headerY, { align: 'right' });
    y = headerY + Math.max(ROW_LINE_H, unitLabelLines.length * (ROW_LINE_H - 0.5)) + 1;
    doc.setDrawColor(217);
    doc.line(M, y, A4_WIDTH_MM - M, y);
    y += 4;
  };

  const drawTableRow = ({
    qtyText = '',
    descText = '',
    cxText = '',
    unitText = '',
    totalText = '',
    bold = false,
    descFontSize = 9,
  }) => {
    const yBefore = y;
    y = ensureVerticalSpace(doc, y, ROW_LINE_H * 2, { top: TABLE_TOP, bottom: FOOTER_Y - 8 });
    if (y < yBefore - 1) drawTableHeader();

    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(descFontSize);
    doc.setTextColor(20);

    const rowY = y;
    if (qtyText) doc.text(qtyText, cols.qtyRight, rowY, { align: 'right' });

    let rowH = ROW_LINE_H;
    if (descText) {
      const descLines = splitLines(doc, descText, cols.descWidth);
      drawLines(doc, descLines, cols.descLeft, rowY, ROW_LINE_H);
      rowH = Math.max(rowH, descLines.length * ROW_LINE_H);
    }

    if (comCaixas && cxText) doc.text(cxText, cols.cxRight, rowY, { align: 'right' });
    if (unitText) doc.text(unitText, cols.unitRight, rowY, { align: 'right' });
    if (totalText) doc.text(totalText, cols.totalRight, rowY, { align: 'right' });

    y = rowY + rowH + 2;
    doc.setDrawColor(232);
    doc.setLineWidth(0.15);
    doc.line(M, y - 0.5, A4_WIDTH_MM - M, y - 0.5);
  };

  drawTableHeader();

  for (const item of lista) {
    const qtd = Number(item.qtd ?? item.quantidade) || 0;
    const nome = normalizePdfText(item.nome || item.produto_nome || '');
    const cx = Number(item.caixas ?? item.quantidade_caixas);
    drawTableRow({
      qtyText: fmtNumeroPt(qtd),
      descText: nome,
      cxText: comCaixas && Number.isFinite(cx) && cx > 0 ? fmtNumeroPt(cx, 0) : '',
      unitText: fmtMoedaBRL(linhaItemPrecoUnit(item)),
      totalText: fmtMoedaBRL(linhaItemTotal(item)),
    });
  }

  if (lista.length > 0) {
    y = ensureVerticalSpace(doc, y, 24, { top: TABLE_TOP, bottom: FOOTER_Y - 8 });
    doc.setDrawColor(217);
    doc.setLineWidth(0.25);
    doc.line(M, y, A4_WIDTH_MM - M, y);
    y += 5;

    const somaQty = lista.reduce((s, i) => s + (Number(i.qtd ?? i.quantidade) || 0), 0);
    const somaCaixas = comCaixas
      ? lista.reduce((s, i) => s + (Number(i.caixas ?? i.quantidade_caixas) || 0), 0)
      : 0;

    drawTableRow({
      qtyText: fmtNumeroPt(somaQty),
      descText: 'Subtotal',
      cxText: comCaixas && somaCaixas > 0 ? fmtNumeroPt(somaCaixas, 0) : '',
      totalText: fmtMoedaBRL(st),
      bold: true,
    });

    if (desc > 0) {
      drawTableRow({
        descText: 'Desconto comercial',
        totalText: `− ${fmtMoedaBRL(desc)}`,
      });
    }
    if (temFreteLinha) {
      const freteTxt = props.freteIncluso ? 'Incluso' : (freteValor > 0 ? fmtMoedaBRL(freteValor) : '—');
      drawTableRow({
        descText: 'Frete',
        unitText: props.freteIncluso ? 'Incluso' : '',
        totalText: props.freteIncluso ? '—' : freteTxt,
        bold: true,
      });
    }
    drawTableRow({
      descText: 'Total',
      totalText: fmtMoedaBRL(tot),
      bold: true,
      descFontSize: 11,
    });
    y += 4;
  }

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85);

  if (observacoesUsuario) {
    y = ensureVerticalSpace(doc, y, 12);
    const obsLines = splitLines(doc, normalizePdfText(observacoesUsuario), CONTENT_W);
    y = drawLines(doc, obsLines, M, y, 4.2) + 2;
  }
  if (pagamentosLista.length > 0) {
    y = ensureVerticalSpace(doc, y, 8 + pagamentosLista.length * 4);
    doc.setTextColor(50);
    doc.text('Pagamento:', M, y);
    y += 4.5;
    for (const pag of pagamentosLista) {
      const forma = (pag.forma_pagamento || 'Forma').toUpperCase();
      const parc = pag.parcelas > 1 ? ` ${pag.parcelas}x` : '';
      doc.text(`${forma}${parc} — ${fmtMoedaBRL(pag.valor)}`, M, y);
      y += 4.2;
    }
  }
  if (props.avisoPreco) {
    y = ensureVerticalSpace(doc, y, 8);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(50);
    y = drawLines(doc, splitLines(doc, normalizePdfText(props.avisoPreco), CONTENT_W), M, y, 4.2) + 2;
  }

  const rodape = props.rodapeLegal || 'Este documento não possui validade fiscal.';
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(136);
  doc.text(normalizePdfText(rodape), A4_WIDTH_MM / 2, FOOTER_Y, { align: 'center' });

  return doc;
}
