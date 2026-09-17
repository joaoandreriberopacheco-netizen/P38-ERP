import React from 'react';
import { Ship } from 'lucide-react';

export default function FluvialBoatListSidebar({
  eventos = [],
  selectedEventoId,
  onSelect,
}) {
  if (!eventos.length) {
    return (
      <div className="rounded-3xl border border-border/40 bg-card p-4 text-sm text-muted-foreground">
        Nenhum barco visível com os filtros atuais.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border/40 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Barcos ativos</p>
        <p className="text-sm font-medium text-foreground">{eventos.length} viagem{eventos.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-border/30">
        {eventos.map((evento) => {
          const projection = evento.riverProjection;
          const active = selectedEventoId === evento.id;
          const glow = projection?.vinculo?.color || '#e4e4e7';

          return (
            <button
              key={evento.id}
              type="button"
              onClick={() => onSelect?.(evento)}
              className={`w-full text-left px-4 py-3 transition-colors ${active ? 'bg-muted/60' : 'hover:bg-muted/30'}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    boxShadow: projection?.temVinculoAtivo ? `0 0 12px ${glow}88` : 'none',
                    backgroundColor: `${glow}33`,
                  }}
                >
                  <Ship className="h-4 w-4 text-foreground/90" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {evento.embarcacao_nome || evento.transportadora_nome}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {evento.codigo || 'Sem código'} · {projection?.statusLabel || '—'}
                  </p>
                  {projection?.remainingLabel && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{projection.remainingLabel}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
