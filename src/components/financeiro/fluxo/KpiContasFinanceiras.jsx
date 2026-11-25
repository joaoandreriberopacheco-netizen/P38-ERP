import React from 'react';
import { Wallet, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { P38_ACCENT } from './financeiroP38';
import {
  FinanceiroKpiItem,
  FinanceiroKpiStrip,
  formatKpiValor,
} from './FinanceiroKpiInline';
import { EXIBIR_UI_CONCILIACAO_FINANCEIRO } from '@/lib/financeiroConciliacaoUiFlags';

export default function KpiContasFinanceiras({ kpis, layout = 'card' }) {
  return (
    <FinanceiroKpiStrip layout={layout}>
      <FinanceiroKpiItem
        layout={layout}
        icon={Wallet}
        iconClass={P38_ACCENT}
        label="Saldo total"
        value={formatKpiValor(kpis.saldoTotal)}
        sub={kpis.qtdAtivas > 0 ? `${kpis.qtdAtivas} ativa${kpis.qtdAtivas > 1 ? 's' : ''}` : null}
      />
      <FinanceiroKpiItem
        layout={layout}
        icon={CheckCircle2}
        iconClass={P38_ACCENT}
        label="Contas"
        value={String(kpis.qtdTotal)}
        sub={kpis.qtdInativas > 0 ? `${kpis.qtdInativas} inativa${kpis.qtdInativas > 1 ? 's' : ''}` : null}
      />
      {EXIBIR_UI_CONCILIACAO_FINANCEIRO && kpis.pendencias > 0 && (
        <FinanceiroKpiItem
          layout={layout}
          icon={Clock}
          iconClass="text-amber-600 dark:text-amber-400"
          label="Conciliação"
          value={String(kpis.pendencias)}
          sub="pendente(s)"
        />
      )}
      {kpis.negativas > 0 && (
        <FinanceiroKpiItem
          layout={layout}
          icon={AlertTriangle}
          iconClass="text-red-600 dark:text-red-400"
          label="Negativas"
          value={String(kpis.negativas)}
          sub={formatKpiValor(kpis.saldoNegativo)}
          valueClass="text-red-600 dark:text-red-400"
        />
      )}
    </FinanceiroKpiStrip>
  );
}
