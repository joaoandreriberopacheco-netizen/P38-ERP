import React from 'react';
import TimelineSidebarCard from '@/components/logistica-sandbox/TimelineSidebarCard';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';

export default function FluvialMapDetailPanel({ evento }) {
  if (!evento) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black p-5 text-sm text-white/50 font-['Barlow',sans-serif]">
        Selecione um barco no mapa para ver a ficha da viagem.
      </div>
    );
  }

  const projection = evento.riverProjection;
  const cyclePercent = Math.round((projection?.cycleProgress || 0) * 100);
  const nome = evento.transportadora_nome || evento.embarcacao_nome;

  return (
    <div className="space-y-4 font-['Barlow',sans-serif]">
      <div className="rounded-3xl border border-white/10 bg-black p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25">
            <FluvialBoatIcon
              size={18}
              stroke="#ffffff"
              fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Projetado</p>
            <h3 className="mt-1 text-lg text-white">{nome}</h3>
            <p className="text-sm text-white/55">
              {projection?.shortCode} · {evento.codigo || 'Sem código'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-white/10 p-3">
            <p className="text-white/45">Manaus</p>
            <p className="mt-1 text-white">{evento.data_saida_manaus_formatada || '—'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-3">
            <p className="text-white/45">Tabatinga</p>
            <p className="mt-1 text-white">{evento.data_chegada_destino_formatada || '—'}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/55">
            <span>{projection?.statusLabel || evento.status_operacao}</span>
            <span>{projection?.remainingLabel || ''}</span>
          </div>
          <div className="relative h-px bg-white/20">
            <div
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-black bg-white"
              style={{ left: `calc(${cyclePercent}% - 4px)` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/40">
            <span>Manaus</span>
            <span>Tabatinga</span>
            <span>Manaus</span>
          </div>
        </div>

        {projection?.vinculo?.label && (
          <p className="mt-3 text-xs text-white/45">{projection.vinculo.label}</p>
        )}
      </div>

      <TimelineSidebarCard evento={evento} />
    </div>
  );
}
