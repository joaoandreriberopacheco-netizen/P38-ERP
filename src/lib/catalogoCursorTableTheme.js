import { cn } from '@/components/utils';

/**
 * Tabelas Novo Ecosistema — estética tipo Cursor IDE:
 * fundo plano, divisores quase invisíveis, rótulos em bold/branco, dados em cinza tabular.
 */
export const CATALOGO_CURSOR = {
  listShell: cn(
    'overflow-hidden rounded-none border-0 bg-transparent shadow-none',
  ),

  sep: 'border-b border-border/25 dark:border-white/[0.06]',
  sepStrong: 'border-t border-border/40 dark:border-white/10',

  /** MobileHierarquica — cabeçalho de colunas */
  mobileHeader: cn(
    'relative flex-shrink-0 border-b border-border/30 dark:border-white/[0.08]',
    'bg-muted/35 dark:bg-[#0a0a0a] text-foreground',
  ),
  mobileRow: cn(
    'border-b border-border/25 dark:border-white/[0.06] py-3 min-w-0 bg-transparent font-din-1451',
    'hover:bg-muted/20 dark:hover:bg-white/[0.025] transition-colors',
  ),
  mobileHeaderLabel:
    'text-[11px] font-semibold uppercase tracking-wide text-right text-foreground/75 dark:text-white/65 min-w-0',
  mobileBodyValue:
    'font-din-1451 text-[13px] font-normal leading-none tabular-nums text-right text-muted-foreground dark:text-white/45',
  mobileRowTitle:
    'text-[13px] font-semibold uppercase tracking-wide text-foreground dark:text-white/95 leading-snug break-words',
  mobileRowMeta:
    'text-[11px] font-normal text-muted-foreground dark:text-white/40 tabular-nums',
  mobileSkuBadge:
    'text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-white/35',
  mobileGroupBand:
    'bg-muted/25 dark:bg-white/[0.02] border-b border-border/30 dark:border-white/[0.06]',
  mobileSkuSurface:
    'bg-transparent border-b border-border/25 dark:border-white/[0.06]',

  /** Tabelas planas (mix, solo, pathway) */
  valueTable: 'my-0 overflow-hidden rounded-none border-0 bg-transparent',
  valueHead: cn(
    'gap-x-3 px-3 py-2 border-b border-border/30 dark:border-white/[0.08]',
    'text-[11px] font-semibold text-foreground dark:text-white/90',
  ),
  valueRow: cn(
    'gap-x-3 px-3 py-2.5 items-baseline',
    'border-b border-border/20 dark:border-white/[0.06] last:border-b-0',
    'hover:bg-muted/15 dark:hover:bg-white/[0.02] transition-colors',
  ),
  valueLabel:
    'text-sm font-semibold uppercase tracking-wide text-foreground dark:text-white/95 min-w-0 leading-snug break-words',
  valueData:
    'text-sm font-normal tabular-nums text-right text-muted-foreground dark:text-white/45',
  valueDataMuted:
    'text-xs font-normal tabular-nums text-muted-foreground/85 dark:text-white/35',

  /** Smart Supply — linhas hierárquicas */
  supplyRow: cn(
    'w-full text-left min-w-0 cursor-pointer border-b border-border/25 dark:border-white/[0.06]',
    'hover:bg-muted/20 dark:hover:bg-white/[0.025] transition-colors border-l-0',
  ),
  supplyTitle:
    'font-din-1451 text-sm font-semibold uppercase tracking-wide text-foreground dark:text-white/95 leading-snug',
  supplySubtitle:
    'font-din-1451 text-[11px] font-normal text-muted-foreground dark:text-white/40 tabular-nums',
  supplyMetric:
    'text-sm font-normal tabular-nums text-right text-muted-foreground dark:text-white/45 shrink-0',
  supplyMetricNeg:
    'text-sm font-semibold tabular-nums text-right text-red-600 dark:text-red-400 shrink-0',

  kpiStrip: cn(
    'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs tabular-nums',
    'border-b border-border/30 dark:border-white/[0.06] bg-transparent',
  ),
  kpiStrong: 'font-semibold text-foreground dark:text-white/95',
  kpiMuted: 'text-muted-foreground dark:text-white/40',

  totalRow: cn(
    'gap-x-3 px-3 py-2.5 border-t border-border/40 dark:border-white/10',
    'font-semibold text-foreground dark:text-white/95 tabular-nums',
  ),

  /** Coluna rótulo com divisor vertical (estilo Cursor) */
  labelCol: 'border-r border-border/30 dark:border-white/[0.07] pr-3 min-w-0',
};
