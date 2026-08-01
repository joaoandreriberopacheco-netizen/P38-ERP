import { roundToTwoDecimals } from "@/lib/financialUtils";

export function hasAlternativeUnits(product) {
  return Array.isArray(product?.unidades_alternativas) && product.unidades_alternativas.some((item) => item?.unidade && item.ativo !== false);
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeUnitCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/²/g, "2")
    .replace(/\s/g, "");
}

const MAX_ALTERNATIVE_UNITS = 5;

function newAlternativeUnitId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAlternativeUnitRow(item = {}) {
  const unidade = String(item.unidade || "").trim().toUpperCase();
  const fatorConversao = normalizeNumber(item.fator_conversao, 1);
  const ajustePercentual = normalizeNumber(item.ajuste_percentual, 0);
  const fatorPrecoRaw = normalizeNumber(item.fator_preco, 0);
  const row = {
    id: String(item.id || "").trim() || newAlternativeUnitId(),
    nome: typeof item.nome === "string" ? item.nome.trim() : "",
    unidade,
    fator_conversao: fatorConversao,
    fator_preco: fatorPrecoRaw > 0 ? fatorPrecoRaw : (1 + (ajustePercentual / 100)),
    preco_venda: normalizeNumber(item.preco_venda, 0),
    rotulo: typeof item.rotulo === "string" ? item.rotulo.trim() : (item.rotulo_comercial ? String(item.rotulo_comercial).trim() : ""),
    ajuste_percentual: ajustePercentual,
    ativo: item.ativo !== false,
  };
  if (
    Object.prototype.hasOwnProperty.call(item, "percentual_preco_vs_principal") &&
    item.percentual_preco_vs_principal != null &&
    item.percentual_preco_vs_principal !== ""
  ) {
    row.percentual_preco_vs_principal = normalizeNumber(item.percentual_preco_vs_principal, 0);
  }
  return row;
}

export function isShowUnitEnabled(product) {
  if (typeof product?.unidade_show_ativa === "boolean") return product.unidade_show_ativa;
  return true;
}

export function normalizeAlternativeUnits(product) {
  return (Array.isArray(product?.unidades_alternativas) ? product.unidades_alternativas : [])
    .slice(0, MAX_ALTERNATIVE_UNITS)
    .filter((item) => item?.unidade && item.ativo !== false)
    .map((item) => normalizeAlternativeUnitRow(item));
}

/** Unidade base (fator 1): preferir alternativa com fator 1 (legado); senão `unidade_principal` (contrato Emb.1 / formulário). */
export function resolvePrimaryFromFactorOne(product, fallbackUnit = "UN") {
  const alternativas = normalizeAlternativeUnits(product);
  const fatorUm = alternativas.filter((item) => normalizeNumber(item.fator_conversao, 0) === 1);
  const principalAtual = normalizeUnitCode(product?.unidade_principal);

  if (fatorUm.length === 1) return fatorUm[0].unidade;
  if (fatorUm.length > 1) {
    const matchAtual = fatorUm.find((item) => item.unidade === principalAtual);
    return (matchAtual?.unidade || fatorUm[0].unidade);
  }

  return principalAtual || normalizeUnitCode(fallbackUnit) || "UN";
}

export function buildLegacyUnitBackfillPatch(product) {
  const alternativas = normalizeAlternativeUnits(product);
  const fatorUm = alternativas.filter((item) => normalizeNumber(item?.fator_conversao, 0) === 1);
  if (fatorUm.length !== 1) {
    return {
      hasChanges: false,
      conflict: true,
      reason: fatorUm.length === 0 ? "missing_factor_one" : "multiple_factor_one",
      patch: null,
    };
  }

  const principal = normalizeUnitCode(fatorUm[0].unidade || product?.unidade_principal || "UN") || "UN";
  const validUnits = new Set([principal, ...alternativas.map((item) => normalizeUnitCode(item?.unidade)).filter(Boolean)]);
  const showLogisticoLegado = normalizeUnitCode(product?.unidade_show_logistica);
  // Regra de tradução legada: quando há fator 1 intencional, ele substitui a unidade legada.
  const pdvResolvida = principal;
  const showComercialResolvida = pdvResolvida;
  const showLogisticoResolvida = validUnits.has(showLogisticoLegado) ? showLogisticoLegado : pdvResolvida;

  const patch = {
    unidade_principal: principal,
    unidade_apresentacao_default: pdvResolvida,
    unidade_show_comercial: showComercialResolvida,
    unidade_show_logistica: showLogisticoResolvida,
    migracao_unidades_legacy_v2: true,
    migracao_unidades_data: new Date().toISOString(),
  };

  const hasChanges =
    normalizeUnitCode(product?.unidade_principal) !== patch.unidade_principal ||
    normalizeUnitCode(product?.unidade_apresentacao_default) !== patch.unidade_apresentacao_default ||
    normalizeUnitCode(product?.unidade_show_comercial) !== patch.unidade_show_comercial ||
    normalizeUnitCode(product?.unidade_show_logistica) !== patch.unidade_show_logistica ||
    product?.migracao_unidades_legacy_v2 !== true;

  return {
    hasChanges,
    conflict: false,
    reason: hasChanges ? "needs_update" : "already_consistent",
    patch: hasChanges ? patch : null,
  };
}

function dedupeUnits(units) {
  const seen = new Set();
  return units.filter((item) => {
    const key = item.unidade;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getItemUnitKey(produtoId, unidadeMedida) {
  return `${produtoId || "sem-produto"}::${(unidadeMedida || "UN").toUpperCase()}`;
}

function saleUnitPriceFromAlternative(precoBase, item, priceMultiplier) {
  const mult = normalizeNumber(priceMultiplier, 1);
  const fator = normalizeNumber(item.fator_conversao, 1);
  if (normalizeNumber(item.preco_venda, 0) > 0) {
    return normalizeNumber(item.preco_venda, 0) * mult;
  }
  if (
    Object.prototype.hasOwnProperty.call(item, "percentual_preco_vs_principal") &&
    item.percentual_preco_vs_principal != null &&
    item.percentual_preco_vs_principal !== ""
  ) {
    const pct = normalizeNumber(item.percentual_preco_vs_principal, 0);
    return precoBase * fator * (1 + pct / 100) * mult;
  }
  const fatorPreco = normalizeNumber(item.fator_preco, 0);
  const adj = normalizeNumber(item.ajuste_percentual, 0);
  const derived = 1 + adj / 100;
  if (fatorPreco > 0 && Math.abs(fatorPreco - derived) < 0.0001) {
    return precoBase * fator * derived * mult;
  }
  if (fatorPreco > 0) return precoBase * fator * fatorPreco * mult;
  return precoBase * fator * derived * mult;
}

export function buildSaleUnitOptions(product, priceMultiplier = 1) {
  const unidadePrincipal = resolvePrimaryFromFactorOne(product, "UN");
  const precoBase = normalizeNumber(product?.preco_venda_padrao, 0);
  const principal = {
    id: "primary",
    nome: "Unidade base",
    unidade: unidadePrincipal,
    fator_conversao: 1,
    valor_unitario: precoBase * normalizeNumber(priceMultiplier, 1),
    is_primary: true,
  };

  const alternatives = normalizeAlternativeUnits(product).map((item) => ({
    id: item.id,
    nome: item.nome || item.rotulo || item.unidade,
    unidade: item.unidade,
    fator_conversao: item.fator_conversao,
    valor_unitario: saleUnitPriceFromAlternative(precoBase, item, priceMultiplier),
    is_primary: false,
    rotulo: item.rotulo || "",
    ajuste_percentual: item.ajuste_percentual,
    fator_preco: item.fator_preco,
    ...(Object.prototype.hasOwnProperty.call(item, "percentual_preco_vs_principal") &&
    item.percentual_preco_vs_principal != null &&
    item.percentual_preco_vs_principal !== ""
      ? { percentual_preco_vs_principal: normalizeNumber(item.percentual_preco_vs_principal, 0) }
      : {}),
  }));

  return dedupeUnits([principal, ...alternatives]);
}

/**
 * Sigla de vitrine gravada no produto (`unidade_vitrine`), com leitura legada única.
 * Vazio/null/ inválido → unidade principal (fator-1).
 */
export function resolveVitrineSigla(product, fallbackUnit = "UN") {
  const options = buildSaleUnitOptions(product);
  const principalResolvida = resolvePrimaryFromFactorOne(product, options[0]?.unidade || fallbackUnit);
  const principalNorm = normalizeUnitCode(principalResolvida) || normalizeUnitCode(fallbackUnit) || "UN";
  const validBySigla = new Map(options.map((o) => [o.unidade, o]));

  const vitrineCanon = normalizeUnitCode(product?.unidade_vitrine);
  if (vitrineCanon && validBySigla.has(vitrineCanon)) return vitrineCanon;

  const comercialId = String(product?.unidade_comercial_id || "").trim();
  if (comercialId) {
    const byId = options.find((o) => String(o.id || "") === comercialId);
    if (byId?.unidade && validBySigla.has(byId.unidade)) return byId.unidade;
  }

  for (const pref of [product?.unidade_apresentacao_default, product?.unidade_show_comercial]) {
    const normalized = normalizeUnitCode(pref);
    if (normalized && validBySigla.has(normalized)) return normalized;
  }

  return principalNorm;
}

/**
 * Fonte única: qual embalagem o catálogo, PDV e relatórios exibem.
 * Prioridade: `unidade_vitrine` → legado (uma vez) → unidade principal (fator-1).
 */
export function resolveUnidadeExibicao(product, fallbackUnit = "UN") {
  const options = buildSaleUnitOptions(product);
  const principalResolvida = resolvePrimaryFromFactorOne(product, options[0]?.unidade || fallbackUnit);
  const fallbackSigla = normalizeUnitCode(fallbackUnit) || "UN";

  if (!options.length) {
    return {
      sigla: principalResolvida || fallbackSigla,
      id: "primary",
      option: null,
      vitrineAtiva: isShowUnitEnabled(product),
    };
  }

  if (!isShowUnitEnabled(product)) {
    const principalOpt =
      options.find((o) => o.unidade === principalResolvida) ||
      options.find((o) => o.is_primary) ||
      options[0];
    return {
      sigla: principalResolvida || principalOpt?.unidade || fallbackSigla,
      id: principalOpt?.id || "primary",
      option: principalOpt || null,
      vitrineAtiva: false,
    };
  }

  const validBySigla = new Map(options.map((o) => [o.unidade, o]));
  const sigla = resolveVitrineSigla(product, fallbackUnit);
  const opt = validBySigla.get(sigla);
  if (opt) {
    return {
      sigla,
      id: opt.id || (opt.is_primary ? "primary" : sigla),
      option: opt,
      vitrineAtiva: true,
    };
  }

  const principalNorm = normalizeUnitCode(principalResolvida);
  const principalOpt =
    validBySigla.get(principalNorm) ||
    options.find((o) => o.is_primary) ||
    options[0];
  return {
    sigla: principalOpt?.unidade || principalNorm || fallbackSigla,
    id: principalOpt?.id || "primary",
    option: principalOpt || null,
    vitrineAtiva: true,
  };
}

/**
 * Sigla da unidade em que a venda foi registrada (linha do pedido), para cupom/comprovante.
 * Prioriza a unidade comercial da linha; `unidade_principal` só como último recurso (legado).
 */
export function getUnidadeMedidaItemPedidoVenda(item = {}, fallbackUnit = "UN") {
  const raw =
    item?.unidade_medida ||
    item?.unidade_apresentacao ||
    item?.unidade_sigla ||
    item?.unidade ||
    item?.unidade_principal;
  return normalizeUnitCode(raw) || normalizeUnitCode(fallbackUnit) || "UN";
}

export function getUnidadeExibicaoSigla(product, fallbackUnit = "UN") {
  return resolveUnidadeExibicao(product, fallbackUnit).sigla;
}

export function getUnidadeExibicaoId(product, fallbackUnit = "UN") {
  return resolveUnidadeExibicao(product, fallbackUnit).id;
}

/**
 * Sigla da «estação de venda» no formulário (`unidade_exibicao_sigla`).
 * Vazio = unidade principal (fator 1). Independente de `unidade_vitrine` (catálogo/PDV).
 */
export function resolvePricingDisplaySigla(product, fallbackUnit = "UN") {
  const principal = resolvePrimaryFromFactorOne(product, fallbackUnit);
  const principalNorm = normalizeUnitCode(principal) || "UN";
  if (product && Object.prototype.hasOwnProperty.call(product, "unidade_exibicao_sigla")) {
    const ex = normalizeUnitCode(product.unidade_exibicao_sigla);
    return ex && ex !== principalNorm ? ex : principalNorm;
  }
  if (!isShowUnitEnabled(product)) return principalNorm;
  return normalizeUnitCode(resolveVitrineSigla(product, principalNorm)) || principalNorm;
}

export function pickDefaultSaleUnit(product, priceMultiplier = 1) {
  const options = buildSaleUnitOptions(product, priceMultiplier);
  if (!options.length) return null;
  const principalResolvida = resolvePrimaryFromFactorOne(product, options[0]?.unidade || "UN");

  if (product && Object.prototype.hasOwnProperty.call(product, "unidade_exibicao_sigla")) {
    const exibicao = normalizeUnitCode(product.unidade_exibicao_sigla);
    if (exibicao) {
      const match = options.find((o) => normalizeUnitCode(o.unidade) === exibicao);
      if (match) return match;
    }
    const principal = options.find((o) => o.unidade === principalResolvida);
    if (principal) return principal;
    return options[0] || null;
  }

  const exib = resolveUnidadeExibicao(product, options[0]?.unidade || "UN");
  const match = options.find((o) => o.unidade === exib.sigla);
  if (match) return match;
  return options.find((o) => o.is_primary) || options[0] || null;
}

/**
 * Snapshot para precificação no formulário: `precoVendaBaseEfectivo` é o preço por unidade base (fator 1),
 * já com markup percentual aplicado quando o formulário está em modo %.
 */
export function buildProductSnapshotForPricing(formData, precoVendaBaseEfectivo) {
  const principal = normalizeUnitCode(formData?.unidade_principal || "UN") || "UN";
  return {
    preco_venda_padrao: normalizeNumber(precoVendaBaseEfectivo, 0),
    unidade_principal: principal,
    unidade_exibicao_sigla: formData?.unidade_exibicao_sigla ?? "",
    unidades_alternativas: Array.isArray(formData?.unidades_alternativas) ? formData.unidades_alternativas : [],
  };
}

/** Preço unitário na embalagem de vitrine (ou na principal por defeito). */
export function getPrecoVendaNaUnidadeCatalogo(product, priceMultiplier = 1) {
  const unit = pickDefaultSaleUnit(product, priceMultiplier);
  const principal = resolvePrimaryFromFactorOne(product, unit?.unidade || "UN");
  if (!unit) {
    return {
      sigla: principal,
      valor: 0,
      isPrincipal: true,
    };
  }
  return {
    sigla: unit.unidade,
    valor: normalizeNumber(unit.valor_unitario, 0),
    isPrincipal: Boolean(unit.is_primary) || normalizeUnitCode(unit.unidade) === principal,
  };
}

/**
 * Converte um valor introduzido «por embalagem de vitrine» para `preco_venda_padrao` (base).
 * Se a embalagem usa preço fixo, devolve instrução para actualizar `preco_venda` na linha.
 *
 * @returns {number | { kind: 'fixed_packaging', sigla: string, preco_venda: number }}
 */
export function precoVendaPadraoFromPrecoCatalogo(precoDisplay, product, priceMultiplier = 1) {
  const principal = resolvePrimaryFromFactorOne(product);
  const exib =
    product && Object.prototype.hasOwnProperty.call(product, "unidade_exibicao_sigla")
      ? normalizeUnitCode(product.unidade_exibicao_sigla)
      : normalizeUnitCode(resolveVitrineSigla(product, principal));
  const v = normalizeNumber(precoDisplay, 0);
  const mult = normalizeNumber(priceMultiplier, 1);

  if (!exib || exib === principal) {
    return mult > 0 ? v / mult : v;
  }

  const alts = normalizeAlternativeUnits(product);
  const alt = alts.find((u) => normalizeUnitCode(u.unidade) === exib);
  if (!alt) {
    return mult > 0 ? v / mult : v;
  }

  if (normalizeNumber(alt.preco_venda, 0) > 0) {
    return {
      kind: "fixed_packaging",
      sigla: exib,
      preco_venda: mult > 0 ? v / mult : v,
    };
  }

  const fator = normalizeNumber(alt.fator_conversao, 1);
  const pct = normalizeNumber(alt.percentual_preco_vs_principal, 0);
  const fatorPreco = normalizeNumber(alt.fator_preco, 0);
  const adj = normalizeNumber(alt.ajuste_percentual, 0);
  const derived = 1 + adj / 100;
  let denom;
  if (pct !== 0 || Object.prototype.hasOwnProperty.call(alt, "percentual_preco_vs_principal")) {
    denom = fator * (1 + pct / 100) * mult;
  } else if (fatorPreco > 0 && Math.abs(fatorPreco - derived) < 0.0001) {
    denom = fator * derived * mult;
  } else if (fatorPreco > 0) {
    denom = fator * fatorPreco * mult;
  } else {
    denom = fator * derived * mult;
  }
  if (denom <= 0) return normalizeNumber(product?.preco_venda_padrao, 0);
  return v / denom;
}

/** @deprecated Prefer `getUnidadeExibicaoSigla` — mantido como alias estável. */
export function resolveCommercialUnit(product, fallbackUnit = "UN") {
  const options = buildSaleUnitOptions(product);
  if (!options.length) return normalizeUnitCode(fallbackUnit) || "UN";
  const principalResolvida = resolvePrimaryFromFactorOne(product, options[0]?.unidade || fallbackUnit);
  const validUnits = new Set(options.map((option) => option.unidade));
  const exibicaoCatalogo = normalizeUnitCode(product?.unidade_exibicao_sigla);
  if (exibicaoCatalogo && validUnits.has(exibicaoCatalogo)) return exibicaoCatalogo;
  return getUnidadeExibicaoSigla(product, fallbackUnit);
}

export function buildPurchaseUnitOptions(product) {
  const unidadePrincipal = resolvePrimaryFromFactorOne(product, "UN");
  const custoBase = normalizeNumber(product?.valor_compra, 0);
  const principal = {
    id: "primary",
    nome: "Unidade base",
    unidade: unidadePrincipal,
    fator_conversao: 1,
    valor_unitario: custoBase,
    is_primary: true,
  };

  const alternatives = normalizeAlternativeUnits(product).map((item) => {
    const f = normalizeNumber(item.fator_conversao, 1);
    let valor;
    if (
      Object.prototype.hasOwnProperty.call(item, "percentual_preco_vs_principal") &&
      item.percentual_preco_vs_principal != null &&
      item.percentual_preco_vs_principal !== ""
    ) {
      const pct = normalizeNumber(item.percentual_preco_vs_principal, 0);
      valor = custoBase * f * (1 + pct / 100);
    } else {
      const fp = normalizeNumber(item.fator_preco, 1) || 1;
      const adj = normalizeNumber(item.ajuste_percentual, 0);
      const derived = 1 + adj / 100;
      valor = Math.abs(fp - derived) < 0.0001 ? custoBase * f * derived : custoBase * f * fp;
    }
    return {
      id: item.id,
      nome: item.nome || item.rotulo || item.unidade,
      unidade: item.unidade,
      fator_conversao: item.fator_conversao,
      valor_unitario: valor,
      is_primary: false,
      rotulo: item.rotulo || "",
      fator_preco: item.fator_preco,
      ...(Object.prototype.hasOwnProperty.call(item, "percentual_preco_vs_principal") &&
      item.percentual_preco_vs_principal != null &&
      item.percentual_preco_vs_principal !== ""
        ? { percentual_preco_vs_principal: normalizeNumber(item.percentual_preco_vs_principal, 0) }
        : {}),
    };
  });

  return dedupeUnits([principal, ...alternatives]);
}

export function pickDefaultPurchaseUnit(product) {
  const options = buildPurchaseUnitOptions(product);
  if (!options.length) return null;
  const exib = resolveUnidadeExibicao(product, options[0]?.unidade || "UN");
  const match = options.find((o) => o.unidade === exib.sigla);
  if (match) return match;
  return options.find((o) => o.is_primary) || options[0] || null;
}

/** Custo total por unidade base (catálogo / TreeGrid). */
export function resolveCustoTotalUnitBaseProduto(p) {
  const salvo = normalizeNumber(p?.preco_custo_calculado, 0);
  if (salvo > 0) return salvo;
  return (
    normalizeNumber(p?.valor_compra, 0) +
    normalizeNumber(p?.custo_frete_padrao, 0) +
    normalizeNumber(p?.custo_imposto1_padrao, 0) +
    normalizeNumber(p?.custo_imposto2_padrao, 0) +
    normalizeNumber(p?.custo_outros_padrao, 0) -
    normalizeNumber(p?.desconto_compra_padrao, 0)
  );
}

/**
 * Escala de custo na unidade da estação de precificação (`unidade_exibicao_sigla`)
 * ou, fora do formulário, na vitrine activa — mesma base que `buildPurchaseUnitOptions`.
 */
export function custoDisplayScale(product) {
  const principal = resolvePrimaryFromFactorOne(product);
  const exibNorm = normalizeUnitCode(resolvePricingDisplaySigla(product, principal));
  const principalNorm = normalizeUnitCode(principal);
  if (!exibNorm || exibNorm === principalNorm) return 1;

  const options = buildPurchaseUnitOptions(product);
  const base = options.find((o) => o.is_primary) || options[0];
  const pack = options.find((o) => normalizeUnitCode(o.unidade) === exibNorm);
  if (!pack || pack.is_primary || !base) return 1;

  const custoBase = normalizeNumber(base.valor_unitario, 0);
  const custoPack = normalizeNumber(pack.valor_unitario, 0);
  if (custoBase > 0) return custoPack / custoBase;

  const f = normalizeNumber(pack.fator_conversao, 1);
  return f > 0 ? f : 1;
}

/**
 * Preço de venda, custo e margens na embalagem comercial (alinha catálogo ao A29 / PDV).
 */
export function getCatalogoComercialView(produto) {
  const exib = resolveUnidadeExibicao(produto);
  const sale = pickDefaultSaleUnit(produto, 1);
  const siglaComercial = normalizeUnitCode(sale?.unidade || exib.sigla || produto?.unidade_principal || "UN");
  const precoVenda = normalizeNumber(sale?.valor_unitario, normalizeNumber(produto?.preco_venda_padrao, 0));

  const custoUnitBase = resolveCustoTotalUnitBaseProduto(produto);
  const custoScale = custoDisplayScale(produto);
  const custoNaEmbalagem = custoUnitBase * custoScale;

  const vcBase = normalizeNumber(produto?.valor_compra, 0);
  const valorCompraNaEmbalagem = vcBase * custoScale;

  const options = buildSaleUnitOptions(produto);
  const rowAtivo =
    options.find((o) => normalizeUnitCode(o.unidade) === siglaComercial) ||
    options.find((o) => o.is_primary) ||
    options[0];

  let margemContribuicaoPct = 0;
  let markupSobreCustoPct = 0;
  if (precoVenda > 0) {
    if (custoNaEmbalagem >= 0) {
      margemContribuicaoPct = ((precoVenda - custoNaEmbalagem) / precoVenda) * 100;
    }
    if (custoNaEmbalagem > 0) {
      markupSobreCustoPct = ((precoVenda - custoNaEmbalagem) / custoNaEmbalagem) * 100;
    }
  }

  return {
    sigla: siglaComercial,
    precoVenda,
    custoNaEmbalagem,
    valorCompraNaEmbalagem,
    custoUnitBase,
    fatorEmbalagem: custoScale,
    margemContribuicaoPct,
    markupSobreCustoPct,
    rotuloUnidade: rowAtivo?.nome || rowAtivo?.rotulo || "",
  };
}

export function calculateBaseQuantity(quantity, fatorConversao = 1) {
  return normalizeNumber(quantity, 0) * normalizeNumber(fatorConversao, 1);
}

/**
 * Quantidade em unidade base (fator-1) a partir do que o utilizador vê na unidade atual.
 * A conversão M²↔CX deve partir de quantidade×fator da unidade em edição, não de
 * `quantidade_base` possivelmente desatualizada (ex.: 205,4 m² presos de 79 CX antigos).
 */
export function resolveEffectiveQuantidadeBase(item = {}) {
  const qty = normalizeNumber(item.quantidade, 0);
  const fator = normalizeNumber(item.fator_conversao, 1) || 1;
  return calculateBaseQuantity(qty, fator);
}

/** Alinha qty comercial e base ao carregar linha do pedido (espelho Base44). */
export function syncPedidoCompraItemQuantities(item = {}) {
  const fator = normalizeNumber(item.fator_conversao, 1) || 1;
  const unit = item.unidade_medida || item.unidade_apresentacao || "UN";
  const qbStored = normalizeNumber(item.quantidade_base, NaN);
  const baseFromDisplay = calculateBaseQuantity(normalizeNumber(item.quantidade, 0), fator);
  let quantidadeBase = Number.isFinite(qbStored) && qbStored > 0 ? qbStored : baseFromDisplay;
  const tolerance = Math.max(0.05, Math.abs(baseFromDisplay) * 0.001);
  if (Number.isFinite(qbStored) && qbStored > 0 && Math.abs(qbStored - baseFromDisplay) > tolerance) {
    quantidadeBase = baseFromDisplay;
  }
  quantidadeBase = roundToTwoDecimals(quantidadeBase);
  return {
    ...item,
    quantidade_base: quantidadeBase,
    quantidade: commercialQuantityFromBase(quantidadeBase, fator, unit),
  };
}

/** Mantém `quantidade_base` alinhada à quantidade comercial × fator (UI mobile compras). */
export function syncItemQuantidadeBaseComercial(item = {}) {
  const qty = normalizeNumber(item.quantidade, 0);
  const fator = normalizeNumber(item.fator_conversao, 1) || 1;
  return {
    ...item,
    quantidade_base: roundToTwoDecimals(calculateBaseQuantity(qty, fator)),
  };
}

/** Tolerância para tratar 19,99 como 20 pacotes (ruído de float ou base×fator impreciso). */
const DISCRETE_QTY_SNAP_EPSILON = 0.02;

/** Embalagens discretas (pacote, caixa, etc.) — quantidade comercial costuma ser inteira. */
const DISCRETE_PACKAGING_UNITS = new Set([
  "PAC",
  "CX",
  "CT",
  "FD",
  "SC",
  "PCT",
  "PT",
  "DZ",
  "GL",
  "RL",
  "BAL",
  "FAR",
  "TAM",
]);

export function isDiscretePackagingUnit(unitCode) {
  return DISCRETE_PACKAGING_UNITS.has(normalizeUnitCode(unitCode));
}

/** Valor numérico sem parte fracionária relevante (ex.: 360, 18 — não 359,82). */
function isEffectivelyInteger(value) {
  const n = normalizeNumber(value, NaN);
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9;
}

/**
 * Converte quantidade_base (fator-1) → quantidade comercial.
 * A base é a fonte da verdade; esta função só lê, nunca “corrige” a base.
 * PAC/CX: se base e fator são inteiros e a divisão é exata (360÷18), devolve o inteiro 20.
 */
function fatorConversaoEhInteiro(fator) {
  const f = normalizeNumber(fator, 1) || 1;
  return Math.abs(f - Math.round(f)) < 1e-6;
}

export function commercialQuantityFromBase(quantityBase, fatorConversao = 1, unitCode = "") {
  const base = normalizeNumber(quantityBase, 0);
  const fator = normalizeNumber(fatorConversao, 1) || 1;
  if (!(fator > 0)) return roundToTwoDecimals(base);

  const unit = normalizeUnitCode(unitCode);
  const raw = base / fator;
  if (isDiscretePackagingUnit(unit)) {
    // Só usa divisibilidade inteira quando o fator é inteiro (18 PAC, etc.).
    // Fator decimal (2,6 m²/CX) com Math.round(2.6)=3 gerava 105 em vez de 121.
    if (fatorConversaoEhInteiro(fator)) {
      const bi = Math.round(base);
      const fi = Math.round(fator);
      if (fi > 0 && bi % fi === 0) return bi / fi;
    }
    const nearest = Math.round(raw);
    if (nearest > 0 && Math.abs(raw - nearest) <= DISCRETE_QTY_SNAP_EPSILON) {
      return nearest;
    }
  }

  return roundToTwoDecimals(raw);
}

/** Exibição de quantidade comercial: PAC/CX etc. sem casas quando o valor é (quase) inteiro. */
export function formatCommercialQuantity(value, unitCode = "") {
  const n = normalizeNumber(value, 0);
  const unit = normalizeUnitCode(unitCode);
  if (isDiscretePackagingUnit(unit)) {
    const nearest = Math.round(n);
    if (nearest > 0 && Math.abs(n - nearest) <= DISCRETE_QTY_SNAP_EPSILON) {
      return nearest.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    }
    if (isEffectivelyInteger(n)) {
      return Math.round(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    }
  }
  return roundToTwoDecimals(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * `true` = custo na linha está no eixo fator-1 (ex. R$/m²); `false` = já na UM comercial (ex. PAC).
 * Usado para não multiplicar o fator de conversão duas vezes em relatório/cards.
 */
export function linhaPrecoNoEixoFatorUm(linha = {}) {
  const qb = Number(linha.quantidade_base) || 0;
  const qv = Number(linha.quantidade) || 0;
  const f = Number(linha.fator_conversao) || 1;
  if (!(qb > 0 && qv > 0)) return false;
  if (Math.abs(qv - qb) < 1e-5) return true;
  if (f > 1 && Math.abs(qv * f - qb) < Math.max(0.015 * qb, 0.05)) return false;
  return false;
}

/** Custo/preço na unidade comercial (vitrine ou embalagem escolhida). */
export function custoFator1ParaApresentacao(valorFator1, fatorConversao = 1) {
  return normalizeNumber(valorFator1, 0) * (normalizeNumber(fatorConversao, 1) || 1);
}

/** Converte valor digitado na unidade comercial para persistência fator-1. */
export function custoApresentacaoParaFator1(valorApresentacao, fatorConversao = 1) {
  const f = normalizeNumber(fatorConversao, 1) || 1;
  return f > 0 ? normalizeNumber(valorApresentacao, 0) / f : normalizeNumber(valorApresentacao, 0);
}

/**
 * Preço unitário na UM comercial da linha (PAC, CX, etc.), sem aplicar o fator duas vezes.
 * Linhas legadas podem ter `custo_unitario` já em comercial; linhas canônicas guardam fator-1.
 */
export function resolveCustoUnitarioComercialLinha(linha = {}, axis = "custo") {
  const f = normalizeNumber(linha.fator_conversao, 1) || 1;
  const apres =
    axis === "final"
      ? normalizeNumber(linha.custo_final_unitario_apresentacao, NaN)
      : normalizeNumber(linha.custo_unitario_apresentacao, NaN);
  const unitF1 =
    axis === "final"
      ? normalizeNumber(linha.custo_final_unitario ?? linha.custo_unitario, NaN)
      : normalizeNumber(linha.custo_unitario, NaN);

  if (Number.isFinite(apres) && apres > 0) {
    return roundToTwoDecimals(apres);
  }

  if (!(Number.isFinite(unitF1) && unitF1 > 0)) return 0;

  const qv = Number(linha.quantidade) || 0;
  const totalLinha = Number(linha.total ?? linha.valor_total_item ?? linha.valor_total ?? 0);
  const perCx = qv > 0 && totalLinha > 0 ? totalLinha / qv : NaN;
  const tol = (x) => Math.max(0.025 * x, 0.35);
  if (Number.isFinite(perCx) && perCx > 0 && Math.abs(unitF1 - perCx) <= tol(perCx)) {
    return roundToTwoDecimals(unitF1);
  }

  if (linhaPrecoNoEixoFatorUm(linha)) {
    const comercial = custoFator1ParaApresentacao(unitF1, f);
    if (Number.isFinite(perCx) && perCx > 0 && Math.abs(comercial - perCx) <= tol(perCx)) {
      return roundToTwoDecimals(comercial);
    }
    if (Number.isFinite(perCx) && perCx > 0 && Math.abs(unitF1 - perCx) <= tol(perCx)) {
      return roundToTwoDecimals(unitF1);
    }
    return roundToTwoDecimals(comercial);
  }
  return roundToTwoDecimals(unitF1);
}

/**
 * Custo na unidade comercial da linha (exibição em carrinho, cards, relatórios).
 */
export function getCustoApresentacaoItem(item = {}) {
  return resolveCustoUnitarioComercialLinha(item, "custo");
}

/** Alinha custo fator-1 e snapshots de apresentação ao custo visível na embalagem. */
export function reconcileItemCustoCompra(item = {}, custoApresExplicit = null) {
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const custoApres = roundToTwoDecimals(
    custoApresExplicit != null && Number.isFinite(Number(custoApresExplicit))
      ? custoApresExplicit
      : getCustoApresentacaoItem(item),
  );
  const custoF1 = roundToTwoDecimals(custoApresentacaoParaFator1(custoApres, fator));
  const patched = {
    ...item,
    custo_unitario: custoF1,
    custo_unitario_base: custoF1,
    custo_unitario_apresentacao: custoApres,
  };
  return normalizeItemToCanonicalFactorOne(patched, 'custo');
}

/** Lê desconto unitário na unidade comercial da linha. */
export function getDescontoApresentacaoItem(item = {}) {
  const storedPct = normalizeNumber(item?.desconto_pct_item, NaN);
  if (Number.isFinite(storedPct) && storedPct > 0) {
    const custoApres = getCustoApresentacaoItem(item);
    if (custoApres > 0) {
      const absApres = roundToTwoDecimals((custoApres * storedPct) / 100);
      return isItemAcrescimoCompra(item) ? -absApres : absApres;
    }
  }
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const descF1 = normalizeNumber(item?.valor_desconto_item, 0);
  return custoFator1ParaApresentacao(descF1, fator);
}

/** `valor_desconto_item` negativo = acréscimo (aumenta o custo). */
export function isItemAcrescimoCompra(item = {}) {
  return normalizeNumber(item?.valor_desconto_item, 0) < 0;
}

/**
 * `valor_desconto_item` (fator-1) a partir do cadastro do produto.
 * Prioriza `desconto_perc` (%; negativo = acréscimo); senão `desconto_compra_padrao` (R$ fator-1).
 */
export function resolveValorDescontoCompraPadraoFator1(product = {}, custoFator1 = 0) {
  const base =
    normalizeNumber(custoFator1, 0) ||
    normalizeNumber(product?.valor_compra, 0);
  const pct = normalizeNumber(product?.desconto_perc, 0);
  if (pct !== 0 && base > 0) {
    const absVal = roundToTwoDecimals((base * Math.abs(pct)) / 100);
    return pct < 0 ? -absVal : absVal;
  }
  return roundToTwoDecimals(normalizeNumber(product?.desconto_compra_padrao, 0));
}

/** Percentual absoluto do desconto/acréscimo padrão do produto (≥ 0). */
export function resolveDescontoPctCompraProduto(product = {}, custoFator1 = 0) {
  const pct = normalizeNumber(product?.desconto_perc, 0);
  if (pct !== 0) return roundToTwoDecimals(Math.abs(pct));
  const valor = resolveValorDescontoCompraPadraoFator1(product, custoFator1);
  const base =
    normalizeNumber(custoFator1, 0) ||
    normalizeNumber(product?.valor_compra, 0);
  if (base <= 0 || valor === 0) return 0;
  return roundToTwoDecimals((Math.abs(valor) / base) * 100);
}

/** Custo unitário na unidade de exibição após desconto/acréscimo (desconto negativo soma). */
export function getCustoFinalApresentacaoItem(item = {}) {
  const base =
    resolveCustoUnitarioComercialLinha(item, "final") ||
    resolveCustoUnitarioComercialLinha(item, "custo");
  return roundToTwoDecimals(base - getDescontoApresentacaoItem(item));
}

/** Percentual absoluto sobre o custo na unidade de exibição (sempre ≥ 0). */
export function getDescontoPctApresentacaoItem(item = {}) {
  const storedPct = normalizeNumber(item?.desconto_pct_item, NaN);
  if (Number.isFinite(storedPct) && storedPct > 0) return roundToTwoDecimals(storedPct);
  const custoApres = getCustoApresentacaoItem(item);
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const descApres = custoFator1ParaApresentacao(normalizeNumber(item?.valor_desconto_item, 0), fator);
  if (custoApres <= 0) return 0;
  return roundToTwoDecimals((Math.abs(descApres) / custoApres) * 100);
}

/**
 * Reaplica desconto/acréscimo na unidade de exibição (corrige `valor_desconto_item` fator-1
 * quando o % está em `desconto_pct_item` mas o fator da linha estava inconsistente).
 */
export function syncItemDescontoApresentacao(item = {}, custoApresOverride = null) {
  const reconciled = reconcileItemCustoCompra(item, custoApresOverride);
  const custoApres = getCustoApresentacaoItem(reconciled);
  if (custoApres <= 0) return reconciled;

  const storedPct = normalizeNumber(reconciled?.desconto_pct_item, NaN);
  if (Number.isFinite(storedPct) && storedPct > 0) {
    return applyItemDescontoPctApresentacao(
      reconciled,
      custoApres,
      storedPct,
      isItemAcrescimoCompra(reconciled),
    );
  }

  const descApres = Math.abs(getDescontoApresentacaoItem(reconciled));
  if (descApres > 0) {
    return applyItemDescontoValorApresentacao(
      reconciled,
      custoApres,
      descApres,
      isItemAcrescimoCompra(reconciled),
    );
  }
  return reconciled;
}

/**
 * Atualiza `valor_desconto_item` (fator-1) a partir de % e custo na unidade comercial.
 * `pctAbs` é sempre positivo; `isAcrescimo` define o sinal (acréscimo → valor negativo).
 */
export function applyItemDescontoPctApresentacao(item = {}, custoApres, pctAbs, isAcrescimo = false) {
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const custo = roundToTwoDecimals(custoApres);
  const pct = Math.max(0, roundToTwoDecimals(pctAbs));
  const absDescApres = roundToTwoDecimals((custo * pct) / 100);
  const sign = isAcrescimo ? -1 : 1;
  const descontoF1 = roundToTwoDecimals(custoApresentacaoParaFator1(sign * absDescApres, fator));
  return {
    ...item,
    valor_desconto_item: descontoF1,
    desconto_pct_item: pct,
  };
}

/**
 * Atualiza `valor_desconto_item` a partir do valor absoluto na unidade comercial (R$ da embalagem).
 */
export function applyItemDescontoValorApresentacao(item = {}, custoApres, absDescApres, isAcrescimo = false) {
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const custo = roundToTwoDecimals(custoApres);
  const absDesc = Math.max(0, roundToTwoDecimals(absDescApres));
  const sign = isAcrescimo ? -1 : 1;
  const descontoF1 = roundToTwoDecimals(custoApresentacaoParaFator1(sign * absDesc, fator));
  const pct = custo > 0 ? roundToTwoDecimals((absDesc / custo) * 100) : 0;
  return {
    ...item,
    valor_desconto_item: descontoF1,
    desconto_pct_item: pct,
  };
}

/** Custo de compra líquido fator-1: desconto positivo reduz; desconto negativo/acréscimo aumenta. */
export function getCustoCompraLiquidoFator1(item = {}) {
  const custoF1 = normalizeNumber(
    item?.custo_unitario_fator1 ?? item?.custo_unitario,
    0,
  );
  const ajusteF1 = normalizeNumber(
    item?.desconto_unitario_fator1 ?? item?.valor_desconto_item ?? item?.desconto_unitario,
    0,
  );
  return roundToTwoDecimals(custoF1 - ajusteF1);
}

/** Total da linha: quantidade_base × custo final fator-1 (contrato PedidoCompra). */
export function calcTotalItemCompraPedido(item = {}) {
  const qb = normalizeNumber(item?.quantidade_base, NaN);
  const qty = normalizeNumber(item?.quantidade, 0);
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  const qBase = Number.isFinite(qb) && qb > 0 ? qb : qty * fator;
  const custoF1 = normalizeNumber(item?.custo_unitario, 0);
  const descF1 = normalizeNumber(item?.valor_desconto_item, 0);
  const custoLiquidoF1 = custoF1 - descF1;

  const totalViaBase = () => roundToTwoDecimals(qBase * custoLiquidoF1);

  if (item?.preco_eixo === "FATOR_1") {
    return totalViaBase();
  }

  // Embalagem (CX/PAC…): total = qtd comercial × preço/embalagem. Evita (preço÷fator)×(qtd×fator)
  // arredondar o unitário fator-1 antes do produto (ex.: 110,26÷200 → 0,55 → total 2.200 em vez de 2.205,20).
  if (fator > 1 && qty > 0) {
    const custoFinalApres = getCustoFinalApresentacaoItem(item);
    if (custoFinalApres > 0 || custoF1 > 0) {
      // Sem snapshot de apresentação: custo ainda em fator-1 (R$/UN) — não fazer 30 CX × 0,37.
      if (
        custoLiquidoF1 > 0 &&
        Math.abs(custoFinalApres - custoLiquidoF1) <= Math.max(0.001, 0.001 * custoLiquidoF1)
      ) {
        return totalViaBase();
      }
      return roundToTwoDecimals(qty * custoFinalApres);
    }
  }

  return totalViaBase();
}

/**
 * Aplica embalagem de compra à linha: quantidade/custo na UI na unidade escolhida;
 * `custo_unitario` e `quantidade_base` permanecem no eixo fator-1 (contrato PedidoCompra).
 */
export function applyPurchaseUnitOptionToItem(item = {}, product = {}, option = null, options = {}) {
  if (!option) return { ...item };
  const { preserveQuantidadeBase = true, usarCustoSugerido = false } = options;
  const fator = normalizeNumber(option.fator_conversao, 1) || 1;
  const oldFator = normalizeNumber(item.fator_conversao, 1) || 1;
  const qtyNaUnidadeAtual = normalizeNumber(item.quantidade, 0);
  const quantidadeBase = preserveQuantidadeBase
    ? calculateBaseQuantity(qtyNaUnidadeAtual, oldFator)
    : calculateBaseQuantity(1, fator);

  const unidadeAnterior = normalizeUnitCode(item.unidade_medida);
  const unidadeNova = normalizeUnitCode(option.unidade);
  const unidadeMudou = unidadeAnterior && unidadeNova && unidadeAnterior !== unidadeNova;

  let custoF1 = normalizeNumber(item.custo_unitario, NaN);
  if (!Number.isFinite(custoF1) || usarCustoSugerido || unidadeMudou) {
    custoF1 = custoApresentacaoParaFator1(option.valor_unitario, fator);
  }

  const quantidade =
    preserveQuantidadeBase && fator > 0
      ? commercialQuantityFromBase(quantidadeBase, fator, option.unidade)
      : normalizeNumber(item.quantidade, 1) || 1;

  const canon = getUnidadeBySiglaCanonical(product, option.unidade);
  const produtoId = product?.id || item.produto_id || "";
  const patched = {
    ...item,
    produto_unidade_id: canon?.id || option.id || item.produto_unidade_id || "",
    unidade_medida: option.unidade,
    fator_conversao: fator,
    quantidade,
    quantidade_base: quantidadeBase,
    custo_unitario: custoF1,
    item_key: getItemUnitKey(produtoId, option.unidade),
    unidade_apresentacao: option.unidade,
  };
  const normalized = normalizeItemToCanonicalFactorOne(patched, "custo");
  const custoApresOpcao = roundToTwoDecimals(normalizeNumber(option.valor_unitario, 0));
  return syncItemDescontoApresentacao(normalized, custoApresOpcao > 0 ? custoApresOpcao : null);
}

/**
 * Marca o item como canônico fator-1 e popula os snapshots auxiliares.
 *
 * Sob o novo contrato, o valor unitário (`custo_unitario` / `preco_unitario_praticado`) **já é fator-1**,
 * então `*_base` é alias do canônico e `*_apresentacao` é o valor já em unidade comercial (× fator).
 * Não dividimos mais por fator — fazer isso destruía itens entrados em fator-1 (legado).
 */
export function normalizeItemToCanonicalFactorOne(item = {}, axisPrefix = "custo") {
  const fator = normalizeNumber(item?.fator_conversao, 1) || 1;
  let quantidade = normalizeNumber(item?.quantidade, 0);
  const quantidadeBase = normalizeNumber(item?.quantidade_base, NaN);
  const unitCode = normalizeUnitCode(item?.unidade_medida || item?.unidade_apresentacao);
  let quantidadeBaseFinal = Number.isFinite(quantidadeBase) ? quantidadeBase : quantidade * fator;
  if (isDiscretePackagingUnit(unitCode) && fator > 0) {
    quantidade = commercialQuantityFromBase(quantidadeBaseFinal, fator, unitCode);
  }

  const unitField = axisPrefix === "preco" ? "preco_unitario_praticado" : "custo_unitario";
  const finalField = axisPrefix === "preco" ? "preco_unitario_praticado" : "custo_final_unitario";
  const unitVal = normalizeNumber(item?.[unitField], 0);
  const finalVal = normalizeNumber(item?.[finalField], unitVal);

  const unitApresentacao = unitVal * fator;
  const finalApresentacao = finalVal * fator;

  const payload = {
    ...item,
    preco_eixo: "FATOR_1",
    unidade_apresentacao: item?.unidade_apresentacao || item?.unidade_medida || "UN",
    quantidade,
    quantidade_base: quantidadeBaseFinal,
  };

  if (axisPrefix === "preco") {
    payload.preco_unitario_base = unitVal;
    payload.preco_unitario_apresentacao = unitApresentacao;
  } else {
    payload.custo_unitario_base = unitVal;
    payload.custo_final_unitario_base = finalVal;
    payload.custo_unitario_apresentacao = unitApresentacao;
    payload.custo_final_unitario_apresentacao = finalApresentacao;
  }
  return payload;
}

export function formatUnitConversion(option, unidadePrincipal) {
  const fator = normalizeNumber(option?.fator_conversao, 1);
  const principal = (unidadePrincipal || "UN").toUpperCase();
  if (fator === 1) return `1 ${option?.unidade || principal}`;
  return `1 ${option?.unidade || principal} = ${fator} ${principal}`;
}

/**
 * Rótulos consistentes para colunas de catálogo: unidade base (fator 1) vs unidade comercial (PDV).
 * Usa as mesmas regras que `resolveCommercialUnit` / `formatEstoqueApresentacao`.
 */
export function getCatalogUnitLabels(product) {
  const base = resolvePrimaryFromFactorOne(product, product?.unidade_principal || "UN");
  const comercial = resolveCommercialUnit(product, base);
  const same =
    normalizeUnitCode(base) === normalizeUnitCode(comercial) || !isShowUnitEnabled(product);
  return { unidadeBase: base, unidadeComercial: comercial, mostramMesma: same };
}

export function formatEstoqueApresentacao(produto) {
  if (!isShowUnitEnabled(produto)) return null;
  const estoque = normalizeNumber(produto?.estoque_atual, 0);
  const up = resolvePrimaryFromFactorOne(produto, "UN");
  const alternativas = normalizeAlternativeUnits(produto);
  const pref = resolveCommercialUnit(produto, up);
  if (!pref || pref === up) return null;
  const alt = alternativas.find((a) => a.unidade === pref);
  if (!alt || !alt.fator_conversao) return null;
  const fator = normalizeNumber(alt.fator_conversao, 1);
  if (fator <= 0) return null;
  const qtd = commercialQuantityFromBase(estoque, fator, pref);
  return { sigla: pref, quantidade: qtd, rotulo: alt.rotulo };
}

/** Converte quantidade em unidade base para apresentação comercial (metas, mínimo, ideal). */
export function formatQuantidadeCatalogoApresentacao(produto, quantidadeBase) {
  const qty = normalizeNumber(quantidadeBase, 0);
  if (!isShowUnitEnabled(produto)) {
    const un = resolvePrimaryFromFactorOne(produto, produto?.unidade_principal || 'UN');
    return { sigla: un, quantidade: qty, rotulo: null };
  }
  const apresent = formatEstoqueApresentacao({ ...produto, estoque_atual: qty });
  if (apresent) return { sigla: apresent.sigla, quantidade: apresent.quantidade, rotulo: apresent.rotulo };
  const un = resolvePrimaryFromFactorOne(produto, produto?.unidade_principal || 'UN');
  return { sigla: un, quantidade: qty, rotulo: null };
}

/** Estoque disponível na unidade de vitrine (ou base quando vitrine inativa). */
export function formatEstoqueDisponivelApresentacao(produto) {
  return formatQuantidadeCatalogoApresentacao(produto, produto?.estoque_atual ?? 0);
}

/** Texto curto para PDV/orçamentos: ex. "12,5 CX". */
export function formatEstoqueDisponivelLabel(produto, localeOptions = {}) {
  const { sigla, quantidade } = formatEstoqueDisponivelApresentacao(produto);
  const q = quantidade.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    ...localeOptions,
  });
  return `${q} ${sigla}`;
}

/**
 * Resolve quantidade/unidade a partir da **unidade de compra** escolhida (PDF, modal, catálogo).
 * Não substitui pela vitrine comercial do produto (ex.: manter M² quando o fornecedor faturou em M²).
 */
export function resolvePurchaseUnitDisplay(product, quantityBase = 0, purchaseUnit = "UN") {
  const unitNorm = normalizeUnitCode(purchaseUnit);
  const purchaseOptions = buildPurchaseUnitOptions(product);
  const option =
    purchaseOptions.find((item) => normalizeUnitCode(item.unidade) === unitNorm) ||
    purchaseOptions.find((item) => item.is_primary) ||
    purchaseOptions[0] ||
    null;
  const unidade = option?.unidade || unitNorm || resolvePrimaryFromFactorOne(product, "UN");
  const fator = normalizeNumber(option?.fator_conversao, 1) || 1;
  const quantidade =
    fator > 0
      ? commercialQuantityFromBase(quantityBase, fator, unidade)
      : normalizeNumber(quantityBase, 0);
  return { unidade, fator_conversao: fator, quantidade, option };
}

export function resolveCommercialDisplay(product, quantityBase = 0, fallbackUnit = "UN") {
  if (!isShowUnitEnabled(product)) {
    const unidadeLegada = resolvePrimaryFromFactorOne(product, fallbackUnit);
    return { unidade: unidadeLegada, fator_conversao: 1, quantidade: normalizeNumber(quantityBase, 0), option: null };
  }
  const unidade = resolveCommercialUnit(product, fallbackUnit);
  const purchaseOptions = buildPurchaseUnitOptions(product);
  const option = purchaseOptions.find((item) => item.unidade === unidade) || purchaseOptions[0] || null;
  const fator = normalizeNumber(option?.fator_conversao, 1) || 1;
  const quantidade =
    fator > 0
      ? commercialQuantityFromBase(quantityBase, fator, unidade)
      : normalizeNumber(quantityBase, 0);
  return { unidade, fator_conversao: fator, quantidade, option };
}

/**
 * Contrato canônico: o item da linha do pedido é sempre persistido em **fator-1**:
 *   - `quantidade` continua na unidade comercial (CX/CT/etc.) só pra UI;
 *   - `quantidade_base = quantidade × fator_conversao` (m²/kg/etc., sempre fator-1);
 *   - `custo_unitario` é R$/[unidade base do produto] = fator-1, sem conversão escondida;
 *   - `custo_unitario_apresentacao = custo_unitario × fator_conversao` é só um snapshot p/ UI mostrar em comercial.
 *
 * Por que tratar a entrada do usuário como fator-1: o catálogo do produto guarda `valor_compra` em fator-1
 * (R$/[unidade principal]), e é esse valor que pré-preenche `custo_unitario` no formulário. Mantemos o eixo.
 */
export function normalizePurchaseItemToCommercial(product, item = {}) {
  const quantidadeInput = normalizeNumber(item.quantidade, 0);
  const fatorInput = normalizeNumber(item.fator_conversao, 1) || 1;
  const quantidadeBase = resolveEffectiveQuantidadeBase({
    ...item,
    quantidade: quantidadeInput,
    fator_conversao: fatorInput,
  });
  const fallbackUnit = item.unidade_medida || product?.unidade_principal || "UN";
  const purchaseOptions = buildPurchaseUnitOptions(product);
  const purchaseUnitExplicit = normalizeUnitCode(fallbackUnit);
  const hasExplicitPurchaseUnit =
    purchaseUnitExplicit &&
    purchaseOptions.some((opt) => normalizeUnitCode(opt.unidade) === purchaseUnitExplicit);
  const display = hasExplicitPurchaseUnit
    ? resolvePurchaseUnitDisplay(product, quantidadeBase, purchaseUnitExplicit)
    : resolveCommercialDisplay(product, quantidadeBase, fallbackUnit);
  const quantidadeComercial = normalizeNumber(display.quantidade, 0);
  const fatorDisplay = normalizeNumber(display.fator_conversao, 1) || 1;

  const custoUnitarioFator1 = normalizeNumber(item.custo_unitario, 0);
  const custoFinalUnitarioInput = normalizeNumber(item.custo_final_unitario, NaN);
  const custoFinalUnitarioFator1 = Number.isFinite(custoFinalUnitarioInput) ? custoFinalUnitarioInput : custoUnitarioFator1;
  const custoUnitarioApresentacao = custoUnitarioFator1 * fatorDisplay;
  const custoFinalUnitarioApresentacao = custoFinalUnitarioFator1 * fatorDisplay;

  return {
    ...item,
    unidade_medida: display.unidade || item.unidade_medida || product?.unidade_principal || "UN",
    fator_conversao: fatorDisplay,
    quantidade: quantidadeComercial,
    quantidade_base: quantidadeBase,
    custo_unitario: custoUnitarioFator1,
    custo_final_unitario: custoFinalUnitarioFator1,
    preco_eixo: "FATOR_1",
    unidade_apresentacao: display.unidade || item.unidade_medida || product?.unidade_principal || "UN",
    // `*_base` são alias do canônico (mantidos para compat com leitores antigos).
    custo_unitario_base: custoUnitarioFator1,
    custo_final_unitario_base: custoFinalUnitarioFator1,
    // `*_apresentacao` é o valor já convertido p/ unidade comercial (use só em UI/relatório).
    custo_unitario_apresentacao: custoUnitarioApresentacao,
    custo_final_unitario_apresentacao: custoFinalUnitarioApresentacao,
  };
}

/* ============================================================================
 * Schema canonico do `Produto.unidades[]` (a partir desta refatoracao)
 * ----------------------------------------------------------------------------
 * Antes: dados de unidades viviam em 4 lugares diferentes (`unidade_principal`,
 * `unidades_alternativas[]`, `unidade_comercial_id`, `unidade_apresentacao_default`).
 * Cada referencia usava string match (sigla/nome) e qualquer typo orfanizava linhas
 * de pedido — foi essa pilha que motivou esta refatoracao.
 *
 * Agora `Produto.unidades[]` e o array canonico, com IDs estaveis. Os campos
 * legados continuam mantidos como espelho (recomposto a cada save) ate que todos
 * os consumidores migrem.
 *
 * Forma de cada unidade:
 *   {
 *     id:              string   // UUID estavel; NUNCA mudar apos criada
 *     nome:            string   // rotulo livre ("Caixa de 2,16 m²")
 *     sigla:           string   // codigo curto, normalizado ("CX")
 *     fator_conversao: number   // qty na sigla -> qty em fator-1; 1 se for a base
 *     fator_preco:     number   // multiplicador opcional de preco; 1 se neutro
 *     is_principal:    boolean  // EXATAMENTE 1 unidade no array; tem fator_conversao=1
 *     is_comercial:    boolean  // EXATAMENTE 1 unidade no array; e a "sagrada" pra UI/relatorios
 *     ativo:           boolean  // false = soft delete
 *   }
 *
 * Invariantes (validados em `validateUnidades` do productUnitsCrud.js):
 *   1. 1 <= unidades.length <= 5
 *   2. todas com `id` nao vazio e unico
 *   3. siglas unicas (apos normalizacao)
 *   4. fator_conversao > 0
 *   5. exatamente 1 com `is_principal = true`, e essa tem fator_conversao = 1
 *   6. exatamente 1 com `is_comercial = true`
 *
 * Espelho legado (regravado a cada save canonico):
 *   - `unidade_principal`         := unidades[is_principal].sigla
 *   - `unidade_apresentacao_default`/`unidade_show_comercial` := unidades[is_comercial].sigla
 *   - `unidade_comercial_id`      := unidades[is_comercial].id
 *   - `unidades_alternativas[]`   := unidades.filter(!is_principal) mapeadas pro formato antigo
 * ============================================================================ */

/** Le o array canonico, caindo pra reconstrucao do legado se ainda nao migrado. */
export function getUnidadesCanonical(produto = {}) {
  if (Array.isArray(produto?.unidades) && produto.unidades.length > 0) {
    return produto.unidades;
  }
  return null;
}

/** Resolve a unidade `is_principal` (fator-1). Cai pra `unidade_principal` se ainda nao migrado. */
export function getUnidadePrincipalCanonical(produto = {}) {
  const canonical = getUnidadesCanonical(produto);
  if (canonical) {
    return canonical.find((u) => u?.is_principal && u?.ativo !== false) || canonical[0] || null;
  }
  return {
    id: "principal",
    nome: "Unidade base",
    sigla: normalizeUnitCode(produto?.unidade_principal) || "UN",
    fator_conversao: 1,
    fator_preco: 1,
    is_principal: true,
    is_comercial: false,
    ativo: true,
  };
}

/** Resolve a unidade `is_comercial` (sagrada). Cai pra heuristica legada se nao migrado. */
export function getUnidadeComercialCanonical(produto = {}) {
  const canonical = getUnidadesCanonical(produto);
  if (canonical) {
    const explicita = canonical.find((u) => u?.is_comercial && u?.ativo !== false);
    if (explicita) return explicita;
    return canonical.find((u) => u?.is_principal) || canonical[0] || null;
  }
  const sigla = resolveCommercialUnit(produto, getUnidadePrincipalCanonical(produto)?.sigla || "UN");
  const principal = getUnidadePrincipalCanonical(produto);
  if (sigla === principal?.sigla) return principal;
  const alt = normalizeAlternativeUnits(produto).find((a) => a.unidade === sigla);
  if (!alt) return principal;
  return {
    id: alt.id,
    nome: alt.nome || alt.unidade,
    sigla: alt.unidade,
    fator_conversao: alt.fator_conversao,
    fator_preco: alt.fator_preco || 1,
    is_principal: false,
    is_comercial: true,
    ativo: alt.ativo,
  };
}

/** Busca uma unidade canonica pelo `id` estavel. */
export function getUnidadeByIdCanonical(produto = {}, unidadeId = "") {
  if (!unidadeId) return null;
  const canonical = getUnidadesCanonical(produto);
  if (canonical) return canonical.find((u) => u?.id === unidadeId) || null;
  if (unidadeId === "primary" || unidadeId === "principal") {
    return getUnidadePrincipalCanonical(produto);
  }
  const alt = normalizeAlternativeUnits(produto).find((a) => a.id === unidadeId);
  if (!alt) return null;
  return {
    id: alt.id,
    nome: alt.nome || alt.unidade,
    sigla: alt.unidade,
    fator_conversao: alt.fator_conversao,
    fator_preco: alt.fator_preco || 1,
    is_principal: false,
    is_comercial: false,
    ativo: alt.ativo,
  };
}

/** Busca uma unidade canonica pela sigla normalizada. */
export function getUnidadeBySiglaCanonical(produto = {}, sigla = "") {
  const target = normalizeUnitCode(sigla);
  if (!target) return null;
  const canonical = getUnidadesCanonical(produto);
  if (canonical) return canonical.find((u) => normalizeUnitCode(u?.sigla) === target) || null;
  const principal = getUnidadePrincipalCanonical(produto);
  if (normalizeUnitCode(principal?.sigla) === target) return principal;
  const alt = normalizeAlternativeUnits(produto).find((a) => normalizeUnitCode(a.unidade) === target);
  if (!alt) return null;
  return {
    id: alt.id,
    nome: alt.nome || alt.unidade,
    sigla: alt.unidade,
    fator_conversao: alt.fator_conversao,
    fator_preco: alt.fator_preco || 1,
    is_principal: false,
    is_comercial: false,
    ativo: alt.ativo,
  };
}

/**
 * Unidade comercial para relatórios/cards de compras (vitrine + hints da linha do pedido).
 * Usa `resolveUnidadeExibicao` quando o produto tem embalagens; senão casa siglas nas opções de compra.
 */
export function resolveUnidadeExibicaoParaCompras(produto = {}, item = {}, fallbackUnit = "UN") {
  const opcoes = buildPurchaseUnitOptions(produto);
  const principal = resolvePrimaryFromFactorOne(produto, fallbackUnit);
  const fb = normalizeUnitCode(
    produto?.unidade_vitrine ||
      item?.unidade_apresentacao_default ||
      item?.unidade_medida ||
      produto?.unidade_apresentacao_default ||
      fallbackUnit ||
      principal
  );

  if (produto && Object.keys(produto).length > 0) {
    const canon = getUnidadeExibicaoSigla(produto, fb);
    if (!opcoes.length || opcoes.some((o) => o.unidade === canon)) return canon;
  }

  const candidatos = [
    produto?.unidade_vitrine,
    produto?.unidade_apresentacao_default,
    item?.unidade_apresentacao_default,
    produto?.unidade_show_comercial,
    item?.unidade_show_comercial,
    item?.unidade_medida,
    fb,
  ];
  for (const raw of candidatos) {
    const u = normalizeUnitCode(raw);
    if (u && opcoes.some((o) => o.unidade === u)) return u;
  }
  const nonPrimary = opcoes.find((o) => o.unidade !== normalizeUnitCode(principal));
  return nonPrimary?.unidade || principal || fb || "UN";
}

/** Snapshot com vitrine ativa para `resolveCommercialDisplay` em relatórios de compra. */
export function buildSnapshotExibicaoComercial(produto = {}, siglaOverride = null) {
  const sigla =
    normalizeUnitCode(siglaOverride) ||
    resolveUnidadeExibicaoParaCompras(produto, {}, produto?.unidade_principal || "UN");
  return {
    ...produto,
    unidade_show_ativa: true,
    unidade_vitrine: sigla === normalizeUnitCode(produto?.unidade_principal) ? "" : sigla,
    unidade_apresentacao_default: sigla,
    unidade_show_comercial: sigla,
  };
}

/** Normaliza quantidade/unidade de linha de pedido para exibição em relatórios consolidados. */
export function normalizeItemCompraParaExibicao(item = {}, produto = null) {
  const quantidadeAtual = Number(item?.quantidade ?? 0) || 0;
  const fatorAtual = Number(item?.fator_conversao ?? 1) || 1;
  const quantidadeBase = Number(item?.quantidade_base ?? quantidadeAtual * fatorAtual) || 0;
  const snapshot = produto || item?._produto || item || {};
  const fallback = item?.unidade_medida || snapshot?.unidade_principal || "UN";
  const snap = buildSnapshotExibicaoComercial(
    snapshot,
    produto ? resolveUnidadeExibicaoParaCompras(snapshot, item, fallback) : null
  );
  const resolvido = resolveCommercialDisplay(snap, quantidadeBase, fallback);
  const quantidadeShow = Number(resolvido?.quantidade ?? 0) || quantidadeAtual;
  const divisor = quantidadeShow > 0 ? quantidadeShow : quantidadeAtual > 0 ? quantidadeAtual : 1;
  const custoTotal =
    Number(item?.custo_calculado_total ?? (Number(item?.custo_calculado ?? 0) * quantidadeAtual)) || 0;
  const freteTotal =
    Number(item?.frete_total ?? ((Number(item?.frete_unitario ?? item?.valor_frete_unitario ?? 0) || 0) * quantidadeAtual)) || 0;
  const outrosTotal = Number(item?.outros_total ?? ((Number(item?.custo_outros ?? 0) || 0) * quantidadeAtual)) || 0;
  const linhaExibicao = {
    ...item,
    unidade_medida: resolvido?.unidade || fallback,
    fator_conversao: Number(resolvido?.fator_conversao ?? item?.fator_conversao ?? 1) || 1,
    quantidade: quantidadeShow || quantidadeAtual,
    quantidade_base: quantidadeBase,
  };
  const valorUnitarioComercial = resolveCustoUnitarioComercialLinha(linhaExibicao, "custo");
  const qShow = quantidadeShow || quantidadeAtual;
  const totalItem =
    Number(item?.valor_total_item ?? item?.total) ||
    (valorUnitarioComercial > 0 && qShow > 0 ? roundToTwoDecimals(valorUnitarioComercial * qShow) : 0) ||
    0;

  return {
    ...item,
    unidade_medida: linhaExibicao.unidade_medida,
    fator_conversao: linhaExibicao.fator_conversao,
    quantidade: linhaExibicao.quantidade,
    quantidade_base: quantidadeBase,
    valor_unitario_compra: qShow > 0 ? totalItem / qShow : valorUnitarioComercial,
    frete_unitario: freteTotal / divisor,
    custo_outros: outrosTotal / divisor,
    custo_calculado: custoTotal / divisor,
    valor_total_item: totalItem,
    custo_total_item: custoTotal,
  };
}

/**
 * Exibição na unidade vitrine (CX, PAC…), mesmo quando a linha foi lançada em M²/UN.
 * Só para UI (carrinho, cards); não altera persistência do pedido.
 */
export function getItemCompraExibicaoVitrine(item = {}, produto = null) {
  const norm = normalizeItemCompraParaExibicao(item, produto);
  const unit = norm.unidade_medida || item?.unidade_medida || "UN";
  const qty = Number(norm.quantidade) || 0;
  const total = Number(norm.valor_total_item ?? item?.total) || 0;
  const preco =
    Number(norm.valor_unitario_compra) ||
    (qty > 0 && total > 0 ? roundToTwoDecimals(total / qty) : 0);

  return {
    quantidade: qty,
    unidade_medida: unit,
    preco_unitario: preco,
    total,
    quantidade_base: norm.quantidade_base,
    fator_conversao: norm.fator_conversao,
    quantidade_formatada: formatCommercialQuantity(qty, unit),
  };
}

export function resolveBoatLogisticsUnit(product, fallbackUnit = "UN") {
  const options = buildPurchaseUnitOptions(product);
  if (!options.length) {
    return normalizeUnitCode(fallbackUnit) || "UN";
  }
  const principalResolvida = resolvePrimaryFromFactorOne(product, options[0]?.unidade || fallbackUnit);

  const validUnits = new Set(options.map((option) => option.unidade));
  const priorities = [
    product?.unidade_show_logistica,
    product?.unidade_vitrine,
    getUnidadeExibicaoSigla(product, fallbackUnit),
    product?.unidade_apresentacao_default,
    product?.unidade_show_comercial,
    principalResolvida,
    fallbackUnit,
  ];

  for (const priority of priorities) {
    const normalized = normalizeUnitCode(priority);
    if (normalized && validUnits.has(normalized)) {
      return normalized;
    }
  }

  const principal = normalizeUnitCode(principalResolvida);
  if (principal && validUnits.has(principal)) return principal;
  return options[0]?.unidade || normalizeUnitCode(fallbackUnit) || "UN";
}
