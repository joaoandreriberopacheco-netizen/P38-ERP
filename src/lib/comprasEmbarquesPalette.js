/**
 * Paleta da lista de Embarques (ListaPedidosCompra) e Consulta —
 * modo claro: amarelo cítrico em Despachado / chips activos; laranja em Aguardando; lima em Aprovado.
 */

import { cn } from '@/components/utils';
import { p38Accent, P38_AGUARDANDO_ORANGE, P38_CYAN_SEA } from '@/lib/p38ThemeSurfaces';
import { COMPRAS_CHIP_ACTIVE_CITRUS } from '@/lib/comprasP38Theme';

export { P38_CYAN_SEA, P38_AGUARDANDO_ORANGE };

export const COMPRAS_CHIP_ACTIVE = cn(
  COMPRAS_CHIP_ACTIVE_CITRUS,
  'ring-1 ring-[#e8b824]/25 dark:ring-[rgba(99,107,47,0.35)]',
);
export const COMPRAS_CHIP_INACTIVE =
  'bg-card text-muted-foreground shadow-sm dark:bg-[#26262e] dark:text-foreground/80';
export const COMPRAS_CTA =
  'bg-[#e8b824] hover:bg-[#e8b824]/90 text-[#242424] dark:bg-[#4ECDC4] dark:hover:bg-[#5fd9d0] dark:text-[#1f1d22]';

/** Pills alinhados a STATUS_CONFIG em ListaPedidosCompra.jsx — sem contorno (ring). */
export const COMPRAS_PILL = {
  aprovado: 'bg-[#4a5240]/12 text-[#3a4232] dark:bg-[rgba(99,107,47,0.18)] dark:text-[#A8B56E]',
  success: 'bg-[#4a5240]/10 text-[#3a4232] dark:bg-[rgba(99,107,47,0.14)] dark:text-[#A8B56E]/85',
  info: 'bg-[#e8b824]/14 text-[#a8942e] dark:bg-[#4ECDC4]/15 dark:text-[#4ECDC4]',
  warning: 'bg-[#D96F55]/12 text-[#9c4228] dark:bg-[#D96F55]/15 dark:text-[#D96F55]',
  danger: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-500',
  muted: 'bg-muted/80 text-muted-foreground',
};

/** LED + pill — pedido aprovado (pronto para despacho). */
export const COMPRAS_APROVADO_STYLE = {
  dot: 'bg-[#4a5240] dark:bg-[#636B2F]',
  pill: COMPRAS_PILL.aprovado,
};

/** LED + pill por status de embarque (lista + consulta). */
export const COMPRAS_STATUS_STYLE = {
  aguardando: {
    dot: 'bg-[#D96F55] dark:bg-[#D96F55]',
    pill: COMPRAS_PILL.warning,
  },
  despachado: {
    dot: 'bg-[#e8b824] dark:bg-[#4ECDC4]',
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
  if (tone === 'citrus' || tone === 'info') return p38Accent.citrus.border;
  if (tone === 'muted') return p38Accent.muted.border;
  return p38Accent.success.border;
}

/** Bordas laterais alinhadas aos chips de status (lista Embarques + consulta). */
export const COMPRAS_STATUS_BORDER = {
  Rascunho: 'border-l-slate-400/70 dark:border-l-slate-500/60',
  Aguardando: 'border-l-[#D96F55] dark:border-l-[#D96F55]',
  'Aguardando Aprovação Financeira': 'border-l-[#D96F55] dark:border-l-[#D96F55]',
  'Aguardando Liberação Financeira': 'border-l-[#D96F55] dark:border-l-[#D96F55]',
  'Aguardando Liberação': 'border-l-[#D96F55] dark:border-l-[#D96F55]',
  Aprovado: 'border-l-[#4a5240] dark:border-l-[#636B2F]/55',
  Necessidade: 'border-l-red-600 dark:border-l-red-600/70',
  Despachado: 'border-l-[#e8b824] dark:border-l-[#4ECDC4]',
  Concluído: 'border-l-emerald-600 dark:border-l-emerald-500',
  Cancelado: 'border-l-rose-600 dark:border-l-rose-500',
  Pendência: 'border-l-[#D96F55] dark:border-l-[#D96F55]',
};

export function comprasStatusBorderClass(displayStatus, fallbackStatus) {
  const status = String(displayStatus || fallbackStatus || '').trim();
  if (COMPRAS_STATUS_BORDER[status]) return COMPRAS_STATUS_BORDER[status];
  return comprasAccentBorderClass(comprasAccentFromDisplayStatus(status));
}

/** Tom P38 das linhas de produto — alinhado a ListaPedidosCompra / status do embarque. */
export function comprasAccentFromDisplayStatus(displayStatus) {
  const status = String(displayStatus || '').trim();
  if (status === 'Aprovado') return 'aprovado';
  if (status === 'Concluído') return 'success';
  if (status === 'Despachado') return 'citrus';
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
  { codigo: 'Despachado', label: 'Despachado', chip: 'bg-[#e8b824]/15 text-[#a8942e] dark:bg-[#4ECDC4]/20 dark:text-[#4ECDC4]' },
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
  { codigo: 'Despachado', label: 'Despachado', chip: 'bg-[#e8b824]/15 text-[#a8942e] dark:bg-[#4ECDC4]/20 dark:text-[#4ECDC4]' },
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
