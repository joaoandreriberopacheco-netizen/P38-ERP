import React from 'react';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';

const STATE_LABELS = {
  viagem_ida: 'Em viagem',
  viagem_retorno: 'Retornando',
  doca_manaus: 'Doca Manaus',
  doca_manaus_final: 'Fila Manaus',
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
      <div className="flex h-full items-center justify-center p-6 text-sm text-white/40 font-['Barlow',sans-serif]">
        Nenhuma embarcação ativa nesta data.
      </div>
    );
  }

  const selected = eventos.find((item) => (item.fleetKey || item.id) === selectedFleetKey) || eventos[0];
  const projection = selected?.riverProjection;
  const ocupacao = Math.round(projection?.ocupacao ?? selected?.ocupacao_percentual_dinamica ?? 0);

  return (
    <div className="flex h-full flex-col border-r border-white/10 bg-[#070707] font-['Barlow',sans-serif]">
      {selected && (
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black">
              <FluvialBoatIcon
                size={16}
                stroke="#ffffff"
                fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
            </div>
            <div>
              <p className="text-[28px] leading-none text-white">{ocupacao}%</p>
              <p className="mt-1 text-[11px] tracking-[0.18em] text-white/45">
                {projection?.initials}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/35">
            {STATE_LABELS[projection?.state] || projection?.statusLabel}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {eventos.map((evento) => {
          const itemProjection = evento.riverProjection;
          const active = (selectedFleetKey || selected?.fleetKey) === (evento.fleetKey || evento.id);
          const nome = (evento.embarcacao_nome || evento.transportadora_nome || '—').toUpperCase();

          return (
            <button
              key={evento.fleetKey || evento.id}
              type="button"
              onClick={() => onSelect?.(evento)}
              className={`flex w-full items-center gap-3 border-b border-white/5 px-5 py-3 text-left transition ${active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'}`}
            >
              <FluvialBoatIcon
                size={12}
                stroke="#ffffff"
                fill={itemProjection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] tracking-wide text-white/90">{nome}</p>
                <p className="text-[10px] tracking-[0.14em] text-white/40">{itemProjection?.initials}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
