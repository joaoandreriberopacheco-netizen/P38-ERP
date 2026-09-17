import React from 'react';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';

export default function FluvialBoatListSidebar({
  eventos = [],
  selectedEventoId,
  onSelect,
}) {
  if (!eventos.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black p-4 text-sm text-white/50 font-['Barlow',sans-serif]">
        Nenhum barco visível com os filtros atuais.
      </div>
    );
  }

  const selected = eventos.find((item) => item.id === selectedEventoId) || eventos[0];
  const ocupacao = Math.round(selected?.ocupacao_percentual_dinamica || selected?.ocupacao_percentual || 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black font-['Barlow',sans-serif]">
      {selected && (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/30">
              <FluvialBoatIcon size={18} stroke="#ffffff" fill={selected.riverProjection?.temVinculoAtivo ? '#ffffff' : '#000000'} />
            </div>
            <div>
              <p className="text-2xl leading-none text-white">{ocupacao}%</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                {selected.riverProjection?.shortCode}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-[calc(100vh-260px)] divide-y divide-white/10 overflow-y-auto">
        {eventos.map((evento) => {
          const projection = evento.riverProjection;
          const active = selectedEventoId === evento.id;
          const nome = (evento.embarcacao_nome || evento.transportadora_nome || '—').toUpperCase();

          return (
            <button
              key={evento.id}
              type="button"
              onClick={() => onSelect?.(evento)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              <FluvialBoatIcon
                size={14}
                stroke="#ffffff"
                fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] tracking-wide text-white">{nome}</p>
                <p className="text-[10px] text-white/45">{projection?.shortCode}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
