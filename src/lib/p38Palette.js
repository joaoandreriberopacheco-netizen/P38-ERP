/**
 * Paleta canónica P38 — verde mediterrâneo, oliva, limão, cítricos.
 * Valores alinhados a index.css e p38-identity.css.
 *
 * Modo claro: oliva mais saturado (inspiração Labotrat) + texto quase preto.
 * Modo escuro: carvão + limão (referência Planejamento).
 *
 * Regra de contraste: usar p38Contrast.js para escolher foreground sobre qualquer fundo.
 */

export const P38_PALETTE = {
  /** Verde oliva saturado — primário no modo claro */
  olive: {
    hex: '#5c7e44',
    hsl: '95 30% 38%',
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
  /** Verde faixa Labotrat — fundos tintados, hover, success suave */
  mediterranean: {
    hex: '#7ba05b',
    hsl: '95 27% 49%',
  },
  /** Superfícies modo claro */
  light: {
    bg: '#f3f5ee',
    surface: '#ffffff',
    surfaceMuted: '#e6ebdc',
    border: '#c5ceb8',
    text: '#161a14',
    textMuted: '#3f4a38',
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
