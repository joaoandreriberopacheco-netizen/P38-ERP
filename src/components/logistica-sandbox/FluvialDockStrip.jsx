import React from 'react';
import { getEmbarcacaoDisplayName } from '@/lib/fluvialDisplayUtils';
import FluvialVesselAvatar from '@/components/logistica-sandbox/FluvialVesselAvatar';

export default function FluvialDockStrip({
  title,
  subtitle,
  eventos = [],
  selectedFleetKey,
  onSelect,
  side = 'left',
}) {
  return (
    <div className={`fluvial-dock-strip fluvial-dock-strip--${side}`}>
      <div className="fluvial-dock-strip__header">
        <p className="fluvial-dock-strip__title">{title}</p>
        {subtitle ? <p className="fluvial-dock-strip__subtitle">{subtitle}</p> : null}
      </div>
      <div className="fluvial-dock-strip__slots">
        {eventos.length === 0 ? (
          <p className="fluvial-dock-strip__empty">Vazio</p>
        ) : (
          eventos.map((evento) => {
            const key = evento.fleetKey || evento.id;
            const active = selectedFleetKey === key;
            const projection = evento.riverProjection;
            return (
              <button
                key={key}
                type="button"
                className={`fluvial-dock-slot ${active ? 'fluvial-dock-slot--active' : ''}`}
                onClick={() => onSelect?.(evento)}
                title={getEmbarcacaoDisplayName(evento)}
              >
                <FluvialVesselAvatar
                  size={34}
                  initials={projection?.initials || '—'}
                  active={active}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
