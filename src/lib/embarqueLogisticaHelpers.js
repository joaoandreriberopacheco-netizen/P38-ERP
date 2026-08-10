import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';
import { getEmbarqueItensLinhas, hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

/**
 * Percentuais de despacho/conclusão a partir dos embarques reais (entidade Embarque),
 * alinhado à lógica de `integrarPedidosEmbarques` mas sem depender do snapshot no PedidoCompra.
 */
export function calcularPercentuaisLogistica(pedido, embarques = []) {
  const totalPedido = (pedido?.itens || []).reduce(
    (acc, item) => acc + (Number(item.quantidade_base ?? item.quantidade) || 0),
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
      porProdutoEmb[pid] = (porProdutoEmb[pid] || 0) + (Number(item.quantidade_embarcada) || 0);
      porProdutoRec[pid] = (porProdutoRec[pid] || 0) + (Number(item.quantidade_recebida) || 0);
    });
  });

  let totalDespachado = 0;
  let totalConcluido = 0;
  (pedido?.itens || []).forEach((item) => {
    const pedida = Number(item.quantidade_base ?? item.quantidade) || 0;
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
