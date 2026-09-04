import React from 'react';
import { cn } from '@/components/utils';
import { formatarSoData } from '@/components/utils/dateUtils';
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

/** Data de recebimento — chip verde abaixo do status Concluído. */
export function ComprasRecebimentoDateChip({ date, className = '' }) {
  if (!date) return null;
  return (
    <span
      className={cn(
        'inline-flex max-w-full text-[10px] px-2 py-0.5 rounded-full font-medium leading-normal tabular-nums',
        'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400',
        className,
      )}
    >
      {formatarSoData(date) || date}
    </span>
  );
}
