import React from 'react';
import { TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceiroResumoBar from './FinanceiroResumoBar';
import { formatKpiValor } from './FinanceiroKpiInline';

/** Faixa única — KPIs do Fluxo de Caixa no header. */
export default function KpiFluxoBar({
  kpis,
  periodoLabel,
  mostrarProgramadas = false,
  saldoPrevisto,
  aReceber = 0,
  aPagar = 0,
  saldosCarteiraProntos = false,
}) {
  return (
    <div className="space-y-2">
      <FinanceiroResumoBar
        receitas={kpis.entrou}
        despesas={kpis.saiu}
        variacao={kpis.saldo}
        saldo={kpis.saldoContas}
        saldoPronto={saldosCarteiraProntos}
        periodoLabel={periodoLabel}
        className="pb-0.5 md:pb-0.5"
      />
      {mostrarProgramadas && saldoPrevisto != null && (
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/30 bg-muted/30 px-2.5 py-2 text-[11px] dark:border-white/10 dark:bg-[#26262e]/50 md:text-xs',
          )}
          title={`A receber ${formatKpiValor(aReceber)} · A pagar ${formatKpiValor(aPagar)} · Saldo previsto se tudo for realizado`}
        >
          <span className="inline-flex items-center gap-1 tabular-nums text-[#4A5D23] dark:text-[#a4ce33]">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            +{formatKpiValor(aReceber)}
            <span className="text-muted-foreground font-normal">a receber</span>
          </span>
          <span className="text-muted-foreground/40" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-foreground/80">
            −{formatKpiValor(aPagar)}
            <span className="text-muted-foreground font-normal">a pagar</span>
          </span>
          <span className="text-muted-foreground/40" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Previsto {formatKpiValor(saldoPrevisto)}
          </span>
        </div>
      )}
    </div>
  );
}
