import { inicioDiaSistemaISO, dataMenosDiasSistema } from '@/components/utils/dateUtils';
import {
  FILTRO_COMPRAS_JANELA_DIAS,
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
} from '@/lib/filtroVisibilidadePedidosCompra';
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

async function fetchEmbarquesGestao(base44, { somenteNaoConcluidos, ultimos30Dias, pedidoIds, inicio30 }) {
  if (somenteNaoConcluidos) {
    return pedidoIds.length
      ? fetchEmbarquesPorPedidos(base44, pedidoIds)
      : [];
  }
  if (ultimos30Dias) {
    const [embarquesRecentes, embarquesPorPedido] = await Promise.all([
      base44.entities.Embarque.filter(
        { created_date: { $gte: inicio30 } },
        '-created_date',
        600,
      ).catch(() => []),
      pedidoIds.length ? fetchEmbarquesPorPedidos(base44, pedidoIds) : Promise.resolve([]),
    ]);
    return dedupePorId([...(embarquesRecentes || []), ...(embarquesPorPedido || [])]);
  }
  const [embarquesRecentes, embarquesPorPedido] = await Promise.all([
    base44.entities.Embarque.filter(
      { created_date: { $gte: inicio30 } },
      '-created_date',
      600,
    ).catch(() => []),
    pedidoIds.length ? fetchEmbarquesPorPedidos(base44, pedidoIds) : Promise.resolve([]),
  ]);
  return dedupePorId([...(embarquesRecentes || []), ...(embarquesPorPedido || [])]);
}

/**
 * Pedidos + embarques para a lista de compras.
 * Respeita filtros de visibilidade (evita carregar concluídos quando «Não concluídos» está ativo).
 * @param {{ somenteNaoConcluidos?: boolean, ultimos30Dias?: boolean }} filters
 */
export async function fetchPedidosCompraGestaoInicial(base44, filters = {}) {
  const somenteNaoConcluidos = filters.somenteNaoConcluidos ?? FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT;
  const ultimos30Dias = filters.ultimos30Dias ?? FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT;
  const limite30 = dataMenosDiasSistema(FILTRO_COMPRAS_JANELA_DIAS);
  const inicio30 = inicioDiaSistemaISO(limite30);

  let pcsRaw = [];

  if (somenteNaoConcluidos) {
    const abertos = await base44.entities.PedidoCompra.filter(
      { status: { $ne: 'Concluído' } },
      '-created_date',
      400,
    ).catch(() => []);
    pcsRaw = dedupePorId(abertos || []);
  } else if (ultimos30Dias) {
    const recentes = await base44.entities.PedidoCompra.filter(
      { created_date: { $gte: inicio30 } },
      '-created_date',
    ).catch(() => []);
    pcsRaw = dedupePorId(recentes || []);
  } else {
    const [recentes, abertos] = await Promise.all([
      base44.entities.PedidoCompra.filter(
        { created_date: { $gte: inicio30 } },
        '-created_date',
      ).catch(() => []),
      base44.entities.PedidoCompra.filter(
        { status: { $ne: 'Concluído' } },
        '-created_date',
        400,
      ).catch(() => []),
    ]);
    pcsRaw = dedupePorId([...(recentes || []), ...(abertos || [])]);
  }

  const pedidoIds = pcsRaw.map((p) => p.id).filter(Boolean);

  const [embarquesDbRaw, pedidosBase] = await Promise.all([
    fetchEmbarquesGestao(base44, { somenteNaoConcluidos, ultimos30Dias, pedidoIds, inicio30 }),
    hydratePedidosCompraItensFromSql(base44, pcsRaw),
  ]);

  const pedidoIdsConhecidos = new Set(pcsRaw.map((p) => p.id));
  const missingPedidoIds = [
    ...new Set(
      embarquesDbRaw.map((e) => e.pedido_compra_id).filter((id) => id && !pedidoIdsConhecidos.has(id)),
    ),
  ];

  let pedidos = pedidosBase;
  if (missingPedidoIds.length) {
    const extrasRaw = await fetchPedidosByIds(base44, missingPedidoIds);
    const extrasHydrated = await hydratePedidosCompraItensFromSql(base44, extrasRaw);
    pedidos = dedupePorId([...pedidos, ...extrasHydrated]);
  }

  return { pedidos, embarques: embarquesDbRaw };
}
