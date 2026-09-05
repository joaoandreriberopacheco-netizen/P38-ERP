import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Plus,
  RotateCcw,
  Users,
  CalendarClock,
  TrendingUp,
  FlaskConical,
} from 'lucide-react';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE, P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import FolhaPrevisaoResumo from '@/components/folha-previsao/FolhaPrevisaoResumo';
import FolhaPrevisaoLista from '@/components/folha-previsao/FolhaPrevisaoLista';
import FolhaPrevisaoFiltros from '@/components/folha-previsao/FolhaPrevisaoFiltros';
import FolhaPrevisaoModeloRow from '@/components/folha-previsao/FolhaPrevisaoModeloRow';
import FolhaPessoaDialog from '@/components/folha-previsao/FolhaPessoaDialog';
import FolhaPrevisaoMovimentoDialog from '@/components/folha-previsao/FolhaPrevisaoMovimentoDialog';
import FolhaPrevisaoDetalheDrawer from '@/components/folha-previsao/FolhaPrevisaoDetalheDrawer';
import FolhaPrevisaoDesligamentoDialog from '@/components/folha-previsao/FolhaPrevisaoDesligamentoDialog';
import FolhaPrevisaoProjecao from '@/components/folha-previsao/FolhaPrevisaoProjecao';
import FolhaCentroCustoDragOverlay from '@/components/folha-previsao/FolhaCentroCustoDragOverlay';
import FolhaCentrosCustoDialog from '@/components/folha-previsao/FolhaCentrosCustoDialog';
import FolhaSimulacao from '@/components/folha-previsao/FolhaSimulacao';
import {
  calcularTotaisGrupo,
  formatCompetenciaLabel,
  getCompetenciaAtual,
  mapaModelosPorColaborador,
  shiftCompetencia,
  TIPO_VINCULO,
  TIPO_VINCULO_LABELS,
  filtrarCompetenciasPorTipo,
  filtrarCompetenciasPrevisao,
  formatCicloFolhaCompetencia,
  FOLHA_DIA_VENCIMENTO,
  montarCompetenciasVisao,
  ordenarPessoasFolhaPorCentroENome,
  isCompetenciaFutura,
  isCompetenciaPlanejamento,
} from '@/lib/folhaPrevisaoCalculos';
import { generateFolhaPessoasPorCentroPdf } from '@/lib/folhaPessoasPorCentroPdf';
import { shareOrDownloadBlob } from '@/lib/mobilePrintAndShare';
import {
  abrirCompetenciasDoMes,
  desfazerAberturaCompetenciasDoMes,
  adicionarMovimento,
  criarColaboradorParaFolha,
  listarColaboradoresAtivos,
  listarCentrosCustoRegistros,
  listarCompetencias,
  listarModelos,
  reativarNaFolha,
  registrarDesligamento,
  removerMovimento,
  salvarCadastroPessoaFolha,
  atualizarCentroCustoPessoaFolha,
  sincronizarLancamentoFinanceiro,
  sincronizarFechamentoCompetencias,
} from '@/lib/folhaPrevisaoService';

const FILTRO_VINCULO_OPTS = [
  { id: 'todos', label: 'Todos' },
  { id: TIPO_VINCULO.FUNCIONARIO, label: 'Funcionários' },
  { id: TIPO_VINCULO.SOCIO, label: 'Sócios' },
];

function FiltroVinculoChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTRO_VINCULO_OPTS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
            value === opt.id ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function FolhaPrevisaoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [competenciaMes, setCompetenciaMes] = useState(getCompetenciaAtual());
  const [selectedComp, setSelectedComp] = useState(null);
  const [pessoaDialog, setPessoaDialog] = useState(null);
  const [desligamentoModelo, setDesligamentoModelo] = useState(null);
  const [movimentoOpen, setMovimentoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filtroVinculo, setFiltroVinculo] = useState('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('__todos__');
  const [fabOpen, setFabOpen] = useState(false);
  const [centroDialogOpen, setCentroDialogOpen] = useState(false);
  const [draggingModeloId, setDraggingModeloId] = useState('');
  const [dropCentroAtual, setDropCentroAtual] = useState('__none__');
  const [gerandoPdfPessoas, setGerandoPdfPessoas] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('previsao');
  const [simulacaoKey, setSimulacaoKey] = useState(0);

  const { data: competencias = [], isLoading: loadingComp } = useQuery({
    queryKey: ['folha-previsao', 'competencias', competenciaMes],
    queryFn: async () => {
      await sincronizarFechamentoCompetencias(competenciaMes);
      return listarCompetencias(competenciaMes);
    },
  });

  const { data: modelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['folha-previsao', 'modelos'],
    queryFn: listarModelos,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['folha-previsao', 'colaboradores'],
    queryFn: listarColaboradoresAtivos,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['folha-previsao', 'contas'],
    queryFn: () => base44.entities.ContasFinanceiras.list(),
  });

  const { data: centrosCustoRegistros = [], refetch: refetchCentros } = useQuery({
    queryKey: ['folha-previsao', 'centros-custo-registros'],
    queryFn: listarCentrosCustoRegistros,
    staleTime: 0,
  });

  const centrosRegistrados = useMemo(
    () =>
      [...(centrosCustoRegistros || [])]
        .filter((row) => row?.ativo !== false)
        .map((row) => String(row?.nome || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [centrosCustoRegistros],
  );

  const modelosMap = useMemo(() => mapaModelosPorColaborador(modelos), [modelos]);
  const competenciasVisao = useMemo(
    () => montarCompetenciasVisao(competenciaMes, modelos, competencias),
    [competenciaMes, modelos, competencias],
  );
  const competenciasFiltradas = useMemo(
    () => filtrarCompetenciasPorTipo(competenciasVisao, modelosMap, filtroVinculo === 'todos' ? null : filtroVinculo),
    [competenciasVisao, modelosMap, filtroVinculo],
  );

  const competenciasExibidas = useMemo(
    () =>
      filtrarCompetenciasPrevisao(competenciasFiltradas, modelosMap, {
        busca: filtroBusca,
        centro: filtroCentro,
      }),
    [competenciasFiltradas, modelosMap, filtroBusca, filtroCentro],
  );

  const qtdPlanejamento = useMemo(
    () => competenciasExibidas.filter((c) => isCompetenciaPlanejamento(c)).length,
    [competenciasExibidas],
  );
  const hasCompetenciasPersistidas = competencias.length > 0;
  const mesFuturo = isCompetenciaFutura(competenciaMes);
  const totaisGrupo = useMemo(
    () => calcularTotaisGrupo(competenciasExibidas, modelosMap),
    [competenciasExibidas, modelosMap],
  );
  const contaPadrao = contas.find((c) => c.ativo !== false) || contas[0];
  const selectedModelo = selectedComp ? modelosMap[selectedComp.colaborador_id] : null;

  const colaboradoresMap = useMemo(
    () => Object.fromEntries((colaboradores || []).map((c) => [c.id, c])),
    [colaboradores],
  );

  const idsNaFolha = useMemo(
    () => new Set(modelos.filter((m) => m.colaborador_id).map((m) => m.colaborador_id)),
    [modelos],
  );

  const colaboradoresDisponiveis = useMemo(
    () => colaboradores.filter((c) => !idsNaFolha.has(c.id)),
    [colaboradores, idsNaFolha],
  );

  const pessoasCadastradas = useMemo(
    () => modelos.filter((m) => m.colaborador_id),
    [modelos],
  );

  const pessoasFiltradas = useMemo(
    () => ordenarPessoasFolhaPorCentroENome(
      pessoasCadastradas.filter(
        (m) => filtroVinculo === 'todos' || (m.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO) === filtroVinculo,
      ),
      colaboradoresMap,
    ),
    [pessoasCadastradas, filtroVinculo, colaboradoresMap],
  );

  const centrosRegistradosSet = useMemo(
    () => new Set(centrosRegistrados.map((c) => c.toLocaleLowerCase('pt-BR'))),
    [centrosRegistrados],
  );

  const pessoasPorCentro = useMemo(() => {
    const mapa = {};
    for (const pessoa of pessoasFiltradas) {
      const centro = String(pessoa.centro_custo || '').trim();
      const chave =
        centro && centrosRegistradosSet.has(centro.toLocaleLowerCase('pt-BR')) ? centro : '__sem__';
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(pessoa);
    }
    return mapa;
  }, [pessoasFiltradas, centrosRegistradosSet]);

  const pessoaArrastando = useMemo(
    () => pessoasFiltradas.find((p) => p.id === draggingModeloId) || null,
    [pessoasFiltradas, draggingModeloId],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['folha-previsao'] });
  }, [queryClient]);

  const invalidateCentros = useCallback(
    (lista) => {
      if (lista) {
        queryClient.setQueryData(['folha-previsao', 'centros-custo-registros'], lista);
      }
      void refetchCentros();
      invalidate();
    },
    [queryClient, refetchCentros, invalidate],
  );

  const handleAbrirMes = async () => {
    const colaboradorAlvo = isCompetenciaPlanejamento(selectedComp) ? selectedComp.colaborador_id : null;
    setSaving(true);
    try {
      const { criados, pulados } = await abrirCompetenciasDoMes(competenciaMes);
      invalidate();
      if (colaboradorAlvo) {
        const lista = await listarCompetencias(competenciaMes);
        const real = (lista || []).find((c) => c.colaborador_id === colaboradorAlvo);
        if (real) setSelectedComp(real);
      }
      const msg = criados.length
        ? `${criados.length} previsão(ões) aberta(s).`
        : 'Nenhuma pessoa cadastrada na folha.';
      const extra = pulados.length ? ` ${pulados.length} ignorado(s) (já desligados).` : '';
      toast({ title: 'Mês aberto', description: msg + extra });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDesfazerAbrirMes = async () => {
    if (!window.confirm(`Desfazer abertura de ${formatCompetenciaLabel(competenciaMes)}?\n\nIsso remove da base apenas quem está sem movimentos e não está com mês fechado.`)) return;
    setSaving(true);
    try {
      const { total, removidas, bloqueadas } = await desfazerAberturaCompetenciasDoMes(competenciaMes);
      if (selectedComp && removidas.some((r) => r.id === selectedComp.id)) {
        setSelectedComp(null);
      }
      invalidate();

      if (!total) {
        toast({ title: 'Nada para desfazer', description: 'Este mês ainda não foi aberto.' });
        return;
      }

      const bloqueadasFechadas = bloqueadas.filter((b) => b.motivo === 'fechada').length;
      const bloqueadasMov = bloqueadas.filter((b) => b.motivo === 'com_movimentos').length;
      const partes = [];
      if (removidas.length) partes.push(`${removidas.length} removida(s)`);
      if (bloqueadasFechadas) partes.push(`${bloqueadasFechadas} fechada(s) preservada(s)`);
      if (bloqueadasMov) partes.push(`${bloqueadasMov} com movimento(s) preservada(s)`);

      toast({
        title: 'Abertura desfeita',
        description: partes.join(' · ') || 'Nenhuma competência pôde ser removida.',
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePessoa = async (payload) => {
    setSaving(true);
    try {
      const { _modoPessoa, _novoColaborador, ...rest } = payload;
      let colaboradorId = rest.colaborador_id;
      let colaboradorNome = rest.colaborador_nome;

      if (_novoColaborador) {
        const col = await criarColaboradorParaFolha(_novoColaborador);
        colaboradorId = col.id;
        colaboradorNome = col.nome;
      }

      await salvarCadastroPessoaFolha(
        { ...rest, colaborador_id: colaboradorId, colaborador_nome: colaboradorNome },
        pessoaDialog?.id || null,
      );
      invalidate();
      setFabOpen(false);
      setPessoaDialog(null);
      toast({ title: 'Pessoa salva', description: 'Ela já entra na programação e na projeção.' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirCentrosCusto = () => {
    setFabOpen(false);
    setCentroDialogOpen(true);
  };

  const handleMoverPessoaCentro = async (modelo, centroDestino) => {
    if (!modelo?.id) return;
    const centroAtual = String(modelo.centro_custo || '').trim();
    const destino = String(centroDestino || '').trim();
    if (centroAtual === destino) return;
    setSaving(true);
    try {
      await atualizarCentroCustoPessoaFolha(modelo.id, destino);
      invalidate();
      toast({
        title: 'Centro de custo atualizado',
        description: `${modelo.colaborador_nome || modelo.nome} → ${destino || 'Sem centro de custo'}`,
      });
    } catch (e) {
      toast({ title: 'Erro ao mover pessoa', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      setDropCentroAtual('__none__');
      setDraggingModeloId('');
    }
  };

  const handleDeletePessoa = async (cadastro) => {
    const nome = cadastro.colaborador_nome || cadastro.nome || 'esta pessoa';
    if (!window.confirm(`Remover ${nome} da folha? A programação deixa de incluí-la.`)) return;
    setSaving(true);
    try {
      await base44.entities.FolhaPrevisaoModelo.delete(cadastro.id);
      invalidate();
      toast({ title: 'Removido da folha' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDesligamento = async (dados) => {
    if (!desligamentoModelo?.id) return;
    setSaving(true);
    try {
      await registrarDesligamento(desligamentoModelo.id, dados);
      invalidate();
      setDesligamentoModelo(null);
      setPessoaDialog(null);
      toast({
        title: 'Desligamento registrado',
        description: `${desligamentoModelo.colaborador_nome || desligamentoModelo.nome} não entrará nos meses seguintes.`,
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReativar = async (modelo) => {
    setSaving(true);
    try {
      await reativarNaFolha(modelo.id);
      invalidate();
      toast({ title: 'Reativado na folha' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMovimento = async (mov) => {
    if (!selectedComp) return;
    if (isCompetenciaPlanejamento(selectedComp)) {
      toast({
        title: 'Mês em planejamento',
        description: 'Abra o mês para registrar movimentos.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await adicionarMovimento(selectedComp.id, mov);
      setSelectedComp(updated);
      invalidate();
      setMovimentoOpen(false);
      toast({ title: 'Movimento registrado' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMovimento = async (movId) => {
    if (!selectedComp) return;
    try {
      const updated = await removerMovimento(selectedComp.id, movId);
      setSelectedComp(updated);
      invalidate();
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleGerarPdfPessoas = async () => {
    if (!pessoasFiltradas.length) {
      toast({
        title: 'Nenhuma pessoa',
        description: 'Cadastre pessoas na folha antes de gerar o PDF.',
        variant: 'destructive',
      });
      return;
    }

    setGerandoPdfPessoas(true);
    try {
      const filtroLabel =
        FILTRO_VINCULO_OPTS.find((opt) => opt.id === filtroVinculo)?.label || 'Todos';
      const blob = await generateFolhaPessoasPorCentroPdf({
        modelos: pessoasFiltradas,
        centrosRegistrados,
        colaboradoresMap,
        competenciaInicio: getCompetenciaAtual(),
        filtroVinculoLabel: filtroLabel,
      });
      const data = new Date().toISOString().slice(0, 10);
      const result = await shareOrDownloadBlob(
        blob,
        `folha_relatorio_centro_custo_${data}.pdf`,
        'application/pdf',
        'Folha — Relatório por centro de custo',
      );
      if (result !== 'aborted') {
        toast({
          title: result === 'shared' ? 'PDF compartilhado' : 'PDF gerado',
          description: `Relatório com ${pessoasFiltradas.length} pessoa(s) — média mensal em 12 meses.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Erro ao gerar PDF',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setGerandoPdfPessoas(false);
    }
  };

  const handleSyncFinanceiro = async () => {
    if (!selectedComp || !contaPadrao) {
      toast({ title: 'Configure uma conta financeira', variant: 'destructive' });
      return;
    }
    setSyncing(true);
    try {
      await sincronizarLancamentoFinanceiro(selectedComp, {
        contaFinanceiraId: contaPadrao.id,
        categoriaNome: 'Salários',
        modelo: selectedModelo,
      });
      toast({ title: 'Enviado ao financeiro', description: 'Lançamento previsto criado/atualizado.' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="w-full min-w-0 overflow-x-hidden font-din-1451 bg-background pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="flex items-center gap-1.5 pb-3 border-b border-border/40">
        <h1 className="text-xl font-medium text-foreground">Folha</h1>
        <P38HelpPopover label="Ajuda: visão geral da folha" side="bottom" align="start">
          <p className="font-medium text-foreground">Como funciona a folha</p>
          <p className="text-muted-foreground">
            Previsão de custos com pessoas. A folha fecha no último dia de cada mês e o pagamento vence no dia{' '}
            {FOLHA_DIA_VENCIMENTO} do mês seguinte.
          </p>
          <p className="text-muted-foreground">
            Meses futuros aparecem em modo planejamento, mesmo antes de abrir o mês.
          </p>
        </P38HelpPopover>
      </div>

      <Tabs
        value={abaAtiva}
        onValueChange={(next) => {
          if (abaAtiva === 'simulacao' && next !== 'simulacao') {
            setSimulacaoKey((k) => k + 1);
          }
          setAbaAtiva(next);
        }}
        className="w-full mt-4"
      >
        <TabsList className={cn('w-full h-auto p-1 rounded-xl flex-nowrap overflow-x-auto md:overflow-visible md:flex-wrap', P38_FIELD_SURFACE)}>
          <TabsTrigger value="previsao" className="shrink-0 md:flex-1 gap-2 rounded-lg py-2 min-h-[40px] min-w-[86px] md:min-w-[120px]">
            <CalendarClock className="w-4 h-4" />
            <span className="text-xs md:hidden">Mês</span>
            <span className="hidden md:inline text-sm">Previsão do mês</span>
          </TabsTrigger>
          <TabsTrigger value="projecao" className="shrink-0 md:flex-1 gap-2 rounded-lg py-2 min-h-[40px] min-w-[86px] md:min-w-[120px]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs md:hidden">12m</span>
            <span className="hidden md:inline text-sm">Projeção 12 meses</span>
          </TabsTrigger>
          <TabsTrigger value="pessoas" className="shrink-0 md:flex-1 gap-2 rounded-lg py-2 min-h-[40px] min-w-[100px] md:min-w-[120px]">
            <Users className="w-4 h-4" />
            <span className="text-xs md:hidden">Pessoas</span>
            <span className="hidden md:inline text-sm">Pessoas</span>
          </TabsTrigger>
          <TabsTrigger value="simulacao" className="shrink-0 md:flex-1 gap-2 rounded-lg py-2 min-h-[40px] min-w-[100px] md:min-w-[120px]">
            <FlaskConical className="w-4 h-4" />
            <span className="text-xs md:hidden">Simular</span>
            <span className="hidden md:inline text-sm">Simulação</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="previsao" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={cn('w-full sm:w-auto flex items-center justify-between gap-1 rounded-xl px-1', P38_FIELD_SURFACE)}>
              <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex-1 min-w-[100px] text-center text-sm font-semibold uppercase tracking-wide">
                {formatCompetenciaLabel(competenciaMes)}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setCompetenciaMes(shiftCompetencia(competenciaMes, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 flex-1 sm:flex-none"
                onClick={handleDesfazerAbrirMes}
                disabled={saving || !hasCompetenciasPersistidas}
              >
                <RotateCcw className="h-4 w-4" />
                Desfazer abrir mês
              </Button>
              <Button className="gap-2 flex-1 sm:flex-none" onClick={handleAbrirMes} disabled={saving}>
                <Users className="h-4 w-4" />
                Abrir mês
              </Button>
            </div>
          </div>

          <FolhaPrevisaoResumo
            totais={totaisGrupo}
            count={totaisGrupo.count}
            countPlanejamento={qtdPlanejamento}
            mesFuturo={mesFuturo}
            competenciaLabel={`${formatCompetenciaLabel(competenciaMes)} · ${formatCicloFolhaCompetencia(competenciaMes)}`}
          />

          <FiltroVinculoChips value={filtroVinculo} onChange={setFiltroVinculo} />

          <FolhaPrevisaoFiltros
            busca={filtroBusca}
            onBuscaChange={setFiltroBusca}
            centro={filtroCentro}
            onCentroChange={setFiltroCentro}
            centrosRegistrados={centrosRegistrados}
          />

          <FinanceiroListaEstado
            loading={loadingComp || loadingModelos}
            loadingMessage="Carregando previsão da folha…"
            vazio={!loadingComp && !loadingModelos && competenciasExibidas.length === 0}
            vazioMensagem={
              filtroBusca || filtroCentro !== '__todos__'
                ? 'Nenhuma pessoa encontrada com estes filtros.'
                : `Nenhuma pessoa cadastrada para ${formatCompetenciaLabel(competenciaMes)}${filtroVinculo !== 'todos' ? ` (${TIPO_VINCULO_LABELS[filtroVinculo]})` : ''}. Cadastre na aba Pessoas.`
            }
            vazioIcon={Users}
          >
            <FolhaPrevisaoLista
              competencias={competenciasExibidas}
              modelosMap={modelosMap}
              centrosRegistrados={centrosRegistrados}
              onOpen={setSelectedComp}
            />
          </FinanceiroListaEstado>

          {!loadingComp && !loadingModelos && competenciasExibidas.length === 0 && !filtroBusca && filtroCentro === '__todos__' && (
            <div className="flex justify-center -mt-6 pb-4 gap-2">
              <Button variant="outline" onClick={() => setPessoaDialog({})}>Cadastrar pessoa</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="projecao" className="mt-4">
          <FolhaPrevisaoProjecao modelos={modelos} competenciaInicio={competenciaMes} />
        </TabsContent>

        <TabsContent value="pessoas" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FiltroVinculoChips value={filtroVinculo} onChange={setFiltroVinculo} />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleGerarPdfPessoas}
                disabled={gerandoPdfPessoas || loadingModelos || pessoasFiltradas.length === 0}
              >
                {gerandoPdfPessoas ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {gerandoPdfPessoas ? 'Gerando…' : 'PDF relatório'}
              </Button>
              <P38HelpPopover label="Ajuda: aba Pessoas" side="bottom" align="end">
              <p className="font-medium text-foreground">Organização por centro de custo</p>
              <p className="text-muted-foreground">
                Cadastre centros pelo botão <strong className="text-foreground">+</strong>, depois arraste a pessoa para a bolinha do centro desejado.
              </p>
              <p className="text-muted-foreground">
                No formulário, o centro de custo é escolhido na lista — não digite um nome novo.
              </p>
              </P38HelpPopover>
            </div>
          </div>

          <FinanceiroListaEstado
            loading={loadingModelos}
            loadingMessage="Carregando pessoas da folha…"
            vazio={!loadingModelos && pessoasFiltradas.length === 0}
            vazioMensagem="Nenhuma pessoa cadastrada na folha."
            vazioIcon={Users}
          >
            <div className="space-y-3">
              {[...centrosRegistrados, '__sem__'].map((centro) => {
                const chave = centro || '__sem__';
                const pessoas = pessoasPorCentro[chave] || [];
                const centroLabel = chave === '__sem__' ? 'Sem centro de custo' : centro;
                return (
                  <div
                    key={chave}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggingModeloId) setDropCentroAtual(chave);
                    }}
                    onDragLeave={() => setDropCentroAtual((v) => (v === chave ? '__none__' : v))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const modeloId = e.dataTransfer.getData('text/plain');
                      const modelo = pessoasFiltradas.find((p) => p.id === modeloId);
                      if (modelo) void handleMoverPessoaCentro(modelo, chave === '__sem__' ? '' : centro);
                    }}
                    className={cn(
                      'rounded-xl border border-border/60 bg-card/40',
                      dropCentroAtual === chave && draggingModeloId
                        ? 'ring-2 ring-primary/50 border-primary/50'
                        : '',
                    )}
                  >
                    <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground print:text-black">{centroLabel}</p>
                      {pessoas.length > 0 && (
                        <span className="text-xs text-muted-foreground print:text-black/70">
                          {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
                        </span>
                      )}
                    </div>
                    {pessoas.length > 0 ? (
                      <P38MobileLineList className="block md:!block rounded-none overflow-hidden">
                        {pessoas.map((m, idx) => (
                          <div
                            key={m.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', m.id);
                              setDraggingModeloId(m.id);
                              void refetchCentros();
                            }}
                            onDragEnd={() => {
                              setDraggingModeloId('');
                              setDropCentroAtual('__none__');
                            }}
                          >
                            <FolhaPrevisaoModeloRow
                              modelo={m}
                              colaborador={colaboradoresMap[m.colaborador_id]}
                              onEdit={setPessoaDialog}
                              onDelete={handleDeletePessoa}
                              striped={idx % 2 === 1}
                              showCentroCusto={false}
                            />
                          </div>
                        ))}
                      </P38MobileLineList>
                    ) : (
                      <div className="px-3 py-3 text-xs text-muted-foreground">
                        Arraste uma pessoa para este centro.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </FinanceiroListaEstado>

          {!loadingModelos && pessoasFiltradas.length === 0 && (
            <div className="flex justify-center -mt-6 pb-4">
              <Button onClick={() => setPessoaDialog({})}>Cadastrar primeira pessoa</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="simulacao" className="mt-4">
          <FolhaSimulacao
            key={simulacaoKey}
            modelos={modelos}
            centrosRegistrados={centrosRegistrados}
            colaboradoresMap={colaboradoresMap}
            loading={loadingModelos}
          />
        </TabsContent>
      </Tabs>

      <FolhaPrevisaoDetalheDrawer
        open={Boolean(selectedComp)}
        onClose={() => setSelectedComp(null)}
        competencia={selectedComp}
        modelo={selectedModelo}
        onAddMovimento={() => setMovimentoOpen(true)}
        onRemoveMovimento={handleRemoveMovimento}
        onSyncFinanceiro={handleSyncFinanceiro}
        syncing={syncing}
        onAbrirMes={handleAbrirMes}
        abrindoMes={saving}
      />

      <FolhaPessoaDialog
        open={pessoaDialog !== null}
        onClose={() => setPessoaDialog(null)}
        cadastro={pessoaDialog?.id ? pessoaDialog : null}
        colaboradoresDisponiveis={colaboradoresDisponiveis}
        centrosCustoRegistros={centrosCustoRegistros}
        onCentrosCustoChange={async () => {
          await refetchCentros();
        }}
        onSave={handleSavePessoa}
        onDesligar={setDesligamentoModelo}
        onReativar={handleReativar}
        saving={saving}
      />

      <FolhaCentrosCustoDialog
        open={centroDialogOpen}
        onClose={() => setCentroDialogOpen(false)}
        onChanged={invalidateCentros}
      />

      <FolhaPrevisaoDesligamentoDialog
        open={Boolean(desligamentoModelo)}
        onClose={() => setDesligamentoModelo(null)}
        modelo={desligamentoModelo}
        onConfirm={handleDesligamento}
        saving={saving}
      />

      <FolhaPrevisaoMovimentoDialog
        open={movimentoOpen}
        onClose={() => setMovimentoOpen(false)}
        onSave={handleAddMovimento}
        saving={saving}
      />

      <FolhaCentroCustoDragOverlay
        open={Boolean(draggingModeloId)}
        centros={centrosRegistrados}
        pessoaNome={pessoaArrastando?.colaborador_nome || pessoaArrastando?.nome}
        dropCentroAtual={dropCentroAtual}
        onHoverCentro={setDropCentroAtual}
        onLeaveCentro={(chave) => setDropCentroAtual((v) => (v === chave ? '__none__' : v))}
        onDropCentro={(centroNome) => {
          if (!pessoaArrastando) return;
          void handleMoverPessoaCentro(pessoaArrastando, centroNome);
          setDraggingModeloId('');
          setDropCentroAtual('__none__');
        }}
      />

      <div className="fixed right-4 bottom-20 md:bottom-6 z-40">
        {fabOpen && (
          <div className="mb-2 flex flex-col items-end gap-2">
            <Button
              size="sm"
              className="rounded-full shadow-lg"
              onClick={() => setPessoaDialog({})}
            >
              Cadastrar pessoa
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full shadow-lg"
              onClick={handleAbrirCentrosCusto}
            >
              Centros de custo
            </Button>
          </div>
        )}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl"
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Abrir ações de cadastro"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
