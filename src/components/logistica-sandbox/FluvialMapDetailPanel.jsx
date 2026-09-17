import React from 'react';
import { X } from 'lucide-react';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';
import EventoEmbarquesPanel from '@/components/logistica-sandbox/EventoEmbarquesPanel';

const STATE_LABELS = {
  viagem_ida: 'Em viagem para Tabatinga',
  viagem_retorno: 'Retornando para Manaus',
  doca_manaus: 'Doca Manaus — carregando',
  doca_manaus_final: 'Terminal Manaus — fila de chegada',
  doca_tabatinga: 'Doca Tabatinga — descarregando',
  aguardando: 'Aguardando ciclo',
};

export default function FluvialMapDetailPanel({ evento, onClose }) {
  if (!evento) return null;

  const projection = evento.riverProjection;
  const nome = evento.transportadora_nome || evento.embarcacao_nome;
  const ocupacao = Math.round(projection?.ocupacao ?? evento.ocupacao_percentual_dinamica ?? 0);

  return (
    <div className="flex h-full flex-col border-l border-white/10 bg-[#080808]/95 backdrop-blur-md font-['Barlow',sans-serif]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black">
            <FluvialBoatIcon
              size={16}
              stroke="#ffffff"
              fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Embarcação</p>
            <h3 className="mt-1 text-lg text-white">{nome}</h3>
            <p className="text-sm tracking-[0.14em] text-white/50">{projection?.initials}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/60 hover:bg-white/10"
            aria-label="Fechar ficha"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-white/40">Ocupação</p>
            <p className="mt-1 text-2xl text-white">{ocupacao}%</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-white/40">Estado</p>
            <p className="mt-1 text-sm text-white">
              {STATE_LABELS[projection?.state] || projection?.statusLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-white/40">Manaus</p>
            <p className="mt-1 text-white">{evento.data_saida_manaus_formatada || '—'}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-white/40">Tabatinga</p>
            <p className="mt-1 text-white">{evento.data_chegada_destino_formatada || '—'}</p>
          </div>
        </div>

        {projection?.remainingLabel ? (
          <p className="text-xs text-white/45">{projection.remainingLabel}</p>
        ) : null}

        {projection?.vinculo?.label ? (
          <p className="text-xs text-white/45">{projection.vinculo.label}</p>
        ) : null}

        <div className="rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Viagem atual</p>
          <p className="text-sm text-white/70">Código {evento.codigo || '—'}</p>
          <p className="mt-1 text-xs text-white/45">
            Chegada Manaus: {evento.data_chegada_manaus_formatada || '—'}
          </p>
          <p className="text-xs text-white/45">
            Próxima chegada Manaus: {evento.proxima_chegada_manaus_formatada || '—'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Embarques vinculados</p>
          <EventoEmbarquesPanel embarques={evento.embarques_relacionados || []} />
        </div>
      </div>
    </div>
  );
}
