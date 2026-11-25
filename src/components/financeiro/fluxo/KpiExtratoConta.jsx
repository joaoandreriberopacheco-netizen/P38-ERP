import React from 'react';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { P38_ACCENT } from './financeiroP38';
import {
  FinanceiroKpiItem,
  FinanceiroKpiSaldo,
  FinanceiroKpiStrip,
  formatKpiValor,
} from './FinanceiroKpiInline';

function KpiExtratoHelpTooltip({ kpis, saldoLabel, taxa }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Explicação dos valores"
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-[16rem] space-y-1.5 text-left text-[11px] leading-snug normal-case"
        >
          {kpis.saldoPeriodo != null && (
            <p>
              Resultado do período:{' '}
              <span className="font-semibold tabular-nums">
                {kpis.saldoPeriodo >= 0 ? '+' : '−'}
                {formatKpiValor(Math.abs(kpis.saldoPeriodo))}
              </span>
            </p>
          )}
          {kpis.entradas > 0 && (
            <p>Proporção saídas ÷ entradas no período: {taxa}% (a barrinha trava em 100%).</p>
          )}
          <p>
            &quot;{saldoLabel}&quot; é o total na conta; &quot;Hoje&quot; na lista é só o movimento daquele dia.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function KpiExtratoConta({ kpis, layout = 'card', saldoLabel = 'Saldo na conta' }) {
  const taxa = kpis.entradas > 0 ? (kpis.saidas / kpis.entradas * 100).toFixed(0) : 0;
  const helpTooltip = <KpiExtratoHelpTooltip kpis={kpis} saldoLabel={saldoLabel} taxa={taxa} />;
  const saldoFmt = `${kpis.saldo >= 0 ? '+' : '−'}${formatKpiValor(Math.abs(kpis.saldo))}`;

  if (layout === 'oneline') {
    return (
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0 text-[11px] leading-snug text-muted-foreground">
        <span className="shrink-0">
          Entradas{' '}
          <span className="font-semibold tabular-nums text-foreground">{formatKpiValor(kpis.entradas)}</span>
        </span>
        <span className="shrink-0 text-foreground/25" aria-hidden>
          ·
        </span>
        <span className="shrink-0">
          Saídas{' '}
          <span className="font-semibold tabular-nums text-foreground">{formatKpiValor(kpis.saidas)}</span>
        </span>
        <span className="shrink-0 text-foreground/25" aria-hidden>
          ·
        </span>
        <span className="min-w-0">
          Saldo{' '}
          <span
            className={`font-semibold tabular-nums ${kpis.saldo >= 0 ? P38_ACCENT : 'text-foreground/80'}`}
          >
            {saldoFmt}
          </span>
        </span>
      </p>
    );
  }

  return (
    <div className={layout === 'stack' ? 'relative' : undefined}>
      {layout === 'stack' && <div className="absolute right-2 top-2 z-10">{helpTooltip}</div>}
      <FinanceiroKpiStrip layout={layout}>
        <FinanceiroKpiItem
          layout={layout}
          icon={TrendingUp}
          iconClass={P38_ACCENT}
          label="Entradas"
          value={formatKpiValor(kpis.entradas)}
        />
        <FinanceiroKpiItem
          layout={layout}
          icon={TrendingDown}
          iconClass="text-foreground/50"
          label="Saídas"
          value={formatKpiValor(kpis.saidas)}
        />
        <FinanceiroKpiSaldo
          layout={layout}
          label={saldoLabel}
          value={
            <>
              {kpis.saldo >= 0 ? '+' : '−'}
              {formatKpiValor(Math.abs(kpis.saldo))}
            </>
          }
          percent={taxa}
          positive={kpis.saldo >= 0}
        />
        {layout !== 'stack' && helpTooltip}
      </FinanceiroKpiStrip>
    </div>
  );
}
