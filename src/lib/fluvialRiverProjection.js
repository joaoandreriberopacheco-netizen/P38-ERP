import { differenceInCalendarDays, format } from 'date-fns';
import { normalizeFluvialDateKey, projectFluvialOcupacaoPercentual } from '@/components/logistica-sandbox/fluvialDataUtils';

export const FLUVIAL_DOCK_TABATINGA_DAYS = 4;
export const FLUVIAL_RETURN_DAYS = 3;

/** Layout normalizado 0–100. Manaus = leste (direita), Tabatinga = oeste (esquerda). */
export const FLUVIAL_MAP_LAYOUT = {
  manausX: 90,
  tabatingaX: 10,
  routeY: 48,
  manausDockX: 93,
  tabatingaDockX: 7,
  dockTopY: 22,
  dockSpacing: 7,
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

function lastConsonant(word) {
  for (let i = word.length - 1; i >= 0; i -= 1) {
    const char = word[i];
    if (/[BCDFGHJKLMNPQRSTVWXYZ]/.test(char)) return char;
  }
  return word[word.length - 1] || 'X';
}

/** Iniciais da embarcação (nunca código da viagem). Ex.: Vitória Regia → VRG */
export function getEmbarcacaoInitials(evento = {}) {
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
      stroke: '#a3a3a3',
      fill: '#525252',
      glow: false,
      label: `${total} vínculo${total !== 1 ? 's' : ''} concluído${total !== 1 ? 's' : ''}`,
    };
  }
  return {
    kind: 'sem',
    stroke: 'rgba(255,255,255,0.55)',
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

function interpolateRouteX(progress, direction = 'oeste') {
  const { manausX, tabatingaX } = FLUVIAL_MAP_LAYOUT;
  const t = clamp(progress, 0, 1);
  if (direction === 'oeste') {
    return manausX - (manausX - tabatingaX) * t;
  }
  return tabatingaX + (manausX - tabatingaX) * t;
}

export function projectBoatPositionOnRiver(evento, simulationDateKey, { queueIndex = 0 } = {}) {
  const simulationDate = parseStableDate(simulationDateKey);
  const { state, chegadaManaus, saidaManaus, chegadaTabatinga, proximaChegadaManaus } = detectOperationalState(evento, simulationDate);
  const vinculo = resolveVinculoGlow(evento);
  const atraso = Number(evento?.dias_atraso) || 0;
  const initials = getEmbarcacaoInitials(evento);
  const layout = FLUVIAL_MAP_LAYOUT;

  let x = layout.manausDockX;
  let y = layout.routeY;
  let rotation = -90;
  let statusLabel = 'Indefinido';
  let remainingLabel = '';
  let nextMilestone = null;
  let ocupacao = projectFluvialOcupacaoPercentual(evento, simulationDateKey);
  let segmentProgress = 0;

  if (state === 'doca_manaus' || state === 'doca_manaus_final') {
    x = layout.manausDockX;
    y = layout.dockTopY + queueIndex * layout.dockSpacing;
    rotation = 180;
    statusLabel = state === 'doca_manaus_final' ? 'Doca Manaus — fila de chegada' : 'Doca Manaus — carregando';
    ocupacao = projectFluvialOcupacaoPercentual(evento, simulationDateKey);
    nextMilestone = state === 'doca_manaus' ? saidaManaus : proximaChegadaManaus;
    segmentProgress = state === 'doca_manaus'
      ? computeSegmentProgress(simulationDate, chegadaManaus, saidaManaus)
      : computeSegmentProgress(
        simulationDate,
        chegadaTabatinga ? addDaysDate(chegadaTabatinga, FLUVIAL_DOCK_TABATINGA_DAYS + FLUVIAL_RETURN_DAYS) : null,
        proximaChegadaManaus,
      );
  } else if (state === 'viagem_ida') {
    segmentProgress = computeSegmentProgress(simulationDate, saidaManaus, chegadaTabatinga);
    x = interpolateRouteX(segmentProgress, 'oeste');
    y = layout.routeY - 4;
    rotation = -90;
    statusLabel = 'Em viagem → Tabatinga';
    nextMilestone = chegadaTabatinga;
    ocupacao = resolveDepartureLoad(evento);
  } else if (state === 'doca_tabatinga') {
    x = layout.tabatingaDockX;
    y = layout.dockTopY + 2;
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
    x = interpolateRouteX(segmentProgress, 'leste');
    y = layout.routeY + 5;
    rotation = 90;
    statusLabel = 'Retornando → Manaus';
    nextMilestone = retornoFim;
    ocupacao = 0;
  } else if (state === 'aguardando') {
    x = layout.manausDockX;
    y = layout.dockTopY + queueIndex * layout.dockSpacing + 12;
    rotation = 180;
    statusLabel = 'Aguardando ciclo';
    nextMilestone = chegadaManaus;
    ocupacao = 0;
  } else {
    x = layout.manausDockX;
    y = layout.routeY;
    statusLabel = evento?.status_operacao || 'Fora do ciclo';
    ocupacao = 0;
  }

  if (nextMilestone) {
    const days = differenceInCalendarDays(nextMilestone, simulationDate);
    remainingLabel = formatRemainingDays(days);
  }

  const cycleProgress = state === 'viagem_ida'
    ? 0.15 + segmentProgress * 0.35
    : state === 'doca_tabatinga'
      ? 0.52
      : state === 'viagem_retorno'
        ? 0.55 + segmentProgress * 0.3
        : state === 'doca_manaus' || state === 'doca_manaus_final'
          ? segmentProgress * 0.12
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
    queueIndex,
  };
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
    });
  });

  const docaManaus = fleet
    .map((evento) => ({
      evento,
      projection: projectBoatPositionOnRiver(evento, simulationDateKey),
    }))
    .filter(({ projection }) => projection.state === 'doca_manaus' || projection.state === 'doca_manaus_final' || projection.state === 'aguardando')
    .sort((a, b) => {
      const aDate = parseStableDate(a.evento.data_chegada_manaus)?.getTime() || 0;
      const bDate = parseStableDate(b.evento.data_chegada_manaus)?.getTime() || 0;
      return aDate - bDate;
    });

  const queueRank = new Map();
  docaManaus.forEach(({ evento }, index) => {
    queueRank.set(evento.fleetKey, index);
  });

  return fleet
    .map((evento) => ({
      ...evento,
      riverProjection: projectBoatPositionOnRiver(evento, simulationDateKey, {
        queueIndex: queueRank.get(evento.fleetKey) || 0,
      }),
    }))
    .sort((a, b) => (a.embarcacao_nome || '').localeCompare(b.embarcacao_nome || '', 'pt-BR'));
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

/** @deprecated use getEmbarcacaoInitials */
export function getBoatShortCode(evento) {
  return getEmbarcacaoInitials(evento);
}
