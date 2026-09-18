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
}) {
  if (!eventos.length) {
    return (
      <div className="fluvial-premium-root flex h-full items-center justify-center p-6 text-sm text-white/40">
        Nenhuma embarcação ativa nesta data.
      </div>
    );
  }

  const selected = eventos.find((item) => (item.fleetKey || item.id) === selectedFleetKey) || eventos[0];
  const projection = selected?.riverProjection;
  const ocupacao = Math.round(projection?.ocupacao ?? selected?.ocupacao_percentual_dinamica ?? 0);

  return (
    <div className="fluvial-premium-root flex h-full flex-col border-r border-white/10 bg-[#040404]/80 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Frota ativa</p>
        <p className="mt-1 text-xs text-white/55">{eventos.length} embarcação{eventos.length !== 1 ? 'ões' : ''}</p>
      </div>

      {selected && (
        <div className="fluvial-premium-glass mx-3 mt-3 rounded-2xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/50">
              <FluvialBoatIcon
                size={16}
                stroke="#ffffff"
                fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
            </div>
            <div>
              <p className="text-[26px] leading-none text-white">{ocupacao}%</p>
              <p className="mt-1 text-[11px] tracking-[0.16em] text-white/45">{projection?.initials}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/38">
            {STATE_SHORT[projection?.state] || '—'}
          </p>
        </div>
      )}

      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
        {eventos.map((evento) => {
          const itemProjection = evento.riverProjection;
          const active = (selectedFleetKey || selected?.fleetKey) === (evento.fleetKey || evento.id);
          const nome = (evento.embarcacao_nome || evento.transportadora_nome || '—').toUpperCase();

          return (
            <button
              key={evento.fleetKey || evento.id}
              type="button"
              onClick={() => onSelect?.(evento)}
              className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'fluvial-premium-glass' : 'hover:bg-white/[0.04]'}`}
            >
              <FluvialBoatIcon
                size={12}
                stroke="#ffffff"
                fill={itemProjection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] tracking-wide text-white/88">{nome}</p>
                <p className="text-[10px] tracking-[0.14em] text-white/38">
                  {itemProjection?.initials} · {STATE_SHORT[itemProjection?.state] || '—'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
