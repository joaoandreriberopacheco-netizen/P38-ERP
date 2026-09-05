import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import {
  P38_ROSCA_COLORS,
  P38_ROSCA_SIZES,
  buildP38RoscaPercentRing,
  buildP38RoscaSegmentData,
  formatP38RoscaPercent,
} from '@/lib/p38RoscaGauge';
import { useDashboardChartTheme } from '@/lib/useDashboardChartTheme';

const FULL_ANGLES = { startAngle: 90, endAngle: -270 };
const HALF_ANGLES = { startAngle: 180, endAngle: 0 };

function resolveRadii(size, variant) {
  if (variant === 'half') return P38_ROSCA_SIZES.half;
  return P38_ROSCA_SIZES[size] || P38_ROSCA_SIZES.sm;
}

function CenterContent({
  variant,
  centerLabel,
  centerValue,
  percentLabel,
  showPercent,
  showCenterPlate,
  plateRadius,
  children,
}) {
  const hasCustom = Boolean(children);
  const hasPercent = showPercent && percentLabel != null;
  const hasValue = centerValue != null && centerValue !== '';
  const hasLabel = Boolean(centerLabel);

  if (!hasCustom && !hasPercent && !hasValue && !hasLabel) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center pointer-events-none',
        variant === 'half' && 'pt-5',
      )}
    >
      {showCenterPlate ? (
        <div
          className="absolute rounded-full border border-border/30 bg-card shadow-sm dark:border-white/10 dark:bg-[#26262e]/90"
          style={{
            width: plateRadius * 2,
            height: plateRadius * 2,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-[1] flex flex-col items-center justify-center text-center">
        {children || (
          <>
            {centerLabel ? (
              <span className="text-[10px] sm:text-[11px] tracking-wide uppercase text-muted-foreground">
                {centerLabel}
              </span>
            ) : null}
            {hasPercent ? (
              <span className="text-base sm:text-lg font-bold text-foreground tabular-nums leading-none">
                {percentLabel}
              </span>
            ) : null}
            {hasValue ? (
              <span
                className={cn(
                  'font-semibold text-foreground tabular-nums leading-tight',
                  hasPercent ? 'text-[11px] sm:text-xs text-muted-foreground mt-0.5' : 'text-lg',
                )}
              >
                {centerValue}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Rosca P38 unificada — full (360°) ou half (180°).
 * Usar em dashboards, cenários com toggle e KPIs de meta.
 */
export default function P38RoscaGauge({
  variant = 'full',
  size = 'sm',
  percent,
  ring,
  segments,
  trackColor = P38_ROSCA_COLORS.track,
  segmentStroke,
  scenario,
  centerLabel,
  centerValue,
  percentLabel,
  showPercent = true,
  percentDigits = 1,
  showCenterPlate = false,
  className,
  height,
  children,
}) {
  const chartTheme = useDashboardChartTheme();
  const radii = resolveRadii(size, variant);
  const angles = variant === 'half' ? HALF_ANGLES : FULL_ANGLES;
  const strokeColor = segmentStroke ?? chartTheme.pieStroke;

  const percentRing = ring || (percent != null
    ? buildP38RoscaPercentRing(percent, { scenario })
    : null);

  const segmentData = segments ? buildP38RoscaSegmentData(segments) : [];
  const isSegmentMode = segmentData.length > 0;

  const primaryRingData = isSegmentMode
    ? segmentData
    : (percentRing?.ringData || [{ name: 'vazio', value: 100, color: P38_ROSCA_COLORS.muted }]);

  const overflowRingData = !isSegmentMode && percentRing?.ringOverflowData?.length > 0
    ? percentRing.ringOverflowData
    : null;

  const displayPercent = percentLabel
    ?? (percentRing ? formatP38RoscaPercent(percentRing.percent, percentDigits) : null);

  const resolvedHeight = height ?? (variant === 'half' ? undefined : size === 'xs' ? 108 : size === 'md' || size === 'lg' ? 140 : 96);
  const plateRadius = Math.max(radii.inner - 6, 18);

  return (
    <div
      className={cn('relative w-full', className)}
      style={resolvedHeight ? { height: resolvedHeight } : undefined}
      role={showPercent ? 'img' : undefined}
      aria-label={showPercent && displayPercent ? `Indicador ${displayPercent}` : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ name: 'track', value: 100 }]}
            dataKey="value"
            startAngle={angles.startAngle}
            endAngle={angles.endAngle}
            innerRadius={radii.inner}
            outerRadius={radii.outer}
            strokeWidth={0}
            cornerRadius={variant === 'half' ? 3 : 2}
          >
            <Cell fill={trackColor} />
          </Pie>
          <Pie
            data={primaryRingData}
            dataKey="value"
            startAngle={angles.startAngle}
            endAngle={angles.endAngle}
            innerRadius={radii.inner}
            outerRadius={radii.outer}
            strokeWidth={0}
            cornerRadius={isSegmentMode ? 0 : 2}
          >
            {primaryRingData.map((entry) => (
              <Cell
                key={`${entry.name}-${entry.color}`}
                fill={entry.color}
                stroke={isSegmentMode ? strokeColor : undefined}
                strokeWidth={isSegmentMode ? 2 : 0}
              />
            ))}
          </Pie>
          {overflowRingData ? (
            <Pie
              data={overflowRingData}
              innerRadius={radii.overflowInner}
              outerRadius={radii.overflowOuter}
              dataKey="value"
              startAngle={angles.startAngle}
              endAngle={angles.endAngle}
              strokeWidth={0}
              cornerRadius={2}
            >
              {overflowRingData.map((entry) => (
                <Cell key={`overflow-${entry.name}`} fill={entry.color} />
              ))}
            </Pie>
          ) : null}
        </PieChart>
      </ResponsiveContainer>
      <CenterContent
        variant={variant}
        centerLabel={centerLabel}
        centerValue={centerValue}
        percentLabel={displayPercent}
        showPercent={showPercent && !isSegmentMode}
        showCenterPlate={showCenterPlate && variant === 'full'}
        plateRadius={plateRadius}
      >
        {children}
      </CenterContent>
    </div>
  );
}

export { P38RoscaGauge };
