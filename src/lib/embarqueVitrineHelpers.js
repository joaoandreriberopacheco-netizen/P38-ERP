import { base44 } from '@/api/base44Client';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  buildPurchaseUnitOptions,
  calculateBaseQuantity,
  commercialQuantityFromBase,
  getItemCompraExibicaoVitrine,
  getUnidadeBySiglaCanonical,
  normalizeUnitCode,
  resolvePrimaryFromFactorOne,
} from '@/lib/productUnits';

export function quantidadeBaseEmbarqueItem(item = {}) {
  const qb = Number(item.quantidade_base);
  if (Number.isFinite(qb) && qb > 0) return qb;
  const q = Number(item.quantidade_embarcada) || 0;
  const f = Number(item.fator_conversao) || 1;
  return calculateBaseQuantity(q, f);
}

export function pedidaBaseItem(item = {}) {
  const qb = Number(item.quantidade_base);
  if (Number.isFinite(qb) && qb > 0) return qb;
  return calculateBaseQuantity(Number(item.quantidade) || 0, Number(item.fator_conversao) || 1);
}

export function buildUnidadeLinhaInicial(item, produto, embItem = null) {
  if (embItem?.unidade_apresentacao) {
    return {
      unidade: embItem.unidade_apresentacao,
      fator: Number(embItem.fator_apresentacao) || 1,
      produto_unidade_id: embItem.produto_unidade_id || '',
    };
  }
  if (embItem?.unidade_medida && Number(embItem.fator_conversao) > 1) {
    return {
      unidade: embItem.unidade_medida,
      fator: Number(embItem.fator_conversao) || 1,
      produto_unidade_id: embItem.produto_unidade_id || '',
    };
  }
  if (embItem && Number(embItem.fator_conversao) === 1 && produto) {
    const exib = getItemCompraExibicaoVitrine(item, produto);
    return {
      unidade: exib.unidade_medida || item.unidade_medida || 'UN',
      fator: Number(exib.fator_conversao) || 1,
      produto_unidade_id: embItem.produto_unidade_id || '',
    };
  }
  const exib = getItemCompraExibicaoVitrine(item, produto);
  const unidade = exib.unidade_medida || item.unidade_medida || 'UN';
  const canon = produto ? getUnidadeBySiglaCanonical(produto, unidade) : null;
  return {
    unidade,
    fator: Number(exib.fator_conversao) || Number(item.fator_conversao) || 1,
    produto_unidade_id: canon?.id || item.produto_unidade_id || '',
  };
}

export function resolveFatorLinhaEmbarque(produto, linha = {}) {
  const unidade = normalizeUnitCode(linha.unidade);
  if (produto && unidade) {
    const opt = buildPurchaseUnitOptions(produto).find(
      (o) => normalizeUnitCode(o.unidade) === unidade,
    );
    if (opt && Number(opt.fator_conversao) > 0) {
      return Number(opt.fator_conversao);
    }
  }
  return Number(linha.fator) || 1;
}

export function enrichLinhaEmbarque(produto, linha = {}) {
  const fator = resolveFatorLinhaEmbarque(produto, linha);
  const unidade = linha.unidade || 'UN';
  const canon = produto ? getUnidadeBySiglaCanonical(produto, unidade) : null;
  return {
    ...linha,
    unidade,
    fator,
    produto_unidade_id: linha.produto_unidade_id || canon?.id || '',
  };
}

/** Persistência canónica fator-1 + espelho comercial (vitrine/seletor) — despacho. */
export function buildItemEmbarquePersistido(item, produto, linha, qEmb) {
  const linhaOk = enrichLinhaEmbarque(produto, linha);
  const qBase = roundToTwoDecimals(calculateBaseQuantity(qEmb, linhaOk.fator));
  const pedidaBase = pedidaBaseItem(item);
  const unidadeBase = resolvePrimaryFromFactorOne(produto, item.unidade_medida || 'UN');
  const canonUnidade = produto ? getUnidadeBySiglaCanonical(produto, linhaOk.unidade) : null;

  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    pedido_compra_item_id: item.id || item.pedido_compra_item_id || '',
    produto_unidade_id: linhaOk.produto_unidade_id || canonUnidade?.id || item.produto_unidade_id || '',
    quantidade_pedida: pedidaBase,
    quantidade_embarcada: qBase,
    quantidade_base: qBase,
    fator_conversao: 1,
    unidade_medida: unidadeBase,
    unidade_apresentacao: linhaOk.unidade,
    fator_apresentacao: linhaOk.fator,
    quantidade_pedida_apresentacao: commercialQuantityFromBase(pedidaBase, linhaOk.fator, linhaOk.unidade),
    quantidade_embarcada_apresentacao: roundToTwoDecimals(qEmb),
  };
}

/** Normaliza linha de recepção: base fator-1 + espelho comercial. */
export function buildItemRecepcaoAtualizado(embItem, pedidoItem, produto, linha, qRecApresentacao) {
  const linhaOk = enrichLinhaEmbarque(produto, linha);
  const qRecBase = roundToTwoDecimals(calculateBaseQuantity(qRecApresentacao, linhaOk.fator));
  const qEmbBase = quantidadeBaseEmbarqueItem(embItem);
  const qEmbApres = quantidadeApresentacaoEmbarqueItem(embItem, linhaOk);
  const unidadeBase = resolvePrimaryFromFactorOne(produto, embItem.unidade_medida || 'UN');
  const canonUnidade = produto ? getUnidadeBySiglaCanonical(produto, linhaOk.unidade) : null;
  const pedidaBase = pedidaBaseItem(pedidoItem || embItem);

  return {
    ...embItem,
    produto_unidade_id: linhaOk.produto_unidade_id || canonUnidade?.id || embItem.produto_unidade_id || '',
    quantidade_pedida: embItem.quantidade_pedida ?? pedidaBase,
    quantidade_embarcada: qEmbBase,
    quantidade_base: qEmbBase,
    quantidade_recebida: qRecBase,
    fator_conversao: 1,
    unidade_medida: unidadeBase,
    unidade_apresentacao: linhaOk.unidade,
    fator_apresentacao: linhaOk.fator,
    quantidade_embarcada_apresentacao: qEmbApres,
    quantidade_recebida_apresentacao: roundToTwoDecimals(qRecApresentacao),
  };
}

export function resolveUnidadeLinha(item, produto, unidadeLinhaMap, produtoId) {
  const base = unidadeLinhaMap[produtoId] || buildUnidadeLinhaInicial(item, produto);
  return enrichLinhaEmbarque(produto, base);
}

export function quantidadeApresentacaoEmbarqueItem(embItem, linha) {
  const apres = Number(embItem?.quantidade_embarcada_apresentacao);
  if (Number.isFinite(apres) && apres >= 0) return apres;
  if (Number(embItem?.fator_conversao) > 1 && embItem?.quantidade_embarcada != null) {
    return Number(embItem.quantidade_embarcada) || 0;
  }
  const baseEmb = quantidadeBaseEmbarqueItem(embItem);
  return commercialQuantityFromBase(baseEmb, linha.fator, linha.unidade);
}

export function quantidadeRecebidaApresentacaoEmbarqueItem(embItem, linha) {
  const apres = Number(embItem?.quantidade_recebida_apresentacao);
  if (Number.isFinite(apres) && apres >= 0) return apres;
  const baseRec = Number(embItem?.quantidade_recebida);
  if (Number.isFinite(baseRec) && baseRec >= 0) {
    return commercialQuantityFromBase(baseRec, linha.fator, linha.unidade);
  }
  return quantidadeApresentacaoEmbarqueItem(embItem, linha);
}

export async function carregarProdutosMap(itens = []) {
  const ids = [...new Set((itens || []).map((i) => i.produto_id).filter(Boolean))];
  const map = {};
  if (!ids.length) return map;
  try {
    const rows = await base44.entities.Produto.filter({ id: ids });
    (rows || []).forEach((p) => {
      if (p?.id) map[p.id] = p;
    });
  } catch {
    const chunkSize = 25;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      const batch = await Promise.all(slice.map((id) => base44.entities.Produto.get(id).catch(() => null)));
      batch.filter(Boolean).forEach((p) => {
        map[p.id] = p;
      });
    }
  }
  return map;
}
