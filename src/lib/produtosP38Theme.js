import { cn } from '@/components/utils';
import {
  P38_CHIP_ACTIVE,
  P38_DROPDOWN_PANEL,
  P38_SEARCH,
  P38_SEARCH_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';

export {
  P38_CHIP_ACTIVE,
  P38_DROPDOWN_PANEL,
  P38_SEARCH_SURFACE,
};

/** FAB novo produto — oliva no claro, limão no escuro. */
export const PRODUTOS_FAB = cn(
  P38_CHIP_ACTIVE,
  'shadow-lg hover:shadow-xl transition-all duration-200',
);

/** Shell da barra de busca do catálogo. */
export const PRODUTOS_SEARCH_SHELL = cn(
  P38_SEARCH_SURFACE,
  'bg-[hsl(var(--p38-search))] dark:bg-background/95',
);

/** Input de busca com borda visível no modo claro. */
export const PRODUTOS_SEARCH_INPUT = cn(
  P38_SEARCH,
  'h-10 desktop-layout:h-11',
  'border border-border/55 shadow-sm',
  'focus-visible:border-[#4a5240]/35 focus-visible:ring-2 focus-visible:ring-[#4a5240]/15',
  'dark:border-white/10 dark:shadow-none',
  'dark:focus-visible:border-[#a4ce33]/40 dark:focus-visible:ring-[#a4ce33]/20',
  'bg-card dark:bg-transparent text-sm pl-9 desktop-layout:pl-10 text-foreground/90 w-full min-w-0 rounded-xl',
);

export const PRODUTOS_DROPDOWN_MENU = cn(
  P38_DROPDOWN_PANEL,
  'border border-border/40 dark:border-white/10 shadow-xl',
);

export const PRODUTOS_DROPDOWN_ITEM =
  'hover:bg-muted/60 focus:bg-muted/60 dark:hover:bg-primary/90 dark:focus:bg-primary/90';

/** Botões ícone mobile (filtros rápidos). */
export const PRODUTOS_ICON_BTN = cn(
  'rounded-xl bg-card border border-border/55 shadow-sm',
  'dark:bg-muted dark:border-transparent dark:shadow-none',
);

export const PRODUTOS_VIEW_TOGGLE_ACTIVE = cn(
  'bg-card border border-border/55 text-foreground/90 shadow-sm font-medium',
  'dark:bg-muted dark:border-transparent',
);

export const PRODUTOS_LEVEL_ACTIVE = P38_CHIP_ACTIVE;
