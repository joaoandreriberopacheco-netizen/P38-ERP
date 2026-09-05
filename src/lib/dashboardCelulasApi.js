/**
 * Células pré-calculadas do Dashboard (job noturno / backfill).
 * O gráfico lê valores já gravados; fallback silencioso se Supabase indisponível.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { getMonthBucketsEndingAt } from '@/lib/dashboardVendasPeriod';
import { getMonthBuckets, getSupplyMonthBuckets } from '@/lib/dashboardEstoqueData';

const QUALITY_ORDER = ['A', 'B', 'C', 'D', 'E'];
const QUALITY_LABELS = {
  A: 'Curva A',
  B: 'Curva B',
  C: 'Curva C',
  D: 'Curva D',
  E: 'Curva E',
};
const QUALITY_COLORS = {
  A: '#abc85a',
  B: '#7f9850',
  C: '#6f82a1',
  D: '#8f6f63',
  E: '#64748b',
};
const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function getSupplyStatus(percentage) {
  if (!Number.isFinite(percentage) || percentage === 0) return 'healthy';
  if (percentage > 105) return 'high';
  if (percentage < 95) return 'low';
  return 'healthy';
}

/** @returns {Promise<{ sealedMonths: object, complete: boolean }|null>} */
export async function readDashboardCelulasVendas(selectedMonthKey, months = 6) {
  if (!isSupabaseBrowserConfigured()) return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('dashboard_celulas_window_read', {
      p_tab: 'vendas',
      p_selected_month: selectedMonthKey,
      p_months: months,
    });
    if (error || !data?.sealedMonths) return null;
    return {
      sealedMonths: data.sealedMonths,
      complete: Boolean(data.complete),
      foundMonths: data.foundMonths ?? 0,
      expectedMonths: data.expectedMonths ?? 0,
    };
  } catch {
    return null;
  }
}

/** @returns {Promise<object|null>} */
export async function readDashboardCelulasEstoque(selectedMonthKey, months = 6) {
  if (!isSupabaseBrowserConfigured()) return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('dashboard_celulas_window_read', {
      p_tab: 'estoque',
      p_selected_month: selectedMonthKey,
      p_months: months,
    });
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

function mapQualityFromCelula(qualityByAbcd = {}) {
  const accumulator = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const key of QUALITY_ORDER) {
    accumulator[key] = Number(qualityByAbcd[key] ?? qualityByAbcd[key.toLowerCase()] ?? 0);
  }
  const total = QUALITY_ORDER.reduce((sum, key) => sum + accumulator[key], 0);

  const qualityDistribution = QUALITY_ORDER.map((key) => {
    const valor = accumulator[key];
    const share = total > 0 ? valor / total : 0;
    return {
      key,
      label: QUALITY_LABELS[key],
      valor,
      share,
      percentText: PERCENT.format(share),
      color: QUALITY_COLORS[key],
    };
  });

  const qualityDistributionGeral = qualityDistribution.map((bucket) => ({
    ...bucket,
    percentText: bucket.percentText,
  }));

  return { qualityDistribution, qualityDistributionGeral };
}

/**
 * Converte resumo de células + trânsito live (compras) para métricas da EstoqueTab.
 */
export function buildEstoqueResumoFromCelulas(celulasData, transitOverlay = null) {
  const resumo = celulasData?.resumo;
  if (resumo?.estoqueFisico == null && !resumo?.qualityByAbcd) return null;

  const { qualityDistribution, qualityDistributionGeral } = mapQualityFromCelula(resumo.qualityByAbcd || {});
  const estoqueFisico = Number(resumo.estoqueFisico) || 0;
  const transitoFinanceiroAprovado = Number(transitOverlay?.transitoFinanceiroAprovado ?? resumo.transitoFinanceiroAprovado) || 0;
  const totalLocalizacao = estoqueFisico + transitoFinanceiroAprovado;

  return {
    qualityDistribution,
    qualityDistributionGeral,
    estoqueFisico,
    transitoFinanceiroAprovado,
    totalLocalizacao,
    fromCelulas: true,
  };
}

/**
 * Converte células de nível + supply para gráficos históricos do estoque.
 */
export function buildEstoqueHistoricoFromCelulas(celulasData) {
  if (!celulasData?.nivelMonths || !celulasData?.supplyMonths) return null;

  const monthBuckets = getMonthBuckets();
  const supplyMonthBuckets = getSupplyMonthBuckets();

  const nivelEstoqueSeries = monthBuckets.map((bucket) => {
    const cell = celulasData.nivelMonths[bucket.key];
    const valorFisico = Number(cell?.valorFisico ?? cell?.valor ?? 0);
    return {
      periodo: bucket.label,
      valor: valorFisico,
      valorFisico,
      valorGeral: valorFisico,
    };
  });

  const supplyByMonth = supplyMonthBuckets.map((bucket) => {
    const cell = celulasData.supplyMonths[bucket.key] || {};
    const cmvEfetivo = Number(cell.cmvEfetivo) || 0;
    const cmvVendido = Number(cell.cmvVendido) || 0;
    const ratioPercent = Number(cell.ratioPercent) || (cmvVendido > 0 ? (cmvEfetivo / cmvVendido) * 100 : 0);
    return {
      key: bucket.key,
      label: bucket.label,
      cmvEfetivo,
      cmvVendido,
      ratioPercent,
      diff: cmvEfetivo - cmvVendido,
      status: getSupplyStatus(ratioPercent),
    };
  });

  const hasNivel = nivelEstoqueSeries.some((row) => row.valor > 0);
  const hasSupply = supplyByMonth.some((row) => row.cmvVendido > 0 || row.cmvEfetivo > 0);
  if (!hasNivel && !hasSupply) return null;

  return {
    nivelEstoqueSeries,
    supplyByMonth,
    fromCelulas: true,
  };
}

/** Mescla células de vendas com snapshots legados (dashboard_kpi). */
export function mergeSealedMonthsFromCelulas(primary = {}, fallback = {}) {
  const buckets = Object.keys({ ...primary, ...fallback });
  const merged = {};
  for (const key of buckets) {
    merged[key] = primary[key] || fallback[key];
  }
  return merged;
}

export function celulasVendasWindowComplete(celulas, selectedMonthKey, months = 6) {
  if (!celulas?.complete) return false;
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  return buckets.every((b) => Boolean(celulas.sealedMonths?.[b.key]?.monthlyTotals));
}
