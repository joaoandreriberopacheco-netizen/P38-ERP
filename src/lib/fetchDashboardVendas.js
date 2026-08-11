import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { getMonthBucketsEndingAt, getTemporalCutoffForMonth, getTemporalStartForMonth } from '@/lib/dashboardVendasPeriod';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import { resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { format } from 'date-fns';

const CHUNK_SIZE = 40;

function normalizeList(rows) {
  return Array.isArray(rows) ? rows : [];
}

function monthWindowKeys(selectedMonthKey, months = 6) {
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  if (!buckets.length) return { dataInicio: null, dataFim: null };
  const start = getTemporalStartForMonth(buckets[0].key);
  const end = getTemporalCutoffForMonth(selectedMonthKey);
  return {
    dataInicio: format(start, 'yyyy-MM-dd'),
    dataFim: format(end, 'yyyy-MM-dd'),
  };
}

async function fetchProdutosCustoPorIds(produtoIds = []) {
  const unique = [...new Set((produtoIds || []).filter(Boolean))];
  if (!unique.length) return new Map();

  const produtoEntity = base44?.entities?.Produto;
  if (!produtoEntity?.filter) return new Map();

  const rows = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    try {
      const batch = await produtoEntity.filter({ id: { $in: chunk } }, '-created_date', chunk.length);
      if (Array.isArray(batch)) rows.push(...batch);
    } catch {
      const batches = await Promise.all(
        chunk.map((id) => produtoEntity.filter({ id }).catch(() => [])),
      );
      batches.flat().forEach((row) => rows.push(row));
    }
  }

  return new Map(
    rows.map((produto) => [
      produto.id,
      Number(resolveCustoTotalUnitBaseProduto(produto)),
    ]),
  );
}

function collectProdutoIdsFromPedidos(pedidos = []) {
  const ids = new Set();
  for (const pedido of pedidos) {
    for (const item of pedido?.itens || []) {
      const pid = item?.produto_id ?? item?.produtoId;
      if (pid) ids.add(pid);
    }
  }
  return [...ids];
}

/** Pedidos de venda do dashboard (janela de N meses) com itens hidratados só desse conjunto. */
export async function fetchDashboardVendasPeriodo({
  selectedMonthKey,
  months = 6,
} = {}) {
  const { dataInicio, dataFim } = monthWindowKeys(selectedMonthKey, months);
  if (!dataInicio || !dataFim) {
    return { pedidos: [], productCostMap: new Map() };
  }

  const pedidosRaw = await base44.entities.PedidoVenda.filter(
    {
      created_date: {
        $gte: inicioDiaSistemaISO(dataInicio),
        $lte: fimDiaSistemaISO(dataFim),
      },
    },
    '-created_date',
    5000,
  );

  const pedidosLista = normalizeList(pedidosRaw);
  const pedidos = await hydratePedidosVendaItensFromSql(base44, pedidosLista);
  const productCostMap = await fetchProdutosCustoPorIds(collectProdutoIdsFromPedidos(pedidos));

  return { pedidos, productCostMap };
}
