import React from 'react';
import { Calendar, Link2 } from 'lucide-react';
import { FLUVIAL_PERIOD_OPTIONS } from '@/components/logistica-sandbox/fluvialDataUtils';
import FluvialViewModeToggle from '@/components/logistica-sandbox/FluvialViewModeToggle';

const EMBARQUE_LINK_OPTIONS = [
  { id: 'todos', label: 'Todas' },
  { id: 'com_vinculo', label: 'Com vínculo' },
  { id: 'sem_vinculo', label: 'Sem vínculo' },
];

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'bg-transparent text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

export default function FluvialFiltersSheetContent({
  viewMode,
  onViewModeChange,
  periodoFiltro,
  onPeriodoFiltroChange,
  embarqueLinkFilter,
  onEmbarqueLinkFilterChange,
  totalViagens = 0,
  totalCarregadas = 0,
}) {
  return (
    <div className="space-y-4">
      <FluvialViewModeToggle
        value={viewMode}
        onChange={onViewModeChange}
        embedded
      />

      <div className="rounded-2xl bg-muted/50 p-3 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtros da timeline</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {totalViagens} de {totalCarregadas} viagem{totalCarregadas !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Período (a partir de hoje)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FLUVIAL_PERIOD_OPTIONS.map((option) => (
              <FilterPill
                key={option.id}
                active={periodoFiltro === option.id}
                onClick={() => onPeriodoFiltroChange?.(option.id)}
              >
                {option.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            Vínculo de embarque
          </p>
          <div className="grid grid-cols-3 gap-2">
            {EMBARQUE_LINK_OPTIONS.map((option) => (
              <FilterPill
                key={option.id}
                active={embarqueLinkFilter === option.id}
                onClick={() => onEmbarqueLinkFilterChange?.(option.id)}
              >
                {option.label}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
