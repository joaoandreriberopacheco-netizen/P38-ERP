import React, { useEffect, useMemo, useState } from 'react';
import {
  format,
  isBefore,
  isAfter,
  getDate,
  parseISO,
  parse,
  isValid,
} from 'date-fns';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CircleGauge, Target, TrendingUp, CalendarDays } from 'lucide-react';
import {
  buildDonutRingData,
  countElapsedWorkingDaysInMonth,
  countWorkingDaysInMonth,
  countWorkingDaysUpToCalendarDay,
  DONUT_GAUGE_RADII,
  getDailyMetaFromMonthly,
  normalizeDashboardKpiConfig,
} from '@/lib/dashboardKpiConfig';
import {
  buildMonthBucket,
  formatTemporalCutoffLabel,
  getCurrentMonthKey,
  getCutoffCalendarDay,
  getMonthBucketsEndingAt,
  getReferenceDateForMonth,
  getTemporalCutoffForMonth,
  getTemporalStartForMonth,
  saleWithinMonthTemporalCut,
} from '@/lib/dashboardVendasPeriod';
import { resolveValorPedidoVenda } from '@/lib/financialUtils';
import { resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import {
  AcumuladoKpiChart,
  AccumulatedLegendLine,
  DualDonutKpiModule,
  formatDashboardCurrency,
  LucroAcumuladoChart,
} from '@/paiol/components/dashboard/charts/DashboardKpiCharts';
import DashboardVendasMesFab from '@/paiol/components/dashboard/DashboardVendasMesFab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { p38Dashboard } from '@/lib/p38DashboardSurfaces';
import {
  buildCartesianGridProps,
  buildDashboardYDomain,
  buildXAxisProps,
  buildYAxisProps,
  DASHBOARD_CHART_MARGIN,
} from '@/lib/dashboardChartLayout';
import { useDashboardChartTheme } from '@/lib/useDashboardChartTheme';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const RING_COLORS = {
  primary: '#abc85a',
  primaryDark: '#89a246',
  secondary: '#6f82a1',
  muted: '#465267',
};

const SALES_BAR_COLORS = ['#c3dd74', '#b6d05f', '#a9c24d', '#9cb53f', '#90a835', '#7f9531'];

const NORMALIZED_EXCLUDED_STATUSES = new Set(['cancelado']);
const NORMALIZED_EXCLUDED_TYPES = new Set(['orçamento', 'orcamento']);

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'string') {
    const isoParsed = parseISO(value);
    if (isValid(isoParsed)) return isoParsed;

    const ptBrParsed = parse(value, 'dd/MM/yyyy', new Date());
    if (isValid(ptBrParsed)) return ptBrParsed;

    const nativeParsed = new Date(value);
    if (isValid(nativeParsed)) return nativeParsed;
    return null;
  }

  const parsed = new Date(value);
  if (!isValid(parsed)) return null;
  return parsed;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

const formatShort = formatDashboardCurrency;

function extractSaleNetAmount(sale = {}) {
  return resolveValorPedidoVenda(sale);
}

function extractSaleCostAmount(sale = {}, productCostMap = new Map()) {
  const items = Array.isArray(sale.itens) ? sale.itens : [];
  return items.reduce((sum, item) => {
    const quantidadeBase = Number(
      item.quantidade_base ?? (Number(item.quantidade || 0) * Number(item.fator_conversao || 1))
    ) || Number(item.quantidade || 0) || 0;
    const fallbackCost = Number(productCostMap.get(item.produto_id) || 0);
    const unitCost = Number(
      item.custo_unitario_momento ??
      item.custo_unitario ??
      item.custo_calculado ??
      fallbackCost ??
      0
    );
    return sum + quantidadeBase * unitCost;
  }, 0);
}

function getSaleDate(sale = {}) {
  return (
    parseDate(sale.data_venda) ||
    parseDate(sale.data_emissao) ||
    parseDate(sale.data_fechamento) ||
    parseDate(sale.created_date) ||
    parseDate(sale.updated_date)
  );
}

function isSaleEligible(sale) {
  const status = normalizeText(sale.status);
  const type = normalizeText(sale.tipo);
  if (NORMALIZED_EXCLUDED_STATUSES.has(status)) return false;
  if (NORMALIZED_EXCLUDED_TYPES.has(type)) return false;
  return Boolean(getSaleDate(sale));
}

function computeVendasMetrics({ pedidos, productCostMap, kpiConfig, selectedMonthKey }) {
  const monthBuckets6 = getMonthBucketsEndingAt(selectedMonthKey, 6);
  const [y, m] = selectedMonthKey.split('-').map(Number);
  const selectedBucket = buildMonthBucket(new Date(y, m - 1, 1));
  const windowStart = getTemporalStartForMonth(monthBuckets6[0]?.key);
  const windowEnd = getTemporalCutoffForMonth(selectedMonthKey);

  const eligibleSales = (Array.isArray(pedidos) ? pedidos : []).filter((sale) => {
    if (!isSaleEligible(sale)) return false;
    const saleDate = getSaleDate(sale);
    return !isBefore(saleDate, windowStart) && !isAfter(saleDate, windowEnd);
  });

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

  eligibleSales.forEach((sale) => {
    const saleDate = getSaleDate(sale);
    if (!saleDate) return;
    const monthKey = format(saleDate, 'yyyy-MM');
    if (!monthlyTotals[monthKey]) return;
    if (!saleWithinMonthTemporalCut(saleDate, monthKey)) return;

    const day = getDate(saleDate);
    const discountAmount = Number(sale.valor_desconto || 0);
    const netAmount = extractSaleNetAmount(sale);
    const grossAmount = netAmount + discountAmount;
    const costAmount = extractSaleCostAmount(sale, productCostMap);
    const profitAmount = netAmount - costAmount;

    salesByMonthDay[monthKey][day] = (salesByMonthDay[monthKey][day] || 0) + netAmount;
    profitByMonthDay[monthKey][day] = (profitByMonthDay[monthKey][day] || 0) + profitAmount;
    monthlyTotals[monthKey].salesGross += grossAmount;
    monthlyTotals[monthKey].discounts += discountAmount;
    monthlyTotals[monthKey].salesNet += netAmount;
    monthlyTotals[monthKey].cost += costAmount;
    monthlyTotals[monthKey].profit += profitAmount;
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
  const breakEvenDaily = Number(kpiConfig.kpi_lucro_break_even_diario || 0);
  const metaLucroDaily = getDailyMetaFromMonthly(kpiConfig.kpi_lucro_meta_mensal, referenceDate);
  const vendaMinimaDaily = Number(kpiConfig.kpi_venda_minima_diaria || 0);
  const metaVendaDaily = getDailyMetaFromMonthly(kpiConfig.kpi_venda_meta_mensal, referenceDate);

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
  const ratioPercent = previousProfit > 0 ? (selectedProfit / previousProfit) * 100 : selectedProfit > 0 ? 100 : 0;
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
  const avgDailySales = elapsedWorkingDays > 0
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

export default function VendasTab() {
  const chartTheme = useDashboardChartTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState(getCurrentMonthKey);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadVendas = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [pedidosVendaRaw, produtosRaw, configVendaRaw] = await Promise.all([
          base44.entities.PedidoVenda.list('-created_date', 30000),
          base44.entities.Produto.filter({}, '-created_date', 10000),
          base44.entities.ConfiguracoesVenda.list(),
        ]);

        const produtosLista = Array.isArray(produtosRaw) ? produtosRaw : [];
        const productCostMap = new Map(
          produtosLista.map((produto) => [
            produto.id,
            Number(resolveCustoTotalUnitBaseProduto(produto)),
          ])
        );

        if (mounted) {
          setRawData({
            pedidos: Array.isArray(pedidosVendaRaw) ? pedidosVendaRaw : [],
            productCostMap,
            kpiConfig: normalizeDashboardKpiConfig(configVendaRaw?.[0] || {}),
          });
        }
      } catch (loadError) {
        console.error('Erro ao carregar dashboard de vendas:', loadError);
        if (mounted) setError(loadError);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadVendas();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!rawData) return null;
    return computeVendasMetrics({
      pedidos: rawData.pedidos,
      productCostMap: rawData.productCostMap,
      kpiConfig: rawData.kpiConfig,
      selectedMonthKey,
    });
  }, [rawData, selectedMonthKey]);

  const dailyYDomain = useMemo(
    () => buildDashboardYDomain(metrics?.dailyData, 'valor'),
    [metrics?.dailyData],
  );
  const monthlyYDomain = useMemo(
    () => buildDashboardYDomain(metrics?.monthlySalesData, 'valor'),
    [metrics?.monthlySalesData],
  );
  const chartSurface = `h-[280px] sm:h-[268px] rounded-xl ${p38Dashboard.inner}`;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((card) => (
          <Card key={card} className="border-0 shadow-sm bg-card">
            <CardHeader>
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="border border-red-200 dark:border-red-900/40 bg-card shadow-sm">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Não foi possível carregar os indicadores de vendas.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Verifique conexão com dados e tente novamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dayTooltipLabel = (label) => {
    const day = Number(label || 0);
    return `Dia ${String(day).padStart(2, '0')}`;
  };

  const selectedMonthLabel = metrics.selectedBucket.monthLabel;

  return (
    <>
      <div className="space-y-3 pb-20">
        <div className={`rounded-xl border px-3 py-2 text-[11px] ${p38Dashboard.chip}`}>
          <p className={`font-medium capitalize ${p38Dashboard.title}`}>{selectedMonthLabel}</p>
          <p className="text-muted-foreground mt-0.5">{metrics.cutoffLabel}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-3">
          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <CalendarDays className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Venda diária — {selectedMonthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={chartSurface}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.dailyData}
                    margin={DASHBOARD_CHART_MARGIN.daily}
                    barCategoryGap={isMobile ? '14%' : '8%'}
                  >
                    <CartesianGrid {...buildCartesianGridProps(chartTheme)} />
                    <XAxis
                      {...buildXAxisProps(chartTheme, {
                        dataKey: 'diaNumero',
                        tickFormatter: (value) => `D${String(value).padStart(2, '0')}`,
                        interval: isMobile ? 4 : 2,
                      })}
                    />
                    <YAxis {...buildYAxisProps(chartTheme, { domain: dailyYDomain, width: 44, tickCount: 5 })} />
                    <Tooltip
                      labelFormatter={dayTooltipLabel}
                      formatter={(value) => [BRL.format(Number(value || 0)), metrics.selectedBucket.shortLabel]}
                      cursor={{ fill: chartTheme.cursor }}
                      contentStyle={chartTheme.tooltip.contentStyle}
                      labelStyle={chartTheme.tooltip.labelStyle}
                      itemStyle={chartTheme.tooltip.itemStyle}
                    />
                    <Bar
                      dataKey="valor"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={isMobile ? 14 : 22}
                      fill="#abc85a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <TrendingUp className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Venda acumulada — {selectedMonthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <AcumuladoKpiChart
                data={metrics.accumulatedSalesData}
                xKey="dia"
                valueKey="valor"
                innerSurfaceClassName={chartSurface}
                seriesLabels={{
                  valor: 'Venda acumulada',
                  breakEven: 'Mínimo acumulado',
                  meta: 'Meta acumulada',
                }}
              />
              <div className={`flex flex-wrap gap-3 mt-2 text-[10px] ${p38Dashboard.legend}`}>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-[2px] w-4 rounded-full bg-[#ef4444]" />
                  Mínima/dia: <strong className={p38Dashboard.title}>{formatShort(metrics.vendaMinimaDaily)}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-[2px] w-4 rounded-full bg-[#22c55e]" />
                  Meta/dia: <strong className={p38Dashboard.title}>{formatShort(metrics.metaVendaDaily)}</strong>
                </span>
                <AccumulatedLegendLine
                  label="Acumulado"
                  total={metrics.accumulatedSalesData.at(-1)?.valor || 0}
                  dailyAvg={metrics.avgDailySales}
                  titleClassName={p38Dashboard.title}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <CircleGauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Lucro bruto mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={p38Dashboard.innerPanel}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Fórmula: Venda líquida (valor cobrado) − custo calculado
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-[150px,1fr] gap-2.5 items-center">
                  <div className="h-[140px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.lucroKpi.ringData}
                          innerRadius={DONUT_GAUGE_RADII.lg.inner}
                          outerRadius={DONUT_GAUGE_RADII.lg.outer}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                          strokeWidth={0}
                          cornerRadius={2}
                        >
                          {metrics.lucroKpi.ringData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        {metrics.lucroKpi.ringOverflow > 0 ? (
                          <Pie
                            data={metrics.lucroKpi.ringOverflowData}
                            innerRadius={DONUT_GAUGE_RADII.lg.overflowInner}
                            outerRadius={DONUT_GAUGE_RADII.lg.overflowOuter}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                            cornerRadius={2}
                          >
                            {metrics.lucroKpi.ringOverflowData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        ) : null}
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Sel/Ant</span>
                      <span className="text-lg font-bold text-foreground">{metrics.lucroKpi.ratioPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className={p38Dashboard.stat}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground uppercase">{metrics.lucroKpi.selectedMonthLabel}</p>
                        <span className="text-[10px] text-lime-300/90 uppercase">Selecionado</span>
                      </div>
                      <p className={`text-sm font-semibold ${p38Dashboard.title}`}>{formatShort(metrics.lucroKpi.selectedProfit)}</p>
                    </div>

                    <div className={p38Dashboard.stat}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground uppercase">{metrics.lucroKpi.previousMonthLabel}</p>
                        <span className="text-[10px] text-blue-300/90 uppercase">Anterior</span>
                      </div>
                      <p className={`text-sm font-semibold ${p38Dashboard.title}`}>{formatShort(metrics.lucroKpi.previousProfit)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className={p38Dashboard.statSm}>
                        <p className="text-muted-foreground uppercase">Venda líquida</p>
                        <p className={`${p38Dashboard.title} font-medium`}>{formatShort(metrics.lucroKpi.selectedSalesNet)}</p>
                      </div>
                      <div className={p38Dashboard.statSm}>
                        <p className="text-muted-foreground uppercase">Custo</p>
                        <p className={`${p38Dashboard.title} font-medium`}>{formatShort(metrics.lucroKpi.selectedCost)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <TrendingUp className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Vendas mensais (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={chartSurface}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.monthlySalesData}
                    margin={DASHBOARD_CHART_MARGIN.categorical}
                    barCategoryGap="12%"
                  >
                    <CartesianGrid {...buildCartesianGridProps(chartTheme)} />
                    <XAxis {...buildXAxisProps(chartTheme, { dataKey: 'periodo' })} />
                    <YAxis {...buildYAxisProps(chartTheme, { domain: monthlyYDomain, width: 44, tickCount: 5 })} />
                    <Tooltip
                      formatter={(value) => BRL.format(Number(value || 0))}
                      cursor={{ fill: chartTheme.cursor }}
                      contentStyle={chartTheme.tooltip.contentStyle}
                      labelStyle={chartTheme.tooltip.labelStyle}
                      itemStyle={chartTheme.tooltip.itemStyle}
                    />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {metrics.monthlySalesData.map((entry) => (
                        <Cell
                          key={entry.periodo}
                          fill={entry.isSelected ? '#abc85a' : SALES_BAR_COLORS[entry.colorIdx % SALES_BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className={p38Dashboard.placeholder}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium uppercase tracking-wide ${p38Dashboard.titleMuted}`}>Em breve</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={`h-[180px] rounded-xl p-3 ${p38Dashboard.placeholderInner}`}>
                <div className={`h-2 w-24 rounded mb-3 ${p38Dashboard.skeletonHeader}`} />
                <div className="grid grid-cols-5 gap-1 items-end h-16 mb-3">
                  {[30, 44, 26, 52, 36].map((h, idx) => (
                    <div key={`placeholder-top-${idx}`} className={`rounded-sm ${p38Dashboard.skeletonBar}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="space-y-2">
                  <div className={`h-1.5 rounded w-full ${p38Dashboard.skeletonLine}`} />
                  <div className={`h-1.5 rounded w-4/5 ${p38Dashboard.skeletonLine}`} />
                  <div className={`h-1.5 rounded w-3/5 ${p38Dashboard.skeletonLine}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <TrendingUp className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Lucro acumulado — {selectedMonthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <LucroAcumuladoChart
                data={metrics.accumulatedProfitData}
                innerSurfaceClassName={chartSurface}
              />
              <div className={`flex flex-wrap gap-3 mt-2 text-[10px] ${p38Dashboard.legend}`}>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-[2px] w-4 rounded-full bg-[#ef4444]" />
                  Break-even/dia: <strong className={p38Dashboard.title}>{formatShort(metrics.breakEvenDaily)}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-[2px] w-4 rounded-full bg-[#22c55e]" />
                  Meta/dia: <strong className={p38Dashboard.title}>{formatShort(metrics.metaLucroDaily)}</strong>
                </span>
                <AccumulatedLegendLine
                  label="Acumulado"
                  total={metrics.accumulatedProfitData.at(-1)?.lucro || 0}
                  dailyAvg={metrics.avgDailyProfit}
                  titleClassName={p38Dashboard.title}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <CircleGauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                KPIs diários — Lucro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <DualDonutKpiModule
                title={`Média em ${metrics.elapsedWorkingDays} dias úteis (mês: ${metrics.workingDaysInMonth})`}
                icon={Target}
                ringA={metrics.lucroDonutKpis.ringA}
                ringB={metrics.lucroDonutKpis.ringB}
                labels={{
                  aTitle: 'Margem bruta média x mínima',
                  aActual: 'Lucro médio/dia',
                  aTarget: 'Break-even/dia',
                  bTitle: 'Margem bruta média x ideal',
                  bActual: 'Lucro médio/dia',
                  bTarget: 'Meta diária',
                }}
              />
            </CardContent>
          </Card>

          <Card className={p38Dashboard.card}>
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <CircleGauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                KPIs diários — Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <DualDonutKpiModule
                title={`Média em ${metrics.elapsedWorkingDays} dias úteis (mês: ${metrics.workingDaysInMonth})`}
                icon={Target}
                ringA={metrics.vendaDonutKpis.ringA}
                ringB={metrics.vendaDonutKpis.ringB}
                labels={{
                  aTitle: 'Venda média x mínima',
                  aActual: 'Venda média/dia',
                  aTarget: 'Mínima/dia',
                  bTitle: 'Venda média x meta',
                  bActual: 'Venda média/dia',
                  bTarget: 'Meta diária',
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <DashboardVendasMesFab
        selectedMonthKey={selectedMonthKey}
        onSelectMonthKey={setSelectedMonthKey}
      />
    </>
  );
}
