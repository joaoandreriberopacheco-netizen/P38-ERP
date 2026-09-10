/**
 * KPIs de vendas do dashboard — mesma fonte e regras do Relatório de Margem.
 */
import { format, getDate, isAfter, isBefore } from 'date-fns';
import { fimDiaSistemaISO, inicioDiaSistemaISO } from '@/components/utils/dateUtils';
import {
  getDataVendaMargem,
  pedidoElegivelMargem,
} from '@/lib/relatorioMargemCalculos';
import { calcularMargemKpiIntervalo } from '@/lib/dashboardKpiMargemCompute';
import {
  buildMonthBucket,
  formatTemporalCutoffLabel,
  getCutoffCalendarDay,
  getMonthBucketsEndingAt,
  getReferenceDateForMonth,
  getTemporalCutoffForMonth,
  getTemporalStartForMonth,
  saleWithinMonthTemporalCut,
} from '@/lib/dashboardVendasPeriod';
import {
  buildDonutRingData,
  countElapsedWorkingDaysInMonth,
  countWorkingDaysInMonth,
  countWorkingDaysUpToCalendarDay,
  getDailyMetaFromMonthly,
} from '@/lib/dashboardKpiConfig';
import {
  isSaleCoveredBySealedMonth,
  mergeSealedVendasIntoBuckets,
} from '@/lib/dashboardMargemVendasSealed';
import { P38_ROSCA_COLORS } from '@/lib/p38RoscaGauge';

const RING_COLORS = P38_ROSCA_COLORS;

function sumDayValues(dayMap = {}, maxDay = null) {
  return Object.entries(dayMap || {}).reduce((sum, [dayStr, value]) => {
    const day = Number(dayStr);
    if (!day || (maxDay != null && day > maxDay)) return sum;
    return sum + (Number(value) || 0);
  }, 0);
}

/** Garante que totais mensais batem com a soma dos dias (snapshot + delta de hoje). */
function reconcileMonthTotalsFromDays(monthKey, salesByMonthDay, profitByMonthDay, monthlyTotals, cutoffDay) {
  const mt = monthlyTotals[monthKey];
  if (!mt) return;

  const profitFromDays = sumDayValues(profitByMonthDay[monthKey], cutoffDay);
  const salesFromDays = sumDayValues(salesByMonthDay[monthKey], cutoffDay);

  if (profitFromDays > 0) {
    mt.profit = Math.round(profitFromDays * 100) / 100;
  }
  if (salesFromDays > 0) {
    mt.salesNet = Math.round(salesFromDays * 100) / 100;
  }
  if (mt.cost > 0 && mt.profit > 0) {
    mt.markupPercent = Math.round((mt.profit / mt.cost) * 10000) / 100;
  }
}

function buildMonthlyAndDailyBuckets(monthBuckets6) {
  const salesByMonthDay = {};
  const profitByMonthDay = {};
  const monthlyTotals = {};

  monthBuckets6.forEach((bucket) => {
    salesByMonthDay[bucket.key] = {};
    profitByMonthDay[bucket.key] = {};
    monthlyTotals[bucket.key] = {
      salesGross: 0,
      discounts: 0,
      salesNet: 0,
      cost: 0,
      profit: 0,
      markupPercent: 0,
    };
  });

  return { salesByMonthDay, profitByMonthDay, monthlyTotals };
}

/**
 * Agrega pedidos elegíveis ao Margem por mês/dia (lucro, venda líquida, custo).
 * sealedMonths: payloads do Postgres (até ontem) — pedidos cobertos não são reprocessados.
 */
export function computeDashboardVendasMetricsMargem({
  pedidos,
  produtos = [],
  devolucoesTroca = [],
  pedidosOrigemTroca = {},
  kpiConfig,
  selectedMonthKey,
  sealedMonths = {},
}) {
  const monthBuckets6 = getMonthBucketsEndingAt(selectedMonthKey, 6);
  const [y, m] = selectedMonthKey.split('-').map(Number);
  const selectedBucket = buildMonthBucket(new Date(y, m - 1, 1));
  const windowStart = getTemporalStartForMonth(monthBuckets6[0]?.key);
  const windowEnd = getTemporalCutoffForMonth(selectedMonthKey);

  const sealedBucketData = Object.keys(sealedMonths || {}).length
    ? mergeSealedVendasIntoBuckets(monthBuckets6, sealedMonths)
    : buildMonthlyAndDailyBuckets(monthBuckets6);
  const { salesByMonthDay, profitByMonthDay, monthlyTotals } = sealedBucketData;

  const eligibleSales = (Array.isArray(pedidos) ? pedidos : []).filter((sale) => {
    if (!pedidoElegivelMargem(sale)) return false;
    const saleDate = getDataVendaMargem(sale);
    if (!saleDate) return false;
    if (isBefore(saleDate, windowStart) || isAfter(saleDate, windowEnd)) return false;
    const monthKey = format(saleDate, 'yyyy-MM');
    if (isSaleCoveredBySealedMonth(saleDate, monthKey, sealedMonths)) return false;
    return true;
  });

  const liveSalesByMonthDay = {};
  for (const sale of eligibleSales) {
    const saleDate = getDataVendaMargem(sale);
    if (!saleDate) continue;

    const monthKey = format(saleDate, 'yyyy-MM');
    if (!monthlyTotals[monthKey]) continue;
    if (!saleWithinMonthTemporalCut(saleDate, monthKey)) continue;

    const day = getDate(saleDate);
    const bucketKey = `${monthKey}|${day}`;
    if (!liveSalesByMonthDay[bucketKey]) {
      liveSalesByMonthDay[bucketKey] = { monthKey, day, sales: [] };
    }
    liveSalesByMonthDay[bucketKey].sales.push(sale);
  }

  for (const { monthKey, day, sales: daySales } of Object.values(liveSalesByMonthDay)) {
    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = `${monthKey}-${pad(day)}`;
    const intervalo = {
      from: new Date(inicioDiaSistemaISO(dateKey)),
      to: new Date(fimDiaSistemaISO(dateKey)),
    };
    const totals = calcularMargemKpiIntervalo({
      pedidos: daySales,
      produtos,
      devolucoesTroca,
      pedidosOrigemTroca,
      intervalo,
      pedidoCount: daySales.length,
    });

    salesByMonthDay[monthKey][day] = (salesByMonthDay[monthKey][day] || 0) + totals.salesNet;
    profitByMonthDay[monthKey][day] = (profitByMonthDay[monthKey][day] || 0) + totals.profit;
    monthlyTotals[monthKey].salesGross += totals.salesGross;
    monthlyTotals[monthKey].discounts += totals.discounts;
    monthlyTotals[monthKey].salesNet += totals.salesNet;
    monthlyTotals[monthKey].cost += totals.cost;
    monthlyTotals[monthKey].profit += totals.profit;
  }

  const cutoffDay = getCutoffCalendarDay(selectedMonthKey);
  reconcileMonthTotalsFromDays(
    selectedMonthKey,
    salesByMonthDay,
    profitByMonthDay,
    monthlyTotals,
    cutoffDay,
  );

  for (const bucket of monthBuckets6) {
    const mt = monthlyTotals[bucket.key];
    if (!mt) continue;
    mt.markupPercent =
      mt.cost > 0 ? Math.round((mt.profit / mt.cost) * 10000) / 100 : 0;
  }

  const dailyData = Array.from({ length: selectedBucket.daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return {
      diaNumero: day,
      diaLabel: `D${String(day).padStart(2, '0')}`,
      valor: day <= cutoffDay ? Number(salesByMonthDay[selectedMonthKey]?.[day] || 0) : null,
    };
  });

  const dailyProfitData = Array.from({ length: selectedBucket.daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return {
      diaNumero: day,
      diaLabel: `D${String(day).padStart(2, '0')}`,
      valor: day <= cutoffDay ? Number(profitByMonthDay[selectedMonthKey]?.[day] || 0) : null,
    };
  });

  const referenceDate = getReferenceDateForMonth(selectedMonthKey);
  const elapsedWorkingDays = countElapsedWorkingDaysInMonth(referenceDate);
  const workingDaysInMonth = countWorkingDaysInMonth(referenceDate);
  const breakEvenDaily = Number(kpiConfig?.kpi_lucro_break_even_diario || 0);
  const metaLucroDaily = getDailyMetaFromMonthly(kpiConfig?.kpi_lucro_meta_mensal, referenceDate);
  const vendaMinimaDaily = Number(kpiConfig?.kpi_venda_minima_diaria || 0);
  const metaVendaDaily = getDailyMetaFromMonthly(kpiConfig?.kpi_venda_meta_mensal, referenceDate);

  let runningSales = 0;
  const accumulatedSalesData = Array.from({ length: cutoffDay }, (_, idx) => {
    const day = idx + 1;
    runningSales += Number(salesByMonthDay[selectedMonthKey]?.[day] || 0);
    const workingDaysElapsed = countWorkingDaysUpToCalendarDay(referenceDate, day);
    return {
      dia: `D${day}`,
      valor: runningSales,
      breakEven: vendaMinimaDaily * workingDaysElapsed,
      meta: metaVendaDaily * workingDaysElapsed,
    };
  });

  const monthlySalesData = monthBuckets6.map((bucket, idx) => ({
    periodo: bucket.shortLabel,
    valor: Number(monthlyTotals[bucket.key]?.salesNet || 0),
    isSelected: bucket.key === selectedMonthKey,
    colorIdx: idx,
  }));

  const monthlyProfitData = monthBuckets6.map((bucket, idx) => ({
    periodo: bucket.shortLabel,
    valor: Number(monthlyTotals[bucket.key]?.profit || 0),
    isSelected: bucket.key === selectedMonthKey,
    colorIdx: idx,
  }));

  const previousMonthKey = monthBuckets6[monthBuckets6.length - 2]?.key;
  const selectedProfit = Number(monthlyTotals[selectedMonthKey]?.profit || 0);
  const selectedCost = Number(monthlyTotals[selectedMonthKey]?.cost || 0);
  const selectedMarkupPercent =
    selectedCost > 0
      ? Math.round((selectedProfit / selectedCost) * 10000) / 100
      : Number(monthlyTotals[selectedMonthKey]?.markupPercent || 0);
  const previousProfit = Number(monthlyTotals[previousMonthKey]?.profit || 0);
  const ratioPercent =
    previousProfit > 0 ? (selectedProfit / previousProfit) * 100 : selectedProfit > 0 ? 100 : 0;
  const ringFill = Math.min(Math.max(ratioPercent, 0), 100);
  const ringOverflow = Math.min(Math.max(ratioPercent - 100, 0), 100);

  let runningProfit = 0;
  const accumulatedProfitData = Array.from({ length: cutoffDay }, (_, idx) => {
    const day = idx + 1;
    runningProfit += Number(profitByMonthDay[selectedMonthKey]?.[day] || 0);
    const workingDaysElapsed = countWorkingDaysUpToCalendarDay(referenceDate, day);
    return {
      diaLabel: `D${String(day).padStart(2, '0')}`,
      lucro: runningProfit,
      breakEven: breakEvenDaily * workingDaysElapsed,
      meta: metaLucroDaily * workingDaysElapsed,
    };
  });

  const avgDailyProfit = elapsedWorkingDays > 0 ? selectedProfit / elapsedWorkingDays : 0;
  const avgDailySales =
    elapsedWorkingDays > 0
      ? Number(monthlyTotals[selectedMonthKey]?.salesNet || 0) / elapsedWorkingDays
      : 0;

  return {
    selectedBucket,
    cutoffLabel: formatTemporalCutoffLabel(selectedMonthKey),
    dailyData,
    dailyProfitData,
    accumulatedSalesData,
    monthlySalesData,
    monthlyProfitData,
    accumulatedProfitData,
    breakEvenDaily,
    metaLucroDaily,
    metaVendaDaily,
    vendaMinimaDaily,
    elapsedWorkingDays,
    workingDaysInMonth,
    avgDailySales,
    avgDailyProfit,
    lucroDonutKpis: {
      ringA: {
        actual: avgDailyProfit,
        target: breakEvenDaily,
        ring: buildDonutRingData(avgDailyProfit, breakEvenDaily, RING_COLORS),
      },
      ringB: {
        actual: avgDailyProfit,
        target: metaLucroDaily,
        ring: buildDonutRingData(avgDailyProfit, metaLucroDaily, RING_COLORS),
      },
    },
    vendaDonutKpis: {
      ringA: {
        actual: avgDailySales,
        target: vendaMinimaDaily,
        ring: buildDonutRingData(avgDailySales, vendaMinimaDaily, RING_COLORS),
      },
      ringB: {
        actual: avgDailySales,
        target: metaVendaDaily,
        ring: buildDonutRingData(avgDailySales, metaVendaDaily, RING_COLORS),
      },
    },
    lucroKpi: {
      selectedMonthLabel: selectedBucket.monthLabel,
      previousMonthLabel: monthBuckets6[monthBuckets6.length - 2]?.monthLabel || 'Mês anterior',
      selectedProfit,
      previousProfit,
      selectedSalesNet: Number(monthlyTotals[selectedMonthKey]?.salesNet || 0),
      selectedCost,
      selectedMarkupPercent,
      ratioPercent,
      ringFill,
      ringOverflow,
      ringData: [
        { name: 'Lucro selecionado x anterior', value: ringFill, color: RING_COLORS.primary },
        { name: 'Faixa restante', value: Math.max(100 - ringFill, 0), color: RING_COLORS.muted },
      ],
      ringOverflowData: [
        { name: 'Excedente', value: ringOverflow, color: RING_COLORS.primaryDark },
        { name: 'Excedente restante', value: Math.max(100 - ringOverflow, 0), color: 'transparent' },
      ],
    },
  };
}
