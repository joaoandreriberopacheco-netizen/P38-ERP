import { cn } from '@/components/utils';

/**
 * Tabelas Novo Ecosistema — estética tipo Cursor IDE (claro + escuro).
 * Claro: fundo branco/cinza suave, rótulos quase pretos bold, dados em cinza tabular.
 * Escuro: fundo charcoal, rótulos brancos bold, dados em cinza claro tabular.
 */
export const CATALOGO_CURSOR = {
  listShell: cn(
    'overflow-hidden rounded-none border-0 bg-transparent shadow-none',
  ),

  sep: cn(
    'border-b border-black/[0.06] dark:border-white/[0.06]',
  ),
  sepStrong: cn(
    'border-t border-black/[0.10] dark:border-white/10',
  ),

  /** MobileHierarquica — cabeçalho de colunas */
  mobileHeader: cn(
    'relative flex-shrink-0',
    'border-b border-black/[0.08] dark:border-white/[0.08]',
    'bg-[#f3f3f3] dark:bg-[#0a0a0a] text-foreground',
  ),
  mobileRow: cn(
    'border-b border-black/[0.06] dark:border-white/[0.06]',
    'py-3 min-w-0 bg-transparent font-din-1451',
    'hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors',
  ),
  mobileHeaderLabel: cn(
    'text-[11px] font-semibold uppercase tracking-wide text-right min-w-0',
    'text-foreground/60 dark:text-white/65',
  ),
  mobileBodyValue: cn(
    'font-din-1451 text-[13px] font-normal leading-none tabular-nums text-right',
    'text-foreground/45 dark:text-white/45',
  ),
  mobileRowTitle: cn(
    'text-[13px] font-semibold uppercase tracking-wide leading-snug break-words',
    'text-foreground dark:text-white/95',
  ),
  mobileRowMeta: cn(
    'text-[11px] font-normal tabular-nums',
    'text-foreground/45 dark:text-white/40',
  ),
  mobileSkuBadge: cn(
    'text-[10px] font-medium uppercase tracking-wide',
    'text-foreground/40 dark:text-white/35',
  ),
  mobileHierarchyBadge: cn(
    'text-[9px] font-semibold uppercase tracking-wider',
    'text-foreground/50 dark:text-white/45',
  ),
  mobileGroupBand: cn(
    'border-b border-black/[0.06] dark:border-white/[0.06]',
    'bg-black/[0.02] dark:bg-white/[0.02]',
  ),
  mobileSkuSurface: cn(
    'bg-transparent border-b border-black/[0.06] dark:border-white/[0.06]',
  ),
  mobileAxisLine: cn(
    'border-l border-black/[0.10] dark:border-white/20',
  ),
  mobileChevron: cn(
    'text-foreground/45 dark:text-white/40',
  ),

  /** Tabelas planas (mix, solo, pathway) */
  valueTable: 'my-0 overflow-hidden rounded-none border-0 bg-transparent',
  valueHead: cn(
    'gap-x-3 px-3 py-2',
    'border-b border-black/[0.08] dark:border-white/[0.08]',
    'text-[11px] font-semibold text-foreground dark:text-white/90',
  ),
  valueRow: cn(
    'gap-x-3 px-3 py-2.5 items-baseline',
    'border-b border-black/[0.05] dark:border-white/[0.06] last:border-b-0',
    'hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors',
  ),
  valueLabel: cn(
    'text-sm font-semibold uppercase tracking-wide min-w-0 leading-snug break-words',
    'text-foreground dark:text-white/95',
  ),
  valueData: cn(
    'text-sm font-normal tabular-nums text-right',
    'text-foreground/45 dark:text-white/45',
  ),
  valueDataMuted: cn(
    'text-xs font-normal tabular-nums',
    'text-foreground/40 dark:text-white/35',
  ),

  /** Smart Supply — linhas hierárquicas */
  supplyRow: cn(
    'w-full text-left min-w-0 cursor-pointer border-l-0',
    'border-b border-black/[0.06] dark:border-white/[0.06]',
    'hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors',
  ),
  supplyTitle: cn(
    'font-din-1451 text-sm font-semibold uppercase tracking-wide leading-snug',
    'text-foreground dark:text-white/95',
  ),
  supplySubtitle: cn(
    'font-din-1451 text-[11px] font-normal tabular-nums',
    'text-foreground/45 dark:text-white/40',
  ),
  supplyMetric: cn(
    'text-sm font-normal tabular-nums text-right shrink-0',
    'text-foreground/45 dark:text-white/45',
  ),
  supplyMetricNeg: cn(
    'text-sm font-semibold tabular-nums text-right shrink-0',
    'text-red-600 dark:text-red-400',
  ),

  kpiStrip: cn(
    'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs tabular-nums',
    'border-b border-black/[0.06] dark:border-white/[0.06] bg-transparent',
  ),
  kpiStrong: cn(
    'font-semibold text-foreground dark:text-white/95',
  ),
  kpiMuted: cn(
    'text-foreground/45 dark:text-white/40',
  ),

  totalRow: cn(
    'gap-x-3 px-3 py-2.5',
    'border-t border-black/[0.10] dark:border-white/10',
    'font-semibold tabular-nums text-foreground dark:text-white/95',
  ),

  /** Coluna rótulo com divisor vertical (estilo Cursor) */
  labelCol: cn(
    'border-r pr-3 min-w-0',
    'border-black/[0.08] dark:border-white/[0.07]',
  ),

  /** Chips tipo LINHA — neutros em ambos os modos */
  tipoChip: cn(
    'text-[9px] uppercase px-1.5 py-0 rounded-full border font-medium',
    'bg-black/[0.03] text-foreground/70 border-black/[0.08]',
    'dark:bg-white/[0.04] dark:text-white/55 dark:border-white/[0.10]',
  ),
};
