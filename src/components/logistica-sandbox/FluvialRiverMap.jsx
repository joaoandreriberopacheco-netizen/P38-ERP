import React, { useMemo } from 'react';
import {
  buildOvalBottomArcD,
  buildOvalTopArcD,
  FLUVIAL_OVAL,
} from '@/lib/fluvialRiverProjection';
import { fluvialBoatIconPath } from '@/components/logistica-sandbox/FluvialBoatIcon';

const FONT = "'Barlow', sans-serif";
const VIEWBOX = '0 0 100 62';

function BoatMarker({ evento, selected, offsetIndex = 0, onSelect }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const jitterX = (offsetIndex % 3) * 2.2 - 2.2;
  const jitterY = (Math.floor(offsetIndex / 3) % 2) * 1.8 - 0.9;
  const x = projection.x + jitterX;
  const y = projection.y + jitterY;
  const isSelected = selected === evento.id;
  const { vinculo } = projection;
  const stroke = vinculo?.stroke || '#ffffff';
  const fill = vinculo?.kind === 'sem' ? '#000000' : (vinculo?.fill || '#ffffff');
  const label = projection.shortCode || '---';
  const labelY = projection.segment === 'retorno' ? y + 4.8 : y - 4.2;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect?.(evento)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(evento);
      }}
      aria-label={`${evento.embarcacao_nome || evento.transportadora_nome} (${label}) — ${projection.statusLabel}`}
    >
      {projection.temVinculoAtivo && (
        <circle
          cx={x}
          cy={y}
          r={isSelected ? 4.8 : 4}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.25}
          opacity={0.85}
        />
      )}
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          r={5.6}
          fill="none"
          stroke="#ffffff"
          strokeWidth={0.35}
        />
      )}
      <g transform={`translate(${x} ${y}) rotate(${projection.rotation || 0})`}>
        <path
          d={fluvialBoatIconPath(1)}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 0.45 : 0.32}
          strokeLinejoin="round"
        />
      </g>
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="3.2"
        fontFamily={FONT}
        fontWeight="400"
        letterSpacing="0.08em"
      >
        {label}
      </text>
    </g>
  );
}

function clusterMarkers(eventos) {
  const buckets = new Map();
  (eventos || []).forEach((evento) => {
    const p = evento.riverProjection;
    if (!p) return;
    const key = `${Math.round(p.x)}-${Math.round(p.y)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(evento);
  });

  const positioned = [];
  buckets.forEach((group) => {
    group.forEach((evento, index) => {
      positioned.push({ evento, offsetIndex: index });
    });
  });
  return positioned;
}

export default function FluvialRiverMap({
  eventos = [],
  selectedEventoId,
  onSelect,
  simulationDate,
  loading = false,
}) {
  const topArc = useMemo(() => buildOvalTopArcD(), []);
  const bottomArc = useMemo(() => buildOvalBottomArcD(), []);
  const markers = useMemo(() => clusterMarkers(eventos), [eventos]);

  const manausX = FLUVIAL_OVAL.cx + FLUVIAL_OVAL.rx;
  const tabatingaX = FLUVIAL_OVAL.cx - FLUVIAL_OVAL.rx;
  const anchorY = FLUVIAL_OVAL.cy;

  return (
    <div
      className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-black shadow-sm md:min-h-[500px] font-['Barlow',sans-serif]"
      style={{ fontWeight: 400 }}
    >
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Mapa fluvial</p>
          <p className="text-sm text-white">Posição projetada</p>
        </div>
        <div className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70">
          {simulationDate || 'hoje'}
        </div>
      </div>

      <div className="relative z-10 px-2 pb-2">
        {loading ? (
          <div className="flex h-[360px] items-center justify-center text-sm text-white/50 md:h-[440px]">
            Carregando barcos…
          </div>
        ) : (
          <svg viewBox={VIEWBOX} className="h-[360px] w-full md:h-[440px]" aria-label="Mapa fluvial Manaus Tabatinga">
            <defs>
              <marker id="arrow-head" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4 Z" fill="#ffffff" opacity="0.7" />
              </marker>
            </defs>

            <path
              d={topArc}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.35"
              strokeLinecap="round"
              markerEnd="url(#arrow-head)"
              opacity="0.9"
            />
            <path
              d={bottomArc}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.35"
              strokeLinecap="round"
              markerEnd="url(#arrow-head)"
              opacity="0.9"
            />

            <text
              x={tabatingaX - 2}
              y={anchorY - 14}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="4"
              fontFamily={FONT}
              fontWeight="400"
            >
              Tabatinga
            </text>
            <text
              x={manausX + 2}
              y={anchorY - 14}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="4"
              fontFamily={FONT}
              fontWeight="400"
            >
              Manaus
            </text>

            {markers.map(({ evento, offsetIndex }) => (
              <BoatMarker
                key={evento.id}
                evento={evento}
                selected={selectedEventoId}
                offsetIndex={offsetIndex}
                onSelect={onSelect}
              />
            ))}

            {eventos.length === 0 && (
              <text
                x="50"
                y="31"
                textAnchor="middle"
                fill="#ffffff"
                opacity="0.45"
                fontSize="3.5"
                fontFamily={FONT}
              >
                Nenhum barco na data simulada
              </text>
            )}
          </svg>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-4 px-4 pb-4 text-[10px] uppercase tracking-wider text-white/45">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-3 border border-white bg-white" />
          Vínculo ativo
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-3 border border-white/50 bg-white/40" />
          Concluído
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-3 border border-white bg-black" />
          Sem vínculo
        </span>
      </div>
    </div>
  );
}
