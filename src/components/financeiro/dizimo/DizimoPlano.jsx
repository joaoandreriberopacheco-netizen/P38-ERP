import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
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
import { montarDemonstrativoDizimo, extrairContextoItensDizimo, criarConfigDedutivelPadrao, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';
import {
  carregarConfigDedutivelDizimo,
  salvarConfigDedutivelDizimo,
  salvarItemConfigDedutivelDizimo,
} from '@/lib/dizimoConfigStorage';
import { gerarRelatorioDizimo } from '@/functions/gerarRelatorioDizimo';
import { dataHoje } from '@/components/utils/dateUtils';
import DizimoArvoreDespesas from '@/components/financeiro/dizimo/DizimoArvoreDespesas';

const LINHA_FINA = 'border-black/[0.06] dark:border-white/10';

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
    <tr className={cn('border-b', LINHA_FINA, destaque && 'bg-muted/10 font-semibold')}>
      <td className="py-2.5 pl-3 pr-3 text-sm">
        <span className={destaque ? 'font-semibold' : 'font-medium'}>{label}</span>
        {sublabel ? (
          <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{sublabel}</span>
        ) : null}
      </td>
      <td className="py-2.5 pl-3 pr-3 text-right text-sm whitespace-nowrap">
        <CelulaValor valor={valor} positivo={positivo} prefix={prefix} />
      </td>
    </tr>
  );
}

function CartaoDizimo({ demonstrativo }) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 lg:p-6 text-center space-y-2 border',
        P38_FIELD_SURFACE,
        LINHA_FINA,
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

function LinhaResumoCard({ label, valor, tipo = 'normal', sublabel, destaque = false }) {
  const prefix = tipo === 'soma' ? '+' : tipo === 'subtrai' ? '−' : '';
  const positivo =
    tipo === 'soma' ? Number(valor) >= 0 : tipo === 'resultado' ? Number(valor) >= 0 : undefined;

  return (
    <div className={cn('py-3 px-3', LINHA_FINA, 'border-b', destaque && 'bg-muted/10')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm', destaque ? 'font-semibold' : 'font-medium')}>{label}</p>
          {sublabel ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>
          ) : null}
        </div>
        <CelulaValor valor={valor} positivo={positivo} prefix={prefix} className="text-sm shrink-0" />
      </div>
    </div>
  );
}

function TabelaResumoDizimo({ demonstrativo }) {
  const margem = demonstrativo.margemDetalhe;

  return (
    <>
      <div className={cn('md:hidden overflow-hidden rounded-xl border bg-background', LINHA_FINA)}>
        <div className={cn('px-3 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b', LINHA_FINA)}>
          Demonstrativo
        </div>
        <LinhaResumoCard label="Lucro bruto (margem)" valor={demonstrativo.lucroBruto} tipo="soma" destaque />
        {margem?.receita_liquida > 0 ? (
          <p className="px-3 py-2 text-[11px] text-muted-foreground border-b border-black/[0.06] dark:border-white/10">
            Receita líq. {formatFinanceiroValor(margem.receita_liquida)} · CMV{' '}
            {formatFinanceiroValor(margem.custo_total)}
          </p>
        ) : null}
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-black/[0.06] dark:border-white/10">
          Despesas operacionais (dedutíveis)
        </div>
        {demonstrativo.secoes.map((secao) => (
          <LinhaResumoCard
            key={secao.id}
            label={secao.label}
            valor={secao.valorDedutivel}
            tipo="subtrai"
            sublabel={
              secao.valorNaoDedutivel > 0
                ? `${formatFinanceiroValor(secao.valorBruto)} planejado · ${formatFinanceiroValor(secao.valorNaoDedutivel)} fora da base`
                : undefined
            }
          />
        ))}
        <LinhaResumoCard label="Total dedutível" valor={demonstrativo.totalDedutivel} tipo="subtrai" destaque />
        <LinhaResumoCard
          label="Lucro líquido operacional estimado"
          valor={demonstrativo.lucroLiquidoOperacional}
          tipo="resultado"
          destaque
        />
      </div>

      <div className={cn('hidden md:block overflow-x-auto rounded-xl border bg-background', LINHA_FINA)}>
      <table className="w-full min-w-[320px] text-left border-collapse">
        <thead>
          <tr className={cn('border-b text-[11px] uppercase tracking-wide text-muted-foreground', LINHA_FINA)}>
            <th className="py-2.5 pl-3 pr-3 font-medium">Demonstrativo</th>
            <th className="py-2.5 pl-3 pr-3 text-right font-medium w-36">Valor</th>
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
          {demonstrativo.secoes.map((secao) => (
            <LinhaResumo
              key={secao.id}
              label={secao.label}
              valor={secao.valorDedutivel}
              tipo="subtrai"
              sublabel={
                secao.valorNaoDedutivel > 0
                  ? `${formatFinanceiroValor(secao.valorBruto)} planejado · ${formatFinanceiroValor(secao.valorNaoDedutivel)} fora da base`
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
    </>
  );
}

export default function DizimoPlano() {
  const [competencia, setCompetencia] = useState(getCompetenciaAtual);
  const [configItens, setConfigItens] = useState(() => criarConfigDedutivelPadrao());
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [configSalvaSnapshot, setConfigSalvaSnapshot] = useState('{}');

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

  const contextoItens = useMemo(() => extrairContextoItensDizimo(plano), [plano]);
  const contextoKey = useMemo(
    () =>
      `${competencia}|${[...contextoItens.recorrentes, ...contextoItens.ocasionais].sort().join(',')}`,
    [competencia, contextoItens],
  );

  useEffect(() => {
    const ids = [...contextoItens.recorrentes, ...contextoItens.ocasionais];
    if (!ids.length) return;
    const resolved = carregarConfigDedutivelDizimo(competencia, contextoItens);
    setConfigItens(resolved);
    setConfigSalvaSnapshot(JSON.stringify(resolved));
  }, [contextoKey, contextoItens]);

  const configAlterada = useMemo(
    () => JSON.stringify(configItens) !== configSalvaSnapshot,
    [configItens, configSalvaSnapshot],
  );

  const demonstrativo = useMemo(
    () => montarDemonstrativoDizimo(plano, configItens),
    [plano, configItens],
  );

  const atualizarConfigItem = useCallback(
    (itemId, nextConfig) => {
      const normalizado = normalizarConfigItemDizimo(nextConfig);
      setConfigItens((prev) => {
        const next = { ...prev, [itemId]: normalizado };
        setConfigSalvaSnapshot(JSON.stringify(next));
        return next;
      });
      salvarItemConfigDedutivelDizimo(competencia, itemId, normalizado);
    },
    [competencia],
  );

  const mudarCompetencia = useCallback(
    (delta) => {
      salvarConfigDedutivelDizimo(competencia, configItens);
      setCompetencia((c) => shiftCompetencia(c, delta));
    },
    [competencia, configItens],
  );

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    try {
      salvarConfigDedutivelDizimo(competencia, configItens);
      setConfigSalvaSnapshot(JSON.stringify(configItens));
      toast.success('Configuração do dízimo salva', {
        description: `Competência ${compLabel}`,
      });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar', { description: error?.message || String(error) });
    } finally {
      setSalvando(false);
    }
  }, [competencia, configItens, compLabel]);

  const handleGerarPdf = useCallback(async () => {
    if (loading || gerandoPdf) return;
    setGerandoPdf(true);
    toast.loading('Gerando PDF do dízimo...', { id: 'pdf-dizimo' });
    try {
      if (configAlterada) {
        salvarConfigDedutivelDizimo(competencia, configItens);
        setConfigSalvaSnapshot(JSON.stringify(configItens));
      }
      const resposta = await gerarRelatorioDizimo({
        competencia,
        competenciaLabel: compLabel,
        demonstrativo,
      });
      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `RelatorioDizimo_${competencia}_${dataHoje()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('PDF do dízimo gerado', { id: 'pdf-dizimo' });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o PDF', {
        id: 'pdf-dizimo',
        description: error?.message || String(error),
      });
    } finally {
      setGerandoPdf(false);
    }
  }, [loading, gerandoPdf, configAlterada, competencia, compLabel, demonstrativo, configItens]);

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
                Configure item a item — cada alteração é salva automaticamente neste navegador.
                Ao mudar de mês, as escolhas da competência ficam guardadas.
              </p>
            </P38HelpPopover>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Competência — {compLabel}</p>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl gap-1.5 w-full sm:w-auto"
            disabled={loading || salvando || !configAlterada}
            onClick={handleSalvar}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Salvar</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl gap-1.5 w-full sm:w-auto"
            disabled={loading || gerandoPdf}
            onClick={handleGerarPdf}
          >
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>PDF do mês</span>
          </Button>
          </div>

          <div className={cn('flex items-center justify-center rounded-xl p-1 border w-full sm:w-auto', LINHA_FINA, 'bg-background')}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => mudarCompetencia(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums min-w-[5.5rem] text-center">{compLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => mudarCompetencia(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </div>

      {loading ? (
        <FinanceiroListaEstado loading />
      ) : (
        <>
          <CartaoDizimo demonstrativo={demonstrativo} />

          <div className="space-y-3">
            <div className="px-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Deduções por item
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Toque na despesa para ajustar se entra na base do dízimo.
              </p>
            </div>
            <DizimoArvoreDespesas secoes={demonstrativo.secoes} onConfigItem={atualizarConfigItem} />
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
