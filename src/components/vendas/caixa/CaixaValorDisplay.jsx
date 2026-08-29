import React from 'react';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

/** Mesmo padrão de `ListaLancamentos` / Fluxo de Caixa */
export function formatCaixaR(v) {
  return `R$ ${(Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SIGN_CLASS = {
  success: p38Accent.success.text,
  danger: p38Accent.danger.text,
  info: p38Accent.info.text,
  warning: 'text-amber-700 dark:text-amber-300',
};

const SIZE_CLASS = {
  sm: 'text-base font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-2xl font-bold',
};

/**
 * @param {'success'|'danger'|'info'|'warning'|'neutral'} tone
 * @param {boolean} signed — exibe +/− (como fluxo de caixa)
 * @param {boolean} reserveSignSpace — coluna fixa para alinhar decimais entre linhas
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
    ? (tone === 'info'
      ? SIGN_CLASS.info
      : tone === 'warning'
        ? SIGN_CLASS.warning
      : isEntrada
        ? SIGN_CLASS.success
        : SIGN_CLASS.danger)
    : '';

  if (reserveSignSpace || showSign) {
    return (
      <span
        className={`inline-flex items-baseline justify-end tabular-nums ${sizeCls} ${className}`}
        data-caixa-valor-display={tone !== 'neutral' ? tone : undefined}
      >
        <span
          className={`w-[0.75em] shrink-0 text-right ${showSign ? signClass : 'invisible select-none'}`}
          data-caixa-valor-tone={showSign ? tone : undefined}
          aria-hidden={!showSign}
        >
          {sign}
        </span>
        <span>{formatCaixaR(n)}</span>
      </span>
    );
  }

  return (
    <span className={`tabular-nums ${sizeCls} ${className}`}>
      {formatCaixaR(n)}
    </span>
  );
}
