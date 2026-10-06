import { format } from 'date-fns';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import { loadJsPDF } from '@/lib/pdf/pdfLayoutHelpers';
import { CUPOM_PAPEL_MM } from '@/lib/cupomTermicoConstants';

const fmt = (v) =>
  `R$ ${roundToTwoDecimals(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export async function createFechamentoCaixaPdf({ turno, caixaData }) {
  const dinheiroConferido = roundToTwoDecimals(caixaData.dinheiroConferido || 0);
  const totalConferido = roundToTwoDecimals(
    dinheiroConferido +
      caixaData.recebimentos.pix +
      (caixaData.recebimentos.credito || 0) +
      (caixaData.recebimentos.debito || 0),
  );
  const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
  const diferenca = roundToTwoDecimals(totalConferido - esperado);

  const JsPDF = await loadJsPDF();
  const pageW = CUPOM_PAPEL_MM;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, 260] });
  await registerJsPdfNotoFonts(doc);

  const M = 6;
  let y = 8;
  const lh = 4.2;
  const row = (left, right, bold = false) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(normalizePdfText(left), M, y);
    doc.text(normalizePdfText(right), pageW - M, y, { align: 'right' });
    y += lh;
  };

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(11);
  doc.text('FECHAMENTO DE CAIXA', pageW / 2, y, { align: 'center' });
  y += lh;
  doc.setFontSize(9);
  doc.text(`Turno ${turno?.numero || ''}`, pageW / 2, y, { align: 'center' });
  y += lh + 2;

  row('Abertura:', format(new Date(turno.data_abertura), 'dd/MM/yyyy HH:mm'));
  row('Fechamento:', format(new Date(turno.data_fechamento || new Date()), 'dd/MM/yyyy HH:mm'));
  row('Operador:', turno.usuario_abertura_nome || '');
  y += 2;

  row('Saldo Inicial:', fmt(turno.saldo_inicial));
  row('+ Vendas:', fmt(caixaData.totalVendas));
  row('+ Reforços:', fmt(caixaData.reforcos));
  row('- Sangrias:', fmt(caixaData.sangrias));
  row('Saldo do Turno:', fmt(caixaData.saldoAtual), true);
  y += 2;

  doc.setFont('NotoSans', 'bold');
  doc.text('RECEBIMENTOS', M, y);
  y += lh;
  doc.setFont('NotoSans', 'normal');
  row('Dinheiro:', fmt(caixaData.recebimentos.dinheiro));
  row('PIX:', fmt(caixaData.recebimentos.pix));
  row('Cartão Débito:', fmt(caixaData.recebimentos.debito || 0));
  row('Cartão Crédito:', fmt(caixaData.recebimentos.credito || 0));
  row('Vale Compra:', fmt(caixaData.recebimentos.vale || 0));
  y += 2;

  doc.setFont('NotoSans', 'bold');
  doc.text('CONFERÊNCIA', M, y);
  y += lh;
  doc.setFont('NotoSans', 'normal');
  row('Dinheiro na Gaveta:', fmt(caixaData.liquidez));
  row('Total Conferido:', fmt(totalConferido), true);
  row('Diferença:', `${diferenca >= 0 ? '+' : ''}${fmt(diferenca)}`, true);

  return doc;
}
