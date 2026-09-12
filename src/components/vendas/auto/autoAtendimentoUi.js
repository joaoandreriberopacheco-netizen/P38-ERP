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

/** Header operacional — branco com linha cítrica/oliva. */
export const AUTO_HEADER_CLASS = cn(
  'relative bg-card text-foreground px-4 py-3 flex items-center justify-between',
  'border-b border-border/40 shadow-sm shrink-0',
);

/** Barra fina no topo do header (detalhe P38). */
export const AUTO_HEADER_ACCENT_BAR = P38_LIGHT_SUBTLE_ACCENT_BAR;

/** Fundo interior — branco puro. */
export const AUTO_SHELL_BG = P38_LIGHT_PAGE;

/** Superfície cinza muito clara (listas, faixas). */
export const AUTO_MUTED_SURFACE = 'bg-[#f5f5f5]';

/** Cartões brancos com sombra leve. */
export const AUTO_SURFACE_CLASS = cn(P38_LIGHT_CARD, 'rounded-xl border', P38_LIGHT_BORDER);

/** Campos de busca / inputs operacionais. */
export const AUTO_FIELD_CLASS = cn(P38_LIGHT_FIELD, 'rounded-xl');

/** CTA principal — verde oliva P38. */
export const AUTO_PRIMARY_BTN = cn(P38_LIGHT_OLIVE_BTN, 'font-bold rounded-xl');

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
export const AUTO_PRODUCT_NAME =
  'text-sm font-medium leading-snug text-[#242424] line-clamp-3';
export const AUTO_CARD_ROUNDED = 'rounded-2xl';
export const AUTO_PANEL_ROUNDED = 'rounded-3xl';

/** Cartão produto / categoria — vitrine. */
export const AUTO_VITRINE_CARD = cn(
  AUTO_SURFACE_CLASS,
  AUTO_CARD_ROUNDED,
  AUTO_CARD_HOVER,
  'shadow-sm hover:shadow-md',
);

/** Barra fixa inferior (carrinho). */
export const AUTO_STICKY_BAR = cn(
  'fixed bottom-0 left-0 right-0 z-30 border-t border-border/40',
  'bg-white/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(36,36,36,0.08)]',
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
