/**
 * Catálogo novo + SMART SUPPLY — linhas finas, cítrico (claro) e oliva-caixa (dark).
 * Inspirado na lista de Embarques (LED 1.5px, vlines, hierarquia L0–L7).
 */
import { cn } from '@/components/utils';
import { P38_LIGHT_HEADER_ACCENT, P38_LIGHT_VLINE } from '@/lib/p38LightTheme';
import { COMPRAS_SEP } from '@/lib/comprasP38Theme';

export const CATALOGO_OLIVE_LIGHT = '#4a5240';
export const CATALOGO_OLIVE_DARK = '#636B2F';
export const CATALOGO_OLIVE_TEXT_DARK = '#A8B56E';
export const CATALOGO_CITRUS = '#e8b824';
export const CATALOGO_CITRUS_TEXT = '#a8942e';

export const CATALOGO_SEP = COMPRAS_SEP;

/** Recuo + vline por nível (grid tree). */
export const CATALOGO_LEVEL = {
  0: 'ml-0 pl-2.5 border-l-[3px] border-l-[#e8b824] dark:border-l-[#A8B56E]/90',
  1: 'ml-0.5 pl-3 border-l-2 border-l-[#4a5240]/75 dark:border-l-[#636B2F]/80',
  2: 'ml-2 pl-3 border-l-2 border-l-[#4a5240]/55 dark:border-l-[#A8B56E]/55',
  3: 'ml-4 pl-3 border-l border-l-dashed border-l-[#e8b824]/65 dark:border-l-[#636B2F]/50',
  4: 'ml-6 pl-3 border-l border-l-[#e8b824]/45 dark:border-l-[#636B2F]/45',
  5: 'ml-8 pl-3 border-l border-l-border/45 dark:border-l-white/12',
  6: 'ml-10 pl-3 border-l border-l-border/35 dark:border-l-white/10',
  7: 'ml-12 pl-3 border-l border-l-border/28 dark:border-l-white/[0.08]',
  8: 'ml-14 pl-3 border-l border-l-dotted border-l-border/25 dark:border-l-white/[0.06]',
};

export const CATALOGO_LEVEL_ROW = {
  0: 'bg-[#e8b824]/[0.10] dark:bg-[#636B2F]/[0.18]',
  1: 'bg-muted/25 dark:bg-white/[0.035]',
  2: 'bg-[#4a5240]/[0.05] dark:bg-[#636B2F]/[0.09]',
  3: 'bg-[#e8b824]/[0.05] dark:bg-[#636B2F]/[0.07]',
  4: 'bg-transparent',
  5: 'bg-muted/15 dark:bg-white/[0.02]',
  6: 'bg-transparent',
  7: 'bg-muted/8 dark:bg-white/[0.012]',
  8: 'bg-transparent',
};

export const CATALOGO_LEVEL_TITLE = {
  0: 'text-[15px] font-normal tracking-wide',
  1: 'text-sm font-light',
  2: 'text-sm font-light text-foreground/95',
  3: 'text-[13px] font-light text-[#a8942e] dark:text-[#A8B56E]',
  4: 'text-sm font-light',
  5: 'text-[13px] font-light normal-case',
  6: 'text-[12px] font-light normal-case tracking-wide',
  7: 'text-[12px] font-light normal-case',
  8: 'text-[11px] font-light normal-case text-muted-foreground',
};

/** Linha de grelha — header expansível ou folha (PC / grade). */
export const CATALOGO_GRID_ROW = cn(
  'relative w-full min-w-0',
  CATALOGO_SEP,
);

export const CATALOGO_GRID_INNER = cn(
  'flex items-start gap-1.5 min-w-0 w-full py-2.5 pr-2.5 pl-0.5',
  'transition-colors',
);

export const CATALOGO_GRID_HEADER_BTN = cn(
  CATALOGO_GRID_INNER,
  'text-left cursor-pointer hover:bg-muted/25 dark:hover:bg-white/[0.04]',
);

export const CATALOGO_GRID_LEAF = cn(
  CATALOGO_GRID_INNER,
  'cursor-default',
);

export const CATALOGO_HIER_L0 = 'pl-2 min-w-0 max-w-full';
export const CATALOGO_HIER_L1 = cn('ml-1 pl-2 md:ml-2 md:pl-3 min-w-0 max-w-full', P38_LIGHT_VLINE);
export const CATALOGO_HIER_L2 = cn('ml-1 pl-2 md:ml-3 md:pl-3.5 min-w-0 max-w-full border-l border-[#e8b824]/35 dark:border-[#636B2F]/45');
export const CATALOGO_HIER_L3 = cn('ml-1 pl-2 md:ml-4 md:pl-4 min-w-0 max-w-full border-l border-border/30 dark:border-white/[0.07]');

export const CATALOGO_PAGE = 'bg-background text-foreground font-din-1451 min-h-full';
export const CATALOGO_HEADER = cn(
  'sticky top-0 z-30 bg-background border-b border-border/35 shadow-sm relative overflow-hidden',
);
export const CATALOGO_HEADER_ACCENT = P38_LIGHT_HEADER_ACCENT;

export const CATALOGO_LIST_SHELL = cn(
  'overflow-hidden rounded-lg bg-background dark:bg-[#1f1d22]/40',
  'border border-border/30 dark:border-white/[0.06]',
  'shadow-sm',
);

/** Árvore hierárquica — linhas finas, texto legível (estilo Embarques / TreeGrid). */
export const CATALOGO_TREE_ROW = cn(
  'flex w-full items-center gap-1.5 min-w-0 pr-3 py-2 text-left',
  'border-b border-border/35 dark:border-white/10',
  'font-din-1451 text-sm text-foreground/90',
  'hover:bg-muted/12 dark:hover:bg-white/[0.02] transition-colors',
);

export const CATALOGO_TREE_ROW_HINT = cn(
  'shrink-0 text-[10px] tabular-nums text-muted-foreground/75 font-light',
);

export const CATALOGO_TREE_TABLE_SLOT = cn(
  'pb-2 pr-2 border-b border-border/35 dark:border-white/10',
);

export const CATALOGO_VIEW_TAB_GROUP = 'flex w-full border-b border-border/35 bg-background';
export const CATALOGO_VIEW_TAB = cn(
  'flex-1 py-2.5 px-2 text-[11px] font-light uppercase tracking-wide border-b-2 border-transparent transition-colors min-w-0',
  'text-muted-foreground',
  'data-[active=true]:border-[#e8b824] data-[active=true]:text-[#a8942e]',
  'dark:data-[active=true]:border-[#636B2F] dark:data-[active=true]:text-[#A8B56E]',
);

/** Abas exclusivas Solo | Mix | Portfolio */
export const CATALOGO_TIPO_TAB_GROUP = cn(
  CATALOGO_VIEW_TAB_GROUP,
  'rounded-lg border border-border/30 dark:border-white/[0.06] overflow-hidden',
);

export const CATALOGO_TIPO_TAB = cn(
  CATALOGO_VIEW_TAB,
  'data-[active=true]:border-border/60 data-[active=true]:text-foreground',
  'dark:data-[active=true]:border-white/20 dark:data-[active=true]:text-foreground',
);

/** Pathway vs Plano SKU */
export const CATALOGO_VISTA_TAB_GROUP = cn(
  CATALOGO_VIEW_TAB_GROUP,
  'rounded-md border border-border/30 dark:border-white/[0.06]',
);

export const CATALOGO_VISTA_TAB = CATALOGO_TIPO_TAB;

/** Tabelas de valores (SKU / PC / eixos) — grid plano, sem expandir na árvore. */
export const CATALOGO_VALUE_TABLE = cn(
  'my-1 overflow-hidden rounded-sm',
  'border border-border/35 dark:border-white/10',
  'bg-background dark:bg-transparent',
);

export const CATALOGO_VALUE_TABLE_HEAD = cn(
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_5rem] sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_6rem]',
  'gap-x-2 px-3 py-1.5 border-b border-border/35 dark:border-white/10',
  'text-[9px] uppercase tracking-wider text-muted-foreground/80 font-light',
);

export const CATALOGO_VALUE_TABLE_ROW = cn(
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_5rem] sm:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_6rem]',
  'gap-x-2 px-3 py-2 items-start',
  'border-b border-border/30 dark:border-white/[0.06] last:border-b-0',
  'hover:bg-muted/8 dark:hover:bg-white/[0.015]',
);

export const CATALOGO_VALUE_TABLE_CELL = cn(
  'font-din-1451 font-light text-[12px] normal-case text-foreground/90 leading-snug break-words',
);

export const CATALOGO_VALUE_TABLE_CELL_MUTED = cn(
  CATALOGO_VALUE_TABLE_CELL,
  'text-muted-foreground/85 text-[11px] tabular-nums',
);

export const CATALOGO_VALUE_TABLE_NUM = cn(
  'text-[11px] tabular-nums text-muted-foreground text-right pt-0.5',
);

export const CATALOGO_ROW_BASE = cn(
  'w-full text-left transition-colors min-w-0 py-2.5 pr-2 cursor-pointer border-l',
  CATALOGO_SEP,
  'hover:bg-muted/20 dark:hover:bg-white/[0.03]',
);

export const CATALOGO_TITLE =
  'font-din-1451 font-light text-sm uppercase tracking-wide text-foreground leading-snug line-clamp-2 break-words';
export const CATALOGO_SUBTITLE =
  'font-din-1451 font-light text-[11px] text-muted-foreground line-clamp-2 break-words normal-case';

export const CATALOGO_PC_TITLE =
  'font-din-1451 font-light text-[12px] uppercase tracking-wide text-foreground/92 leading-snug line-clamp-2 break-words';

export const CATALOGO_GRADE_TITLE =
  'font-din-1451 font-light text-[11px] normal-case text-foreground/85 leading-snug line-clamp-2 break-words';

export const CATALOGO_TIPO_CHIP = {
  solo: 'bg-muted/80 text-muted-foreground border-border/40',
  mix: 'bg-[#e8b824]/12 text-[#a8942e] border-[#e8b824]/30 dark:bg-[#636B2F]/18 dark:text-[#A8B56E] dark:border-[#636B2F]/35',
  portfolio: 'bg-[#4a5240]/10 text-[#3a4232] border-[#4a5240]/25 dark:bg-[#636B2F]/14 dark:text-[#A8B56E] dark:border-[#636B2F]/30',
};

export const CATALOGO_SUPPLY_LED = {
  off: 'bg-muted-foreground/20 border border-muted-foreground/25 dark:bg-white/[0.08] dark:border-white/10',
  alerta: 'bg-[#e8b824] shadow-[0_0_0_2px_rgba(232,184,36,0.28)] dark:bg-[#636B2F] dark:shadow-[0_0_0_2px_rgba(99,107,47,0.35)]',
  alerta_escuro: 'bg-[#a8942e] shadow-[0_0_0_2px_rgba(168,148,46,0.3)] dark:bg-[#636B2F]',
  ruptura_pfut: 'bg-[#D96F55] shadow-[0_0_0_2px_rgba(217,111,85,0.28)]',
  ruptura: 'bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.28)] dark:bg-red-400',
};

export const CATALOGO_SUPPLY_BORDER = {
  off: 'border-l-transparent',
  alerta: 'border-l-[#e8b824]/70 dark:border-l-[#636B2F]/70',
  alerta_escuro: 'border-l-[#a8942e] dark:border-l-[#636B2F]',
  ruptura_pfut: 'border-l-[#D96F55]',
  ruptura: 'border-l-red-500 dark:border-l-red-400',
};

export const CATALOGO_KPI_STRIP =
  'flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs tabular-nums border-b border-border/35 bg-[#e8b824]/[0.04] dark:bg-[#636B2F]/[0.08]';

/** Tabela mix — Produto compra | SKUs | Eixos (grelha). */
export const CATALOGO_MIX_TABLE = CATALOGO_VALUE_TABLE;

export const CATALOGO_MIX_TABLE_CAP = cn(
  'px-3 py-1.5 border-b border-border/35 dark:border-white/10',
);

export const CATALOGO_MIX_TABLE_CAP_TITLE = cn(
  'font-din-1451 font-light text-[11px] text-muted-foreground normal-case',
);

export const CATALOGO_MIX_TABLE_CAP_CORE = 'text-foreground/80 font-mono text-[11px]';

export const CATALOGO_MIX_TABLE_CAP_LINHA = cn(
  'mt-1 font-din-1451 font-light text-[10px] text-muted-foreground normal-case leading-relaxed',
);

export const CATALOGO_MIX_TABLE_HEAD = CATALOGO_VALUE_TABLE_HEAD;

export const CATALOGO_MIX_TABLE_ROW = cn(
  CATALOGO_VALUE_TABLE_ROW,
  'grid-cols-[minmax(0,1.15fr)_2.5rem_minmax(0,1.5fr)] sm:grid-cols-[minmax(0,1.2fr)_3rem_minmax(0,1.6fr)]',
);

export const CATALOGO_MIX_TABLE_PC = cn(
  CATALOGO_PC_TITLE,
  'text-[11px] sm:text-[12px] leading-snug pr-1',
);

export const CATALOGO_MIX_TABLE_SKU = 'text-[11px] tabular-nums text-muted-foreground text-center pt-0.5';

export const CATALOGO_MIX_TABLE_EIXOS = cn(
  'font-din-1451 font-light text-[11px] normal-case text-foreground/85 leading-relaxed break-words',
);

export const CATALOGO_MIX_TABLE_CHIP = 'whitespace-nowrap';
export const CATALOGO_MIX_TABLE_CHIP_ALERT = 'font-medium text-foreground/90';
export const CATALOGO_MIX_TABLE_DOT = 'text-muted-foreground/45 mx-0.5';
