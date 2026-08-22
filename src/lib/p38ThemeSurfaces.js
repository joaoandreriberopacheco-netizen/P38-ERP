/**
 * Superfícies P38 — alinhado ao Relatório de Margem mobile (screenshot) e tokens em index.css.
 * Escuro: carvão #1f1d22, cartão #2d333b, busca #26262e, cabeçalho tabela #383e47, limão #a4ce33.
 * Claro: branco puro + carvão + amarelo suco (acento); escuro: carvão + limão.
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
    bg: '#ffffff',
    headerBg: '#ffffff',
    searchBg: '#ffffff',
    cardBg: '#ffffff',
    tableHeaderBg: '#fafafa',
    text: '#242424',
    textMuted: '#6b6b6b',
    textSub: '#404040',
    iconColor: '#5c5c5c',
    chevron: '#8a8a8a',
    divider: 'rgba(0,0,0,0.08)',
    btnBg: 'rgba(0,0,0,0.04)',
    backBg: '#ffffff',
    closeBg: '#f5f5f5',
    closeColor: '#404040',
    accent: '#4a5240',
    citrus: '#e8b824',
    citrusYellow: '#e8b824',
  },
};

/** Cores de status — paleta aprovada (embarques / alertas operacionais). */
export const P38_CYAN_SEA = '#4ECDC4';
export const P38_AGUARDANDO_ORANGE = '#D96F55';

/** Acentos semânticos — uso pontual (status, lucro, alertas). Tom suave para leitura prolongada. */
export const p38Accent = {
  success: {
    solid: '#4a5240',
    solidDark: '#a4ce33',
    text: 'text-[#3a4232] dark:text-[#a4ce33]/85',
    dot: 'bg-[#4a5240] dark:bg-[#a4ce33]/70',
    border: 'border-l-[#4a5240] dark:border-l-[#a4ce33]/55',
  },
  /** Pedido aprovado — verde vivo no claro (mesmo padrão dos demais acentos). */
  aprovado: {
    solid: '#84cc16',
    solidDark: '#a4ce33',
    text: 'text-lime-700 dark:text-[#a4ce33]',
    dot: 'bg-lime-500 dark:bg-[#a4ce33]/70',
    border: 'border-l-lime-500 dark:border-l-[#a4ce33]/55',
  },
  warning: {
    solid: P38_AGUARDANDO_ORANGE,
    solidDark: P38_AGUARDANDO_ORANGE,
    text: 'text-[#9c4228] dark:text-[#D96F55]',
    dot: 'bg-[#D96F55] dark:bg-[#D96F55]',
    border: 'border-l-[#D96F55] dark:border-l-[#D96F55]',
  },
  info: {
    solid: P38_CYAN_SEA,
    solidDark: P38_CYAN_SEA,
    text: 'text-[#1a7a73] dark:text-[#4ECDC4]',
    dot: 'bg-[#4ECDC4] dark:bg-[#4ECDC4]',
    border: 'border-l-[#4ECDC4] dark:border-l-[#4ECDC4]',
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
    accentMuted: isDark ? 'rgba(164,206,51,0.35)' : 'rgba(232,184,36,0.28)',
  };
}
