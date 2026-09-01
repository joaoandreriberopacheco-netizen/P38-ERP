/**
 * KPIs de vendas do dashboard — mesma fonte e regras do Relatório de Margem.
 */
import { format, getDate, isAfter, isBefore } from 'date-fns';
import {
  calcularTotaisPedidoMargem,
  getDataVendaMargem,
  pedidoElegivelMargem,
} from '@/lib/relatorioMargemCalculos';
import { buildIndiceDevolucaoTrocaMargem } from '@/lib/relatorioMargemTroca';
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

const RING_COLORS = {
  primary: '#c4d068',
  primaryDark: '#a8b856',
  secondary: '#8a9470',
  muted: '#d8d8d8',
};

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
    };
  });

  return { salesByMonthDay, profitByMonthDay, monthlyTotals };
}

/**
 * Agrega pedidos elegíveis ao Margem por mês/dia (lucro, venda líquida, custo).
 */
export function computeDashboardVendasMetricsMargem({
  pedidos,
  produtos = [],
  devolucoesTroca = [],
  pedidosOrigemTroca = {},
  kpiConfig,
  selectedMonthKey,
}) {
  const monthBuckets6 = getMonthBucketsEndingAt(selectedMonthKey, 6);
  const [y, m] = selectedMonthKey.split('-').map(Number);
  const selectedBucket = buildMonthBucket(new Date(y, m - 1, 1));
  const windowStart = getTemporalStartForMonth(monthBuckets6[0]?.key);
  const windowEnd = getTemporalCutoffForMonth(selectedMonthKey);

  const prodMap = (produtos || []).reduce((acc, produto) => {
    if (produto?.id) acc[produto.id] = produto;
    return acc;
  }, {});

  const indiceTrocas = buildIndiceDevolucaoTrocaMargem(devolucoesTroca);
  const { salesByMonthDay, profitByMonthDay, monthlyTotals } = buildMonthlyAndDailyBuckets(monthBuckets6);

  const eligibleSales = (Array.isArray(pedidos) ? pedidos : []).filter((sale) => {
    if (!pedidoElegivelMargem(sale)) return false;
    const saleDate = getDataVendaMargem(sale);
    if (!saleDate) return false;
    return !isBefore(saleDate, windowStart) && !isAfter(saleDate, windowEnd);
  });

  eligibleSales.forEach((sale) => {
    const saleDate = getDataVendaMargem(sale);
    if (!saleDate) return;

    const monthKey = format(saleDate, 'yyyy-MM');
    if (!monthlyTotals[monthKey]) return;
    if (!saleWithinMonthTemporalCut(saleDate, monthKey)) return;

    const day = getDate(saleDate);
    const totals = calcularTotaisPedidoMargem(sale, prodMap, {
      indiceTrocas,
      pedidosOrigemMap: pedidosOrigemTroca,
    });

    salesByMonthDay[monthKey][day] = (salesByMonthDay[monthKey][day] || 0) + totals.salesNet;
    profitByMonthDay[monthKey][day] = (profitByMonthDay[monthKey][day] || 0) + totals.profit;
    monthlyTotals[monthKey].salesGross += totals.salesGross;
    monthlyTotals[monthKey].discounts += totals.discounts;
    monthlyTotals[monthKey].salesNet += totals.salesNet;
    monthlyTotals[monthKey].cost += totals.cost;
    monthlyTotals[monthKey].profit += totals.profit;
  });

  const cutoffDay = getCutoffCalendarDay(selectedMonthKey);
  const dailyData = Array.from({ length: selectedBucket.daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return {
      diaNumero: day,
      diaLabel: `D${String(day).padStart(2, '0')}`,
      valor: day <= cutoffDay ? Number(salesByMonthDay[selectedMonthKey]?.[day] || 0) : null,
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

  const previousMonthKey = monthBuckets6[monthBuckets6.length - 2]?.key;
  const selectedProfit = Number(monthlyTotals[selectedMonthKey]?.profit || 0);
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
    accumulatedSalesData,
    monthlySalesData,
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
      selectedCost: Number(monthlyTotals[selectedMonthKey]?.cost || 0),
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
