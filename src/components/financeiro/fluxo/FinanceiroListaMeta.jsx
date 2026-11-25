import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FinanceiroSummaryChip({ children, className }) {
  return (
    <span
      className={cn(
        'rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-[#383e47] dark:text-foreground/80',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Meta compacta acima da lista — contagem, conciliação e filtros numa faixa fina. */
export default function FinanceiroListaMeta({
  total,
  totalLabel = 'lançamentos',
  showTotal = true,
  hasActiveFilters,
  onLimparFiltros,
  summaryChips,
  extraActions,
}) {
  const trailing =
    summaryChips || extraActions || (hasActiveFilters && onLimparFiltros);
  if (!showTotal && !trailing) return null;

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0.5">
      {showTotal ? (
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-foreground/40 dark:text-foreground/45">
          {total} {totalLabel}
        </p>
      ) : (
        <span className="hidden sm:block sm:min-w-0 sm:flex-1" aria-hidden />
      )}

      {trailing && (
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:justify-end">
          {summaryChips}
          {extraActions}
          {hasActiveFilters && onLimparFiltros && (
            <button
              type="button"
              onClick={onLimparFiltros}
              className="flex items-center gap-0.5 text-[10px] text-foreground/40 hover:text-foreground/65 dark:text-foreground/45"
            >
              <X className="h-2.5 w-2.5" /> Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
