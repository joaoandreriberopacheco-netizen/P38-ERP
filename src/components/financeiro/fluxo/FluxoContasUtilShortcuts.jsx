import React from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from './financeiroP38';

const btnClass = cn(
  'flex flex-col items-center gap-1.5 border-0 bg-transparent p-2 text-[10px] font-medium text-foreground',
);

const iconWrap = cn(
  'flex h-10 w-10 items-center justify-center rounded-full',
  'bg-[#e2ebe2] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
);

/** Atalhos do painel Contas — mesma linguagem visual que FluxoExtratoUtilShortcuts. */
export default function FluxoContasUtilShortcuts({ onBusca, onFiltros, onNovaConta, className }) {
  return (
    <div
      className={cn(
        'mx-3 -mt-3 rounded-2xl px-3 py-3 shadow-sm',
        P38_FIELD_SURFACE,
        'dark:shadow-none',
        className,
      )}
    >
      <div className="grid grid-cols-3 gap-1">
        <button type="button" className={btnClass} onClick={onBusca}>
          <span className={iconWrap}>
            <Search className="h-5 w-5" strokeWidth={2} />
          </span>
          Busca
        </button>
        <button type="button" className={btnClass} onClick={onFiltros}>
          <span className={iconWrap}>
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
          </span>
          Filtros
        </button>
        <button type="button" className={btnClass} onClick={onNovaConta}>
          <span className={iconWrap}>
            <Plus className="h-5 w-5" strokeWidth={2} />
          </span>
          Nova conta
        </button>
      </div>
    </div>
  );
}
