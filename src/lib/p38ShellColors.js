/**
 * Cores de shell (sidebar, menu mobile, home) — cinzas P38 do Relatório de Margem.
 * Evita #111827 / slate (tom azulado).
 */
export const P38_SHELL = {
  dark: {
    bg: '#1f1d22',
    headerBg: '#1f1d22',
    searchBg: '#282a2e',
    cardBg: '#2d333b',
    text: '#fafafa',
    textMuted: '#94949c',
    textSub: '#d1d5db',
    iconColor: '#94949c',
    chevron: '#6f7075',
    sectionLabel: '#6f7075',
    divider: 'rgba(255,255,255,0.06)',
    btnBg: 'rgba(255,255,255,0.08)',
    hoverBg: 'rgba(255,255,255,0.05)',
    activeBg: 'rgba(255,255,255,0.08)',
    backBg: '#282a2e',
    closeBg: 'rgba(255,255,255,0.08)',
    closeColor: '#ffffff',
    border: 'rgba(255,255,255,0.06)',
    subBorder: 'rgba(255,255,255,0.08)',
    accent: '#a4ce33',
  },
  light: {
    bg: '#ffffff',
    headerBg: '#ffffff',
    searchBg: '#ffffff',
    cardBg: '#ffffff',
    text: '#242424',
    textMuted: '#6b6b6b',
    textSub: '#404040',
    iconColor: '#5c5c5c',
    chevron: '#8a8a8a',
    sectionLabel: '#6b6b6b',
    divider: 'rgba(0,0,0,0.08)',
    btnBg: 'rgba(0,0,0,0.04)',
    hoverBg: 'rgba(0,0,0,0.03)',
    activeBg: 'rgba(0,0,0,0.06)',
    backBg: '#ffffff',
    closeBg: '#f5f5f5',
    closeColor: '#404040',
    border: 'rgba(0,0,0,0.08)',
    subBorder: 'rgba(0,0,0,0.06)',
    accent: '#4a5240',
  },
};

export function getP38ShellColors(isDark) {
  return isDark ? P38_SHELL.dark : P38_SHELL.light;
}
