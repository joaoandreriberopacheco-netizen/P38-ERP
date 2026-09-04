import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  useLogisticaEmbarquesQuery,
  useLogisticaEventosQuery,
  useLogisticaLancamentosFretesQuery,
} from '@/hooks/useP38Entities';
import { p38Keys } from '@/lib/p38QueryConfig';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { applyFluvialOcupacaoProjection, buildFluvialEvents, formatDate, FLUVIAL_DEFAULT_PERIOD, FLUVIAL_DEFAULT_VIEW_MODE, eventoTemDataNoPeriodo, getFluvialPeriodLabel, getFluvialTimelineDate, getFluvialViewModeLabel } from '@/components/logistica-sandbox/fluvialDataUtils';
import LogisticaSandboxHeader from '@/components/logistica-sandbox/LogisticaSandboxHeader';
import RouteModeToggle from '@/components/logistica-sandbox/RouteModeToggle';
import TimelineDatePicker from '@/components/logistica-sandbox/TimelineDatePicker';
import TimelineDayGroup from '@/components/logistica-sandbox/TimelineDayGroup';
import TimelineSidebarCard from '@/components/logistica-sandbox/TimelineSidebarCard';
import FreteResumoCard from '@/components/logistica-sandbox/FreteResumoCard';
import FreteListCard from '@/components/logistica-sandbox/FreteListCard';
import FreteSearchBar from '@/components/logistica-sandbox/FreteSearchBar';
import MobileDetailHeader from '@/components/logistica-sandbox/MobileDetailHeader';
import BoatsTab from '@/components/logistica-sandbox/BoatsTab';
import ItinerarioFluvialMobile from '@/components/logistica-sandbox/mobile/ItinerarioFluvialMobile';
import FreteDetailPanel from '@/components/logistica-sandbox/FreteDetailPanel';
import FluvialActionFab from '@/components/logistica-sandbox/FluvialActionFab';

export default function ItinerarioFluvial() {
  const [routeType, setRouteType] = useState('Fluvial');
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [simulationDate, setSimulationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState(FLUVIAL_DEFAULT_VIEW_MODE);
  const [isMobile, setIsMobile] = useState(false);
  const [freteSearchQuery, setFreteSearchQuery] = useState('');
  const [embarqueLinkFilter, setEmbarqueLinkFilter] = useState('todos');
  const [periodoFiltro, setPeriodoFiltro] = useState(FLUVIAL_DEFAULT_PERIOD);
  const todayRef = React.useRef(null);
  const queryClient = useQueryClient();

  const { data: eventosLogisticos = [], isPending: eventosPending, isFetching: eventosFetching } = useLogisticaEventosQuery();
  const { data: embarques = [], isPending: embarquesPending } = useLogisticaEmbarquesQuery();
  const { data: lancamentosFinanceiros = [], isPending: lancamentosPending } = useLogisticaLancamentosFretesQuery();
  const timelineCarregando = eventosPending || embarquesPending || lancamentosPending || (eventosFetching && eventosLogisticos.length === 0);

  useEffect(() => {
    const unsub = base44.entities.LancamentoFinanceiro.subscribe((ev) => {
      const d = ev.data || {};
      if (d.referencia_tipo === 'EventosLogisticos' || ev.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: p38Keys.logistica.lancamentosFretes() });
      }
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, [queryClient]);

  const eventosBase = useMemo(() => buildFluvialEvents({
    eventosLogisticos,
    embarques,
    lancamentosFinanceiros,
  }), [eventosLogisticos, embarques, lancamentosFinanceiros]);

  const eventos = useMemo(
    () => applyFluvialOcupacaoProjection(eventosBase, simulationDate),
    [eventosBase, simulationDate],
  );

  React.useEffect(() => {
    setSelectedEvento(null);
  }, [routeType, viewMode, simulationDate, periodoFiltro, embarqueLinkFilter]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const groupedEventos = useMemo(() => {
    const eventosComEmbarque = new Set(
      embarques.map((emb) => emb.evento_logistico_id).filter(Boolean),
    );

    return eventos
      .filter((evento) => eventoTemDataNoPeriodo(evento, periodoFiltro))
      .map((evento) => {
        const viewDate = getFluvialTimelineDate(evento, viewMode);
        return {
          ...evento,
          visualizacao_data: viewDate,
          visualizacao_data_formatada: formatDate(viewDate)
        };
      })
      .filter((evento) => {
        if (!evento.visualizacao_data) return false;
        const temVinculoEmbarque = eventosComEmbarque.has(evento.id);
        if (embarqueLinkFilter === 'com_vinculo' && !temVinculoEmbarque) return false;
        if (embarqueLinkFilter === 'sem_vinculo' && temVinculoEmbarque) return false;
        return true;
      })
      .reduce((acc, evento) => {
        const key = evento.visualizacao_data;
        if (!acc[key]) acc[key] = [];
        acc[key].push(evento);
        return acc;
      }, {});
  }, [eventos, viewMode, embarques, embarqueLinkFilter, periodoFiltro]);

  const totalViagensFiltradas = useMemo(
    () => Object.values(groupedEventos).reduce((total, items) => total + items.length, 0),
    [groupedEventos],
  );

  const totalViagensCarregadas = eventos.length;

  const timelineItems = useMemo(() => {
    return Object.entries(groupedEventos)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([dateKey, items]) => {
        const date = new Date(`${dateKey}T12:00:00`);
        return {
          key: dateKey,
          label: format(date, "EEEE, d 'de' MMM", { locale: ptBR }),
          dayNumber: format(date, 'd'),
          isToday: isSameDay(date, new Date(`${simulationDate}T00:00:00`)),
          eventos: items
        };
      });
  }, [groupedEventos, simulationDate]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && !isMobile) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [timelineItems, isMobile]);

  const handleScrollToToday = () => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const viewModeLabel = getFluvialViewModeLabel(viewMode, { short: true });


  const freteEventos = useMemo(() => {
    return eventos.filter((evento) => (evento.embarques_relacionados || []).length > 0);
  }, [eventos]);

  const freteEventosFiltrados = useMemo(() => {
    if (!freteSearchQuery.trim()) return freteEventos;
    const query = freteSearchQuery.toLowerCase();
    return freteEventos.filter((evento) => 
      (evento.embarcacao_nome || '').toLowerCase().includes(query)
    );
  }, [freteEventos, freteSearchQuery]);

  const freteResumo = useMemo(() => ({
    totalFretes: freteEventos.length,
  }), [freteEventos]);


  const currentEvento = selectedEvento || timelineItems[0]?.eventos?.[0] || freteEventos[0] || null;

  if (isMobile) {
    return <ItinerarioFluvialMobile />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6 overflow-x-hidden">
      <div className="max-w-4xl mx-auto w-full px-3 py-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
        <LogisticaSandboxHeader />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <RouteModeToggle value={routeType} onChange={setRouteType} />
          </div>
        </div>

        {routeType === 'Fluvial' ? (
           <>
             <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
               <div className="bg-transparent space-y-1 max-h-[calc(100vh-190px)] overflow-y-auto overflow-x-hidden pr-2 min-w-0">
                 {timelineCarregando ? (
                   <div className="space-y-4">
                     {[1, 2, 3, 4].map((item) => (
                       <div key={item} className="rounded-3xl bg-card border border-border/40 p-4 animate-pulse">
                         <div className="h-4 w-40 rounded bg-muted mb-3" />
                         <div className="h-16 rounded-2xl bg-muted" />
                       </div>
                     ))}
                     <p className="text-xs text-muted-foreground text-center">Carregando viagens…</p>
                   </div>
                 ) : timelineItems.length > 0 ? timelineItems.map((item) => (
                   <div key={item.key} ref={item.isToday ? todayRef : null}>
                     <TimelineDayGroup
                       label={item.label}
                       dayNumber={item.dayNumber}
                       eventos={item.eventos}
                       isToday={item.isToday}
                       onSelect={setSelectedEvento}
                       viewModeLabel={viewModeLabel}
                       selectedEventoId={currentEvento?.id}
                     />
                   </div>
                 )) : (
                   <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-6 text-sm text-muted-foreground text-center space-y-2">
                     <p>
                       Nenhuma viagem no período selecionado ({getFluvialPeriodLabel(periodoFiltro)}).
                       {periodoFiltro !== 'todas' ? ' Tente ampliar o filtro para ver mais datas.' : ''}
                     </p>
                     {totalViagensCarregadas > 0 ? (
                       <p className="text-xs">
                         Há {totalViagensCarregadas} viagem{totalViagensCarregadas !== 1 ? 's' : ''} na base, mas nenhuma cai neste recorte de datas.
                       </p>
                     ) : (
                       <p className="text-xs">
                         Nenhuma viagem foi carregada da base. Verifique se as transportadoras têm saída de referência e viagens geradas na aba Boats.
                       </p>
                     )}
                   </div>
                 )}
               </div>
               <TimelineSidebarCard evento={currentEvento} />
             </div>
             <FluvialActionFab 
               onScrollToToday={handleScrollToToday}
               viewMode={viewMode}
               onViewModeChange={setViewMode}
               periodoFiltro={periodoFiltro}
               onPeriodoFiltroChange={setPeriodoFiltro}
               embarqueLinkFilter={embarqueLinkFilter}
               onEmbarqueLinkFilterChange={setEmbarqueLinkFilter}
               totalViagens={totalViagensFiltradas}
               totalCarregadas={totalViagensCarregadas}
             />
           </>
        ) : routeType === 'Fretes' ? (
          <div className="space-y-5">
            {selectedEvento ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedEvento(null)}
                  className="text-sm text-muted-foreground font-medium hover:text-foreground/90 dark:hover:text-muted-foreground"
                >
                  ← Voltar
                </button>
                <FreteDetailPanel evento={selectedEvento} embarques={embarques.filter(e => e.evento_logistico_id === selectedEvento.id)} onBack={() => setSelectedEvento(null)} />
              </div>
            ) : (
              <>
                <FreteSearchBar value={freteSearchQuery} onChange={setFreteSearchQuery} />
                <FreteResumoCard eventos={freteEventosFiltrados} />
                <div className="space-y-3">
                  {freteEventosFiltrados.map((evento) => (
                    <FreteListCard key={evento.id} evento={evento} onSelect={setSelectedEvento} />
                  ))}
                  {freteEventosFiltrados.length === 0 && (
                    <div className="bg-card rounded-3xl p-6 shadow-sm text-sm text-muted-foreground">
                      {freteSearchQuery ? 'Nenhuma viagem encontrada.' : 'Nenhuma viagem com embarques vinculados.'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
           <BoatsTab />
         )}
      </div>
    </div>
  );
}