import { base44 } from '@/api/base44Client';

function pedidoIdFromReferencias(referencias = []) {
  const pedidoRef = (referencias || []).find((ref) => ref?.referencia_tipo === 'PedidoCompra' && ref?.referencia_id);
  return pedidoRef?.referencia_id || null;
}

/**
 * Resolve o pedido de compra para montar a capa da consulta no PDF de anexos.
 */
export async function resolvePedidoIdParaExportAnexos({
  pedidoId = null,
  referencias = [],
  referenciaTipo = null,
  referenciaId = null,
  client = base44,
} = {}) {
  if (pedidoId) return pedidoId;

  const fromRefs = pedidoIdFromReferencias(referencias);
  if (fromRefs) return fromRefs;

  if (referenciaTipo === 'PedidoCompra' && referenciaId) return referenciaId;

  if (!referenciaId || !referenciaTipo) return null;

  try {
    if (referenciaTipo === 'Embarque') {
      const embarque = await client.entities.Embarque.get(referenciaId);
      return embarque?.pedido_compra_id || null;
    }

    if (referenciaTipo === 'LancamentoFinanceiro') {
      const lf = await client.entities.LancamentoFinanceiro.get(referenciaId);
      if (lf?.referencia_tipo === 'PedidoCompra' && lf?.referencia_id) return lf.referencia_id;
      if (lf?.pedido_compra_vinculado_id) return lf.pedido_compra_vinculado_id;
    }
  } catch {
    return null;
  }

  return null;
}
