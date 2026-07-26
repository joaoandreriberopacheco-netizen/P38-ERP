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
  daily: { top: 4, right: 0, left: -14, bottom: 0 },
  /** Barras mensais / poucos pontos. */
  categorical: { top: 6, right: 2, left: -10, bottom: 0 },
  /** Linhas acumuladas. */
  line: { top: 8, right: 4, left: -10, bottom: 0 },
};

export function buildYAxisProps(chartTheme, options = {}) {
  const { width = 30, tickCount = 4, formatter = formatDashboardAxisCurrency } = options;
  return {
    tickFormatter: formatter,
    tick: chartTheme.axisTickY,
    axisLine: false,
    tickLine: false,
    width,
    tickCount,
  };
}

export function buildXAxisProps(chartTheme, extra = {}) {
  return {
    tick: chartTheme.axisTickX,
    axisLine: false,
    tickLine: false,
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
