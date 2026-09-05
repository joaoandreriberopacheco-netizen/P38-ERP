/**
 * Rosca / gauge P38 — paleta e helpers unificados para dashboards e cenários.
 * Referência visual: meia-rosca ABCDE, razão de abastecimento, KPIs de margem.
 */

import { buildDonutRingData } from '@/lib/dashboardKpiConfig';

/** Cores canónicas das roscas (oliva / limão P38). */
export const P38_ROSCA_COLORS = {
  primary: '#c4d068',
  primaryDark: '#a8b856',
  secondary: '#8a9470',
  muted: '#d8d8d8',
  track: 'rgba(148,163,184,0.15)',
  trackSolid: '#e8e8e8',
  centerPlate: '#ffffff',
  centerPlateDark: 'rgba(38,38,46,0.92)',
};

/** Curva ABCDE — alinhado ao dashboard de estoque. */
export const P38_ROSCA_QUALITY_COLORS = {
  A: '#c4d068',
  B: '#9aaa62',
  C: '#8a9470',
  D: '#9a8878',
  E: '#94949c',
};

/** Localização físico / trânsito. */
export const P38_ROSCA_LOCATION_COLORS = {
  fisico: '#c4d068',
  transito: '#8a9470',
};

/** Cenários de razão / meta (saudável, acima, abaixo). */
export const P38_ROSCA_SCENARIO_COLORS = {
  healthy: { fill: '#c4d068', overflow: '#a8b856' },
  high: { fill: '#b8c078', overflow: '#9aaa62' },
  low: { fill: '#8a9470', overflow: '#727a62' },
};

/** Raios por tamanho — full circle com anel de excedente opcional. */
export const P38_ROSCA_SIZES = {
  xs: { inner: 28, outer: 42, overflowInner: 22, overflowOuter: 26 },
  sm: { inner: 28, outer: 42, overflowInner: 44, overflowOuter: 48 },
  md: { inner: 36, outer: 56, overflowInner: 58, overflowOuter: 63 },
  lg: { inner: 36, outer: 56, overflowInner: 58, overflowOuter: 63 },
  half: { inner: 56, outer: 84 },
};

export function getP38RoscaScenarioStatus(percent) {
  const value = Number(percent) || 0;
  if (value === 0) return 'healthy';
  if (value > 105) return 'high';
  if (value < 95) return 'low';
  return 'healthy';
}

export function getP38RoscaScenarioColors(status = 'healthy') {
  return P38_ROSCA_SCENARIO_COLORS[status] || P38_ROSCA_SCENARIO_COLORS.healthy;
}

/** Anel percentual (0–100% + excedente) com cores P38. */
export function buildP38RoscaPercentRing(percent, options = {}) {
  const scenario = options.scenario || getP38RoscaScenarioStatus(percent);
  const scenarioColors = getP38RoscaScenarioColors(scenario);
  const colors = {
    primary: options.fillColor || scenarioColors.fill,
    primaryDark: options.overflowColor || scenarioColors.overflow,
    muted: options.trackColor || P38_ROSCA_COLORS.muted,
  };
  const ratio = Number(percent) || 0;
  const ring = buildDonutRingData(ratio, 100, colors);
  return {
    ...ring,
    percent: ratio,
    scenario,
    colors,
  };
}

/** Compat — delega para buildDonutRingData com paleta P38. */
export function buildP38RoscaKpiRing(actual, target, overrides = {}) {
  const colors = {
    primary: overrides.primary || P38_ROSCA_COLORS.primary,
    primaryDark: overrides.primaryDark || P38_ROSCA_COLORS.primaryDark,
    muted: overrides.muted || P38_ROSCA_COLORS.muted,
  };
  const ring = buildDonutRingData(actual, target, colors);
  return {
    ...ring,
    colors,
  };
}

/** Segmentos para meia-rosca (qualidade, localização, etc.). */
export function buildP38RoscaSegmentData(segments = []) {
  return segments
    .filter((seg) => Number(seg.value) > 0)
    .map((seg) => ({
      name: seg.name || seg.label || 'segmento',
      value: Number(seg.value) || 0,
      color: seg.color,
      percentText: seg.percentText,
    }));
}

export function formatP38RoscaPercent(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}
