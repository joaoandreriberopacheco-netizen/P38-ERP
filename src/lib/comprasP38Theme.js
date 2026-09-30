import { cn } from '@/components/utils';
import {
  P38_CHIP_ACTIVE,
  P38_DROPDOWN_PANEL,
  P38_SEARCH,
  P38_SEARCH_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import { CAIXA_OLIVE } from '@/lib/caixaP38Theme';
import { P38_LIGHT_HEADER_ACCENT, P38_LIGHT_VLINE } from '@/lib/p38LightTheme';
import { P38_FORM_TYPO_SCOPE } from '@/lib/p38FormTypography';

/** Verde oliva mediterrâneo — alinhado ao módulo Caixa (dark). Ver docs/p38-paleta-oliva.md */
export const COMPRAS_OLIVE = CAIXA_OLIVE;

export { P38_CHIP_ACTIVE };

const COMPRAS_FORM_BASE = cn(
  'flex flex-col bg-background dark:bg-[#1f1d22] overflow-hidden font-din-1451',
  P38_FORM_TYPO_SCOPE,
);

/** Divisores suaves — linhas finas verticais/horizontais, sem contorno pesado no claro. */
export const COMPRAS_SEP = 'border-b border-border/35 dark:border-white/10';
export const COMPRAS_HIER_L1 = cn('ml-1 pl-2 md:ml-3 md:pl-3.5 min-w-0 max-w-full', P38_LIGHT_VLINE);
export const COMPRAS_HIER_L2 = 'ml-1 pl-2 border-l border-border/25 dark:border-white/[0.06] min-w-0 max-w-full';

/** Superfícies brancas no claro. */
export const COMPRAS_PAGE = 'bg-background';
/** Fullscreen compras — absolute dentro do stage em Modo Paisagem; fixed no retrato normal. */
export const COMPRAS_FORM_ROOT = cn(COMPRAS_FORM_BASE, 'p38-fullscreen-panel flex flex-col min-h-0');
export { COMPRAS_FORM_BASE };

export const COMPRAS_FORM_HEADER =
  'flex-shrink-0 px-4 py-4 flex items-center gap-3 border-b border-border/35 relative bg-background dark:bg-transparent';

/** Faixa amarelo suco → oliva no topo — toque aconchegante no claro. */
export const COMPRAS_HEADER_ACCENT = P38_LIGHT_HEADER_ACCENT;

export const COMPRAS_TABS_BAR =
  'flex-shrink-0 bg-background dark:bg-transparent border-b border-border/35 rounded-none h-auto p-0 flex w-full';

export const COMPRAS_TAB = cn(
  'flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-transparent rounded-none py-2 px-1',
  'text-muted-foreground disabled:opacity-30 transition-colors min-w-0 font-light',
  'data-[state=active]:border-[#4a5240] data-[state=active]:text-[#3a4232]',
  'dark:data-[state=active]:border-[#636B2F] dark:data-[state=active]:text-[#A8B56E]',
);

export const COMPRAS_SUBHEADER = 'flex-shrink-0 px-6 py-2 border-b border-border/35 text-sm font-light text-muted-foreground';

/** Campo — branco com sombra leve (sem caixa cinza). */
export const COMPRAS_FIELD =
  'bg-card border-0 shadow-sm rounded-xl text-foreground dark:bg-muted/50 dark:shadow-none';

export const COMPRAS_FIELD_H12 = cn(COMPRAS_FIELD, 'h-12 text-sm');

/** FAB principal (verde oliva). */
export const COMPRAS_FAB = cn(
  'bg-[#4a5240] text-white dark:bg-[#636B2F] dark:text-[#1f1d22]',
  'shadow-xl transition-all duration-200 active:scale-95',
);

/** FAB / CTA quente (amarelo suco). */
export const COMPRAS_FAB_CITRUS = 'bg-[#e8b824] text-[#242424] hover:bg-[#e8b824]/90';

/** FAB secundário — branco, sem borda grossa. */
export const COMPRAS_FAB_SOFT = 'bg-card text-foreground shadow-md dark:bg-muted dark:text-foreground';

export const COMPRAS_SECTION_CARD =
  'rounded-2xl bg-card dark:bg-muted/10 p-3.5 space-y-3 shadow-sm';

export const COMPRAS_CHIP_ACTIVE_CITRUS =
  'bg-[#e8b824]/14 text-[#a8942e] font-medium shadow-sm dark:bg-[rgba(99,107,47,0.18)] dark:text-[#A8B56E]';

export const COMPRAS_CHIP_ACTIVE_OLIVE =
  'bg-[#4a5240]/10 text-[#3a4232] font-medium shadow-sm dark:bg-[rgba(99,107,47,0.18)] dark:text-[#A8B56E]';

export const COMPRAS_CHIP_IDLE =
  'bg-card text-muted-foreground hover:bg-secondary/30 dark:bg-muted/50 dark:hover:bg-muted';

export const COMPRAS_SEARCH_SHELL = cn(
  P38_SEARCH_SURFACE,
  'bg-background dark:bg-background/95 rounded-none',
);

export const COMPRAS_SEARCH_INPUT = cn(
  P38_SEARCH,
  'h-12 rounded-2xl border-0 shadow-sm bg-card pl-10 pr-10',
  'focus-visible:ring-2 focus-visible:ring-[#e8b824]/22',
  'dark:bg-muted dark:focus-visible:ring-[rgba(99,107,47,0.35)]',
);

/** Busca compacta mobile (com abas inline ao lado). */
export const COMPRAS_SEARCH_INPUT_COMPACT = cn(COMPRAS_SEARCH_INPUT, 'h-10 rounded-xl pl-9 text-sm');

export const COMPRAS_DROPDOWN = cn(P38_DROPDOWN_PANEL, 'shadow-xl border-0 min-w-[12rem]');

export const COMPRAS_DROPDOWN_ITEM =
  'hover:bg-[#e8b824]/10 focus:bg-[#e8b824]/10 dark:hover:bg-primary/90 dark:focus:bg-primary/90';

export const COMPRAS_BTN_PRIMARY =
  'bg-[#4a5240] hover:bg-[#4a5240]/90 text-white dark:bg-[#636B2F] dark:hover:bg-[#636B2F]/90 dark:text-[#1f1d22]';

export const COMPRAS_BTN_CITRUS = 'bg-[#e8b824] hover:bg-[#e8b824]/90 text-[#242424] rounded-xl';

export const COMPRAS_ICON_ACCENT = 'text-[#3a4232] dark:text-[#A8B56E]';

/** Botão quadrado compacto mobile (filtro, etc.). */
export const COMPRAS_MOBILE_ICON_BTN =
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-all bg-muted dark:bg-muted text-foreground/90';

/** Abas Embarques/Consulta inline — grupo segmentado compacto. */
export const COMPRAS_VIEW_TAB_GROUP =
  'flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/80 p-0.5 dark:bg-muted';
export const COMPRAS_VIEW_TAB_BTN =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all';
export const COMPRAS_VIEW_TAB_ACTIVE =
  'bg-[#4a5240] text-white dark:bg-[#636B2F] dark:text-[#A8B56E]';
export const COMPRAS_VIEW_TAB_IDLE = 'text-muted-foreground hover:text-foreground/90';

/** Badge contador de filtros activos. */
export const COMPRAS_FILTER_BADGE =
  'absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#4a5240] px-0.5 text-[9px] font-semibold leading-none text-white dark:bg-[#636B2F] dark:text-[#1f1d22]';

/** CTA primário mobile (drawer filtros, etc.). */
export const COMPRAS_MOBILE_CTA =
  'bg-[#4a5240] text-white dark:bg-[#636B2F] dark:text-[#1f1d22]';

/** Re-exporta tokens canónicos do modo claro para uso directo em módulos novos. */
export {
  P38_LIGHT_CARD,
  P38_LIGHT_CITRUS_BTN,
  P38_LIGHT_CITRUS_CHIP,
  P38_LIGHT_CITRUS_TEXT,
  P38_LIGHT_FIELD,
  P38_LIGHT_PAGE,
  P38_LIGHT_PANEL,
} from '@/lib/p38LightTheme';

export const COMPRAS_SELECT_HIGHLIGHT = 'bg-[#e8b824]/12 dark:bg-[rgba(99,107,47,0.18)]';

/** Texto KPI / destaque oliva (header Embarques). */
export const COMPRAS_KPI_ACCENT = 'text-[#3a4232] dark:text-[#A8B56E]';

export const COMPRAS_DIVIDER_TOP = 'border-t border-border/35 dark:border-white/10';
