import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { FLUVIAL_MAP_LAYOUT } from '@/lib/fluvialRiverProjection';
import { fluvialBoatIconPath } from '@/components/logistica-sandbox/FluvialBoatIcon';

const FONT = "'Barlow', sans-serif";
const VIEWBOX = '0 0 100 62';

function BoatMarker({ evento, selected, onSelect }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const { x, y } = projection;
  const isSelected = selected === evento.fleetKey || selected === evento.id;
  const { vinculo } = projection;
  const stroke = vinculo?.stroke || 'rgba(255,255,255,0.55)';
  const fill = vinculo?.kind === 'sem' ? '#050505' : (vinculo?.fill || '#ffffff');
  const label = projection.initials || '---';
  const onRoute = projection.state === 'viagem_ida' || projection.state === 'viagem_retorno';
  const labelY = onRoute ? y - 3.2 : y - 2.6;
  const scale = isSelected ? 0.72 : 0.58;

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
        <circle cx={x} cy={y} r={2.2} fill="none" stroke="#ffffff" strokeWidth={0.18} opacity={0.75} />
      )}
      {isSelected && (
        <circle cx={x} cy={y} r={2.8} fill="none" stroke="#ffffff" strokeWidth={0.22} />
      )}
      <g transform={`translate(${x} ${y}) rotate(${projection.rotation || 0}) scale(${scale})`}>
        <path
          d={fluvialBoatIconPath(1)}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.28}
          strokeLinejoin="round"
        />
      </g>
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="2.15"
        fontFamily={FONT}
        fontWeight="400"
        letterSpacing="0.14em"
        opacity={isSelected ? 1 : 0.82}
      >
        {label}
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
  const markers = useMemo(() => eventos || [], [eventos]);
  const layout = FLUVIAL_MAP_LAYOUT;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050505] font-['Barlow',sans-serif]" style={{ fontWeight: 400 }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 42%, rgba(255,255,255,0.05) 0, transparent 34%),
            radial-gradient(circle at 72% 58%, rgba(255,255,255,0.04) 0, transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%, rgba(255,255,255,0.02) 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.35) 18px, rgba(255,255,255,0.35) 19px)',
        }}
      />

      <div className="relative z-20 flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Mapa fluvial</p>
          <p className="text-sm text-white/90">Rio Amazonas · posição projetada</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/60">
            {simulationDate || 'hoje'}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/10"
              aria-label="Voltar para lista"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 h-[calc(100%-52px)] px-3 pb-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/45">
            Carregando frota…
          </div>
        ) : (
          <svg viewBox={VIEWBOX} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-label="Mapa fluvial">
            <defs>
              <marker id="fluvial-arrow" markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto">
                <path d="M0,0 L3,1.5 L0,3 Z" fill="rgba(255,255,255,0.55)" />
              </marker>
              <linearGradient id="fluvial-river-haze" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>

            <rect x="0" y="34" width="100" height="18" fill="url(#fluvial-river-haze)" />

            <line
              x1={layout.tabatingaX}
              y1={layout.routeY}
              x2={layout.manausX}
              y2={layout.routeY}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="0.22"
              markerEnd="url(#fluvial-arrow)"
            />
            <line
              x1={layout.tabatingaX}
              y1={layout.routeY + 9}
              x2={layout.manausX}
              y2={layout.routeY + 9}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.18"
              markerEnd="url(#fluvial-arrow)"
              transform={`rotate(180 ${(layout.tabatingaX + layout.manausX) / 2} ${layout.routeY + 9})`}
            />

            <g>
              <rect
                x={layout.tabatingaDockX - 4}
                y={layout.dockTopY - 4}
                width="8"
                height="24"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="0.18"
                rx="1.2"
              />
              <rect
                x={layout.manausDockX - 4}
                y={layout.dockTopY - 4}
                width="8"
                height="34"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="0.18"
                rx="1.2"
              />
              <text
                x={layout.tabatingaDockX}
                y="12"
                textAnchor="middle"
                fill="rgba(255,255,255,0.55)"
                fontSize="2.8"
                fontFamily={FONT}
              >
                Tabatinga
              </text>
              <text
                x={layout.manausDockX}
                y="12"
                textAnchor="middle"
                fill="rgba(255,255,255,0.55)"
                fontSize="2.8"
                fontFamily={FONT}
              >
                Manaus
              </text>
              <text
                x={layout.tabatingaDockX}
                y={layout.dockTopY + 22}
                textAnchor="middle"
                fill="rgba(255,255,255,0.28)"
                fontSize="1.8"
                fontFamily={FONT}
              >
                doca
              </text>
              <text
                x={layout.manausDockX}
                y={layout.dockTopY + 32}
                textAnchor="middle"
                fill="rgba(255,255,255,0.28)"
                fontSize="1.8"
                fontFamily={FONT}
              >
                terminal
              </text>
            </g>

            {markers.map((evento) => (
              <BoatMarker
                key={evento.fleetKey || evento.id}
                evento={evento}
                selected={selectedFleetKey}
                onSelect={onSelect}
              />
            ))}

            {markers.length === 0 && (
              <text x="50" y="31" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="3" fontFamily={FONT}>
                Nenhuma embarcação ativa nesta data
              </text>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
