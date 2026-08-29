import React from 'react';
import { cn } from '@/components/utils';

const TIPOS = [
  {
    id: 'solo',
    label: 'Solo',
    title: 'Sem mix nem variedade — SKU directo na LINHA (ex.: cimento Portland, prego)',
    className: 'data-[active=true]:bg-slate-600 data-[active=true]:text-white dark:data-[active=true]:bg-slate-500',
  },
  {
    id: 'mix',
    label: 'Mix',
    title: 'Esquadra intercambiável no produto compra (ex.: joelho soldável + medidas)',
    className: 'data-[active=true]:bg-blue-600 data-[active=true]:text-white dark:data-[active=true]:bg-blue-500',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    title: 'Referências substituíveis na LINHA ou produto compra (ex.: cerâmicas)',
    className: 'data-[active=true]:bg-violet-600 data-[active=true]:text-white dark:data-[active=true]:bg-violet-500',
  },
];

export default function PortalTipoFilter({ activeTipos, onChange, counts }) {
  const allActive = TIPOS.every((t) => activeTipos.has(t.id));

  const toggle = (id) => {
    const next = new Set(activeTipos);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  const selectAll = () => onChange(new Set(TIPOS.map((t) => t.id)));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">Tipo LINHA:</span>
      <button
        type="button"
        data-active={allActive}
        onClick={selectAll}
        className={cn(
          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          'border-border/60 hover:bg-muted/60',
          allActive && 'bg-foreground text-background border-transparent',
        )}
      >
        Todos
      </button>
      {TIPOS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title}
          data-active={activeTipos.has(t.id)}
          onClick={() => toggle(t.id)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
            'border-border/60 hover:bg-muted/60',
            t.className,
            activeTipos.has(t.id) && !allActive && 'border-transparent',
          )}
        >
          {t.label}
          {counts?.[t.id] != null && (
            <span className="ml-1 opacity-70 tabular-nums">({counts[t.id]})</span>
          )}
        </button>
      ))}
    </div>
  );
}
