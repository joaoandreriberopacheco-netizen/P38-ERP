import React, { useEffect, useState } from 'react';
import { Anchor, CalendarClock, Waves, FileText, CalendarDays, Package2, Phone, User, DollarSign, ChevronRight, Pencil, Trash2, Power, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BoatHistoryDetailsDialog from '@/components/logistica-sandbox/BoatHistoryDetailsDialog';
import { sincronizarViagensTransportadora } from '@/functions/sincronizarViagensTransportadora';
import TransportadoraProgressDialog from '@/components/logistica-sandbox/TransportadoraProgressDialog';

function StatusBadge({ status }) {
  const classes = status === 'ativa'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90';

  return <Badge className={`border-0 shadow-none ${classes}`}>{status === 'ativa' ? 'Ativa' : 'Inativa'}</Badge>;
}

function BoatTimelineItem({ item }) {
  return (
    <div className="relative pl-12 sm:pl-14 min-w-0">
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-muted" />
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-card shadow-sm text-foreground/90 text-xs font-semibold">
        {item.dayLabel}
      </div>
      <div className="pb-5">
        <div className="rounded-2xl bg-muted/50 p-4 shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground break-words">
                <CalendarDays className="w-3.5 h-3.5" />
                {item.label}
              </div>
              <p className="mt-2 text-base font-semibold text-foreground dark:text-foreground">{item.data}</p>
            </div>
            <Badge className="border-0 shadow-none bg-muted text-foreground/90 dark:bg-muted dark:text-foreground">{item.status}</Badge>
          </div>
          {item.hasLinked && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 shadow-sm text-xs text-muted-foreground">
              <Package2 className="w-3.5 h-3.5" />
              {item.linkedCount} embarque{item.linkedCount > 1 ? 's' : ''} vinculado{item.linkedCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ItinerarioEditorCard({ item }) {
  const styles = {
    passada: 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground',
    atual: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    futura: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground dark:text-foreground">{item.etapa}</p>
        <p className="text-xs text-muted-foreground mt-1">{item.data}</p>
      </div>
      <Badge className={`border-0 shadow-none ${styles[item.tipo] || styles.passada}`}>{item.tipo}</Badge>
    </div>
  );
}

function HistoricoStatusIcon({ status }) {
  const colorMap = {
    sem_conta: 'bg-transparent text-muted-foreground ring-border/30',
    vinculado: 'bg-[#d7de79]/12 text-[#d7de79] ring-[#d7de79]/55',
    atrasado: 'bg-[#f27979]/12 text-[#f27979] ring-[#f27979]/55',
    pago: 'bg-emerald-500/12 text-emerald-400 ring-emerald-400/55',
  };

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 ${colorMap[status] || 'bg-transparent text-muted-foreground ring-border/30'}`}>
      <DollarSign className="w-4 h-4" />
    </div>
  );
}

function HistoricoCard({ evento, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(evento)} className="w-full rounded-2xl bg-muted/50 p-4 shadow-sm text-left overflow-hidden">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground dark:text-foreground break-words">{evento.titulo}</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">{evento.codigo} · {evento.data}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="border-0 shadow-none bg-card text-foreground/90 dark:bg-background dark:text-foreground">{evento.cargas} carga(s)</Badge>
            <Badge className="border-0 shadow-none bg-card text-foreground/90 dark:bg-background dark:text-foreground max-w-full break-all">{evento.freteValor}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <HistoricoStatusIcon status={evento.financeiroStatus} />
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}

export default function BoatDetailsDialog({ open, onOpenChange, transportadora, viagensCarregando = false, onSave, onDelete, onInactivate }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedEvento, setSelectedEvento] = React.useState(null);
  const [draft, setDraft] = React.useState(transportadora);
  const [showProgress, setShowProgress] = React.useState(false);
  const [progressStep, setProgressStep] = React.useState(0);
  const [progressSuccess, setProgressSuccess] = React.useState(false);
  const [stepStatuses, setStepStatuses] = React.useState(['waiting', 'waiting', 'waiting', 'waiting']);

  const progressSteps = ['Atualizando dados', 'Criando/atualizando viagens', 'Atualizando timeline', 'Sucesso'];

  React.useEffect(() => {
    setDraft(transportadora);
    setIsEditing(false);
    setSelectedEvento(null);
    setShowProgress(false);
    setProgressStep(0);
    setProgressSuccess(false);
    setStepStatuses(['waiting', 'waiting', 'waiting', 'waiting']);
  }, [transportadora]);

  if (!transportadora || !draft) return null;

  const timelineItems = draft.timeline || [];
  const itinerarioItems = draft.itinerario_real || [];
  const eventoItems = draft.eventos || [];
  const hasRecords = (draft.timeline || []).length > 0;
  const mostrarCarregandoViagens = viagensCarregando && !hasRecords;

  const handleSave = async () => {
    setShowProgress(true);
    setProgressSuccess(false);
    setProgressStep(0);
    setStepStatuses(['active', 'waiting', 'waiting', 'waiting']);

    setProgressStep(1);
    setStepStatuses(['done', 'active', 'waiting', 'waiting']);
    const precisaRecalcularViagens = (draft.saida_referencia || '') !== (transportadora.saida_referencia || '');
    await sincronizarViagensTransportadora({
      transportadoraId: draft.id,
      nome: draft.nome,
      saidaReferencia: draft.saida_referencia,
      contato: draft.contato,
      telefone: draft.telefone,
      email: draft.email,
      observacoes: draft.observacoes,
      ativo: draft.status !== 'inativa',
      recalcularViagens: precisaRecalcularViagens,
    });

    setProgressStep(2);
    setStepStatuses(['done', 'done', 'active', 'waiting']);
    await onSave?.(draft);

    setProgressStep(3);
    setStepStatuses(['done', 'done', 'done', 'active']);
    setProgressSuccess(true);
    setIsEditing(false);

    setTimeout(() => {
      setShowProgress(false);
    }, 900);
  };

  const handleDeleteOrInactivate = () => {
    if (hasRecords) {
      const updated = { ...draft, status: 'inativa' };
      setDraft(updated);
      onInactivate?.(transportadora.id);
      return;
    }
    onDelete?.(transportadora.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl h-[90vh] max-h-[90vh] p-0 overflow-hidden rounded-[28px] border-0 bg-card shadow-2xl sm:rounded-[28px]">
          <div className="flex h-full min-h-0 flex-col relative">
            <DialogHeader className="px-4 sm:px-5 pt-5 pb-3 border-b border-border/40 text-left overflow-hidden">
              <div className="flex items-start justify-between gap-3 pr-8 min-w-0">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shadow-sm flex-shrink-0">
                    <Anchor className="w-5 h-5 text-foreground/90" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-semibold text-foreground dark:text-foreground font-glacial truncate">{draft.nome}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">Próximo ETA: {draft.proximo_eta}</p>
                  </div>
                </div>
                <StatusBadge status={draft.status} />
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-5 py-4">
              <Tabs defaultValue="cadastro" className="space-y-4 min-w-0">
                <TabsList className="w-full h-auto rounded-2xl bg-muted p-1 grid grid-cols-3 gap-1 min-w-0">
                  <TabsTrigger value="cadastro" className="rounded-2xl text-[11px] sm:text-xs px-2 min-w-0">Cadastro</TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-2xl text-[11px] sm:text-xs px-2 min-w-0">Timeline</TabsTrigger>
                  <TabsTrigger value="historico" className="rounded-2xl text-[11px] sm:text-xs px-2 min-w-0">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-0 min-w-0">
                  {mostrarCarregandoViagens ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="rounded-2xl bg-muted/50 p-4 shadow-sm animate-pulse">
                          <div className="h-3 w-32 rounded bg-muted mb-3" />
                          <div className="h-5 w-24 rounded bg-muted" />
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground text-center pt-2">Carregando viagens…</p>
                    </div>
                  ) : (
                    <div className="space-y-1 pr-1 min-w-0">
                      {timelineItems.map((item) => (
                        <BoatTimelineItem key={`${item.label}-${item.data}`} item={item} />
                      ))}
                      {timelineItems.length === 0 && (
                        <div className="rounded-2xl bg-muted/50 p-6 shadow-sm text-center">
                          <p className="text-sm text-muted-foreground">Nenhuma viagem planejada para esta transportadora.</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="cadastro" className="mt-0 space-y-4 min-w-0">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" onClick={() => setIsEditing((prev) => !prev)} variant="outline" className="rounded-2xl border-0 bg-muted shadow-sm">
                      <Pencil className="w-4 h-4 mr-2" />
                      {isEditing ? 'Cancelar' : 'Editar'}
                    </Button>
                    <Button type="button" onClick={handleDeleteOrInactivate} variant="outline" className="rounded-2xl border-0 bg-muted shadow-sm text-red-500 dark:text-red-400">
                      {hasRecords ? <Power className="w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      {hasRecords ? 'Inativar' : 'Excluir'}
                    </Button>
                    {isEditing && (
                      <Button type="button" onClick={handleSave} className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary dark:bg-muted dark:text-foreground dark:hover:bg-muted">
                        <Save className="w-4 h-4 mr-2" />Salvar
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><FileText className="w-4 h-4" /> Transportadora</div>
                      {isEditing ? <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} className="h-10 rounded-2xl border-0 bg-card shadow-none" /> : <p className="text-sm font-medium text-foreground dark:text-foreground">{draft.nome}</p>}
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Waves className="w-4 h-4" /> Status</div>
                      <p className="text-sm font-medium text-foreground dark:text-foreground">{draft.status === 'ativa' ? 'Ativa' : 'Inativa'}</p>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><User className="w-4 h-4" /> Contato</div>
                      {isEditing ? <Input value={draft.contato} onChange={(e) => setDraft({ ...draft, contato: e.target.value })} className="h-10 rounded-2xl border-0 bg-card shadow-none" /> : <p className="text-sm font-medium text-foreground dark:text-foreground">{draft.contato}</p>}
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Phone className="w-4 h-4" /> Telefone</div>
                      {isEditing ? <Input value={draft.telefone} onChange={(e) => setDraft({ ...draft, telefone: e.target.value })} className="h-10 rounded-2xl border-0 bg-card shadow-none" /> : <p className="text-sm font-medium text-foreground dark:text-foreground">{draft.telefone}</p>}
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm md:col-span-2 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="w-4 h-4" /> Saída de referência</div>
                      <p className="text-xs text-muted-foreground">Esta é a data-base usada para normalizar a primeira viagem e gerar as demais apenas até 3 meses à frente, sempre com chegada em Manaus, saída de Manaus e ETA em Tabatinga.</p>
                      {isEditing ? <Input type="date" value={draft.saida_referencia || ''} onChange={(e) => setDraft({ ...draft, saida_referencia: e.target.value, recorrencia: e.target.value })} className="h-10 rounded-2xl border-0 bg-card shadow-none" /> : <p className="text-sm font-medium text-foreground dark:text-foreground">{draft.saida_referencia || 'Não informada'}</p>}
                    </div>
                  </div>


                </TabsContent>

                <TabsContent value="historico" className="mt-0 min-w-0">
                  {mostrarCarregandoViagens ? (
                    <div className="space-y-3">
                      {[1, 2].map((item) => (
                        <div key={item} className="rounded-2xl bg-muted/50 p-4 shadow-sm animate-pulse">
                          <div className="h-4 w-48 rounded bg-muted mb-2" />
                          <div className="h-3 w-32 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  ) : eventoItems.length > 0 ? (
                    <div className="space-y-3">
                      {eventoItems.map((evento) => (
                        <HistoricoCard key={evento.id} evento={evento} onOpen={setSelectedEvento} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-muted/50 p-6 shadow-sm text-center">
                      <p className="text-sm font-medium text-foreground dark:text-foreground">Nenhuma viagem com carga vinculada</p>
                      <p className="mt-1 text-xs text-muted-foreground">O histórico mostra apenas viagens que realmente trouxeram embarques.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BoatHistoryDetailsDialog
        open={!!selectedEvento}
        onOpenChange={(open) => !open && setSelectedEvento(null)}
        evento={selectedEvento}
      />
      <TransportadoraProgressDialog open={showProgress} currentStep={progressStep} steps={progressSteps} success={progressSuccess} stepStatuses={stepStatuses} />
    </>
  );
}