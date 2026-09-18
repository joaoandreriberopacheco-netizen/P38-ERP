import React from 'react';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const STATE_SHORT = {
  viagem_ida: 'Em viagem',
  viagem_retorno: 'Retornando',
  doca_manaus: 'Doca Manaus',
  doca_manaus_final: 'Terminal Manaus',
  doca_tabatinga: 'Doca Tabatinga',
  aguardando: 'Aguardando',
};

export default function FluvialBoatListSidebar({
  eventos = [],
  selectedFleetKey,
  onSelect,
}) {
  if (!eventos.length) {
    return (
      <div className="fluvial-float-panel">
        <div className="fluvial-float-header">Frota ativa</div>
        <div className="fluvial-float-body flex items-center justify-center text-sm text-white/35">
          Nenhuma embarcação ativa nesta data.
        </div>
      </div>
    );
  }

  return (
    <div className="fluvial-float-panel">
      <div className="fluvial-float-header">
        Frota ativa · {eventos.length}
      </div>
      <div className="fluvial-float-body fluvial-float-body--tight">
        {eventos.map((evento, index) => {
          const itemProjection = evento.riverProjection;
          const fleetKey = evento.fleetKey || evento.id;
          const active = selectedFleetKey === fleetKey;
          const nome = evento.embarcacao_nome || evento.transportadora_nome || '—';
          const initials = itemProjection?.initials || '—';

          return (
            <React.Fragment key={fleetKey}>
              {index > 0 ? <div className="fluvial-fleet-divider" /> : null}
              <button
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
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
