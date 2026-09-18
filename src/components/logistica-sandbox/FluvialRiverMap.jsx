import React, { useId, useMemo } from 'react';
import {
  FLUVIAL_ROUTE_CURVES,
  FLUVIAL_TERMINALS,
  buildQuadraticPathD,
} from '@/lib/fluvialRiverProjection';
import FluvialMapBackdrop from '@/components/logistica-sandbox/FluvialMapBackdrop';
import boatMarkerUrl from '@/assets/fluvial/boat-marker.svg';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

/** Canvas largo — conteúdo operacional fica no centro com respiro (menos “zoom”). */
const VIEWBOX = '0 0 160 100';
const CONTENT_TRANSFORM = 'translate(30, 19)';

function mapProjectionToCanvas(x, y) {
  return { x: 30 + x, y: 19 + y * 0.95 };
}

function RouteLayer() {
  const idaPath = buildQuadraticPathD(FLUVIAL_ROUTE_CURVES.ida);
  const retornoPath = buildQuadraticPathD(FLUVIAL_ROUTE_CURVES.retorno);

  return (
    <g className="fluvial-routes" transform={CONTENT_TRANSFORM} aria-hidden="true">
      <path d={idaPath} className="fluvial-route-aura fluvial-route-aura--ida" fill="none" />
      <path d={retornoPath} className="fluvial-route-aura fluvial-route-aura--retorno" fill="none" />
      <path d={idaPath} className="fluvial-route-line fluvial-route-line--ida" fill="none" />
      <path d={retornoPath} className="fluvial-route-line fluvial-route-line--retorno" fill="none" />
      <text x="50" y={FLUVIAL_ROUTE_CURVES.ida.cy - 3} className="fluvial-route-label" textAnchor="middle">
        Ida · 7d
      </text>
      <text x="50" y={FLUVIAL_ROUTE_CURVES.retorno.cy + 3} className="fluvial-route-label" textAnchor="middle">
        Retorno · 3d
      </text>
    </g>
  );
}

function TerminalNode({ x, label, sublabel, align = 'center' }) {
  const pos = mapProjectionToCanvas(x, 10);
  const anchor = align === 'right' ? 'end' : align === 'left' ? 'start' : 'middle';

  return (
    <g className="fluvial-terminal-node" transform={`translate(${pos.x}, ${pos.y})`}>
      <circle cx={0} cy={8} r="0.7" className="fluvial-terminal-pin" />
      <text x={0} y={0} textAnchor={anchor} className="fluvial-terminal-title">
        {label}
      </text>
      <text x={0} y={2.8} textAnchor={anchor} className="fluvial-terminal-sub">
        {sublabel}
      </text>
    </g>
  );
}

function BoatMarker({ evento, selected, hovered, onSelect, onHover, uid }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const canvas = mapProjectionToCanvas(projection.x, projection.y);
  const fleetKey = evento.fleetKey || evento.id;
  const isSelected = selected === fleetKey;
  const isHovered = hovered === fleetKey;
  const active = isSelected || isHovered;
  const { vinculo } = projection;
  const label = projection.initials || '—';
  const size = active ? 2.35 : 1.85;
  const rotation = projection.rotation || 0;

  return (
    <g
      className="fluvial-boat-marker"
      transform={`translate(${canvas.x}, ${canvas.y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(evento);
      }}
      onMouseEnter={() => onHover?.(fleetKey)}
      onMouseLeave={() => onHover?.(null)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(evento);
      }}
      aria-label={`${evento.embarcacao_nome || evento.transportadora_nome} (${label})`}
    >
      {vinculo?.glow && (
        <circle r={2.2} className="fluvial-vinculo-glow" fill="none" />
      )}
      {active && (
        <circle r={2.8} fill={`url(#${uid}-marker-glow)`} opacity={isSelected ? 0.65 : 0.3} />
      )}
      <g transform={`rotate(${rotation})`}>
        <image
          href={boatMarkerUrl}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          className={active ? 'fluvial-boat-image--active' : 'fluvial-boat-image'}
          opacity={vinculo?.kind === 'ativo' ? 1 : 0.72}
        />
      </g>
      {active && (
        <text
          y={-size * 0.9}
          textAnchor="middle"
          className="fluvial-boat-label fluvial-boat-label--active"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function FluvialRiverMap({
  eventos = [],
  selectedFleetKey,
  hoveredFleetKey,
  onSelect,
  onHover,
  loading = false,
  embedded = false,
}) {
  const uid = useId().replace(/:/g, '');
  const markers = useMemo(() => eventos || [], [eventos]);

  const selectedProjection = useMemo(() => {
    const found = markers.find((e) => (e.fleetKey || e.id) === selectedFleetKey);
    return found?.riverProjection;
  }, [markers, selectedFleetKey]);

  const selectedCanvas = selectedProjection
    ? mapProjectionToCanvas(selectedProjection.x, selectedProjection.y)
    : null;

  return (
    <div className={`fluvial-premium-root fluvial-map-stage ${embedded ? 'fluvial-map-stage--embedded' : ''}`}>
      <div className="fluvial-map-stage__glow" aria-hidden="true" />
      <div className="fluvial-map-vignette" aria-hidden="true" />

      <div className="fluvial-map-stage__canvas">
        {loading ? (
          <div className="fluvial-map-loading">Carregando frota…</div>
        ) : (
          <svg
            viewBox={VIEWBOX}
            className="fluvial-map-svg"
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="geometricPrecision"
            textRendering="optimizeLegibility"
            aria-label="Mapa fluvial"
            onClick={() => onSelect?.(null)}
          >
            <defs>
              <radialGradient id={`${uid}-marker-glow`}>
                <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>

            <FluvialMapBackdrop uid={uid} />
            <RouteLayer />

            {FLUVIAL_TERMINALS.map((terminal) => (
              <TerminalNode
                key={terminal.id}
                x={terminal.x}
                label={terminal.label}
                sublabel={terminal.sublabel}
                align={terminal.align}
              />
            ))}

            {selectedCanvas && (
              <line
                x1="42"
                y1="28"
                x2={selectedCanvas.x}
                y2={selectedCanvas.y}
                className="fluvial-connection-line"
              />
            )}

            {markers.map((evento) => (
              <BoatMarker
                key={evento.fleetKey || evento.id}
                evento={evento}
                selected={selectedFleetKey}
                hovered={hoveredFleetKey}
                onSelect={onSelect}
                onHover={onHover}
                uid={uid}
              />
            ))}

            {markers.length === 0 && (
              <text x="80" y="52" textAnchor="middle" className="fluvial-map-empty">
                Nenhuma embarcação ativa nesta data
              </text>
            )}
          </svg>
        )}
      </div>

      <div className="fluvial-map-footer" aria-hidden="true">
        <span>Corredor Solimões · posição projetada</span>
      </div>
    </div>
  );
}
