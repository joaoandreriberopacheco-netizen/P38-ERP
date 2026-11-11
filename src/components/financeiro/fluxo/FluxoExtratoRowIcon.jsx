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

export default function FluxoExtratoRowIcon({ lancamento, className }) {
  const kind = fluxoExtratoIconKind(lancamento);
  const Icon = ICONS[kind] || Building2;
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]',
        'bg-[#e8efe8] text-[#3d5a3d]',
        'dark:bg-[#383e47] dark:text-[#a4ce33]',
        className,
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
