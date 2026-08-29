/**
 * Paleta P38 para o módulo de caixa — substitui emerald/blue/red genéricos.
 * Modo escuro alinhado ao Home (#1f1d22 / #2d333b / #26262e) — calmo, monocromático.
 */
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { CAIXA_MIRROR_SHELL_CLASS } from '@/lib/quickAccessOverlay';
import {
  P38_FIELD_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';

/** Mesmas superfícies do Home / Planejamento — sem overrides storm */
export const caixaFieldSurface = P38_FIELD_SURFACE;
export const caixaKpiShell =
  'rounded-2xl bg-card border border-border/40 shadow-sm px-5 py-5 dark:border-white/10 dark:shadow-none';

export const CAIXA_PRINT = {
  success: p38Accent.success.solid,
  info: p38Accent.info.solid,
  danger: p38Accent.danger.solid,
  warning: p38Accent.warning.solid,
  muted: '#9ca3af',
};

export const CAIXA_TOAST_SUCCESS = 'bg-primary/15 text-primary border border-primary/20';

const TONE_MAP = {
  emerald: 'success',
  green: 'success',
  blue: 'info',
  red: 'danger',
  amber: 'warning',
};

/** @param {'success'|'info'|'danger'|'warning'|string} tone */
export function normalizeCaixaTone(tone) {
  return TONE_MAP[tone] || tone || 'muted';
}

export const caixaTone = {
  success: {
    well: 'bg-primary/10 dark:bg-white/5',
    icon: 'text-primary dark:text-foreground/70',
    text: 'text-[#3a4232] dark:text-foreground',
    panel: 'bg-primary/10 dark:bg-white/5',
    panelText: 'text-[#3a4232] dark:text-foreground',
    btn: 'bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-[#26262e] dark:text-foreground dark:hover:bg-[#383e47]',
    hover: 'hover:bg-primary/10 dark:hover:bg-white/5',
    pill: 'bg-primary/10 text-primary dark:bg-white/8 dark:text-foreground',
    dot: 'bg-[#4a5240] dark:bg-foreground/40',
  },
  info: {
    well: 'bg-cyan-500/10 dark:bg-white/5',
    icon: 'text-[#1a7a73] dark:text-foreground/70',
    text: 'text-[#1a7a73] dark:text-foreground/90',
    panel: 'bg-cyan-500/10 dark:bg-white/5',
    panelText: 'text-[#1a7a73] dark:text-foreground/90',
    btn: 'bg-cyan-600 hover:bg-cyan-700 dark:bg-[#26262e] dark:text-foreground dark:hover:bg-[#383e47]',
    hover: 'hover:bg-cyan-500/10 dark:hover:bg-white/5',
    pill: 'bg-cyan-500/10 text-cyan-700 dark:bg-white/8 dark:text-foreground/90',
    dot: 'bg-[#4ECDC4] dark:bg-foreground/35',
  },
  danger: {
    well: 'bg-destructive/10 dark:bg-destructive/15',
    icon: p38Accent.danger.text,
    text: p38Accent.danger.text,
    panel: 'bg-destructive/10 dark:bg-destructive/15',
    panelText: p38Accent.danger.text,
    btn: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
    hover: 'hover:bg-destructive/10 dark:hover:bg-destructive/15',
    pill: 'bg-destructive/10 text-destructive',
    dot: p38Accent.danger.dot,
  },
  warning: {
    well: 'bg-amber-500/10 dark:bg-amber-500/15',
    icon: p38Accent.warning.text,
    text: p38Accent.warning.text,
    panel: 'bg-amber-500/10 dark:bg-amber-500/15',
    panelText: p38Accent.warning.text,
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    hover: 'hover:bg-amber-500/10 dark:hover:bg-amber-500/15',
    pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: p38Accent.warning.dot,
  },
  muted: {
    well: 'bg-muted',
    icon: 'text-muted-foreground',
    text: 'text-foreground/90',
    panel: 'bg-muted dark:bg-white/5',
    panelText: 'text-foreground/90',
    btn: 'bg-muted text-foreground',
    hover: 'hover:bg-muted',
    pill: 'bg-muted text-muted-foreground',
    dot: p38Accent.muted.dot,
  },
};

/** @param {string} tone */
export function caixaClasses(tone) {
  const key = normalizeCaixaTone(tone);
  return caixaTone[key] || caixaTone.muted;
}

/** Cor da timeline / movimento por tipo */
export function movimentoTone(tipo) {
  if (tipo === 'Reforço') return 'success';
  if (tipo === 'Despesa') return 'danger';
  return 'info';
}

/** Painel de conferência: ok | sobra | falta */
export function conferenciaTone({ temDiferenca, diferenca }) {
  if (!temDiferenca) return 'success';
  if (diferenca > 0) return 'info';
  return 'danger';
}

/** Painel P38 — mesmas bordas/superfícies do Home */
export const caixaPanel = 'p38-panel rounded-2xl border border-border/40 dark:border-white/10';
export const caixaPanelBody = 'p38-panel__body';

/** Layout fullscreen */
export const caixaShell = 'h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden';
export const caixaMain = 'flex-1 min-h-0 h-0 overflow-hidden flex flex-col';
export const caixaMainInLayout = 'flex flex-col w-full min-w-0';
export const caixaTabsRoot = 'flex-1 min-h-0 h-0 flex flex-col overflow-hidden';
export const caixaTabsRootInLayout = 'flex flex-col w-full min-w-0';
export const caixaTabPanel = 'absolute inset-0 overflow-y-auto overscroll-y-contain touch-pan-y mt-0 data-[state=inactive]:hidden';
export const caixaTabPanelInLayout = 'mt-0 data-[state=inactive]:hidden';
export const caixaTabPanelPad = 'p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]';
export const caixaTabPanelPadInLayout = 'p-4 pb-4';
export const caixaMobileTabBar = 'md:hidden flex-shrink-0';
export const caixaOverlayShell = `fixed inset-0 ${CAIXA_MIRROR_SHELL_CLASS} h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-background pointer-events-auto`;

export const caixaTypo = {
  screen: 'caixa-screen font-din-1451',
  label: 'text-base uppercase tracking-wide text-muted-foreground',
  labelSm: 'text-sm uppercase tracking-wide text-muted-foreground',
  title: 'text-lg font-semibold uppercase tracking-wide text-foreground',
  section: 'text-base font-semibold uppercase tracking-wide text-foreground',
  value: 'text-lg font-semibold tabular-nums text-foreground',
  valueLg: 'text-2xl font-bold tabular-nums text-foreground',
  meta: 'text-sm uppercase tracking-wide text-muted-foreground',
  tab: 'text-base uppercase tracking-wide',
  groupHeader: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:tracking-widest',
};

/** Abas — chip monocromático (Home / P38 escuro) */
export const caixaDarkTabActive =
  'dark:data-[state=active]:bg-[#26262e] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-none';
export const caixaDarkTabInactive = 'dark:data-[state=inactive]:text-muted-foreground';

export const caixaMobileTabsList =
  'grid grid-cols-3 h-14 rounded-none p-1 gap-0 border-b border-border/40 dark:border-white/10 bg-card dark:bg-background';

export const caixaMobileTabTrigger =
  'flex flex-col items-center justify-center gap-0.5 h-full rounded-lg border-0 ' +
  'data-[state=active]:bg-muted/40 data-[state=active]:shadow-sm ' +
  caixaDarkTabInactive + ' ' + caixaDarkTabActive;

export const caixaDesktopTabTrigger =
  'flex items-center gap-2 h-12 px-6 rounded-t-xl rounded-b-none border-0 ' +
  'data-[state=active]:bg-card data-[state=active]:shadow-sm ' +
  caixaDarkTabActive;

/** Card consulta — igual atalho Home */
export const caixaConsultaCard =
  'rounded-2xl border border-border/40 bg-card shadow-sm dark:border-white/10 overflow-hidden';

export const caixaChipTrack = 'bg-muted/50 dark:bg-[#26262e]/60';
export const caixaChipActive =
  'bg-card shadow-sm text-foreground dark:bg-[#383e47] dark:text-foreground dark:shadow-none';
export const caixaChipInactive = 'text-muted-foreground';

export const caixaSurface = {
  chipBtn:
    'rounded-xl bg-primary text-primary-foreground border border-primary/70 px-3 py-2 text-xs font-semibold shadow-sm ' +
    'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring ' +
    'dark:bg-[#26262e] dark:text-foreground dark:border-transparent dark:hover:bg-[#383e47]',
  confirmBtn:
    'rounded-xl bg-primary text-primary-foreground border border-primary/70 font-semibold ' +
    'hover:bg-primary/90 disabled:opacity-40 ' +
    'dark:bg-[#26262e] dark:text-foreground dark:border-transparent dark:hover:bg-[#383e47]',
  secondaryBtn: 'rounded-xl bg-muted text-foreground hover:bg-muted/80 dark:hover:bg-[#383e47]',
  paymentRow: 'bg-muted/50 hover:bg-muted dark:bg-[#26262e]/40 dark:hover:bg-[#383e47]/60',
  paymentRowActive: 'bg-muted ring-1 ring-primary/35 dark:ring-white/10 dark:bg-[#383e47]',
  chipSelected: 'bg-primary text-primary-foreground ring-1 ring-primary/30 dark:bg-[#383e47] dark:text-foreground dark:ring-white/10',
  chipIdle: 'bg-muted text-muted-foreground hover:bg-muted dark:bg-[#26262e] dark:hover:bg-[#383e47]',
  itemSelected: 'bg-primary/12 text-foreground ring-1 ring-primary/25 dark:bg-[#383e47] dark:text-foreground dark:ring-white/10',
  itemIdle: 'bg-muted/50 text-foreground hover:bg-muted dark:bg-[#26262e]/40 dark:hover:bg-[#383e47]/60',
};
