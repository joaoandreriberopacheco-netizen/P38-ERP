import React from 'react';
import { Clock, Edit, MoreVertical, Scale, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38StatusPill } from '@/components/ui/p38-mobile-line';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import { getSaldoExibicaoConta } from '@/lib/saldoContaFinanceira';
import { p38Accent } from '@/lib/p38ThemeSurfaces';

function stopClick(e) {
  e.preventDefault();
  e.stopPropagation();
}

export default function ContaFinanceiraRow({
  conta,
  pendencias = 0,
  saldosCalculados,
  saldosProntos = false,
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

  const borderAccent = isNegativo
    ? p38Accent.danger.border
    : ativa
      ? p38Accent.success.border
      : 'border-l-transparent';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onExtrato?.(conta)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExtrato?.(conta);
        }
      }}
      className={cn(
        'group w-full border-b border-border/50 text-left font-din-1451 dark:border-white/10',
        'border-l-2 px-3 py-3 pr-3 sm:px-4 cursor-pointer',
        borderAccent,
        striped && 'bg-secondary/15 dark:bg-secondary/20',
        !ativa && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold uppercase leading-snug text-foreground sm:truncate sm:text-[15px]">
            {conta.nome}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:block sm:text-right">
          <div className="min-w-0 text-right">
            <p
              className={cn(
                'text-[13px] font-semibold tabular-nums leading-tight whitespace-nowrap sm:text-sm md:text-base',
                isNegativo ? 'text-red-600 dark:text-red-400' : 'text-foreground',
              )}
            >
              {saldosProntos && saldo != null
                ? formatFinanceiroValor(saldo)
                : <span className="text-muted-foreground animate-pulse">…</span>}
            </p>
            {valueSub && (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
                {valueSub}
              </p>
            )}
          </div>
          <div
            className="flex shrink-0 items-center sm:hidden"
            onClick={stopClick}
            onKeyDown={stopClick}
          >
            {pendencias > 0 && (
              <Clock className="mr-1 h-3.5 w-3.5 text-amber-500" aria-hidden />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mais ações"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {pendencias > 0 && (
                  <DropdownMenuItem onClick={() => onConciliar?.(conta)}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Conciliar ({pendencias})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAjuste?.(conta)}>
                  <Scale className="mr-2 h-4 w-4" />
                  Ajustar saldo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit?.(conta)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

        <div
          className="hidden shrink-0 items-center sm:flex"
          onClick={stopClick}
          onKeyDown={stopClick}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                aria-label="Mais ações"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {pendencias > 0 && (
                <DropdownMenuItem onClick={() => onConciliar?.(conta)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Conciliar ({pendencias})
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onAjuste?.(conta)}>
                <Scale className="mr-2 h-4 w-4" />
                Ajustar saldo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit?.(conta)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
