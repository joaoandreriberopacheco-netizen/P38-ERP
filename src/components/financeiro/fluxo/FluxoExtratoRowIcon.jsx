import React from 'react';
import { ArrowLeftRight, Banknote, CreditCard, Landmark, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fluxoExtratoIconKind } from '@/lib/fluxoExtratoIconKind';
import { extratoTransferenciaInternaCasa } from '@/lib/financialUtils';
import { P38_EXTRATO_V8_TRANSFER_INTERNA_ICON_TILE } from './financeiroP38';

/** CMV — flag no lançamento base (linhas sintéticas de transferência podem embutir a perna). */
export function extratoLancamentoTemCmv(lancamento) {
  if (!lancamento) return false;
  if (lancamento.is_custo_mercadoria === true) return true;
  const base =
    lancamento._lancamentoDespesa ||
    lancamento._lancamentoReceita ||
    lancamento._lancamentoTransferencia;
  return base?.is_custo_mercadoria === true;
}

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
  const cmv = extratoLancamentoTemCmv(lancamento);
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center [&_svg]:stroke-current',
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
      aria-hidden={!cmv}
      title={cmv ? 'Custo de mercadoria (CMV)' : undefined}
    >
      <Icon
        className={cn('text-current', compact ? 'h-3 w-3' : 'h-5 w-5')}
        strokeWidth={compact ? 2.25 : 2}
      />
      {cmv ? (
        <span
          className={cn(
            'pointer-events-none absolute flex items-center justify-center rounded-full bg-[#f4f5f7] text-[#3d5a3d] ring-1 ring-[#3d5a3d]/15 dark:bg-background dark:text-[#a4ce33] dark:ring-[#a4ce33]/25',
            compact ? '-bottom-1 -right-1 h-[11px] w-[11px]' : '-bottom-0.5 -right-0.5 h-4 w-4',
          )}
          aria-label="CMV"
        >
          <ShoppingCart
            className={cn(compact ? 'h-[7px] w-[7px]' : 'h-2.5 w-2.5')}
            strokeWidth={2.5}
          />
        </span>
      ) : null}
    </span>
  );
}
