import React from 'react';
import { X } from 'lucide-react';
import { getEmbarcacaoDisplayName } from '@/lib/fluvialDisplayUtils';
import FluvialVesselAvatar from '@/components/logistica-sandbox/FluvialVesselAvatar';
import EventoEmbarquesPanel from '@/components/logistica-sandbox/EventoEmbarquesPanel';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const STATE_LABELS = {
  viagem_ida: 'Em viagem',
  viagem_retorno: 'Retornando',
  doca_manaus: 'Doca Manaus',
  doca_manaus_final: 'Terminal Manaus',
  doca_tabatinga: 'Doca Tabatinga',
  aguardando: 'Aguardando',
};

const STATE_SUB = {
  viagem_ida: 'A caminho de Tabatinga',
  viagem_retorno: 'Retornando para Manaus',
  doca_manaus: 'Carregando no terminal',
  doca_manaus_final: 'Fila virtual de chegada',
  doca_tabatinga: 'Descarregando na doca',
  aguardando: 'Aguardando ciclo',
};

export default function FluvialMapDetailPanel({ evento, onClose, mapTheme = 'dark' }) {
  if (!evento) return null;

  const projection = evento.riverProjection;
  const nome = getEmbarcacaoDisplayName(evento);
  const ocupacao = Math.round(projection?.ocupacao ?? evento.ocupacao_percentual_dinamica ?? 0);
  const cyclePercent = Math.round((projection?.cycleProgress || 0) * 100);
  const stateKey = projection?.state || 'aguardando';

  return (
    <div className={`fluvial-float-panel fluvial-detail-panel fluvial-theme-${mapTheme}`}>
      <div className="fluvial-detail-hero">
        <div className="fluvial-detail-hero__top">
          <FluvialVesselAvatar
            size={56}
            initials={projection?.initials || '—'}
            active
          />
          {onClose ? (
            <button type="button" onClick={onClose} className="fluvial-icon-btn" aria-label="Fechar ficha">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <span className="fluvial-state-pill">{STATE_LABELS[stateKey] || 'Projetado'}</span>
        <h3 className="fluvial-detail-title">{nome}</h3>
        <p className="fluvial-detail-sub">{projection?.initials}</p>
      </div>

      <div className="fluvial-detail-body">
        <div className="fluvial-detail-section">
          <div className="fluvial-detail-route-row">
            <div>
              <div className="fluvial-detail-route-code">MAO</div>
              <div className="fluvial-detail-route-city">Manaus</div>
            </div>
            <div className="fluvial-detail-route-arrow">→</div>
            <div className="text-right">
              <div className="fluvial-detail-route-code">TBT</div>
              <div className="fluvial-detail-route-city">Tabatinga</div>
            </div>
          </div>
        </div>

        <div className="fluvial-detail-section">
          <div className="fluvial-detail-metric-head">
            <div>
              <p className="fluvial-detail-metric-label">Ocupação projetada</p>
              <p className="fluvial-detail-metric-sub">{STATE_SUB[stateKey]}</p>
            </div>
            <p className="fluvial-detail-metric-value">{ocupacao}%</p>
          </div>
          <div className="fluvial-cycle-track">
            <div className="fluvial-cycle-track__fill" style={{ width: `${cyclePercent}%` }} />
            <div className="fluvial-cycle-track__knob" style={{ left: `${cyclePercent}%` }} />
          </div>
          <div className="fluvial-cycle-legend">
            <span>Manaus</span>
            <span>Tabatinga</span>
            <span>Manaus</span>
          </div>
          {projection?.remainingLabel ? (
            <p className="fluvial-detail-metric-sub mt-3">{projection.remainingLabel}</p>
          ) : null}
        </div>

        <div className="fluvial-detail-section">
          <p className="fluvial-detail-copy">
            Saída <strong>{evento.data_saida_manaus_formatada || '—'}</strong>
            {' · '}
            Chegada <strong>{evento.data_chegada_destino_formatada || '—'}</strong>
          </p>
          {projection?.vinculo?.label ? (
            <p className="fluvial-detail-copy mt-2">{projection.vinculo.label}</p>
          ) : null}
        </div>

        <div className="fluvial-detail-section">
          <p className="fluvial-detail-metric-label mb-2">Viagem de referência</p>
          <p className="fluvial-detail-copy">
            Código <strong>{evento.codigo || '—'}</strong>
          </p>
          <p className="fluvial-detail-copy mt-1">
            Próxima chegada Manaus <strong>{evento.proxima_chegada_manaus_formatada || '—'}</strong>
          </p>
        </div>

        <div className="fluvial-detail-section">
          <p className="fluvial-detail-metric-label mb-2">Embarques vinculados</p>
          <EventoEmbarquesPanel embarques={evento.embarques_relacionados || []} />
        </div>
      </div>
    </div>
  );
}
