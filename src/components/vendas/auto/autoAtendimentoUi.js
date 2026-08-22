/** Estilo e helpers compartilhados do totem de auto-atendimento e PDV supermercado.
 *  Capa roxa (header) + interior branco puro P38 + CTAs verde escuro. */

import { cn } from '@/components/utils';
import {
  P38_LIGHT_BORDER,
  P38_LIGHT_CARD,
  P38_LIGHT_CITRUS_TEXT,
  P38_LIGHT_FIELD,
  P38_LIGHT_HOVER,
  P38_LIGHT_OLIVE_BTN,
  P38_LIGHT_PAGE,
} from '@/lib/p38LightTheme';

/** Capa roxa — só header, banner de boas-vindas e faixa de avisos. */
export const AUTO_COVER_CLASS = 'bg-indigo-600 text-white';

export const AUTO_HEADER_CLASS =
  `${AUTO_COVER_CLASS} px-4 py-3 flex items-center justify-between shadow-md shrink-0`;

/** Fundo interior — branco puro. */
export const AUTO_SHELL_BG = P38_LIGHT_PAGE;

/** Cartões brancos com sombra leve. */
export const AUTO_SURFACE_CLASS = cn(P38_LIGHT_CARD, 'rounded-xl border', P38_LIGHT_BORDER);

/** Campos de busca / inputs operacionais. */
export const AUTO_FIELD_CLASS = cn(P38_LIGHT_FIELD, 'rounded-xl');

/** CTA principal — verde oliva P38. */
export const AUTO_PRIMARY_BTN = cn(P38_LIGHT_OLIVE_BTN, 'font-bold rounded-xl');

/** Acento oliva P38 — ícones, preços, detalhes. */
export const AUTO_ACCENT_TEXT = 'text-[#4a5240] dark:text-[#a4ce33]';
export const AUTO_ACCENT_BG = 'bg-card shadow-sm dark:bg-[#26262e]';
export const AUTO_ACCENT_BG_STRONG = 'bg-secondary dark:bg-[#383e47]';

/** Laranja suco — destaques pontuais. */
export const AUTO_CITRUS_TEXT = `${P38_LIGHT_CITRUS_TEXT} dark:text-[#e8b824]`;
export const AUTO_CITRUS_BG = 'bg-[#f07a1a]/12 dark:bg-[#e8b824]/10';
export const AUTO_CITRUS_BORDER = 'border-[#f07a1a]/30 dark:border-[#e8b824]/40';

/** Hover de cartão / linha no interior claro. */
export const AUTO_CARD_HOVER = cn(
  'hover:border-[#f07a1a]/25 hover:shadow-md active:scale-[0.98] transition-all',
  P38_LIGHT_HOVER,
);

/** Hover em botões secundários com fundo suave. */
export const AUTO_SOFT_HOVER = 'hover:bg-secondary/60 dark:hover:bg-[#26262e]';

/** Borda neutra partilhada. */
export const AUTO_BORDER_CLASS = cn('border', P38_LIGHT_BORDER);

/** @deprecated use AUTO_SURFACE_CLASS */
export const AUTO_CARD_CLASS = AUTO_SURFACE_CLASS;

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
