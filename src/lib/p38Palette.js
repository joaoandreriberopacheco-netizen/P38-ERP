/**
 * Paleta canónica P38 — verde mediterrâneo, oliva, limão, cítricos.
 * Valores alinhados a index.css e p38-identity.css.
 *
 * Regra de contraste: usar p38Contrast.js para escolher foreground sobre qualquer fundo.
 */

export const P38_PALETTE = {
  /** Verde mediterrâneo / oliva queimado — primário no modo claro */
  olive: {
    hex: '#4a5240',
    hsl: '82 18% 28%',
  },
  /** Limão P38 — acento no modo escuro */
  lime: {
    hex: '#a4ce33',
    hsl: '78 55% 51%',
  },
  /** Amarelo cítrico — destaques, badges, gráficos */
  citrusYellow: {
    hex: '#e8b824',
    hsl: '43 74% 52%',
  },
  /** Laranja cítrico — alertas quentes, CTAs secundários */
  citrusOrange: {
    hex: '#f07a1a',
    hsl: '27 87% 52%',
  },
  /** Verde mediterrâneo claro — fundos tintados, hover */
  mediterranean: {
    hex: '#5c6b4a',
    hsl: '82 18% 36%',
  },
  /** Superfícies modo claro */
  light: {
    bg: '#f7f8f5',
    surface: '#ffffff',
    surfaceMuted: '#f0f2ec',
    border: '#dce0d4',
    text: '#2a2f28',
    textMuted: '#5c6358',
  },
  /** Superfícies modo escuro */
  dark: {
    bg: '#1f1d22',
    surface: '#2d333b',
    surfaceMuted: '#26262e',
    border: 'rgba(255,255,255,0.08)',
    text: '#fafafa',
    textMuted: '#94949c',
  },
};

/** Classes Tailwind para acentos semânticos P38 (claro/escuro). */
export const p38PaletteClasses = {
  accent: 'text-p38-olive dark:text-p38-lime',
  accentBg: 'bg-p38-olive/10 text-p38-olive border border-p38-olive/25 dark:bg-p38-lime/12 dark:text-p38-lime dark:border-p38-lime/30',
  citrus: 'text-p38-citrus-orange dark:text-p38-citrus-yellow',
  citrusBg: 'bg-p38-citrus-yellow/15 text-p38-citrus-orange border border-p38-citrus-yellow/35 dark:bg-p38-citrus-yellow/10 dark:text-p38-citrus-yellow dark:border-p38-citrus-yellow/25',
};
