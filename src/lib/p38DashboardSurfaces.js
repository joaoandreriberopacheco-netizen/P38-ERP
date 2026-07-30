/**
 * Superfícies do Dashboard P38 — claro com oliva/cítrico; escuro mantém gradiente slate.
 * `p38DashboardLight` — shell carvão + folha branca (mobile modo claro, inspiração Labotrat).
 */

/** Modo claro mobile — folha branca sobre carvão, limão nos acentos. */
export const p38DashboardLight = {
  card:
    'p38-dash-card bg-transparent text-gray-900 border-0 shadow-none rounded-none ' +
    'dark:bg-gradient-to-br dark:from-[#2b3342] dark:via-[#2a3140] dark:to-[#242c39] ' +
    'dark:border-slate-500/25 dark:shadow-[0_10px_24px_rgba(0,0,0,0.25)]',

  inner:
    'bg-gray-50 border border-gray-100 rounded-2xl ' +
    'dark:bg-[#313a4a]/65 dark:border-slate-400/10',

  innerPanel:
    'rounded-2xl p-3 bg-gray-50 border border-gray-100 space-y-3 ' +
    'dark:bg-[#313a4a]/65 dark:border-slate-400/10',

  chip:
    'bg-white border border-gray-200 text-gray-600 ' +
    'dark:bg-[#1f2734]/45 dark:border-slate-500/15 dark:hover:bg-[#1f2734]/65',

  chipFocused:
    'bg-lime-50 border-lime-400/60 text-gray-900 ' +
    'dark:bg-[#1f2734]/80 dark:border-slate-300/25',

  stat:
    'rounded-xl px-3 py-2 bg-gray-50 border border-gray-100 ' +
    'dark:bg-[#1f2734]/55 dark:border-slate-500/15',

  statSm:
    'rounded-lg px-2 py-1.5 bg-gray-50/90 border border-gray-100 ' +
    'dark:bg-[#1f2734]/50 dark:border-slate-500/10',

  legendRow:
    'rounded-lg px-2 py-1.5 bg-gray-50 border border-gray-100 ' +
    'dark:bg-[#1f2734]/55 dark:border-slate-500/15',

  placeholder:
    'border border-dashed border-gray-200 bg-gray-50/60 shadow-none ' +
    'dark:border-slate-500/20 dark:bg-[#252d3a]/55 dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)]',

  placeholderInner:
    'border border-dashed border-gray-200 bg-gray-50/50 ' +
    'dark:border-slate-500/20 dark:bg-[#1f2734]/45',

  title: 'p38-dash-card-title text-gray-900 dark:text-slate-100',
  titleMuted: 'text-gray-400 dark:text-slate-300',
  textStrong: 'text-gray-900 font-semibold dark:text-slate-100',
  legend: 'text-gray-400 dark:text-slate-300/80',
  iconAccent: 'text-lime-600 dark:text-lime-400',

  metricValue: 'p38-dash-metric-value',
  metricLabel: 'p38-dash-metric-label',

  skeletonBar: 'bg-gray-200/70 dark:bg-slate-400/20',
  skeletonLine: 'bg-gray-100 dark:bg-slate-500/20',
  skeletonHeader: 'bg-gray-200 dark:bg-slate-500/25',

  sectionTitle:
    'p38-dash-card-title text-[0.9375rem] font-semibold flex items-center gap-2 tracking-tight normal-case text-gray-900',

  gridRoot: 'space-y-4',
};

export const p38Dashboard = {
  card:
    'bg-card text-card-foreground border border-border shadow-sm ' +
    'dark:bg-gradient-to-br dark:from-[#2b3342] dark:via-[#2a3140] dark:to-[#242c39] ' +
    'dark:border-slate-500/25 dark:shadow-[0_10px_24px_rgba(0,0,0,0.25)]',

  inner:
    'bg-muted/50 border border-border/60 rounded-xl ' +
    'dark:bg-[#313a4a]/65 dark:border-slate-400/10',

  innerPanel:
    'rounded-xl p-2.5 bg-muted/40 border border-border/50 space-y-2.5 ' +
    'dark:bg-[#313a4a]/65 dark:border-slate-400/10',

  chip:
    'bg-secondary/90 border-border/70 text-foreground ' +
    'dark:bg-[#1f2734]/45 dark:border-slate-500/15 dark:hover:bg-[#1f2734]/65',

  chipFocused:
    'bg-accent border-primary/25 text-foreground ' +
    'dark:bg-[#1f2734]/80 dark:border-slate-300/25',

  stat:
    'rounded-md px-2 py-1 bg-muted/60 border border-border/50 ' +
    'dark:bg-[#1f2734]/55 dark:border-slate-500/15',

  statSm:
    'rounded-md px-1.5 py-1 bg-muted/50 border border-border/40 ' +
    'dark:bg-[#1f2734]/50 dark:border-slate-500/10',

  legendRow:
    'rounded-md px-2 py-1 bg-muted/60 border border-border/50 ' +
    'dark:bg-[#1f2734]/55 dark:border-slate-500/15',

  placeholder:
    'border border-dashed border-border bg-muted/30 shadow-sm ' +
    'dark:border-slate-500/20 dark:bg-[#252d3a]/55 dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)]',

  placeholderInner:
    'border border-dashed border-border bg-muted/25 ' +
    'dark:border-slate-500/20 dark:bg-[#1f2734]/45',

  title: 'text-foreground dark:text-slate-100',
  titleMuted: 'text-muted-foreground dark:text-slate-300',
  textStrong: 'text-foreground font-semibold dark:text-slate-100',
  legend: 'text-muted-foreground dark:text-slate-300/80',
  iconAccent: 'text-p38-olive dark:text-lime-400',

  metricValue: 'text-lg font-bold text-foreground tabular-nums',
  metricLabel: 'text-[10px] text-muted-foreground',

  skeletonBar: 'bg-muted-foreground/15 dark:bg-slate-400/20',
  skeletonLine: 'bg-muted-foreground/10 dark:bg-slate-500/20',
  skeletonHeader: 'bg-muted-foreground/20 dark:bg-slate-500/25',

  sectionTitle:
    'text-sm font-medium flex items-center gap-2 uppercase tracking-wide text-foreground dark:text-slate-100',

  gridRoot: 'space-y-3',
};
