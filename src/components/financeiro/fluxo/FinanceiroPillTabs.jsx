import React from 'react';
import { cn } from '@/lib/utils';

/** Seletor compacto — padrão Consulta do Turno / Caixa (Aguardando / Consulta). */
export default function FinanceiroPillTabs({ items, value, onChange, className = '', compact = false, stretch = false }) {
  const labelsCompactos = stretch && items.length <= 2;

  return (
    <div
      className={cn(
        'flex rounded-2xl p-1 gap-1 p38-field-surface',
        stretch ? 'w-full' : 'shrink-0',
        className,
      )}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'min-w-0 rounded-xl uppercase tracking-wide transition-colors',
              compact && stretch
                ? cn(
                  'flex-1 py-2.5 md:flex-none md:px-3',
                  labelsCompactos ? 'px-3 text-xs' : 'px-2.5 text-[11px] sm:text-xs',
                )
                : compact
                  ? 'flex-none px-2.5 py-2 text-[11px] sm:px-3.5 sm:py-2 sm:text-xs md:px-3'
                  : 'flex-1 px-3 py-2.5 text-xs sm:text-sm',
              active
                ? 'bg-card font-medium text-foreground shadow-sm dark:bg-[#383e47]'
                : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {item.shortLabel ? (
              <>
                <span className={cn('block md:hidden', labelsCompactos ? 'whitespace-nowrap' : 'truncate')}>
                  {item.shortLabel}
                </span>
                <span className="hidden truncate md:block">{item.label}</span>
              </>
            ) : (
              <span className={cn('block', labelsCompactos ? 'whitespace-nowrap' : 'truncate')}>{item.label}</span>
            )}
            {item.count != null && <span className="tabular-nums"> ({item.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
