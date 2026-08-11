import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';
import { getEmbarqueItensLinhas, hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

function qtyPedidaBaseItem(item = {}) {
  const base = Number(item.quantidade_base);
  if (Number.isFinite(base) && base > 0) return base;
  const comercial = Number(item.quantidade_comercial ?? item.quantidade) || 0;
  const fator = Number(item.fator_conversao) || 1;
  return comercial * fator;
}

/** Quantidade embarcada em unidade base — alinhado a integrarPedidosEmbarques (SQL). */
export function qtyEmbarcadaBaseLinha(item = {}) {
  const sqlBase = Number(item.quantidade_embarcada_base);
  if (Number.isFinite(sqlBase) && sqlBase > 0) return sqlBase;

  const legacyBase = Number(item.quantidade_base);
  if (Number.isFinite(legacyBase) && legacyBase > 0 && Number(item.fator_conversao ?? 1) <= 1) {
    return legacyBase;
  }

  const comercial =
    Number(
      item.quantidade_embarcada_apresentacao ??
        item.quantidade_embarcada_comercial ??
        item.quantidade_embarcada
    ) || 0;
  const fator = Number(item.fator_apresentacao ?? item.fator_aplicado ?? item.fator_conversao) || 1;
  return comercial * fator;
}

function qtyRecebidaBaseLinha(item = {}) {
  const sqlBase = Number(item.quantidade_recebida_base);
  if (Number.isFinite(sqlBase) && sqlBase > 0) return sqlBase;

  const comercial =
    Number(
      item.quantidade_recebida_apresentacao ??
        item.quantidade_recebida_comercial ??
        item.quantidade_recebida
    ) || 0;
  const fator = Number(item.fator_apresentacao ?? item.fator_aplicado ?? item.fator_conversao) || 1;
  return comercial * fator;
}

/**
 * Percentuais de despacho/conclusão a partir dos embarques reais (entidade Embarque),
 * alinhado à lógica de `integrarPedidosEmbarques` mas sem depender do snapshot no PedidoCompra.
 */
export function calcularPercentuaisLogistica(pedido, embarques = []) {
  const totalPedido = (pedido?.itens || []).reduce(
    (acc, item) => acc + qtyPedidaBaseItem(item),
    0
  );
  if (!totalPedido) {
    return { despachado: 0, concluido: 0, pendente: 100 };
  }

  const linhas = (embarques || []).filter((emb) => emb?.tipo !== 'Necessidade');
  const porProdutoEmb = {};
  const porProdutoRec = {};

  linhas.forEach((emb) => {
    getEmbarqueItensLinhas(emb).forEach((item) => {
      const pid = item.produto_id;
      if (!pid) return;
      porProdutoEmb[pid] = (porProdutoEmb[pid] || 0) + qtyEmbarcadaBaseLinha(item);
      porProdutoRec[pid] = (porProdutoRec[pid] || 0) + qtyRecebidaBaseLinha(item);
    });
  });

  let totalDespachado = 0;
  let totalConcluido = 0;
  (pedido?.itens || []).forEach((item) => {
    const pedida = qtyPedidaBaseItem(item);
    const emb = porProdutoEmb[item.produto_id] || 0;
    const rec = porProdutoRec[item.produto_id] || 0;
    totalDespachado += Math.min(pedida, emb);
    totalConcluido += Math.min(pedida, rec);
  });

  const pd = Number(((totalDespachado / totalPedido) * 100).toFixed(2));
  const pc = Number(((totalConcluido / totalPedido) * 100).toFixed(2));
  const pp = Number(Math.max(0, 100 - pd).toFixed(2));

  return { despachado: pd, concluido: pc, pendente: pp };
}

export function derivarStatusEmbarqueAgregado(pctDespachado) {
  if (pctDespachado >= 100) return 'Total';
  if (pctDespachado > 0) return 'Parcial';
  return 'Nenhum';
}

/**
 * Percentuais de despacho/conclusão a partir de `_linhas` (EmbarqueItem SQL).
 */
export async function hydrateEmbarquesLinhasDesdeCanonical(base44, pedidoCompraId, embarques) {
  return hydrateEmbarquesPedidoFromSql(base44, pedidoCompraId, embarques);
}

export { rebuildEmbarqueItensMirror };
