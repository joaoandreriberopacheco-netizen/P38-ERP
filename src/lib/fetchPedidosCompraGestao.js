import { inicioDiaSistemaISO, dataMenosDiasSistema } from '@/components/utils/dateUtils';
import { FILTRO_COMPRAS_JANELA_DIAS } from '@/lib/filtroVisibilidadePedidosCompra';
import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';
import { fetchEmbarquesForPedidoIds } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';

function dedupePedidosPorId(pedidos = []) {
  const porId = new Map();
  (pedidos || []).forEach((pedido) => {
    if (pedido?.id) porId.set(pedido.id, pedido);
  });
  return [...porId.values()];
}

/**
 * Pedidos + embarques para a lista de compras (filtro padrão: últimos 30 dias + em aberto).
 * Evita list(300)+list(600) cegos e hidrata só o conjunto relevante.
 */
export async function fetchPedidosCompraGestaoInicial(base44) {
  const limite30 = dataMenosDiasSistema(FILTRO_COMPRAS_JANELA_DIAS);

  const [recentes, abertos] = await Promise.all([
    base44.entities.PedidoCompra.filter(
      { created_date: { $gte: inicioDiaSistemaISO(limite30) } },
      '-created_date',
    ).catch(() => []),
    base44.entities.PedidoCompra.filter(
      { status: { $ne: 'Concluído' } },
      '-created_date',
      400,
    ).catch(() => []),
  ]);

  const pcsRaw = dedupePedidosPorId([...(recentes || []), ...(abertos || [])]);
  const pedidoIds = pcsRaw.map((p) => p.id).filter(Boolean);

  const embarquesDbRaw = pedidoIds.length
    ? await fetchEmbarquesForPedidoIds(base44, pedidoIds)
    : [];

  const [pcs, embarquesDb] = await Promise.all([
    hydratePedidosCompraItensFromSql(base44, pcsRaw),
    hydrateEmbarquesFromSql(base44, embarquesDbRaw),
  ]);

  return { pedidos: pcs, embarques: embarquesDb };
}
