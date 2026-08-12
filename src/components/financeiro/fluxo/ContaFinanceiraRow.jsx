import React from 'react';
import { Clock, Eye, Edit, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38StatusPill } from '@/components/ui/p38-mobile-line';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import { getSaldoExibicaoConta } from '@/lib/saldoContaFinanceira';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

export default function ContaFinanceiraRow({
  conta,
  pendencias = 0,
  saldosCalculados,
  saldosProntos = true,
  onExtrato,
  onEdit,
  onAjuste,
  onConciliar,
  striped,
}) {
  const saldo = saldosProntos && saldosCalculados
    ? getSaldoExibicaoConta(conta, saldosCalculados)
    : null;
  const isNegativo = saldo != null && saldo < 0;
  const ativa = conta.ativo !== false;

  const subtitle = [conta.tipo, conta.banco].filter(Boolean).join(' · ');
  const valueSub = conta.is_caixa_pdv
    ? 'Dinheiro na gaveta'
    : conta.agencia
      ? `Ag ${conta.agencia}`
      : null;

  const handleClick = () => {
    if (pendencias > 0) onConciliar?.(conta);
    else onExtrato?.(conta);
  };

  const borderAccent = isNegativo
    ? p38Accent.danger.border
    : ativa
      ? p38Accent.success.border
      : 'border-l-transparent';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group w-full border-b border-border/50 text-left font-din-1451 dark:border-white/10',
        'border-l-2 px-3 py-3 pr-2 sm:px-4',
        borderAccent,
        striped && 'bg-secondary/15 dark:bg-secondary/20',
        !ativa && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold uppercase leading-tight text-foreground sm:text-base">
            {conta.nome}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              'whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base',
              isNegativo ? 'text-red-600 dark:text-red-400' : 'text-foreground',
            )}
          >
            {saldosProntos && saldo != null
              ? formatFinanceiroValor(saldo)
              : <span className="text-muted-foreground animate-pulse">…</span>}
          </p>
          {valueSub && (
            <p className="mt-0.5 max-w-[7rem] truncate text-[10px] text-muted-foreground sm:max-w-none sm:text-xs">
              {valueSub}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <P38StatusPill tone={ativa ? 'success' : 'muted'} className="text-[10px]">
            {ativa ? 'Ativa' : 'Inativa'}
          </P38StatusPill>
          {pendencias > 0 && (
            <P38StatusPill tone="warning" className="max-w-[8.5rem] truncate text-[10px]">
              {pendencias} conc.
            </P38StatusPill>
          )}
          {conta.is_caixa_pdv && (
            <P38StatusPill tone="muted" className="text-[10px]">
              PDV
            </P38StatusPill>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          {pendencias > 0 && (
            <Clock className="mr-0.5 h-3.5 w-3.5 text-amber-500 md:hidden" aria-hidden />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExtrato?.(conta);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 sm:h-9 sm:w-9"
            aria-label="Extrato"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAjuste?.(conta);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 sm:h-9 sm:w-9"
            aria-label="Ajustar saldo"
          >
            <Scale className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(conta);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 sm:h-9 sm:w-9"
            aria-label="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
        </div>
      </div>
    </button>
  );
}
