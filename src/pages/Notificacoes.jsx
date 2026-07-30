import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  FileWarning,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38TypeTone,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import AgendaItemDialog from '@/components/agenda/AgendaItemDialog';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/notify';
import {
  completeAgendaFeedItem,
  countPendingFeed,
  deleteAgendaItem,
  fetchAgendaFeed,
  filterAgendaFeed,
  formatAgendaDate,
  saveAgendaItem,
} from '@/lib/agenda/agendaService';
import {
  limparParamsNovoCompromissoAgenda,
  parseNovoCompromissoAgendaParams,
} from '@/lib/agenda/agendaShortcutBridge';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'compromissos', label: 'Meus' },
  { id: 'contas', label: 'Contas' },
  { id: 'tarefas', label: 'Tarefas' },
];

export default function NotificacoesPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedFeedId, setSelectedFeedId] = useState(null);

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me().catch(() => null);
      setUser(currentUser);
      const feed = await fetchAgendaFeed(currentUser);
      setItems(feed);
    } catch (error) {
      console.error(error);
      notify.error('Erro ao carregar agenda', error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    const draft = parseNovoCompromissoAgendaParams();
    if (!draft) return;

    setEditingItem(Object.keys(draft).length ? draft : null);
    setDialogOpen(true);
    limparParamsNovoCompromissoAgenda();
  }, []);

  const filteredItems = useMemo(() => filterAgendaFeed(items, filter), [items, filter]);
  const pendingCount = useMemo(() => countPendingFeed(items), [items]);

  const handleSave = async (payload, existingId) => {
    await saveAgendaItem(payload, existingId);
    notify.success(existingId ? 'Item atualizado' : 'Adicionado à agenda');
    await loadAgenda();
  };

  const handleComplete = async (feedItem) => {
    try {
      await completeAgendaFeedItem(feedItem);
      notify.success('Marcado como concluído');
      setSelectedFeedId(null);
      await loadAgenda();
    } catch (error) {
      console.error(error);
      notify.error('Não foi possível concluir');
    }
  };

  const handleDelete = async (feedItem) => {
    if (feedItem.source !== 'agenda') return;
    try {
      await deleteAgendaItem(feedItem.sourceId);
      notify.success('Item removido');
      setSelectedFeedId(null);
      await loadAgenda();
    } catch (error) {
      console.error(error);
      notify.error('Não foi possível remover');
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEdit = (feedItem) => {
    if (feedItem.source !== 'agenda') return;
    setEditingItem(feedItem.raw);
    setDialogOpen(true);
  };

  const selectedItem = filteredItems.find((item) => item.id === selectedFeedId);

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-6">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-glacial flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-muted-foreground" />
              Agenda
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'Tudo em dia'}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={loadAgenda}
            disabled={loading}
            aria-label="Atualizar agenda"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === chip.id
                  ? 'bg-[#4a5240]/12 text-foreground dark:bg-[#a4ce33]/15'
                  : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border/40 bg-card shadow-sm">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nada na agenda para este filtro</p>
            <Button type="button" variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar compromisso
            </Button>
          </div>
        ) : (
          <P38MobileLineList>
            {filteredItems.map((item, index) => {
              const tone = p38TypeTone(item.type);
              const isSelected = selectedFeedId === item.id;
              const dueLabel = formatAgendaDate(item.dueDate, item.hora);
              const timeLabel = item.hora
                ? item.hora
                : item.dueDate
                  ? format(new Date(`${String(item.dueDate).slice(0, 10)}T12:00:00`), 'dd MMM', { locale: ptBR })
                  : format(item.timestamp, 'HH:mm');

              return (
                <div key={item.id}>
                  <P38MobileLine
                    striped={index % 2 === 1}
                    accent={!item.completed && !item.read ? p38AccentKeyFromTone(tone) : 'muted'}
                    title={item.title}
                    subtitle={item.message}
                    onClick={() => setSelectedFeedId(isSelected ? null : item.id)}
                    meta={(
                      <>
                        <P38StatusLabel tone={tone}>{item.category}</P38StatusLabel>
                        {item.recurrence ? (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            {item.recurrence}
                          </span>
                        ) : null}
                      </>
                    )}
                    valueSub={timeLabel}
                    trailing={item.source === 'conta' ? <FileWarning className="w-4 h-4 text-amber-500" /> : null}
                  />

                  {isSelected && (
                    <div className="px-3 py-2 bg-muted/30 border-b border-border/30 flex flex-wrap gap-2">
                      {dueLabel ? (
                        <span className="text-xs text-muted-foreground w-full">{dueLabel}</span>
                      ) : null}

                      {item.source === 'conta' && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={createPageUrl('FluxoCaixa')}>Ver no financeiro</Link>
                        </Button>
                      )}

                      {item.actionable && !item.completed && (
                        <Button size="sm" onClick={() => handleComplete(item)}>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Concluir
                        </Button>
                      )}

                      {item.source === 'agenda' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item)}>
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </P38MobileLineList>
        )}
      </div>

      <div className="fixed bottom-[84px] right-4 z-40 desktop-layout:hidden">
        <Button
          type="button"
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={openCreate}
          aria-label="Novo compromisso"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <div className="hidden desktop-layout:block fixed bottom-6 right-6 z-40">
        <Button type="button" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo compromisso
        </Button>
      </div>

      <AgendaItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        user={user}
        onSaved={handleSave}
      />

      {selectedItem && selectedItem.source === 'tarefa' && (
        <div className="sr-only" aria-live="polite">
          Tarefa do sistema: {selectedItem.title}
        </div>
      )}
    </div>
  );
}
