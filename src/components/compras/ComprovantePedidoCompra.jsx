import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import DocumentoComercialA4 from '@/components/documento/DocumentoComercialA4';
import {
  DOCUMENTO_COMERCIAL_A4_FONT,
  DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE,
  ensureDocumentoComercialA4FontLoaded,
  mapPedidoCompraParaDocumentoComercial,
} from '@/lib/documentoComercialA4';
import { createDocumentoComercialA4Pdf } from '@/lib/documentoComercialA4Pdf';
import { exportPdfDocumentAndShare, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import {
  FORMIGRES_DOC_ACCENT,
  FORMIGRES_DOC_BORDER,
  FORMIGRES_DOC_SURFACE,
  FORMIGRES_DOC_TEXT,
  FORMIGRES_DOC_TEXT_STRONG,
} from '@/lib/formigresDocumentTheme';
import { useProdutosListQuery } from '@/hooks/useP38Entities';

const A4_PREVIEW_WIDTH_PX = Math.round(210 * 3.7795275591);

function PreviewA4Scaled({ children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const calc = () => {
      const available = el.offsetWidth - 24;
      if (available <= 0) return;
      setScale(Math.min(1, Math.max(0.35, available / A4_PREVIEW_WIDTH_PX)));
    };

    calc();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    ro?.observe(el);
    window.addEventListener('resize', calc);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', calc);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full min-w-0 flex justify-center py-2 px-2">
      <div
        style={{
          width: A4_PREVIEW_WIDTH_PX,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
        }}
      >
        <div className="shadow-2xl rounded-sm overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export default function ComprovantePedidoCompra({ pedido, open = true, onClose, produtosMap: produtosMapProp }) {
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [previewMode, setPreviewMode] = useState('pdf');
  const { data: produtosCached } = useProdutosListQuery();

  const produtosMap = useMemo(() => {
    if (produtosMapProp && Object.keys(produtosMapProp).length) return produtosMapProp;
    const map = {};
    (produtosCached || []).forEach((p) => {
      if (p?.id) map[p.id] = p;
    });
    return map;
  }, [produtosMapProp, produtosCached]);

  useEffect(() => {
    if (!open) return;
    base44.entities.DadosEmpresa.list()
      .then((r) => r?.length && setDadosEmpresa(r[0]))
      .catch(() => {});
    ensureDocumentoComercialA4FontLoaded().catch(() => {});
  }, [open]);

  const docProps = useMemo(() => {
    if (!pedido) return null;
    return mapPedidoCompraParaDocumentoComercial(pedido, dadosEmpresa, produtosMap);
  }, [pedido, dadosEmpresa, produtosMap]);

  const gerarPDF = useCallback(async () => {
    if (!docProps) throw new Error('Pedido indisponível');
    return createDocumentoComercialA4Pdf(docProps);
  }, [docProps]);

  useEffect(() => {
    if (!open || !docProps) {
      setPdfBlob(null);
      setPdfUrl(null);
      return undefined;
    }

    let cancelled = false;
    setGerando(true);
    setPreviewMode('pdf');

    (async () => {
      try {
        const doc = await gerarPDF();
        const blob = doc.output('blob');
        if (cancelled) return;
        setPdfBlob(blob);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error('Não foi possível gerar o PDF A4');
          setPreviewMode('html');
        }
      } finally {
        if (!cancelled) setGerando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, docProps, gerarPDF]);

  useEffect(() => {
    if (!pdfBlob) {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);

  const handleShare = async () => {
    setGerando(true);
    try {
      const fileName = `pedido-compra-${pedido?.numero || 'minuta'}`;
      const r = await exportPdfDocumentAndShare({
        createPdfDocument: () => gerarPDF(),
        fileBaseName: fileName,
        title: `Pedido de compra ${pedido?.numero || ''}`,
      });
      if (r === 'downloaded') toast.success('PDF A4 gerado com sucesso');
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  };

  const handlePrint = async () => {
    if (pdfUrl && shouldUseMobileDocumentExport()) {
      await handleShare();
      return;
    }

    const el = document.getElementById('pedido-compra-a4-print');
    if (!el) {
      if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener');
      return;
    }

    if (shouldUseMobileDocumentExport()) {
      await handleShare();
      return;
    }

    const html = `<!DOCTYPE html><html lang="pt-BR" data-theme="light"><head>
      <meta charset="UTF-8">
      <meta name="color-scheme" content="light only">
      <title>Pedido de compra ${pedido?.numero || ''}</title>
      <link href="${DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE}" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #ffffff;
          color: #111111;
          color-scheme: only light;
          font-family: ${DOCUMENTO_COMERCIAL_A4_FONT};
        }
        @page { size: A4 portrait; margin: 0; }
      </style>
    </head><body>${el.outerHTML}</body></html>`;

    const old = document.getElementById('pedido-compra-print-frame');
    if (old) old.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'pedido-compra-print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.onload = async () => {
      try {
        await iframe.contentDocument?.fonts?.ready;
      } catch {
        /* segue */
      }
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 2000);
      }, 250);
    };
  };

  if (!open || !pedido || !docProps) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: FORMIGRES_DOC_SURFACE, colorScheme: 'only light' }}
      data-theme="light"
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ background: '#ffffff', borderColor: FORMIGRES_DOC_BORDER }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-sm"
          style={{ color: FORMIGRES_DOC_TEXT }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold font-glacial" style={{ color: FORMIGRES_DOC_TEXT_STRONG }}>
          Pedido de compra — A4
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={previewMode === 'pdf' ? 'default' : 'outline'}
            className="h-8 text-xs hidden sm:inline-flex"
            onClick={() => setPreviewMode('pdf')}
          >
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant={previewMode === 'html' ? 'default' : 'outline'}
            className="h-8 text-xs hidden sm:inline-flex"
            onClick={() => setPreviewMode('html')}
          >
            Layout
          </Button>
          <Button
            onClick={handlePrint}
            disabled={gerando}
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5 rounded-xl px-3"
            title="Imprimir"
          >
            {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          </Button>
          <Button
            onClick={handleShare}
            disabled={gerando || !docProps}
            size="sm"
            className="h-9 text-xs gap-1.5 rounded-xl px-4 text-white"
            style={{ background: FORMIGRES_DOC_ACCENT }}
          >
            {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            {gerando ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full min-w-0" style={{ background: '#ffffff' }}>
        {gerando && !pdfUrl && previewMode === 'pdf' ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm" style={{ color: FORMIGRES_DOC_TEXT }}>
            <Loader2 className="w-8 h-8 animate-spin" />
            Gerando PDF A4 (modo claro)…
          </div>
        ) : null}

        {previewMode === 'pdf' && pdfUrl ? (
          <iframe
            title={`PDF pedido ${pedido?.numero || ''}`}
            src={pdfUrl}
            className="w-full h-full min-h-[calc(100vh-56px)] border-0"
            style={{ backgroundColor: '#ffffff', colorScheme: 'only light' }}
          />
        ) : null}

        {previewMode === 'html' || (previewMode === 'pdf' && !pdfUrl && !gerando) ? (
          <PreviewA4Scaled>
            <div
              className="p38-pdf-light-root"
              style={{ background: '#ffffff', colorScheme: 'only light' }}
              data-skin="formigres"
              data-theme="light"
            >
              <DocumentoComercialA4 {...docProps} printId="pedido-compra-a4-print" />
            </div>
          </PreviewA4Scaled>
        ) : null}
      </div>
    </div>
  );
}