import { lancamentoEhCompraMercadoriaPedido } from '@/lib/agefinConsultaFilters';
import { cn } from '@/lib/utils';

/** Layout extrato mobile (protótipo v8) — hero colapsável + barra verde claro. */
export const FLUXO_EXTRATO_MOBILE_V8 = true;

/**
 * `--font` em `fluxo-caixa-extrato-prototype.html` (system stack; sem @font-face / Google Fonts).
 * Aplica só na árvore `FluxoExtratoMobileShell`.
 */
export const P38_EXTRATO_V8_FONT_FAMILY =
  "font-[system-ui,-apple-system,'Segoe_UI',Roboto,sans-serif]";
export const P38_EXTRATO_V8_FONT_SCOPE = cn(P38_EXTRATO_V8_FONT_FAMILY, '[&_*]:font-[inherit]');

/** Paridade visual com `fluxo-caixa-extrato-prototype.html` (list-scroll / tx-row). */
export const P38_EXTRATO_V8_LIST_BG = 'bg-[#f4f5f3] dark:bg-[#1f1d22]';
/** Protótipo dark `--surface` / hero — contraste com `--bg` (#1f1d22). */
export const P38_EXTRATO_V8_SURFACE_DARK = 'dark:bg-[#2d333b]';
export const P38_EXTRATO_V8_DAY_CARD = cn(
  'overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm dark:border-white/10 dark:shadow-none',
  P38_EXTRATO_V8_SURFACE_DARK,
);
/** Bloco data + card — separação entre dias no extrato mobile. */
export const P38_EXTRATO_V8_DAY_GROUP = 'w-full min-w-0';
export const P38_EXTRATO_V8_DAY_LIST_GAP = 'flex flex-col gap-7';
export const P38_EXTRATO_V8_DATE_HEADER =
  'pb-2.5 pt-1 text-[11px] font-bold uppercase tracking-[0.04em] text-[#6b7280] dark:text-muted-foreground';
/** `.tx-title` */
export const P38_EXTRATO_V8_ROW_TITLE =
  'text-sm font-semibold leading-[1.25] text-[#1a1a1a] normal-case dark:text-[#eceff1]';
/** `.tx-meta` */
export const P38_EXTRATO_V8_ROW_META =
  'mt-0.5 text-[11px] font-normal leading-snug text-[#6b7280] dark:text-muted-foreground normal-case';
/** `.tx-value` */
export const P38_EXTRATO_V8_ROW_VALUE =
  'text-[13px] font-bold tabular-nums whitespace-nowrap';
/** Transferência interna (contas da empresa no filtro) — valor e ícone esmaecidos. */
export const P38_EXTRATO_V8_TRANSFER_INTERNA_VALUE =
  'text-[#6b7280]/90 dark:text-[#9ca3af]/95';
export const P38_EXTRATO_V8_TRANSFER_INTERNA_ICON_TILE =
  'bg-[#eceeed] text-[#9ca3af] opacity-85 dark:bg-[#383e47]/55 dark:text-[#9ca3af]';
/** `.day-saldo` — mesma família que `.tx-row` (herda `P38_EXTRATO_V8_FONT_SCOPE`). */
export const P38_EXTRATO_V8_DAY_SALDO =
  'flex items-center justify-between border-b border-[#e5e7eb] px-3.5 py-3 text-[13px] font-normal leading-none text-[#1a1a1a] !font-[inherit] dark:border-white/10 dark:text-foreground';
export const P38_EXTRATO_V8_DAY_SALDO_VALUE = cn(
  P38_EXTRATO_V8_ROW_VALUE,
  '!font-[inherit] text-[#3d5a3d] dark:text-[#a4ce33]',
);
export const P38_EXTRATO_V8_ROW_LINE =
  'w-full border-0 border-l-0 !border-b border-[#e5e7eb] !bg-transparent px-3 py-3.5 !font-[inherit] shadow-none last:!border-b-0 dark:!border-white/10';

/**
 * Tokens P38 partilhados — fluxo de caixa, contas abertas e Planejamento.
 *
 * Referência visual mobile (aprovada 2026-07-29 — João André):
 * Planejamento financeiro dark — limão nos CTAs, carvão de fundo, superfícies
 * P38_FIELD_SURFACE / P38_KPI_SHELL. Ver .cursor/rules/p38-mobile-referencia-planejamento.mdc
 * e docs/p38-mobile-rollout.md §0.
 */

export const P38_CHIP_ACTIVE =
  'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]';
export const P38_CHIP_INACTIVE =
  'bg-card text-muted-foreground shadow-sm dark:bg-[#26262e] dark:text-foreground/80 hover:bg-secondary/50 dark:hover:bg-[#383e47]';
/** Superfície operacional — branco puro no claro. */
export const P38_FIELD_SURFACE = 'bg-card border-0 shadow-sm dark:p38-field-surface dark:shadow-none';
/** Campo de busca — branco com sombra leve no claro. */
export const P38_SEARCH = 'bg-card border-0 shadow-sm h-11 rounded-lg focus-visible:ring-2 focus-visible:ring-[#e8b824]/22 dark:p38-search-field dark:shadow-none dark:focus-visible:ring-1 dark:focus-visible:ring-border/60';
/** Busca com contraste no modo claro (card branco, sem borda); P38 no escuro. */
export const P38_SEARCH_SURFACE =
  'rounded-xl border-0 shadow-none bg-card dark:bg-transparent p38-field-surface';
/** Painel de resultados tipo lista suspensa. */
export const P38_DROPDOWN_PANEL =
  'bg-card dark:bg-background';
export const P38_POPOVER =
  'border border-border/40 dark:border-white/10 shadow-xl rounded-2xl bg-card dark:bg-[#2d333b]';
export const P38_KPI_SHELL =
  'rounded-xl bg-card border-0 shadow-sm px-3 py-2.5 sm:px-3 sm:py-2.5 dark:p38-field-surface dark:shadow-none';
export const P38_ACCENT = 'text-[#a8942e] dark:text-[#a4ce33]';
/**
 * Mobile: busca + ícones fixos ao rolar (dentro do painel que scrolla).
 * Fundo opaco + z alto para o conteúdo da lista não “vazar” por baixo.
 */
export const P38_FILTROS_STICKY =
  'sticky top-0 z-50 isolate bg-background py-2 shadow-[0_1px_0_0_hsl(var(--border)/0.45)] md:static md:z-auto md:isolate-auto md:bg-transparent md:py-0 md:shadow-none';

/** Faixa de filtros fora do scroll (Fluxo/Caixas) — sempre por cima da lista. */
export const P38_FINANCEIRO_FILTROS_BAR =
  'relative z-40 shrink-0 isolate border-b border-border/35 bg-background pb-2 shadow-sm dark:border-white/10 md:z-auto md:border-b-0 md:shadow-none';

/** Abas Contas / Fluxo — ícones ao lado do título (mobile). */
export const FINANCEIRO_ABA_TAB_GROUP =
  'flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/80 p-0.5 dark:bg-muted';
export const FINANCEIRO_ABA_TAB_BTN =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all';
export const FINANCEIRO_ABA_TAB_ACTIVE =
  'bg-[#4a5240] text-white dark:bg-[#636B2F] dark:text-[#A8B56E]';
export const FINANCEIRO_ABA_TAB_IDLE = 'text-muted-foreground hover:text-foreground/90';

/** Compra de mercadoria / CMV — enriquecer meta do extrato com pedido e fornecedor. */
export function lancamentoExtratoEhCompraMercadoria(l) {
  if (!l) return false;
  if (lancamentoEhCompraMercadoriaPedido(l)) return true;
  if (l.is_custo_mercadoria === true) return true;
  const cat = String(l.categoria || l?.dados?.categoria || '').toLowerCase();
  return cat.includes('compra de mercadoria') || cat.includes('compras de mercadoria');
}

export function extratoNumeroPedidoCompra(l) {
  const fromVinculo =
    l?.pedido_compra_vinculado_numero || l?.dados?.pedido_compra_vinculado_numero || '';
  const fromRef =
    l?.referencia_tipo === 'PedidoCompra'
      ? l?.referencia_numero || l?.dados?.referencia_numero || ''
      : '';
  const n = String(fromVinculo || fromRef || '').trim();
  return n || null;
}

export function extratoFornecedorNome(l) {
  const n =
    l?.terceiro_nome ||
    l?.dados?.terceiro_nome ||
    l?.dados?.fornecedor_nome ||
    l?.fornecedor_nome ||
    '';
  const s = String(n).trim();
  return s || null;
}

/** Meta extrato compra mercadoria — fornecedor (pedido fica no título/descrição, não na legenda). */
export function extratoCompraMercadoriaMetaExtras(l) {
  if (!lancamentoExtratoEhCompraMercadoria(l)) return [];
  const fornecedor = extratoFornecedorNome(l);
  return fornecedor ? [fornecedor] : [];
}
