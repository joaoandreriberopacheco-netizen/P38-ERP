import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Download, Printer, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import FormularioPedidoImpresso from './FormularioPedidoImpresso';
import { loadHtml2Canvas, loadJsPDF } from '@/lib/lazyPdfLibs';
import { openPrintWindowOrShareHtml, shareOrDownloadBlob, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';

export default function PedidoFAB({ pedido, onSave, isSaving, isDisabled, empresa }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handlePrint = async () => {
    const element = document.getElementById('formulario-impresso');
    if (!element) return;

    const doc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Pedido ${pedido.numero}</title>
          <style>
            body { font-family: Courier New, monospace; font-size: 12px; margin: 20px; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${element.textContent}</pre>
        </body>
      </html>
    `;
    try {
      await openPrintWindowOrShareHtml(doc, `pedido-${pedido.numero || 'novo'}.html`, `Pedido ${pedido.numero || ''}`);
    } catch {
      /* popup bloqueado */
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('formulario-impresso');
    if (!element) return;

    const html2canvas = await loadHtml2Canvas();
    const JsPDF = await loadJsPDF();

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    const name = `Pedido-${pedido.numero || 'novo'}.pdf`;
    const blob = pdf.output('blob');
    if (shouldUseMobileDocumentExport()) {
      await shareOrDownloadBlob(blob, name, 'application/pdf', `Pedido ${pedido.numero || ''}`);
    } else {
      pdf.save(name);
    }
  };

  return (
    <>
      {/* FAB Button */}
      <div className="fixed right-6 z-[55] p38-bottom-fab1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center ${
            isOpen
              ? 'bg-muted text-foreground dark:bg-muted dark:text-foreground'
              : 'bg-[#4a5240] text-white hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22] dark:hover:bg-[#a4ce33]/90'
          }`}
          title="Menu de ações"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Save className="w-6 h-6" />}
        </button>

        {/* Menu expansível */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-2">
            <button
              onClick={() => {
                onSave();
                setIsOpen(false);
              }}
              disabled={isSaving || isDisabled}
              className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 dark:bg-green-700 dark:hover:bg-green-600 text-white shadow-lg flex items-center justify-center transition-all duration-200 disabled:opacity-50"
              title="Salvar pedido"
            >
              <Save className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setShowPreview(true);
                setIsOpen(false);
              }}
              disabled={isSaving || isDisabled}
              className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all duration-200 disabled:opacity-50"
              title="Visualizar formulário"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Dialog de Visualização e Impressão */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="flex max-h-[90vh] min-h-0 max-w-2xl flex-col overflow-hidden border-border/40 p-0 dark:border-border/40 dark:bg-background dark:text-foreground">
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-6 py-4 dark:border-border/40">
            <h2 className="text-lg font-semibold text-foreground">
              Formulário - Pedido {pedido.numero}
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                size="sm"
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-card px-6 py-4 dark:bg-muted [scrollbar-gutter:stable]">
            <div id="formulario-impresso" className="text-sm">
              <FormularioPedidoImpresso pedido={pedido} empresa={empresa} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}