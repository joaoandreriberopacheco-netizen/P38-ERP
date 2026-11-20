import { chaveDiaCampoData, dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import { comparePedidosNoMesmoGrupoEmbarque } from '@/lib/comprasEmbarquesPalette';

/**
 * Data de aprovação financeira — somente coluna promovida `data_aprovacao_financeira`.
 * Não lê `dados` nem mistura com emissão/pagamento.
 */
export function getPedidoCompraDataAprovacaoFinanceiraChave(pedido = {}) {
  const raw = pedido.data_aprovacao_financeira;
  if (raw == null || raw === '') return '';
  const k = chaveDiaCampoData(raw);
  return k && k !== 'Invalid Date' ? k : '';
}

export function pedidoPassaFiltroDataAprovacaoFinanceira(
  pedido,
  aprovacaoInicial = '',
  aprovacaoFinal = '',
) {
  if (!aprovacaoInicial && !aprovacaoFinal) return true;
  const chave = getPedidoCompraDataAprovacaoFinanceiraChave(pedido);
  if (!chave) return false;
  if (aprovacaoInicial && chave < aprovacaoInicial) return false;
  if (aprovacaoFinal && chave > aprovacaoFinal) return false;
  return true;
}

/** Agrupamento (`groupBy === 'data_aprovacao_financeira'`). */
export function metaGrupoDataAprovacaoFinanceiraPedidoCompra(pedido = {}) {
  const key = getPedidoCompraDataAprovacaoFinanceiraChave(pedido) || 'sem-data';
  const hoje = dataHoje();
  let label = 'Sem aprovação financeira';
  if (key !== 'sem-data') {
    label = key === hoje ? 'Hoje' : formatarSoData(key);
  }
  return { key: `data_aprovacao_financeira:${key}`, label, orderValue: key };
}

export function comparePedidosPorDataAprovacaoFinanceira(a, b, sortOrder = 'asc') {
  const da = getPedidoCompraDataAprovacaoFinanceiraChave(a);
  const db = getPedidoCompraDataAprovacaoFinanceiraChave(b);
  if (!da && !db) return comparePedidosNoMesmoGrupoEmbarque(a, b);
  if (!da) return -1;
  if (!db) return 1;
  const cmp = da.localeCompare(db, 'pt-BR');
  if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
  return comparePedidosNoMesmoGrupoEmbarque(a, b);
}