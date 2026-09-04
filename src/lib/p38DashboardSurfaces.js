/**
 * Superfícies do Dashboard P38 — claro: branco puro + carvão + toques suaves
 * de amarelo suco (#e8b824) e oliva; escuro: gradiente slate + limão.
 */

const LIGHT_CARD_ACCENT =
  'relative before:absolute before:top-0 before:inset-x-0 before:h-px ' +
  'before:bg-gradient-to-r before:from-[#e8b824]/28 before:via-[#4a5240]/12 before:to-transparent ' +
  'dark:before:from-[#a4ce33]/35 dark:before:via-[#a4ce33]/15 dark:before:to-transparent';

export const p38Dashboard = {
  card:
    `${LIGHT_CARD_ACCENT} bg-card text-card-foreground border-0 shadow-sm ` +
    'dark:bg-gradient-to-br dark:from-[#2b3342] dark:via-[#2a3140] dark:to-[#242c39] ' +
    'dark:border dark:border-slate-500/25 dark:shadow-[0_10px_24px_rgba(0,0,0,0.25)]',

  inner:
    'bg-card border-0 shadow-sm rounded-xl ' +
    'dark:bg-[#313a4a]/65 dark:border dark:border-slate-400/10',

  innerPanel:
    'rounded-xl p-2.5 bg-gradient-to-br from-[#e8b824]/[0.03] via-card to-[#4a5240]/[0.03] ' +
    'border-0 shadow-sm space-y-2.5 ' +
    'dark:from-transparent dark:via-[#313a4a]/65 dark:to-[#313a4a]/65 dark:border dark:border-slate-400/10',

  chip:
    'bg-card border-0 shadow-sm text-foreground ' +
    'dark:bg-[#1f2734]/45 dark:border dark:border-slate-500/15 dark:hover:bg-[#1f2734]/65',

  chipFocused:
    'bg-[#e8b824]/7 text-[#6b6240] border-0 shadow-sm ' +
    'dark:bg-[#1f2734]/80 dark:border dark:border-slate-300/25 dark:text-[#a4ce33]',

  stat:
    'rounded-md px-2 py-1 bg-gradient-to-br from-[#e8b824]/[0.04] to-[#4a5240]/[0.03] border-0 shadow-sm ' +
    'dark:from-[#1f2734]/55 dark:to-[#1f2734]/55 dark:border dark:border-slate-500/15',

  statSm:
    'rounded-md px-1.5 py-1 bg-gradient-to-br from-[#e8b824]/[0.03] to-transparent border-0 shadow-sm ' +
    'dark:from-[#1f2734]/50 dark:to-[#1f2734]/50 dark:border dark:border-slate-500/10',

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
  /** Ícones de secção — oliva suave no claro; amarelo suco no escuro. */
  iconAccent: 'text-[#6d7860] dark:text-[#c8dc72]',
  iconAccentJuice: 'text-[#a8942e] dark:text-[#e8b824]/90',
  percentAbove: 'text-[#7a8458] dark:text-lime-300',

  skeletonBar: 'bg-muted-foreground/15 dark:bg-slate-400/20',
  skeletonLine: 'bg-muted-foreground/10 dark:bg-slate-500/20',
  skeletonHeader: 'bg-muted-foreground/20 dark:bg-slate-500/25',
};
