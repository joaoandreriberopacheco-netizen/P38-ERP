import React from 'react';
import { cn } from '@/components/utils';
import { resolveComprasStatusConfig } from '@/lib/comprasEmbarquesPalette';

/** Chip de status de pedido/embarque — mesmo visual lista e consulta, sem contorno. */
export default function ComprasStatusChip({ displayStatus, fallbackStatus, children, className = '' }) {
  const cfg = resolveComprasStatusConfig(displayStatus, fallbackStatus);
  return (
    <span
      className={cn(
        'inline-flex max-w-full text-[11px] px-2 py-0.5 rounded-full font-medium leading-normal whitespace-nowrap truncate',
        cfg.pill,
        className,
      )}
    >
      {children}
    </span>
  );
}
