import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { p38Dashboard } from '@/lib/p38DashboardSurfaces';
import {
  buildCartesianGridProps,
  buildXAxisProps,
  buildYAxisProps,
  DASHBOARD_CHART_MARGIN,
} from '@/lib/dashboardChartLayout';
import { useDashboardChartTheme } from '@/lib/useDashboardChartTheme';
import { useDashboardEstoqueQuery } from '@/hooks/useDashboardQueries';
import { AlertCircle, Gauge, Layers, Package, Truck } from 'lucide-react';
import {
  Bar,
  BarChart,
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

const QUALITY_COLORS = {
  A: '#c4d068',
  B: '#9aaa62',
  C: '#8a9470',
  D: '#9a8878',
  E: '#94949c',
};

const SUPPLY_RING_COLORS = {
  healthy: '#c4d068',
  healthyDark: '#a8b856',
  high: '#b8c078',
  highDark: '#9aaa62',
  low: '#8a9470',
  lowDark: '#727a62',
  muted: '#d8d8d8',
};

const LOCATION_COLORS = {
  fisico: '#c4d068',
  transito: '#8a9470',
};

const STOCK_BAR_COLORS = ['#ddd48a', '#d4cc80', '#cbc474', '#c2bc6a', '#b9b460', '#b0ac58'];

function formatShort(value) {
  if (!Number.isFinite(value) || value === 0) return 'R$ 0';
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return BRL.format(value);
}

function getSupplyStatus(percentage) {
  if (!Number.isFinite(percentage) || percentage === 0) return 'healthy';
  if (percentage > 105) return 'high';
  if (percentage < 95) return 'low';
  return 'healthy';
}

function getSupplyColorByStatus(status) {
  if (status === 'high') return SUPPLY_RING_COLORS.high;
  if (status === 'low') return SUPPLY_RING_COLORS.low;
  return SUPPLY_RING_COLORS.healthy;
}

function getSupplyOverflowColorByStatus(status) {
  if (status === 'high') return SUPPLY_RING_COLORS.highDark;
  if (status === 'low') return SUPPLY_RING_COLORS.lowDark;
  return SUPPLY_RING_COLORS.healthyDark;
}

export default function EstoqueTab({ enabled = true } = {}) {
  const chartTheme = useDashboardChartTheme();
  const { data: metrics, isLoading, error } = useDashboardEstoqueQuery({ enabled });
  const [incluirTransitoQualidade, setIncluirTransitoQualidade] = useState(false);
  const [incluirEstoqueVirtualNivel, setIncluirEstoqueVirtualNivel] = useState(false);
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
              Não foi possível carregar os indicadores de estoque.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Verifique conexão com dados e tente novamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const qualityBase = incluirTransitoQualidade
    ? (metrics.qualityDistributionGeral || metrics.qualityDistribution)
    : metrics.qualityDistribution;
  const totalQualidade = qualityBase.reduce((sum, bucket) => sum + Number(bucket.valor || 0), 0);
  const nivelEstoqueSeries = metrics.nivelEstoqueSeries || [];
  const nivelEstoqueChartData = nivelEstoqueSeries.map((entry, idx) => {
    const isCurrentMonth = idx === nivelEstoqueSeries.length - 1;
    const valorFisico = Number(entry.valorFisico ?? entry.valor);
    const valorGeral = Number(entry.valorGeral ?? entry.valor);
    const valor = incluirEstoqueVirtualNivel && isCurrentMonth ? valorGeral : valorFisico;
    return { ...entry, valor };
  });
  const nivelEstoqueAtual = nivelEstoqueChartData.at(-1)?.valor || 0;
  const qualityHalfDonutData = qualityBase.map((bucket) => ({
    name: bucket.label,
    value: Number(bucket.valor || 0),
    color: bucket.color,
    percentText: bucket.percentText,
  }));
  const locationHalfDonutData = [
    { name: 'Físico', value: Number(metrics.estoqueFisico || 0), color: LOCATION_COLORS.fisico },
    { name: 'Em trânsito', value: Number(metrics.transitoFinanceiroAprovado || 0), color: LOCATION_COLORS.transito },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <Package className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Nível de Estoque (Base Hoje)
              </CardTitle>
              <label className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${p38Dashboard.titleMuted}`}>
                Virtual
                <Switch
                  checked={incluirEstoqueVirtualNivel}
                  onCheckedChange={setIncluirEstoqueVirtualNivel}
                  aria-label="Incluir estoque virtual no nível de estoque"
                  className="scale-[0.85]"
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[220px] sm:h-[210px] rounded-xl px-1 py-1.5 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={nivelEstoqueChartData}
                  margin={DASHBOARD_CHART_MARGIN.categorical}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="stockBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c3dd74" />
                      <stop offset="100%" stopColor="#7d933b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...buildCartesianGridProps(chartTheme)} />
                  <XAxis
                    {...buildXAxisProps(chartTheme, {
                      dataKey: 'periodo',
                      interval: isMobile ? 1 : 0,
                    })}
                  />
                  <YAxis {...buildYAxisProps(chartTheme)} />
                  <Tooltip
                    formatter={(value) => BRL.format(Number(value || 0))}
                    cursor={{ fill: chartTheme.cursor }}
                    contentStyle={chartTheme.tooltip.contentStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {nivelEstoqueChartData.map((entry, idx) => (
                      <Cell
                        key={`${entry.periodo}-${idx}`}
                        fill={idx === nivelEstoqueChartData.length - 1 ? 'url(#stockBarGradient)' : STOCK_BAR_COLORS[idx % STOCK_BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`mt-2 flex items-center justify-between text-[10px] ${p38Dashboard.legend}`}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-5 rounded-full bg-[#9eb851]" />
                {incluirEstoqueVirtualNivel ? 'tendência mensal (físico + trânsito)' : 'tendência mensal'}
              </span>
              <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(nivelEstoqueAtual)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
              <Gauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Razão de Abastecimento (3 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {metrics.supplyByMonth.map((monthSupply) => {
                const supplyColor = getSupplyColorByStatus(monthSupply.status);
                const overflowColor = getSupplyOverflowColorByStatus(monthSupply.status);
                const ratioPercent = Math.max(monthSupply.ratioPercent, 0);
                const primaryFill = Math.min(ratioPercent, 100);
                const overflowFill = Math.min(Math.max(ratioPercent - 100, 0), 100);
                const primaryRingData = [
                  { name: 'Razão', value: primaryFill, color: supplyColor },
                  {
                    name: 'Restante',
                    value: Math.max(100 - primaryFill, 0),
                    color: SUPPLY_RING_COLORS.muted,
                  },
                ];
                const hasOverflow = overflowFill > 0;
                const overflowRingData = [
                  { name: 'Excedente', value: overflowFill, color: overflowColor },
                  { name: 'ExcedenteRestante', value: Math.max(100 - overflowFill, 0), color: 'transparent' },
                ];

                return (
                  <div key={monthSupply.key} className={`rounded-xl p-2 min-h-44 sm:min-h-0 ${p38Dashboard.inner}`}>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">{monthSupply.label}</p>
                    <div className="h-[108px] sm:h-[120px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={primaryRingData}
                            innerRadius={28}
                            outerRadius={42}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                            cornerRadius={2}
                          >
                            {primaryRingData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          {hasOverflow ? (
                            <Pie
                              data={overflowRingData}
                              innerRadius={22}
                              outerRadius={26}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                              strokeWidth={0}
                              cornerRadius={2}
                            >
                              {overflowRingData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          ) : null}
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base sm:text-lg font-bold text-foreground">{monthSupply.ratioPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-[2px] w-3 rounded-full bg-[#7a8498]" />
                          vendido
                        </span>
                        <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(monthSupply.cmvVendido)}</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-[2px] w-3 rounded-full bg-[#abc85a]" />
                          pago
                        </span>
                        <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(monthSupply.cmvEfetivo)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
                <Layers className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Qualidade do Estoque
              </CardTitle>
              <label className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${p38Dashboard.titleMuted}`}>
                Geral
                <Switch
                  checked={incluirTransitoQualidade}
                  onCheckedChange={setIncluirTransitoQualidade}
                  aria-label="Incluir estoque em trânsito na qualidade do estoque"
                  className="scale-[0.85]"
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[170px] md:h-[180px] relative rounded-xl px-2 py-1 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: 'track', value: 100 }]}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                    cornerRadius={3}
                  >
                    <Cell fill="rgba(148,163,184,0.15)" />
                  </Pie>
                  <Pie
                    data={qualityHalfDonutData}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                  >
                    {qualityHalfDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke={chartTheme.pieStroke} strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-5">
                <span className="text-[11px] tracking-wide uppercase text-muted-foreground">Total</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">{BRL.format(totalQualidade)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {qualityHalfDonutData.map((entry) => (
                <div key={entry.name} className={`flex items-center justify-between ${p38Dashboard.legendRow}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{entry.percentText}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 uppercase tracking-wide ${p38Dashboard.title}`}>
              <Truck className="w-4 h-4 text-[#b8c973]" />
              Localização do Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[170px] md:h-[180px] relative rounded-xl px-2 py-1 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: 'track', value: 100 }]}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                    cornerRadius={3}
                  >
                    <Cell fill="rgba(148,163,184,0.15)" />
                  </Pie>
                  <Pie
                    data={locationHalfDonutData}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                  >
                    {locationHalfDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke={chartTheme.pieStroke} strokeWidth={3} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-5">
                <span className="text-[11px] tracking-wide uppercase text-muted-foreground">Total</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">
                  {BRL.format(metrics.totalLocalizacao)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {locationHalfDonutData.map((entry) => (
                <div key={entry.name} className={`flex items-center justify-between ${p38Dashboard.legendRow}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{BRL.format(entry.value)}</span>
                </div>
              ))}
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
                  <div key={`ph-top-${idx}`} className={`rounded-sm ${p38Dashboard.skeletonBar}`} style={{ height: `${h}%` }} />
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
        {[1, 2, 3].map((slot) => (
          <Card
            key={`empty-slot-${slot}`}
            className={p38Dashboard.placeholder}
          >
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium uppercase tracking-wide ${p38Dashboard.titleMuted}`}>Em breve</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={`h-[90px] rounded-xl p-2.5 ${p38Dashboard.placeholderInner}`}>
                <div className={`h-1.5 w-16 rounded mb-2 ${p38Dashboard.skeletonHeader}`} />
                <div className="grid grid-cols-4 gap-1 items-end h-8 mb-2">
                  {[40, 68, 52, 74].map((h, idx) => (
                    <div key={`ph-bottom-${slot}-${idx}`} className={`rounded-sm ${p38Dashboard.skeletonBar}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className={`h-1.5 rounded w-4/5 ${p38Dashboard.skeletonLine}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
