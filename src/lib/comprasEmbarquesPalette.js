/**
 * Paleta da lista de Embarques (ListaPedidosCompra) — ciano Sea Green em Despachado,
 * laranja terracota em Aguardando, lima em Aprovado.
 */

import { p38Accent, P38_AGUARDANDO_ORANGE, P38_CYAN_SEA } from '@/lib/p38ThemeSurfaces';

export { P38_CYAN_SEA, P38_AGUARDANDO_ORANGE };

export const COMPRAS_CHIP_ACTIVE =
  'bg-[#4ECDC4]/12 text-[#1a7a73] ring-1 ring-[#4ECDC4]/25 dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]';
export const COMPRAS_CHIP_INACTIVE =
  'bg-secondary/80 text-muted-foreground dark:bg-[#26262e] dark:text-foreground/80';
export const COMPRAS_CTA =
  'bg-[#3bbdb4] hover:bg-[#34a9a1] text-white dark:bg-[#4ECDC4] dark:hover:bg-[#5fd9d0] dark:text-[#1f1d22]';

/** Pills alinhados a STATUS_CONFIG em ListaPedidosCompra.jsx */
export const COMPRAS_PILL = {
  success: 'bg-lime-50 dark:bg-lime-900/25 text-lime-700 dark:text-[#a4ce33]/85',
  info: 'bg-[#4ECDC4]/12 text-[#1a7a73] dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]',
  warning: 'bg-[#D96F55]/12 text-[#9c4228] dark:bg-[#D96F55]/15 dark:text-[#D96F55]',
  danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-500',
  muted: 'bg-muted/80 text-muted-foreground',
};

/** LED + pill por status de embarque (ListaPedidosCompra). */
export const COMPRAS_STATUS_STYLE = {
  aguardando: {
    dot: 'bg-[#D96F55] dark:bg-[#D96F55]',
    pill: COMPRAS_PILL.warning,
  },
  despachado: {
    dot: 'bg-[#4ECDC4] dark:bg-[#4ECDC4]',
    pill: COMPRAS_PILL.info,
  },
};

export function comprasAccentBorderClass(tone) {
  if (tone === 'danger') return p38Accent.danger.border;
  if (tone === 'warning') return p38Accent.warning.border;
  if (tone === 'info') return p38Accent.info.border;
  if (tone === 'muted') return p38Accent.muted.border;
  return p38Accent.success.border;
}
