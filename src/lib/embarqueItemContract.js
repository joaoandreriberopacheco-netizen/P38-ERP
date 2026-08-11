/* ============================================================================
 * embarqueItemContract.js
 *
 * Contrato canonico para EmbarqueItem.
 *
 * Diferenca-chave vs PedidoCompra/Venda: o item de embarque NAO carrega preco.
 * Ele e puramente quantitativo (pedida/embarcada/recebida) e referencia uma
 * linha de PedidoCompraItem (rastreio fino) ou apenas um produto.
 *
 * Resolucao da unidade: igual a dos demais — `produto_unidade_id` primeiro,
 * sigla como fallback.
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

export function resolveUnidadeForEmbarque(produto, item = {}) {
  if (item?.produto_unidade_id) {
    const byId = getUnidadeByIdCanonical(produto, item.produto_unidade_id);
    if (byId) return { unidade: byId, found: true };
  }
  const sigla = normalizeUnitCode(item?.unidade_sigla || item?.unidade_medida);
  if (sigla) {
    const bySigla = getUnidadeBySiglaCanonical(produto, sigla);
    if (bySigla) return { unidade: bySigla, found: true };
  }
  const comercial = getUnidadeComercialCanonical(produto);
  if (comercial) return { unidade: comercial, found: false };
  return { unidade: getUnidadePrincipalCanonical(produto), found: false };
}

export function deriveEmbarqueItem({ embarque = {}, produto = {}, pedidoCompraItem = null, input = {} }) {
  const errors = [];
  if (!embarque?.id) errors.push("embarque_id obrigatorio");
  if (!produto?.id) errors.push("produto_id obrigatorio");

  const resolvido = resolveUnidadeForEmbarque(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;

  const qPedida = asNumber(input.quantidade_pedida_comercial ?? input.quantidade_pedida, 0);
  const qEmbarcada = asNumber(input.quantidade_embarcada_comercial ?? input.quantidade_embarcada, 0);
  const qRecebida = asNumber(input.quantidade_recebida_comercial ?? input.quantidade_recebida, 0);

  if (qEmbarcada <= 0) errors.push("quantidade_embarcada_comercial deve ser > 0");

  const item = {
    embarque_id: embarque?.id || "",
    embarque_numero: embarque?.numero || "",
    pedido_compra_id: embarque?.pedido_compra_id || pedidoCompraItem?.pedido_compra_id || "",
    pedido_compra_item_id: pedidoCompraItem?.id || input?.pedido_compra_item_id || "",
    produto_id: produto?.id || "",
    produto_nome: produto?.nome || input?.produto_nome || "",
    produto_unidade_id: u?.id || "",
    unidade_sigla: normalizeUnitCode(u?.sigla) || "UN",
    fator_aplicado: fator,
    quantidade_pedida_comercial: round6(qPedida),
    quantidade_pedida_base: round6(qPedida * fator),
    quantidade_embarcada_comercial: round6(qEmbarcada),
    quantidade_embarcada_base: round6(qEmbarcada * fator),
    quantidade_recebida_comercial: round6(qRecebida),
    quantidade_recebida_base: round6(qRecebida * fator),
    divergencia_tipo: input?.divergencia_tipo || "Nenhuma",
    produto_id_recebido_diferente: typeof input?.produto_id_recebido_diferente === "string" ? input.produto_id_recebido_diferente : "",
    produto_nome_recebido_diferente: typeof input?.produto_nome_recebido_diferente === "string" ? input.produto_nome_recebido_diferente : "",
    acordo_financeiro_lancamento_id: typeof input?.acordo_financeiro_lancamento_id === "string" ? input.acordo_financeiro_lancamento_id : "",
    ordem: asNumber(input?.ordem, 0),
    observacoes: typeof input?.observacoes === "string" ? input.observacoes : "",
  };

  return { item, valid: errors.length === 0, errors };
}

export function embarqueItemToLegacyMirror(item = {}) {
  return {
    produto_id: item?.produto_id || "",
    produto_nome: item?.produto_nome || "",
    produto_unidade_id: item?.produto_unidade_id || "",
    pedido_compra_item_id: item?.pedido_compra_item_id || "",
    fator_aplicado: asNumber(item?.fator_aplicado, 0) || undefined,
    quantidade_pedida: asNumber(item?.quantidade_pedida_comercial, 0),
    quantidade_embarcada: asNumber(item?.quantidade_embarcada_comercial, 0),
    quantidade_recebida: asNumber(item?.quantidade_recebida_comercial, 0),
    quantidade_pedida_base: asNumber(item?.quantidade_pedida_base, 0) || undefined,
    quantidade_embarcada_base: asNumber(item?.quantidade_embarcada_base, 0) || undefined,
    quantidade_recebida_base: asNumber(item?.quantidade_recebida_base, 0) || undefined,
    unidade_medida: item?.unidade_sigla || "UN",
    divergencia_tipo: item?.divergencia_tipo || "Nenhuma",
    produto_id_recebido_diferente: item?.produto_id_recebido_diferente || "",
    produto_nome_recebido_diferente: item?.produto_nome_recebido_diferente || "",
    acordo_financeiro_lancamento_id: item?.acordo_financeiro_lancamento_id || "",
    embarque_item_id: item?.id || undefined,
  };
}

export function rebuildEmbarqueItensMirror(items = []) {
  return (Array.isArray(items) ? items : []).map(embarqueItemToLegacyMirror);
}
