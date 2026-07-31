import React, { useMemo, useState } from 'react';
import { addDays, subDays, format } from 'date-fns';
import { Plus, Route, Ship, StickyNote, User, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { findOrCreateTransportadora, buildTransportadoraPersistPayload } from '@/lib/resolveTransportadora';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx';

const defaultCycle = { nome: 'Ciclo fluvial 21 dias', duracao: 21, diasAteETA: 7, diasAteRetornoManaus: 14 };

export default function CreateEventoLogisticoDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    embarcacao_nome: '',
    data_saida_origem: format(new Date(), 'yyyy-MM-dd'),
    usar_ciclo_padrao: true,
    ciclo_personalizado_nome: '',
    ciclo_personalizado_duracao: '',
    contato_viajante: '',
    telefone_viajante: '',
    observacoes: ''
  });
  const [saving, setSaving] = useState(false);

  const cicloAtivo = useMemo(() => {
    if (form.usar_ciclo_padrao) return defaultCycle;
    return {
      nome: form.ciclo_personalizado_nome || 'Ciclo personalizado',
      duracao: Number(form.ciclo_personalizado_duracao || 0)
    };
  }, [form]);

  const cicloProjetado = useMemo(() => {
    if (!form.data_saida_origem) {
      return { chegadaManaus: '', saidaManaus: '', etaTabatinga: '' };
    }

    const saidaManaus = new Date(`${form.data_saida_origem}T00:00:00`);
    const deslocamento = form.usar_ciclo_padrao ? 7 : Number(form.ciclo_personalizado_duracao || 0);
    if (!deslocamento) {
      return { chegadaManaus: '', saidaManaus: format(saidaManaus, 'dd/MM/yyyy'), etaTabatinga: '' };
    }

    return {
      chegadaManaus: format(subDays(saidaManaus, deslocamento), 'dd/MM/yyyy'),
      saidaManaus: format(saidaManaus, 'dd/MM/yyyy'),
      etaTabatinga: format(addDays(saidaManaus, deslocamento), 'dd/MM/yyyy')
    };
  }, [form.data_saida_origem, form.usar_ciclo_padrao, form.ciclo_personalizado_duracao]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
    const saida = new Date(`${form.data_saida_origem}T00:00:00`);
    const diasAteETA = form.usar_ciclo_padrao ? defaultCycle.diasAteETA : Number(form.ciclo_personalizado_duracao || 0);
    const diasAteRetornoManaus = form.usar_ciclo_padrao ? defaultCycle.diasAteRetornoManaus : Number(form.ciclo_personalizado_duracao || 0) * 2;
    const duracao = form.usar_ciclo_padrao ? defaultCycle.duracao : diasAteRetornoManaus;
    const chegadaManaus = subDays(saida, diasAteETA);
    const chegada = addDays(saida, diasAteETA);

    const transportadora = await findOrCreateTransportadora(base44, form.embarcacao_nome);
    const transportadoraPayload = buildTransportadoraPersistPayload(
      {
        transportadora_id: transportadora?.id,
        transportadora_nome: transportadora?.nome || form.embarcacao_nome,
        embarcacao_nome: form.embarcacao_nome,
      },
      transportadora ? [transportadora] : [],
    );

    const payload = {
      embarcacao_nome: transportadoraPayload.embarcacao_nome,
      nome: `${transportadoraPayload.embarcacao_nome} · ETA ${format(chegada, 'dd/MM/yyyy')}`,
      codigo: `ETA-${format(chegada, 'ddMMyy')}`,
      transportadora_id: transportadoraPayload.transportadora_id,
      transportadora_nome: transportadoraPayload.transportadora_nome,
      embarcacao_template_id: transportadoraPayload.embarcacao_template_id,
      rota_nome: 'Manaus → Tabatinga',
      status_operacao: 'Atracado na Origem',
      data_chegada_manaus: format(chegadaManaus, 'yyyy-MM-dd'),
      data_saida_origem: form.data_saida_origem,
      data_referencia: form.data_saida_origem,
      data_chegada_destino: format(chegada, 'yyyy-MM-dd'),
      previsao_chegada: format(chegada, 'yyyy-MM-dd'),
      data_retorno_origem: format(addDays(saida, diasAteRetornoManaus), 'yyyy-MM-dd'),
      previsao_retorno: format(addDays(saida, diasAteRetornoManaus), 'yyyy-MM-dd'),
      observacoes: [
        form.observacoes,
        form.contato_viajante ? `Contato: ${form.contato_viajante}` : '',
        form.telefone_viajante ? `Telefone: ${form.telefone_viajante}` : '',
        `Lógica: chegada em Manaus ${diasAteETA} dias antes da saída • ETA em Tabatinga ${diasAteETA} dias após a saída • retorno a Manaus em ${diasAteRetornoManaus} dias • ciclo total ${duracao} dias`
      ].filter(Boolean).join(' • '),
      ocupacao_percentual: 0,
      dias_atraso: 0,
      chave_relacional_futura: 'evento_logistico_id'
    };

    await base44.entities.EventoLogisticoSandbox.create(payload);
    toast.success('Transportadora e recorrência salvas com sucesso', {
      description: 'O ciclo considera chegada em Manaus 7 dias antes da saída, depois saída de Manaus e ETA em Tabatinga 7 dias depois.'
    });
    } catch (err) {
      toast.error('Não foi possível salvar a viagem', {
        description: err?.message || 'Erro desconhecido',
      });
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    setForm({
      embarcacao_nome: '',
      data_saida_origem: format(new Date(), 'yyyy-MM-dd'),
      usar_ciclo_padrao: true,
      ciclo_personalizado_nome: '',
      ciclo_personalizado_duracao: '',
      contato_viajante: '',
      telefone_viajante: '',
      observacoes: ''
    });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl border-0 shadow-sm bg-primary hover:bg-primary/90 text-foreground dark:bg-muted dark:text-foreground dark:hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-xl max-h-[calc(100vh-1.5rem)] rounded-3xl border-0 shadow-xl p-0 overflow-hidden flex flex-col">
        <div className="p-4 md:p-6 bg-card overflow-y-auto overscroll-contain max-h-[calc(100vh-1.5rem)]">
          <DialogHeader>
            <DialogTitle className="font-glacial text-2xl text-foreground dark:text-foreground">Nova transportadora recorrente</DialogTitle>
            <DialogDescription>Você está cadastrando a transportadora e o ciclo da recorrência. A partir dele, cada evento logístico gerado terá chegada em Manaus, saída de Manaus 7 dias depois e chegada em Tabatinga 7 dias depois.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Ship className="w-4 h-4" /> Embarcação</div>
                <Input value={form.embarcacao_nome} onChange={(e) => handleChange('embarcacao_nome', e.target.value)} placeholder="Nome do barco" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" required />
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Route className="w-4 h-4" /> Saída de Manaus</div>
                <Input type="date" value={form.data_saida_origem} onChange={(e) => handleChange('data_saida_origem', e.target.value)} className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" required />
              </div>
            </div>

            <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground dark:text-foreground">Usar ciclo padrão da recorrência</p>
                  <p className="text-xs text-muted-foreground">O ciclo considera chegada em Manaus, saída de Manaus 7 dias depois e chegada em Tabatinga 7 dias depois.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('usar_ciclo_padrao', !form.usar_ciclo_padrao)}
                  className={`w-12 h-7 rounded-full shadow-sm transition ${form.usar_ciclo_padrao ? 'bg-emerald-500' : 'bg-muted dark:bg-muted'}`}
                >
                  <span className={`block w-5 h-5 rounded-full bg-card transition ${form.usar_ciclo_padrao ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {!form.usar_ciclo_padrao && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={form.ciclo_personalizado_nome} onChange={(e) => handleChange('ciclo_personalizado_nome', e.target.value)} placeholder="Nome da lógica" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" />
                  <Input type="number" value={form.ciclo_personalizado_duracao} onChange={(e) => handleChange('ciclo_personalizado_duracao', e.target.value)} placeholder="Duração em dias" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" min="1" />
                </div>
              )}

              <div className="rounded-2xl bg-card dark:bg-muted p-4 shadow-sm space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ciclo projetado</p>
                <p className="text-sm font-semibold text-foreground dark:text-foreground">Chegada em Manaus: {cicloProjetado.chegadaManaus || '-'}</p>
                <p className="text-sm font-semibold text-foreground dark:text-foreground">Saída de Manaus: {cicloProjetado.saidaManaus || '-'}</p>
                <p className="text-sm font-semibold text-foreground dark:text-foreground">ETA Tabatinga: {cicloProjetado.etaTabatinga || '-'}</p>
                <p className="text-xs text-muted-foreground">Se a saída for em 10/03, o ciclo projetado entende chegada em Manaus em 03/03 e ETA em Tabatinga em 17/03.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="w-4 h-4" /> Contato do viajante</div>
                <Input value={form.contato_viajante} onChange={(e) => handleChange('contato_viajante', e.target.value)} placeholder="Nome do contato" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" />
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-4 h-4" /> Telefone</div>
                <Input value={form.telefone_viajante} onChange={(e) => handleChange('telefone_viajante', e.target.value)} placeholder="WhatsApp / telefone" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl" />
              </div>
            </div>

            <div className="rounded-2xl bg-muted/50 p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><StickyNote className="w-4 h-4" /> Observações</div>
              <Textarea value={form.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} placeholder="Detalhes importantes da transportadora e do ciclo recorrente" className="border-0 bg-card dark:bg-muted shadow-sm rounded-2xl min-h-[100px]" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-2xl border-0 shadow-sm bg-muted hover:bg-muted text-foreground/90 dark:bg-muted dark:hover:bg-primary/90 dark:text-foreground">Cancelar</Button>
              <Button type="submit" disabled={saving} className="rounded-2xl border-0 shadow-sm bg-primary hover:bg-primary/90 text-foreground dark:bg-muted dark:text-foreground dark:hover:bg-primary/90">
                {saving ? 'Salvando...' : 'Salvar transportadora e ciclo'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}