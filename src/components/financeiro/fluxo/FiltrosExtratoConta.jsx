import React from 'react';
import FinanceiroFiltrosShell from './FinanceiroFiltrosShell';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE } from './financeiroP38';

export const PERIODOS_EXTRATO = [
  { v: 'hoje', l: 'Hoje' },
  { v: 'ontem', l: 'Ontem' },
  { v: 'semana', l: 'Semana' },
  { v: 'mes', l: 'Mês' },
  { v: 'todos', l: 'Tudo' },
  { v: 'personalizado', l: 'Período' },
];

export default function FiltrosExtratoConta({
  search,
  onSearch,
  filtersOpen,
  onFiltersOpenChange,
  periodo,
  onPeriodo,
  cs,
  ce,
  onCs,
  onCe,
}) {
  const hasActiveFilters = periodo !== 'mes' || !!cs || !!ce;

  return (
    <FinanceiroFiltrosShell
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Buscar movimentação..."
      pulseSensorId="extrato-conta.busca"
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
      hasActiveFilters={hasActiveFilters}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS_EXTRATO.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => onPeriodo(p.v)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${periodo === p.v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {periodo === 'personalizado' && (
          <div className="flex gap-2">
            <input
              autoComplete="off"
              type="date"
              value={cs}
              onChange={(e) => onCs(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-secondary/80 px-2.5 py-2 text-sm text-foreground outline-none dark:bg-[#383e47]"
            />
            <input
              autoComplete="off"
              type="date"
              value={ce}
              onChange={(e) => onCe(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-secondary/80 px-2.5 py-2 text-sm text-foreground outline-none dark:bg-[#383e47]"
            />
          </div>
        )}
      </div>
    </FinanceiroFiltrosShell>
  );
}
