/**
 * Camadas z-index do shell global (busca + atalhos laterais).
 * Acima de modais de página (até ~60000), abaixo de toast (99999) e ferramentas dev.
 */
export const SHELL_Z = {
  quickAccessPanel: 80020,
  quickAccessLauncher: 80030,
  search: 80040,
  searchDropdown: 80050,
  quickAccessNestedDialog: 80060,
  quickAccessNestedChild: 80070,
  caixaMirrorShell: 80080,
  caixaMirrorDialog: 80090,
  caixaMirrorChild: 80100,
  /** Galeria de foto do produto — acima de painéis de atalho (orçamento FAB, PDV overlay). */
  produtoGaleria: 80200,
};

/** @deprecated Prefer SHELL_Z — mantido para imports existentes. */
export const QUICK_ACCESS_Z = {
  panel: SHELL_Z.quickAccessPanel,
  launcher: SHELL_Z.quickAccessLauncher,
  nestedDialog: SHELL_Z.quickAccessNestedDialog,
  nestedDialogChild: SHELL_Z.quickAccessNestedChild,
};

/** Fundo opaco dos painéis de atalho (evita ver a tela de baixo no modo claro). */
export const QUICK_ACCESS_PANEL_SHELL_CLASS = 'bg-muted dark:bg-background';

/** Classes Tailwind (valores literais para o purge do build). */
export const SHELL_SEARCH_CLASS = 'z-[80040]';
export const SHELL_SEARCH_DROPDOWN_CLASS = 'z-[80050]';
export const QUICK_ACCESS_PANEL_CLASS = 'z-[80020]';
export const QUICK_ACCESS_LAUNCHER_CLASS = 'z-[80030]';
export const QUICK_ACCESS_NESTED_DIALOG_CLASS = 'z-[80060]';
export const QUICK_ACCESS_NESTED_CHILD_DIALOG_CLASS = 'z-[80070]';

/** Espelho Caixas Ativos / Turnos Fechados — acima dos atalhos rápidos. */
export const CAIXA_MIRROR_SHELL_Z = SHELL_Z.caixaMirrorShell;
export const CAIXA_MIRROR_SHELL_CLASS = 'z-[80080]';
export const CAIXA_MIRROR_DIALOG_CLASS = 'z-[80090]';
export const CAIXA_MIRROR_DIALOG_CHILD_CLASS = 'z-[80100]';
export const PRODUTO_GALERIA_Z_CLASS = 'z-[80200]';

/**
 * Hierarquia interna do orçamento rápido (dentro do shell z-80020).
 * search (0) → footer (10) → cart (20) → quantity (30) → select dropdown (80055+).
 */
export const QUICK_BUDGET_FLOW = {
  search: 0,
  footer: 10,
  cart: 20,
  quantity: 30,
};

export const QUICK_BUDGET_FLOW_CLASS = {
  footer: 'z-[10]',
  cart: 'z-[20]',
  quantity: 'z-[30]',
};

/** Select/unidade acima do painel e das camadas internas (portal no body). */
export const QUICK_BUDGET_SELECT_CLASS = 'z-[80055]';

/**
 * Remove camadas Radix presas e travas de pointer-events/scroll no body
 * após fechar o painel de atalho (caixa/orçamento/vendedor).
 */
export function cleanupQuickAccessPortalLayers() {
  if (typeof document === 'undefined') return;

  const resetBody = () => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
  };

  resetBody();

  requestAnimationFrame(() => {
    resetBody();
    document
      .querySelectorAll(
        '[data-radix-dialog-overlay][data-state="closed"], [data-radix-alert-dialog-overlay][data-state="closed"]'
      )
      .forEach((el) => el.remove());
  });
}
