import { cn } from '@/components/utils';
import {
  P38_CHIP_ACTIVE,
  P38_DROPDOWN_PANEL,
  P38_SEARCH,
  P38_SEARCH_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import { P38_LIGHT_HEADER_ACCENT, P38_LIGHT_VLINE } from '@/lib/p38LightTheme';

export { P38_CHIP_ACTIVE };

/** Divisores suaves — linhas finas verticais/horizontais, sem contorno pesado no claro. */
export const COMPRAS_SEP = 'border-b border-border/15 dark:border-white/10';
export const COMPRAS_HIER_L1 = cn('ml-1 pl-2 md:ml-3 md:pl-3.5 min-w-0 max-w-full', P38_LIGHT_VLINE);
export const COMPRAS_HIER_L2 = 'ml-1 pl-2 border-l border-border/10 dark:border-white/[0.06] min-w-0 max-w-full';

/** Superfícies brancas no claro. */
export const COMPRAS_PAGE = 'bg-background';
export const COMPRAS_FORM_ROOT =
  'fixed inset-0 flex flex-col bg-background dark:bg-[#1f1d22] overflow-hidden font-din-1451';

export const COMPRAS_FORM_HEADER =
  'flex-shrink-0 px-4 py-4 flex items-center gap-3 border-b border-border/15 relative bg-background dark:bg-transparent';

/** Faixa laranja → amarelo no topo — toque aconchegante no claro. */
export const COMPRAS_HEADER_ACCENT = P38_LIGHT_HEADER_ACCENT;

export const COMPRAS_TABS_BAR =
  'flex-shrink-0 bg-background dark:bg-transparent border-b border-border/15 rounded-none h-auto p-0 flex w-full';

export const COMPRAS_TAB = cn(
  'flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-transparent rounded-none py-2 px-1',
  'text-muted-foreground disabled:opacity-30 transition-colors min-w-0 font-light',
  'data-[state=active]:border-[#f07a1a] data-[state=active]:text-[#f07a1a]',
  'dark:data-[state=active]:border-[#a4ce33] dark:data-[state=active]:text-[#a4ce33]',
);

export const COMPRAS_SUBHEADER = 'flex-shrink-0 px-6 py-2 border-b border-border/15 text-sm font-light text-muted-foreground';

/** Campo — branco com sombra leve (sem caixa cinza). */
export const COMPRAS_FIELD =
  'bg-card border-0 shadow-sm rounded-xl text-foreground dark:bg-muted/50 dark:shadow-none';

export const COMPRAS_FIELD_H12 = cn(COMPRAS_FIELD, 'h-12 text-sm');

/** FAB principal (verde oliva). */
export const COMPRAS_FAB = cn(
  P38_CHIP_ACTIVE,
  'shadow-xl transition-all duration-200 active:scale-95',
);

/** FAB / CTA quente (laranja suco). */
export const COMPRAS_FAB_CITRUS = 'bg-[#f07a1a] text-white hover:bg-[#f07a1a]/90';

/** FAB secundário — branco, sem borda grossa. */
export const COMPRAS_FAB_SOFT = 'bg-card text-foreground shadow-md dark:bg-muted dark:text-foreground';

export const COMPRAS_SECTION_CARD =
  'rounded-2xl bg-card dark:bg-muted/10 p-3.5 space-y-3 shadow-sm';

export const COMPRAS_CHIP_ACTIVE_CITRUS =
  'bg-[#f07a1a]/12 text-[#f07a1a] font-medium shadow-sm dark:bg-[#f07a1a]/20 dark:text-[#ffb366]';

export const COMPRAS_CHIP_ACTIVE_OLIVE =
  'bg-[#4a5240]/10 text-[#4a5240] font-medium shadow-sm dark:bg-[#a4ce33]/15 dark:text-[#a4ce33]';

export const COMPRAS_CHIP_IDLE =
  'bg-card text-muted-foreground hover:bg-secondary/30 dark:bg-muted/50 dark:hover:bg-muted';

export const COMPRAS_SEARCH_SHELL = cn(
  P38_SEARCH_SURFACE,
  'bg-background dark:bg-background/95 rounded-none',
);

export const COMPRAS_SEARCH_INPUT = cn(
  P38_SEARCH,
  'h-12 rounded-2xl border-0 shadow-sm bg-card pl-10 pr-10',
  'focus-visible:ring-2 focus-visible:ring-[#f07a1a]/18',
  'dark:bg-muted dark:focus-visible:ring-[#a4ce33]/20',
);

export const COMPRAS_DROPDOWN = cn(P38_DROPDOWN_PANEL, 'shadow-xl border-0 min-w-[12rem]');

export const COMPRAS_DROPDOWN_ITEM =
  'hover:bg-[#f07a1a]/8 focus:bg-[#f07a1a]/8 dark:hover:bg-primary/90 dark:focus:bg-primary/90';

export const COMPRAS_BTN_PRIMARY =
  'bg-[#4a5240] hover:bg-[#4a5240]/90 text-white dark:bg-[#a4ce33] dark:hover:bg-[#a4ce33]/90 dark:text-[#1f1d22]';

export const COMPRAS_BTN_CITRUS = 'bg-[#f07a1a] hover:bg-[#f07a1a]/90 text-white rounded-xl';

export const COMPRAS_ICON_ACCENT = 'text-[#f07a1a] dark:text-[#a4ce33]';

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

export const COMPRAS_SELECT_HIGHLIGHT = 'bg-[#f07a1a]/10 dark:bg-[#f07a1a]/15';

export const COMPRAS_DIVIDER_TOP = 'border-t border-border/15 dark:border-white/10';
