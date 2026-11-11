import React from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fluxoExtratoIconKind } from '@/lib/fluxoExtratoIconKind';

/** `cash` — cédula (Banknote) para Caixa Geral / dinheiro; `bank` — Landmark (colunas). */
const ICONS = {
  card: CreditCard,
  bank: Landmark,
  transfer: ArrowLeftRight,
  cash: Banknote,
};

/** `compact` — coluna mínima no extrato mobile v8 (ícone + grid 3 colunas). */
export default function FluxoExtratoRowIcon({ lancamento, className, compact = false }) {
  const kind = fluxoExtratoIconKind(lancamento);
  const Icon = ICONS[kind] || Landmark;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center [&_svg]:stroke-current',
        compact
          ? 'h-6 w-6 rounded-[10px] bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]'
          : 'h-10 w-10 rounded-[10px] bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
        className,
      )}
      aria-hidden
    >
      <Icon className={cn('text-current', compact ? 'h-3 w-3' : 'h-5 w-5')} strokeWidth={2} />
    </span>
  );
}
