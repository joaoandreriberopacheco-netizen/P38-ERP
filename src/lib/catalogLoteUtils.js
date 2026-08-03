import { pickDefaultPurchaseUnit } from '@/lib/productUnits';

/** Quantidade do lote: vazio ou inválido → 1. */
export function parseLoteQuantidade(raw) {
  const str = String(raw ?? '').trim().replace(',', '.');
  if (!str) return 1;
  const n = parseFloat(str);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export function countLoteDraft(draft = {}) {
  const entries = Object.values(draft);
  const itens = entries.length;
  const unidades = entries.reduce((s, e) => s + (parseLoteQuantidade(e.quantidade) || 0), 0);
  return { itens, unidades };
}

/**
 * Merge entradas do lote no carrinho existente (soma qty por produto_id).
 * @param {Array} existingItems
 * @param {Array<{ produto_id: string, quantidade: number }>} incoming
 * @param {(product, quantidade) => object} buildNewItem
 * @param {Array} products catálogo para resolver produto
 */
export function mergeLoteIntoItems(existingItems = [], incoming = [], buildNewItem, products = []) {
  const byId = new Map();
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  existingItems.forEach((item, index) => {
    byId.set(item.produto_id, { item, index });
  });

  const next = [...existingItems];

  incoming.forEach(({ produto_id, quantidade }) => {
    const qty = parseLoteQuantidade(quantidade);
    const product = productMap[produto_id];
    if (!product) return;

    const hit = byId.get(produto_id);
    if (hit) {
      const prev = parseFloat(hit.item.quantidade) || 0;
      const newQty = prev + qty;
      const merged = { ...hit.item, quantidade: newQty };
      const fator = parseFloat(merged.fator_conversao) || 1;
      if (merged.fator_conversao != null) {
        merged.quantidade_base = newQty * fator;
      }
      next[hit.index] = merged;
    } else {
      const newItem = buildNewItem(product, qty);
      byId.set(produto_id, { item: newItem, index: next.length });
      next.push(newItem);
    }
  });

  return next;
}

export function draftFromProductIds(productIds = [], defaultQty = 1) {
  const draft = {};
  productIds.forEach((id) => {
    draft[id] = { quantidade: defaultQty };
  });
  return draft;
}

export function buildLoteIncomingFromDraft(draft = {}) {
  return Object.entries(draft).map(([produto_id, entry]) => ({
    produto_id,
    quantidade: parseLoteQuantidade(entry?.quantidade),
  }));
}

export function getDefaultPurchaseUnitLabel(product) {
  const pu = pickDefaultPurchaseUnit(product);
  return pu?.unidade || product?.unidade_principal || 'UN';
}
