import React from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fluxoExtratoIconKind } from '@/lib/fluxoExtratoIconKind';
import { extratoTransferenciaInternaCasa } from '@/lib/financialUtils';
import { P38_EXTRATO_V8_TRANSFER_INTERNA_ICON_TILE } from './financeiroP38';

/** `cash` — cédula (Banknote) para Caixa Geral / dinheiro; `bank` — Landmark (colunas). */
const ICONS = {
  card: CreditCard,
  bank: Landmark,
  transfer: ArrowLeftRight,
  cash: Banknote,
};

/** `compact` — coluna mínima no extrato mobile v8 (ícone + grid 3 colunas). */
export default function FluxoExtratoRowIcon({
  lancamento,
  className,
  compact = false,
  contasSel = null,
}) {
  const kind = fluxoExtratoIconKind(lancamento);
  const Icon = ICONS[kind] || Landmark;
  const transferInterna = kind === 'transfer' && extratoTransferenciaInternaCasa(lancamento, contasSel);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center [&_svg]:stroke-current',
        compact
          ? cn(
              'h-4 w-4 rounded-md p-0',
              transferInterna
                ? P38_EXTRATO_V8_TRANSFER_INTERNA_ICON_TILE
                : 'bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
            )
          : cn(
              'h-10 w-10 rounded-[10px]',
              transferInterna
                ? P38_EXTRATO_V8_TRANSFER_INTERNA_ICON_TILE
                : 'bg-[#e8efe8] text-[#3d5a3d] dark:bg-[#383e47] dark:text-[#a4ce33]',
            ),
        className,
      )}
      aria-hidden
    >
      <Icon
        className={cn('text-current', compact ? 'h-3 w-3' : 'h-5 w-5')}
        strokeWidth={compact ? 2.25 : 2}
      />
    </span>
  );
}
