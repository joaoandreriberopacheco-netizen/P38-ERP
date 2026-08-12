import React from 'react';
import { Wallet, Layers, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKpiValor } from './FinanceiroKpiInline';
import { P38_ACCENT } from './financeiroP38';

function KpiSegment({ icon: Icon, value, valueClass, iconClass }) {
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

/** Faixa compacta — Caixas e Bancos (saldo, contas, conciliação, negativas). */
export default function KpiContasBar({ kpis, saldosProntos = true }) {
  const saldoExibir = saldosProntos && kpis.saldoTotal != null;
  const saldoPos = (kpis.saldoTotal ?? 0) >= 0;
  const posClass = P38_ACCENT;
  const negClass = 'text-red-600 dark:text-red-400';
  const warnClass = 'text-amber-600 dark:text-amber-400';

  const title = [
    saldoExibir ? `Saldo ${formatKpiValor(kpis.saldoTotal)}` : 'Saldo a calcular',
    `${kpis.qtdTotal} conta${kpis.qtdTotal !== 1 ? 's' : ''}`,
    kpis.pendencias > 0 ? `${kpis.pendencias} pendente(s)` : null,
    kpis.negativas > 0 ? `${kpis.negativas} negativa(s)` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="flex min-w-0 items-center gap-2 md:gap-3 md:overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
      title={title}
    >
      <KpiSegment
        icon={Wallet}
        value={saldoExibir ? formatKpiValor(kpis.saldoTotal) : '…'}
        valueClass={saldoExibir ? (saldoPos ? posClass : negClass) : 'text-muted-foreground animate-pulse'}
      />
      <span className="shrink-0 text-muted-foreground/35" aria-hidden>
        ·
      </span>
      <KpiSegment
        icon={Layers}
        value={String(kpis.qtdTotal)}
        valueClass="text-foreground"
        iconClass="text-foreground/70"
      />
      {kpis.pendencias > 0 && (
        <>
          <span className="shrink-0 text-muted-foreground/35" aria-hidden>
            ·
          </span>
          <KpiSegment icon={Clock} value={String(kpis.pendencias)} valueClass={warnClass} />
        </>
      )}
      {kpis.negativas > 0 && (
        <>
          <span className="hidden shrink-0 text-muted-foreground/35 md:inline" aria-hidden>
            ·
          </span>
          <span className="hidden md:contents">
            <KpiSegment icon={AlertTriangle} value={String(kpis.negativas)} valueClass={negClass} />
          </span>
        </>
      )}
    </div>
  );
}
