import React from 'react';
import { Banknote, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tipoContaFinanceiraEfetivo } from '@/lib/contaPagBank';

const TIPOS_BANCO = new Set(['Conta Bancária', 'Poupança', 'Investimento']);

export function contaTipoRotuloCurto(conta) {
  const tipo = tipoContaFinanceiraEfetivo(conta);
  if (tipo === 'Conta Bancária') return 'Banco';
  if (tipo === 'Caixa Físico') return 'Caixa';
  if (tipo === 'Carteira Digital') return 'Digital';
  return tipo || 'Conta';
}

export function contaEhTipoBanco(conta) {
  return TIPOS_BANCO.has(tipoContaFinanceiraEfetivo(conta));
}

/** Chip compacto — ícone banco ou caixa + rótulo curto do tipo. */
export default function ContaTipoChip({ conta, className, variant = 'chip' }) {
  const banco = contaEhTipoBanco(conta);
  const Icon = banco ? Landmark : Banknote;
  const label = contaTipoRotuloCurto(conta);
  const tipo = tipoContaFinanceiraEfetivo(conta);

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground',
          className,
        )}
        title={tipo}
      >
        <Icon className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground dark:border-white/10 dark:bg-[#383e47]/80',
        className,
      )}
      title={tipo}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
