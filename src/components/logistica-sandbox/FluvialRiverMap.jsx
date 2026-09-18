import React, { useId, useMemo } from 'react';
import {
  FLUVIAL_ROUTE_CURVES,
  FLUVIAL_TERMINALS,
  buildQuadraticPathD,
} from '@/lib/fluvialRiverProjection';
import { fluvialBoatIconPath } from '@/components/logistica-sandbox/FluvialBoatIcon';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const FONT = "'Barlow', sans-serif";
const VIEWBOX = '0 0 100 62';

function RiverAtmosphere({ uid }) {
  return (
    <g className="fluvial-atmosphere" aria-hidden="true">
      <ellipse cx="50" cy="47" rx="46" ry="10" fill={`url(#${uid}-river-mist)`} />
      <path
        d="M -4 44 C 14 38, 28 50, 46 44 S 68 38, 86 44 S 98 48, 104 43"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M -4 46 C 18 40, 34 52, 52 46 S 72 40, 92 46 S 100 50, 104 45"
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M -4 47.5 C 22 42, 40 54, 58 47.5 S 78 41, 104 47"
        fill="none"
        stroke="rgba(255,255,255,0.11)"
        strokeWidth="0.35"
        strokeLinecap="round"
      />
    </g>
  );
}

function RouteLayer({ uid }) {
  const idaPath = buildQuadraticPathD(FLUVIAL_ROUTE_CURVES.ida);
  const retornoPath = buildQuadraticPathD(FLUVIAL_ROUTE_CURVES.retorno);
  const idaMid = { x: 50, y: FLUVIAL_ROUTE_CURVES.ida.cy - 3 };
  const retMid = { x: 50, y: FLUVIAL_ROUTE_CURVES.retorno.cy + 3 };

  return (
    <g className="fluvial-routes" aria-hidden="true">
      <path d={idaPath} className="fluvial-route-aura fluvial-route-aura--ida" fill="none" />
      <path d={retornoPath} className="fluvial-route-aura fluvial-route-aura--retorno" fill="none" />
      <path d={idaPath} className="fluvial-route-line fluvial-route-line--ida" fill="none" />
      <path d={retornoPath} className="fluvial-route-line fluvial-route-line--retorno" fill="none" />
      <text x={idaMid.x} y={idaMid.y} className="fluvial-route-label" textAnchor="middle">
        Ida · 7 dias
      </text>
      <text x={retMid.x} y={retMid.y} className="fluvial-route-label" textAnchor="middle">
        Retorno · 3 dias
      </text>
    </g>
  );
}

function TerminalNode({ x, label, sublabel, align = 'center' }) {
  const anchor = align === 'right' ? 'end' : align === 'left' ? 'start' : 'middle';
  const y = 12;

  return (
    <g className="fluvial-terminal-node">
      <circle cx={x} cy={y + 6} r="1.1" className="fluvial-terminal-pin" />
      <circle cx={x} cy={y + 6} r="3.8" className="fluvial-terminal-ring" fill="none" />
      <text x={x} y={y} textAnchor={anchor} className="fluvial-terminal-title">
        {label}
      </text>
      <text x={x} y={y + 3.8} textAnchor={anchor} className="fluvial-terminal-sub">
        {sublabel}
      </text>
    </g>
  );
}

function BoatMarker({ evento, selected, hovered, onSelect, onHover, uid }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const { x, y, rotation = 0 } = projection;
  const fleetKey = evento.fleetKey || evento.id;
  const isSelected = selected === fleetKey;
  const isHovered = hovered === fleetKey;
  const active = isSelected || isHovered;
  const { vinculo } = projection;
  const label = projection.initials || '—';
  const onRoute = projection.state === 'viagem_ida' || projection.state === 'viagem_retorno';
  const hullScale = isSelected ? 0.42 : isHovered ? 0.36 : 0.3;
  const fill = vinculo?.kind === 'ativo' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)';
  const stroke = active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';

  return (
    <g
      className="fluvial-boat-marker"
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
        <circle cx={x} cy={y} r={1.8} className="fluvial-vinculo-glow" fill="none" />
      )}
      {active && (
        <circle cx={x} cy={y} r={2.6} fill={`url(#${uid}-marker-glow)`} opacity={isSelected ? 0.7 : 0.35} />
      )}
      <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${hullScale})`}>
        <path
          d={fluvialBoatIconPath(1)}
          fill={fill}
          stroke={stroke}
          strokeWidth={active ? 0.18 : 0.14}
          strokeLinejoin="round"
          filter={active ? `url(#${uid}-marker-sharp)` : undefined}
        />
      </g>
      <text
        x={x}
        y={onRoute ? y - 2.6 : y - 2.2}
        textAnchor="middle"
        className={`fluvial-boat-label ${active ? 'fluvial-boat-label--active' : ''}`}
      >
        {label}
      </text>
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

  return (
    <div className={`fluvial-premium-root fluvial-map-stage ${embedded ? 'fluvial-map-stage--embedded' : ''}`}>
      <div className="fluvial-map-stage__glow" aria-hidden="true" />
      <div className="fluvial-map-stage__grid" aria-hidden="true" />
      <div className="fluvial-map-vignette" aria-hidden="true" />

      <div className="fluvial-map-stage__canvas">
        {loading ? (
          <div className="fluvial-map-loading">Carregando frota…</div>
        ) : (
          <svg
            viewBox={VIEWBOX}
            className="fluvial-map-svg"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Mapa fluvial"
            onClick={() => onSelect?.(null)}
          >
            <defs>
              <radialGradient id={`${uid}-river-mist`}>
                <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <radialGradient id={`${uid}-marker-glow`}>
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id={`${uid}-marker-sharp`} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="0.15" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <RiverAtmosphere uid={uid} />
            <RouteLayer uid={uid} />

            {FLUVIAL_TERMINALS.map((terminal) => (
              <TerminalNode
                key={terminal.id}
                x={terminal.x}
                label={terminal.label}
                sublabel={terminal.sublabel}
                align={terminal.align}
              />
            ))}

            {selectedProjection && (
              <line
                x1="18"
                y1="22"
                x2={selectedProjection.x}
                y2={selectedProjection.y}
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
              <text x="50" y="31" textAnchor="middle" className="fluvial-map-empty">
                Nenhuma embarcação ativa nesta data
              </text>
            )}
          </svg>
        )}
      </div>

      <div className="fluvial-map-footer" aria-hidden="true">
        <span>Posição projetada</span>
        <span className="fluvial-map-footer__dot" />
        <span>não é GPS</span>
      </div>
    </div>
  );
}
