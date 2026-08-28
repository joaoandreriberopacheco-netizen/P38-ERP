import React from 'react';
import { cn } from '@/components/utils';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';

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
  const subtotal = roundToTwoDecimals(Number(venda?.subtotal) || 0);
  const desconto = roundToTwoDecimals(Number(venda?.valor_desconto) || 0);
  const total = roundToTwoDecimals(Number(venda?.valor_total) || 0);
  const temDesconto = desconto > 0.009;
  const valorExibir = valorDestaque != null ? roundToTwoDecimals(valorDestaque) : total;

  const sizeMap = {
    sm: { total: 'sm', meta: 'text-[11px]' },
    md: { total: 'md', meta: 'text-xs' },
  };
  const sz = sizeMap[size] || sizeMap.sm;

  return (
    <div className={cn('flex flex-col items-end gap-0.5 text-right', className)}>
      {temDesconto && (
        <>
          <span className={cn(sz.meta, 'text-muted-foreground line-through tabular-nums')}>
            {formatCaixaR(subtotal)}
          </span>
          <span className={cn(sz.meta, caixaClasses('danger').text, 'tabular-nums')}>
            −{formatCaixaR(desconto)}
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
