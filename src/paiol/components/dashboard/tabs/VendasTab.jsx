import React, { useEffect, useMemo, useState } from 'react';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  isBefore,
  isAfter,
  getDate,
  parseISO,
  parse,
  isValid,
  getDaysInMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CalendarDays, CircleGauge, Target, TrendingUp } from 'lucide-react';
import {
  buildDonutRingData,
  countElapsedWorkingDaysInMonth,
  countWorkingDaysInMonth,
  getDailyMetaFromMonthly,
  normalizeDashboardKpiConfig,
} from '@/lib/dashboardKpiConfig';
import { resolveValorPedidoVenda } from '@/lib/financialUtils';
import {
  AcumuladoKpiChart,
  DualDonutKpiModule,
  formatDashboardCurrency,
  LucroAcumuladoChart,
} from '@/paiol/components/dashboard/charts/DashboardKpiCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { p38Dashboard } from '@/lib/p38DashboardSurfaces';
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
const MONTH_LINES = ['#abc85a', '#6f82a1', '#f59e0b', '#f97316'];
const MONTH_HIGHLIGHT_COLORS = {
  default: '#6f82a1',
  current: '#abc85a',
  older1: '#93a5be',
  older2: '#f59e0b',
  older3: '#f97316',
};
const MONTH_MUTED_COLOR = '#536178';

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

function getMonthBuckets(monthCount) {
  const now = new Date();
  return Array.from({ length: monthCount }, (_, idx) => {
    const monthDate = subMonths(now, monthCount - idx - 1);
    return {
      key: format(monthDate, 'yyyy-MM'),
      shortLabel: format(monthDate, 'MMM/yy', { locale: ptBR }).toUpperCase(),
      monthLabel: format(monthDate, 'MMMM/yy', { locale: ptBR }),
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
      daysInMonth: getDaysInMonth(monthDate),
    };
  });
}

const formatShort = formatDashboardCurrency;

function extractSaleGrossAmount(sale = {}) {
  const itemTotal = Array.isArray(sale.itens)
    ? sale.itens.reduce((sum, item) => {
      const lineTotal = Number(
        item?.total ??
        item?.valor_total ??
        item?.subtotal ??
        item?.valor_subtotal ??
        0
      );
      return sum + lineTotal;
    }, 0)
    : 0;
  if (itemTotal > 0) return itemTotal;

  const valorTotal = resolveValorPedidoVenda(sale) || Number(
    sale.total_geral ??
    sale.total_final ??
    0
  );
  const valorDesconto = Number(sale.valor_desconto || 0);
  return valorTotal + valorDesconto;
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

export default function VendasTab() {
  const chartTheme = useDashboardChartTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState(null);
  const [hoverMonthKey, setHoverMonthKey] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const monthBuckets6 = useMemo(() => getMonthBuckets(6), []);
  const monthBuckets4 = useMemo(() => getMonthBuckets(4), []);

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
        const startDate = monthBuckets6[0]?.start || startOfMonth(subMonths(new Date(), 5));
        const endDate = monthBuckets6[monthBuckets6.length - 1]?.end || endOfMonth(new Date());
        const [pedidosVendaRaw, produtosRaw, configVendaRaw] = await Promise.all([
          // Evita depender de um único campo de data no backend; filtra localmente depois.
          base44.entities.PedidoVenda.list('-created_date', 30000),
          base44.entities.Produto.filter({}, '-created_date', 10000),
          base44.entities.ConfiguracoesVenda.list(),
        ]);

        const pedidosVendaLista = Array.isArray(pedidosVendaRaw) ? pedidosVendaRaw : [];
        const produtosLista = Array.isArray(produtosRaw) ? produtosRaw : [];

        const productCostMap = new Map(
          produtosLista.map((produto) => [
            produto.id,
            Number(produto.preco_custo_calculado || produto.valor_compra || 0),
          ])
        );

        const validSales = pedidosVendaLista.filter((sale) => {
          const status = normalizeText(sale.status);
          const type = normalizeText(sale.tipo);
          if (NORMALIZED_EXCLUDED_STATUSES.has(status)) return false;
          if (NORMALIZED_EXCLUDED_TYPES.has(type)) return false;
          const saleDate = getSaleDate(sale);
          if (!saleDate) return false;
          return !isBefore(saleDate, startDate) && !isAfter(saleDate, endDate);
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

        validSales.forEach((sale) => {
          const saleDate = getSaleDate(sale);
          if (!saleDate) return;
          const monthKey = format(saleDate, 'yyyy-MM');
          if (!monthlyTotals[monthKey]) return;

          const day = getDate(saleDate);
          const grossAmount = extractSaleGrossAmount(sale);
          const discountAmount = Number(sale.valor_desconto || 0);
          const netAmount = grossAmount - discountAmount;
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

        const dailyComparisonData = Array.from({ length: 31 }, (_, idx) => {
          const day = idx + 1;
          const row = {
            diaNumero: day,
            diaLabel: `D${String(day).padStart(2, '0')}`,
          };
          monthBuckets4.forEach((bucket) => {
            row[bucket.key] = day <= bucket.daysInMonth ? Number(salesByMonthDay[bucket.key]?.[day] || 0) : null;
          });
          return row;
        });

        const kpiConfig = normalizeDashboardKpiConfig(configVendaRaw?.[0] || {});
        const referenceDate = new Date();
        const elapsedWorkingDays = countElapsedWorkingDaysInMonth(referenceDate);
        const workingDaysInMonth = countWorkingDaysInMonth(referenceDate);
        const breakEvenDaily = Number(kpiConfig.kpi_lucro_break_even_diario || 0);
        const metaLucroDaily = getDailyMetaFromMonthly(kpiConfig.kpi_lucro_meta_mensal, referenceDate);
        const vendaMinimaDaily = Number(kpiConfig.kpi_venda_minima_diaria || 0);
        const metaVendaDaily = getDailyMetaFromMonthly(kpiConfig.kpi_venda_meta_mensal, referenceDate);

        const currentMonthKey = monthBuckets6[monthBuckets6.length - 1]?.key;
        const currentMonthDays = monthBuckets6[monthBuckets6.length - 1]?.daysInMonth || 31;
        let runningSales = 0;
        const currentAccumulatedData = Array.from({ length: currentMonthDays }, (_, idx) => {
          const day = idx + 1;
          runningSales += Number(salesByMonthDay[currentMonthKey]?.[day] || 0);
          return {
            dia: `D${day}`,
            valor: runningSales,
            breakEven: vendaMinimaDaily * day,
            meta: metaVendaDaily * day,
          };
        });

        const monthlySalesData = monthBuckets6.map((bucket) => ({
          periodo: bucket.shortLabel,
          valor: Number(monthlyTotals[bucket.key]?.salesNet || 0),
        }));

        const previousMonthKey = monthBuckets6[monthBuckets6.length - 2]?.key;
        const currentProfit = Number(monthlyTotals[currentMonthKey]?.profit || 0);
        const previousProfit = Number(monthlyTotals[previousMonthKey]?.profit || 0);
        const ratioPercent = previousProfit > 0 ? (currentProfit / previousProfit) * 100 : currentProfit > 0 ? 100 : 0;
        const ringFill = Math.min(Math.max(ratioPercent, 0), 100);
        const ringOverflow = Math.min(Math.max(ratioPercent - 100, 0), 100);
        let runningProfit = 0;
        const accumulatedProfitData = Array.from({ length: currentMonthDays }, (_, idx) => {
          const day = idx + 1;
          runningProfit += Number(profitByMonthDay[currentMonthKey]?.[day] || 0);
          return {
            diaLabel: `D${String(day).padStart(2, '0')}`,
            lucro: runningProfit,
            breakEven: breakEvenDaily * day,
            meta: metaLucroDaily * day,
          };
        });
        const avgDailyProfit = elapsedWorkingDays > 0 ? currentProfit / elapsedWorkingDays : 0;
        const avgDailySales = elapsedWorkingDays > 0 ? Number(monthlyTotals[currentMonthKey]?.salesNet || 0) / elapsedWorkingDays : 0;
        const lucroDonutKpis = {
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
        };
        const vendaDonutKpis = {
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
        };

        const lucroKpi = {
          currentMonthLabel: monthBuckets6[monthBuckets6.length - 1]?.monthLabel || 'Mês atual',
          previousMonthLabel: monthBuckets6[monthBuckets6.length - 2]?.monthLabel || 'Mês anterior',
          currentProfit,
          previousProfit,
          currentSalesNet: Number(monthlyTotals[currentMonthKey]?.salesNet || 0),
          currentDiscounts: Number(monthlyTotals[currentMonthKey]?.discounts || 0),
          currentCost: Number(monthlyTotals[currentMonthKey]?.cost || 0),
          ratioPercent,
          ringFill,
          ringOverflow,
          ringData: [
            { name: 'Lucro atual x anterior', value: ringFill, color: RING_COLORS.primary },
            { name: 'Faixa restante', value: Math.max(100 - ringFill, 0), color: RING_COLORS.muted },
          ],
          ringOverflowData: [
            { name: 'Excedente', value: ringOverflow, color: RING_COLORS.primaryDark },
            { name: 'Excedente restante', value: Math.max(100 - ringOverflow, 0), color: 'transparent' },
          ],
        };

        if (mounted) {
          const currentMonthBucket = monthBuckets4[monthBuckets4.length - 1];
          setSelectedMonthKey(currentMonthBucket?.key || null);
          setMetrics({
            monthBuckets4,
            dailyComparisonData,
            currentAccumulatedData,
            monthlySalesData,
            lucroKpi,
            accumulatedProfitData,
            kpiConfig,
            breakEvenDaily,
            metaLucroDaily,
            metaVendaDaily,
            vendaMinimaDaily,
            lucroDonutKpis,
            vendaDonutKpis,
            elapsedWorkingDays,
            workingDaysInMonth,
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
  }, [monthBuckets4, monthBuckets6]);

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

  const currentMonthKey = metrics.monthBuckets4[metrics.monthBuckets4.length - 1]?.key || null;
  const focusedMonthKey = hoverMonthKey || selectedMonthKey || currentMonthKey;

  const monthStyleMap = metrics.monthBuckets4.reduce((acc, bucket, idx) => {
    const isCurrent = bucket.key === currentMonthKey;
    const isFocused = bucket.key === focusedMonthKey;
    const focusOnCurrent = focusedMonthKey === currentMonthKey;
    const isPrevious1 = idx === metrics.monthBuckets4.length - 2;
    const isPrevious2 = idx === metrics.monthBuckets4.length - 3;

    let stroke = MONTH_MUTED_COLOR;
    let strokeWidth = 1.5;
    let opacity = 0.45;
    let strokeDasharray = '4 4';

    if (isFocused) {
      if (isCurrent) stroke = MONTH_HIGHLIGHT_COLORS.current;
      else if (isPrevious1) stroke = MONTH_HIGHLIGHT_COLORS.older1;
      else if (isPrevious2) stroke = MONTH_HIGHLIGHT_COLORS.older2;
      else stroke = MONTH_HIGHLIGHT_COLORS.older3;
      strokeWidth = 2.8;
      opacity = 1;
      strokeDasharray = isCurrent ? '' : isPrevious1 ? '8 4' : isPrevious2 ? '3 3' : '10 5';
    } else if (isCurrent && !focusOnCurrent) {
      stroke = MONTH_HIGHLIGHT_COLORS.current;
      strokeWidth = 2.2;
      opacity = 0.55;
      strokeDasharray = '';
    } else {
      strokeDasharray = isPrevious1 ? '8 4' : isPrevious2 ? '3 3' : '10 5';
    }

    acc[bucket.key] = { stroke, strokeWidth, opacity, isFocused, strokeDasharray };
    return acc;
  }, {});

  const dayTooltipLabel = (label) => {
    const day = Number(label || 0);
    return `Dia ${String(day).padStart(2, '0')}`;
  };

  const focusedMonthLabel = metrics.monthBuckets4.find((bucket) => bucket.key === focusedMonthKey)?.shortLabel || '';
  const dailyFocusedData = metrics.dailyComparisonData.map((row) => ({
    ...row,
    valor: Number(row[focusedMonthKey] || 0),
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
              <CalendarDays className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Venda diária (mês atual + 3 anteriores)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[230px] rounded-xl px-2 py-2 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyFocusedData} barCategoryGap="26%">
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis
                    dataKey="diaNumero"
                    tickFormatter={(value) => `D${String(value).padStart(2, '0')}`}
                    tick={chartTheme.tick}
                    axisLine={false}
                    tickLine={false}
                    interval={isMobile ? 2 : 1}
                  />
                  <YAxis tickFormatter={(value) => formatShort(value)} tick={chartTheme.tick} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={dayTooltipLabel}
                    formatter={(value) => [BRL.format(Number(value || 0)), focusedMonthLabel]}
                    cursor={{ fill: chartTheme.cursor }}
                    contentStyle={chartTheme.tooltip.contentStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={16} fill={monthStyleMap[focusedMonthKey]?.stroke || MONTH_HIGHLIGHT_COLORS.current} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {metrics.monthBuckets4.map((bucket, idx) => (
                <button
                  type="button"
                  key={bucket.key}
                  onMouseEnter={() => setHoverMonthKey(bucket.key)}
                  onMouseLeave={() => setHoverMonthKey(null)}
                  onClick={() => setSelectedMonthKey(bucket.key)}
                  className={`flex items-center justify-between rounded-md px-2 py-1 border min-h-11 transition ${
                    monthStyleMap[bucket.key]?.isFocused
                      ? p38Dashboard.chipFocused
                      : p38Dashboard.chip
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-[2px] w-4 rounded-full"
                      style={{ backgroundColor: monthStyleMap[bucket.key]?.stroke || MONTH_LINES[idx % MONTH_LINES.length] }}
                    />
                    <span className="text-[10px] text-muted-foreground">{bucket.shortLabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
              <TrendingUp className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Venda acumulada do mês atual
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <AcumuladoKpiChart
              data={metrics.currentAccumulatedData}
              xKey="dia"
              valueKey="valor"
              innerSurfaceClassName={`h-[230px] rounded-xl px-2 py-2 ${p38Dashboard.inner}`}
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
              <span>
                Último acumulado: <strong className={p38Dashboard.title}>{formatShort(metrics.currentAccumulatedData.at(-1)?.valor || 0)}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
              <CircleGauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Lucro bruto mensal (atual x anterior)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={p38Dashboard.innerPanel}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Fórmula: Venda - descontos - custo calculado
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[150px,1fr] gap-2.5 items-center">
                <div className="h-[140px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.lucroKpi.ringData}
                        innerRadius={36}
                        outerRadius={56}
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
                          innerRadius={28}
                          outerRadius={32}
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
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Atual/Ant</span>
                    <span className="text-lg font-bold text-foreground">{metrics.lucroKpi.ratioPercent.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className={p38Dashboard.stat}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground uppercase">{metrics.lucroKpi.currentMonthLabel}</p>
                      <span className="text-[10px] text-lime-300/90 uppercase">Atual</span>
                    </div>
                    <p className={`text-sm font-semibold ${p38Dashboard.title}`}>{formatShort(metrics.lucroKpi.currentProfit)}</p>
                  </div>

                  <div className={p38Dashboard.stat}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground uppercase">{metrics.lucroKpi.previousMonthLabel}</p>
                      <span className="text-[10px] text-blue-300/90 uppercase">Anterior</span>
                    </div>
                    <p className={`text-sm font-semibold ${p38Dashboard.title}`}>{formatShort(metrics.lucroKpi.previousProfit)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className={p38Dashboard.statSm}>
                      <p className="text-muted-foreground uppercase">Venda</p>
                      <p className={`${p38Dashboard.title} font-medium`}>{formatShort(metrics.lucroKpi.currentSalesNet)}</p>
                    </div>
                    <div className={p38Dashboard.statSm}>
                      <p className="text-muted-foreground uppercase">Desc</p>
                      <p className={`${p38Dashboard.title} font-medium`}>{formatShort(metrics.lucroKpi.currentDiscounts)}</p>
                    </div>
                    <div className={p38Dashboard.statSm}>
                      <p className="text-muted-foreground uppercase">Custo</p>
                      <p className={`${p38Dashboard.title} font-medium`}>{formatShort(metrics.lucroKpi.currentCost)}</p>
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
              Vendas mensais (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[230px] rounded-xl px-2 py-2 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthlySalesData} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="periodo" tick={chartTheme.tick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => formatShort(value)} tick={chartTheme.tick} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => BRL.format(Number(value || 0))}
                    cursor={{ fill: chartTheme.cursor }}
                    contentStyle={chartTheme.tooltip.contentStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                  />
                  <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {metrics.monthlySalesData.map((entry, idx) => (
                      <Cell
                        key={`${entry.periodo}-${idx}`}
                        fill={idx === metrics.monthlySalesData.length - 1 ? '#abc85a' : SALES_BAR_COLORS[idx % SALES_BAR_COLORS.length]}
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
              Lucro acumulado do mês atual
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <LucroAcumuladoChart
              data={metrics.accumulatedProfitData}
              innerSurfaceClassName={`h-[230px] rounded-xl px-2 py-2 ${p38Dashboard.inner}`}
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
              <span>
                Acumulado atual: <strong className={p38Dashboard.title}>{formatShort(metrics.accumulatedProfitData.at(-1)?.lucro || 0)}</strong>
              </span>
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
  );
}
