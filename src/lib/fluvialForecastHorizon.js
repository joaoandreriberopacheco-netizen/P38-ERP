import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';

/** Forecast fluvial: sempre até ao fim do mês civil a 3 meses à frente. */
export const FLUVIAL_FORECAST_MONTHS = 3;

/**
 * Ex.: em set/2026 → 2026-12-31; em 1/out → 2027-01-31 (abre +1 mês no fim do forecast).
 */
export function fluvialLimiteProspectivoKey(referenceDate = new Date()) {
  const anchor = startOfMonth(referenceDate);
  return format(endOfMonth(addMonths(anchor, FLUVIAL_FORECAST_MONTHS)), 'yyyy-MM-dd');
}

export function fluvialForecastMonthKey(referenceDate = new Date()) {
  return format(referenceDate, 'yyyy-MM');
}
