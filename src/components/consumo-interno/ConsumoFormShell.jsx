import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import ConsumoFormHeader from './ConsumoFormHeader';
import { useDesktopContent } from '@/hooks/use-breakpoint';
import { useOverlayHistorySync } from '@/hooks/useOverlayHistorySync';
import { CONSUMO_FORM_SHELL_Z } from '@/lib/consumoInternoOverlay';

export default function ConsumoFormShell({ onBack, desktop, mobile }) {
  const isDesktop = useDesktopContent();
  const [mobileStep, setMobileStep] = useState(0);
  const stepLabels = ['Destino', 'Itens', 'Minuta'];

  useOverlayHistorySync(true, (open) => {
    if (!open) onBack?.();
  });

  const shell = (
    <div className={`fixed inset-0 ${CONSUMO_FORM_SHELL_Z} flex h-[100dvh] max-h-[100dvh] flex-col bg-background`}>
      <ConsumoFormHeader
        isDesktop={isDesktop}
        mobileStep={mobileStep}
        stepLabels={stepLabels}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {isDesktop ? desktop : mobile({ mobileStep, setMobileStep, stepLabels })}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return shell;
  return createPortal(shell, document.body);
}
