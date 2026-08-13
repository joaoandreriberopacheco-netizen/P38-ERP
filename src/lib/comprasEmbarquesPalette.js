/**
 * Paleta da lista de Embarques (ListaPedidosCompra) — ciano nos CTAs/Despachado,
 * lima em Aprovado, âmbar em pendências financeiras, vermelho em Aguardando.
 * Composição mobile partilha superfícies P38_FIELD_SURFACE / P38_KPI_SHELL.
 */

import { p38Accent } from '@/lib/p38ThemeSurfaces';

export const COMPRAS_CHIP_ACTIVE =
  'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-500/20 dark:bg-cyan-950/30 dark:text-cyan-500';
export const COMPRAS_CHIP_INACTIVE =
  'bg-secondary/80 text-muted-foreground dark:bg-[#26262e] dark:text-foreground/80';
export const COMPRAS_CTA =
  'bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:text-[#1f1d22]';

/** Pills alinhados a STATUS_CONFIG em ListaPedidosCompra.jsx */
export const COMPRAS_PILL = {
  success: 'bg-lime-50 dark:bg-lime-900/25 text-lime-700 dark:text-[#a4ce33]/85',
  info: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-500',
  warning: 'bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-500',
  danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-500',
  muted: 'bg-muted/80 text-muted-foreground',
};

export function comprasAccentBorderClass(tone) {
  if (tone === 'danger') return p38Accent.danger.border;
  if (tone === 'warning') return p38Accent.warning.border;
  if (tone === 'info') return p38Accent.info.border;
  if (tone === 'muted') return p38Accent.muted.border;
  return p38Accent.success.border;
}
