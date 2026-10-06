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

const M = 15;
const CONTENT_W = A4_WIDTH_MM - M * 2;
const FOOTER_Y = A4_HEIGHT_MM - 12;

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

  // Tabela — colunas (mm a partir da esquerda da página)
  const colQtyR = M + 14;
  const colDescL = M + 18;
  const colDescR = comCaixas ? M + 98 : M + 108;
  const colCxR = M + 108;
  const colUnitR = comCaixas ? M + 148 : M + 158;
  const colTotalR = A4_WIDTH_MM - M;

  const drawTableHeader = () => {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30);
    doc.text(normalizePdfText(labelQty), colQtyR, y, { align: 'right' });
    doc.text('DESCRIÇÃO', colDescL, y);
    if (comCaixas) doc.text('CAIXAS', colCxR, y, { align: 'right' });
    doc.text(normalizePdfText(labelUnit), colUnitR, y, { align: 'right' });
    doc.text('VALOR TOTAL', colTotalR, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(217);
    doc.line(M, y, A4_WIDTH_MM - M, y);
    y += 5;
  };

  drawTableHeader();

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(9);

  for (const item of lista) {
    const qtd = Number(item.qtd ?? item.quantidade) || 0;
    const nome = normalizePdfText(item.nome || item.produto_nome || '');
    const nomeLines = splitLines(doc, nome, colDescR - colDescL);
    const rowH = Math.max(8, nomeLines.length * 4.2 + 2);
    y = ensureVerticalSpace(doc, y, rowH + 2);
    if (y <= M + 5) drawTableHeader();

    doc.text(fmtNumeroPt(qtd), colQtyR, y, { align: 'right' });
    drawLines(doc, nomeLines, colDescL, y - 3.5, 4.2);
    if (comCaixas) {
      const cx = Number(item.caixas ?? item.quantidade_caixas);
      if (Number.isFinite(cx) && cx > 0) doc.text(fmtNumeroPt(cx, 0), colCxR, y, { align: 'right' });
    }
    doc.text(fmtMoedaBRL(linhaItemPrecoUnit(item)), colUnitR, y, { align: 'right' });
    doc.text(fmtMoedaBRL(linhaItemTotal(item)), colTotalR, y, { align: 'right' });
    y += rowH;
    doc.setDrawColor(232);
    doc.line(M, y - 1, A4_WIDTH_MM - M, y - 1);
  }

  if (lista.length > 0) {
    y = ensureVerticalSpace(doc, y, 28);
    doc.setDrawColor(217);
    doc.line(M, y, A4_WIDTH_MM - M, y);
    y += 6;
    doc.setFont('NotoSans', 'bold');
    const somaQty = lista.reduce((s, i) => s + (Number(i.qtd ?? i.quantidade) || 0), 0);
    doc.text(fmtNumeroPt(somaQty), colQtyR, y, { align: 'right' });
    doc.text('Subtotal', colDescL, y);
    doc.text(fmtMoedaBRL(st), colTotalR, y, { align: 'right' });
    y += 6;

    if (desc > 0) {
      doc.setFont('NotoSans', 'normal');
      doc.text('Desconto comercial', colDescL, y);
      doc.text(`− ${fmtMoedaBRL(desc)}`, colTotalR, y, { align: 'right' });
      y += 6;
    }
    if (temFreteLinha) {
      doc.setFont('NotoSans', 'bold');
      doc.text('Frete', colDescL, y);
      doc.setFont('NotoSans', 'normal');
      const freteTxt = props.freteIncluso ? 'Incluso' : (freteValor > 0 ? fmtMoedaBRL(freteValor) : '—');
      doc.text(freteTxt, colTotalR, y, { align: 'right' });
      y += 6;
    }
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(11);
    doc.text('Total', colDescL, y);
    doc.text(fmtMoedaBRL(tot), colTotalR, y, { align: 'right' });
    y += 10;
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
