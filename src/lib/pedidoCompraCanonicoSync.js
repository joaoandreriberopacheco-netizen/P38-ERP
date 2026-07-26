import { savePedidoCompraItem } from '@/functions/savePedidoCompraItem';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { stripItensFromPedidoPayload } from '@/lib/pedidoCompraLineItemsFlags';
import {
  calcTotalItemCompraPedido,
  syncItemDescontoApresentacao,
} from '@/lib/productUnits';

/** Converte linhas legado (`pedido.itens[]`) para payload `savePedidoCompraItem`. */
export function buildPedidoCompraItensCanonicosFromLegacy(itens = []) {
  return (itens || [])
    .map((it, idx) => {
      const synced = syncItemDescontoApresentacao(it);
      const totalLinha = calcTotalItemCompraPedido(synced);
      const descontoF1 =
        Number(synced?.valor_desconto_item ?? synced?.desconto_unitario) || 0;
      return {
        id: synced?.pedido_compra_item_id || synced?.id || undefined,
        produto_id: synced?.produto_id || '',
        produto_unidade_id: synced?.produto_unidade_id || '',
        unidade_sigla: synced?.unidade_medida || synced?.unidade_apresentacao || '',
        quantidade_comercial: Number(synced?.quantidade) || 0,
        custo_unitario_fator1: Number(synced?.custo_unitario) || 0,
        frete_unitario_fator1: Number(synced?.custo_frete_unitario) || 0,
        outros_unitario_fator1: Number(synced?.custo_outros_unitario) || 0,
        desconto_unitario_fator1: descontoF1,
        valor_desconto_item: descontoF1,
        total: Number(synced?.total) > 0 ? Number(synced.total) : totalLinha,
        quantidade_vinculada: Number(synced?.quantidade_vinculada) || 0,
        ordem: idx,
        observacoes: typeof synced?.observacoes === 'string' ? synced.observacoes : '',
        status_recebimento: synced?.status_recebimento || 'Pendente',
      };
    })
    .filter((it) => it.produto_id && it.quantidade_comercial > 0);
}

/**
 * Persiste linhas em `pedido_compra_item` e recompõe espelho `pedido_compra.itens`.
 * Retorna { ok, skipped, error } — não lança (callers decidem toast).
 */
/** Prepara payload de create/update do cabeçalho (opcionalmente sem `itens[]`). */
export function preparePedidoCompraEntityPayload(pedidoData = {}) {
  return stripItensFromPedidoPayload(pedidoData);
}

export async function syncPedidoCompraItensReplaceAll(pedidoId, itens = [], options = {}) {
  if (!pedidoId) return { ok: false, skipped: true, reason: 'sem_pedido_id' };

  const items = buildPedidoCompraItensCanonicosFromLegacy(itens);
  if (!items.length) return { ok: true, skipped: true, reason: 'sem_linhas' };

  try {
    await savePedidoCompraItem({
      action: 'replaceAll',
      pedido_compra_id: pedidoId,
      items,
    });

    const { valorItens, valorTotal, valorDesconto } = options;
    if (
      valorItens != null ||
      valorTotal != null ||
      valorDesconto != null
    ) {
      const { base44 } = await import('@/api/base44Client');
      await base44.entities.PedidoCompra.update(pedidoId, {
        ...(valorItens != null ? { valor_itens: valorItens } : {}),
        ...(valorTotal != null ? { valor_total: valorTotal } : {}),
        ...(valorDesconto != null
          ? { valor_desconto: roundToTwoDecimals(Number(valorDesconto) || 0) }
          : {}),
      });
    }

    return { ok: true, count: items.length };
  } catch (error) {
    return { ok: false, error };
  }
}
