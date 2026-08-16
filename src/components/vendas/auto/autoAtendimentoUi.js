/** Estilo e helpers compartilhados do totem de auto-atendimento e PDV supermercado.
 *  Capa roxa (header) + interior claro P38 + CTAs verde escuro. */

export const AUTO_HEADER_CLASS =
  'bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0';

/** Fundo interior — verde-oliva muito claro P38 (#f7f8f5). */
export const AUTO_SHELL_BG = 'bg-[#f7f8f5] dark:bg-background';

/** Cartões brancos com borda suave mediterrânea. */
export const AUTO_SURFACE_CLASS =
  'bg-white dark:bg-card border border-[#dce0d4] dark:border-border/40 rounded-xl shadow-sm';

/** Campos de busca / inputs operacionais — superfície P38. */
export const AUTO_FIELD_CLASS = 'p38-field-surface border-0 shadow-none rounded-xl';

/** CTA principal — verde mais forte (aprovado João André). */
export const AUTO_PRIMARY_BTN =
  'bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl';

/** Acento oliva P38 para ícones e detalhes no interior claro. */
export const AUTO_ACCENT_TEXT = 'text-[#4a5240] dark:text-[#a4ce33]';
export const AUTO_ACCENT_BG = 'bg-[#f0f2ec] dark:bg-[#26262e]';
export const AUTO_ACCENT_BG_STRONG = 'bg-[#e8ebe3] dark:bg-[#383e47]';

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
