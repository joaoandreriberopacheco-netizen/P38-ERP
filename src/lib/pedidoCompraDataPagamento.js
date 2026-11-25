import { chaveDiaCampoData, dataHoje, formatarSoData } from '@/components/utils/dateUtils';
import { comparePedidosNoMesmoGrupoEmbarque } from '@/lib/comprasEmbarquesPalette';
import { isLancamentoCancelado } from '@/lib/lancamentoFinanceiroStatus';

function lancamentosCompraPedido(pedido = {}, lancamentos = []) {
  const pedidoId = pedido?.id;
  if (!pedidoId) return [];
  return (lancamentos || []).filter(
    (l) =>
      !isLancamentoCancelado(l) &&
      (l.referencia_tipo === 'PedidoCompra' ||
        l.pedido_compra_vinculado_id === pedidoId ||
        l.is_custo_mercadoria),
  );
}

function normalizarChaveDataPagamento(raw) {
  if (raw == null || raw === '') return '';
  const k = chaveDiaCampoData(raw);
  return k && k !== 'Invalid Date' ? k : '';
}

/**
 * 1.º vencimento / data efetiva de pagamento a partir dos lançamentos CMV do pedido.
 * (Pedidos aprovados sem `data_primeiro_vencimento` gravado costumam ter só as parcelas.)
 */
export function chaveDataPagamentoFromLancamentosPedidoCompra(pedido = {}, lancamentos = []) {
  const compraLancs = lancamentosCompraPedido(pedido, lancamentos);
  if (!compraLancs.length) return '';

  const chaves = compraLancs
    .map((l) => normalizarChaveDataPagamento(l.data_pagamento || l.data_vencimento))
    .filter(Boolean);
  if (!chaves.length) return '';
  chaves.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return chaves[0];
}

/**
 * Data financeira do pedido de compra (à vista = pagamento; parcelado = 1.º vencimento).
 * Fontes: `data_primeiro_vencimento` (dados/campo) → lançamentos vinculados.
 * Não usa `data_aprovacao_financeira` (essa é «data base»).
 */
export function getPedidoCompraDataPagamentoChave(pedido = {}) {
  const direto = [
    pedido.data_primeiro_vencimento,
    pedido?.dados?.data_primeiro_vencimento,
    pedido._data_pagamento_resolvida,
  ];
  for (const raw of direto) {
    const k = normalizarChaveDataPagamento(raw);
    if (k) return k;
  }

  const cached = normalizarChaveDataPagamento(pedido._display_data_pagamento);
  if (cached) return cached;

  const lancs = pedido._lancamentos_compra;
  if (Array.isArray(lancs) && lancs.length) {
    return chaveDataPagamentoFromLancamentosPedidoCompra(pedido, lancs);
  }

  return '';
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