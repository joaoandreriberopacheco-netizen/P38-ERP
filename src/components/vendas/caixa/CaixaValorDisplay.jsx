import React from 'react';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

/** Mesmo padrão de `ListaLancamentos` / Fluxo de Caixa */
export function formatCaixaR(v) {
  return `R$ ${(Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Sufixo +/− à direita — oliva suave no escuro para entradas; só saída (−) em vermelho */
const SIGN_CLASS_PLUS = 'text-muted-foreground dark:text-[#8F9A5C]';
const SIGN_CLASS_MINUS = p38Accent.danger.text;

const SIZE_CLASS = {
  sm: 'text-base font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-2xl font-bold',
};

/**
 * @param {'success'|'danger'|'info'|'warning'|'neutral'} tone
 * @param {boolean} signed — exibe +/− à direita do valor
 * @param {boolean} reserveSignSpace — coluna fixa à direita para alinhar decimais entre linhas
 */
export default function CaixaValorDisplay({
  valor,
  tone = 'neutral',
  signed = true,
  size = 'md',
  className = '',
  reserveSignSpace = false,
}) {
  const n = Math.abs(Number(valor) || 0);
  const sizeCls = SIZE_CLASS[size] || SIZE_CLASS.md;
  const showSign = signed && tone !== 'neutral';
  const isEntrada = tone === 'success' || tone === 'info' || tone === 'warning';
  const sign = showSign ? (isEntrada ? '+' : '−') : '+';
  const signClass = showSign
    ? (sign === '−' ? SIGN_CLASS_MINUS : SIGN_CLASS_PLUS)
    : '';

  if (reserveSignSpace || showSign) {
    return (
      <span className={`inline-flex items-baseline justify-end tabular-nums ${sizeCls} ${className}`}>
        <span>{formatCaixaR(n)}</span>
        <span
          className={`w-[0.75em] shrink-0 text-left pl-0.5 ${showSign ? signClass : 'invisible select-none'}`}
          aria-hidden={!showSign}
        >
          {sign}
        </span>
      </span>
    );
  }

  return (
    <span className={`tabular-nums ${sizeCls} ${className}`}>
      {formatCaixaR(n)}
    </span>
  );
}
