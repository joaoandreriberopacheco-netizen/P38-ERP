/**
 * Modo claro P38 — branco puro + carvão da informação + amarelo suco + oliva.
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
  /** Amarelo suco — acento quente principal (substitui laranja fanta). */
  citrus: '#e8b824',
  citrusYellow: '#e8b824',
  /** Texto legível sobre branco quando o acento é amarelo. */
  citrusText: '#a8942e',
  olive: '#4a5240',
  oliveMuted: '#6d7860',
  juiceMuted: '#a8942e',
};

/** Amarelo suco — wash e detalhes suaves. */
export const P38_LIGHT_JUICE_WASH = 'bg-[#e8b824]/5';
export const P38_LIGHT_OLIVE_WASH = 'bg-[#4a5240]/5';
export const P38_LIGHT_JUICE_OLIVE_WASH =
  'bg-gradient-to-br from-[#e8b824]/4 via-transparent to-[#4a5240]/4';

/** Faixa topo amarelo suco → oliva (detalhe fino). */
export const P38_LIGHT_SUBTLE_ACCENT_BAR =
  'absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-[#e8b824]/35 via-[#4a5240]/14 to-transparent rounded-t';

/** Linha vertical fina (1px) — padrão global; nunca border-l-2/3/4 no claro. */
export const P38_LIGHT_VLINE = 'border-l border-border/35 dark:border-white/10';
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
  'rounded-xl text-foreground focus-visible:ring-2 focus-visible:ring-[#e8b824]/22',
);

/** Painel / secção agrupada. */
export const P38_LIGHT_PANEL = cn(P38_LIGHT_CARD, 'rounded-2xl');

/** Hover suave neutro (listas, linhas). */
export const P38_LIGHT_HOVER = 'hover:bg-secondary/50 active:bg-secondary/60';

/** Divisor fino — mais visível no branco puro. */
export const P38_LIGHT_DIVIDER = 'border-border/35';

/** Borda visível sem peso. */
export const P38_LIGHT_BORDER = 'border-border/40';

/** Amarelo suco — texto / ícone activo (tom escurecido para contraste). */
export const P38_LIGHT_CITRUS_TEXT = 'text-[#a8942e]';

/** Amarelo cítrico — realces directos. */
export const P38_LIGHT_YELLOW_TEXT = 'text-[#e8b824]';

/** Chip / pill activo cítrico. */
export const P38_LIGHT_CITRUS_CHIP =
  'bg-[#e8b824]/14 text-[#a8942e] font-medium shadow-sm';

/** Realce de foco / filtro activo. */
export const P38_LIGHT_CITRUS_RING = 'ring-2 ring-[#e8b824]/28';

/** CTA oliva (gravar, FAB secundário). */
export const P38_LIGHT_OLIVE_BTN =
  'bg-[#4a5240] text-white hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22]';

/** CTA amarelo suco (acção quente). */
export const P38_LIGHT_CITRUS_BTN =
  'bg-[#e8b824] text-[#242424] hover:bg-[#e8b824]/90';

/** Item de dropdown / lista. */
export const P38_LIGHT_DROPDOWN_ITEM =
  'hover:bg-[#e8b824]/10 focus:bg-[#e8b824]/8';

/** Chip inactivo. */
export const P38_LIGHT_CHIP_IDLE =
  'bg-card text-muted-foreground hover:bg-secondary/40 shadow-sm';

/** Superfície de ícone (FAB soft, botão filtro). */
export const P38_LIGHT_ICON_BTN = 'bg-card text-foreground shadow-md';

/** Faixa topo amarelo suco → oliva (formulários, headers). */
export const P38_LIGHT_HEADER_ACCENT = P38_LIGHT_SUBTLE_ACCENT_BAR;

/** Painel com wash amarelo + oliva muito suave. */
export const P38_LIGHT_CITRUS_WASH = P38_LIGHT_JUICE_OLIVE_WASH;
