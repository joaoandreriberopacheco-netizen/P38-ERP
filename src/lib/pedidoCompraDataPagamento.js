import { dataHoje, formatarSoData, toLocalDateKey } from '@/components/utils/dateUtils';
import { comparePedidosNoMesmoGrupoEmbarque } from '@/lib/comprasEmbarquesPalette';

/**
 * Data financeira do pedido de compra (à vista = pagamento; parcelado = 1.º vencimento).
 * Coluna/dado: `data_primeiro_vencimento` (PedidoCompra / pedido_compra).
 */
export function getPedidoCompraDataPagamentoChave(pedido = {}) {
  const raw =
    pedido.data_primeiro_vencimento
    || pedido._display_data_pagamento
    || pedido?.dados?.data_primeiro_vencimento
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

export function pedidoPassaFiltroDataPagamento(pedido, pagamentoInicial = '', pagamentoFinal = '') {
  if (!pagamentoInicial && !pagamentoFinal) return true;
  const chave = getPedidoCompraDataPagamentoChave(pedido);
  if (!chave) return false;
  if (pagamentoInicial && chave < pagamentoInicial) return false;
  if (pagamentoFinal && chave > pagamentoFinal) return false;
  return true;
}

/** Metadados de agrupamento por data de pagamento (lista Embarques / Consulta). */
export function metaGrupoDataPagamentoPedidoCompra(pedido = {}) {
  const key = getPedidoCompraDataPagamentoChave(pedido) || 'sem-data';
  const hoje = dataHoje();
  let label = 'Sem data de pagamento';
  if (key !== 'sem-data') {
    label = key === hoje ? 'Hoje' : formatarSoData(key);
  }
  return { key: `data_pagamento:${key}`, label, orderValue: key };
}

/** Ordenação dentro do grupo quando o organizador está em «Data pagamento». */
export function comparePedidosPorDataPagamento(a, b, sortOrder = 'asc') {
  const da = getPedidoCompraDataPagamentoChave(a);
  const db = getPedidoCompraDataPagamentoChave(b);
  if (!da && !db) return comparePedidosNoMesmoGrupoEmbarque(a, b);
  if (!da) return -1;
  if (!db) return 1;
  const cmp = da.localeCompare(db, 'pt-BR');
  if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
  return comparePedidosNoMesmoGrupoEmbarque(a, b);
}