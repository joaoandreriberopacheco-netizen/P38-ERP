/** Estilo e helpers compartilhados do totem de auto-atendimento e PDV supermercado.
 *  Capa roxa (header) + interior claro P38 + CTAs verde escuro. */

/** Capa roxa — só header, banner de boas-vindas e faixa de avisos. */
export const AUTO_COVER_CLASS = 'bg-indigo-600 text-white';

export const AUTO_HEADER_CLASS =
  `${AUTO_COVER_CLASS} px-4 py-3 flex items-center justify-between shadow-md shrink-0`;

/** Fundo interior — branco puro P38. */
export const AUTO_SHELL_BG = 'bg-background dark:bg-background';

/** Cartões brancos com borda suave neutra. */
export const AUTO_SURFACE_CLASS =
  'bg-card border border-border/40 dark:border-border/40 rounded-xl shadow-sm';

/** Campos de busca / inputs operacionais — superfície P38. */
export const AUTO_FIELD_CLASS = 'p38-field-surface border-0 shadow-none rounded-xl';

/** CTA principal — verde oliva P38. */
export const AUTO_PRIMARY_BTN =
  'bg-[#4a5240] hover:bg-[#3f4637] text-white font-bold rounded-xl';

/** Acento oliva P38 — ícones, preços, detalhes. */
export const AUTO_ACCENT_TEXT = 'text-[#4a5240] dark:text-[#a4ce33]';
export const AUTO_ACCENT_BG = 'bg-muted dark:bg-[#26262e]';
export const AUTO_ACCENT_BG_STRONG = 'bg-secondary dark:bg-[#383e47]';

/** Amarelo cítrico P38 — destaques pontuais. */
export const AUTO_CITRUS_TEXT = 'text-[#c99710] dark:text-[#e8b824]';
export const AUTO_CITRUS_BG = 'bg-[#e8b824]/15 dark:bg-[#e8b824]/10';
export const AUTO_CITRUS_BORDER = 'border-[#e8b824]/40';

/** Hover de cartão no interior claro. */
export const AUTO_CARD_HOVER =
  'hover:border-[#4a5240]/35 hover:shadow-md active:scale-[0.98] transition-all';

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
