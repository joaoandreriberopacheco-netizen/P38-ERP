/**
 * Paleta canónica P38 — tema premium Carbon Balance.
 * Limão moderno (claro + escuro) · sem mediterrâneo/oliva legado.
 */

export const P38_PALETTE = {
  lime: {
    hex: '#84CC16',
    hsl: '84 81% 44%',
  },
  limeNeon: {
    hex: '#C3FB12',
    hsl: '75 96% 53%',
  },
  citrusYellow: {
    hex: '#FBBF24',
    hsl: '43 96% 56%',
  },
  citrusOrange: {
    hex: '#F97316',
    hsl: '27 87% 52%',
  },
  light: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F9FAFB',
    border: '#E5E7EB',
    text: '#111827',
    textMuted: '#6B7280',
  },
  dark: {
    bg: '#09090B',
    surface: '#1C1C1E',
    surfaceMuted: '#27272A',
    border: 'rgba(255,255,255,0.1)',
    text: '#F9FAFB',
    textMuted: '#A1A1AA',
  },
};

/** @deprecated Use primary/lime — mantido para compatibilidade */
export const p38PaletteClasses = {
  accent: 'text-primary',
  accentBg: 'bg-primary/10 text-primary border border-primary/25',
  citrus: 'text-p38-citrus-orange dark:text-p38-citrus-yellow',
  citrusBg: 'bg-p38-citrus-yellow/15 text-p38-citrus-orange border border-p38-citrus-yellow/35',
};
