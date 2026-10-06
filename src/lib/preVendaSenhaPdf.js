import { format } from 'date-fns';
import { getUnidadeMedidaItemPedidoVenda } from '@/lib/productUnits';
import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import { drawLines, loadJsPDF, splitLines } from '@/lib/pdf/pdfLayoutHelpers';
import { CUPOM_PAPEL_MM } from '@/lib/cupomTermicoConstants';

const fmtV = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function createPreVendaSenhaPdf(preVenda) {
  const JsPDF = await loadJsPDF();
  const pageW = CUPOM_PAPEL_MM;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, 220] });
  await registerJsPdfNotoFonts(doc);

  const M = 6;
  const W = pageW - M * 2;
  let y = 8;
  const lh = 4;
  const senha4 = (preVenda?.senha_atendimento || '').slice(-4);

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(11);
  doc.text('SENHA DE ATENDIMENTO', pageW / 2, y, { align: 'center' });
  y += lh;
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  doc.text(
    format(new Date(preVenda?.created_date || new Date()), 'dd/MM/yyyy HH:mm'),
    pageW / 2,
    y,
    { align: 'center' },
  );
  y += lh + 4;
  doc.setFontSize(28);
  doc.text(senha4, pageW / 2, y, { align: 'center' });
  y += 12;

  const meta = [
    `CLIENTE: ${(preVenda?.cliente_nome || '').toUpperCase()}`,
    `VENDEDOR: ${(preVenda?.vendedor_nome || '').toUpperCase()}`,
    `ENTREGA: ${(preVenda?.metodo_entrega || 'RETIRADA').toUpperCase()}`,
  ];
  doc.setFontSize(9);
  for (const line of meta) {
    const wrapped = splitLines(doc, normalizePdfText(line), W);
    y = drawLines(doc, wrapped, M, y, lh);
  }
  y += 2;

  for (const item of preVenda?.itens || []) {
    const nome = (item.produto_nome || '').substring(0, 40);
    const un = getUnidadeMedidaItemPedidoVenda(item).substring(0, 4);
    const line = `${nome} | ${item.quantidade} ${un} | R$${fmtV(item.total || 0)}`;
    y = drawLines(doc, splitLines(doc, normalizePdfText(line), W), M, y, lh);
  }

  y += 2;
  doc.setFont('NotoSans', 'bold');
  doc.text(`SUBTOTAL: R$ ${fmtV(preVenda?.valor_total || 0)}`, M, y);

  return doc;
}
