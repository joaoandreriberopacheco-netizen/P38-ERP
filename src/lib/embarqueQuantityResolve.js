/**
 * Resolução canónica de quantidades em linhas de embarque.
 * UI = comercial (CX, PAC…); SQL/estoque = base (fator 1).
 */
import { calculateBaseQuantity, commercialQuantityFromBase } from './productUnits.js';

function asNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Fator da unidade comercial (ex.: 200 para CX de estribo). */
export function resolveEmbarqueLinhaFator(item = {}) {
  return (
    asNum(item.fator_apresentacao)
    ?? asNum(item.fator_aplicado)
    ?? asNum(item.fator_conversao)
    ?? 1
  );
}

/** Sigla comercial para UI (CX, PAC, UN…). */
export function resolveEmbarqueLinhaUnidade(item = {}) {
  return item.unidade_apresentacao || item.unidade_sigla || item.unidade_medida || 'UN';
}

function fieldNames(kind) {
  if (kind === 'pedida') {
    return {
      apresentacao: 'quantidade_pedida_apresentacao',
      comercial: 'quantidade_pedida_comercial',
      base: 'quantidade_pedida_base',
      legacy: 'quantidade_pedida',
    };
  }
  return {
    apresentacao: `quantidade_${kind}_apresentacao`,
    comercial: `quantidade_${kind}_comercial`,
    base: `quantidade_${kind}_base`,
    legacy: `quantidade_${kind}`,
  };
}

/**
 * Quantidade comercial para UI (o que o utilizador vê e digita).
 * @param {'embarcada'|'recebida'|'pedida'} kind
 */
export function resolveEmbarqueQuantidadeComercial(item = {}, kind = 'embarcada') {
  const f = fieldNames(kind);
  const apres = asNum(item[f.apresentacao]);
  if (apres != null && apres >= 0) return apres;

  const comSql = asNum(item[f.comercial]);
  if (comSql != null && comSql > 0) return comSql;

  const legacy = asNum(item[f.legacy]);
  const base = asNum(item[f.base]) ?? (kind === 'embarcada' ? asNum(item.quantidade_base) : null);
  const fator = resolveEmbarqueLinhaFator(item);
  const unidade = resolveEmbarqueLinhaUnidade(item);

  // Espelho SQL: legacy = comercial quando existe par base+legacy coerente
  if (legacy != null && legacy > 0) {
    if (base != null && base > 0) {
      const legacyAsBase = Math.abs(legacy * fator - base) < 1;
      const legacyAsCom = Math.abs(legacy - commercialQuantityFromBase(base, fator, unidade)) < 0.05;
      if (legacyAsCom || (!legacyAsBase && fator > 1)) return legacy;
      if (legacyAsBase) return commercialQuantityFromBase(base, fator, unidade);
    }
    // Sem base: em vitrine pré-gravação fator_conversao=1 guarda base em quantidade_embarcada
    if (kind !== 'pedida' && Number(item.fator_conversao) === 1 && item[f.apresentacao] == null) {
      return commercialQuantityFromBase(legacy, fator, unidade);
    }
    return legacy;
  }

  if (base != null && base > 0) {
    return commercialQuantityFromBase(base, fator, unidade);
  }

  return 0;
}

/**
 * Quantidade em unidade base (fator 1) — SQL, percentuais, movimentação de estoque.
 * @param {'embarcada'|'recebida'|'pedida'} kind
 */
export function resolveEmbarqueQuantidadeBase(item = {}, kind = 'embarcada') {
  const f = fieldNames(kind);
  const base = asNum(item[f.base]) ?? (kind === 'embarcada' ? asNum(item.quantidade_base) : null);
  if (base != null && base > 0) return base;

  const comercial = resolveEmbarqueQuantidadeComercial(item, kind);
  if (comercial <= 0) return 0;

  const fator = resolveEmbarqueLinhaFator(item);
  return calculateBaseQuantity(comercial, fator);
}
