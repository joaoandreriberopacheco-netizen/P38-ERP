import React, { useRef } from 'react';
import { Eye, MoreVertical, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import FluxoExtratoUtilShortcuts from './FluxoExtratoUtilShortcuts';
import { PeriodoPicker, ContasFiltro } from './FiltrosFluxoCaixa';
import { useFluxoExtratoScrollCollapse } from '@/hooks/useFluxoExtratoScrollCollapse';
import FinanceiroAbaIconTabs from './FinanceiroAbaIconTabs';
import { P38_SEARCH } from './financeiroP38';

export default function FluxoExtratoMobileShell({
  scrollRef,
  scrollEl,
  aba,
  onAbaChange,
  abasItems,
  saldo,
  saldoPronto = true,
  contasResumoLabel,
  onBusca,
  onRelatorios,
  onExportar,
  onFiltros,
  search,
  onSearch,
  searchVisible,
  periodo,
  onPeriodo,
  customStart,
  customEnd,
  onCustom,
  contas,
  contasSel,
  onContasSel,
  filtrosPanel,
  children,
  loading = false,
}) {
  const collapsed = useFluxoExtratoScrollCollapse(scrollEl);
  const searchInputRef = useRef(null);

  const handleBusca = () => {
    onBusca?.();
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header
        className={cn(
          'relative z-30 flex shrink-0 items-center justify-between px-3.5 py-2.5 text-white',
          'bg-[#3d5a3d] dark:bg-[#2d333b] dark:text-foreground',
        )}
      >
        <span className="text-[15px] font-semibold">Extrato</span>
        <div className="flex items-center gap-2">
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
            <div className="bg-[#3d5a3d] px-4 pb-5 pt-3 text-white dark:bg-[#2d333b] dark:text-foreground">
              <p className="text-center text-xs opacity-85">Saldo em conta</p>
              <p className="mt-1 text-center text-[2rem] font-bold tabular-nums leading-none tracking-tight text-white dark:text-[#a4ce33]">
                {saldoPronto && saldo != null ? formatFinanceiroValor(saldo) : '—'}
              </p>
              {contasResumoLabel ? (
                <p className="mt-3 text-center">
                  <span className="inline-block rounded-full border border-white/35 bg-white/10 px-4 py-1.5 text-xs">
                    {contasResumoLabel}
                  </span>
                </p>
              ) : null}
            </div>
            <FluxoExtratoUtilShortcuts
              onBusca={handleBusca}
              onRelatorios={onRelatorios}
              onExportar={onExportar}
              onFiltros={onFiltros}
            />
          </div>
        </div>

        <div
          className={cn(
            'sticky top-0 z-20 shrink-0 border-b border-border/50 bg-background px-4 py-2',
            'shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/10 dark:shadow-none',
          )}
        >
          {searchVisible ? (
            <div className={cn('mb-2 flex h-10 items-center gap-2 rounded-lg px-3', P38_SEARCH)}>
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
          ) : null}
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Contas</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <ContasFiltro contas={contas} sel={contasSel} onSel={onContasSel} />
              </div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
              <PeriodoPicker
                periodo={periodo}
                onPeriodo={onPeriodo}
                customStart={customStart}
                customEnd={customEnd}
                onCustom={onCustom}
                inline
              />
              {filtrosPanel}
            </div>
          </div>
        </div>

        <div className={cn('relative min-w-0 px-2 pb-[var(--p38-scroll-pad-below-nav)]', loading && 'opacity-25')}>
          {children}
        </div>
      </div>
    </div>
  );
}
