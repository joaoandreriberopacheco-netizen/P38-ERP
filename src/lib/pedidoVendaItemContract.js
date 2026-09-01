/* ============================================================================
 * pedidoVendaItemContract.js
 *
 * Contrato canonico para uma linha de PedidoVendaItem.
 *
 * Mesmo padrao de pedidoCompraItemContract: chave da verdade e o
 * `produto_unidade_id` apontando pra Produto.unidades[]. Tudo derive dele.
 *
 * Diferenca essencial vs. compra: o eixo de preco e venda
 * (preco_unitario_fator1 = R$/[unidade base]), e ha um snapshot opcional do
 * `tabela_preco_id` aplicado pra rastreio.
 * ============================================================================ */

import {
  getUnidadeByIdCanonical,
  getUnidadeBySiglaCanonical,
  getUnidadeComercialCanonical,
  getUnidadePrincipalCanonical,
  normalizeUnitCode,
} from "./productUnits";

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function resolveUnidadeForVendaItem(produto, item = {}) {
  if (item?.produto_unidade_id) {
    const byId = getUnidadeByIdCanonical(produto, item.produto_unidade_id);
    if (byId) return { unidade: byId, source: "produto_unidade_id", found: true };
  }
  const sigla = normalizeUnitCode(item?.unidade_sigla || item?.unidade_medida);
  if (sigla) {
    const bySigla = getUnidadeBySiglaCanonical(produto, sigla);
    if (bySigla) return { unidade: bySigla, source: "sigla_match", found: true };
  }
  const comercial = getUnidadeComercialCanonical(produto);
  if (comercial) return { unidade: comercial, source: "comercial_default", found: false };
  const principal = getUnidadePrincipalCanonical(produto);
  return { unidade: principal, source: "principal_fallback", found: false };
}

export function derivePedidoVendaItem({ pedido = {}, produto = {}, input = {} }) {
  const errors = [];
  if (!produto?.id) errors.push("produto_id obrigatorio");
  if (!pedido?.id) errors.push("pedido_venda_id obrigatorio");

  const resolvido = resolveUnidadeForVendaItem(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;
  const fatorPreco = asNumber(u?.fator_preco, 1) || 1;

  const qComercial = asNumber(input.quantidade_comercial ?? input.quantidade, 0);
  if (qComercial <= 0) errors.push("quantidade_comercial deve ser > 0");
  const qBase = round6(qComercial * fator);

  const precoFator1 = asNumber(input.preco_unitario_fator1 ?? input.preco_unitario_praticado, 0);
  if (precoFator1 < 0) errors.push("preco_unitario_fator1 nao pode ser negativo");

  const desconto = asNumber(input.desconto_unitario_fator1 ?? input.desconto_unitario, 0);
  const precoFinal = round6(precoFator1 - desconto);
  const total = round6(qBase * precoFinal);

  const item = {
    pedido_venda_id: pedido?.id || "",
    pedido_venda_numero: pedido?.numero || "",
    produto_id: produto?.id || "",
    produto_nome: produto?.nome || "",
    produto_unidade_id: u?.id || "",
    unidade_sigla: normalizeUnitCode(u?.sigla) || "UN",
    fator_aplicado: fator,
    fator_preco_aplicado: fatorPreco,
    quantidade_comercial: round6(qComercial),
    quantidade_base: qBase,
    preco_unitario_fator1: round6(precoFator1),
    preco_unitario_comercial: round6(precoFator1 * fator),
    desconto_unitario_fator1: round6(desconto),
    preco_final_unitario_fator1: precoFinal,
    tabela_preco_id: typeof input.tabela_preco_id === "string" ? input.tabela_preco_id : "",
    tabela_preco_multiplicador: asNumber(input.tabela_preco_multiplicador, 1) || 1,
    total,
    ordem: asNumber(input.ordem, 0),
    observacoes: typeof input.observacoes === "string" ? input.observacoes : "",
  };

  return { item, valid: errors.length === 0, errors };
}

export function pedidoVendaItemToLegacyMirror(item = {}) {
  const fator = asNumber(item?.fator_aplicado, 1) || 1;
  const qComercial = asNumber(item?.quantidade_comercial, 0);
  const qBase = asNumber(item?.quantidade_base, 0);
  const quantidade =
    qComercial > 0 ? qComercial : qBase > 0 && fator > 0 ? round6(qBase / fator) : asNumber(item?.quantidade, 0);
  return {
    produto_id: item?.produto_id || "",
    produto_nome: item?.produto_nome || "",
    produto_unidade_id: item?.produto_unidade_id || "",
    quantidade,
    unidade_medida: item?.unidade_sigla || "UN",
    fator_conversao: fator,
    quantidade_base: asNumber(item?.quantidade_base, 0),
    preco_unitario_praticado: asNumber(item?.preco_unitario_fator1, 0),
    preco_unitario_apresentacao: asNumber(item?.preco_unitario_comercial, 0),
    desconto_unitario: asNumber(item?.desconto_unitario_fator1, 0),
    total: asNumber(item?.total, 0),
    preco_eixo: "FATOR_1",
    unidade_apresentacao: item?.unidade_sigla || "UN",
    pedido_venda_item_id: item?.id || undefined,
  };
}

export function rebuildPedidoVendaItensMirror(items = []) {
  return (Array.isArray(items) ? items : []).map(pedidoVendaItemToLegacyMirror);
}

export function calcularSubtotalPedidoVenda(items = []) {
  return round6((Array.isArray(items) ? items : []).reduce((acc, it) => acc + asNumber(it?.total, 0), 0));
}
