import React, { useMemo } from 'react';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { P38_KPI_SHELL } from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';
import { calcularProjecaoAgefin, formatCompetenciaLabel } from '@/lib/agefinPrevisaoCalculos';

export default function AgefinPrevisaoProjecao({ modelos, competenciaInicio, lancamentos = [] }) {
  const { meses, totalAno } = useMemo(
    () => calcularProjecaoAgefin(modelos, competenciaInicio, lancamentos),
    [modelos, competenciaInicio, lancamentos],
  );

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      <div className={cn(P38_KPI_SHELL, 'p-3 sm:p-4')}>
        <p className="text-xs tracking-wide text-muted-foreground">Total 12 meses</p>
        <p className="text-xl sm:text-2xl font-semibold tabular-nums">
          {formatFinanceiroValor(totalAno)}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">
          Parte de {formatCompetenciaLabel(competenciaInicio)}. Se editares o mês atual, os meses
          seguintes espelham esse valor.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 overflow-x-auto -mx-0.5">
        <table className="w-full min-w-[280px] text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-2.5 sm:px-3 py-2 font-medium text-muted-foreground">Mês</th>
              <th className="text-right px-2.5 sm:px-3 py-2 font-medium text-muted-foreground">
                Contas
              </th>
              <th className="text-right px-2.5 sm:px-3 py-2 font-medium text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.competencia} className="border-b border-border/30 last:border-0">
                <td className="px-2.5 sm:px-3 py-2.5 whitespace-nowrap">
                  {formatCompetenciaLabel(m.competencia)}
                </td>
                <td className="px-2.5 sm:px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {m.count}
                </td>
                <td className="px-2.5 sm:px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">
                  {formatFinanceiroValor(m.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
