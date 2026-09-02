import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { listarParcelamentos } from '@/lib/agefinParcelamentoService';
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

function formatValorColuna(v) {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LinhaDemonstrativo4Col({
  descricao,
  c2,
  c3,
  c4,
  bold = false,
  className,
}) {
  return (
    <tr className={cn('border-b', LINHA_FINA, bold && 'bg-muted/10 font-semibold', className)}>
      <td className={cn('py-2.5 pl-3 pr-2 text-sm', bold && 'font-semibold')}>{descricao}</td>
      <td className="py-2.5 px-2 text-right text-sm tabular-nums whitespace-nowrap">{c2 ?? '—'}</td>
      <td className="py-2.5 px-2 text-right text-sm tabular-nums whitespace-nowrap">{c3 ?? '—'}</td>
      <td className="py-2.5 pl-2 pr-3 text-right text-sm tabular-nums whitespace-nowrap">{c4 ?? '—'}</td>
    </tr>
  );
}

function TabelaDemonstrativoDizimo({ demonstrativo }) {
  const margem = demonstrativo.margemDetalhe;
  const receita = Number(margem?.receita_liquida) || 0;
  const custo = Number(margem?.custo_total) || 0;
  const lucroBruto = Number(demonstrativo.lucroBruto) || 0;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold px-1">1. Demonstrativo</p>

      <div className={cn('overflow-x-auto rounded-xl border bg-background', LINHA_FINA)}>
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Receitas
        </p>
        <table className="w-full min-w-[520px] text-left border-collapse">
          <thead>
            <tr className={cn('border-b text-[11px] uppercase tracking-wide text-muted-foreground', LINHA_FINA)}>
              <th className="py-2 pl-3 pr-2 font-medium">Descrição</th>
              <th className="py-2 px-2 text-right font-medium w-28">Total R$</th>
              <th className="py-2 px-2 text-right font-medium w-28">Custo R$</th>
              <th className="py-2 pl-2 pr-3 text-right font-medium w-32">Lucro bruto R$</th>
            </tr>
          </thead>
          <tbody>
            <LinhaDemonstrativo4Col
              descricao="Venda período"
              c2={receita > 0 ? formatValorColuna(receita) : formatValorColuna(lucroBruto)}
              c3={custo > 0 ? formatValorColuna(custo) : '—'}
              c4={formatValorColuna(lucroBruto)}
              bold
            />
          </tbody>
        </table>
      </div>

      <div className={cn('overflow-x-auto rounded-xl border bg-background', LINHA_FINA)}>
        <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Despesas
        </p>
        <table className="w-full min-w-[520px] text-left border-collapse">
          <thead>
            <tr className={cn('border-b text-[11px] uppercase tracking-wide text-muted-foreground', LINHA_FINA)}>
              <th className="py-2 pl-3 pr-2 font-medium">Descrição</th>
              <th className="py-2 px-2 text-right font-medium w-28">Total R$</th>
              <th className="py-2 px-2 text-right font-medium w-32">Não dedutível R$</th>
              <th className="py-2 pl-2 pr-3 text-right font-medium w-28">Dedutível R$</th>
            </tr>
          </thead>
          <tbody>
            {demonstrativo.secoes.map((secao) => (
              <LinhaDemonstrativo4Col
                key={secao.id}
                descricao={secao.label}
                c2={formatValorColuna(secao.valorBruto)}
                c3={secao.valorNaoDedutivel > 0 ? formatValorColuna(secao.valorNaoDedutivel) : '0,00'}
                c4={formatValorColuna(secao.valorDedutivel)}
              />
            ))}
            <LinhaDemonstrativo4Col
              descricao="Lucro operacional"
              c2="—"
              c3="—"
              c4={formatValorColuna(demonstrativo.lucroLiquidoOperacional)}
              bold
            />
          </tbody>
        </table>
      </div>
    </div>
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

export default function DizimoPlano() {
  const [competencia, setCompetencia] = useState(getCompetenciaAtual);
  const [configItens, setConfigItens] = useState(() => criarConfigDedutivelPadrao());
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [configSalvaSnapshot, setConfigSalvaSnapshot] = useState('{}');
  const configItensRef = useRef(configItens);
  const competenciaRef = useRef(competencia);

  useEffect(() => {
    configItensRef.current = configItens;
  }, [configItens]);

  useEffect(() => {
    competenciaRef.current = competencia;
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

  const { data: parcelamentosAgefin = [], isLoading: loadingParcelamentosAgefin } = useQuery({
    queryKey: ['dizimo', 'agefin-parcelamentos'],
    queryFn: listarParcelamentos,
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
    loadingParcelamentosAgefin ||
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
        parcelamentosAgefin,
      }),
    [
      competencia,
      modelosAgefin,
      lancamentosAgefin,
      lancamentosRecorrentesAgefin,
      parcelamentosAgefin,
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
  }, [competencia, contextoKey]);

  useEffect(() => {
    const flush = () => {
      const comp = competenciaRef.current;
      const cfg = configItensRef.current;
      if (comp && cfg && Object.keys(cfg).length) {
        salvarConfigDedutivelDizimo(comp, cfg);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

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
        const ok = salvarItemConfigDedutivelDizimo(competencia, itemId, normalizado);
        if (ok) {
          setConfigSalvaSnapshot(JSON.stringify(next));
        } else {
          toast.error('Não foi possível guardar esta alteração', {
            description: 'O armazenamento local do navegador pode estar bloqueado.',
          });
        }
        return next;
      });
    },
    [competencia],
  );

  const mudarCompetencia = useCallback(
    (delta) => {
      const ok = salvarConfigDedutivelDizimo(competencia, configItens);
      if (!ok) {
        toast.error('Não foi possível guardar antes de mudar o mês');
        return;
      }
      setConfigSalvaSnapshot(JSON.stringify(configItens));
      setCompetencia((c) => shiftCompetencia(c, delta));
    },
    [competencia, configItens],
  );

  const handleSalvar = useCallback(async () => {
    setSalvando(true);
    try {
      const ok = salvarConfigDedutivelDizimo(competencia, configItens);
      if (!ok) throw new Error('Armazenamento local indisponível');
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
        const ok = salvarConfigDedutivelDizimo(competencia, configItens);
        if (ok) setConfigSalvaSnapshot(JSON.stringify(configItens));
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

          <TabelaDemonstrativoDizimo demonstrativo={demonstrativo} />

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
