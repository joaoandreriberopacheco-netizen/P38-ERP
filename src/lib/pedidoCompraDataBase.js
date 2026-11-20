import { dataHoje, formatarSoData, toLocalDateKey } from '@/components/utils/dateUtils';
import { comparePedidosNoMesmoGrupoEmbarque } from '@/lib/comprasEmbarquesPalette';

/**
 * «Data base» do pedido (`groupBy === 'data_pedido'`) — emissão/recebimento do fluxo, não aprovação financeira.
 * Use `pedidoCompraDataAprovacaoFinanceira.js` para `data_aprovacao_financeira`.
 */
export function getPedidoCompraDataBaseChave(pedido = {}) {
  const raw =
    pedido._display_date
    || pedido.data_emissao
    || pedido.created_date
    || '';
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const k = toLocalDateKey(new Date(s));
    return k && k !== 'Invalid Date' ? k : '';
  } catch {
    return '';
  }
}

/** Agrupamento por data base (`groupBy === 'data_pedido'`). */
export function metaGrupoDataBasePedidoCompra(pedido = {}) {
  const key = getPedidoCompraDataBaseChave(pedido) || 'sem-data';
  const hoje = dataHoje();
  let label = 'Sem data base';
  if (key !== 'sem-data') {
    label = key === hoje ? 'Hoje' : formatarSoData(key);
  }
  return { key: `data_pedido:${key}`, label, orderValue: key };
}

export function comparePedidosPorDataBase(a, b, sortOrder = 'asc') {
  const da = getPedidoCompraDataBaseChave(a);
  const db = getPedidoCompraDataBaseChave(b);
  if (!da && !db) return comparePedidosNoMesmoGrupoEmbarque(a, b);
  if (!da) return 1;
  if (!db) return -1;
  const cmp = da.localeCompare(db, 'pt-BR');
  if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
  return comparePedidosNoMesmoGrupoEmbarque(a, b);
}