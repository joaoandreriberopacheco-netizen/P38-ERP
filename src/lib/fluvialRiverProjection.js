import { differenceInCalendarDays, format } from 'date-fns';
import { normalizeFluvialDateKey, projectFluvialOcupacaoPercentual } from '@/components/logistica-sandbox/fluvialDataUtils';
import { normalizeEmbarcacaoDisplayName } from '@/lib/fluvialDisplayUtils';

export const FLUVIAL_DOCK_TABATINGA_DAYS = 4;
export const FLUVIAL_RETURN_DAYS = 3;

export const FLUVIAL_MAP_LAYOUT = {
  manausX: 88,
  tabatingaX: 12,
  routeYIda: 41,
  routeYRetorno: 53,
  manausTerminalBaseX: 91,
  tabatingaTerminalBaseX: 9,
  dockTopY: 22,
  dockRowSpacing: 6.8,
  dockColSpacing: 5.5,
  routeLaneSpacing: 3.2,
  /** Aliases para compatibilidade com componentes legados */
  routeY: 41,
  manausDockX: 91,
  tabatingaDockX: 9,
  dockSpacing: 5.2,
};

export const FLUVIAL_TERMINALS = [
  {
    id: 'tabatinga',
    x: FLUVIAL_MAP_LAYOUT.tabatingaTerminalBaseX,
    label: 'TABATINGA',
    sublabel: 'doca oeste',
    align: 'left',
  },
  {
    id: 'manaus',
    x: FLUVIAL_MAP_LAYOUT.manausTerminalBaseX,
    label: 'MANAUS',
    sublabel: 'terminal leste',
    align: 'right',
  },
];

export const FLUVIAL_ROUTE_CURVES = {
  ida: { x1: 88, y1: 41, cx: 50, cy: 33, x2: 12, y2: 41 },
  retorno: { x1: 12, y1: 53, cx: 50, cy: 61, x2: 88, y2: 53 },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseStableDate(value) {
  const key = normalizeFluvialDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDaysDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

function isShortLeadWord(word = '') {
  const clean = String(word).replace(/\./g, '');
  return clean.length > 0 && clean.length <= 3;
}

/**
 * Siglas operacionais da frota (3 caracteres).
 * Ex.: Vitória Regia → VIT; Banzeiro → BAN; M. Monteiro 2 → MM2; Rio Negro → RNG.
 */
export function getEmbarcacaoInitials(evento = {}) {
  const rawName = evento.embarcacao_nome || evento.transportadora_nome || '';
  const nome = normalizeBoatName(normalizeEmbarcacaoDisplayName(rawName) || rawName);
  const tokens = nome.split(/\s+/).filter(Boolean);

  let suffixNum = '';
  const words = [...tokens];
  if (words.length > 0 && /^\d+$/.test(words[words.length - 1])) {
    suffixNum = words.pop();
  }

  if (words.length === 0) {
    return suffixNum ? suffixNum.padStart(3, '0').slice(0, 3) : '---';
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).padEnd(3, 'X');
  }

  const [first, second] = words;

  if (isShortLeadWord(first) && second) {
    const lead = first.replace(/\./g, '');
    const a = lead[0] || 'X';
    const b = second[0] || 'X';
    if (suffixNum) return `${a}${b}${suffixNum}`.slice(0, 3);
    return `${a}${b}${firstConsonantFrom(second, 1)}`;
  }

  if (suffixNum) {
    return `${first.slice(0, 2)}${suffixNum}`.slice(0, 3);
  }

  return first.slice(0, 3).padEnd(3, 'X');
}

export function pointOnQuadraticBezier(t, { x1, y1, cx, cy, x2, y2 }) {
  const p = clamp(t, 0, 1);
  const mt = 1 - p;
  return {
    x: mt * mt * x1 + 2 * mt * p * cx + p * p * x2,
    y: mt * mt * y1 + 2 * mt * p * cy + p * p * y2,
  };
}

export function buildQuadraticPathD({ x1, y1, cx, cy, x2, y2 }) {
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function tangentAngleOnQuadraticBezier(t, curve) {
  const p = clamp(t, 0, 1);
  const mt = 1 - p;
  const dx = 2 * mt * (curve.cx - curve.x1) + 2 * p * (curve.x2 - curve.cx);
  const dy = 2 * mt * (curve.cy - curve.y1) + 2 * p * (curve.y2 - curve.cy);
  return (Math.atan2(dy, dx) * 180) / Math.PI - 90;
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
      glow: true,
      label: `${ativos} vínculo${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''}`,
    };
  }
  if (total > 0) {
    return {
      kind: 'concluido',
      stroke: '#9ca3af',
      fill: '#4b5563',
      glow: false,
      label: `${total} vínculo${total !== 1 ? 's' : ''} concluído${total !== 1 ? 's' : ''}`,
    };
  }
  return {
    kind: 'sem',
    stroke: 'rgba(255,255,255,0.5)',
    fill: 'transparent',
    glow: false,
    label: 'Sem vínculos',
  };
}

function resolveDepartureLoad(evento) {
  const stored = Number(evento.ocupacao_percentual);
  if (Number.isFinite(stored) && stored > 0) return Math.min(100, Math.round(stored));
  if (Number(evento.ocupacao_percentual_dinamica) > 0) {
    return Math.min(100, Math.round(evento.ocupacao_percentual_dinamica));
  }
  return 100;
}

function projectTabatingaUnloadPercent(evento, simulationDate) {
  const chegadaTabatinga = parseStableDate(evento.data_chegada_destino || evento.previsao_chegada);
  if (!chegadaTabatinga || simulationDate < chegadaTabatinga) return null;

  const fimDescarga = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS);
  if (simulationDate >= fimDescarga) return 0;

  const startLoad = resolveDepartureLoad(evento);
  const progress = computeSegmentProgress(simulationDate, chegadaTabatinga, fimDescarga);
  return Math.max(0, Math.round(startLoad * (1 - progress)));
}

function detectOperationalState(evento, simulationDate) {
  const chegadaManaus = parseStableDate(evento.data_chegada_manaus);
  const saidaManaus = parseStableDate(evento.data_saida_origem);
  const chegadaTabatinga = parseStableDate(evento.data_chegada_destino || evento.previsao_chegada);
  const proximaChegadaManaus = parseStableDate(evento.proxima_chegada_manaus);

  if (!simulationDate || !chegadaManaus) {
    return { state: 'indefinido', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
  }

  if (simulationDate < chegadaManaus) {
    return { state: 'aguardando', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
  }

  if (saidaManaus && simulationDate < saidaManaus) {
    return { state: 'doca_manaus', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
  }

  if (chegadaTabatinga && saidaManaus && simulationDate < chegadaTabatinga) {
    return { state: 'viagem_ida', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
  }

  if (chegadaTabatinga) {
    const fimDescarga = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS);
    if (simulationDate < fimDescarga) {
      return { state: 'doca_tabatinga', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
    }

    const fimRetorno = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS + FLUVIAL_RETURN_DAYS);
    if (simulationDate < fimRetorno) {
      return { state: 'viagem_retorno', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
    }
  }

  if (proximaChegadaManaus && simulationDate < proximaChegadaManaus) {
    return { state: 'doca_manaus_final', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
  }

  return { state: 'ciclo_concluido', chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus };
}

function isEventoInCycle(evento, simulationDate) {
  const simulation = parseStableDate(simulationDate);
  const inicio = parseStableDate(evento.data_chegada_manaus);
  const fim = parseStableDate(evento.proxima_chegada_manaus)
    || parseStableDate(evento.data_chegada_destino);

  if (!simulation || !inicio) return false;
  if (!fim) return simulation >= inicio;
  return simulation >= inicio && simulation <= fim;
}

function pickActiveEventoForTransportadora(eventos, simulationDateKey) {
  const simulation = parseStableDate(simulationDateKey);
  const candidatos = (eventos || []).filter((evento) => isEventoInCycle(evento, simulationDateKey));

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    const aStart = parseStableDate(a.data_chegada_manaus)?.getTime() || 0;
    const bStart = parseStableDate(b.data_chegada_manaus)?.getTime() || 0;
    return Math.abs(aStart - simulation.getTime()) - Math.abs(bStart - simulation.getTime());
  });

  return candidatos[0];
}

function getManausQueueTimestamp(evento, state) {
  const chegadaTabatinga = parseStableDate(evento.data_chegada_destino || evento.previsao_chegada);
  if (state === 'doca_manaus_final' && chegadaTabatinga) {
    return addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS + FLUVIAL_RETURN_DAYS).getTime();
  }
  return parseStableDate(evento.data_chegada_manaus)?.getTime() || 0;
}

function assignManausTerminalSlot(index) {
  const layout = FLUVIAL_MAP_LAYOUT;
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: layout.manausTerminalBaseX - col * layout.dockColSpacing,
    y: layout.dockTopY + row * layout.dockRowSpacing,
  };
}

function assignTabatingaTerminalSlot(index) {
  const layout = FLUVIAL_MAP_LAYOUT;
  return {
    x: layout.tabatingaTerminalBaseX,
    y: layout.dockTopY + index * layout.dockRowSpacing,
  };
}

export function projectBoatPositionOnRiver(evento, simulationDateKey) {
  const simulationDate = parseStableDate(simulationDateKey);
  const { state, chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus } = detectOperationalState(evento, simulationDate);
  const vinculo = resolveVinculoGlow(evento);
  const atraso = Number(evento?.dias_atraso) || 0;
  const initials = getEmbarcacaoInitials(evento);
  const layout = FLUVIAL_MAP_LAYOUT;

  let x = layout.manausTerminalBaseX;
  let y = layout.routeYIda;
  let rotation = -90;
  let statusLabel = 'Indefinido';
  let remainingLabel = '';
  let nextMilestone = null;
  let ocupacao = projectFluvialOcupacaoPercentual(evento, simulationDateKey);
  let segmentProgress = 0;
  let routeBucket = null;

  if (state === 'doca_manaus' || state === 'doca_manaus_final' || state === 'aguardando') {
    rotation = 180;
    statusLabel = state === 'doca_manaus_final'
      ? 'Terminal Manaus — fila e carga'
      : state === 'aguardando'
        ? 'Aguardando ciclo'
        : 'Doca Manaus — carregando';

    if (state === 'doca_manaus_final' && chegadaTabatinga && proximaChegadaManaus) {
      const chegadaFila = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS + FLUVIAL_RETURN_DAYS);
      ocupacao = projectFluvialOcupacaoPercentual({
        ...evento,
        data_chegada_manaus: format(chegadaFila, 'yyyy-MM-dd'),
        data_saida_origem: format(proximaChegadaManaus, 'yyyy-MM-dd'),
      }, simulationDateKey);
      segmentProgress = computeSegmentProgress(simulationDate, chegadaFila, proximaChegadaManaus);
      nextMilestone = proximaChegadaManaus;
    } else if (state === 'doca_manaus') {
      ocupacao = projectFluvialOcupacaoPercentual(evento, simulationDateKey);
      segmentProgress = computeSegmentProgress(simulationDate, chegadaManaus, saidaManaus);
      nextMilestone = saidaManaus;
    } else {
      nextMilestone = chegadaManaus;
      ocupacao = 0;
    }
  } else if (state === 'viagem_ida') {
    segmentProgress = computeSegmentProgress(simulationDate, saidaManaus, chegadaTabatinga);
    const point = pointOnQuadraticBezier(segmentProgress, FLUVIAL_ROUTE_CURVES.ida);
    x = point.x;
    y = point.y;
    rotation = tangentAngleOnQuadraticBezier(segmentProgress, FLUVIAL_ROUTE_CURVES.ida);
    statusLabel = 'Em viagem → Tabatinga';
    nextMilestone = chegadaTabatinga;
    ocupacao = resolveDepartureLoad(evento);
    routeBucket = `ida:${Math.round(segmentProgress * 40)}`;
  } else if (state === 'doca_tabatinga') {
    rotation = 0;
    statusLabel = 'Doca Tabatinga — descarregando';
    ocupacao = projectTabatingaUnloadPercent(evento, simulationDate) ?? 0;
    nextMilestone = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS);
    segmentProgress = computeSegmentProgress(
      simulationDate,
      chegadaTabatinga,
      addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS),
    );
  } else if (state === 'viagem_retorno') {
    const retornoInicio = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS);
    const retornoFim = addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS + FLUVIAL_RETURN_DAYS);
    segmentProgress = computeSegmentProgress(simulationDate, retornoInicio, retornoFim);
    const point = pointOnQuadraticBezier(segmentProgress, FLUVIAL_ROUTE_CURVES.retorno);
    x = point.x;
    y = point.y;
    rotation = tangentAngleOnQuadraticBezier(segmentProgress, FLUVIAL_ROUTE_CURVES.retorno);
    statusLabel = 'Retornando → Manaus';
    nextMilestone = retornoFim;
    ocupacao = 0;
    routeBucket = `ret:${Math.round(segmentProgress * 40)}`;
  } else {
    statusLabel = evento?.status_operacao || 'Fora do ciclo';
    ocupacao = 0;
  }

  if (nextMilestone) {
    const days = differenceInCalendarDays(nextMilestone, simulationDate);
    remainingLabel = formatRemainingDays(days);
  }

  const cycleProgress = state === 'viagem_ida'
    ? 0.12 + segmentProgress * 0.38
    : state === 'doca_tabatinga'
      ? 0.52
      : state === 'viagem_retorno'
        ? 0.58 + segmentProgress * 0.28
        : state === 'doca_manaus' || state === 'doca_manaus_final'
          ? segmentProgress * 0.1
          : 0;

  return {
    state,
    segmentProgress,
    pathProgress: segmentProgress,
    x,
    y,
    rotation,
    initials,
    shortCode: initials,
    statusLabel,
    remainingLabel,
    ocupacao,
    temVinculoAtivo: vinculo.kind === 'ativo',
    vinculo,
    atrasado: atraso > 0,
    cycleProgress,
    routeBucket,
    queueIndex: 0,
    laneOffset: 0,
  };
}

function applyFleetLayoutOffsets(fleet) {
  const manausQueue = fleet
    .filter((item) => ['doca_manaus', 'doca_manaus_final', 'aguardando'].includes(item.riverProjection.state))
    .sort((a, b) => getManausQueueTimestamp(a, a.riverProjection.state) - getManausQueueTimestamp(b, b.riverProjection.state));

  manausQueue.forEach((item, index) => {
    const slot = assignManausTerminalSlot(index);
    item.riverProjection.x = slot.x;
    item.riverProjection.y = slot.y;
    item.riverProjection.queueIndex = index;
  });

  const tabatingaQueue = fleet
    .filter((item) => item.riverProjection.state === 'doca_tabatinga')
    .sort((a, b) => parseStableDate(a.data_chegada_destino)?.getTime() - parseStableDate(b.data_chegada_destino)?.getTime());

  tabatingaQueue.forEach((item, index) => {
    const slot = assignTabatingaTerminalSlot(index);
    item.riverProjection.x = slot.x;
    item.riverProjection.y = slot.y;
    item.riverProjection.queueIndex = index;
  });

  const routeBuckets = new Map();
  fleet.forEach((item) => {
    const bucket = item.riverProjection.routeBucket;
    if (!bucket) return;
    if (!routeBuckets.has(bucket)) routeBuckets.set(bucket, []);
    routeBuckets.get(bucket).push(item);
  });

  routeBuckets.forEach((group) => {
    group.forEach((item, index) => {
      const lane = index - (group.length - 1) / 2;
      item.riverProjection.laneOffset = lane;
      item.riverProjection.y += lane * FLUVIAL_MAP_LAYOUT.routeLaneSpacing;
    });
  });
}

export function buildFluvialFleetMapModels(eventos = [], simulationDateKey) {
  const porTransportadora = new Map();

  (eventos || []).forEach((evento) => {
    const transportadoraId = evento.transportadora_id || evento.embarcacao_template_id;
    if (!transportadoraId) return;
    if (!porTransportadora.has(transportadoraId)) {
      porTransportadora.set(transportadoraId, []);
    }
    porTransportadora.get(transportadoraId).push(evento);
  });

  const fleet = [];

  porTransportadora.forEach((viagens, transportadoraId) => {
    const ativa = pickActiveEventoForTransportadora(viagens, simulationDateKey);
    if (!ativa) return;

    const projectionPreview = projectBoatPositionOnRiver(ativa, simulationDateKey);
    if (!projectionPreview.state || projectionPreview.state === 'ciclo_concluido' || projectionPreview.state === 'indefinido') {
      return;
    }

    fleet.push({
      ...ativa,
      transportadora_id: transportadoraId,
      fleetKey: transportadoraId,
      riverProjection: projectionPreview,
    });
  });

  applyFleetLayoutOffsets(fleet);

  return fleet.sort((a, b) => (a.embarcacao_nome || '').localeCompare(b.embarcacao_nome || '', 'pt-BR'));
}

export function enrichEventosWithRiverProjection(eventos, simulationDateKey) {
  return buildFluvialFleetMapModels(eventos, simulationDateKey);
}

export function isEventoActiveAtSimulation(evento, simulationDateKey) {
  return isEventoInCycle(evento, simulationDateKey);
}

export function formatSimulationDateLabel(simulationDateKey) {
  const parsed = parseStableDate(simulationDateKey);
  return parsed ? format(parsed, 'dd/MM/yyyy') : '-';
}

export function getBoatShortCode(evento) {
  return getEmbarcacaoInitials(evento);
}
