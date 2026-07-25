import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import {
  useLogisticaEmbarquesQuery,
  useLogisticaEventosSelectorQuery,
  useLogisticaLancamentosFretesQuery,
} from '@/hooks/useP38Entities';
import { addDays, format, isSameDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Anchor, Check, Sliders } from 'lucide-react';
import { buildFluvialEvents, formatDate, getFluvialViewDate, getLinkedIndicatorStyle } from '@/components/logistica-sandbox/fluvialDataUtils';
import ItinerarioMobileTopTabs from '@/components/logistica-sandbox/mobile/ItinerarioMobileTopTabs';
import FluvialSearchBar from '@/components/logistica-sandbox/mobile/FluvialSearchBar';
import FluvialExpandableFilters from '@/components/logistica-sandbox/FluvialExpandableFilters';
import TimelineDayGroup from '@/components/logistica-sandbox/TimelineDayGroup';
import { Button } from '@/components/ui/button';

export default function FluvialTripSelectorFullscreen({ open, onClose, onSelect }) {
  const [routeType, setRouteType] = useState('Fluvial');
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [simulationDate, setSimulationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState('saida_manaus');
  const [periodRange, setPeriodRange] = useState(() => {
    const today = new Date();
    return { from: subDays(today, 180), to: addDays(today, 180) };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyLinked, setOnlyLinked] = useState(false);
  const todayRef = useRef(null);

  const { data: eventosLogisticos = [], isPending: eventosPending } = useLogisticaEventosSelectorQuery({
    initialData: [],
    enabled: open,
  });
  const { data: embarques = [] } = useLogisticaEmbarquesQuery({ initialData: [], enabled: open });
  const { data: lancamentosFinanceiros = [] } = useLogisticaLancamentosFretesQuery({ initialData: [], enabled: open });

  const eventosBase = useMemo(
    () => buildFluvialEvents({ eventosLogisticos, embarques, lancamentosFinanceiros }),
    [eventosLogisticos, embarques, lancamentosFinanceiros],
  );

  const eventos = useMemo(() => {
    const simulationBaseDate = new Date(`${simulationDate}T12:00:00`);
    const hojeReal = new Date();
    const hojeRealBase = new Date(hojeReal.getFullYear(), hojeReal.getMonth(), hojeReal.getDate(), 12, 0, 0, 0);

    return eventosBase.map((item) => {
      const saidaManaus = item.data_saida_origem;
      const chegadaManaus = item.data_chegada_manaus;
      const inicioReal = chegadaManaus ? new Date(`${chegadaManaus}T00:00:00`) : null;
      const saidaReal = saidaManaus ? new Date(`${saidaManaus}T00:00:00`) : null;

      let ocupacaoPercentualDinamica = item.ocupacao_percentual || 0;

      if (!inicioReal || !saidaReal) {
        ocupacaoPercentualDinamica = 0;
      } else {
        const aindaNaoComecouNoReal = hojeRealBase < inicioReal;
        const aindaNaoComecouNoSimulador = simulationBaseDate < inicioReal;

        if (aindaNaoComecouNoReal || aindaNaoComecouNoSimulador) {
          ocupacaoPercentualDinamica = 0;
        } else if (simulationBaseDate >= saidaReal) {
          ocupacaoPercentualDinamica = 100;
        } else {
          const diasTotais = Math.max(1, Math.round((saidaReal - inicioReal) / (1000 * 60 * 60 * 24)));
          const diasCorridos = Math.max(0, Math.round((simulationBaseDate - inicioReal) / (1000 * 60 * 60 * 24)));
          ocupacaoPercentualDinamica = Math.max(0, Math.min(100, Math.round((diasCorridos / diasTotais) * 100)));
        }
      }

      return { ...item, ocupacao_percentual_dinamica: ocupacaoPercentualDinamica };
    });
  }, [eventosBase, simulationDate]);



  const groupedEventos = useMemo(() => {
    return eventos
      .map((evento) => {
        const viewDate = getFluvialViewDate(evento, viewMode);
        return {
          ...evento,
          visualizacao_data: viewDate,
          visualizacao_data_formatada: formatDate(viewDate),
        };
      })
      .filter((evento) => {
        if (!evento.visualizacao_data) return false;
        if (onlyLinked && !evento.tem_embarques_relacionados) return false;
        if (searchQuery && !evento.embarcacao_nome?.toLowerCase().includes(searchQuery.toLowerCase()) && !evento.codigo?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .reduce((acc, evento) => {
        const key = evento.visualizacao_data;
        if (!acc[key]) acc[key] = [];
        acc[key].push(evento);
        return acc;
      }, {});
  }, [eventos, viewMode, onlyLinked, searchQuery]);

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

  useEffect(() => {
    if (open && todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open, timelineItems]);

  if (!open) return null;

  const viewModeLabel = viewMode === 'chegada_manaus' ? 'Chegada Manaus' : viewMode === 'chegada_tabatinga' ? 'Chegada Tabatinga' : 'Saída Manaus';

  /* Portal em document.body + z alto: o modal de despacho (Radix z-50) ficava por cima quando o seletor era filho de #root */
  return createPortal(
    <div className="fixed inset-0 z-[10050] bg-background overflow-hidden">
      <div className="flex h-full flex-col w-full md:max-w-2xl md:mx-auto">
        <div className="sticky top-0 z-30 bg-muted/40/95 dark:bg-background/95 backdrop-blur-sm px-3 pt-3 pb-2 space-y-3">
          <div className="flex items-center gap-3">
            <Button type="button" size="icon" variant="ghost" onClick={onClose} className="h-10 w-10 rounded-2xl bg-card shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selecionar viagem</p>
              <p className="text-lg font-semibold text-foreground dark:text-foreground font-glacial truncate">Itinerário Fluvial</p>
            </div>
          </div>

          <ItinerarioMobileTopTabs value={routeType} onChange={setRouteType} />

          {routeType === 'Fluvial' && (
            <>
              <FluvialSearchBar value={searchQuery} onChange={setSearchQuery} onToggleFilters={() => setShowFilters((prev) => !prev)} filtersOpen={showFilters} />
              {showFilters && (
                <div className="rounded-2xl bg-card shadow-sm p-3 space-y-3 border border-border/40">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-2 uppercase tracking-wide">
                      Visualização
                    </label>
                    <select
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded bg-muted text-foreground dark:text-foreground border-0 focus:ring-1 focus:ring-ring dark:focus:ring-ring"
                    >
                      <option value="saida_manaus">Saída Manaus</option>
                      <option value="chegada_manaus">Chegada Manaus</option>
                      <option value="chegada_tabatinga">Chegada Tabatinga</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="onlyLinked"
                      checked={onlyLinked}
                      onChange={(e) => setOnlyLinked(e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="onlyLinked" className="text-xs text-foreground/90 cursor-pointer">
                      Apenas com embarques
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {routeType !== 'Fluvial' ? (
            <div className="rounded-3xl bg-card shadow-sm p-5 text-sm text-muted-foreground">Use a aba Fluvial para selecionar uma viagem.</div>
          ) : selectedEvento ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-3xl bg-card shadow-sm p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Anchor className="w-5 h-5 text-muted-foreground dark:text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground dark:text-foreground">{selectedEvento.embarcacao_nome}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedEvento.codigo || 'Viagem logística'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                  <div>Transportadora: {selectedEvento.transportadora_nome || '—'}</div>
                  <div>Saída: {selectedEvento.data_saida_origem || '—'}</div>
                  <div>ETA: {selectedEvento.previsao_chegada || selectedEvento.data_chegada_destino || '—'}</div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setSelectedEvento(null)} className="flex-1 h-11 rounded-2xl border-0 bg-muted shadow-sm">
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => onSelect?.(selectedEvento)}
                    className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground dark:bg-card dark:text-foreground shadow-sm"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Usar viagem
                  </Button>
                </div>
              </div>
            </div>
          ) : timelineItems.length > 0 ? (
            <div className="space-y-4 pt-2 overflow-x-hidden">
              {timelineItems.map((item) => (
                <div key={item.key} ref={item.isToday ? todayRef : null} className={item.isToday ? 'relative' : ''}>
                  {item.isToday ? <div className="absolute left-[2px] top-[4px] h-10 w-10 rounded-2xl ring-4 ring-lime-300/80 pointer-events-none" /> : null}
                  <TimelineDayGroup
                    label={item.label}
                    dayNumber={item.dayNumber}
                    eventos={item.eventos}
                    isToday={item.isToday}
                    onSelect={setSelectedEvento}
                    viewModeLabel={viewModeLabel}
                    selectedEventoId={selectedEvento?.id}
                  />
                </div>
              ))}
            </div>
          ) : eventosPending ? (
            <div className="rounded-3xl bg-card shadow-sm p-5 text-sm text-muted-foreground mt-2">Carregando viagens…</div>
          ) : (
            <div className="rounded-3xl bg-card shadow-sm p-5 text-sm text-muted-foreground mt-2">Nenhuma viagem encontrada neste período.</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}