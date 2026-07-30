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
    bg: '#f3f5ee',
    headerBg: '#f3f5ee',
    searchBg: '#e6ebdc',
    cardBg: '#ffffff',
    text: '#161a14',
    textMuted: '#3f4a38',
    textSub: '#2a3224',
    iconColor: '#4a5a3c',
    chevron: '#6b7a5c',
    sectionLabel: '#4a5a3c',
    divider: 'rgba(92, 126, 68, 0.14)',
    btnBg: 'rgba(92, 126, 68, 0.10)',
    hoverBg: 'rgba(92, 126, 68, 0.07)',
    activeBg: 'rgba(92, 126, 68, 0.16)',
    backBg: '#e6ebdc',
    closeBg: '#dde4d0',
    closeColor: '#2a3224',
    border: 'rgba(92, 126, 68, 0.18)',
    subBorder: 'rgba(92, 126, 68, 0.12)',
    accent: '#5c7e44',
  },
};

export function getP38ShellColors(isDark) {
  return isDark ? P38_SHELL.dark : P38_SHELL.light;
}
