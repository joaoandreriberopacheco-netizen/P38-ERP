import React from 'react';
import { ArrowLeftRight, Banknote, Building2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fluxoExtratoIconKind } from '@/lib/fluxoExtratoIconKind';

const ICONS = {
  card: CreditCard,
  bank: Building2,
  transfer: ArrowLeftRight,
  cash: Banknote,
};

/** `compact` — coluna mínima no extrato mobile v8 (ícone + grid 3 colunas). */
export default function FluxoExtratoRowIcon({ lancamento, className, compact = false }) {
  const kind = fluxoExtratoIconKind(lancamento);
  const Icon = ICONS[kind] || Building2;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center [&_svg]:stroke-current',
        compact
          ? 'h-8 w-8 rounded-[10px] bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]'
          : 'h-10 w-10 rounded-[10px] bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
        className,
      )}
      aria-hidden
    >
      <Icon className={cn('text-current', compact ? 'h-4 w-4' : 'h-5 w-5')} strokeWidth={2} />
    </span>
  );
}
