import React from 'react';
import { ChevronLeft, ChevronRight, Repeat2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import FinanceiroResumoBar from '@/components/financeiro/fluxo/FinanceiroResumoBar';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import { P38_KPI_SHELL, P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { formatCompetenciaLabel } from '@/lib/agefinPrevisaoCalculos';
import { cn } from '@/lib/utils';

export default function AgefinPrevisaoCabecalho({
  competenciaMes,
  onMesAnterior,
  onMesProximo,
  onAbrirMes,
  onDesfazerAbrirMes,
  saving = false,
  hasLancamentosMes = false,
  mesFuturo = false,
  totais,
  count = 0,
  countPlanejamento = 0,
}) {
  const competenciaLabel = formatCompetenciaLabel(competenciaMes);
  const statusMes = mesFuturo
    ? 'Modo planejamento — valores estimados'
    : hasLancamentosMes
      ? 'Mês aberto no financeiro'
      : 'Mês ainda não aberto';

  const chips = [];

  if (countPlanejamento > 0) {
    chips.push(
      <span key="plan" className="inline-flex items-center gap-0.5">
        <FinanceiroSummaryChip className="text-cyan-800 dark:text-cyan-300">
          {countPlanejamento} em planejamento
        </FinanceiroSummaryChip>
        <P38HelpPopover label="Ajuda: modo planejamento" side="bottom" align="end" size="sm">
          <p className="font-medium text-foreground">Modo planejamento</p>
          <p className="text-muted-foreground">
            Valores estimados a partir das contas cadastradas, mesmo antes de abrir o mês.
          </p>
          <p className="text-muted-foreground">
            {mesFuturo
              ? 'Este mês ainda não precisa estar aberto para consultar os valores.'
              : 'Abra o mês quando quiser gerar as contas; depois edite valor e vencimento à mão e vincule o boleto se quiser.'}
          </p>
        </P38HelpPopover>
      </span>,
    );
  }
  if (totais?.comBoleto > 0) {
    chips.push(
      <FinanceiroSummaryChip key="pdf" className="text-emerald-800 dark:text-emerald-300">
        {totais.comBoleto} com boleto
      </FinanceiroSummaryChip>,
    );
  }
  if (totais?.semBoleto > 0) {
    chips.push(
      <FinanceiroSummaryChip key="auto" className="text-amber-800 dark:text-amber-300">
        {totais.semBoleto} sem boleto
      </FinanceiroSummaryChip>,
    );
  }
  if (totais?.vencidas > 0) {
    chips.push(
      <FinanceiroSummaryChip key="venc" className="text-red-800 dark:text-red-300">
        {totais.vencidas} vencida(s)
      </FinanceiroSummaryChip>,
    );
  }

  return (
    <div className={cn(P38_KPI_SHELL, 'p38-labotrat-frost space-y-2.5 sm:space-y-3 min-w-0')}>
      <div className="flex items-stretch gap-2 min-w-0">
        <div className={cn('flex flex-1 min-w-0 items-center rounded-xl px-0.5 p38-labotrat-mes', P38_FIELD_SURFACE)}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onMesAnterior}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0 px-1 py-2 text-center">
            <p className="p38-labotrat-mes-label text-sm tracking-wide sm:text-base truncate">
              {competenciaLabel}
            </p>
            <p className="p38-labotrat-mes-status text-[10px] mt-0.5 leading-snug line-clamp-2">
              {statusMes}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onMesProximo}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-1.5 rounded-xl px-2"
          onClick={onDesfazerAbrirMes}
          disabled={saving || !hasLancamentosMes}
          title="Desfazer abrir mês"
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs sm:text-sm">Desfazer</span>
        </Button>
        <Button
          size="sm"
          className="h-10 gap-1.5 rounded-xl px-2 p38-labotrat-cta"
          onClick={onAbrirMes}
          disabled={saving}
          title="Abrir mês"
        >
          <Repeat2 className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs sm:text-sm">Abrir mês</span>
        </Button>
      </div>

      <div className="space-y-2 border-t border-border/40 pt-2.5 sm:pt-3 min-w-0">
        <FinanceiroResumoBar
          receitas={0}
          despesas={totais?.total || 0}
          variacao={-(totais?.total || 0)}
          saldo={totais?.total || 0}
          saldoComSinal
          labels={{
            receitas: '—',
            despesas: 'Previsto',
            saldo: 'Comprometido',
          }}
        />
        <FinanceiroListaMeta
          total={count}
          totalLabel={count === 1 ? 'conta' : 'contas'}
          summaryChips={chips}
          className="p38-labotrat-frost"
        />
      </div>
    </div>
  );
}
