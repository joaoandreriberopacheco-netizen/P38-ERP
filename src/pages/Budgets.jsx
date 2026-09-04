import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Target,
  CalendarClock,
  LayoutList,
  PieChart,
} from 'lucide-react';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { P38_CHIP_INACTIVE, P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import BudgetPrevisaoResumo from '@/components/budget-previsao/BudgetPrevisaoResumo';
import BudgetAcompanhamentoTabela from '@/components/budget-previsao/BudgetAcompanhamentoTabela';
import BudgetPrevisaoFiltros from '@/components/budget-previsao/BudgetPrevisaoFiltros';
import BudgetPrevisaoDetalheDrawer from '@/components/budget-previsao/BudgetPrevisaoDetalheDrawer';
import BudgetModeloRow from '@/components/budget-previsao/BudgetModeloRow';
import BudgetModeloDialog from '@/components/budget-previsao/BudgetModeloDialog';
import BudgetPlanoCompleto from '@/components/budget-previsao/BudgetPlanoCompleto';
import {
  calcularRealizadoPorTag,
  calcularTotaisBudgets,
  filtrarVisoesBudget,
  formatCompetenciaLabel,
  getCompetenciaAtual,
  montarVisoesBudgets,
  ordenarModelosPorCentroENome,
  shiftCompetencia,
  BUDGET_MODULO_LABEL,
} from '@/lib/budgetCalculos';
import {
  listarModelos,
  salvarModelo,
  removerModelo,
  listarCompetencias,
  salvarAjusteCompetencia,
  listarLancamentosDespesas,
  listarLancamentosMes,
  listarCategoriasDespesa,
  listarCentrosCustoRegistros,
  inativarModelo,
  reativarModelo,
  limparDuplicatasBudgets,
} from '@/lib/budgetService';
import { useLucroBrutoCompetencia } from '@/hooks/useLucroBrutoCompetencia';
import {
  calcularTotaisGrupo as calcularTotaisGrupoFolha,
  mapaModelosPorColaborador,
  montarCompetenciasVisao as montarCompetenciasFolha,
} from '@/lib/folhaPrevisaoCalculos';
import { listarCompetencias as listarCompetenciasFolha, listarModelos as listarModelosFolha } from '@/lib/folhaPrevisaoService';
import {
  calcularTotaisGrupo as calcularTotaisGrupoAgefin,
  mapaModelosPorId,
  montarCompetenciasVisao as montarCompetenciasAgefin,
} from '@/lib/agefinPrevisaoCalculos';
import { listarModelos as listarModelosAgefin, listarLancamentosCompetencia } from '@/lib/agefinPrevisaoService';
import { gerarRelatorioBudgets } from '@/functions/gerarRelatorioBudgets';
import { dataHoje } from '@/components/utils/dateUtils';

export default function BudgetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [competenciaMes, setCompetenciaMes] = useState(
    () => searchParams.get('competencia') || getCompetenciaAtual(),
  );
  const [selectedVisao, setSelectedVisao] = useState(null);
  const [modeloDialog, setModeloDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [processandoModeloId, setProcessandoModeloId] = useState('');
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('__todos__');
  const [filtroSituacao, setFiltroSituacao] = useState('todos');
  const [filtroCadastroBusca, setFiltroCadastroBusca] = useState('');
  const [filtroCadastroAtivo, setFiltroCadastroAtivo] = useState('ativos');
  const [fabOpen, setFabOpen] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const abaInicial = searchParams.get('aba') || 'cadastro';
  const [aba, setAba] = useState(abaInicial);

  useEffect(() => {
    const comp = searchParams.get('competencia');
    if (comp && /^\d{4}-\d{2}$/.test(comp)) setCompetenciaMes(comp);
    const abaParam = searchParams.get('aba');
    if (abaParam) setAba(abaParam);
  }, [searchParams]);

  const { data: modelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['budgets', 'modelos'],
    queryFn: listarModelos,
  });

  const { data: competencias = [] } = useQuery({
    queryKey: ['budgets', 'competencias', competenciaMes],
    queryFn: () => listarCompetencias(competenciaMes),
  });

  const { data: lancamentos = [], isLoading: loadingLanc } = useQuery({
    queryKey: ['budgets', 'lancamentos', competenciaMes],
    queryFn: () => listarLancamentosDespesas(competenciaMes),
  });

  const { data: lancamentosMes = [] } = useQuery({
    queryKey: ['budgets', 'lancamentos-mes', competenciaMes],
    queryFn: () => listarLancamentosMes(competenciaMes),
    enabled: aba === 'plano',
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['budgets', 'categorias'],
    queryFn: listarCategoriasDespesa,
  });

  const { data: centrosCustoRegistros = [] } = useQuery({
    queryKey: ['budgets', 'centros'],
    queryFn: listarCentrosCustoRegistros,
  });

  const { data: modelosFolha = [] } = useQuery({
    queryKey: ['budgets', 'folha-modelos'],
    queryFn: listarModelosFolha,
    enabled: aba === 'plano',
  });

  const { data: competenciasFolha = [] } = useQuery({
    queryKey: ['budgets', 'folha-comp', competenciaMes],
    queryFn: () => listarCompetenciasFolha(competenciaMes),
    enabled: aba === 'plano',
  });

  const { data: lancamentosAgefin = [] } = useQuery({
    queryKey: ['budgets', 'agefin-lanc', competenciaMes],
    queryFn: () => listarLancamentosCompetencia(competenciaMes),
    enabled: aba === 'plano',
  });

  const { data: lucroBrutoMes } = useLucroBrutoCompetencia(competenciaMes, {
    enabled: aba === 'plano',
  });

  const { data: modelosAgefin = [] } = useQuery({
    queryKey: ['budgets', 'agefin-modelos'],
    queryFn: listarModelosAgefin,
    enabled: aba === 'plano',
  });

  const centrosRegistrados = useMemo(
    () =>
      [...(centrosCustoRegistros || [])]
        .filter((r) => r?.ativo !== false)
        .map((r) => String(r?.nome || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [centrosCustoRegistros],
  );

  const visoes = useMemo(
    () => montarVisoesBudgets(modelos, competenciaMes, competencias, lancamentos),
    [modelos, competenciaMes, competencias, lancamentos],
  );

  const visoesFiltradas = useMemo(
    () =>
      filtrarVisoesBudget(visoes, {
        busca: filtroBusca,
        centro: filtroCentro,
        situacao: filtroSituacao,
      }),
    [visoes, filtroBusca, filtroCentro, filtroSituacao],
  );

  const totais = useMemo(() => calcularTotaisBudgets(visoes), [visoes]);

  const modelosCadastro = useMemo(() => {
    let lista = ordenarModelosPorCentroENome(modelos);
    if (filtroCadastroAtivo === 'ativos') lista = lista.filter((m) => m.ativo !== false);
    if (filtroCadastroAtivo === 'inativos') lista = lista.filter((m) => m.ativo === false);
    const q = filtroCadastroBusca.trim().toLocaleLowerCase('pt-BR');
    if (q) {
      lista = lista.filter(
        (m) =>
          String(m.nome || '').toLocaleLowerCase('pt-BR').includes(q) ||
          String(m.categoria_nome || '').toLocaleLowerCase('pt-BR').includes(q),
      );
    }
    return lista;
  }, [modelos, filtroCadastroAtivo, filtroCadastroBusca]);

  const totaisPlano = useMemo(() => {
    if (aba !== 'plano') return null;
    const folhaMap = mapaModelosPorColaborador(modelosFolha);
    const compsFolha = montarCompetenciasFolha(competenciaMes, modelosFolha, competenciasFolha);
    const totaisFolha = calcularTotaisGrupoFolha(compsFolha, folhaMap);

    const agefinMap = mapaModelosPorId(modelosAgefin);
    const compsAgefin = montarCompetenciasAgefin(competenciaMes, modelosAgefin, lancamentosAgefin);
    const totaisFixas = calcularTotaisGrupoAgefin(compsAgefin, agefinMap);

    return {
      totaisFolha,
      totaisFixas,
      realizadoFolha: calcularRealizadoPorTag(lancamentosMes, competenciaMes, 'folha_previsao'),
      realizadoFixas: calcularRealizadoPorTag(lancamentosMes, competenciaMes, 'agefin_previsao'),
      lucroBruto: lucroBrutoMes?.lucro_bruto || 0,
      margemDetalhe: lucroBrutoMes,
      totaisBudgets: totais,
    };
  }, [aba, competenciaMes, modelosFolha, competenciasFolha, modelosAgefin, lancamentosAgefin, lancamentosMes, totais, lucroBrutoMes]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  }, [queryClient]);

  const handleSaveModelo = async (payload) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await salvarModelo(payload);
      invalidate();
      setModeloDialog(null);
      toast({ title: `${BUDGET_MODULO_LABEL} salvo` });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const runAcaoModelo = async (modeloId, fn, successTitle, { atualizarLista } = {}) => {
    if (processandoModeloId || savingRef.current) return;
    setProcessandoModeloId(modeloId);
    try {
      const resultado = await fn();
      if (typeof atualizarLista === 'function') {
        queryClient.setQueryData(['budgets', 'modelos'], atualizarLista);
      }
      await queryClient.refetchQueries({ queryKey: ['budgets', 'modelos'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: successTitle });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setProcessandoModeloId('');
    }
  };

  const handleInativarModelo = async (modelo) => {
    if (!window.confirm(`Inativar "${modelo.nome}"?\n\nSai do acompanhamento, mas permanece no cadastro.`)) return;
    await runAcaoModelo(modelo.id, () => inativarModelo(modelo.id), 'Gasto inativado');
  };

  const handleReativarModelo = async (modelo) => {
    await runAcaoModelo(modelo.id, () => reativarModelo(modelo.id), 'Gasto reativado');
  };

  const handleExcluirModelo = async (modelo) => {
    if (
      !window.confirm(
        `Excluir em definitivo "${modelo.nome}"?\n\nEsta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    await runAcaoModelo(
      modelo.id,
      () => removerModelo(modelo.id),
      'Gasto excluído',
      {
        atualizarLista: (lista) => (lista || []).filter((m) => m.id !== modelo.id),
      },
    );
  };

  const handleLimparDuplicatas = async () => {
    if (
      !window.confirm(
        `Remover gastos duplicados?\n\nMantém um de cada (mesmo nome, categoria e centro) e apaga as cópias.`,
      )
    ) {
      return;
    }
    setProcessandoModeloId('__limpar__');
    try {
      const resultado = await limparDuplicatasBudgets();
      await queryClient.refetchQueries({ queryKey: ['budgets', 'modelos'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: resultado.removidos ? 'Duplicatas removidas' : 'Nenhuma duplicata',
        description: resultado.removidos
          ? `${resultado.removidos} cópia(s) removida(s). Restam ${resultado.total}.`
          : 'Não há gastos repetidos para limpar.',
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setProcessandoModeloId('');
    }
  };

  const handleSalvarAjuste = async ({ valorAjustado, motivoAjuste }) => {
    if (!selectedVisao?.modelo?.id) return;
    setSalvandoAjuste(true);
    try {
      await salvarAjusteCompetencia(selectedVisao.modelo.id, competenciaMes, {
        valorAjustado,
        motivoAjuste,
      });
      invalidate();
      const comps = await listarCompetencias(competenciaMes);
      const lancs = await listarLancamentosDespesas(competenciaMes);
      const atualizadas = montarVisoesBudgets(modelos, competenciaMes, comps, lancs);
      const nova = atualizadas.find((v) => v.modelo?.id === selectedVisao.modelo.id);
      if (nova) setSelectedVisao(nova);
      toast({ title: 'Ajuste do mês salvo' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoAjuste(false);
    }
  };

  const competenciaLabel = formatCompetenciaLabel(competenciaMes);

  const handleGerarPdf = async () => {
    const modoCadastro = aba === 'cadastro';
    const listaAcompanhamento = visoesFiltradas;
    const listaCadastro = modelosCadastro;

    if (gerandoPdf) return;
    if (modoCadastro && !listaCadastro.length) {
      toast({ title: 'Nada para exportar', description: `Não há ${BUDGET_MODULO_LABEL.toLowerCase()} na lista atual.` });
      return;
    }
    if (!modoCadastro && !listaAcompanhamento.length) {
      toast({ title: 'Nada para exportar', description: `Não há ${BUDGET_MODULO_LABEL.toLowerCase()} para este mês com os filtros atuais.` });
      return;
    }

    setGerandoPdf(true);
    toast({ title: `Gerando PDF de ${BUDGET_MODULO_LABEL.toLowerCase()}...` });
    try {
      const resposta = await gerarRelatorioBudgets({
        competencia: competenciaMes,
        competenciaLabel,
        modo: modoCadastro ? 'cadastro' : 'acompanhamento',
        visoes: listaAcompanhamento,
        modelos: listaCadastro,
        totais,
      });
      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `GastosSemVencimento_${modoCadastro ? 'cadastro' : 'acompanhamento'}_${competenciaMes}_${dataHoje()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: `PDF de ${BUDGET_MODULO_LABEL.toLowerCase()} gerado` });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao gerar PDF',
        description: error?.message || String(error),
        variant: 'destructive',
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  const podeGerarPdf =
    aba === 'cadastro'
      ? modelosCadastro.length > 0
      : aba === 'acompanhamento'
        ? visoesFiltradas.length > 0
        : false;

  return (
    <div className="w-full max-w-[1400px] mx-auto min-w-0 overflow-x-hidden font-din-1451 bg-background px-4 py-4 md:px-6 lg:px-8 lg:py-6 xl:px-10 pb-[calc(var(--p38-scroll-pad-below-nav)+5.5rem)] md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 min-w-0">
        <h1 className="text-xl font-medium text-foreground">{BUDGET_MODULO_LABEL}</h1>
        <P38HelpPopover label={`Ajuda: ${BUDGET_MODULO_LABEL.toLowerCase()}`} side="bottom" align="start">
          <p className="font-medium text-foreground">Orçamento de despesas variáveis</p>
          <p className="text-muted-foreground">
            Cadastre metas (alimentação, combustível, etc.) na unidade que fizer sentido — por dia, a cada 7 dias, ciclo ou mês.
            O sistema sempre mostra o <strong className="text-foreground">orçamento mensal</strong>.
          </p>
          <p className="text-muted-foreground">
            Dias úteis = segunda a sábado (domingo não conta). Padrão = mês completo.
          </p>
        </P38HelpPopover>
        </div>
        {(aba === 'cadastro' || aba === 'acompanhamento') && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl gap-1.5 shrink-0"
            disabled={!podeGerarPdf || gerandoPdf || loadingModelos || loadingLanc}
            onClick={handleGerarPdf}
          >
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>PDF</span>
          </Button>
        )}
      </div>

      <Tabs
        value={aba}
        onValueChange={(v) => {
          setAba(v);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('aba', v);
            return next;
          });
        }}
        className="w-full mt-4"
      >
        <TabsList
          className={cn(
            'w-full h-auto p-1 rounded-xl grid grid-cols-3 gap-1 md:flex md:flex-wrap md:overflow-visible',
            P38_FIELD_SURFACE,
          )}
        >
          <TabsTrigger
            value="cadastro"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-2 md:flex-1 md:min-w-[120px]"
          >
            <LayoutList className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">Lista</span>
            <span className="hidden md:inline text-sm">Cadastro</span>
          </TabsTrigger>
          <TabsTrigger
            value="acompanhamento"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-2 md:flex-1 md:min-w-[120px]"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">Mês</span>
            <span className="hidden md:inline text-sm">Acompanhamento</span>
          </TabsTrigger>
          <TabsTrigger
            value="plano"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-2 md:flex-1 md:min-w-[120px]"
          >
            <PieChart className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">Plano</span>
            <span className="hidden md:inline text-sm">Plano completo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="mt-4 space-y-3">
          <div className={cn('relative rounded-xl', P38_FIELD_SURFACE)}>
            <input
              type="search"
              value={filtroCadastroBusca}
              onChange={(e) => setFiltroCadastroBusca(e.target.value)}
              placeholder="Buscar gasto"
              className="w-full border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
            {['ativos', 'inativos', 'todos'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFiltroCadastroAtivo(opt)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium min-h-[32px]',
                  filtroCadastroAtivo === opt ? 'bg-card shadow-sm text-foreground' : P38_CHIP_INACTIVE,
                )}
              >
                {opt === 'ativos' ? 'Ativos' : opt === 'inativos' ? 'Inativos' : 'Todos'}
              </button>
            ))}
            </div>
            {modelos.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full h-8 text-xs"
                disabled={Boolean(processandoModeloId)}
                onClick={handleLimparDuplicatas}
              >
                {processandoModeloId === '__limpar__' ? 'Processando…' : 'Limpar duplicatas'}
              </Button>
            )}
          </div>

          <FinanceiroListaEstado
            loading={loadingModelos}
            vazio={!loadingModelos && modelosCadastro.length === 0}
            vazioMensagem={`Nenhum ${BUDGET_MODULO_LABEL.toLowerCase()} cadastrado.`}
            vazioIcon={Target}
          >
            <P38MobileLineList className="block md:!block rounded-xl overflow-hidden">
              {modelosCadastro.map((m, idx) => (
                <BudgetModeloRow
                  key={m.id}
                  modelo={m}
                  competencia={competenciaMes}
                  striped={idx % 2 === 1}
                  processando={processandoModeloId === m.id}
                  onEdit={setModeloDialog}
                  onInativar={handleInativarModelo}
                  onReativar={handleReativarModelo}
                  onExcluir={handleExcluirModelo}
                />
              ))}
            </P38MobileLineList>
          </FinanceiroListaEstado>
        </TabsContent>

        <TabsContent value="acompanhamento" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={cn('w-full sm:w-auto flex items-center justify-between gap-1 rounded-xl px-1', P38_FIELD_SURFACE)}>
              <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2 tabular-nums">{competenciaLabel}</span>
              <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <BudgetPrevisaoResumo totais={totais} competenciaLabel={competenciaLabel} />

          <BudgetPrevisaoFiltros
            busca={filtroBusca}
            onBuscaChange={setFiltroBusca}
            centro={filtroCentro}
            onCentroChange={setFiltroCentro}
            centrosRegistrados={centrosRegistrados}
            situacao={filtroSituacao}
            onSituacaoChange={setFiltroSituacao}
          />

          <FinanceiroListaEstado
            loading={loadingModelos || loadingLanc}
            vazio={!loadingModelos && visoesFiltradas.length === 0}
            vazioMensagem={
              modelos.filter((m) => m.ativo !== false).length === 0
                ? `Nenhum ${BUDGET_MODULO_LABEL.toLowerCase()} cadastrado. Crie o primeiro na aba Lista.`
                : 'Nenhum gasto encontrado com estes filtros.'
            }
            vazioIcon={Target}
          >
            <BudgetAcompanhamentoTabela
              visoes={visoesFiltradas}
              totais={totais}
              onOpen={setSelectedVisao}
            />
          </FinanceiroListaEstado>
        </TabsContent>

        <TabsContent value="plano" className="mt-4 space-y-3">
          <div className={cn('w-full sm:w-auto flex items-center justify-between gap-1 rounded-xl px-1 max-w-xs', P38_FIELD_SURFACE)}>
            <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 tabular-nums">{competenciaLabel}</span>
            <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {totaisPlano && (
            <BudgetPlanoCompleto
              competencia={competenciaMes}
              totaisFixas={totaisPlano.totaisFixas}
              totaisFolha={totaisPlano.totaisFolha}
              totaisBudgets={totaisPlano.totaisBudgets}
              realizadoFixas={totaisPlano.realizadoFixas}
              realizadoFolha={totaisPlano.realizadoFolha}
              lucroBruto={totaisPlano.lucroBruto}
              margemDetalhe={totaisPlano.margemDetalhe}
            />
          )}
        </TabsContent>
      </Tabs>

      <BudgetPrevisaoDetalheDrawer
        open={Boolean(selectedVisao)}
        onClose={() => setSelectedVisao(null)}
        visao={selectedVisao}
        onSalvarAjuste={handleSalvarAjuste}
        salvandoAjuste={salvandoAjuste}
      />

      <BudgetModeloDialog
        open={Boolean(modeloDialog)}
        onClose={() => setModeloDialog(null)}
        modelo={modeloDialog}
        categorias={categorias}
        centrosCustoRegistros={centrosCustoRegistros}
        centrosRegistrados={centrosRegistrados}
        onSave={handleSaveModelo}
        saving={saving}
        onCategoriasChange={async () => {
          await queryClient.invalidateQueries({ queryKey: ['budgets', 'categorias'] });
        }}
        onCentrosChange={async () => {
          await queryClient.invalidateQueries({ queryKey: ['budgets', 'centros'] });
        }}
      />

      <div className="fixed right-4 z-[55] bottom-[calc(var(--p38-bottom-nav-h,0px)+1rem)] lg:bottom-8 lg:right-8">
        <div className="relative">
          {fabOpen && (
            <div className="absolute bottom-16 right-0 mb-2 flex flex-col gap-2 items-end">
              <Button
                size="sm"
                className="rounded-full shadow-lg"
                onClick={() => {
                  setFabOpen(false);
                  setModeloDialog({});
                  setAba('cadastro');
                }}
              >
                Novo gasto
              </Button>
            </div>
          )}
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => {
              if (saving || processandoModeloId) return;
              if (aba === 'cadastro') {
                setModeloDialog({});
              } else {
                setFabOpen((v) => !v);
              }
            }}
            disabled={saving || Boolean(processandoModeloId)}
            aria-label="Adicionar"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
