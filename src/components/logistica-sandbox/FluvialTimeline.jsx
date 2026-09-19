import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { FLUVIAL_RIVER_CITIES } from '@/lib/fluvialGeoCoords';
import { cityProgressOnRiver } from '@/lib/fluvialRiverPath';

function parseDateKey(value) {
  if (!value) return null;
  const key = String(value).slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatShortDate(date) {
  if (!date) return '—';
  return format(date, 'dd MMM').toUpperCase();
}

export default function FluvialTimeline({ evento, simulationDate, mapTheme = 'dark' }) {
  const cities = useMemo(
    () => FLUVIAL_RIVER_CITIES.map((city) => ({
      ...city,
      progress: cityProgressOnRiver(city.lat, city.lng),
    })),
    [],
  );

  const vesselProgress = useMemo(() => {
    const projection = evento?.riverProjection;
    if (!projection) return null;

    const { state, segmentProgress = 0 } = projection;
    if (state === 'viagem_ida') return 1 - segmentProgress;
    if (state === 'viagem_retorno') return segmentProgress;
    if (state === 'doca_tabatinga') return 0;
    if (['doca_manaus', 'doca_manaus_final', 'aguardando'].includes(state)) return 1;
    return null;
  }, [evento]);

  const milestones = useMemo(() => {
    if (!evento) return [];
    const items = [];
    const saida = parseDateKey(evento.data_saida_origem);
    const chegada = parseDateKey(evento.data_chegada_destino || evento.previsao_chegada);
    const retorno = parseDateKey(evento.proxima_chegada_manaus);

    if (saida) items.push({ label: formatShortDate(saida), progress: 1, kind: 'saida' });
    if (chegada) items.push({ label: formatShortDate(chegada), progress: 0, kind: 'chegada' });
    if (retorno) items.push({ label: `ETA ${formatShortDate(retorno)}`, progress: 1, kind: 'eta' });

    return items;
  }, [evento]);

  const simulationLabel = useMemo(() => {
    const parsed = parseDateKey(simulationDate);
    return parsed ? format(parsed, 'dd/MM/yyyy') : 'Hoje';
  }, [simulationDate]);

  return (
    <div className={`fluvial-timeline fluvial-timeline--${mapTheme}`} aria-label="Linha do tempo do corredor fluvial">
      <div className="fluvial-timeline__meta">
        <span className="fluvial-timeline__label">Tempo no rio</span>
        <span className="fluvial-timeline__date">{simulationLabel}</span>
      </div>

      <div className="fluvial-timeline__track">
        <div className="fluvial-timeline__line" />
        {cities.map((city) => (
          <div
            key={city.id}
            className="fluvial-timeline__city"
            style={{ left: `${city.progress * 100}%` }}
          >
            <span className="fluvial-timeline__tick" />
            <span className="fluvial-timeline__city-name">{city.label}</span>
          </div>
        ))}
        {vesselProgress != null ? (
          <div
            className="fluvial-timeline__vessel"
            style={{ left: `${vesselProgress * 100}%` }}
            title="Posição projetada"
          />
        ) : null}
      </div>

      {milestones.length > 0 ? (
        <div className="fluvial-timeline__milestones">
          {milestones.map((item) => (
            <span
              key={`${item.kind}-${item.label}`}
              className={`fluvial-timeline__milestone fluvial-timeline__milestone--${item.kind}`}
              style={{ left: `${item.progress * 100}%` }}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
