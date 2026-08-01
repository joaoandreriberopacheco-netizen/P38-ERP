import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  getDate,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { dataHoje, fimDiaSistemaISO, inicioDiaSistemaISO } from '@/components/utils/dateUtils';

/** Quantos meses o utilizador pode escolher no FAB (inclui o mês atual). */
export const DASHBOARD_VENDAS_MONTH_OPTIONS = 24;

export function getCurrentMonthKey() {
  return dataHoje().slice(0, 7);
}

export function buildMonthBucket(monthDate) {
  return {
    key: format(monthDate, 'yyyy-MM'),
    shortLabel: format(monthDate, 'MMM/yy', { locale: ptBR }).toUpperCase(),
    monthLabel: format(monthDate, 'MMMM/yy', { locale: ptBR }),
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
    daysInMonth: getDaysInMonth(monthDate),
  };
}

export function getMonthBucketsEndingAt(monthKey, count) {
  const [y, m] = monthKey.split('-').map(Number);
  const anchor = new Date(y, m - 1, 1);
  return Array.from({ length: count }, (_, idx) => {
    const monthDate = subMonths(anchor, count - idx - 1);
    return buildMonthBucket(monthDate);
  });
}

export function listSelectableMonthOptions(count = DASHBOARD_VENDAS_MONTH_OPTIONS) {
  const currentKey = getCurrentMonthKey();
  const [y, m] = currentKey.split('-').map(Number);
  const anchor = new Date(y, m - 1, 1);
  return Array.from({ length: count }, (_, idx) => {
    const monthDate = subMonths(anchor, idx);
    const bucket = buildMonthBucket(monthDate);
    return {
      ...bucket,
      isCurrent: bucket.key === currentKey,
    };
  });
}

/** Início do mês civil no fuso Tabatinga (−5). */
export function getTemporalStartForMonth(monthKey) {
  return new Date(inicioDiaSistemaISO(`${monthKey}-01`));
}

/**
 * Corte temporal do mês: fim do último dia (23:59:59 −5).
 * Mês atual → até hoje; meses passados → último dia do mês.
 */
export function getTemporalCutoffForMonth(monthKey) {
  const currentKey = getCurrentMonthKey();
  if (monthKey === currentKey) {
    return new Date(fimDiaSistemaISO(dataHoje()));
  }
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = getDaysInMonth(new Date(y, m - 1, 1));
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(fimDiaSistemaISO(`${monthKey}-${pad(lastDay)}`));
}

/** Data de referência para KPIs (dias úteis, médias). */
export function getReferenceDateForMonth(monthKey) {
  const cutoff = getTemporalCutoffForMonth(monthKey);
  if (monthKey === getCurrentMonthKey()) {
    const todayYmd = dataHoje();
    return new Date(`${todayYmd}T12:00:00-05:00`);
  }
  return cutoff;
}

export function saleWithinMonthTemporalCut(saleDate, monthKey) {
  if (!saleDate) return false;
  const start = getTemporalStartForMonth(monthKey);
  const cutoff = getTemporalCutoffForMonth(monthKey);
  return !isBefore(saleDate, start) && !isAfter(saleDate, cutoff);
}

export function getCutoffCalendarDay(monthKey) {
  return getDate(getTemporalCutoffForMonth(monthKey));
}

export function formatTemporalCutoffLabel(monthKey) {
  const cutoff = getTemporalCutoffForMonth(monthKey);
  const label = format(cutoff, 'dd/MM/yyyy');
  if (monthKey === getCurrentMonthKey()) {
    return `Corte: hoje (${label}) até 23:59`;
  }
  return `Corte: ${label} 23:59 (fim do mês)`;
}
