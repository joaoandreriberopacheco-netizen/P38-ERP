/**
 * Paleta da lista de Embarques (ListaPedidosCompra) — ciano nos CTAs/Despachado,
 * lima em Aprovado, âmbar em pendências financeiras, vermelho em Aguardando.
 * Composição mobile partilha superfícies P38_FIELD_SURFACE / P38_KPI_SHELL.
 */

export const COMPRAS_CHIP_ACTIVE =
  'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-500/25 dark:bg-cyan-950/40 dark:text-cyan-300';
export const COMPRAS_CHIP_INACTIVE =
  'bg-secondary/80 text-muted-foreground dark:bg-[#26262e] dark:text-foreground/80';
export const COMPRAS_CTA =
  'bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-[#1f1d22]';

/** Pills alinhados a STATUS_CONFIG em ListaPedidosCompra.jsx */
export const COMPRAS_PILL = {
  success: 'bg-lime-50 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
  info: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-500',
  warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  danger: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  muted: 'bg-muted/80 text-muted-foreground',
};

export function comprasAccentBorderClass(tone) {
  if (tone === 'danger') return 'border-l-red-500 dark:border-l-red-400';
  if (tone === 'warning') return 'border-l-amber-500 dark:border-l-amber-400';
  if (tone === 'info') return 'border-l-cyan-600 dark:border-l-cyan-600/55';
  if (tone === 'muted') return 'border-l-transparent';
  return 'border-l-lime-400 dark:border-l-lime-400';
}
