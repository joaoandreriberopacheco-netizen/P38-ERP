import { roundToTwoDecimals } from '@/lib/financialUtils';

function readPedidoVendaNumero(venda, field) {
  const raw = venda?.[field] ?? venda?.dados?.[field];
  const n = Number(raw);
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

/**
 * Normaliza subtotal, desconto e total — inclui fallback para registos legados em `dados`.
 */
export function resolvePedidoVendaTotais(venda) {
  const total = roundToTwoDecimals(readPedidoVendaNumero(venda, 'valor_total'));
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

  return {
    subtotal,
    desconto,
    total,
    temDesconto,
    percentualDesconto,
  };
}
