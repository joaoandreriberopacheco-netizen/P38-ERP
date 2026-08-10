import { eachDayOfInterval, endOfMonth, getDay, startOfMonth } from 'date-fns';

export const DEFAULT_DASHBOARD_KPI_CONFIG = {
  kpi_lucro_break_even_diario: 0,
  kpi_lucro_meta_mensal: 0,
  kpi_venda_minima_diaria: 0,
  kpi_venda_meta_mensal: 0,
};

/** Referência típica de dias úteis no mês (sem domingos). */
export const WORKING_DAYS_PER_MONTH_REFERENCE = 26;

export function normalizeDashboardKpiConfig(raw = {}) {
  return {
    kpi_lucro_break_even_diario: Number(raw.kpi_lucro_break_even_diario || 0),
    kpi_lucro_meta_mensal: Number(raw.kpi_lucro_meta_mensal || 0),
    kpi_venda_minima_diaria: Number(raw.kpi_venda_minima_diaria || 0),
    kpi_venda_meta_mensal: Number(raw.kpi_venda_meta_mensal || 0),
  };
}

function isWorkingDay(date) {
  return getDay(date) !== 0;
}

export function countWorkingDaysInMonth(referenceDate = new Date()) {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  return eachDayOfInterval({ start, end }).filter(isWorkingDay).length;
}

export function countElapsedWorkingDaysInMonth(referenceDate = new Date()) {
  const start = startOfMonth(referenceDate);
  const end = referenceDate;
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter(isWorkingDay).length;
}

/** Dias úteis decorridos até um dia civil do mês (inclusive). Usado nas réguas acumuladas. */
export function countWorkingDaysUpToCalendarDay(referenceDate = new Date(), calendarDay = 1) {
  const start = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const day = Math.max(1, Math.floor(Number(calendarDay) || 1));
  const target = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
  const end = target > monthEnd ? monthEnd : target;
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter(isWorkingDay).length;
}

/** Raios das roscas KPI — excedente acima de 100% renderiza fora do anel principal. */
export const DONUT_GAUGE_RADII = {
  sm: { inner: 28, outer: 42, overflowInner: 44, overflowOuter: 48 },
  lg: { inner: 36, outer: 56, overflowInner: 58, overflowOuter: 63 },
};

export function getDailyMetaFromMonthly(monthlyValue, referenceDate = new Date()) {
  const workingDays = countWorkingDaysInMonth(referenceDate);
  const monthly = Number(monthlyValue) || 0;
  if (monthly <= 0 || workingDays <= 0) return 0;
  return monthly / workingDays;
}

/** @deprecated Use countElapsedWorkingDaysInMonth */
export function getElapsedDaysInMonth(referenceDate = new Date()) {
  return countElapsedWorkingDaysInMonth(referenceDate);
}

export function buildDonutRingData(actual, target, colors) {
  const safeActual = Number(actual) || 0;
  const safeTarget = Number(target) || 0;

  if (safeTarget <= 0) {
    return {
      percent: 0,
      fillPercent: 0,
      overflowPercent: 0,
      ringData: [
        { name: 'Sem meta', value: 100, color: colors.muted },
      ],
      ringOverflowData: [],
    };
  }

  const ratioPercent = (safeActual / safeTarget) * 100;
  const fillPercent = Math.min(Math.max(ratioPercent, 0), 100);
  const overflowPercent = Math.min(Math.max(ratioPercent - 100, 0), 100);

  return {
    percent: ratioPercent,
    fillPercent,
    overflowPercent,
    ringData: [
      { name: 'Progresso', value: fillPercent, color: colors.primary },
      { name: 'Restante', value: Math.max(100 - fillPercent, 0), color: colors.muted },
    ],
    ringOverflowData: overflowPercent > 0
      ? [
        { name: 'Excedente', value: overflowPercent, color: colors.primaryDark },
        { name: 'Excedente restante', value: Math.max(100 - overflowPercent, 0), color: 'transparent' },
      ]
      : [],
  };
}
