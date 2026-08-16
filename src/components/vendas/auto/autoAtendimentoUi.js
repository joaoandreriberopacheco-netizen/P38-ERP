/** Estilo e helpers compartilhados do totem de auto-atendimento. */

export const AUTO_HEADER_CLASS =
  'bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0';

export const AUTO_PRIMARY_BTN =
  'bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl';

export const AUTO_CARD_CLASS =
  'bg-card border border-border/40 rounded-xl shadow-sm';

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
