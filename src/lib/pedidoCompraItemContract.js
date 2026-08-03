/* ============================================================================
 * pedidoCompraItemContract.js
 *
 * Contrato canonico para uma linha de PedidoCompraItem.
 *
 * Um item canonico tem como CHAVE DA VERDADE o `produto_unidade_id` — um id
 * estavel apontando pra uma unidade dentro de `Produto.unidades[]`. Tudo derive
 * dele:
 *   - sigla, fator_conversao e fator_preco viram snapshots do produto
 *   - quantidade_base = quantidade_comercial x fator_aplicado
 *   - custo_unitario_comercial = custo_unitario_fator1 x fator_aplicado (apenas display)
 *   - Na persistência, custo_unitario_fator1 é o valor líquido (bruto − desconto + avaria)
 *   - custo_total_unitario_fator1 = custo líquido + frete + outros
 *   - total = quantidade_base x custo_total_unitario_fator1
 *
 * Sem regex, sem heuristica, sem "adivinhar" — o id e a unica fonte. Se o id
 * nao for fornecido, fallback explicito tenta resolver pela sigla legada e
 * marca a linha com `legacy_resolution: true` pra auditoria.
 * ============================================================================ */

import {
  getUnidadeByIdCanonical,
  getUnidadeBySiglaCanonical,
  getUnidadeComercialCanonical,
  getUnidadePrincipalCanonical,
  normalizeUnitCode,
  normalizePedidoCompraItemCustoLiquidoParaPersist,
} from "./productUnits";

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Resolve a unidade canonica de uma linha de pedido.
 *
 * Prioridade:
 *   1. `produto_unidade_id` (chave da verdade)
 *   2. `unidade_sigla` ou `unidade_medida` -> match por sigla no produto
 *   3. unidade comercial padrao do produto
 *   4. unidade principal (fator-1)
 *
 * @returns {{ unidade: object, source: string, found: boolean }}
 */
export function resolveUnidadeForItem(produto, item = {}) {
  if (item?.produto_unidade_id) {
    const byId = getUnidadeByIdCanonical(produto, item.produto_unidade_id);
    if (byId) return { unidade: byId, source: "produto_unidade_id", found: true };
  }
  const siglaCandidata = normalizeUnitCode(item?.unidade_sigla || item?.unidade_medida);
  if (siglaCandidata) {
    const bySigla = getUnidadeBySiglaCanonical(produto, siglaCandidata);
    if (bySigla) return { unidade: bySigla, source: "sigla_match", found: true };
  }
  const comercial = getUnidadeComercialCanonical(produto);
  if (comercial) return { unidade: comercial, source: "comercial_default", found: false };
  const principal = getUnidadePrincipalCanonical(produto);
  return { unidade: principal, source: "principal_fallback", found: false };
}

/**
 * Constroi um PedidoCompraItem canonico a partir dos inputs do form.
 *
 * @param {object} args
 * @param {object} args.pedido        - Pedido pai (para snapshot de numero/id)
 * @param {object} args.produto       - Produto canonico (com unidades[])
 * @param {object} args.input         - Inputs brutos (produto_unidade_id ou sigla, quantidade_comercial, custo_unitario_fator1, frete, outros, desconto)
 *
 * @returns {{ item: object, valid: boolean, errors: string[] }}
 */
export function derivePedidoCompraItem({ pedido = {}, produto = {}, input = {} }) {
  const errors = [];

  if (!produto?.id) errors.push("produto_id obrigatorio");
  if (!pedido?.id) errors.push("pedido_compra_id obrigatorio");

  const resolvido = resolveUnidadeForItem(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const unidade = resolvido.unidade;
  const fator = asNumber(unidade?.fator_conversao, 1) || 1;
  const fatorPreco = asNumber(unidade?.fator_preco, 1) || 1;

  const quantidadeComercial = asNumber(input.quantidade_comercial ?? input.quantidade, 0);
  if (quantidadeComercial <= 0) errors.push("quantidade_comercial deve ser > 0");

  const quantidadeBase = round6(quantidadeComercial * fator);

  const custoUnitarioFator1 = asNumber(
    input.custo_unitario_fator1 ?? input.custo_unitario,
    0
  );
  if (custoUnitarioFator1 < 0) errors.push("custo_unitario_fator1 nao pode ser negativo");

  const freteFator1 = asNumber(input.frete_unitario_fator1 ?? input.custo_frete_unitario, 0);
  const outrosFator1 = asNumber(input.outros_unitario_fator1 ?? input.custo_outros_unitario, 0);
  const descontoFator1 = asNumber(input.desconto_unitario_fator1 ?? input.desconto_unitario, 0);

  const custoTotalUnitFator1 = round6(custoUnitarioFator1 + freteFator1 + outrosFator1 - descontoFator1);
  const total = round6(quantidadeBase * custoTotalUnitFator1);

  const itemBruto = {
    pedido_compra_id: pedido?.id || "",
    pedido_compra_numero: pedido?.numero || "",
    produto_id: produto?.id || "",
    produto_nome: produto?.nome || "",
    produto_unidade_id: unidade?.id || "",
    unidade_sigla: normalizeUnitCode(unidade?.sigla) || "UN",
    fator_aplicado: fator,
    fator_preco_aplicado: fatorPreco,
    quantidade_comercial: round6(quantidadeComercial),
    quantidade_base: quantidadeBase,
    custo_unitario_fator1: round6(custoUnitarioFator1),
    custo_unitario_comercial: round6(custoUnitarioFator1 * fator),
    frete_unitario_fator1: round6(freteFator1),
    outros_unitario_fator1: round6(outrosFator1),
    desconto_unitario_fator1: round6(descontoFator1),
    custo_total_unitario_fator1: custoTotalUnitFator1,
    total,
    quantidade_vinculada: asNumber(input.quantidade_vinculada, 0),
    ordem: asNumber(input.ordem, 0),
    observacoes: typeof input.observacoes === "string" ? input.observacoes : "",
    status_recebimento: input.status_recebimento || "Pendente",
  };

  const item = normalizePedidoCompraItemCustoLiquidoParaPersist(itemBruto);

  return { item, valid: errors.length === 0, errors };
}

/**
 * Converte um PedidoCompraItem canonico pro formato legado de
 * `PedidoCompra.itens[]` (espelho de leitura). Esse formato e o que telas e
 * relatorios antigos consomem hoje.
 */
export function pedidoCompraItemToLegacyMirror(item = {}) {
  const fator = asNumber(item?.fator_aplicado, 1) || 1;
  return {
    produto_id: item?.produto_id || "",
    produto_nome: item?.produto_nome || "",
    produto_unidade_id: item?.produto_unidade_id || "",
    quantidade: asNumber(item?.quantidade_comercial, 0),
    unidade_medida: item?.unidade_sigla || "UN",
    fator_conversao: fator,
    quantidade_base: asNumber(item?.quantidade_base, 0),
    quantidade_vinculada: asNumber(item?.quantidade_vinculada, 0),
    custo_unitario: asNumber(item?.custo_unitario_fator1, 0),
    custo_final_unitario: asNumber(item?.custo_total_unitario_fator1, 0),
    custo_unitario_base: asNumber(item?.custo_unitario_fator1, 0),
    custo_final_unitario_base: asNumber(item?.custo_total_unitario_fator1, 0),
    custo_unitario_apresentacao: asNumber(item?.custo_unitario_comercial, 0),
    custo_final_unitario_apresentacao: round6(asNumber(item?.custo_total_unitario_fator1, 0) * fator),
    custo_frete_unitario: asNumber(item?.frete_unitario_fator1, 0),
    custo_outros_unitario: asNumber(item?.outros_unitario_fator1, 0),
    desconto_unitario: asNumber(item?.desconto_unitario_fator1, 0),
    total: asNumber(item?.total, 0),
    preco_eixo: "FATOR_1",
    unidade_apresentacao: item?.unidade_sigla || "UN",
    pedido_compra_item_id: item?.id || undefined,
  };
}

/**
 * Recompoe `PedidoCompra.itens[]` (espelho legado) a partir de uma lista de
 * PedidoCompraItem canonicos. Util pro save service apos cada mutacao.
 */
export function rebuildPedidoCompraItensMirror(items = []) {
  return (Array.isArray(items) ? items : []).map(pedidoCompraItemToLegacyMirror);
}

/**
 * Total agregado do pedido a partir das linhas canonicas.
 */
export function calcularValorTotalPedido(items = []) {
  return round6((Array.isArray(items) ? items : []).reduce((acc, it) => acc + asNumber(it?.total, 0), 0));
}
