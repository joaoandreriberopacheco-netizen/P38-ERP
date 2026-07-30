import React from 'react';
import { ChevronLeft, ChevronRight, Repeat2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import { formatCompetenciaLabel, formatCurrency } from '@/lib/agefinPrevisaoCalculos';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho da previsão — pensado para viver DENTRO de `.p38-single-sheet`
 * (sem cartões aninhados; hierarquia Dado > Contexto).
 */
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

  const total = Number(totais?.total) || 0;
  const chips = [];

  if (countPlanejamento > 0) {
    chips.push(
      <span key="plan" className="inline-flex items-center gap-0.5">
        <FinanceiroSummaryChip className="p38-citrus-chip border-0">
          {countPlanejamento} em planejamento
        </FinanceiroSummaryChip>
        <P38HelpPopover label="Ajuda: modo planejamento" side="bottom" align="end" size="sm">
          <p className="font-medium text-foreground">Modo planejamento</p>
          <p className="text-muted-foreground">
            Valores estimados a partir das contas cadastradas, mesmo antes de abrir o mês.
          </p>
        </P38HelpPopover>
      </span>,
    );
  }
  if (totais?.comBoleto > 0) {
    chips.push(
      <FinanceiroSummaryChip key="pdf" className="p38-citrus-chip border-0">
        {totais.comBoleto} com boleto
      </FinanceiroSummaryChip>,
    );
  }
  if (totais?.semBoleto > 0) {
    chips.push(
      <FinanceiroSummaryChip key="auto" className="p38-citrus-chip border-0">
        {totais.semBoleto} sem boleto
      </FinanceiroSummaryChip>,
    );
  }
  if (totais?.vencidas > 0) {
    chips.push(
      <FinanceiroSummaryChip key="venc" className="text-red-800 border-0">
        {totais.vencidas} vencida(s)
      </FinanceiroSummaryChip>,
    );
  }

  return (
    <div className="p38-sheet-block space-y-4 min-w-0">
      <div className="flex min-w-0 items-center rounded-xl bg-[#F4F4F5] px-0.5 p38-labotrat-mes">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={onMesAnterior}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 px-1 py-2 text-center">
          <p className="p38-labotrat-mes-label truncate">{competenciaLabel}</p>
          <p className="p38-labotrat-mes-status mt-0.5 line-clamp-2 leading-snug">{statusMes}</p>
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

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-1.5 rounded-xl border-0 px-2 p38-labotrat-cta-soft"
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

      {/* KPI principal — Dado > Contexto */}
      <div className="min-w-0 pt-1">
        <p
          className={cn(
            'p38-sheet-kpi-value',
            total > 0 ? 'is-negative' : 'is-positive',
          )}
        >
          {total > 0 ? '−' : ''}
          {formatCurrency(Math.abs(total))}
        </p>
        <p className="p38-sheet-kpi-label">Comprometido no mês · previsto</p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold tabular-nums text-[#1B4D2E]">+R$ 0,00</span>
          <span className="text-[12px] font-normal text-[#71717A]">receitas</span>
          <span className="text-[15px] font-semibold tabular-nums text-[#111111]">
            −{formatCurrency(Math.abs(total)).replace(/^R\$\s*/, '')}
          </span>
          <span className="text-[12px] font-normal text-[#71717A]">previsto</span>
        </div>

        <div className="mt-3">
          <FinanceiroListaMeta
            total={count}
            totalLabel={count === 1 ? 'conta' : 'contas'}
            summaryChips={chips}
          />
        </div>
      </div>
    </div>
  );
}
