import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Anchor, ChevronDown, List, Map, Plus, Search } from 'lucide-react';
import {
  useLogisticaEmbarquesQuery,
  useLogisticaEventosQuery,
  useLogisticaLancamentosFretesQuery,
  useTransportadorasFluvialQuery,
} from '@/hooks/useP38Entities';
import { p38Keys } from '@/lib/p38QueryConfig';
import {
  applyFluvialOcupacaoProjection,
  buildBoatViewModels,
  buildFluvialEvents,
} from '@/components/logistica-sandbox/fluvialDataUtils';
import { buildFluvialFleetMapModels } from '@/lib/fluvialRiverProjection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BoatDetailsDialog from '@/components/logistica-sandbox/BoatDetailsDialog';
import NewTransportadoraDialog from '@/components/logistica-sandbox/NewTransportadoraDialog';
import FluvialRiverMap from '@/components/logistica-sandbox/FluvialRiverMap';
import FluvialBoatListSidebar from '@/components/logistica-sandbox/FluvialBoatListSidebar';
import FluvialMapDetailPanel from '@/components/logistica-sandbox/FluvialMapDetailPanel';
import '@/components/logistica-sandbox/fluvial-map-premium.css';

const LAYER_OPTIONS = [
  { value: 'lista', label: 'Lista', icon: List },
  { value: 'mapa', label: 'Mapa', icon: Map },
];

function StatusBadge({ status }) {
  const classes = status === 'ativa'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90';

  return <Badge className={`border-0 shadow-none ${classes}`}>{status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>;
}

function BoatListCard({ transportadora, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl bg-card border border-border/40 shadow-sm p-4 text-left transition hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl bg-muted flex items-center justify-center shadow-sm flex-shrink-0 ring-2 ${transportadora.status === 'ativa' ? 'ring-emerald-500/70' : 'ring-border/40 dark:ring-border/50'}`}>
            <Anchor className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground font-glacial truncate">{transportadora.nome || 'Sem nome'}</h3>
            <p className="text-sm text-muted-foreground truncate">Próximo ETA: {transportadora.proximo_eta}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={transportadora.status} />
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shadow-sm">
            <ChevronDown className="w-4 h-4 text-foreground/90" />
          </div>
        </div>
      </div>
    </button>
  );
}

function BoatListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-3xl bg-card border border-border/40 shadow-sm p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BoatsMapLayer({
  fleet,
  loading,
  simulationDate,
  onSimulationDateChange,
  embarqueLinkFilter,
  onEmbarqueLinkFilterChange,
  onClose,
}) {
  const [selectedFleetKey, setSelectedFleetKey] = useState(null);
  const [hoveredFleetKey, setHoveredFleetKey] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedEvento = useMemo(() => {
    if (!fleet.length) return null;
    if (selectedFleetKey) {
      return fleet.find((item) => (item.fleetKey || item.id) === selectedFleetKey) || null;
    }
    return null;
  }, [fleet, selectedFleetKey]);

  const handleSelect = (evento) => {
    if (!evento) {
      setSelectedFleetKey(null);
      setDetailOpen(false);
      return;
    }
    const key = evento.fleetKey || evento.id;
    setSelectedFleetKey(key);
    setDetailOpen(true);
  };

  return (
    <div className="fluvial-command-center fluvial-premium-root">
      <div className="fluvial-command-map">
        <FluvialRiverMap
          eventos={fleet}
          selectedFleetKey={selectedFleetKey}
          hoveredFleetKey={hoveredFleetKey}
          onSelect={handleSelect}
          onHover={setHoveredFleetKey}
          simulationDate={simulationDate}
          loading={loading}
          embedded
        />
      </div>

      <div className="fluvial-command-toolbar fluvial-premium-glass">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-white/38">Data simulada</label>
          <input
            type="date"
            value={simulationDate}
            onChange={(e) => onSimulationDateChange(e.target.value)}
            className="w-full rounded-lg border border-white/12 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'com_vinculo', label: 'Com vínculo' },
            { value: 'sem_vinculo', label: 'Sem vínculo' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onEmbarqueLinkFilterChange(item.value)}
              className={`rounded-full border px-3 py-1.5 text-xs tracking-wide transition ${embarqueLinkFilter === item.value ? 'border-white bg-white text-black' : 'border-white/18 text-white/55 hover:border-white/35'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <span className="hidden text-[10px] uppercase tracking-[0.14em] text-white/35 sm:inline">
            {fleet.length} embarcação{fleet.length !== 1 ? 'ões' : ''}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/18 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/35 hover:text-white"
            >
              Voltar à lista
            </button>
          ) : null}
        </div>
      </div>

      <div className="fluvial-command-sidebar hidden md:block">
        <FluvialBoatListSidebar
          eventos={fleet}
          selectedFleetKey={selectedFleetKey}
          onSelect={handleSelect}
          floating
        />
      </div>

      {detailOpen && selectedEvento ? (
        <div className="fluvial-command-detail">
          <FluvialMapDetailPanel
            evento={selectedEvento}
            onClose={() => {
              setDetailOpen(false);
              setSelectedFleetKey(null);
            }}
            floating
          />
        </div>
      ) : null}
    </div>
  );
}

export default function BoatsTab() {
  const [viewLayer, setViewLayer] = useState('lista');
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const [selectedBoatId, setSelectedBoatId] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [simulationDate, setSimulationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [embarqueLinkFilter, setEmbarqueLinkFilter] = useState('todos');
  const queryClient = useQueryClient();

  const {
    data: transportadorasData = [],
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useTransportadorasFluvialQuery();

  const { data: eventosData = [], isPending: eventosPending, isFetching: eventosFetching } = useLogisticaEventosQuery();
  const { data: embarquesData = [], isPending: embarquesPending } = useLogisticaEmbarquesQuery();
  const { data: lancamentosFretesData = [], isPending: lancamentosPending } = useLogisticaLancamentosFretesQuery();
  const viagensCarregando = eventosPending || embarquesPending || lancamentosPending;

  const eventosEnriquecidos = useMemo(() => buildFluvialEvents({
    eventosLogisticos: eventosData,
    embarques: embarquesData,
    lancamentosFinanceiros: lancamentosFretesData,
  }), [eventosData, embarquesData, lancamentosFretesData]);

  const eventosProjetados = useMemo(
    () => applyFluvialOcupacaoProjection(eventosEnriquecidos, simulationDate),
    [eventosEnriquecidos, simulationDate],
  );

  const mapFleet = useMemo(() => {
    const eventosComEmbarque = new Set(
      embarquesData.map((emb) => emb.evento_logistico_id).filter(Boolean),
    );
    const transportadorasAtivas = new Set(
      transportadorasData.filter((item) => item.ativo !== false).map((item) => item.id),
    );

    const filtrados = eventosProjetados.filter((evento) => {
      const transportadoraId = evento.transportadora_id || evento.embarcacao_template_id;
      if (!transportadorasAtivas.has(transportadoraId)) return false;

      const temVinculoEmbarque = eventosComEmbarque.has(evento.id)
        || (evento.total_embarques_relacionados || 0) > 0;
      if (embarqueLinkFilter === 'com_vinculo' && !temVinculoEmbarque) return false;
      if (embarqueLinkFilter === 'sem_vinculo' && temVinculoEmbarque) return false;
      return true;
    });

    return buildFluvialFleetMapModels(filtrados, simulationDate);
  }, [eventosProjetados, embarquesData, transportadorasData, simulationDate, embarqueLinkFilter]);

  const transportadorasNormalizadas = useMemo(() => {
    return buildBoatViewModels({
      transportadoras: transportadorasData,
      eventos: eventosEnriquecidos,
    });
  }, [transportadorasData, eventosEnriquecidos]);

  const transportadoras = useMemo(() => {
    const termo = search.trim().toLowerCase();
    let items = transportadorasNormalizadas;

    if (filter === 'ativas') items = items.filter((item) => item.status === 'ativa');
    if (filter === 'inativas') items = items.filter((item) => item.status === 'inativa');
    if (termo) items = items.filter((item) => (item.nome || '').toLowerCase().includes(termo));

    return [...items].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [filter, search, transportadorasNormalizadas]);

  const hasActiveFilters = filter !== 'todas' || search.trim().length > 0;
  const totalCadastradas = transportadorasNormalizadas.length;

  const selectedBoat = useMemo(
    () => transportadorasNormalizadas.find((item) => item.id === selectedBoatId) || null,
    [transportadorasNormalizadas, selectedBoatId],
  );

  const handleSaveBoat = async (updatedBoat) => {
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.transportadorasFluvial() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.eventos() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.embarques() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.lancamentosFretes() });
    setSelectedBoatId(updatedBoat.id);
  };

  const handleCreatedBoat = async (createdBoat) => {
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.transportadorasFluvial() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.eventos() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.embarques() });
    await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.lancamentosFretes() });
    setSelectedBoatId(createdBoat.id);
  };

  const handleDeleteBoat = () => {
    setSelectedBoatId(null);
  };

  const handleInactivateBoat = () => {
    setSelectedBoatId(null);
  };

  const emptyMessage = hasActiveFilters
    ? 'Nenhuma transportadora encontrada com os filtros atuais.'
    : 'Nenhuma transportadora cadastrada ainda.';

  return (
    <div className="space-y-4 relative z-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {LAYER_OPTIONS.map((item) => {
            const Icon = item.icon;
            const active = viewLayer === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setViewLayer(item.value)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm shadow-sm transition ${active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card text-muted-foreground'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
        {viewLayer === 'lista' ? (
          <Button onClick={() => setShowNewDialog(true)} className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" /> Nova transportadora
          </Button>
        ) : null}
      </div>

      {viewLayer === 'mapa' ? (
        <BoatsMapLayer
          fleet={mapFleet}
          loading={viagensCarregando}
          simulationDate={simulationDate}
          onSimulationDateChange={setSimulationDate}
          embarqueLinkFilter={embarqueLinkFilter}
          onEmbarqueLinkFilterChange={setEmbarqueLinkFilter}
          onClose={() => setViewLayer('lista')}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'todas', label: 'Todas' },
                { value: 'ativas', label: 'Ativas' },
                { value: 'inativas', label: 'Inativas' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`px-4 py-2 rounded-2xl text-sm shadow-sm transition ${filter === item.value ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card text-muted-foreground'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar transportadora" className="border-0 bg-transparent shadow-none h-10 px-0" />
          </div>

          {!isPending && !isError && totalCadastradas > 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              {transportadoras.length} de {totalCadastradas} transportadora{totalCadastradas !== 1 ? 's' : ''}
              {isFetching || eventosFetching ? ' · atualizando…' : ''}
              {viagensCarregando ? ' · carregando viagens…' : ''}
            </p>
          ) : null}

          {isPending ? (
            <BoatListSkeleton />
          ) : isError ? (
            <div className="rounded-3xl bg-card border border-destructive/30 shadow-sm p-6 space-y-3">
              <p className="text-sm text-foreground">Não foi possível carregar as transportadoras.</p>
              <p className="text-xs text-muted-foreground">{error?.message || 'Erro desconhecido ao buscar dados.'}</p>
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {transportadoras.length === 0 ? (
                <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-6 text-sm text-muted-foreground">
                  {emptyMessage}
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={() => { setFilter('todas'); setSearch(''); }}
                      className="mt-3 block text-sm font-medium text-primary hover:underline"
                    >
                      Limpar filtros
                    </button>
                  ) : null}
                </div>
              ) : transportadoras.map((transportadora) => (
                <BoatListCard
                  key={transportadora.id}
                  transportadora={transportadora}
                  onClick={() => setSelectedBoatId(transportadora.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <BoatDetailsDialog
        open={!!selectedBoatId}
        onOpenChange={(open) => !open && setSelectedBoatId(null)}
        transportadora={selectedBoat}
        viagensCarregando={viagensCarregando}
        onSave={handleSaveBoat}
        onDelete={handleDeleteBoat}
        onInactivate={handleInactivateBoat}
      />
      <NewTransportadoraDialog open={showNewDialog} onOpenChange={setShowNewDialog} onCreated={handleCreatedBoat} />
    </div>
  );
}
