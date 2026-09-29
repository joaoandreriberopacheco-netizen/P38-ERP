/** Forecast fluvial: fim do mês civil a +3 meses (espelha `src/lib/fluvialForecastHorizon.js`). */
export const FLUVIAL_FORECAST_MONTHS = 3;

export function fluvialLimiteProspectivoKey(reference: Date = new Date()): string {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + FLUVIAL_FORECAST_MONTHS + 1, 0, 12, 0, 0, 0));
  return lastDay.toISOString().slice(0, 10);
}
