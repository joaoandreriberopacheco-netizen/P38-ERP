import React from 'react';
import { X } from 'lucide-react';
import FluvialBoatIcon from '@/components/logistica-sandbox/FluvialBoatIcon';
import EventoEmbarquesPanel from '@/components/logistica-sandbox/EventoEmbarquesPanel';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const STATE_LABELS = {
  viagem_ida: 'EM VIAGEM',
  viagem_retorno: 'RETORNANDO',
  doca_manaus: 'DOCA MANAUS',
  doca_manaus_final: 'TERMINAL MANAUS',
  doca_tabatinga: 'DOCA TABATINGA',
  aguardando: 'AGUARDANDO',
};

const STATE_SUB = {
  viagem_ida: 'Em viagem para Tabatinga',
  viagem_retorno: 'Retornando para Manaus',
  doca_manaus: 'Carregando no terminal',
  doca_manaus_final: 'Fila virtual de chegada',
  doca_tabatinga: 'Descarregando na doca',
  aguardando: 'Aguardando ciclo',
};

export default function FluvialMapDetailPanel({ evento, onClose }) {
  if (!evento) return null;

  const projection = evento.riverProjection;
  const nome = evento.transportadora_nome || evento.embarcacao_nome;
  const ocupacao = Math.round(projection?.ocupacao ?? evento.ocupacao_percentual_dinamica ?? 0);
  const cyclePercent = Math.round((projection?.cycleProgress || 0) * 100);
  const stateKey = projection?.state || 'aguardando';

  return (
    <div className="fluvial-detail-panel fluvial-premium-root flex h-full flex-col border-l border-white/10">
      <div className="fluvial-premium-glass m-3 flex flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/60">
                <FluvialBoatIcon
                  size={22}
                  stroke="#ffffff"
                  fill={projection?.temVinculoAtivo ? '#ffffff' : '#000000'}
                />
              </div>
              <div>
                <span className="inline-flex rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] tracking-[0.14em] text-white/75">
                  {STATE_LABELS[stateKey] || 'PROJETADO'}
                </span>
                <h3 className="mt-2 text-xl leading-tight text-white">{nome}</h3>
                <p className="mt-1 text-sm tracking-[0.18em] text-white/45">{projection?.initials}</p>
              </div>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/55 hover:bg-white/10"
                aria-label="Fechar ficha"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">De</p>
              <p className="mt-1 text-sm text-white">Manaus</p>
              <p className="mt-1 text-xs text-white/45">{evento.data_saida_manaus_formatada || '—'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Para</p>
              <p className="mt-1 text-sm text-white">Tabatinga</p>
              <p className="mt-1 text-xs text-white/45">{evento.data_chegada_destino_formatada || '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Progresso do ciclo</p>
                <p className="mt-1 text-sm text-white/70">{STATE_SUB[stateKey]}</p>
              </div>
              <p className="text-3xl leading-none text-white">{ocupacao}%</p>
            </div>
            <div className="relative h-px bg-white/15">
              <div
                className="absolute inset-y-0 left-0 bg-white/70"
                style={{ width: `${cyclePercent}%`, height: '1px' }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-black bg-white shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                style={{ left: `calc(${cyclePercent}% - 5px)` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-white/35">
              <span>Manaus</span>
              <span>Tabatinga</span>
              <span>Manaus</span>
            </div>
            {projection?.remainingLabel ? (
              <p className="mt-3 text-xs text-white/45">{projection.remainingLabel}</p>
            ) : null}
          </div>

          {projection?.vinculo?.label ? (
            <p className="text-xs text-white/45">{projection.vinculo.label}</p>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/40">Viagem de referência</p>
            <p className="text-sm text-white/65">Código {evento.codigo || '—'}</p>
            <p className="mt-1 text-xs text-white/40">Chegada Manaus {evento.data_chegada_manaus_formatada || '—'}</p>
            <p className="text-xs text-white/40">Próxima chegada {evento.proxima_chegada_manaus_formatada || '—'}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/40">Embarques vinculados</p>
            <EventoEmbarquesPanel embarques={evento.embarques_relacionados || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
