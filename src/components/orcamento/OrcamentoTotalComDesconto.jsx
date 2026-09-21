import React from 'react';
import { cn } from '@/lib/utils';

const SIZE_STYLES = {
  sm: {
    cheio: 'text-[10px] text-muted-foreground line-through tabular-nums',
    final: 'text-sm font-bold text-foreground tabular-nums',
  },
  md: {
    cheio: 'text-xs text-muted-foreground line-through tabular-nums',
    final: 'text-xl font-bold text-foreground font-glacial tabular-nums',
  },
  lg: {
    cheio: 'text-sm text-muted-foreground line-through tabular-nums',
    final: 'text-2xl font-bold text-foreground font-glacial tabular-nums',
  },
};

function formatBrl(value) {
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Exibe total com preço cheio riscado quando há desconto no orçamento.
 */
export default function OrcamentoTotalComDesconto({
  subtotal = 0,
  total = 0,
  valorDesconto = 0,
  size = 'md',
  align = 'end',
  className,
  cheioClassName,
  finalClassName,
}) {
  const temDesconto = Number(valorDesconto) > 0;
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5',
        align === 'end' ? 'items-end text-right' : 'items-start text-left',
        className,
      )}
    >
      {temDesconto && (
        <span className={cn(styles.cheio, cheioClassName)}>
          {formatBrl(subtotal)}
        </span>
      )}
      <span className={cn(styles.final, finalClassName)}>
        {formatBrl(total)}
      </span>
    </div>
  );
}

export function CupomTotalComDesconto({
  subtotal = 0,
  total = 0,
  valorDesconto = 0,
  cheioFontSize = '12px',
  finalFontSize = '22px',
  align = 'right',
}) {
  const temDesconto = Number(valorDesconto) > 0;
  const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ textAlign: align }}>
      {temDesconto && (
        <div style={{ fontSize: cheioFontSize, color: '#9ca3af', textDecoration: 'line-through', lineHeight: 1.2 }}>
          {fmt(subtotal)}
        </div>
      )}
      <div style={{ fontSize: finalFontSize, fontWeight: 700, lineHeight: 1.1 }}>
        {fmt(total)}
      </div>
    </div>
  );
}

export function orcamentoTotalComDescontoInlineStyle({
  subtotal = 0,
  total = 0,
  valorDesconto = 0,
  cheioFontSize = '12px',
  finalFontSize = '22px',
} = {}) {
  const temDesconto = Number(valorDesconto) > 0;
  const fmt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!temDesconto) {
    return {
      html: `<div style="font-size:${finalFontSize};font-weight:700;line-height:1.1;">${fmt(total)}</div>`,
    };
  }

  return {
    html: `
      <div style="font-size:${cheioFontSize};color:#9ca3af;text-decoration:line-through;line-height:1.2;">${fmt(subtotal)}</div>
      <div style="font-size:${finalFontSize};font-weight:700;line-height:1.1;">${fmt(total)}</div>
    `,
  };
}
