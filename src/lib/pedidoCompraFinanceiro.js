/**
 * Consistência entre PedidoCompra e LancamentoFinanceiro na reabertura / reenvio ao financeiro.
 */

import { calcTotalItemCompraPedido } from '@/lib/productUnits';
import { isLancamentoCancelado, isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { dataHoje, formatarLogTime } from '@/components/utils/dateUtils';

const roundToTwoDecimals = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Total da linha: prioriza `total` gravado no item (formulário); senão recalcula. */
export function getTotalLinhaPedidoCompra(item = {}) {
  const totalDireto = Number(item?.total ?? item?.valor_total_item ?? item?.subtotal);
  if (Number.isFinite(totalDireto) && totalDireto > 0) return totalDireto;
  return calcTotalItemCompraPedido(item);
}

/** Soma dos totais de linha; `valor_itens` só entra se não houver itens no espelho. */
export function calcValorItensPedidoCompra(pedido = {}) {
  const itens = pedido.itens || [];
  if (itens.length > 0) {
    return roundToTwoDecimals(
      itens.reduce((acc, item) => acc + getTotalLinhaPedidoCompra(item), 0),
    );
  }
  const valorItensDireto = Number(pedido.valor_itens);
  if (Number.isFinite(valorItensDireto) && valorItensDireto > 0) {
    return roundToTwoDecimals(valorItensDireto);
  }
  return 0;
}

/** Total do pedido: itens + frete − desconto global (mesma regra do formulário). */
export function calcValorTotalPedidoCompra(pedido = {}) {
  const itens = calcValorItensPedidoCompra(pedido);
  const frete = Number(pedido.valor_frete) || 0;
  const desconto = Number(pedido.valor_desconto) || 0;
  return roundToTwoDecimals(itens + frete - desconto);
}

const statusCancelavel = (l) =>
  l?.status === 'Em Aberto' || l?.status === 'Vencido';

export async function listarLancamentosPedidoCompra(base44, pedidoId) {
  if (!pedidoId) return [];
  const [porVinculo, porReferencia] = await Promise.all([
    base44.entities.LancamentoFinanceiro.filter({ pedido_compra_vinculado_id: pedidoId }),
    base44.entities.LancamentoFinanceiro.filter({
      referencia_id: pedidoId,
      referencia_tipo: 'PedidoCompra',
    }),
  ]);
  const merged = [...(porVinculo || []), ...(porReferencia || [])];
  return merged.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
}

export function temLancamentoPagoParaPedido(lancamentos) {
  return (lancamentos || []).some(isLancamentoPago);
}

/** Parcelas CMV / conta a pagar vinculadas ao pedido (exclui canceladas). */
export function filtrarLancamentosCompraPedido(pedidoId, lancamentos = []) {
  if (!pedidoId) return [];
  return (lancamentos || []).filter(
    (l) =>
      !isLancamentoCancelado(l) &&
      (l.referencia_tipo === 'PedidoCompra' ||
        l.pedido_compra_vinculado_id === pedidoId ||
        l.is_custo_mercadoria),
  );
}

/**
 * Pagamento do pedido coberto pelos lançamentos vinculados (tolerância de centavos).
 */
export function pedidoPagamentoCompleto(lancamentos, pedido = {}) {
  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  if (!compraLancs.length) return false;

  const totalEsperado = calcValorTotalPedidoCompra(pedido);
  const totalPago = compraLancs
    .filter(isLancamentoPago)
    .reduce((sum, l) => sum + Number(l.valor || 0), 0);

  if (totalEsperado > 0 && totalPago >= totalEsperado - 0.02) return true;
  return compraLancs.every(isLancamentoPago);
}

/**
 * Cancela parcelas Em Aberto / Vencido vinculadas ao pedido (não pagas).
 * @returns {{ cancelados: number }}
 */
export async function cancelarLancamentosNaoPagosPedidoCompra(base44, pedidoId, notaObservacao) {
  const lancamentos = await listarLancamentosPedidoCompra(base44, pedidoId);
  const alvos = lancamentos.filter((l) => statusCancelavel(l) && !isLancamentoPago(l));
  const sufixo = notaObservacao ? ` ${notaObservacao}` : '';

  await Promise.all(
    alvos.map((l) =>
      base44.entities.LancamentoFinanceiro.update(l.id, {
        status: 'Cancelado',
        observacoes: `${l.observacoes || ''}\n[Cancelado: reabertura/correção do pedido]${sufixo}`.trim(),
      })
    )
  );

  return { cancelados: alvos.length };
}

/**
 * Gera lançamento de ajuste quando um pedido com parcelas pagas muda de valor.
 * Diferenca > 0: despesa (conta a pagar). Diferenca < 0: receita (conta a receber).
 */
export async function criarLancamentoAjustePedidoCompra(base44, {
  pedido = {},
  diferenca = 0,
  valorAnterior = 0,
  valorNovo = 0,
  motivo = '',
  responsavel = '',
} = {}) {
  const diff = roundToTwoDecimals(diferenca);
  if (!pedido?.id || Math.abs(diff) < 0.01) return null;

  const contaPagar = diff > 0;
  const valorAjuste = Math.abs(diff);
  const numeroPedido = pedido.numero || pedido.id;
  const tipo = contaPagar ? 'Despesa' : 'Receita';
  const descricao = contaPagar
    ? `Ajuste de Pedido (diferença a pagar) - ${numeroPedido}`
    : `Ajuste de Pedido (diferença a receber) - ${numeroPedido}`;
  const observacoesBase = [
    '[Ajuste automático por edição de pedido com pagamento já realizado]',
    `Valor anterior: R$ ${Number(valorAnterior || 0).toFixed(2)}`,
    `Valor novo: R$ ${Number(valorNovo || 0).toFixed(2)}`,
    `Diferença: ${contaPagar ? '+' : '-'}R$ ${valorAjuste.toFixed(2)}`,
    motivo ? `Motivo: ${motivo}` : '',
    responsavel ? `Responsável: ${responsavel}` : '',
    `Data: ${formatarLogTime()}`,
  ].filter(Boolean).join('\n');

  return base44.entities.LancamentoFinanceiro.create({
    tipo,
    descricao,
    valor: valorAjuste,
    valor_liquido: valorAjuste,
    status: 'Em Aberto',
    categoria: 'Ajuste de Pedido de Compra',
    tags: [contaPagar ? 'conta_pagar' : 'conta_receber', 'ajuste_pedido_compra'],
    terceiro_id: pedido.fornecedor_id || '',
    terceiro_nome: pedido.fornecedor_nome || '',
    data_vencimento: dataHoje(),
    referencia_id: pedido.id,
    referencia_tipo: 'PedidoCompra',
    referencia_numero: numeroPedido,
    pedido_compra_vinculado_id: pedido.id,
    pedido_compra_vinculado_numero: numeroPedido,
    is_custo_mercadoria: !!contaPagar,
    observacoes: observacoesBase,
  });
}
