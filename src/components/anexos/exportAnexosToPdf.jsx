import { loadJsPDF } from '@/lib/lazyPdfLibs';
import { appendAnexosToPdfDoc } from '@/lib/appendAnexosToPdfDoc';
import { exportPedidoAnexosComMinutaPdf } from '@/lib/exportPedidoAnexosComMinutaPdf';
import { resolvePedidoIdParaExportAnexos } from '@/lib/resolvePedidoIdAnexosExport';

export default async function exportAnexosToPdf(anexos = [], options = {}) {
  const {
    pedidoId: pedidoIdInput,
    pedidoNumero,
    referencias = [],
    referenciaTipo = null,
    referenciaId = null,
  } = options;

  const pedidoId = await resolvePedidoIdParaExportAnexos({
    pedidoId: pedidoIdInput,
    referencias,
    referenciaTipo,
    referenciaId,
  });

  if (pedidoId) {
    await exportPedidoAnexosComMinutaPdf({
      pedidoId,
      pedidoNumero,
      anexos,
      fileName: pedidoNumero ? `anexos-${pedidoNumero}.pdf` : 'anexos.pdf',
    });
    return;
  }

  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const { pagesAdded } = await appendAnexosToPdfDoc(doc, anexos, {
    useFirstPage: true,
  });

  if (pagesAdded === 0) {
    doc.text('Nenhum anexo compatível para exportação.', 14, 20);
  }

  doc.save('anexos.pdf');
}
