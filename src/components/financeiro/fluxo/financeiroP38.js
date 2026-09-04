/**
 * Tokens P38 partilhados — fluxo de caixa, contas abertas e Planejamento.
 *
 * Referência visual mobile (aprovada 2026-07-29 — João André):
 * Planejamento financeiro dark — limão nos CTAs, carvão de fundo, superfícies
 * P38_FIELD_SURFACE / P38_KPI_SHELL. Ver .cursor/rules/p38-mobile-referencia-planejamento.mdc
 * e docs/p38-mobile-rollout.md §0.
 */

export const P38_CHIP_ACTIVE =
  'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]';
export const P38_CHIP_INACTIVE =
  'bg-card text-muted-foreground shadow-sm dark:bg-[#26262e] dark:text-foreground/80 hover:bg-secondary/50 dark:hover:bg-[#383e47]';
/** Superfície operacional — branco puro no claro. */
export const P38_FIELD_SURFACE = 'bg-card border-0 shadow-sm dark:p38-field-surface dark:shadow-none';
/** Campo de busca — branco com sombra leve no claro. */
export const P38_SEARCH = 'bg-card border-0 shadow-sm h-11 rounded-lg focus-visible:ring-2 focus-visible:ring-[#e8b824]/22 dark:p38-search-field dark:shadow-none dark:focus-visible:ring-1 dark:focus-visible:ring-border/60';
/** Busca com contraste no modo claro (card branco, sem borda); P38 no escuro. */
export const P38_SEARCH_SURFACE =
  'rounded-xl border-0 shadow-none bg-card dark:bg-transparent p38-field-surface';
/** Painel de resultados tipo lista suspensa. */
export const P38_DROPDOWN_PANEL =
  'bg-card dark:bg-background';
export const P38_POPOVER =
  'border border-border/40 dark:border-white/10 shadow-xl rounded-2xl bg-card dark:bg-[#2d333b]';
export const P38_KPI_SHELL =
  'rounded-xl bg-card border-0 shadow-sm px-3 py-2.5 sm:px-3 sm:py-2.5 dark:p38-field-surface dark:shadow-none';
export const P38_ACCENT = 'text-[#a8942e] dark:text-[#a4ce33]';
/** Mobile: busca + ícones fixos ao rolar; desktop sem sticky. */
export const P38_FILTROS_STICKY =
  'sticky top-0 z-30 bg-background/95 py-2 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:py-0 md:backdrop-blur-none';
