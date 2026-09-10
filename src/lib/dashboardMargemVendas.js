/**
 * KPIs de vendas do dashboard — mesma fonte e regras do Relatório de Margem.
 */
import { format, getDate, isAfter, isBefore } from 'date-fns';
import { fimDiaSistemaISO, inicioDiaSistemaISO } from '@/components/utils/dateUtils';
import {
  getDataVendaMargem,
  pedidoElegivelMargem,
} from '@/lib/relatorioMargemCalculos';
import {
  calcularMargemKpiIntervalo,
  DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
} from '@/lib/dashboardKpiMargemCompute';
import {
  calcularLinhasMargemVendas,
  calcularTotaisMargem,
  competenciaParaIntervalo,
} from '@/lib/relatorioMargemCalculos';
import {
  buildMonthBucket,
  formatTemporalCutoffLabel,
  getCutoffCalendarDay,
  getCurrentMonthKey,
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

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Mês corrente ao vivo — mesmo motor do Relatório (trocas exigem mês inteiro). */
function rebuildCurrentMonthFromPedidos({
  monthKey,
  pedidos,
  produtos,
  devolucoesTroca,
  pedidosOrigemTroca,
  windowEnd,
  salesByMonthDay,
  profitByMonthDay,
  monthlyTotals,
}) {
  const monthSales = (pedidos || []).filter((sale) => {
    if (!pedidoElegivelMargem(sale)) return false;
    const saleDate = getDataVendaMargem(sale);
    if (!saleDate) return false;
    if (format(saleDate, 'yyyy-MM') !== monthKey) return false;
    if (isAfter(saleDate, windowEnd)) return false;
    return saleWithinMonthTemporalCut(saleDate, monthKey);
  });

  if (!monthSales.length) return false;

  const intervaloMes = competenciaParaIntervalo(monthKey);
  if (!intervaloMes) return false;
  intervaloMes.to = windowEnd;

  const monthKpi = calcularMargemKpiIntervalo({
    pedidos: monthSales,
    produtos,
    devolucoesTroca,
    pedidosOrigemTroca,
    intervalo: intervaloMes,
    pedidoCount: monthSales.length,
  });

  monthlyTotals[monthKey] = {
    salesGross: monthKpi.salesGross,
    discounts: monthKpi.discounts,
    salesNet: monthKpi.salesNet,
    cost: monthKpi.cost,
    profit: monthKpi.profit,
    markupPercent: monthKpi.markupPercent,
  };

  const salesByDay = {};
  for (const sale of monthSales) {
    const saleDate = getDataVendaMargem(sale);
    const day = getDate(saleDate);
    if (!salesByDay[day]) salesByDay[day] = [];
    salesByDay[day].push(sale);
  }

  salesByMonthDay[monthKey] = {};
  profitByMonthDay[monthKey] = {};
  let cumulative = [];
  let prevProfit = 0;

  for (const day of Object.keys(salesByDay).map(Number).sort((a, b) => a - b)) {
    cumulative.push(...salesByDay[day]);
    const pad = (n) => String(n).padStart(2, '0');
    const dateKey = `${monthKey}-${pad(day)}`;
    const intervaloCumulativo = {
      from: intervaloMes.from,
      to: new Date(fimDiaSistemaISO(dateKey)),
    };
    const linhas = calcularLinhasMargemVendas(
      cumulative,
      produtos,
      intervaloCumulativo,
      devolucoesTroca,
      pedidosOrigemTroca,
    );
    const tot = calcularTotaisMargem(linhas);
    const profitDia = roundMoney(tot.lucro_bruto - prevProfit);
    prevProfit = roundMoney(tot.lucro_bruto);

    const dayTotals = calcularMargemKpiIntervalo({
      pedidos: salesByDay[day],
      produtos,
      devolucoesTroca,
      pedidosOrigemTroca,
      intervalo: {
        from: new Date(inicioDiaSistemaISO(dateKey)),
        to: new Date(fimDiaSistemaISO(dateKey)),
      },
      pedidoCount: salesByDay[day].length,
    });

    salesByMonthDay[monthKey][day] = dayTotals.salesNet;
    profitByMonthDay[monthKey][day] = profitDia;
  }

  return true;
}

function sumDayValues(dayMap = {}, maxDay = null) {
  return Object.entries(dayMap || {}).reduce((sum, [dayStr, value]) => {
    const day = Number(dayStr);
    if (!day || (maxDay != null && day > maxDay)) return sum;
    return sum + (Number(value) || 0);
  }, 0);
}

/**
 * Reconcilia receita mensal com soma dos dias.
 * Lucro mensal margem v1: mantém sealed + delta ao vivo (profitByDay legado pode divergir por trocas).
 */
function reconcileMonthTotalsFromDays(
  monthKey,
  salesByMonthDay,
  profitByMonthDay,
  monthlyTotals,
  cutoffDay,
  sealedMonths = {},
) {
  const mt = monthlyTotals[monthKey];
  if (!mt) return;

  const seal = sealedMonths[monthKey];
  const sourceVersion = seal?.sourceVersion || seal?.monthlyTotals?.sourceVersion;
  const salesFromDays = sumDayValues(salesByMonthDay[monthKey], cutoffDay);

  if (salesFromDays > 0) {
    mt.salesNet = Math.round(salesFromDays * 100) / 100;
  }

  if (sourceVersion !== DASHBOARD_KPI_MARGEM_SOURCE_VERSION) {
    const profitFromDays = sumDayValues(profitByMonthDay[monthKey], cutoffDay);
    if (profitFromDays > 0) {
      mt.profit = Math.round(profitFromDays * 100) / 100;
    }
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

  const currentMonthKey = getCurrentMonthKey();
  const pedidosLista = Array.isArray(pedidos) ? pedidos : [];
  const rebuiltCurrentMonth =
    selectedMonthKey === currentMonthKey &&
    rebuildCurrentMonthFromPedidos({
      monthKey: selectedMonthKey,
      pedidos: pedidosLista,
      produtos,
      devolucoesTroca,
      pedidosOrigemTroca,
      windowEnd,
      salesByMonthDay,
      profitByMonthDay,
      monthlyTotals,
    });

  const eligibleSales = pedidosLista.filter((sale) => {
    if (rebuiltCurrentMonth) {
      const saleDate = getDataVendaMargem(sale);
      if (saleDate && format(saleDate, 'yyyy-MM') === selectedMonthKey) return false;
    }
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
    sealedMonths,
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
