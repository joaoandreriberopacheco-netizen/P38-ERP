/**
 * Modo claro P38 — branco puro + carvão da informação + laranja suco + amarelo cítrico.
 * Referência aprovada: sensação “suco gelado, dia novo”.
 *
 * Usar estas constantes em vez de hex esverdeados (#f7f8f5, #f0f2ec, #dce0d4…)
 * ou importar via comprasP38Theme / produtosP38Theme (que reutilizam partes disto).
 */
import { cn } from '@/components/utils';

/** Hex canónicos (modo claro). */
export const P38_LIGHT_HEX = {
  bg: '#ffffff',
  text: '#242424',
  textMuted: '#6b6b6b',
  textSub: '#404040',
  border: '#e8e8e8',
  citrus: '#f07a1a',
  citrusYellow: '#e8b824',
  olive: '#4a5240',
};

/** Linha vertical fina (1px) — padrão global; nunca border-l-2/3/4 no claro. */
export const P38_LIGHT_VLINE = 'border-l border-border/15 dark:border-white/10';
/** Linha vertical fina com cor semântica (cor via border-l-[cor] ou classe --success). */
export const P38_LIGHT_VLINE_ACCENT = 'border-l dark:border-white/10';

/** Página / shell. */
export const P38_LIGHT_PAGE = 'bg-background text-foreground';

/** Cartão branco com sombra leve — padrão para painéis no claro. */
export const P38_LIGHT_CARD =
  'bg-card text-card-foreground shadow-sm border-0';

/** Campo, busca, select — branco puro. */
export const P38_LIGHT_FIELD = cn(
  P38_LIGHT_CARD,
  'rounded-xl text-foreground focus-visible:ring-2 focus-visible:ring-[#f07a1a]/18',
);

/** Painel / secção agrupada. */
export const P38_LIGHT_PANEL = cn(P38_LIGHT_CARD, 'rounded-2xl');

/** Hover suave neutro (listas, linhas). */
export const P38_LIGHT_HOVER = 'hover:bg-secondary/50 active:bg-secondary/60';

/** Divisor fino. */
export const P38_LIGHT_DIVIDER = 'border-border/15';

/** Borda visível sem peso. */
export const P38_LIGHT_BORDER = 'border-border/40';

/** Laranja suco — texto / ícone activo. */
export const P38_LIGHT_CITRUS_TEXT = 'text-[#f07a1a]';

/** Amarelo cítrico — segundo acento quente (badges, realces). */
export const P38_LIGHT_YELLOW_TEXT = 'text-[#e8b824]';

/** Chip / pill activo cítrico (laranja + toque amarelo). */
export const P38_LIGHT_CITRUS_CHIP =
  'bg-gradient-to-r from-[#f07a1a]/14 to-[#e8b824]/10 text-[#f07a1a] font-medium shadow-sm';

/** Realce de foco / filtro activo. */
export const P38_LIGHT_CITRUS_RING = 'ring-2 ring-[#f07a1a]/22';

/** CTA oliva (gravar, FAB secundário). */
export const P38_LIGHT_OLIVE_BTN =
  'bg-[#4a5240] text-white hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22]';

/** CTA laranja (acción quente). */
export const P38_LIGHT_CITRUS_BTN =
  'bg-[#f07a1a] text-white hover:bg-[#f07a1a]/90';

/** Item de dropdown / lista. */
export const P38_LIGHT_DROPDOWN_ITEM =
  'hover:bg-[#f07a1a]/8 focus:bg-[#e8b824]/6';

/** Chip inactivo. */
export const P38_LIGHT_CHIP_IDLE =
  'bg-card text-muted-foreground hover:bg-secondary/40 shadow-sm';

/** Superfície de ícone (FAB soft, botão filtro). */
export const P38_LIGHT_ICON_BTN = 'bg-card text-foreground shadow-md';

/** Faixa topo laranja → amarelo (formulários, headers). */
export const P38_LIGHT_HEADER_ACCENT =
  'absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#f07a1a]/65 via-[#e8b824]/45 to-transparent rounded-t';

/** Painel com wash laranja + amarelo muito suave. */
export const P38_LIGHT_CITRUS_WASH =
  'bg-gradient-to-br from-[#f07a1a]/5 via-[#e8b824]/4 to-transparent';
