import { differenceInCalendarDays, format } from 'date-fns';
import { normalizeFluvialDateKey } from '@/components/logistica-sandbox/fluvialDataUtils';

/** Oval Manaus (direita) ↔ Tabatinga (esquerda) — viewBox 0 0 100 62 */
export const FLUVIAL_OVAL = { cx: 50, cy: 31, rx: 40, ry: 22 };

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

function normalizeBoatName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();
}

function firstConsonantFrom(word, start = 1) {
  for (let i = start; i < word.length; i += 1) {
    const char = word[i];
    if (/[BCDFGHJKLMNPQRSTVWXYZ]/.test(char)) return char;
  }
  return word[Math.min(start, word.length - 1)] || 'X';
}

function lastConsonant(word) {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const char = word[i];
    if (/[BCDFGHJKLMNPQRSTVWXYZ]/.test(char)) return char;
  }
  return word[word.length - 1] || 'X';
}

/**
 * Sigla de 3 letras — ex.: Vitória Regia → VRG, Rio Negro → RNG.
 */
export function getBoatShortCode(evento = {}) {
  const codigo = String(evento.codigo || '').replace(/[^a-zA-Z0-9]/g, '');
  if (codigo.length >= 3) return codigo.slice(0, 3).toUpperCase();

  const nome = normalizeBoatName(evento.embarcacao_nome || evento.transportadora_nome || '');
  const words = nome.split(/\s+/).filter(Boolean);

  if (words.length >= 3) {
    return words.slice(0, 3).map((word) => word[0]).join('');
  }

  if (words.length === 2) {
    const [first, second] = words;
    return `${first[0] || 'X'}${second[0] || 'X'}${firstConsonantFrom(second, 1)}`;
  }

  if (words.length === 1) {
    const word = words[0];
    if (word.length <= 3) return word.padEnd(3, 'X');
    const mid = word[Math.floor(word.length / 2)] || word[1];
    return `${word[0]}${mid}${lastConsonant(word)}`;
  }

  return '---';
}

function pointOnOval(theta) {
  return {
    x: FLUVIAL_OVAL.cx + FLUVIAL_OVAL.rx * Math.cos(theta),
    y: FLUVIAL_OVAL.cy + FLUVIAL_OVAL.ry * Math.sin(theta),
    theta,
  };
}

/** Arco superior: Manaus (θ=0) → Tabatinga (θ=−π) */
export function interpolateIdaArc(progress) {
  const theta = -Math.PI * clamp(progress, 0, 1);
  return pointOnOval(theta);
}

/** Arco inferior: Tabatinga (θ=π) → Manaus (θ=0) */
export function interpolateRetornoArc(progress) {
  const theta = Math.PI + Math.PI * clamp(progress, 0, 1);
  return pointOnOval(theta);
}

export function buildOvalTopArcD() {
  const { cx, cy, rx, ry } = FLUVIAL_OVAL;
  return `M ${cx + rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx - rx} ${cy}`;
}

export function buildOvalBottomArcD() {
  const { cx, cy, rx, ry } = FLUVIAL_OVAL;
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
}

function tangentDegrees(theta) {
  const dx = -FLUVIAL_OVAL.rx * Math.sin(theta);
  const dy = FLUVIAL_OVAL.ry * Math.cos(theta);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function computeSegmentProgress(simulationDate, startDate, endDate) {
  if (!simulationDate || !startDate || !endDate) return 0;
  const total = Math.max(1, Math.round((endDate - startDate) / MS_PER_DAY));
  const elapsed = Math.max(0, Math.round((simulationDate - startDate) / MS_PER_DAY));
  return clamp(elapsed / total, 0, 1);
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
      stroke: '#ffffff',
      fill: '#ffffff',
      label: `${ativos} vínculo${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''}`,
    };
  }
  if (total > 0) {
    return {
      kind: 'concluido',
      stroke: '#a3a3a3',
      fill: '#737373',
      label: `${total} vínculo${total !== 1 ? 's' : ''} concluído${total !== 1 ? 's' : ''}`,
    };
  }
  return {
    kind: 'sem',
    stroke: '#ffffff',
    fill: 'transparent',
    label: 'Sem vínculos',
  };
}

export function projectBoatPositionOnRiver(evento, simulationDateKey) {
  const simulationDate = parseStableDate(simulationDateKey);
  const chegadaManaus = parseStableDate(evento?.data_chegada_manaus);
  const saidaManaus = parseStableDate(evento?.data_saida_origem);
  const chegadaTabatinga = parseStableDate(evento?.data_chegada_destino || evento?.previsao_chegada);
  const proximaChegadaManaus = parseStableDate(evento?.proxima_chegada_manaus);

  const vinculo = resolveVinculoGlow(evento);
  const atraso = Number(evento?.dias_atraso) || 0;
  const shortCode = getBoatShortCode(evento);
  const manausPoint = pointOnOval(0);

  if (!simulationDate || !chegadaManaus) {
    return {
      segment: 'fora_ciclo',
      pathProgress: 0,
      segmentProgress: 0,
      x: manausPoint.x,
      y: manausPoint.y,
      rotation: 0,
      shortCode,
      statusLabel: 'Sem datas',
      remainingLabel: '',
      temVinculoAtivo: vinculo.kind === 'ativo',
      vinculo,
      atrasado: atraso > 0,
      cycleProgress: 0,
    };
  }

  let segment = 'fora_ciclo';
  let pathProgress = 0;
  let segmentProgress = 0;
  let statusLabel = 'Fora do ciclo';
  let remainingLabel = '';
  let nextMilestone = null;
  let point = manausPoint;
  let rotation = 180;

  if (simulationDate < chegadaManaus) {
    segment = 'aguardando';
    point = manausPoint;
    rotation = 180;
    statusLabel = 'Aguardando chegada em Manaus';
    nextMilestone = chegadaManaus;
  } else if (saidaManaus && simulationDate < saidaManaus) {
    segment = 'atracado_manaus';
    segmentProgress = computeSegmentProgress(simulationDate, chegadaManaus, saidaManaus);
    point = manausPoint;
    rotation = 180;
    statusLabel = 'Atracado em Manaus';
    nextMilestone = saidaManaus;
  } else if (chegadaTabatinga && saidaManaus && simulationDate < chegadaTabatinga) {
    segment = 'ida';
    segmentProgress = computeSegmentProgress(simulationDate, saidaManaus, chegadaTabatinga);
    pathProgress = segmentProgress;
    point = interpolateIdaArc(segmentProgress);
    rotation = tangentDegrees(point.theta) - 90;
    statusLabel = 'Em viagem → Tabatinga';
    nextMilestone = chegadaTabatinga;
  } else if (proximaChegadaManaus && chegadaTabatinga && simulationDate < proximaChegadaManaus) {
    segment = 'retorno';
    segmentProgress = computeSegmentProgress(simulationDate, chegadaTabatinga, proximaChegadaManaus);
    pathProgress = segmentProgress;
    point = interpolateRetornoArc(segmentProgress);
    rotation = tangentDegrees(point.theta) - 90;
    statusLabel = 'Retornando → Manaus';
    nextMilestone = proximaChegadaManaus;
  } else if (proximaChegadaManaus && simulationDate >= proximaChegadaManaus) {
    segment = 'atracado_manaus';
    point = manausPoint;
    rotation = 0;
    statusLabel = 'Atracado em Manaus';
    remainingLabel = 'Ciclo concluído';
  } else if (chegadaTabatinga && simulationDate >= chegadaTabatinga) {
    segment = 'atracado_tabatinga';
    point = pointOnOval(Math.PI);
    rotation = 0;
    statusLabel = 'Atracado em Tabatinga';
  } else {
    segment = 'ida';
    pathProgress = 0.5;
    point = interpolateIdaArc(0.5);
    rotation = tangentDegrees(point.theta) - 90;
    statusLabel = evento?.status_operacao || 'Em viagem';
  }

  if (nextMilestone) {
    const days = differenceInCalendarDays(nextMilestone, simulationDate);
    remainingLabel = formatRemainingDays(days);
  }

  const cycleProgress = segment === 'ida'
    ? pathProgress * 0.5
    : segment === 'retorno'
      ? 0.5 + segmentProgress * 0.5
      : segment === 'atracado_tabatinga'
        ? 0.5
        : segment === 'atracado_manaus' || segment === 'aguardando'
          ? 0
          : pathProgress * 0.25;

  return {
    segment,
    pathProgress,
    segmentProgress,
    x: point.x,
    y: point.y,
    rotation,
    shortCode,
    statusLabel,
    remainingLabel,
    temVinculoAtivo: vinculo.kind === 'ativo',
    vinculo,
    atrasado: atraso > 0,
    cycleProgress,
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
