import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Repeat2, TrendingUp } from 'lucide-react';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { mapaModelosPorId, ordenarSeriesPorCentroENome, shiftCompetencia } from '@/lib/agefinPrevisaoCalculos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompetenciaUrl } from '../hooks/useCompetenciaUrl';
import { useAgefinPrevisaoQueries } from '../hooks/useAgefinPrevisaoQueries';
import { usePlanejamentoActions } from '../hooks/usePlanejamentoActions';
import ContasFixasTab from '../tabs/ContasFixasTab';
import PrevisaoMesTab from '../tabs/PrevisaoMesTab';
import ProjecaoTab from '../tabs/ProjecaoTab';
import PlanejamentoDialogs, { PlanejamentoFab } from '../components/PlanejamentoDialogs';
import { agefinQueryKeys } from '../constants/queryKeys';

export default function PlanejamentoFinanceiroV2Page() {
  const queryClient = useQueryClient();
  const { competenciaMes, setCompetenciaMes, abaAtiva, setAbaAtiva } = useCompetenciaUrl();

  const [selectedComp, setSelectedComp] = useState(null);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCentro, setFiltroCentro] = useState('__todos__');
  const [groupBy, setGroupBy] = useState('vencimento');
  const [sortOrder, setSortOrder] = useState('asc');
  const [groupByContas, setGroupByContas] = useState('dia_vencimento');
  const [sortOrderContas, setSortOrderContas] = useState('asc');
  const [draggingSerieId, setDraggingSerieId] = useState('');
  const [dropCentroAtual, setDropCentroAtual] = useState('__none__');
  const [centroDialogOpen, setCentroDialogOpen] = useState(false);
  const [showImportador, setShowImportador] = useState(false);
  const [importadorLancamentoId, setImportadorLancamentoId] = useState(null);

  const queries = useAgefinPrevisaoQueries({
    abaAtiva,
    competenciaMes,
    precisaContas: Boolean(selectedComp),
  });

  const modelosMap = useMemo(() => mapaModelosPorId(queries.modelos), [queries.modelos]);
  const selectedModelo = selectedComp ? modelosMap[selectedComp.serie_id] : null;
  const contaPadrao = queries.contas.find((c) => c.ativo !== false) || queries.contas[0];

  const actions = usePlanejamentoActions({
    competenciaMes,
    modelos: queries.modelos,
    modelosMap,
    parcelamentos: queries.parcelamentos,
    contaPadrao,
    selectedComp,
    selectedModelo,
    setSelectedComp,
  });

  const seriesAtivas = useMemo(
    () => ordenarSeriesPorCentroENome(queries.modelos.filter((m) => m.ativo !== false)),
    [queries.modelos],
  );

  const serieArrastando = useMemo(
    () => seriesAtivas.find((s) => s.id === draggingSerieId) || null,
    [seriesAtivas, draggingSerieId],
  );

  const handleCategoriasChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agefinQueryKeys.categorias });
  }, [queryClient]);

  return (
    <div className="p38-dashboard min-h-screen w-full mx-auto max-w-md md:max-w-7xl overflow-x-hidden bg-background px-4 pt-4 pb-[var(--p38-scroll-pad-below-nav)] md:pb-8">
      <div>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="p38-dashboard-title truncate">
            Planejamento financeiro
          </h1>
          <P38HelpPopover label="Ajuda: planejamento financeiro" side="bottom" align="start">
            <p className="font-medium text-foreground">Uma fonte de verdade</p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Contas fixas</strong> = as{' '}
              <strong className="text-foreground">séries</strong> (regra da recorrência). Aqui se cria,
              edita e remove da agenda.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Previsão do mês</strong> = projeção{' '}
              <strong className="text-foreground">virtual</strong> daquele mês. Só vira lançamento real
              quando <strong className="text-foreground">abres o mês</strong>.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">AGEFIN Consulta</strong> lê o que já é real no
              financeiro (incluindo fretes e avulsos).
            </p>
          </P38HelpPopover>
        </div>
        <p className="p38-dashboard-subtitle">
          Série manda · Previsão é virtual · Abrir mês materializa
        </p>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="mt-4 w-full">
        <TabsList
          className={cn(
            'p38-dashboard-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1 md:flex md:flex-wrap md:overflow-visible',
            P38_FIELD_SURFACE,
          )}
        >
          <TabsTrigger
            value="contas"
            title="Contas fixas"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-1.5 sm:px-2 md:flex-1 md:min-w-[120px]"
          >
            <Repeat2 className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">Contas</span>
            <span className="hidden md:inline text-sm">Contas fixas</span>
          </TabsTrigger>
          <TabsTrigger
            value="previsao"
            title="Previsão do mês"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-1.5 sm:px-2 md:flex-1 md:min-w-[120px]"
          >
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">Mês</span>
            <span className="hidden md:inline text-sm">Previsão do mês</span>
          </TabsTrigger>
          <TabsTrigger
            value="projecao"
            title="Projeção 12 meses"
            className="gap-1.5 rounded-lg py-2 min-h-[40px] min-w-0 px-1.5 sm:px-2 md:flex-1 md:min-w-[120px]"
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="text-xs truncate md:hidden">12m</span>
            <span className="hidden md:inline text-sm">Projeção 12 meses</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4">
          <ContasFixasTab
            loading={queries.loadingModelos}
            modelos={queries.modelos}
            centrosRegistrados={queries.centrosRegistrados}
            groupBy={groupByContas}
            sortOrder={sortOrderContas}
            onGroupByChange={setGroupByContas}
            onSortOrderToggle={() => setSortOrderContas((o) => (o === 'asc' ? 'desc' : 'asc'))}
            draggingSerieId={draggingSerieId}
            dropCentroAtual={dropCentroAtual}
            onDragStart={(id) => {
              setDraggingSerieId(id);
              void queries.refetchCentros();
            }}
            onDragEnd={() => {
              setDraggingSerieId('');
              setDropCentroAtual('__none__');
            }}
            onHoverCentro={setDropCentroAtual}
            onLeaveCentro={() => setDropCentroAtual('__none__')}
            onDropCentro={(serieId, centro) => {
              const serie = seriesAtivas.find((s) => s.id === serieId);
              if (serie) {
                void actions.handleMoverSerieCentro(serie, centro, () => {
                  setDraggingSerieId('');
                  setDropCentroAtual('__none__');
                });
              }
            }}
            onEdit={actions.setSerieDialog}
            onDelete={actions.handleDeleteSerie}
            onCadastrar={() => actions.setSerieDialog({})}
          />
        </TabsContent>

        <TabsContent value="previsao" className="mt-0">
          <PrevisaoMesTab
            competenciaMes={competenciaMes}
            onMesAnterior={() => setCompetenciaMes(shiftCompetencia(competenciaMes, -1))}
            onMesProximo={() => setCompetenciaMes(shiftCompetencia(competenciaMes, 1))}
            onAbrirMes={actions.handleAbrirMes}
            onDesfazerAbrirMes={actions.handleDesfazerAbrirMes}
            saving={actions.saving}
            loading={queries.loadingLancamentos || queries.loadingModelos}
            modelos={queries.modelos}
            lancamentosMes={queries.lancamentosMes}
            parcelamentos={queries.parcelamentos}
            lancamentosRecorrentes={queries.lancamentosRecorrentes}
            filtroBusca={filtroBusca}
            onBuscaChange={setFiltroBusca}
            filtroCentro={filtroCentro}
            onCentroChange={setFiltroCentro}
            centrosRegistrados={queries.centrosRegistrados}
            groupBy={groupBy}
            sortOrder={sortOrder}
            onGroupByChange={setGroupBy}
            onSortOrderToggle={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            onOpenCompetencia={setSelectedComp}
            onNovoLancamento={() => actions.setSerieDialog({})}
          />
        </TabsContent>

        <TabsContent value="projecao" className="mt-0">
          <ProjecaoTab
            loading={queries.loadingModelos || queries.loadingRecorrentes}
            modelos={queries.modelos}
            competenciaMes={competenciaMes}
            lancamentosRecorrentes={queries.lancamentosRecorrentes}
            onNovoLancamento={() => actions.setSerieDialog({})}
          />
        </TabsContent>
      </Tabs>

      <PlanejamentoFab
        onCentros={() => setCentroDialogOpen(true)}
        onImportar={() => {
          setImportadorLancamentoId(null);
          setShowImportador(true);
        }}
        onNovaConta={() => actions.setSerieDialog({})}
      />

      <PlanejamentoDialogs
        selectedComp={selectedComp}
        selectedModelo={selectedModelo}
        onCloseSelected={() => setSelectedComp(null)}
        centrosRegistrados={queries.centrosRegistrados}
        centrosCustoRegistros={queries.centrosCustoRegistros}
        categorias={queries.categorias}
        onCategoriasChange={handleCategoriasChange}
        onCentrosChange={actions.invalidateCentros}
        serieDialog={actions.serieDialog}
        onCloseSerieDialog={() => actions.setSerieDialog(null)}
        onSaveSerie={actions.handleSaveSerie}
        saving={actions.saving}
        parcelamentoDialog={actions.parcelamentoDialog}
        onCloseParcelamentoDialog={() => actions.setParcelamentoDialog(false)}
        onCriarParcelamento={actions.handleCriarParcelamento}
        salvandoParcelamento={actions.salvandoParcelamento}
        centroDialogOpen={centroDialogOpen}
        onCloseCentroDialog={() => setCentroDialogOpen(false)}
        onCentrosChanged={actions.invalidateCentros}
        draggingSerieId={draggingSerieId}
        serieArrastando={serieArrastando}
        dropCentroAtual={dropCentroAtual}
        onHoverCentro={setDropCentroAtual}
        onLeaveCentro={(chave) => setDropCentroAtual((v) => (v === chave ? '__none__' : v))}
        onDropCentro={(centro) => {
          if (serieArrastando) {
            void actions.handleMoverSerieCentro(serieArrastando, centro, () => {
              setDraggingSerieId('');
              setDropCentroAtual('__none__');
            });
          }
        }}
        showImportador={showImportador}
        onCloseImportador={() => {
          setShowImportador(false);
          setImportadorLancamentoId(null);
        }}
        importadorLancamentoId={importadorLancamentoId}
        onImportadorSuccess={() => {
          actions.refreshDepoisDeLancamentos();
          setShowImportador(false);
          setImportadorLancamentoId(null);
          void actions.recarregarVisaoMes().then(actions.refreshSelectedComp);
        }}
        syncing={actions.syncing}
        onSyncFinanceiro={() => void actions.handleSyncFinanceiro()}
        onAbrirSerieNoMes={actions.handleAbrirSerieNoMes}
        abrindoMes={actions.saving}
        onVincularBoleto={() =>
          actions.handleVincularBoleto((lancId) => {
            setImportadorLancamentoId(lancId);
            setShowImportador(true);
          })
        }
        onSalvarManual={actions.handleSalvarManual}
        salvandoManual={actions.salvandoManual}
        podeParcelarConta={actions.podeParcelarConta}
        onParcelar={() => actions.setParcelamentoDialog(true)}
        onSalvarParcela={actions.handleSalvarParcela}
        onRemoverParcelamento={
          selectedComp?._parcelamentoId ? actions.handleRemoverParcelamento : undefined
        }
        removendoParcelamento={actions.removendoParcelamento}
      />
    </div>
  );
}
