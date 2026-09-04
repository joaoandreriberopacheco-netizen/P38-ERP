import { roundToTwoDecimals, resolveValorPedidoVenda } from '@/lib/financialUtils';

function readPedidoVendaNumero(venda, field) {
  const raw = venda?.[field] ?? venda?.dados?.[field];
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function somarItensPedido(venda) {
  return roundToTwoDecimals(
    (venda?.itens || []).reduce((acc, item) => {
      const qtd = Number(item.quantidade) || 0;
      const preco = Number(item.preco_unitario_praticado) || 0;
      const itemTotal = Number(item.total);
      if (Number.isFinite(itemTotal) && itemTotal !== 0) {
        return acc + Math.abs(itemTotal);
      }
      return acc + preco * qtd;
    }, 0),
  );
}

export function formatPercentualDescontoPedido(desconto, subtotal) {
  const d = roundToTwoDecimals(desconto);
  const s = roundToTwoDecimals(subtotal);
  if (d <= 0 || s <= 0) return null;
  const pct = (d / s) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return pct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

/**
 * Normaliza subtotal, desconto e total — inclui fallback para registos legados em `dados`.
 */
export function resolvePedidoVendaTotais(venda) {
  const total = roundToTwoDecimals(resolveValorPedidoVenda(venda));
  let subtotal = roundToTwoDecimals(readPedidoVendaNumero(venda, 'subtotal'));
  let desconto = roundToTwoDecimals(readPedidoVendaNumero(venda, 'valor_desconto'));

  if (subtotal <= 0) {
    subtotal = somarItensPedido(venda);
  }
  if (desconto <= 0 && subtotal > total + 0.009) {
    desconto = roundToTwoDecimals(subtotal - total);
  }
  if (subtotal <= 0 && (desconto > 0 || total > 0)) {
    subtotal = roundToTwoDecimals(total + desconto);
  }

  const temDesconto = desconto > 0.009;
  const percentualDesconto = temDesconto && subtotal > 0
    ? (desconto / subtotal) * 100
    : 0;
  const percentualDescontoLabel = formatPercentualDescontoPedido(desconto, subtotal);

  return {
    subtotal,
    desconto,
    total,
    temDesconto,
    percentualDesconto,
    percentualDescontoLabel,
  };
}
