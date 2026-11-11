import React, { useRef } from 'react';
import { Eye, MoreVertical, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import FluxoExtratoUtilShortcuts from './FluxoExtratoUtilShortcuts';
import { useFluxoExtratoScrollCollapse } from '@/hooks/useFluxoExtratoScrollCollapse';
import FinanceiroAbaIconTabs from './FinanceiroAbaIconTabs';
import { P38_EXTRATO_V8_FONT_SCOPE, P38_EXTRATO_V8_LIST_BG, P38_SEARCH } from './financeiroP38';

export default function FluxoExtratoMobileShell({
  scrollRef,
  scrollEl,
  aba,
  onAbaChange,
  abasItems,
  saldo,
  saldoPronto = true,
  onBusca,
  onRelatorios,
  onExportar,
  onFiltros,
  search,
  onSearch,
  searchVisible,
  filtrosPanel,
  children,
  loading = false,
  className,
}) {
  const collapsed = useFluxoExtratoScrollCollapse(scrollEl);
  const searchInputRef = useRef(null);

  const handleBusca = () => {
    onBusca?.();
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', P38_EXTRATO_V8_FONT_SCOPE, className)}>
      <header
        className={cn(
          'relative z-30 flex shrink-0 items-center justify-between px-3.5 py-2.5',
          'bg-[#3d5a3d] text-white dark:bg-[#2d333b] dark:text-foreground',
        )}
      >
        <span className="text-[15px] font-semibold tracking-tight">Extrato</span>
        <div className="flex items-center gap-2 [&_button]:text-white dark:[&_button]:text-inherit">
          <FinanceiroAbaIconTabs value={aba} onChange={onAbaChange} items={abasItems} />
          <button type="button" className="p-1 opacity-90" aria-label="Ocultar valores">
            <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button type="button" className="p-1 opacity-90" aria-label="Buscar" onClick={handleBusca}>
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <button type="button" className="p-1 opacity-90" aria-label="Mais opções">
            <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="relative z-0 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto touch-pan-y"
      >
        <div
          className={cn(
            'grid shrink-0 transition-[grid-template-rows] duration-300 ease-out',
            collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                'bg-[#3d5a3d] px-4 pb-5 pt-3 text-white dark:bg-[#2d333b] dark:text-foreground',
                !collapsed && 'pb-8',
              )}
            >
              <p className="text-center text-xs font-semibold uppercase tracking-wide opacity-85">Saldo</p>
              <p className="mt-1 text-center text-[2rem] font-bold tabular-nums leading-none tracking-tight text-white dark:text-[#a4ce33]">
                {saldoPronto && saldo != null ? formatFinanceiroValor(saldo) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'grid z-10 shrink-0 transition-[grid-template-rows] duration-300 ease-out',
            collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-3 pb-2 pt-0">
              <FluxoExtratoUtilShortcuts
                onBusca={handleBusca}
                onRelatorios={onRelatorios}
                onExportar={onExportar}
                onFiltros={onFiltros}
              />
            </div>
          </div>
        </div>

        {searchVisible ? (
          <div
            className={cn(
              'shrink-0 border-b border-border/50 px-3 py-2 dark:border-white/10',
              P38_EXTRATO_V8_LIST_BG,
            )}
          >
            <div className={cn('flex h-10 items-center gap-2 rounded-lg px-3', P38_SEARCH)}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                autoComplete="off"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Buscar lançamento…"
                data-pulse-sensor="fluxo-caixa.busca"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        ) : null}

        {filtrosPanel ? (
          <div
            className={cn(
              'shrink-0 border-b border-border/50 px-3 py-3 dark:border-white/10',
              P38_EXTRATO_V8_LIST_BG,
            )}
          >
            {filtrosPanel}
          </div>
        ) : null}

        <div
          className={cn(
            'relative min-w-0 px-3 pb-[var(--p38-scroll-pad-below-nav)]',
            P38_EXTRATO_V8_LIST_BG,
            loading && 'opacity-25',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
