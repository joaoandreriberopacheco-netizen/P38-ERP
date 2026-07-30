/**
 * Superfícies P38 — alinhado ao Relatório de Margem mobile (screenshot) e tokens em index.css.
 * Escuro: carvão #1f1d22, cartão #2d333b, busca #26262e, cabeçalho tabela #383e47, limão #a4ce33.
 * Claro: fundo suave + acento verde oliva.
 */

export const P38_THEME = {
  dark: {
    bg: '#1f1d22',
    headerBg: '#1f1d22',
    searchBg: '#26262e',
    cardBg: '#2d333b',
    tableHeaderBg: '#383e47',
    text: '#fafafa',
    textMuted: '#94949c',
    textSub: '#d1d5db',
    iconColor: '#94949c',
    chevron: '#6b7280',
    divider: 'rgba(255,255,255,0.06)',
    btnBg: '#26262e',
    backBg: '#26262e',
    closeBg: 'rgba(255,255,255,0.08)',
    closeColor: '#ffffff',
    accent: '#a4ce33',
  },
  light: {
    bg: '#f3f5ee',
    headerBg: '#ffffff',
    searchBg: '#e6ebdc',
    cardBg: '#ffffff',
    tableHeaderBg: '#dde4d0',
    text: '#161a14',
    textMuted: '#3f4a38',
    textSub: '#2a3224',
    iconColor: '#4a5a3c',
    chevron: '#6b7a5c',
    divider: '#c5ceb8',
    btnBg: 'rgba(92, 126, 68, 0.10)',
    backBg: '#e6ebdc',
    closeBg: '#dde4d0',
    closeColor: '#2a3224',
    accent: '#5c7e44',
    citrus: '#f07a1a',
    citrusYellow: '#e8b824',
  },
};

/** Acentos semânticos — uso pontual (status, lucro, alertas). */
export const p38Accent = {
  success: {
    solid: '#5c7e44',
    solidDark: '#a4ce33',
    text: 'text-[#5c7e44] dark:text-[#a4ce33]',
    dot: 'bg-[#5c7e44] dark:bg-[#a4ce33]',
    border: 'border-l-[#5c7e44] dark:border-l-[#a4ce33]',
  },
  warning: {
    solid: '#d97706',
    solidDark: '#fbbf24',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    border: 'border-l-amber-500 dark:border-l-amber-400',
  },
  info: {
    solid: '#0891b2',
    solidDark: '#22d3ee',
    text: 'text-cyan-600 dark:text-cyan-400',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    border: 'border-l-cyan-500 dark:border-l-cyan-400',
  },
  danger: {
    solid: '#dc2626',
    solidDark: '#f87171',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
    border: 'border-l-red-500 dark:border-l-red-400',
  },
  muted: {
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground/50 dark:bg-muted-foreground/60',
    border: 'border-l-border dark:border-l-border',
  },
};

/** @param {boolean} isDark */
export function p38ThemeColors(isDark) {
  return isDark ? P38_THEME.dark : P38_THEME.light;
}

/** Tokens da sidebar desktop — mesmo cinza da página (#1f1d22), não azul marinho. */
export function p38SidebarColors(isDark) {
  const t = isDark ? P38_THEME.dark : P38_THEME.light;
  return {
    bg: t.bg,
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text: t.text,
    textSub: t.textMuted,
    iconColor: t.iconColor,
    activeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    hoverBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    chevron: t.chevron,
    sectionLabel: t.textMuted,
    subBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    accent: t.accent,
    accentMuted: isDark ? 'rgba(164,206,51,0.35)' : 'rgba(92,126,68,0.45)',
  };
}
