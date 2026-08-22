/**
 * Superfícies do Dashboard P38 — claro: branco puro + carvão; escuro: gradiente slate.
 */

export const p38Dashboard = {
  card:
    'bg-card text-card-foreground border-0 shadow-sm ' +
    'dark:bg-gradient-to-br dark:from-[#2b3342] dark:via-[#2a3140] dark:to-[#242c39] ' +
    'dark:border dark:border-slate-500/25 dark:shadow-[0_10px_24px_rgba(0,0,0,0.25)]',

  inner:
    'bg-card border-0 shadow-sm rounded-xl ' +
    'dark:bg-[#313a4a]/65 dark:border dark:border-slate-400/10',

  innerPanel:
    'rounded-xl p-2.5 bg-card border-0 shadow-sm space-y-2.5 ' +
    'dark:bg-[#313a4a]/65 dark:border dark:border-slate-400/10',

  chip:
    'bg-card border-0 shadow-sm text-foreground ' +
    'dark:bg-[#1f2734]/45 dark:border dark:border-slate-500/15 dark:hover:bg-[#1f2734]/65',

  chipFocused:
    'bg-[#f07a1a]/10 text-[#f07a1a] border-0 shadow-sm ' +
    'dark:bg-[#1f2734]/80 dark:border dark:border-slate-300/25 dark:text-[#a4ce33]',

  stat:
    'rounded-md px-2 py-1 bg-card border-0 shadow-sm ' +
    'dark:bg-[#1f2734]/55 dark:border dark:border-slate-500/15',

  statSm:
    'rounded-md px-1.5 py-1 bg-card border-0 shadow-sm ' +
    'dark:bg-[#1f2734]/50 dark:border dark:border-slate-500/10',

  legendRow:
    'rounded-md px-2 py-1 bg-card border-0 shadow-sm ' +
    'dark:bg-[#1f2734]/55 dark:border dark:border-slate-500/15',

  placeholder:
    'border border-dashed border-border/40 bg-background shadow-sm ' +
    'dark:border-slate-500/20 dark:bg-[#252d3a]/55 dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)]',

  placeholderInner:
    'border border-dashed border-border/40 bg-card ' +
    'dark:border-slate-500/20 dark:bg-[#1f2734]/45',

  title: 'text-foreground dark:text-slate-100',
  titleMuted: 'text-muted-foreground dark:text-slate-300',
  textStrong: 'text-foreground font-semibold dark:text-slate-100',
  legend: 'text-muted-foreground dark:text-slate-300/80',
  iconAccent: 'text-[#f07a1a] dark:text-lime-400',

  skeletonBar: 'bg-muted-foreground/15 dark:bg-slate-400/20',
  skeletonLine: 'bg-muted-foreground/10 dark:bg-slate-500/20',
  skeletonHeader: 'bg-muted-foreground/20 dark:bg-slate-500/25',
};
