import React from 'react';
import { Download, Printer, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from './financeiroP38';

const btnClass = cn(
  'flex flex-col items-center gap-1.5 border-0 bg-transparent p-2 text-[10px] font-medium text-foreground',
);

const iconWrap = cn(
  'flex h-10 w-10 items-center justify-center rounded-full',
  'bg-[#e2ebe2] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
);

export default function FluxoExtratoUtilShortcuts({
  onBusca,
  onRelatorios,
  onExportar,
  onFiltros,
  className,
}) {
  return (
    <div
      className={cn(
        'mx-3 -mt-3 rounded-2xl px-3 py-3 shadow-sm',
        P38_FIELD_SURFACE,
        'dark:shadow-none',
        className,
      )}
    >
      <div className="grid grid-cols-4 gap-1">
        <button type="button" className={btnClass} onClick={onBusca}>
          <span className={iconWrap}><Search className="h-5 w-5" strokeWidth={2} /></span>
          Busca
        </button>
        <button type="button" className={btnClass} onClick={onRelatorios}>
          <span className={iconWrap}><Printer className="h-5 w-5" strokeWidth={2} /></span>
          Relatórios
        </button>
        <button type="button" className={btnClass} onClick={onExportar}>
          <span className={iconWrap}><Download className="h-5 w-5" strokeWidth={2} /></span>
          Exportar
        </button>
        <button type="button" className={btnClass} onClick={onFiltros}>
          <span className={iconWrap}><SlidersHorizontal className="h-5 w-5" strokeWidth={2} /></span>
          Filtros
        </button>
      </div>
    </div>
  );
}
