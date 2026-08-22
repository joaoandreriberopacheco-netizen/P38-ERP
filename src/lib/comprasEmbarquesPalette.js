/**
 * Paleta da lista de Embarques (ListaPedidosCompra) — ciano Sea Green em Despachado,
 * laranja terracota em Aguardando, lima em Aprovado.
 */

import { p38Accent, P38_AGUARDANDO_ORANGE, P38_CYAN_SEA } from '@/lib/p38ThemeSurfaces';

export { P38_CYAN_SEA, P38_AGUARDANDO_ORANGE };

export const COMPRAS_CHIP_ACTIVE =
  'bg-[#4ECDC4]/12 text-[#1a7a73] ring-1 ring-[#4ECDC4]/25 dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]';
export const COMPRAS_CHIP_INACTIVE =
  'bg-card text-muted-foreground shadow-sm dark:bg-[#26262e] dark:text-foreground/80';
export const COMPRAS_CTA =
  'bg-[#3bbdb4] hover:bg-[#34a9a1] text-white dark:bg-[#4ECDC4] dark:hover:bg-[#5fd9d0] dark:text-[#1f1d22]';

/** Pills alinhados a STATUS_CONFIG em ListaPedidosCompra.jsx — sem contorno (ring). */
export const COMPRAS_PILL = {
  aprovado: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-[#a4ce33]',
  success: 'bg-lime-50 dark:bg-lime-900/25 text-lime-700 dark:text-[#a4ce33]/85',
  info: 'bg-[#4ECDC4]/12 text-[#1a7a73] dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]',
  warning: 'bg-[#D96F55]/12 text-[#9c4228] dark:bg-[#D96F55]/15 dark:text-[#D96F55]',
  danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-500',
  muted: 'bg-muted/80 text-muted-foreground',
};

/** LED + pill — pedido aprovado (pronto para despacho). */
export const COMPRAS_APROVADO_STYLE = {
  dot: 'bg-lime-500 dark:bg-[#a4ce33]',
  pill: COMPRAS_PILL.aprovado,
};

/** LED + pill por status de embarque (lista + consulta). */
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

export const COMPRAS_STATUS_CONFIG = {
  Rascunho: { dot: 'bg-slate-500 dark:bg-slate-500/60', pill: 'bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-400' },
  Aguardando: COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Aprovação Financeira': COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Liberação Financeira': COMPRAS_STATUS_STYLE.aguardando,
  'Aguardando Liberação': COMPRAS_STATUS_STYLE.aguardando,
  Aprovado: COMPRAS_APROVADO_STYLE,
  Necessidade: { dot: 'bg-red-500 dark:bg-red-500/70', pill: COMPRAS_PILL.danger },
  Despachado: COMPRAS_STATUS_STYLE.despachado,
  Concluído: { dot: 'bg-emerald-600 dark:bg-emerald-600/70', pill: 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-500' },
  Cancelado: { dot: 'bg-rose-600 dark:bg-rose-600/70', pill: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-500' },
};

export function resolveComprasStatusConfig(displayStatus, fallbackStatus) {
  return COMPRAS_STATUS_CONFIG[displayStatus] || COMPRAS_STATUS_CONFIG[fallbackStatus] || COMPRAS_STATUS_CONFIG.Rascunho;
}

export function getComprasDisplayStatusLabel(displayStatus) {
  if (displayStatus === 'Aguardando Liberação Financeira' || displayStatus === 'Aguardando Aprovação Financeira') {
    return 'Aguard. Pgto';
  }
  if (displayStatus === 'Necessidade') return 'Necessidade';
  return displayStatus;
}

export function comprasAccentBorderClass(tone) {
  if (tone === 'aprovado') return p38Accent.aprovado.border;
  if (tone === 'danger') return p38Accent.danger.border;
  if (tone === 'warning') return p38Accent.warning.border;
  if (tone === 'info') return p38Accent.info.border;
  if (tone === 'muted') return p38Accent.muted.border;
  return p38Accent.success.border;
}

/** Tom P38 das linhas de produto — alinhado a ListaPedidosCompra / status do embarque. */
export function comprasAccentFromDisplayStatus(displayStatus) {
  const status = String(displayStatus || '').trim();
  if (status === 'Aprovado') return 'aprovado';
  if (status === 'Concluído') return 'success';
  if (status === 'Despachado') return 'info';
  if (status === 'Aguardando' || status.includes('Aguard') || status.includes('Aprovação')) return 'warning';
  if (status === 'Necessidade') return 'danger';
  if (status === 'Cancelado') return 'danger';
  return 'muted';
}

/** Opções de status alinhadas ao filtro em PedidosCompra.jsx / getBorrowedStatus. */
export const COMPRAS_FILTRO_STATUS_PEDIDO = [
  { codigo: 'Rascunho', label: 'Rascunho', chip: 'bg-muted text-foreground/90' },
  { codigo: 'Aguardando Liberação', label: 'Aguard. pagamento', chip: 'bg-[#D96F55]/15 text-[#9c4228] dark:bg-[#D96F55]/20 dark:text-[#D96F55]' },
  { codigo: 'Aguardando', label: 'Aguard. embarque', chip: 'bg-[#D96F55]/15 text-[#9c4228] dark:bg-[#D96F55]/20 dark:text-[#D96F55]' },
  { codigo: 'Aprovado', label: 'Aprovado', chip: COMPRAS_PILL.aprovado },
  { codigo: 'Necessidade', label: 'Necessidade', chip: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400' },
  { codigo: 'Despachado', label: 'Despachado', chip: 'bg-[#4ECDC4]/15 text-[#1a7a73] dark:bg-[#4ECDC4]/20 dark:text-[#4ECDC4]' },
  { codigo: 'Concluído', label: 'Concluído', chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-500' },
  { codigo: 'Cancelado', label: 'Cancelado', chip: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-500' },
];

/** Seletor rápido (chip) — status operacionais do pedido/embarque. */
export const COMPRAS_FILTRO_STATUS_PICKER = [
  { codigo: 'Rascunho', label: 'Rascunho', chip: 'bg-muted text-foreground/90' },
  { codigo: 'Aguardando Liberação', label: 'Aguard. pagamento', chip: 'bg-[#D96F55]/15 text-[#9c4228] dark:bg-[#D96F55]/20 dark:text-[#D96F55]' },
  { codigo: 'Aprovado', label: 'Aprovado', chip: COMPRAS_PILL.aprovado },
  { codigo: 'Necessidade', label: 'Necessidade', chip: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400' },
  { codigo: 'Aguardando', label: 'Pend. entrega', chip: 'bg-[#D96F55]/15 text-[#9c4228] dark:bg-[#D96F55]/20 dark:text-[#D96F55]' },
  { codigo: 'Despachado', label: 'Despachado', chip: 'bg-[#4ECDC4]/15 text-[#1a7a73] dark:bg-[#4ECDC4]/20 dark:text-[#4ECDC4]' },
  { codigo: 'Concluído', label: 'Concluído', chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-500' },
];

export const COMPRAS_FILTRO_STATUS_RECEBIMENTO = [
  { codigo: 'Aguardando Embarque', label: 'Sem embarque', chip: 'bg-orange-50 text-orange-800 dark:bg-orange-900/25 dark:text-orange-300' },
  { codigo: 'Recebido Parcial', label: 'Receb. parcial', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-400' },
  { codigo: 'Recebido OK', label: 'Recebido OK', chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-500' },
  { codigo: 'Com Divergência', label: 'Divergência', chip: 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400' },
];

export const COMPRAS_FILTRO_STATUS_ALL = [
  ...COMPRAS_FILTRO_STATUS_PEDIDO,
  ...COMPRAS_FILTRO_STATUS_RECEBIMENTO,
];
