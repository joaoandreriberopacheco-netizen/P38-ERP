import React, { useMemo } from 'react';
import { Anchor } from 'lucide-react';
import { buildRiverPathD } from '@/lib/fluvialRiverProjection';

const VIEWBOX = '0 0 100 70';

function BoatMarker({ evento, selected, offsetIndex = 0, onSelect }) {
  const projection = evento.riverProjection;
  if (!projection) return null;

  const jitterX = (offsetIndex % 3) * 1.8 - 1.8;
  const jitterY = Math.floor(offsetIndex / 3) * 1.6 - 0.8;
  const x = projection.x + jitterX;
  const y = projection.y + jitterY;
  const isSelected = selected === evento.id;
  const glow = projection.vinculo?.color || '#e4e4e7';
  const glowOpacity = projection.temVinculoAtivo ? 0.95 : projection.vinculo?.kind === 'concluido' ? 0.55 : 0.35;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect?.(evento)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(evento);
      }}
      aria-label={`${evento.embarcacao_nome || evento.transportadora_nome} — ${projection.statusLabel}`}
    >
      {projection.temVinculoAtivo && (
        <circle cx={x} cy={y} r={isSelected ? 5.2 : 4.4} fill={glow} opacity={0.35}>
          <animate attributeName="r" values="4;5.2;4" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={x}
        cy={y}
        r={isSelected ? 3.6 : 3}
        fill={glow}
        stroke={isSelected ? '#fafafa' : 'rgba(255,255,255,0.5)'}
        strokeWidth={isSelected ? 0.6 : 0.35}
        opacity={glowOpacity}
      />
      {projection.atrasado && (
        <circle cx={x + 2.2} cy={y - 2.2} r={1.1} fill="#facc15" stroke="#0a0a0a" strokeWidth={0.2} />
      )}
      <path
        d={`M ${x - 1.1} ${y + 0.6} L ${x} ${y - 1.2} L ${x + 1.1} ${y + 0.6} Z`}
        fill="#0a0a0a"
        opacity={0.85}
      />
      {isSelected && (
        <text x={x} y={y + 6.5} textAnchor="middle" className="fill-white text-[2.8px] font-medium">
          {evento.codigo || evento.embarcacao_nome?.slice(0, 10)}
        </text>
      )}
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
  const riverPath = useMemo(() => buildRiverPathD(), []);
  const markers = useMemo(() => clusterMarkers(eventos), [eventos]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-[#0c0f14] shadow-sm min-h-[420px] md:min-h-[520px]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(30,58,95,0.35),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(15,40,30,0.25),transparent_50%)]" />

      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-400">Mapa fluvial</p>
          <p className="text-sm font-medium text-zinc-100 font-glacial">Posição projetada no rio</p>
        </div>
        <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-300">
          Simulação: {simulationDate || 'hoje'}
        </div>
      </div>

      <div className="relative z-10 px-2 pb-3">
        {loading ? (
          <div className="flex h-[360px] md:h-[460px] items-center justify-center text-sm text-zinc-400">
            Carregando barcos…
          </div>
        ) : (
          <svg viewBox={VIEWBOX} className="h-[360px] w-full md:h-[460px]" aria-label="Mapa do rio Amazonas">
            <defs>
              <linearGradient id="riverGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.15" />
              </linearGradient>
              <filter id="riverBlur">
                <feGaussianBlur stdDeviation="0.8" />
              </filter>
            </defs>

            <path
              d={riverPath}
              fill="none"
              stroke="url(#riverGlow)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#riverBlur)"
              opacity={0.55}
            />
            <path
              d={riverPath}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.55"
              strokeLinecap="round"
              strokeDasharray="1.5 2"
            />

            <g>
              <circle cx={AMAZON_ANCHOR_MANAUS.x} cy={AMAZON_ANCHOR_MANAUS.y} r={2.2} fill="#fafafa" opacity={0.9} />
              <text x={AMAZON_ANCHOR_MANAUS.x} y={AMAZON_ANCHOR_MANAUS.y + 5.5} textAnchor="middle" className="fill-zinc-300 text-[3px]">
                Manaus
              </text>
              <circle cx={AMAZON_ANCHOR_TABATINGA.x} cy={AMAZON_ANCHOR_TABATINGA.y} r={2.2} fill="#fafafa" opacity={0.9} />
              <text x={AMAZON_ANCHOR_TABATINGA.x} y={AMAZON_ANCHOR_TABATINGA.y + 5.5} textAnchor="middle" className="fill-zinc-300 text-[3px]">
                Tabatinga
              </text>
            </g>

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
              <text x="50" y="35" textAnchor="middle" className="fill-zinc-500 text-[3.5px]">
                Nenhum barco no período / data simulada
              </text>
            )}
          </svg>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3 px-4 pb-4 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_8px_rgba(190,242,100,0.8)]" />
          Com vínculo ativo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
          Vínculo concluído
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          Sem vínculo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Anchor className="h-3 w-3" />
          Posição estimada — não é GPS
        </span>
      </div>
    </div>
  );
}

const AMAZON_ANCHOR_MANAUS = { x: 6, y: 58 };
const AMAZON_ANCHOR_TABATINGA = { x: 94, y: 52 };
