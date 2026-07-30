/**
 * Superfícies do Dashboard P38 — tema premium Carbon Balance.
 * Mobile-first · claro branco total · escuro carvão + limão.
 */

export const p38Dashboard = {
  card: 'premium-card border-border/40 shadow-sm dark:border-white/10 dark:shadow-lg',

  inner: 'p38-chart-surface',

  innerPanel:
    'p38-chart-surface rounded-2xl p-3 space-y-3',

  chip:
    'bg-card border border-border text-muted-foreground ' +
    'dark:bg-white/5 dark:border-white/10',

  chipFocused:
    'bg-primary/10 border-primary/40 text-foreground ' +
    'dark:bg-primary/15 dark:border-primary/50',

  stat:
    'rounded-xl px-3 py-2 p38-chart-surface',

  statSm:
    'rounded-lg px-2 py-1.5 p38-chart-surface',

  legendRow:
    'rounded-lg px-2 py-1.5 p38-chart-surface',

  placeholder:
    'border border-dashed border-border/60 bg-muted/30 shadow-none ' +
    'dark:border-white/10 dark:bg-white/5',

  placeholderInner:
    'border border-dashed border-border/50 bg-muted/20 ' +
    'dark:border-white/10 dark:bg-white/5',

  title: 'text-foreground',
  titleMuted: 'text-muted-foreground',
  textStrong: 'text-foreground font-semibold',
  legend: 'text-muted-foreground',
  iconAccent: 'p38-dash-icon-accent',

  metricValue: 'p38-metric-value',
  metricLabel: 'p38-metric-label',

  skeletonBar: 'bg-muted-foreground/15 dark:bg-white/10',
  skeletonLine: 'bg-muted-foreground/10 dark:bg-white/5',
  skeletonHeader: 'bg-muted-foreground/20 dark:bg-white/10',

  sectionTitle: 'p38-dash-section-title',

  gridRoot: 'space-y-4',
};
