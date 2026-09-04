/**
 * Smart Supply — tabela drill-down estilo Cursor: aberta, linhas finas, sem sombras.
 */

export const SUPPLY_CURSOR = {
  shell: 'w-full overflow-auto bg-background dark:bg-[#1e1e1e] border-0 shadow-none rounded-none',
  ranger: 'flex flex-wrap items-center gap-3 px-3 py-2 border-b border-border/30 dark:border-white/[0.08] bg-transparent',
  table: 'table-fixed min-w-[720px] w-full border-collapse',
  headerRow: 'border-b border-border/35 dark:border-white/[0.08] hover:bg-transparent',
  head: 'h-auto py-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80 dark:text-[#858585]',
  headRight: 'text-right',
  row: 'border-b border-border/25 dark:border-white/[0.06] bg-transparent hover:bg-muted/25 dark:hover:bg-white/[0.03] transition-colors shadow-none',
  cell: 'py-1.5 px-3 align-middle text-sm',
  cellNumeric: 'tabular-nums text-right text-muted-foreground',
  label: 'truncate font-normal text-foreground/90 dark:text-[#cccccc]',
  labelStrong: 'truncate font-medium text-foreground dark:text-[#e8e8e8]',
  labelMuted: 'truncate text-xs text-muted-foreground/75 dark:text-[#858585]',
  toggleBtn: 'flex h-6 w-6 items-center justify-center rounded-sm hover:bg-muted/40 dark:hover:bg-white/[0.06]',
  chevron: 'h-3.5 w-3.5 text-muted-foreground/60',
};

/** Recuo por profundidade (px) — máx. 6 níveis. */
export function supplyCursorIndent(depth = 0) {
  return 8 + Math.min(depth, 6) * 14;
}

export const FAIXA_LABEL = {
  portfolio: 'Portfólio',
  mix_pvc: 'Mix PVC',
  mix_metal: 'Mix metálico',
};

export const NODE_KIND_LABEL = {
  categoria: 'Categoria',
  linha: 'LINHA',
  faixa: 'Faixa',
  modelo: 'Modelo',
  kit: 'Kit',
  esquadra: 'Produto compra',
  sku: 'SKU',
};
