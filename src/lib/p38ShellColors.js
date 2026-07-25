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
    bg: '#f7f8f5',
    headerBg: '#f7f8f5',
    searchBg: '#f0f2ec',
    cardBg: '#ffffff',
    text: '#2a2f28',
    textMuted: '#5c6358',
    textSub: '#434a40',
    iconColor: '#5a6250',
    chevron: '#8b9285',
    sectionLabel: '#6b7264',
    divider: 'rgba(74, 82, 64, 0.08)',
    btnBg: 'rgba(74, 82, 64, 0.08)',
    hoverBg: 'rgba(74, 82, 64, 0.05)',
    activeBg: 'rgba(74, 82, 64, 0.12)',
    backBg: '#f0f2ec',
    closeBg: '#e8ebe3',
    closeColor: '#434a40',
    border: 'rgba(74, 82, 64, 0.12)',
    subBorder: 'rgba(74, 82, 64, 0.08)',
    accent: '#4a5240',
  },
};

export function getP38ShellColors(isDark) {
  return isDark ? P38_SHELL.dark : P38_SHELL.light;
}
