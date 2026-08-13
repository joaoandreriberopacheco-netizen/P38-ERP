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
    bg: '#f7f8f5',
    headerBg: '#ffffff',
    searchBg: '#f0f2ec',
    cardBg: '#ffffff',
    tableHeaderBg: '#e8ebe3',
    text: '#2a2f28',
    textMuted: '#5c6358',
    textSub: '#434a40',
    iconColor: '#5a6250',
    chevron: '#8b9285',
    divider: '#dce0d4',
    btnBg: 'rgba(74, 82, 64, 0.08)',
    backBg: '#f0f2ec',
    closeBg: '#e8ebe3',
    closeColor: '#434a40',
    accent: '#4a5240',
    citrus: '#f07a1a',
    citrusYellow: '#e8b824',
  },
};

/** Acentos semânticos — uso pontual (status, lucro, alertas). Tom suave para leitura prolongada. */
export const p38Accent = {
  success: {
    solid: '#4a5240',
    solidDark: '#a4ce33',
    text: 'text-[#4a5240] dark:text-[#a4ce33]/85',
    dot: 'bg-[#4a5240] dark:bg-[#a4ce33]/70',
    border: 'border-l-[#4a5240] dark:border-l-[#a4ce33]/55',
  },
  warning: {
    solid: '#b45309',
    solidDark: '#d97706',
    text: 'text-amber-700 dark:text-amber-500',
    dot: 'bg-amber-600 dark:bg-amber-600/70',
    border: 'border-l-amber-600 dark:border-l-amber-600/55',
  },
  info: {
    solid: '#0891b2',
    solidDark: '#22d3ee',
    text: 'text-cyan-600 dark:text-cyan-400',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    border: 'border-l-cyan-500 dark:border-l-cyan-400',
  },
  danger: {
    solid: '#b91c1c',
    solidDark: '#dc2626',
    text: 'text-red-700 dark:text-red-500',
    dot: 'bg-red-600 dark:bg-red-600/70',
    border: 'border-l-red-600 dark:border-l-red-600/55',
  },
  muted: {
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground/45 dark:bg-muted-foreground/50',
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
    accentMuted: isDark ? 'rgba(164,206,51,0.35)' : 'rgba(99,107,51,0.45)',
  };
}
