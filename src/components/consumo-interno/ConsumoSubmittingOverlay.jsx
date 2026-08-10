import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { CONSUMO_FORM_OVERLAY_Z } from '@/lib/consumoInternoOverlay';

export default function ConsumoSubmittingOverlay({ open, message = 'Registrando consumo interno…' }) {
  if (!open) return null;

  const overlay = (
    <div
      className={`fixed inset-0 ${CONSUMO_FORM_OVERLAY_Z} flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">Aguarde, não feche esta tela.</p>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
