/**
 * Catálogo novo + SMART SUPPLY — linhas finas, cítrico (claro) e oliva-caixa (dark).
 * Inspirado na lista de Embarques (LED 1.5px, vlines, hierarquia L1/L2/L3).
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

/** Recuo + linha vertical fina (1px). */
export const CATALOGO_HIER_L0 = 'pl-2 min-w-0 max-w-full';
export const CATALOGO_HIER_L1 = cn('ml-1 pl-2 md:ml-2 md:pl-3 min-w-0 max-w-full', P38_LIGHT_VLINE);
export const CATALOGO_HIER_L2 = cn('ml-1 pl-2 md:ml-3 md:pl-3.5 min-w-0 max-w-full border-l border-[#e8b824]/35 dark:border-[#636B2F]/45');
export const CATALOGO_HIER_L3 = cn('ml-1 pl-2 md:ml-4 md:pl-4 min-w-0 max-w-full border-l border-border/30 dark:border-white/[0.07]');

export const CATALOGO_PAGE = 'bg-background text-foreground font-din-1451 min-h-full';
export const CATALOGO_HEADER = cn(
  'sticky top-0 z-30 bg-background border-b border-border/35 shadow-sm relative overflow-hidden',
);
export const CATALOGO_HEADER_ACCENT = P38_LIGHT_HEADER_ACCENT;

export const CATALOGO_LIST_SHELL =
  'overflow-hidden rounded-lg bg-background dark:bg-[#1f1d22]/40 border-0 shadow-sm dark:border dark:border-white/[0.06]';

export const CATALOGO_ROW_BASE = cn(
  'w-full text-left transition-colors min-w-0 py-2.5 pr-2 cursor-pointer border-l',
  CATALOGO_SEP,
  'hover:bg-muted/20 dark:hover:bg-white/[0.03]',
);

export const CATALOGO_TITLE =
  'font-din-1451 font-light text-sm uppercase tracking-wide text-foreground leading-snug line-clamp-2 break-words';
export const CATALOGO_SUBTITLE =
  'font-din-1451 font-light text-[11px] text-muted-foreground line-clamp-2 break-words normal-case';

export const CATALOGO_VIEW_TAB_GROUP = 'flex w-full border-b border-border/35 bg-background';
export const CATALOGO_VIEW_TAB = cn(
  'flex-1 py-2.5 px-2 text-[11px] font-light uppercase tracking-wide border-b-2 border-transparent transition-colors min-w-0',
  'text-muted-foreground',
  'data-[active=true]:border-[#e8b824] data-[active=true]:text-[#a8942e]',
  'dark:data-[active=true]:border-[#636B2F] dark:data-[active=true]:text-[#A8B56E]',
);

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
