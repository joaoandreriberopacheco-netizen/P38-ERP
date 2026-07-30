import React from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useP38DashboardSurfaces } from '@/paiol/components/dashboard/useP38DashboardSurfaces';
import {
  buildCartesianGridProps,
  buildXAxisProps,
  buildYAxisProps,
  DASHBOARD_CHART_MARGIN,
} from '@/lib/dashboardChartLayout';
import { useDashboardChartTheme } from '@/lib/useDashboardChartTheme';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatDashboardCurrency(value) {
  if (!Number.isFinite(value) || value === 0) return 'R$ 0';
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return BRL.format(value);
}

const DEFAULT_SERIES_LABELS = {
  lucro: 'Lucro acumulado',
  valor: 'Venda acumulada',
  breakEven: 'Break-even acumulado',
  meta: 'Meta acumulada',
};

export function AcumuladoKpiChart({
  data,
  xKey = 'diaLabel',
  valueKey = 'lucro',
  innerSurfaceClassName,
  seriesLabels = DEFAULT_SERIES_LABELS,
}) {
  const chartTheme = useDashboardChartTheme();
  const hasBreakEven = data.some((point) => Number(point.breakEven) > 0);
  const hasMeta = data.some((point) => Number(point.meta) > 0);

  return (
    <div className={innerSurfaceClassName}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={DASHBOARD_CHART_MARGIN.line}>
          <CartesianGrid {...buildCartesianGridProps(chartTheme)} />
          <XAxis {...buildXAxisProps(chartTheme, { dataKey: xKey })} />
          <YAxis {...buildYAxisProps(chartTheme)} />
          <Tooltip
            formatter={(value, name) => [BRL.format(Number(value || 0)), seriesLabels[name] || name]}
            contentStyle={chartTheme.tooltip.contentStyle}
            labelStyle={chartTheme.tooltip.labelStyle}
            itemStyle={chartTheme.tooltip.itemStyle}
          />
          {hasBreakEven ? (
            <Line
              type="monotone"
              dataKey="breakEven"
              name="breakEven"
              stroke={chartTheme.lineBreakEven}
              strokeWidth={1.75}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
            />
          ) : null}
          {hasMeta ? (
            <Line
              type="monotone"
              dataKey="meta"
              name="meta"
              stroke={chartTheme.lineMeta}
              strokeWidth={1.75}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey={valueKey}
            name={valueKey}
            stroke={chartTheme.linePrimary}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 3.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LucroAcumuladoChart({ data, innerSurfaceClassName }) {
  return (
    <AcumuladoKpiChart
      data={data}
      xKey="diaLabel"
      valueKey="lucro"
      innerSurfaceClassName={innerSurfaceClassName}
    />
  );
}

function DonutGauge({ ring, label, actualLabel, targetLabel, actualValue, targetValue }) {
  const p38Dashboard = useP38DashboardSurfaces();
  return (
    <div className={p38Dashboard.stat}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="grid grid-cols-[96px,1fr] gap-2 items-center">
        <div className="h-[96px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ring.ringData}
                innerRadius={28}
                outerRadius={42}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
                cornerRadius={2}
              >
                {ring.ringData.map((entry) => (
                  <Cell key={`${label}-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              {ring.ringOverflowData.length > 0 ? (
                <Pie
                  data={ring.ringOverflowData}
                  innerRadius={22}
                  outerRadius={26}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  cornerRadius={2}
                >
                  {ring.ringOverflowData.map((entry) => (
                    <Cell key={`${label}-overflow-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
              ) : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground uppercase">%</span>
            <span className={`text-sm font-bold ${p38Dashboard.title}`}>{ring.percent.toFixed(0)}%</span>
          </div>
        </div>
        <div className="space-y-1 text-[10px]">
          <div>
            <p className="text-muted-foreground uppercase">{actualLabel}</p>
            <p className={p38Dashboard.textStrong}>{formatDashboardCurrency(actualValue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground uppercase">{targetLabel}</p>
            <p className={p38Dashboard.textStrong}>{formatDashboardCurrency(targetValue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DualDonutKpiModule({ title, icon: Icon, ringA, ringB, labels }) {
  const p38Dashboard = useP38DashboardSurfaces();
  return (
    <div className={p38Dashboard.innerPanel}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {Icon ? <Icon className={`w-3.5 h-3.5 ${p38Dashboard.iconAccent}`} /> : null}
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2">
        <DonutGauge
          ring={ringA.ring}
          label={labels.aTitle}
          actualLabel={labels.aActual}
          targetLabel={labels.aTarget}
          actualValue={ringA.actual}
          targetValue={ringA.target}
        />
        <DonutGauge
          ring={ringB.ring}
          label={labels.bTitle}
          actualLabel={labels.bActual}
          targetLabel={labels.bTarget}
          actualValue={ringB.actual}
          targetValue={ringB.target}
        />
      </div>
    </div>
  );
}
