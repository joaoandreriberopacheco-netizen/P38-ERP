/**
 * Paleta P38 para o módulo de caixa — substitui emerald/blue/red genéricos.
 * success = oliva/limão (primary) · info = ciano · danger = destructive
 */
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { CAIXA_MIRROR_SHELL_CLASS } from '@/lib/quickAccessOverlay';

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
    well: 'bg-primary/10 dark:bg-primary/15',
    icon: 'text-primary',
    text: p38Accent.success.text,
    panel: 'bg-primary/10 dark:bg-primary/15',
    panelText: p38Accent.success.text,
    btn: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    hover: 'hover:bg-primary/10 dark:hover:bg-primary/15',
    pill: 'bg-primary/10 text-primary',
    dot: p38Accent.success.dot,
  },
  info: {
    well: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    icon: p38Accent.info.text,
    text: p38Accent.info.text,
    panel: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    panelText: p38Accent.info.text,
    btn: 'bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 text-white',
    hover: 'hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15',
    pill: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    dot: p38Accent.info.dot,
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
    panel: 'bg-muted',
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

/** Painel P38 com barra oliva (black olive / limão no escuro) */
export const caixaPanel = 'p38-panel rounded-2xl border border-border/40 dark:border-white/10';
export const caixaPanelBody = 'p38-panel__body';

/** Layout fullscreen — scroll interno sem cortar botões sob a barra inferior */
export const caixaShell = 'h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden';
export const caixaMain = 'flex-1 min-h-0 h-0 overflow-hidden flex flex-col';
export const caixaTabsRoot = 'flex-1 min-h-0 h-0 flex flex-col';
export const caixaTabPanel = 'flex-1 min-h-0 h-0 overflow-y-auto overscroll-y-contain touch-pan-y mt-0 data-[state=inactive]:hidden';
export const caixaTabPanelPad = 'p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]';
/** Painéis com GlacialBottomNav visível no shell mobile */
export const caixaTabPanelPadInLayout = 'p-4 pb-[var(--p38-scroll-pad-below-nav)]';
export const caixaMobileTabBar = 'md:hidden flex-shrink-0';
/** Detalhe embutido (Caixas Ativos / Turnos Fechados) — portal no body, acima dos atalhos rápidos */
export const caixaOverlayShell = `fixed inset-0 ${CAIXA_MIRROR_SHELL_CLASS} h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-background pointer-events-auto`;

/** Tipografia da tela de caixa — maiúsculas + corpo maior (alinhado ao fluxo P38) */
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

/**
 * Superfícies do caixa — contraste garantido no modo claro (oliva + texto claro)
 * e comportamento escuro preservado via dark:*.
 */
export const caixaSurface = {
  /** Botão de acção compacto (maquininha, fiado, chips) */
  chipBtn:
    'rounded-xl bg-primary text-primary-foreground border border-primary/70 px-3 py-2 text-xs font-semibold shadow-sm ' +
    'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring ' +
    'dark:bg-card dark:text-foreground dark:border-transparent dark:hover:bg-muted',
  /** Confirmar / CTA principal */
  confirmBtn:
    'rounded-xl bg-primary text-primary-foreground border border-primary/70 font-semibold ' +
    'hover:bg-primary/90 disabled:opacity-40 ' +
    'dark:bg-card dark:text-foreground dark:border-transparent',
  /** Secundário (cancelar, devolver) */
  secondaryBtn: 'rounded-xl bg-muted text-foreground hover:bg-muted/80',
  /** Linha de forma de pagamento */
  paymentRow: 'bg-muted/50 hover:bg-muted',
  paymentRowActive: 'bg-muted ring-1 ring-primary/35 dark:ring-border/40',
  /** Chip seleccionado (parcelas, maquininha, bandeira) */
  chipSelected: 'bg-primary text-primary-foreground ring-1 ring-primary/30',
  chipIdle: 'bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-primary/20',
  /** Item seleccionado em lista */
  itemSelected: 'bg-primary/12 text-foreground ring-1 ring-primary/25 dark:bg-card dark:text-card-foreground dark:ring-border/40',
  itemIdle: 'bg-muted/50 text-foreground hover:bg-muted',
};
