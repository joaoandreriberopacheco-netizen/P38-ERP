/** Layout e formatação minimalista para gráficos Recharts do dashboard P38. */

/** Rótulo compacto do eixo Y — sem "R$", poucos caracteres. */
export function formatDashboardAxisCurrency(value) {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    return `${sign}${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}M`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export const DASHBOARD_CHART_MARGIN = {
  /** Barras densas (ex.: 31 dias). */
  daily: { top: 2, right: 6, left: -20, bottom: -2 },
  /** Barras mensais / poucos pontos. */
  categorical: { top: 4, right: 6, left: -18, bottom: -2 },
  /** Linhas acumuladas. */
  line: { top: 4, right: 8, left: -18, bottom: -2 },
};

/** Domínio Y compacto — usa quase toda a altura útil do gráfico. */
export function buildDashboardYDomain(data, valueKeys, { floorZero = true } = {}) {
  const keys = Array.isArray(valueKeys) ? valueKeys : [valueKeys];
  let min = Infinity;
  let max = 0;
  for (const row of data || []) {
    for (const key of keys) {
      const raw = row?.[key];
      if (raw == null || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!Number.isFinite(min) || max <= 0) {
    return floorZero ? [0, 1] : [0, 1];
  }
  const span = max - (floorZero ? 0 : min);
  const pad = Math.max(span * 0.06, max * 0.02, 1);
  if (floorZero) return [0, max + pad];
  return [Math.max(min - pad, 0), max + pad];
}

export function buildYAxisProps(chartTheme, options = {}) {
  const {
    width = 36,
    tickCount = 4,
    formatter = formatDashboardAxisCurrency,
    domain,
    padding,
  } = options;
  return {
    tickFormatter: formatter,
    tick: { ...chartTheme.axisTickY, fontSize: 8 },
    axisLine: false,
    tickLine: false,
    width,
    tickCount,
    ...(domain ? { domain } : {}),
    ...(padding ? { padding } : {}),
  };
}

export function buildXAxisProps(chartTheme, extra = {}) {
  return {
    tick: { ...chartTheme.axisTickX, fontSize: 8 },
    axisLine: false,
    tickLine: false,
    height: 22,
    tickMargin: 4,
    ...extra,
  };
}

export function buildCartesianGridProps(chartTheme) {
  return {
    strokeDasharray: '2 8',
    stroke: chartTheme.grid,
    vertical: false,
  };
}
