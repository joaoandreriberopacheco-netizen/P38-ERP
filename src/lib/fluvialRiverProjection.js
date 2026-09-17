import { differenceInCalendarDays, format } from 'date-fns';
import { normalizeFluvialDateKey } from '@/components/logistica-sandbox/fluvialDataUtils';

/**
 * Waypoints simplificados Manaus → Tabatinga (coordenadas normalizadas 0–100 para SVG).
 * Não é geografia exata — transmite o fluxo do rio.
 */
export const AMAZON_ROUTE_WAYPOINTS = [
  { t: 0, x: 6, y: 58, label: 'Manaus' },
  { t: 0.08, x: 12, y: 54 },
  { t: 0.16, x: 20, y: 50 },
  { t: 0.24, x: 28, y: 48 },
  { t: 0.32, x: 36, y: 46 },
  { t: 0.4, x: 44, y: 44 },
  { t: 0.48, x: 52, y: 43 },
  { t: 0.56, x: 60, y: 44 },
  { t: 0.64, x: 68, y: 46 },
  { t: 0.72, x: 76, y: 48 },
  { t: 0.84, x: 86, y: 50 },
  { t: 1, x: 94, y: 52, label: 'Tabatinga' },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseStableDate(value) {
  const key = normalizeFluvialDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeSegmentProgress(simulationDate, startDate, endDate) {
  if (!simulationDate || !startDate || !endDate) return 0;
  const total = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY));
  const elapsed = Math.max(0, Math.round((simulationDate - startDate) / MS_PER_DAY));
  return clamp(elapsed / total, 0, 1);
}

export function interpolateRiverPoint(pathProgress) {
  const t = clamp(pathProgress, 0, 1);
  const points = AMAZON_ROUTE_WAYPOINTS;
  if (t <= points[0].t) return { x: points[0].x, y: points[0].y };
  if (t >= points[points.length - 1].t) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const ratio = (t - a.t) / span;
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
      };
    }
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

export function buildRiverPathD() {
  const points = AMAZON_ROUTE_WAYPOINTS;
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

function formatRemainingDays(days) {
  if (days <= 0) return 'Chegada prevista hoje';
  if (days === 1) return '1 dia restante';
  return `${days} dias restantes`;
}

export function resolveVinculoGlow(evento = {}) {
  const ativos = Number(evento.total_embarques_ativos) || 0;
  const total = Number(evento.total_embarques_relacionados) || 0;

  if (ativos > 0) {
    return {
      kind: 'ativo',
      color: '#bef264',
      label: `${ativos} vínculo${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''}`,
    };
  }
  if (total > 0) {
    return {
      kind: 'concluido',
      color: '#a1a1aa',
      label: `${total} vínculo${total !== 1 ? 's' : ''} concluído${total !== 1 ? 's' : ''}`,
    };
  }
  return {
    kind: 'sem',
    color: '#e4e4e7',
    label: 'Sem vínculos',
  };
}

/**
 * Projeta posição do barco no rio a partir das datas da viagem e da data simulada.
 */
export function projectBoatPositionOnRiver(evento, simulationDateKey) {
  const simulationDate = parseStableDate(simulationDateKey);
  const chegadaManaus = parseStableDate(evento?.data_chegada_manaus);
  const saidaManaus = parseStableDate(evento?.data_saida_origem);
  const chegadaTabatinga = parseStableDate(evento?.data_chegada_destino || evento?.previsao_chegada);
  const proximaChegadaManaus = parseStableDate(evento?.proxima_chegada_manaus);

  const vinculo = resolveVinculoGlow(evento);
  const atraso = Number(evento?.dias_atraso) || 0;

  if (!simulationDate || !chegadaManaus) {
    return {
      segment: 'fora_ciclo',
      pathProgress: 0,
      segmentProgress: 0,
      x: AMAZON_ROUTE_WAYPOINTS[0].x,
      y: AMAZON_ROUTE_WAYPOINTS[0].y,
      statusLabel: 'Sem datas',
      remainingLabel: '',
      temVinculoAtivo: vinculo.kind === 'ativo',
      vinculo,
      atrasado: atraso > 0,
    };
  }

  let segment = 'fora_ciclo';
  let pathProgress = 0;
  let segmentProgress = 0;
  let statusLabel = 'Fora do ciclo';
  let remainingLabel = '';
  let nextMilestone = null;

  if (simulationDate < chegadaManaus) {
    segment = 'aguardando';
    pathProgress = 0;
    statusLabel = 'Aguardando chegada em Manaus';
    nextMilestone = chegadaManaus;
  } else if (saidaManaus && simulationDate < saidaManaus) {
    segment = 'atracado_manaus';
    pathProgress = 0;
    segmentProgress = computeSegmentProgress(simulationDate, chegadaManaus, saidaManaus);
    statusLabel = 'Atracado em Manaus';
    nextMilestone = saidaManaus;
  } else if (chegadaTabatinga && saidaManaus && simulationDate < chegadaTabatinga) {
    segment = 'ida';
    segmentProgress = computeSegmentProgress(simulationDate, saidaManaus, chegadaTabatinga);
    pathProgress = segmentProgress;
    statusLabel = 'Em viagem → Tabatinga';
    nextMilestone = chegadaTabatinga;
  } else if (proximaChegadaManaus && chegadaTabatinga && simulationDate < proximaChegadaManaus) {
    segment = 'retorno';
    segmentProgress = computeSegmentProgress(simulationDate, chegadaTabatinga, proximaChegadaManaus);
    pathProgress = 1 - segmentProgress; // volta de Tabatinga para Manaus
    statusLabel = 'Retornando → Manaus';
    nextMilestone = proximaChegadaManaus;
  } else if (proximaChegadaManaus && simulationDate >= proximaChegadaManaus) {
    segment = 'atracado_manaus';
    pathProgress = 0;
    statusLabel = 'Atracado em Manaus';
    remainingLabel = 'Ciclo concluído';
  } else if (chegadaTabatinga && simulationDate >= chegadaTabatinga) {
    segment = 'atracado_tabatinga';
    pathProgress = 1;
    statusLabel = 'Atracado em Tabatinga';
  } else {
    segment = 'ida';
    pathProgress = 0.5;
    statusLabel = evento?.status_operacao || 'Em viagem';
  }

  if (nextMilestone) {
    const days = differenceInCalendarDays(nextMilestone, simulationDate);
    remainingLabel = formatRemainingDays(days);
  }

  const point = interpolateRiverPoint(pathProgress);

  return {
    segment,
    pathProgress,
    segmentProgress,
    x: point.x,
    y: point.y,
    statusLabel,
    remainingLabel,
    temVinculoAtivo: vinculo.kind === 'ativo',
    vinculo,
    atrasado: atraso > 0,
    cycleProgress: segment === 'ida'
      ? pathProgress * 0.5
      : segment === 'retorno'
        ? 0.5 + segmentProgress * 0.5
        : segment === 'atracado_tabatinga'
          ? 0.5
          : segment === 'atracado_manaus'
            ? 0
            : pathProgress * 0.25,
  };
}

export function isEventoActiveAtSimulation(evento, simulationDateKey) {
  const simulationDate = parseStableDate(simulationDateKey);
  const chegadaManaus = parseStableDate(evento?.data_chegada_manaus);
  const proximaChegadaManaus = parseStableDate(evento?.proxima_chegada_manaus);
  const saidaManaus = parseStableDate(evento?.data_saida_origem);

  if (!simulationDate) return false;

  const cycleStart = chegadaManaus || saidaManaus;
  if (!cycleStart) return false;

  const cycleEnd = proximaChegadaManaus
    || parseStableDate(evento?.data_chegada_destino)
    || saidaManaus;

  if (!cycleEnd) return simulationDate >= cycleStart;
  return simulationDate >= cycleStart && simulationDate <= cycleEnd;
}

export function enrichEventosWithRiverProjection(eventos, simulationDateKey) {
  return (eventos || []).map((evento) => ({
    ...evento,
    riverProjection: projectBoatPositionOnRiver(evento, simulationDateKey),
  }));
}

export function formatSimulationDateLabel(simulationDateKey) {
  const parsed = parseStableDate(simulationDateKey);
  return parsed ? format(parsed, 'dd/MM/yyyy') : '-';
}
