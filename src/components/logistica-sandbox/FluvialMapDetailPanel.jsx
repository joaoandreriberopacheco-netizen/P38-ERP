import React from 'react';
import { Anchor, ShipWheel } from 'lucide-react';
import TimelineSidebarCard from '@/components/logistica-sandbox/TimelineSidebarCard';

export default function FluvialMapDetailPanel({ evento }) {
  if (!evento) {
    return (
      <div className="rounded-3xl bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Selecione um barco no mapa para ver a ficha da viagem.
      </div>
    );
  }

  const projection = evento.riverProjection;
  const cyclePercent = Math.round((projection?.cycleProgress || 0) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/40 bg-card/95 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Projetado
          </span>
          {projection?.atrasado && (
            <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-medium text-amber-300">
              Atrasado
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-foreground font-glacial">
          {evento.transportadora_nome || evento.embarcacao_nome}
        </h3>
        <p className="text-sm text-muted-foreground">Viagem {evento.codigo || '—'}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Anchor className="h-3.5 w-3.5" />
              Origem
            </div>
            <p className="mt-1 font-medium text-foreground">Manaus</p>
            <p className="text-muted-foreground">{evento.data_saida_manaus_formatada || '—'}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Anchor className="h-3.5 w-3.5" />
              Destino
            </div>
            <p className="mt-1 font-medium text-foreground">Tabatinga</p>
            <p className="text-muted-foreground">{evento.data_chegada_destino_formatada || '—'}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShipWheel className="h-3.5 w-3.5" />
              {projection?.statusLabel || evento.status_operacao}
            </span>
            <span>{projection?.remainingLabel || ''}</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500/80 to-lime-400/80"
              style={{ width: `${cyclePercent}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-background bg-lime-300 shadow-sm"
              style={{ left: `calc(${cyclePercent}% - 7px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Manaus</span>
            <span>Tabatinga</span>
            <span>Manaus</span>
          </div>
        </div>

        {projection?.vinculo?.label && (
          <p className="mt-3 text-xs text-muted-foreground">{projection.vinculo.label}</p>
        )}
      </div>

      <TimelineSidebarCard evento={evento} />
    </div>
  );
}
