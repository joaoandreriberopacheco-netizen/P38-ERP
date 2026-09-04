import { inicioDiaSistemaISO, dataMenosDiasSistema } from '@/components/utils/dateUtils';
import { FILTRO_COMPRAS_JANELA_DIAS } from '@/lib/filtroVisibilidadePedidosCompra';
import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { fetchEmbarquesPorPedidos } from '@/lib/fetchEmbarqueItens';

function dedupePorId(rows = []) {
  const porId = new Map();
  (rows || []).forEach((row) => {
    if (row?.id) porId.set(row.id, row);
  });
  return [...porId.values()];
}

async function fetchPedidosByIds(base44, ids = []) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  const rows = await Promise.all(
    unique.map((id) => base44.entities.PedidoCompra.filter({ id }).catch(() => [])),
  );
  return rows.flat().filter((pedido) => pedido?.id);
}

/**
 * Pedidos + embarques para a lista de compras (filtro padrão: últimos 30 dias + em aberto).
 * Embarques vêm por pedido_id ($in) + janela recente, para não perder ETA/transportadora.
 */
export async function fetchPedidosCompraGestaoInicial(base44) {
  const limite30 = dataMenosDiasSistema(FILTRO_COMPRAS_JANELA_DIAS);
  const inicio30 = inicioDiaSistemaISO(limite30);

  const [recentes, abertos, embarquesRecentes] = await Promise.all([
    base44.entities.PedidoCompra.filter(
      { created_date: { $gte: inicio30 } },
      '-created_date',
    ).catch(() => []),
    base44.entities.PedidoCompra.filter(
      { status: { $ne: 'Concluído' } },
      '-created_date',
      400,
    ).catch(() => []),
    base44.entities.Embarque.filter(
      { created_date: { $gte: inicio30 } },
      '-created_date',
      600,
    ).catch(() => []),
  ]);

  let pcsRaw = dedupePorId([...(recentes || []), ...(abertos || [])]);
  const pedidoIds = pcsRaw.map((p) => p.id).filter(Boolean);

  const embarquesPorPedido = pedidoIds.length
    ? await fetchEmbarquesPorPedidos(base44, pedidoIds)
    : [];

  const embarquesDbRaw = dedupePorId([...(embarquesRecentes || []), ...embarquesPorPedido]);

  const pedidoIdsConhecidos = new Set(pcsRaw.map((p) => p.id));
  const missingPedidoIds = [
    ...new Set(
      embarquesDbRaw.map((e) => e.pedido_compra_id).filter((id) => id && !pedidoIdsConhecidos.has(id)),
    ),
  ];
  if (missingPedidoIds.length) {
    const extras = await fetchPedidosByIds(base44, missingPedidoIds);
    pcsRaw = dedupePorId([...pcsRaw, ...extras]);
  }

  const pedidos = await hydratePedidosCompraItensFromSql(base44, pcsRaw);

  return { pedidos, embarques: embarquesDbRaw };
}
