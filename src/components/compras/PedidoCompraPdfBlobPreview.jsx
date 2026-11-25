import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FORMIGRES_DOC_SURFACE } from '@/lib/formigresDocumentTheme';
import { downloadBlob } from '@/lib/mobilePrintAndShare';

/**
 * Visualizador de PDF binário (relatórios edge) — fundo sempre claro para evitar viewer “preto” no dark mode.
 */
export default function PedidoCompraPdfBlobPreview({
  open,
  blob,
  filename = 'relatorio.pdf',
  title = 'Relatório',
  onClose,
}) {
  const blobUrl = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!open || !blobUrl) return null;

  const handleDownload = () => {
    if (blob) downloadBlob(blob, filename);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: FORMIGRES_DOC_SURFACE, colorScheme: 'only light' }}
      data-theme="light"
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ background: '#ffffff', borderColor: '#e8e8e8' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-sm"
          style={{ color: '#666666' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold font-glacial" style={{ color: '#111111' }}>
          {title}
        </span>
        <Button onClick={handleDownload} size="sm" variant="outline" className="h-9 text-xs gap-1.5 rounded-xl px-3">
          <Download className="w-3.5 h-3.5" />
          Baixar
        </Button>
      </div>
      <div className="flex-1 min-h-0 p-3 md:p-5" style={{ background: '#ffffff' }}>
        <iframe
          title={title}
          src={blobUrl}
          className="w-full h-full border-0 rounded-sm shadow-md"
          style={{ backgroundColor: '#ffffff', colorScheme: 'only light' }}
        />
      </div>
    </div>
  );
}