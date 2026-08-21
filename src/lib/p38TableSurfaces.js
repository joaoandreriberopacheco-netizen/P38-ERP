/**
 * P38 Table Design System — origem: Relatório de Margem (mobile + desktop).
 * Irradia para ui/table, TreeGrid, vendas, produtos, financeiro, compras, etc.
 */

export const p38Table = {
  /** Contentor rolável com borda e fundo da página */
  shell: 'rounded-xl border border-border bg-background shadow-sm overflow-auto',
  shellFlat: 'rounded-lg border border-border bg-background overflow-hidden',

  /** thead sticky — mesmo fundo da tabela; separação só por borda */
  header: 'sticky top-0 z-30 backdrop-blur-sm bg-background text-foreground [&_tr]:border-b [&_tr]:border-border/40 dark:[&_tr]:border-white/10 [&_tr]:hover:bg-transparent',
  /** thead sem blur — evita artefactos de composição com colunas sticky (TreeGrid) */
  headerSolid: 'sticky top-0 z-30 bg-background text-foreground [&_tr]:border-b [&_tr]:border-border/40 dark:[&_tr]:border-white/10 [&_tr]:hover:bg-transparent',
  head: 'h-auto py-2 px-2 align-middle text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground/90',
  headSortable: 'cursor-pointer hover:text-foreground dark:hover:text-white',
  headRight: 'text-right',
  headCenter: 'text-center',

  /** Linhas de dados */
  row: 'border-b border-border/15 bg-background transition-colors hover:bg-secondary/25 dark:border-white/10 dark:hover:bg-secondary/30',
  rowInteractive: 'cursor-pointer select-none',

  /** Células compactas (densidade ERP) */
  cell: 'py-1.5 px-2 align-middle text-sm',
  cellNumeric: 'tabular-nums text-right',
  cellMuted: 'text-muted-foreground',
  cellStrong: 'font-semibold text-foreground',
  cellAccent: 'font-semibold text-[#4a5240] dark:text-[#a4ce33]',

  /** Colunas sticky (TreeGrid, catálogo) */
  stickyHead: 'sticky z-40 bg-background text-foreground',
  stickyHeadLeft: 'sticky left-0 z-40 bg-background text-foreground border-r border-border/40 dark:border-white/10 [transform:translateZ(0)] [backface-visibility:hidden]',
  stickyCell: 'sticky z-20 bg-background border-r border-border/40 dark:border-white/10 [transform:translateZ(0)] [backface-visibility:hidden]',
  stickyCellLeft: 'sticky left-0 z-20 bg-background [transform:translateZ(0)] [backface-visibility:hidden]',

  /** Painéis mobile / resumo */
  panel: 'bg-card text-card-foreground rounded-lg border-0 shadow-sm dark:border dark:border-white/10',
  panelAccentBar: 'bg-[#4a5240] dark:bg-[#a4ce33]',
  accentDot: 'w-1.5 h-1.5 rounded-full bg-[#4a5240] dark:bg-[#a4ce33]',

  bodyText: 'text-base font-din-1451',
  microText: 'text-xs',

  /** Linhas mobile compactas (substituem cards em smartphone) */
  mobileLine: 'border-b border-border/15 dark:border-white/10 border-l-2 py-3 pr-3 pl-4 tablet-portrait:py-4 tablet-portrait:pr-4 tablet-portrait:pl-5 tablet-landscape:py-3.5 tablet-landscape:pl-4 min-w-0 bg-background font-din-1451',
  /** Catálogo mobile — fundo transparente; linha suave */
  catalogMobileRow: 'border-b border-border/15 dark:border-white/10 py-4.5 tablet-portrait:py-5 min-w-0 bg-transparent font-din-1451',
  catalogMobileHeader:
    'flex-shrink-0 border-t-2 border-t-[#f07a1a] dark:border-t-[#a4ce33] border-b border-border/15 dark:border-white/10 bg-background text-foreground shadow-sm',
  /** Mesma linha com barra lateral semântica mais fina (1px) — financeiro */
  mobileLineThin: 'border-b border-border/15 dark:border-white/10 border-l py-3 pr-14 pl-3 sm:pr-4 sm:pl-4 min-w-0 bg-background font-din-1451',
  mobileLineInteractive: 'active:bg-secondary/30 cursor-pointer select-none min-h-[52px] tablet-portrait:min-h-[60px] touch-pan-y',
  mobileLineTitle: 'font-din-1451 font-medium text-sm sm:text-base tablet-portrait:text-lg uppercase tracking-wide text-foreground leading-snug line-clamp-2 break-words',
  mobileLineSubtitle: 'text-[11px] sm:text-xs tablet-portrait:text-sm text-muted-foreground line-clamp-2 break-words mt-0.5 font-din-1451',
  mobileLineMeta: 'text-xs tablet-portrait:text-sm uppercase tracking-wide text-muted-foreground font-din-1451',
  mobileLineMetaInline: 'text-xs tablet-portrait:text-sm normal-case tracking-normal text-muted-foreground font-din-1451',
  mobileLineValue: 'font-semibold text-sm sm:text-base tablet-portrait:text-lg text-foreground text-right tabular-nums font-din-1451 whitespace-nowrap',
  mobileLineValueSub: 'text-xs tablet-portrait:text-sm text-muted-foreground text-right font-din-1451',
  mobileMicroLabel: 'text-xs tablet-portrait:text-sm uppercase tracking-wide text-muted-foreground leading-none font-din-1451',
  /** Lista mobile: telemóvel + tablet retrato; tabelas em desktop + tablet paisagem. */
  mobileListShell: 'desktop-layout:hidden overflow-y-auto rounded-lg border-0 shadow-sm bg-background dark:border dark:border-white/10',
  /** Lista de linhas em todos os viewports (caixa, home-style lists). */
  lineListShell: 'overflow-y-auto rounded-lg border-0 shadow-sm bg-background dark:border dark:border-white/10',
};

/** @deprecated Use p38Table — alias para migração gradual */
export const MARGIN_TABLE_PANEL = p38Table.panel;
export const MARGIN_TABLE_HEAD = p38Table.head;
export const MARGIN_TABLE_BORDER = 'border-border/40 dark:border-white/10';
export const MARGIN_TABLE_ROW = p38Table.row;
export const MARGIN_ACCENT_VALUE = p38Table.cellAccent;
export const MARGIN_MUTED_VALUE = p38Table.cellMuted;
export const MARGIN_BODY_TEXT = p38Table.bodyText;
export const MARGIN_TABLE_MICRO = p38Table.microText;
