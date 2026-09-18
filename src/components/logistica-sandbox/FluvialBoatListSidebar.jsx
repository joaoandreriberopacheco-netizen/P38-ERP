import React from 'react';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const STATE_SHORT = {
  viagem_ida: 'Viagem',
  viagem_retorno: 'Retorno',
  doca_manaus: 'Manaus',
  doca_manaus_final: 'Terminal',
  doca_tabatinga: 'Tabatinga',
  aguardando: 'Aguarde',
};

export default function FluvialBoatListSidebar({
  eventos = [],
  selectedFleetKey,
  onSelect,
  floating = false,
}) {
  const panelClass = floating
    ? 'fluvial-float-panel fluvial-float-panel--sidebar h-full'
    : 'fluvial-premium-root flex h-full flex-col border-r border-white/10 bg-[#040404]/80 backdrop-blur-md';

  if (!eventos.length) {
    return (
      <div className={`${panelClass} items-center justify-center p-6 text-sm text-white/40`}>
        Nenhuma embarcação ativa nesta data.
      </div>
    );
  }

  const selected = eventos.find((item) => (item.fleetKey || item.id) === selectedFleetKey) || eventos[0];
  const projection = selected?.riverProjection;
  const ocupacao = Math.round(projection?.ocupacao ?? selected?.ocupacao_percentual_dinamica ?? 0);

  return (
    <div className={panelClass}>
      <div className="fluvial-float-header">
        Frota ativa · {eventos.length} embarcação{eventos.length !== 1 ? 'ões' : ''}
      </div>

      {selected && (
        <div className="mx-3 mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50">
              <FluvialBoatIcon
                size={14}
                stroke="#ffffff"
                fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
            </div>
            <div>
              <p className="text-2xl leading-none text-white">{ocupacao}%</p>
              <p className="mt-1 text-[10px] tracking-[0.14em] text-white/45">{projection?.initials}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/38">
            {STATE_SHORT[projection?.state] || '—'}
          </p>
        </div>
      )}

      <div className="fluvial-float-body mt-1">
        {eventos.map((evento) => {
          const itemProjection = evento.riverProjection;
          const fleetKey = evento.fleetKey || evento.id;
          const active = (selectedFleetKey || selected?.fleetKey) === fleetKey;
          const nome = evento.embarcacao_nome || evento.transportadora_nome || '—';
          const initials = itemProjection?.initials || '—';

          return (
            <button
              key={fleetKey}
              type="button"
              onClick={() => onSelect?.(evento)}
              className={`fluvial-fleet-item ${active ? 'fluvial-fleet-item--selected' : ''}`}
            >
              <span className="fluvial-fleet-item-initials">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="fluvial-fleet-item-name">{nome}</p>
                <p className="fluvial-fleet-item-state">
                  {STATE_SHORT[itemProjection?.state] || '—'}
                  {itemProjection?.temVinculoAtivo ? ' · vínculo ativo' : ''}
                </p>
              </div>
              <FluvialBoatIcon
                size={11}
                stroke="#ffffff"
                fill={itemProjection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
