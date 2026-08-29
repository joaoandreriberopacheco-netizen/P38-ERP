import React from 'react';
import { cn } from '@/components/utils';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { resolvePedidoVendaTotais } from '@/lib/pedidoVendaValores';

/**
 * Subtotal riscado, desconto e total — usado nos cards de consulta de vendas.
 */
export default function VendaValorResumo({
  venda,
  size = 'sm',
  className,
  /** Quando filtrado por forma de pagamento, destaca o valor nessa forma. */
  valorDestaque,
  formaPagamentoLabel,
  pagamentoMisto = false,
}) {
  const { subtotal, desconto, total, temDesconto, percentualDesconto } = resolvePedidoVendaTotais(venda);
  const valorExibir = valorDestaque != null ? roundToTwoDecimals(valorDestaque) : total;
  const percentualDescontoLabel = temDesconto && percentualDesconto > 0
    ? percentualDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : null;

  const sizeMap = {
    sm: { total: 'sm', meta: 'text-[11px]' },
    md: { total: 'md', meta: 'text-xs' },
  };
  const sz = sizeMap[size] || sizeMap.sm;
  const dangerText = caixaClasses('danger').text;

  return (
    <div className={cn('flex flex-col items-end gap-0.5 text-right flex-shrink-0', className)}>
      {temDesconto && (
        <>
          <span className={cn(sz.meta, 'text-muted-foreground line-through tabular-nums whitespace-nowrap')}>
            {formatCaixaR(subtotal)}
          </span>
          <span className={cn(sz.meta, dangerText, 'tabular-nums leading-tight text-right')}>
            <span className="whitespace-nowrap">−{formatCaixaR(desconto)}</span>
            {percentualDescontoLabel ? (
              <span className="whitespace-nowrap"> ({percentualDescontoLabel}%)</span>
            ) : null}
          </span>
        </>
      )}
      <CaixaValorDisplay valor={valorExibir} tone="success" size={sz.total} />
      {pagamentoMisto && formaPagamentoLabel && valorDestaque != null && (
        <span className={cn(sz.meta, 'text-amber-700 dark:text-amber-300 max-w-[11rem] leading-snug')}>
          {formatCaixaR(valorDestaque)} em {formaPagamentoLabel}
          {total > valorExibir + 0.009 ? ` · venda ${formatCaixaR(total)}` : ''}
        </span>
      )}
    </div>
  );
}
