/**
 * Superfícies do Dashboard P38 — tema premium Carbon Balance.
 * Mobile-first · claro branco total · escuro carvão + limão.
 */

export const p38Dashboard = {
  card:
    'premium-card min-w-0 overflow-hidden border-border/40 shadow-sm ' +
    'dark:border-white/10 dark:shadow-lg',

  cardHeader: 'space-y-1.5 px-3 pt-3 pb-1 sm:px-6 sm:pt-6',
  cardContent: 'px-3 pb-4 pt-1 sm:px-6 sm:pb-6',

  inner: 'p38-chart-surface min-w-0',

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

  sectionTitle: 'p38-dash-section-title min-w-0 break-words',

  gridRoot: 'space-y-3 sm:space-y-4',
  grid2: 'grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2',
  grid3: 'grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3',
  chartH: 'h-[200px] min-h-[180px] sm:h-[232px] md:h-[240px]',
  chartHSm: 'h-[168px] min-h-[150px] sm:h-[180px]',
};
