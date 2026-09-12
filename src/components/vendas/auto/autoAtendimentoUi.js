/** Estilo auto-atendimento / PDV — branco · cinzas · carvão · oliva · cítrico P38. */

import { cn } from '@/components/utils';
import {
  P38_LIGHT_BORDER,
  P38_LIGHT_CARD,
  P38_LIGHT_CITRUS_TEXT,
  P38_LIGHT_FIELD,
  P38_LIGHT_HOVER,
  P38_LIGHT_OLIVE_BTN,
  P38_LIGHT_PAGE,
  P38_LIGHT_SUBTLE_ACCENT_BAR,
} from '@/lib/p38LightTheme';

/** Carvão — hero, faixa de avisos, capas de destaque. */
export const AUTO_COVER_CLASS = 'bg-[#242424] text-white';

/** Header operacional — minimalista, como vitrine premium. */
export const AUTO_HEADER_CLASS = cn(
  'relative bg-white/95 backdrop-blur-sm text-foreground px-4 sm:px-6 py-4 flex items-center justify-between',
  'border-b border-[#e8ecef]/80 shrink-0',
);

/** Barra fina no topo do header (detalhe P38). */
export const AUTO_HEADER_ACCENT_BAR = P38_LIGHT_SUBTLE_ACCENT_BAR;

/** Fundo interior — branco editorial. */
export const AUTO_SHELL_BG = P38_LIGHT_PAGE;

/** Canvas da loja — leve tom studio (contagia o PDP pelo fluxo). */
export const AUTO_PAGE_CANVAS = 'bg-[#f8fafb]';

/** Superfície cinza muito clara (listas, faixas). */
export const AUTO_MUTED_SURFACE = 'bg-[#f3f6f8]';

/** Cartões brancos com sombra leve. */
export const AUTO_SURFACE_CLASS = cn(
  'rounded-2xl border border-[#e8ecef]/90 bg-white shadow-[0_8px_30px_rgba(36,36,36,0.04)]',
);

/** Painel editorial (formulários, modais) — sem caixa pesada. */
export const AUTO_EDITORIAL_PANEL = cn(
  'rounded-2xl bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(36,36,36,0.06)]',
);

/** Palco studio PDP (referência e-commerce premium). */
export const AUTO_PDP_STAGE_BG = 'bg-[#e8eef2]';

/** Campo largo estilo dropdown PDP. */
export const AUTO_PDP_FIELD =
  'w-full rounded-lg border border-[#d4dde4] bg-[#eef4f8] px-4 py-3 text-sm font-medium text-[#242424]';

/** CTA full-width PDP. */
export const AUTO_PDP_CTA = cn(
  P38_LIGHT_OLIVE_BTN,
  'h-12 w-full rounded-lg text-sm font-bold uppercase tracking-[0.08em]',
);

/** Campos — mesmo estilo do PDP (dropdown largo). */
export const AUTO_FIELD_CLASS = cn(
  AUTO_PDP_FIELD,
  'h-12 text-base placeholder:text-[#6b6b6b]/70',
  'focus-visible:ring-2 focus-visible:ring-[#4a5240]/20 focus-visible:border-[#4a5240]/35',
);

/** CTA principal — oliva, uppercase, como no PDP. */
export const AUTO_PRIMARY_BTN = AUTO_PDP_CTA;

/** Botão secundário outline premium. */
export const AUTO_GHOST_BTN = cn(
  'h-12 w-full rounded-lg border border-[#d4dde4] bg-white text-sm font-semibold text-[#242424]',
  'hover:bg-[#f8fafb] transition-colors',
);

/** Palco de imagem (cards produto/categoria). */
export const AUTO_IMAGE_STAGE = AUTO_PDP_STAGE_BG;

/** CTA secundário cítrico (destaque quente). */
export const AUTO_CITRUS_BTN =
  'bg-[#e8b824] text-[#242424] hover:bg-[#e8b824]/90 font-bold rounded-xl';

/** Acento oliva P38 — ícones, preços, detalhes. */
export const AUTO_ACCENT_TEXT = 'text-[#4a5240] dark:text-[#a4ce33]';
export const AUTO_ACCENT_BG = 'bg-card shadow-sm dark:bg-[#26262e]';
export const AUTO_ACCENT_BG_STRONG = 'bg-secondary dark:bg-[#383e47]';

/** Amarelo cítrico — destaques pontuais. */
export const AUTO_CITRUS_TEXT = `${P38_LIGHT_CITRUS_TEXT} dark:text-[#e8b824]`;
export const AUTO_CITRUS_BG = 'bg-[#e8b824]/12 dark:bg-[#e8b824]/10';
export const AUTO_CITRUS_BORDER = 'border-[#e8b824]/35 dark:border-[#e8b824]/40';

/** Texto suave sobre capa carvão. */
export const AUTO_COVER_MUTED = 'text-white/75';

/** Hover de cartão / linha no interior claro. */
export const AUTO_CARD_HOVER = cn(
  'hover:border-[#e8b824]/30 hover:shadow-md active:scale-[0.98] transition-all',
  P38_LIGHT_HOVER,
);

/** Hover em botões secundários com fundo suave. */
export const AUTO_SOFT_HOVER = 'hover:bg-secondary/60 dark:hover:bg-[#26262e]';

/** Borda neutra partilhada. */
export const AUTO_BORDER_CLASS = cn('border', P38_LIGHT_BORDER);

/** @deprecated use AUTO_SURFACE_CLASS */
export const AUTO_CARD_CLASS = AUTO_SURFACE_CLASS;

/** Raiz da loja / protótipo web — DIN 1451, legível e premium. */
export const AUTO_STOREFRONT_ROOT = cn(
  'font-din-1451 antialiased text-[#242424] selection:bg-[#e8b824]/25',
);

/** Largura máxima editorial (vitrine). */
export const AUTO_STORE_MAX = 'max-w-6xl mx-auto w-full';

/** Tipografia — hierarquia loja premium (e-commerce PDP). */
export const AUTO_EYEBROW =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6b6b]';
export const AUTO_DISPLAY =
  'text-3xl sm:text-4xl font-medium tracking-tight text-[#242424] leading-[1.08]';
export const AUTO_HEADING =
  'text-xl sm:text-2xl font-medium tracking-tight text-[#242424] leading-snug';
export const AUTO_SUBHEADING = 'text-base text-[#6b6b6b] leading-relaxed';
export const AUTO_SECTION_TITLE =
  'text-xs font-semibold uppercase tracking-[0.12em] text-[#404040]';
export const AUTO_BODY = 'text-sm text-[#404040] leading-relaxed';
export const AUTO_LABEL =
  'text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6b6b]';
export const AUTO_PRICE =
  'text-lg sm:text-xl font-medium tabular-nums tracking-tight text-[#4a5240]';
export const AUTO_PRICE_LARGE =
  'text-2xl sm:text-3xl font-medium tabular-nums tracking-tight text-[#4a5240]';
export const AUTO_PRICE_PDP =
  'text-3xl sm:text-4xl font-medium tabular-nums tracking-tight text-[#242424]';

/** Tabs rodapé PDP. */
export const AUTO_PDP_TAB =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6b6b] hover:text-[#242424] transition-colors';
export const AUTO_PDP_TAB_ACTIVE =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#242424]';
export const AUTO_PRODUCT_NAME =
  'text-sm font-medium leading-snug text-[#242424] line-clamp-3';
export const AUTO_CARD_ROUNDED = 'rounded-2xl';
export const AUTO_PANEL_ROUNDED = 'rounded-3xl';

/** Cartão produto / categoria — vitrine premium. */
export const AUTO_VITRINE_CARD = cn(
  AUTO_SURFACE_CLASS,
  AUTO_CARD_ROUNDED,
  AUTO_CARD_HOVER,
  'hover:shadow-[0_14px_36px_rgba(36,36,36,0.08)]',
);

/** Barra fixa inferior (carrinho). */
export const AUTO_STICKY_BAR = cn(
  'fixed bottom-0 left-0 right-0 z-30 border-t border-[#e8ecef]/90',
  'bg-white/96 backdrop-blur-md shadow-[0_-16px_48px_rgba(36,36,36,0.07)]',
);

/** Faixa de busca / filtros. */
export const AUTO_TOOLBAR = cn(
  'shrink-0 border-b border-[#e8ecef]/80 bg-white px-4 py-4',
);

export function formatAutoMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function chunkForGrid(items, columns = 4) {
  const safe = Array.isArray(items) ? items : [];
  const rows = [];
  for (let i = 0; i < safe.length; i += columns) {
    rows.push(safe.slice(i, i + columns));
  }
  return rows;
}

export function buildCategoryStructure(produtos = []) {
  const tree = {};
  produtos.forEach((p) => {
    const rawCat = p.categoria_nome || p.categoria || 'Outros';
    const parts = rawCat.split(' > ');
    const mainCat = parts[0]?.trim() || 'Outros';
    const subCat = parts[1]?.trim() || null;
    if (!tree[mainCat]) tree[mainCat] = { count: 0, subs: {} };
    tree[mainCat].count += 1;
    if (subCat) {
      tree[mainCat].subs[subCat] = (tree[mainCat].subs[subCat] || 0) + 1;
    }
  });

  return Object.entries(tree)
    .map(([name, data]) => ({
      name,
      count: data.count,
      subs: Object.entries(data.subs).map(([subName, count]) => ({ name: subName, count })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
