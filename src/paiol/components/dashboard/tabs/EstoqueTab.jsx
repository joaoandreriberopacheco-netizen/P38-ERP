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
import { useDashboardEstoqueHistoricoQuery, useDashboardEstoqueResumoQuery } from '@/hooks/useDashboardQueries';
import P38RoscaGauge from '@/components/ui/P38RoscaGauge';
import {
  P38_ROSCA_LOCATION_COLORS,
  P38_ROSCA_QUALITY_COLORS,
  getP38RoscaScenarioStatus,
} from '@/lib/p38RoscaGauge';
import { AlertCircle, Gauge, Layers, Package, Truck } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const QUALITY_COLORS = P38_ROSCA_QUALITY_COLORS;

const LOCATION_COLORS = P38_ROSCA_LOCATION_COLORS;

const STOCK_BAR_COLORS = ['#ddd48a', '#d4cc80', '#cbc474', '#c2bc6a', '#b9b460', '#b0ac58'];

function formatShort(value) {
  if (!Number.isFinite(value) || value === 0) return 'R$ 0';
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return BRL.format(value);
}

export default function EstoqueTab({ enabled = true } = {}) {
  const chartTheme = useDashboardChartTheme();
  const resumoQuery = useDashboardEstoqueResumoQuery({ enabled });
  const historicoQuery = useDashboardEstoqueHistoricoQuery({ enabled });
  const metrics = resumoQuery.data
    ? { ...resumoQuery.data, ...(historicoQuery.data || {}) }
    : null;
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

  if (resumoQuery.isLoading && !metrics) {
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

  if (resumoQuery.error || historicoQuery.error) {
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
  const supplyByMonth = metrics.supplyByMonth || [];
  const historicoPendente = historicoQuery.isLoading && !historicoQuery.data;
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
                  disabled={historicoPendente}
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {historicoPendente ? (
              <Skeleton className="h-[220px] sm:h-[210px] w-full rounded-xl" aria-busy="true" />
            ) : (
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
            )}
            {!historicoPendente ? (
            <div className={`mt-2 flex items-center justify-between text-[10px] ${p38Dashboard.legend}`}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-5 rounded-full bg-[#9eb851]" />
                {incluirEstoqueVirtualNivel ? 'tendência mensal (físico + trânsito)' : 'tendência mensal'}
              </span>
              <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(nivelEstoqueAtual)}</span>
            </div>
            ) : null}
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
            {historicoPendente ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map((slot) => (
                  <Skeleton key={slot} className="h-44 w-full rounded-xl" aria-busy="true" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {supplyByMonth.map((monthSupply) => {
                const scenario = getP38RoscaScenarioStatus(monthSupply.ratioPercent);

                return (
                  <div key={monthSupply.key} className={`rounded-xl p-2 min-h-44 sm:min-h-0 ${p38Dashboard.inner}`}>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">{monthSupply.label}</p>
                    <P38RoscaGauge
                      size="xs"
                      percent={monthSupply.ratioPercent}
                      scenario={scenario}
                      showCenterPlate
                      percentDigits={1}
                      className="h-[108px] sm:h-[120px]"
                    />
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
            )}
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
              <P38RoscaGauge
                variant="half"
                size="half"
                segments={qualityHalfDonutData}
                centerLabel="Total"
                centerValue={BRL.format(totalQualidade)}
                showPercent={false}
                className="h-full"
              />
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
              <P38RoscaGauge
                variant="half"
                size="half"
                segments={locationHalfDonutData}
                centerLabel="Total"
                centerValue={BRL.format(metrics.totalLocalizacao)}
                showPercent={false}
                className="h-full"
              />
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
