import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKpiValor } from './FinanceiroKpiInline';

function ResumoSegment({ icon: Icon, value, valueClass, iconClass }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 tabular-nums text-[11px] font-semibold md:text-xs',
        valueClass,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0 md:h-4 md:w-4', iconClass ?? valueClass)} aria-hidden />
      {value}
    </span>
  );
}

/** Coluna fixa — mobile balanço diário (ícone e valor sempre na mesma posição). */
function ResumoGridCell({ icon: Icon, value, valueClass, iconClass, label }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-start gap-1 px-0.5">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClass ?? valueClass)} aria-hidden />
      <span
        className={cn(
          'w-full text-center text-[9px] font-semibold leading-tight tabular-nums whitespace-nowrap sm:text-[10px] md:text-[11px]',
          valueClass,
        )}
      >
        {value}
      </span>
      {label ? (
        <span className="w-full truncate text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Faixa compacta — receitas, despesas, variação (md+) e saldo.
 * variant balancoDia: mobile em grelha 3 colunas fixas (sem variação).
 */
export default function FinanceiroResumoBar({
  receitas = 0,
  despesas = 0,
  variacao,
  saldo,
  saldoPronto = true,
  saldoComSinal = false,
  periodoLabel,
  variant = 'default',
  labels = {},
  className,
}) {
  const variacaoVal = variacao ?? receitas - despesas;
  const variacaoPos = variacaoVal >= 0;
  const posClass = 'text-[#4A5D23] dark:text-[#a4ce33]';
  const negClass = 'text-red-600 dark:text-red-400';
  const isBalancoDia = variant === 'balancoDia';

  const saldoCarregando = !saldoPronto;
  const saldoExibir = saldoPronto && saldo != null ? saldo : null;
  const saldoDisplay = saldoCarregando
    ? '…'
    : saldoExibir != null
      ? saldoComSinal
        ? `${saldoExibir >= 0 ? '+' : '−'}${formatKpiValor(Math.abs(saldoExibir))}`
        : formatKpiValor(saldoExibir)
      : null;
  const saldoSegmentClass = saldoCarregando
    ? 'text-muted-foreground animate-pulse'
    : 'text-foreground';
  const saldoIconClass = saldoCarregando ? 'text-muted-foreground' : 'text-foreground/70';

  const title = [
    periodoLabel ? `Período: ${periodoLabel}` : null,
    `Receitas ${formatKpiValor(receitas)}`,
    `Despesas ${formatKpiValor(despesas)}`,
    `Variação ${variacaoPos ? '+' : '−'}${formatKpiValor(Math.abs(variacaoVal))}`,
    saldoCarregando
      ? 'Saldo a calcular'
      : saldoExibir != null
        ? `Saldo ${saldoComSinal ? saldoDisplay : formatKpiValor(saldoExibir)}`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (isBalancoDia) {
    return (
      <>
        {/* Mobile: 3 colunas fixas — leitura vertical estável ao rolar */}
        <div
          className={cn(
            'grid w-full grid-cols-3 gap-1.5 rounded-lg px-1 py-3 md:hidden',
            className,
          )}
          title={title}
        >
          <ResumoGridCell
            icon={TrendingUp}
            value={`+${formatKpiValor(receitas)}`}
            valueClass={posClass}
            label={labels.receitas}
          />
          <ResumoGridCell
            icon={TrendingDown}
            value={`−${formatKpiValor(despesas)}`}
            valueClass={despesas > 0 ? negClass : 'text-muted-foreground/70'}
            label={labels.despesas}
          />
          {(saldoDisplay != null || saldoCarregando) ? (
            <ResumoGridCell
              icon={Wallet}
              value={saldoDisplay ?? '…'}
              valueClass={saldoSegmentClass}
              iconClass={saldoIconClass}
              label={labels.saldo}
            />
          ) : (
            <div aria-hidden />
          )}
        </div>

        {/* Desktop: faixa inline */}
        <div
          className={cn(
            'hidden min-w-0 items-center gap-3 overflow-x-auto md:flex',
            '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            className,
          )}
          title={title}
        >
          <ResumoSegment icon={TrendingUp} value={`+${formatKpiValor(receitas)}`} valueClass={posClass} />
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            ·
          </span>
          <ResumoSegment
            icon={TrendingDown}
            value={`−${formatKpiValor(despesas)}`}
            valueClass={despesas > 0 ? negClass : 'text-muted-foreground/70'}
          />
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            ·
          </span>
          <ResumoSegment
            icon={ArrowUpDown}
            value={`${variacaoPos ? '+' : '−'}${formatKpiValor(Math.abs(variacaoVal))}`}
            valueClass={variacaoPos ? posClass : negClass}
          />
          {(saldoDisplay != null || saldoCarregando) && (
            <>
              <span className="shrink-0 text-muted-foreground/35" aria-hidden>
                ·
              </span>
              <ResumoSegment
                icon={Wallet}
                value={saldoDisplay ?? '…'}
                valueClass={saldoSegmentClass}
                iconClass={saldoIconClass}
              />
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      {periodoLabel && !isBalancoDia && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/40 dark:text-foreground/45">
          {periodoLabel}
        </p>
      )}
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 md:gap-3 md:overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden',
        )}
        title={title}
      >
      <ResumoSegment icon={TrendingUp} value={`+${formatKpiValor(receitas)}`} valueClass={posClass} />
      <span className="shrink-0 text-muted-foreground/35" aria-hidden>
        ·
      </span>
      <ResumoSegment
        icon={TrendingDown}
        value={`−${formatKpiValor(despesas)}`}
        valueClass={despesas > 0 ? negClass : 'text-muted-foreground/70'}
      />
      <span className="hidden shrink-0 text-muted-foreground/35 md:inline" aria-hidden>
        ·
      </span>
      <span className="hidden md:contents">
        <ResumoSegment
          icon={ArrowUpDown}
          value={`${variacaoPos ? '+' : '−'}${formatKpiValor(Math.abs(variacaoVal))}`}
          valueClass={variacaoPos ? posClass : negClass}
        />
      </span>
      {(saldoDisplay != null || saldoCarregando) && (
        <>
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            ·
          </span>
          <ResumoSegment
            icon={Wallet}
            value={saldoDisplay ?? '…'}
            valueClass={saldoSegmentClass}
            iconClass={saldoIconClass}
          />
        </>
      )}
      </div>
    </div>
  );
}
