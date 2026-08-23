import React from 'react';
import FinanceiroFiltrosShell from './FinanceiroFiltrosShell';
import FinanceiroCorteHistoricoFiltro from './FinanceiroCorteHistoricoFiltro';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE } from './financeiroP38';

export const TIPOS_CONTA = [
  { v: 'todos', l: 'Todos' },
  { v: 'Caixa Físico', l: 'Caixa' },
  { v: 'Conta Bancária', l: 'Banco' },
  { v: 'Carteira Digital', l: 'Digital' },
  { v: 'Poupança', l: 'Poupança' },
  { v: 'Investimento', l: 'Investimento' },
];

const STATUS_OPTS = [
  { v: 'ativas', l: 'Ativas' },
  { v: 'inativas', l: 'Inativas' },
  { v: 'todas', l: 'Todas' },
];

export default function FiltrosContasFinanceiras({
  search,
  onSearch,
  filtersOpen,
  onFiltersOpenChange,
  tipoFiltro,
  onTipoFiltro,
  statusFiltro,
  onStatusFiltro,
  somentePendencias,
  onSomentePendencias,
  totalPendencias = 0,
  mostrarHistoricoAnterior = false,
  dataCorteHistorico,
  onMostrarHistoricoAnterior,
  onDataCorteHistorico,
}) {
  const hasActiveFilters =
    tipoFiltro !== 'todos' ||
    statusFiltro !== 'ativas' ||
    somentePendencias ||
    mostrarHistoricoAnterior;

  return (
    <FinanceiroFiltrosShell
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Buscar conta, banco..."
      pulseSensorId="contas-financeiras.busca"
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
      hasActiveFilters={hasActiveFilters}
      conciliacaoPendente={totalPendencias}
      pendentes={somentePendencias}
      onPendentesToggle={onSomentePendencias}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_CONTA.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => onTipoFiltro(v)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${tipoFiltro === v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTS.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => onStatusFiltro(v)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${statusFiltro === v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <FinanceiroCorteHistoricoFiltro
          mostrarHistoricoAnterior={mostrarHistoricoAnterior}
          dataCorte={dataCorteHistorico}
          onMostrarHistoricoAnterior={onMostrarHistoricoAnterior}
          onDataCorte={onDataCorteHistorico}
          contextoLista="saldos desde"
        />
      </div>
    </FinanceiroFiltrosShell>
  );
}
