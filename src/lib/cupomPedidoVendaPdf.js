/**
 * Cupom de pedido de venda (80mm) em PDF com texto — sem captura de ecrã.
 */
import { TIMEZONE_SISTEMA } from '@/components/utils/dateUtils';
import {
  CUPOM_LARGURA_IMPRESSAO_MM,
  CUPOM_MARGEM_LATERAL_MM,
  CUPOM_PAPEL_MM,
} from '@/lib/cupomTermicoConstants';
import { getUnidadeMedidaItemPedidoVenda } from '@/lib/productUnits';
import { normalizePdfText, registerJsPdfBarlowFonts } from '@/lib/jspdfNotoFont';
import { drawLines, ensureVerticalSpace, loadJsPDF, splitLines } from '@/lib/pdf/pdfLayoutHelpers';

const fmtV = (v) => {
  const num = parseFloat(v) || 0;
  const formatted = num.toFixed(2).replace('.', ',');
  const parts = formatted.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
};

const fmtDtTZ = (d) =>
  d
    ? new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_SISTEMA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d))
    : '-';

function buildEmpresaCupom(dadosEmpresa) {
  const nomeFantasia = (dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'EMPRESA').toUpperCase();
  const razaoSocial =
    dadosEmpresa?.nome_fantasia && dadosEmpresa?.razao_social ? dadosEmpresa.razao_social : null;
  return {
    nomeFantasia,
    razaoSocial,
    cnpj: dadosEmpresa?.cnpj,
    endereco: [dadosEmpresa?.endereco, dadosEmpresa?.numero].filter(Boolean).join(', '),
    bairro_cidade: [dadosEmpresa?.bairro, dadosEmpresa?.cidade, dadosEmpresa?.estado].filter(Boolean).join(' - '),
    telefone: dadosEmpresa?.telefone,
    mensagem: (dadosEmpresa?.mensagem_rodape || 'OBRIGADO PELA PREFERÊNCIA!').toUpperCase(),
  };
}

function ordenarItens(itens) {
  const list = Array.isArray(itens) ? itens : [];
  return [...list].sort((a, b) =>
    String(a?.produto_nome || '').localeCompare(String(b?.produto_nome || ''), 'pt-BR', { sensitivity: 'base' }),
  );
}

/**
 * @param {{ pedido: object, dadosEmpresa?: object }} params
 */
export async function createCupomPedidoVendaPdf({ pedido, dadosEmpresa }) {
  const JsPDF = await loadJsPDF();
  const contentW = CUPOM_LARGURA_IMPRESSAO_MM;
  const pageW = CUPOM_PAPEL_MM;
  const marginX = CUPOM_MARGEM_LATERAL_MM;

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageW, 360],
  });
  await registerJsPdfBarlowFonts(doc);

  const empresa = buildEmpresaCupom(dadosEmpresa);
  const itens = ordenarItens(pedido?.itens);
  const pagamentos = Array.isArray(pedido?.pagamentos) ? pedido.pagamentos : [];

  let y = 4;
  const x = marginX;
  const xR = marginX + contentW;
  const lh = 4.2;

  const hr = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.line(x, y, xR, y);
    y += 3;
  };

  const center = (text, size = 10, style = 'normal') => {
    doc.setFont('Barlow', style === 'bold' ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = splitLines(doc, normalizePdfText(text), contentW);
    for (const line of lines) {
      doc.text(line, pageW / 2, y, { align: 'center' });
      y += lh;
    }
  };

  center(empresa.nomeFantasia, 12, 'bold');
  if (empresa.razaoSocial) center(empresa.razaoSocial, 8);
  doc.setFontSize(8);
  if (empresa.cnpj) center(`CNPJ: ${empresa.cnpj}`);
  if (empresa.endereco) center(empresa.endereco);
  if (empresa.bairro_cidade) center(empresa.bairro_cidade);
  if (empresa.telefone) center(`Fone: ${empresa.telefone}`);
  center(`Cupom nº ${pedido?.numero || 'S/N'}`, 8);
  y += 2;
  hr();

  doc.setFontSize(9);
  doc.text(normalizePdfText(fmtDtTZ(pedido?.created_date || new Date())), x, y);
  y += lh;
  doc.text(`Nº ${pedido?.numero || 'S/N'}`, x, y);
  y += lh;
  if (pedido?.cliente_nome) {
    doc.text(`Cliente: ${normalizePdfText(String(pedido.cliente_nome).toUpperCase())}`, x, y);
    y += lh;
  }
  if (pedido?.vendedor_nome) {
    doc.text(`Vendedor: ${normalizePdfText(pedido.vendedor_nome)}`, x, y);
    y += lh;
  }
  hr();

  const colQ = x + contentW * 0.22;
  const colU = x + contentW * 0.38;
  const colP = x + contentW * 0.62;
  doc.setFont('Barlow', 'bold');
  doc.setFontSize(7.5);
  doc.text('QTD', colQ, y, { align: 'center' });
  doc.text('UN', colU, y, { align: 'center' });
  doc.text('PREÇO', colP, y, { align: 'right' });
  doc.text('TOTAL', xR, y, { align: 'right' });
  y += lh + 1;

  doc.setFont('Barlow', 'normal');
  doc.setFontSize(8.5);
  for (const item of itens) {
    const nome = normalizePdfText((item.produto_nome || '').toUpperCase());
    const nomeLines = splitLines(doc, nome, contentW);
    y = ensureVerticalSpace(doc, y, nomeLines.length * lh + lh * 2, { top: 4, bottom: 390 });
    drawLines(doc, nomeLines, x, y, lh);
    y += nomeLines.length * lh;
    const qtd = String(parseFloat(item.quantidade) || 0);
    const unidade = getUnidadeMedidaItemPedidoVenda(item).substring(0, 4);
    doc.text(qtd, colQ, y, { align: 'center' });
    doc.text(unidade, colU, y, { align: 'center' });
    doc.text(fmtV(item.preco_unitario_praticado), colP, y, { align: 'right' });
    doc.text(fmtV(item.total), xR, y, { align: 'right' });
    y += lh + 2;
  }

  hr();
  const rowTotal = (label, valor, bold = false) => {
    doc.setFont('Barlow', bold ? 'bold' : 'normal');
    doc.text(label, x, y);
    doc.text(valor, xR, y, { align: 'right' });
    y += lh;
  };

  if (pedido?.subtotal > 0) rowTotal('Subtotal', `R$ ${fmtV(pedido.subtotal)}`);
  if (pedido?.valor_desconto > 0) rowTotal('Desconto', `-R$ ${fmtV(pedido.valor_desconto)}`);
  if (pedido?.valor_frete > 0) rowTotal('Frete', `R$ ${fmtV(pedido.valor_frete)}`);
  rowTotal('TOTAL', `R$ ${fmtV(pedido?.valor_total || 0)}`, true);

  for (const pag of pagamentos) {
    const forma = (pag.forma_pagamento || '').toUpperCase();
    const parc = pag.parcelas > 1 ? ` ${pag.parcelas}x` : '';
    rowTotal(`${forma}${parc}`, `R$ ${fmtV(pag.valor)}`);
  }

  hr();
  center(empresa.mensagem, 9, 'bold');
  center('Este documento não possui validade fiscal.', 7);

  return doc;
}
