import React, { Suspense, lazy, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import {
  cleanupQuickAccessPortalLayers,
  QUICK_ACCESS_PANEL_SHELL_CLASS,
  QUICK_ACCESS_Z,
} from '@/lib/quickAccessOverlay';
import { prefetchPDVCaixa } from '@/lib/prefetchPDVCaixa';

const PDVCaixa = lazy(() => prefetchPDVCaixa());

function CaixaLoading() {
  return (
    <div className={`flex h-full min-h-[40vh] flex-1 items-center justify-center ${QUICK_ACCESS_PANEL_SHELL_CLASS}`}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function CaixaRapidoPanel({ open, onOpenChange, sessionKey = 0 }) {
  const handleClose = () => {
    cleanupQuickAccessPortalLayers();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      cleanupQuickAccessPortalLayers();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const shell = (
    <div
      className={`fixed inset-0 flex min-h-0 flex-col overflow-hidden ${QUICK_ACCESS_PANEL_SHELL_CLASS}`}
      style={{ zIndex: QUICK_ACCESS_Z.panel }}
      role="dialog"
      aria-modal="true"
      aria-label="Caixa rápido"
    >
      <Suspense fallback={<CaixaLoading />}>
        <PDVCaixa
          key={sessionKey}
          overlayMode
          onClose={handleClose}
          initialActiveTab="vendas"
          initialVendasView="consulta"
        />
      </Suspense>
    </div>
  );

  return createPortal(shell, document.body);
}
