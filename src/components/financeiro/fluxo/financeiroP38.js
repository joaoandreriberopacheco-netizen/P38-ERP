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
  'bg-secondary/80 text-muted-foreground dark:bg-[#26262e] dark:text-foreground/80 hover:bg-secondary dark:hover:bg-[#383e47]';
/** Superfície operacional — mesma cor da busca, altura automática (KPIs, pills, painéis). */
export const P38_FIELD_SURFACE = 'p38-field-surface border-0 shadow-none';
/** Campo de busca — inclui h-11 fixo; não usar em KPIs/listas. */
export const P38_SEARCH = 'p38-search-field border-0 shadow-none focus-visible:ring-1 focus-visible:ring-border/60';
export const P38_POPOVER =
  'border border-border/40 dark:border-white/10 shadow-xl rounded-2xl bg-card dark:bg-[#2d333b]';
export const P38_KPI_SHELL =
  `rounded-xl ${P38_FIELD_SURFACE} px-3 py-2.5 sm:px-3 sm:py-2.5`;
export const P38_ACCENT = 'text-[#4a5240] dark:text-[#a4ce33]';
/** Mobile: busca + ícones fixos ao rolar; desktop sem sticky. */
export const P38_FILTROS_STICKY =
  'sticky top-0 z-30 bg-background/95 py-2 backdrop-blur-sm md:static md:z-auto md:bg-transparent md:py-0 md:backdrop-blur-none';
