import React, { useId, useMemo } from 'react';
import { X } from 'lucide-react';
import { FLUVIAL_MAP_LAYOUT } from '@/lib/fluvialRiverProjection';
import { fluvialBoatIconPath } from '@/components/logistica-sandbox/FluvialBoatIcon';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const FONT = "'Barlow', sans-serif";
const VIEWBOX = '0 0 100 62';

function buildRoutePath(x1, y1, x2, y2, bend = -6) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function BoatMarker({ evento, selected, onSelect, uid }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const { x, y } = projection;
  const isSelected = selected === evento.fleetKey || selected === evento.id;
  const { vinculo } = projection;
  const stroke = vinculo?.stroke || 'rgba(255,255,255,0.55)';
  const fill = vinculo?.kind === 'sem' ? '#050505' : (vinculo?.fill || '#ffffff');
  const label = projection.initials || '---';
  const onRoute = projection.state === 'viagem_ida' || projection.state === 'viagem_retorno';
  const labelY = onRoute ? y - 3.4 : y - 2.8;
  const scale = isSelected ? 0.7 : 0.54;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect?.(evento)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(evento);
      }}
      aria-label={`${evento.embarcacao_nome || evento.transportadora_nome} (${label})`}
    >
      {vinculo?.glow && (
        <circle
          className="fluvial-marker-pulse"
          cx={x}
          cy={y}
          r={2.4}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.14}
        />
      )}
      {isSelected && (
        <>
          <circle cx={x} cy={y} r={3.4} fill={`url(#${uid}-marker-glow)`} opacity={0.55} />
          <circle cx={x} cy={y} r={2.9} fill="none" stroke="#ffffff" strokeWidth={0.2} />
        </>
      )}
      <g transform={`translate(${x} ${y}) rotate(${projection.rotation || 0}) scale(${scale})`}>
        <path
          d={fluvialBoatIconPath(1)}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 0.32 : 0.24}
          strokeLinejoin="round"
        />
      </g>
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="2.05"
        fontFamily={FONT}
        fontWeight="400"
        letterSpacing="0.16em"
        opacity={isSelected ? 1 : 0.76}
      >
        {label}
      </text>
    </g>
  );
}

function CityTerminal({ x, label, sublabel, align = 'center' }) {
  const anchor = align === 'right' ? 'end' : align === 'left' ? 'start' : 'middle';
  const rectX = align === 'right' ? x - 14 : align === 'left' ? x - 2 : x - 8;

  return (
    <g>
      <rect
        x={rectX}
        y="7.5"
        width="16"
        height="5.2"
        rx="2.6"
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.15"
      />
      <text x={x} y="10.8" textAnchor={anchor} fill="rgba(255,255,255,0.88)" fontSize="2.35" fontFamily={FONT} letterSpacing="0.08em">
        {label}
      </text>
      <text x={x} y="15.5" textAnchor={anchor} fill="rgba(255,255,255,0.34)" fontSize="1.7" fontFamily={FONT} letterSpacing="0.12em">
        {sublabel}
      </text>
    </g>
  );
}

export default function FluvialRiverMap({
  eventos = [],
  selectedFleetKey,
  onSelect,
  simulationDate,
  loading = false,
  onClose,
}) {
  const uid = useId().replace(/:/g, '');
  const markers = useMemo(() => eventos || [], [eventos]);
  const layout = FLUVIAL_MAP_LAYOUT;

  const routeIda = useMemo(
    () => buildRoutePath(layout.manausX, layout.routeY - 2, layout.tabatingaX, layout.routeY - 2, -7),
    [layout],
  );
  const routeRetorno = useMemo(
    () => buildRoutePath(layout.tabatingaX, layout.routeY + 10, layout.manausX, layout.routeY + 10, 7),
    [layout],
  );

  return (
    <div className="fluvial-premium-root relative h-full w-full overflow-hidden bg-[#030303]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 22%, rgba(255,255,255,0.035) 0, transparent 28%),
            radial-gradient(circle at 82% 68%, rgba(255,255,255,0.03) 0, transparent 24%),
            linear-gradient(115deg, rgba(255,255,255,0.02) 0%, transparent 42%, rgba(255,255,255,0.015) 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="fluvial-map-vignette pointer-events-none absolute inset-0" />

      <div className="relative z-20 flex items-center justify-between px-5 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">Operação fluvial</p>
          <p className="text-sm text-white/88">Amazonas · projeção operacional</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="fluvial-premium-glass rounded-full px-3 py-1 text-[11px] text-white/65">
            {simulationDate || 'hoje'}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="fluvial-premium-glass flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:text-white"
              aria-label="Voltar para lista"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 h-[calc(100%-52px)] px-2 pb-2 md:px-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Carregando frota…
          </div>
        ) : (
          <svg viewBox={VIEWBOX} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="Mapa fluvial">
            <defs>
              <linearGradient id={`${uid}-route-glow`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="45%" stopColor="rgba(255,255,255,0.55)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>
              <radialGradient id={`${uid}-marker-glow`}>
                <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id={`${uid}-soft-glow`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="0.65" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker id={`${uid}-arrow`} markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto">
                <path d="M0,0 L3,1.5 L0,3 Z" fill="rgba(255,255,255,0.65)" />
              </marker>
            </defs>

            <path
              d={routeIda}
              fill="none"
              stroke={`url(#${uid}-route-glow)`}
              strokeWidth="0.85"
              opacity={0.35}
              filter={`url(#${uid}-soft-glow)`}
            />
            <path
              d={routeIda}
              fill="none"
              stroke="rgba(255,255,255,0.42)"
              strokeWidth="0.2"
              className="fluvial-route-animated"
              markerEnd={`url(#${uid}-arrow)`}
            />

            <path
              d={routeRetorno}
              fill="none"
              stroke={`url(#${uid}-route-glow)`}
              strokeWidth="0.7"
              opacity={0.22}
              filter={`url(#${uid}-soft-glow)`}
            />
            <path
              d={routeRetorno}
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="0.16"
              className="fluvial-route-animated"
              markerEnd={`url(#${uid}-arrow)`}
            />

            <rect
              x={layout.tabatingaDockX - 5}
              y={layout.dockTopY - 5}
              width="10"
              height="26"
              rx="2"
              fill="rgba(255,255,255,0.02)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.15"
            />
            <rect
              x={layout.manausDockX - 5}
              y={layout.dockTopY - 5}
              width="10"
              height="36"
              rx="2"
              fill="rgba(255,255,255,0.02)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.15"
            />

            <CityTerminal x={layout.tabatingaDockX} label="TABATINGA" sublabel="doca oeste" />
            <CityTerminal x={layout.manausDockX} label="MANAUS" sublabel="terminal leste" align="right" />

            {markers.map((evento) => (
              <BoatMarker
                key={evento.fleetKey || evento.id}
                evento={evento}
                selected={selectedFleetKey}
                onSelect={onSelect}
                uid={uid}
              />
            ))}

            {markers.length === 0 && (
              <text x="50" y="31" textAnchor="middle" fill="rgba(255,255,255,0.32)" fontSize="2.8" fontFamily={FONT}>
                Nenhuma embarcação ativa nesta data
              </text>
            )}
          </svg>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden md:flex gap-4 text-[10px] uppercase tracking-[0.16em] text-white/35">
        <span>Ida · 7d</span>
        <span>Descarga · 4d</span>
        <span>Retorno · 3d</span>
        <span>Terminal · fila virtual</span>
      </div>
    </div>
  );
}
