import {
  buildSaleUnitOptions,
  calculateBaseQuantity,
  normalizeUnitCode,
  pickDefaultSaleUnit,
  resolvePrimaryFromFactorOne,
} from "@/lib/productUnits";
import { parseLoteQuantidade } from "@/lib/catalogLoteUtils";

const round6 = (value) => Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;

function getProdutoUnidadeId(unit, unidade) {
  if (unit?.is_primary || unit?.id === "primary") return "principal";
  return unit?.id || unidade;
}

export function formatCountQuantity(value, maximumFractionDigits = 4) {
  const n = Number(value) || 0;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function resolveInventoryProductName(product, fallback = "") {
  return (
    product?.nome ||
    [product?.campo_hierarquico_1, product?.campo_hierarquico_2, product?.campo_hierarquico_3]
      .filter(Boolean)
      .join(" ") ||
    fallback ||
    "Produto"
  );
}

export function getDefaultCountUnit(product) {
  const options = buildSaleUnitOptions(product, 1);
  const fallbackUnit = normalizeUnitCode(product?.unidade_principal) || "UN";
  const selected = pickDefaultSaleUnit(product, 1) || options[0];

  if (selected) {
    return {
      ...selected,
      unidade: normalizeUnitCode(selected.unidade) || fallbackUnit,
      fator_conversao: Number(selected.fator_conversao) > 0 ? Number(selected.fator_conversao) : 1,
    };
  }

  return {
    id: "primary",
    nome: "Unidade base",
    unidade: fallbackUnit,
    fator_conversao: 1,
    valor_unitario: 0,
    is_primary: true,
  };
}

export function getDefaultCountUnitLabel(product) {
  return getDefaultCountUnit(product)?.unidade || product?.unidade_principal || 'UN';
}

export function getCountUnitForEntry(product, entry = {}) {
  const options = buildSaleUnitOptions(product, 1);
  const sigla = normalizeUnitCode(entry.unidade_medida || entry.unidade_sigla);

  if (sigla) {
    const bySigla = options.find((option) => normalizeUnitCode(option.unidade) === sigla);
    if (bySigla) {
      return {
        ...bySigla,
        unidade: normalizeUnitCode(bySigla.unidade),
        fator_conversao: Number(bySigla.fator_conversao) > 0 ? Number(bySigla.fator_conversao) : 1,
      };
    }
  }

  if (sigla && Number(entry.fator_conversao) > 0) {
    return {
      id: entry.produto_unidade_id || sigla,
      nome: sigla,
      unidade: sigla,
      fator_conversao: Number(entry.fator_conversao),
      valor_unitario: 0,
      is_primary: false,
    };
  }

  return getDefaultCountUnit(product);
}

export function getEntryBaseQuantity(entry = {}, product = null) {
  const explicitBase = entry.quantidade_base ?? entry.quantidade_contada_base;
  if (explicitBase !== undefined && explicitBase !== null && explicitBase !== "") {
    return round6(explicitBase);
  }

  if (
    entry.quantidade_contada_comercial !== undefined &&
    entry.quantidade_contada_comercial !== null &&
    entry.quantidade_contada_comercial !== ""
  ) {
    const unit = getCountUnitForEntry(product, entry);
    return round6(calculateBaseQuantity(entry.quantidade_contada_comercial, unit.fator_conversao));
  }

  return round6(entry.quantidade_contada);
}

export function getEntryDisplayQuantity(entry = {}, product = null) {
  if (
    entry.quantidade_contada_comercial !== undefined &&
    entry.quantidade_contada_comercial !== null &&
    entry.quantidade_contada_comercial !== ""
  ) {
    return round6(entry.quantidade_contada_comercial);
  }

  const unit = getCountUnitForEntry(product, entry);
  const base = getEntryBaseQuantity(entry, product);
  const factor = Number(unit.fator_conversao) > 0 ? Number(unit.fator_conversao) : 1;
  return round6(base / factor);
}

export function buildCountEntry(product, quantityDisplay = 1, unitOption = null) {
  const unit = unitOption || getDefaultCountUnit(product);
  const factor = Number(unit.fator_conversao) > 0 ? Number(unit.fator_conversao) : 1;
  const quantidadeComercial = round6(quantityDisplay);
  const quantidadeBase = round6(calculateBaseQuantity(quantidadeComercial, factor));
  const unidade = normalizeUnitCode(unit.unidade) || normalizeUnitCode(product?.unidade_principal) || "UN";

  return {
    produto_id: product.id,
    produto_nome: resolveInventoryProductName(product),
    quantidade_contada: quantidadeBase,
    quantidade_contada_comercial: quantidadeComercial,
    quantidade_contada_base: quantidadeBase,
    quantidade_base: quantidadeBase,
    unidade_medida: unidade,
    unidade_sigla: unidade,
    produto_unidade_id: getProdutoUnidadeId(unit, unidade),
    fator_conversao: factor,
  };
}

export function updateCountEntryQuantity(entry = {}, product = null, quantityDisplay = 0) {
  const unit = getCountUnitForEntry(product, entry);
  return {
    ...entry,
    ...buildCountEntry(
      {
        id: entry.produto_id || product?.id,
        ...product,
        nome: entry.produto_nome || product?.nome,
      },
      quantityDisplay,
      unit,
    ),
    produto_id: entry.produto_id || product?.id,
    produto_nome: entry.produto_nome || resolveInventoryProductName(product),
  };
}

export function changeCountEntryUnit(entry = {}, product = null, unitOption = null) {
  const base = getEntryBaseQuantity(entry, product);
  const unit = unitOption || getDefaultCountUnit(product);
  const factor = Number(unit.fator_conversao) > 0 ? Number(unit.fator_conversao) : 1;
  const display = round6(base / factor);
  return {
    ...entry,
    quantidade_contada: base,
    quantidade_contada_comercial: display,
    quantidade_contada_base: base,
    quantidade_base: base,
    unidade_medida: normalizeUnitCode(unit.unidade) || "UN",
    unidade_sigla: normalizeUnitCode(unit.unidade) || "UN",
    produto_unidade_id: getProdutoUnidadeId(unit, normalizeUnitCode(unit.unidade) || "UN"),
    fator_conversao: factor,
  };
}

export function getGroupDisplayFromBase(product, baseQuantity = 0) {
  const unit = getDefaultCountUnit(product);
  const factor = Number(unit.fator_conversao) > 0 ? Number(unit.fator_conversao) : 1;
  const unidadeBase = resolvePrimaryFromFactorOne(product, product?.unidade_principal || "UN");
  return {
    quantidade: round6((Number(baseQuantity) || 0) / factor),
    unidade: normalizeUnitCode(unit.unidade) || "UN",
    fator_conversao: factor,
    quantidade_base: round6(baseQuantity),
    unidade_base: normalizeUnitCode(unidadeBase) || "UN",
  };
}

/**
 * Incorpora draft de lote na lista de entradas de contagem (soma por produto).
 */
export function mergeLoteDraftIntoCountItens(existingItens = [], draft = {}, products = []) {
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  let next = [...existingItens];

  Object.entries(draft || {}).forEach(([produtoId, entry]) => {
    const product = productMap[produtoId];
    if (!product) return;
    const addQty = parseLoteQuantidade(entry?.quantidade);
    const existingEntries = next.filter((i) => i.produto_id === produtoId);

    if (existingEntries.length === 0) {
      next.push(buildCountEntry(product, addQty));
      return;
    }

    const refEntry = existingEntries[0];
    const totalBase = existingEntries.reduce(
      (sum, item) => sum + getEntryBaseQuantity(item, product),
      0,
    );
    const display = getGroupDisplayFromBase(product, totalBase);
    const unit = getCountUnitForEntry(product, refEntry);
    const newCommercialQty = round6(display.quantidade + addQty);
    const consolidated = buildCountEntry(product, newCommercialQty, unit);
    next = [...next.filter((i) => i.produto_id !== produtoId), consolidated];
  });

  return next;
}
