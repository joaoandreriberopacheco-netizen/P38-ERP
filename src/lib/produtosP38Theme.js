import { cn } from '@/components/utils';
import {
  COMPRAS_BTN_PRIMARY,
  COMPRAS_CHIP_ACTIVE_CITRUS,
  COMPRAS_CHIP_IDLE,
  COMPRAS_DIVIDER_TOP,
  COMPRAS_DROPDOWN,
  COMPRAS_DROPDOWN_ITEM,
  COMPRAS_FAB,
  COMPRAS_FAB_SOFT,
  COMPRAS_FIELD,
  COMPRAS_FORM_HEADER,
  COMPRAS_FORM_ROOT,
  COMPRAS_HEADER_ACCENT,
  COMPRAS_ICON_ACCENT,
  COMPRAS_SEARCH_INPUT,
  COMPRAS_SECTION_CARD,
  COMPRAS_SEP,
  COMPRAS_TAB,
  COMPRAS_TABS_BAR,
  P38_CHIP_ACTIVE,
} from '@/lib/comprasP38Theme';
import { P38_SEARCH, P38_SEARCH_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';

export { P38_CHIP_ACTIVE, COMPRAS_ICON_ACCENT as PRODUTOS_ICON_ACCENT };

/** Divisor suave — igual compras. */
export const PRODUTOS_SEP = COMPRAS_SEP;

export const PRODUTOS_PAGE_HEADER = cn(
  'flex-none bg-background w-full min-w-0',
  COMPRAS_SEP,
);

export const PRODUTOS_FAB = COMPRAS_FAB;

export const PRODUTOS_SEARCH_SHELL = cn(
  P38_SEARCH_SURFACE,
  'bg-background dark:bg-background/95 rounded-xl',
);

/** Busca branca, sem contorno — foco laranja suave. */
export const PRODUTOS_SEARCH_INPUT = cn(
  P38_SEARCH,
  'h-10 desktop-layout:h-11 rounded-xl border-0 shadow-sm bg-card',
  'pl-9 desktop-layout:pl-10 text-sm text-foreground/90 w-full min-w-0',
  'focus-visible:ring-2 focus-visible:ring-[#f07a1a]/18',
  'dark:bg-muted dark:focus-visible:ring-[#a4ce33]/20',
);

export const PRODUTOS_DROPDOWN_MENU = COMPRAS_DROPDOWN;
export const PRODUTOS_DROPDOWN_ITEM = COMPRAS_DROPDOWN_ITEM;

/** Botões ícone — branco com sombra leve (não caixa cinza). */
export const PRODUTOS_ICON_BTN = COMPRAS_FAB_SOFT;

export const PRODUTOS_FILTER_OPEN = 'ring-2 ring-[#f07a1a]/22 dark:ring-[#a4ce33]/35';

export const PRODUTOS_FILTER_BADGE =
  'bg-[#f07a1a] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]';

export const PRODUTOS_FILTER_PANEL = COMPRAS_SECTION_CARD;

export const PRODUTOS_CHIP_ACTIVE = COMPRAS_CHIP_ACTIVE_CITRUS;
export const PRODUTOS_CHIP_IDLE = COMPRAS_CHIP_IDLE;

export const PRODUTOS_VIEW_TOGGLE_SHELL = 'rounded-lg bg-secondary/15 dark:bg-muted p-0.5 gap-0.5';

export const PRODUTOS_VIEW_TOGGLE_ACTIVE = cn(
  'bg-card text-foreground/90 shadow-sm font-medium',
  'dark:bg-muted',
);

export const PRODUTOS_LEVEL_ACTIVE = P38_CHIP_ACTIVE;

/** Formulário produto — mesma linguagem do pedido de compra. */
export const PRODUTOS_FORM_ROOT = COMPRAS_FORM_ROOT.replace('fixed inset-0 flex flex-col ', 'flex flex-col h-full overflow-hidden ');

export const PRODUTOS_FORM_HEADER = COMPRAS_FORM_HEADER;
export const PRODUTOS_HEADER_ACCENT = COMPRAS_HEADER_ACCENT;
export const PRODUTOS_TABS_BAR = COMPRAS_TABS_BAR;
export const PRODUTOS_TAB = COMPRAS_TAB;
export const PRODUTOS_FIELD = COMPRAS_FIELD;
export const PRODUTOS_FIELD_H12 = cn(COMPRAS_FIELD, 'h-10 text-sm');
export const PRODUTOS_SECTION = cn(COMPRAS_SECTION_CARD, 'rounded-lg p-4');
export const PRODUTOS_FORM_PANEL = 'bg-[#f07a1a]/6 dark:bg-[#26262e]/50';
export const PRODUTOS_SAVE_BTN = cn(COMPRAS_BTN_PRIMARY, 'h-10 w-10');
export const PRODUTOS_FORM_SELECT_CONTENT = cn(COMPRAS_DROPDOWN, 'z-[90] max-h-96');
export const PRODUTOS_SELECT_ITEM = COMPRAS_DROPDOWN_ITEM;
export const PRODUTOS_SELECT_HIGHLIGHT = 'bg-[#f07a1a]/10 dark:bg-[#f07a1a]/15';
export const PRODUTOS_DIVIDER_TOP = COMPRAS_DIVIDER_TOP;

/** Abas do formulário com ícone — laranja activo no claro. */
export const PRODUTOS_TAB_ICON = cn(
  PRODUTOS_TAB,
  'group py-3 text-xs md:text-sm data-[state=active]:bg-[#f07a1a]/6 dark:data-[state=active]:bg-[#26262e]/70',
);

export const PRODUTOS_TAB_ICON_GLYPH =
  'w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-data-[state=active]:text-[#f07a1a] dark:group-data-[state=active]:text-[#a4ce33]';

export const PRODUTOS_TAB_ICON_LABEL =
  'hidden sm:inline ml-2 text-muted-foreground group-data-[state=active]:text-[#b85a12] dark:group-data-[state=active]:text-[#a4ce33]';

export const PRODUTOS_INPUT_UNDERLINE =
  'bg-transparent border-0 border-b border-border/15 dark:border-white/10 rounded-none px-0 h-9 text-sm text-foreground focus:border-[#f07a1a] dark:focus:border-[#a4ce33]';

/** Toggle com switch — cartão branco, não caixa cinza. */
export const PRODUTOS_TOGGLE_SHELL =
  'flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none rounded-xl bg-card shadow-sm px-2 h-10 dark:bg-muted';

export const PRODUTOS_LEVEL_IDLE =
  'bg-card text-muted-foreground shadow-sm hover:bg-secondary/30 dark:bg-muted dark:hover:bg-primary/90';

export const PRODUTOS_CHIP_SHELL =
  'flex items-center gap-0.5 rounded-xl bg-secondary/15 dark:bg-muted p-0.5';

export const PRODUTOS_METRIC_FIELD =
  'bg-card border-0 shadow-sm h-9 text-xs rounded-lg dark:bg-muted/50';

export const PRODUTOS_MOBILE_FILTER_SECTION =
  'space-y-2.5 rounded-2xl bg-card shadow-sm p-3 dark:bg-muted/10';

export const PRODUTOS_STAT_TILE =
  'text-center p-4 bg-card shadow-sm rounded-lg dark:bg-muted/10';
