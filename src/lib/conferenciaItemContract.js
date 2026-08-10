/* ============================================================================
 * conferenciaItemContract.js
 *
 * Contrato canonico para ConferenciaItem.
 *
 * Diferenca-chave: a quantidade contada e na unidade que o conferente
 * escolher (comercial ou principal), mas o canonico armazena tudo em fator-1
 * + a divergencia derivada vs `quantidade_sistema_base`. Isso permite ajuste
 * de estoque consistente independente da unidade usada na contagem.
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

export function resolveUnidadeForConferencia(produto, item = {}) {
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

export function deriveConferenciaItem({ conferencia = {}, produto = {}, input = {} }) {
  const errors = [];
  if (!conferencia?.id) errors.push("conferencia_id obrigatorio");
  if (!produto?.id) errors.push("produto_id obrigatorio");

  const resolvido = resolveUnidadeForConferencia(produto, input);
  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;

  const qContadaComercial = asNumber(input?.quantidade_contada_comercial ?? input?.quantidade_contada, 0);
  if (qContadaComercial < 0) errors.push("quantidade_contada nao pode ser negativa");
  const qContadaBase = round6(qContadaComercial * fator);

  const qSistemaBase = asNumber(input?.quantidade_sistema_base ?? produto?.estoque_atual, 0);

  const divergencia = round6(qContadaBase - qSistemaBase);
  let sinal = "zero";
  if (divergencia > 1e-6) sinal = "positivo";
  else if (divergencia < -1e-6) sinal = "negativo";

  const item = {
    conferencia_id: conferencia?.id || "",
    conferencia_nome: conferencia?.nome_conferencia || "",
    produto_id: produto?.id || "",
    produto_nome: produto?.nome || input?.produto_nome || "",
    produto_unidade_id: u?.id || "",
    unidade_sigla: normalizeUnitCode(u?.sigla) || "UN",
    fator_aplicado: fator,
    quantidade_sistema_base: round6(qSistemaBase),
    quantidade_contada_comercial: round6(qContadaComercial),
    quantidade_contada_base: qContadaBase,
    divergencia_base: divergencia,
    divergencia_sinal: sinal,
    ordem: asNumber(input?.ordem, 0),
    observacoes: typeof input?.observacoes === "string" ? input.observacoes : "",
  };

  return { item, valid: errors.length === 0, errors };
}

export function conferenciaItemToLegacyMirror(item = {}) {
  return {
    produto_id: item?.produto_id || "",
    produto_nome: item?.produto_nome || "",
    quantidade_contada: asNumber(item?.quantidade_contada_base, 0),
    conferencia_item_id: item?.id || undefined,
  };
}

/** Linha SQL → entrada compatível com inventoryCountUnits / UI de contagem. */
export function conferenciaItemRowToCountEntry(row = {}) {
  const fator = asNumber(row?.fator_aplicado, 1) || 1;
  const qComercial = asNumber(row?.quantidade_contada_comercial, 0);
  const qBase = asNumber(row?.quantidade_contada_base, 0);
  const unidade = normalizeUnitCode(row?.unidade_sigla) || "UN";

  return {
    produto_id: row?.produto_id || "",
    produto_nome: row?.produto_nome || "",
    quantidade_contada: qBase,
    quantidade_contada_comercial: qComercial,
    quantidade_contada_base: qBase,
    quantidade_base: qBase,
    unidade_medida: unidade,
    unidade_sigla: unidade,
    produto_unidade_id: row?.produto_unidade_id || "",
    fator_conversao: fator,
    conferencia_item_id: row?.id || undefined,
  };
}

export function rebuildConferenciaItensMirror(items = []) {
  return (Array.isArray(items) ? items : []).map(conferenciaItemToLegacyMirror);
}
