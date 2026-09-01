import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import {
  FinanceiroListaEstado,
  formatFinanceiroValor,
} from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { formatCompetenciaLabel, getCompetenciaAtual, shiftCompetencia } from '@/lib/budgetCalculos';
import {
  listarModelos as listarModelosBudget,
  listarCompetencias as listarCompetenciasBudget,
  listarLancamentosMes,
  listarLancamentosVencimentoMes,
  obterLucroBrutoCompetencia,
} from '@/lib/budgetService';
import { listarModelos as listarModelosFolha, listarCompetencias as listarCompetenciasFolha } from '@/lib/folhaPrevisaoService';
import {
  listarModelos as listarModelosAgefin,
  listarLancamentosCompetencia,
  listarLancamentosRecorrentes,
} from '@/lib/agefinPrevisaoService';
import { montarPlanoFinanceiroConsolidado } from '@/lib/planoFinanceiroConsolidado';
import { montarDemonstrativoDizimo } from '@/lib/dizimoCalculos';
import {
  carregarConfigDedutivelDizimo,
  salvarConfigDedutivelDizimo,
} from '@/lib/dizimoConfigStorage';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';

function CelulaValor({ valor, positivo, className, prefix = '' }) {
  const n = Number(valor) || 0;
  const cls =
    positivo === true
      ? 'text-emerald-700 dark:text-emerald-400'
      : positivo === false
        ? 'text-red-700 dark:text-red-400'
        : '';
  return (
    <span className={cn('tabular-nums font-medium', cls, className)}>
      {prefix}
      {formatFinanceiroValor(n)}
    </span>
  );
}

function LinhaResumo({ label, valor, tipo = 'normal', sublabel, destaque = false }) {
  const prefix = tipo === 'soma' ? '+' : tipo === 'subtrai' ? '−' : '';
  const positivo =
    tipo === 'soma' ? Number(valor) >= 0 : tipo === 'resultado' ? Number(valor) >= 0 : undefined;

  return (
    <tr className={cn('border-b border-border/40', destaque && 'bg-muted/20 font-semibold')}>
      <td className="py-3 pl-3 pr-3 text-sm">
        <span className={destaque ? 'font-semibold' : 'font-medium'}>{label}</span>
        {sublabel ? (
          <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{sublabel}</span>
        ) : null}
      </td>
      <td className="py-3 pl-3 pr-3 text-right text-sm whitespace-nowrap">
        <CelulaValor valor={valor} positivo={positivo} prefix={prefix} />
      </td>
    </tr>
  );
}

function BlocoDespesaDizimo({ bloco, onConfigChange }) {
  return (
    <div className={cn('rounded-2xl p-3 lg:p-4 space-y-3', P38_FIELD_SURFACE)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{bloco.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            Valor planejado: {formatFinanceiroValor(bloco.valorBruto)}
          </p>
        </div>
        <DedutibilidadeBlocoToggle value={bloco.config} onChange={onConfigChange} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground">Dedutível na base</p>
          <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
            {formatFinanceiroValor(bloco.valorDedutivel)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/30 px-3 py-2">
          <p className="text-muted-foreground">Fora da base</p>
          <p className="font-semibold tabular-nums mt-0.5">
            {formatFinanceiroValor(bloco.valorNaoDedutivel)}
          </p>
        </div>
      </div>
    </div>
  );
}

function CartaoDizimo({ demonstrativo }) {
  return (
    <div
      className={cn(
        'rounded-2xl p-5 lg:p-6 text-center space-y-2 border border-emerald-500/20',
        'bg-gradient-to-b from-emerald-500/5 to-transparent',
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Dízimo — {demonstrativo.percentualDizimo}%</p>
      <p className="text-3xl sm:text-4xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
        {formatFinanceiroValor(demonstrativo.dizimo)}
      </p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Primeiros frutos sobre o lucro líquido operacional estimado, após as deduções configuradas.
      </p>
    </div>
  );
}

function TabelaResumoDizimo({ demonstrativo }) {
  const margem = demonstrativo.margemDetalhe;

  return (
    <div className={cn('overflow-x-auto rounded-2xl p-2 lg:p-3', P38_FIELD_SURFACE)}>
      <table className="w-full min-w-[320px] text-left">
        <thead>
          <tr className="border-b border-border/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pl-3 pr-3 font-medium">Demonstrativo</th>
            <th className="py-3 pl-3 pr-3 text-right font-medium w-36">Valor</th>
          </tr>
        </thead>
        <tbody>
          <LinhaResumo label="Lucro bruto (margem)" valor={demonstrativo.lucroBruto} tipo="soma" destaque />
          {margem?.receita_liquida > 0 ? (
            <tr className="border-b border-border/20 text-[11px] text-muted-foreground">
              <td className="py-1 pl-4 pr-3" colSpan={2}>
                Receita líq. {formatFinanceiroValor(margem.receita_liquida)} · CMV{' '}
                {formatFinanceiroValor(margem.custo_total)}
              </td>
            </tr>
          ) : null}

          <tr className="border-b border-border/30">
            <td className="py-2 pl-3 pr-3 text-[11px] uppercase tracking-wide text-muted-foreground" colSpan={2}>
              Despesas operacionais (dedutíveis)
            </td>
          </tr>
          {demonstrativo.blocos.map((bloco) => (
            <LinhaResumo
              key={bloco.id}
              label={bloco.label}
              valor={bloco.valorDedutivel}
              tipo="subtrai"
              sublabel={
                bloco.valorNaoDedutivel > 0
                  ? `${formatFinanceiroValor(bloco.valorBruto)} planejado · ${formatFinanceiroValor(bloco.valorNaoDedutivel)} fora da base`
                  : undefined
              }
            />
          ))}
          <LinhaResumo
            label="Total dedutível"
            valor={demonstrativo.totalDedutivel}
            tipo="subtrai"
            destaque
          />

          <LinhaResumo
            label="Lucro líquido operacional estimado"
            valor={demonstrativo.lucroLiquidoOperacional}
            tipo="resultado"
            destaque
          />
        </tbody>
      </table>
    </div>
  );
}

export default function DizimoPlano() {
  const [competencia, setCompetencia] = useState(getCompetenciaAtual);
  const [configBlocos, setConfigBlocos] = useState(() => carregarConfigDedutivelDizimo(getCompetenciaAtual()));

  useEffect(() => {
    setConfigBlocos(carregarConfigDedutivelDizimo(competencia));
  }, [competencia]);

  const compLabel = formatCompetenciaLabel(competencia);

  const { data: modelosAgefin = [], isLoading: loadingAgefin } = useQuery({
    queryKey: ['dizimo', 'agefin-modelos'],
    queryFn: listarModelosAgefin,
    staleTime: 30_000,
  });

  const { data: lancamentosRecorrentesAgefin = [], isLoading: loadingRecorrentesAgefin } = useQuery({
    queryKey: ['dizimo', 'agefin-recorrentes'],
    queryFn: listarLancamentosRecorrentes,
    staleTime: 60_000,
  });

  const { data: modelosFolha = [], isLoading: loadingFolha } = useQuery({
    queryKey: ['dizimo', 'folha-modelos'],
    queryFn: listarModelosFolha,
    staleTime: 60_000,
  });

  const { data: modelosBudget = [], isLoading: loadingBudget } = useQuery({
    queryKey: ['dizimo', 'budget-modelos'],
    queryFn: listarModelosBudget,
    staleTime: 60_000,
  });

  const { data: competenciasFolha = [], isLoading: loadingCompetenciasFolha } = useQuery({
    queryKey: ['dizimo', 'folha-competencias', competencia],
    queryFn: () => listarCompetenciasFolha(competencia),
    staleTime: 30_000,
  });

  const { data: competenciasBudget = [], isLoading: loadingCompetenciasBudget } = useQuery({
    queryKey: ['dizimo', 'budget-competencias', competencia],
    queryFn: () => listarCompetenciasBudget(competencia),
    staleTime: 30_000,
  });

  const { data: lancamentosAgefin = [], isLoading: loadingLancamentosAgefin } = useQuery({
    queryKey: ['dizimo', 'agefin-lancamentos', competencia],
    queryFn: () => listarLancamentosCompetencia(competencia),
    staleTime: 30_000,
  });

  const { data: lancamentosMes = [], isLoading: loadingLancamentosMes } = useQuery({
    queryKey: ['dizimo', 'lancamentos-mes', competencia],
    queryFn: () => listarLancamentosMes(competencia),
    staleTime: 30_000,
  });

  const { data: lancamentosVencimento = [], isLoading: loadingLancamentosVencimento } = useQuery({
    queryKey: ['dizimo', 'lancamentos-vencimento', competencia],
    queryFn: () => listarLancamentosVencimentoMes(competencia),
    staleTime: 30_000,
  });

  const { data: lucroBrutoMes, isLoading: loadingLucroBruto } = useQuery({
    queryKey: ['dizimo', 'lucro-bruto', competencia],
    queryFn: () => obterLucroBrutoCompetencia(competencia),
    staleTime: 60_000,
  });

  const loading =
    loadingAgefin ||
    loadingRecorrentesAgefin ||
    loadingFolha ||
    loadingBudget ||
    loadingCompetenciasFolha ||
    loadingCompetenciasBudget ||
    loadingLancamentosAgefin ||
    loadingLancamentosMes ||
    loadingLancamentosVencimento ||
    (loadingLucroBruto && !lucroBrutoMes);

  const plano = useMemo(
    () =>
      montarPlanoFinanceiroConsolidado({
        competencia,
        modelosAgefin,
        lancamentosAgefin,
        lancamentosRecorrentesAgefin,
        modelosFolha,
        competenciasFolha,
        modelosBudget,
        competenciasBudget,
        lancamentosMes,
        lancamentosVencimento,
        lucroBruto: lucroBrutoMes?.lucro_bruto || 0,
        margemDetalhe: lucroBrutoMes,
      }),
    [
      competencia,
      modelosAgefin,
      lancamentosAgefin,
      lancamentosRecorrentesAgefin,
      modelosFolha,
      competenciasFolha,
      modelosBudget,
      competenciasBudget,
      lancamentosMes,
      lancamentosVencimento,
      lucroBrutoMes,
    ],
  );

  const demonstrativo = useMemo(
    () => montarDemonstrativoDizimo(plano, configBlocos),
    [plano, configBlocos],
  );

  const atualizarConfigBloco = useCallback(
    (blocoId, nextConfig) => {
      setConfigBlocos((prev) => {
        const merged = { ...prev, [blocoId]: nextConfig };
        salvarConfigDedutivelDizimo(competencia, merged);
        return merged;
      });
    },
    [competencia],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">Demonstrativo do dízimo</h2>
            <P38HelpPopover label="Ajuda: dízimo" size="sm">
              <p className="text-muted-foreground">
                O lucro bruto vem do Relatório de Margem. As despesas operacionais vêm do planejamento
                (Agefin, folha, budgets e pauta).
              </p>
              <p className="text-muted-foreground mt-2">
                Em cada bloco, escolha o que entra na base: total, parcial ou não dedutível. O dízimo é
                10% do lucro líquido operacional estimado resultante.
              </p>
            </P38HelpPopover>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Competência — {compLabel}</p>
        </div>

        <div className={cn('flex items-center rounded-xl p-1', P38_FIELD_SURFACE)}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCompetencia((c) => shiftCompetencia(c, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums min-w-[5.5rem] text-center">{compLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCompetencia((c) => shiftCompetencia(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <FinanceiroListaEstado loading />
      ) : (
        <>
          <CartaoDizimo demonstrativo={demonstrativo} />

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">
              Deduções por bloco
            </p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {demonstrativo.blocos.map((bloco) => (
                <BlocoDespesaDizimo
                  key={bloco.id}
                  bloco={bloco}
                  onConfigChange={(next) => atualizarConfigBloco(bloco.id, next)}
                />
              ))}
            </div>
          </div>

          <TabelaResumoDizimo demonstrativo={demonstrativo} />

          {demonstrativo.lucroLiquidoOperacional <= 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              Neste mês o resultado operacional estimado não é positivo — o dízimo calculado fica em R$ 0,00.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
