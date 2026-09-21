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

/**
 * Par preço cheio (riscado) + líquido — inline para unitário ou totais de linha.
 */
export function OrcamentoPrecoPar({
  cheio = 0,
  liquido = 0,
  temDesconto = false,
  size = 'xs',
  className,
  liquidoClassName,
}) {
  const valorCheio = Number(cheio) || 0;
  const valorLiquido = Number(liquido) || 0;
  const mostrarDesconto = temDesconto && valorCheio > valorLiquido + 0.0001;

  const cheioCls = size === 'sm'
    ? 'text-[11px] text-muted-foreground line-through tabular-nums'
    : 'text-[10px] text-muted-foreground line-through tabular-nums';
  const liquidoCls = size === 'sm'
    ? 'text-sm font-semibold text-foreground tabular-nums'
    : 'text-xs font-semibold text-foreground tabular-nums';

  if (!mostrarDesconto) {
    return (
      <span className={cn(liquidoCls, className, liquidoClassName)}>
        {formatBrl(valorCheio || valorLiquido)}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-baseline gap-1 flex-wrap', className)}>
      <span className={cheioCls}>{formatBrl(valorCheio)}</span>
      <span className={cn(liquidoCls, liquidoClassName)}>{formatBrl(valorLiquido)}</span>
    </span>
  );
}

export function CupomItemLinhaPrecos({
  item,
  fmtCurrency,
  nomeFontSize = '13px',
  metaFontSize = '11px',
  totalFontSize = '14px',
}) {
  const fmt = fmtCurrency || formatBrl;
  const temDesconto = item?.tem_desconto;
  const qtd = Number(item?.qtd) || 0;
  const unidade = item?.unidade || 'UN';
  const totalCheio = Number(item?.total_cheio ?? (item?.preco_unit || 0) * qtd) || 0;
  const totalLiquido = Number(item?.total_liquido ?? totalCheio) || 0;
  const precoUnit = Number(item?.preco_unit) || 0;
  const precoUnitLiquido = Number(item?.preco_unit_liquido ?? precoUnit) || 0;

  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: '14px',
        padding: '10px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: nomeFontSize, lineHeight: 1.35, wordBreak: 'break-word' }}>
          {item.nome}
        </div>
        <div
          style={{
            fontSize: metaFontSize,
            color: '#6b7280',
            marginTop: '4px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '4px',
          }}
        >
          <span>{qtd} {unidade} ×</span>
          {temDesconto ? (
            <>
              <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>{fmt(precoUnit)}</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>{fmt(precoUnitLiquido)}</span>
            </>
          ) : (
            <span>{fmt(precoUnit)}</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {temDesconto ? (
          <CupomTotalComDesconto
            subtotal={totalCheio}
            total={totalLiquido}
            valorDesconto={totalCheio - totalLiquido}
            cheioFontSize="10px"
            finalFontSize={totalFontSize}
          />
        ) : (
          <div style={{ fontWeight: 700, fontSize: totalFontSize, whiteSpace: 'nowrap', textAlign: 'right' }}>
            {fmt(totalCheio)}
          </div>
        )}
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
