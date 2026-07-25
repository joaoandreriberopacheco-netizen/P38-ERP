import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Truck, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';

import AssistenteRecepcao from './AssistenteRecepcao';

export default function GestaoEventosLogisticos() {
  const [eventos, setEventos] = useState([]);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    titulo: '',
    data_prevista: '',
    pedidos_selecionados: []
  });

  const [eventoExecucao, setEventoExecucao] = useState(null);
  const [showAssistente, setShowAssistente] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Buscar eventos existentes
      const eventosData = await base44.entities.EventosLogisticos.list('-data_prevista');
      setEventos(eventosData);
      
      // Buscar POs "Enviados" que ainda não têm evento
      const todosPOs = await base44.entities.PedidoCompra.list();
      const posEnviados = todosPOs.filter(po => po.status === 'Enviado' && !po.evento_logistico_id);
      setPedidosDisponiveis(posEnviados);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleAbrirNovoEvento = () => {
    setFormData({
      titulo: '',
      data_prevista: '',
      pedidos_selecionados: []
    });
    setIsDialogOpen(true);
  };

  const handleTogglePedido = (pedidoId) => {
    setFormData(prev => ({
      ...prev,
      pedidos_selecionados: prev.pedidos_selecionados.includes(pedidoId)
        ? prev.pedidos_selecionados.filter(id => id !== pedidoId)
        : [...prev.pedidos_selecionados, pedidoId]
    }));
  };

  const handleCriarEvento = async () => {
    if (!formData.titulo || !formData.data_prevista || formData.pedidos_selecionados.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e selecione ao menos um pedido.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Gerar número sequencial
      const todosEventos = await base44.entities.EventosLogisticos.list();
      const nextNumber = (todosEventos.length > 0 ? Math.max(...todosEventos.map(e => parseInt(e.numero?.split('-')[1] || 0))) : 0) + 1;
      const numeroEvento = `EVT-${String(nextNumber).padStart(5, '0')}`;
      
      // Criar evento
      const evento = await base44.entities.EventosLogisticos.create({
        numero: numeroEvento,
        tipo: 'Recepção',
        titulo: formData.titulo,
        data_prevista: new Date(formData.data_prevista).toISOString(),
        pedidos_compra_ids: formData.pedidos_selecionados,
        status: 'Programado',
        responsavel_id: currentUser.id,
        responsavel_nome: currentUser.full_name
      });
      
      // Atualizar os POs para associá-los ao evento e mudar status
      for (const poId of formData.pedidos_selecionados) {
        await base44.entities.PedidoCompra.update(poId, {
          evento_logistico_id: evento.id,
          status: 'Aguardando Recepção'
        });
        
        // Buscar a tarefa de "Aguardando Manifesto/NF" e marcar como concluída
        const todasTarefas = await base44.entities.Tarefa.list();
        const tarefaRelacionada = todasTarefas.find(t => 
          t.referencia_id === poId && 
          t.tipo === 'Aguardando Manifesto/NF' &&
          t.status !== 'Concluída'
        );
        
        if (tarefaRelacionada) {
          await base44.entities.Tarefa.update(tarefaRelacionada.id, {
            status: 'Concluída',
            data_conclusao: new Date().toISOString()
          });
        }
      }
      
      toast({
        title: "✓ Evento criado!",
        description: `${numeroEvento} criado e ${formData.pedidos_selecionados.length} PO(s) associado(s).`,
        className: "bg-emerald-100 text-emerald-800"
      });
      
      setIsDialogOpen(false);
      loadData();
      
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleIniciarExecucao = (evento) => {
    setEventoExecucao(evento);
    setShowAssistente(true);
  };

  const handleConcluirExecucao = () => {
    setShowAssistente(false);
    setEventoExecucao(null);
    loadData();
  };

  const getStatusBadge = (status) => {
    const variants = {
      "Programado": "bg-blue-100 text-blue-800",
      "Em Execução": "bg-yellow-100 text-yellow-800",
      "Concluído": "bg-green-100 text-green-800",
      "Cancelado": "bg-red-100 text-red-800"
    };
    return variants[status] || "bg-muted text-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Eventos Logísticos</h2>
          <p className="text-muted-foreground">Programe recepções e consolide múltiplos pedidos.</p>
        </div>
        <Button onClick={handleAbrirNovoEvento} className="bg-emerald-600 hover:bg-emerald-700">
          <Calendar className="w-4 h-4 mr-2" />
          Criar Evento de Recepção
        </Button>
      </div>

      {pedidosDisponiveis.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground dark:text-foreground text-sm">
                {pedidosDisponiveis.length} pedido(s) aguardando recepção
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Necessário agendar evento logístico para recebimento.
              </p>
            </div>
            <Button size="sm" onClick={handleAbrirNovoEvento} className="bg-primary text-primary-foreground hover:bg-primary h-8 text-xs">
              Agendar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Eventos - Protocolo Glacial: Cards Limpos */}
      <div className="grid gap-4">
        {eventos.map(evento => (
          <div key={evento.id} className="bg-card rounded-xl border border-border/40 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                 </div>
                 <div>
                    <h3 className="font-medium text-foreground dark:text-foreground">{evento.titulo}</h3>
                    <p className="text-xs text-muted-foreground">{evento.numero}</p>
                 </div>
              </div>
              <Badge className={`${getStatusBadge(evento.status)} border-0 font-normal`}>{evento.status}</Badge>
            </div>

            <div className="flex flex-wrap gap-4 py-3 border-t border-border/30 dark:border-border/40">
               <div>
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Previsão</p>
                  <div className="flex items-center gap-1.5 text-sm text-foreground/90">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {format(new Date(evento.data_prevista), 'dd/MM/yyyy HH:mm')}
                  </div>
               </div>
               <div>
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Consolidação</p>
                  <div className="flex items-center gap-1.5 text-sm text-foreground/90">
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                    {evento.pedidos_compra_ids?.length || 0} pedidos
                  </div>
               </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
                {evento.veredito_conformidade ? (
                   <div className="flex items-center gap-2 bg-muted/40 dark:bg-muted/30 px-3 py-1.5 rounded-lg">
                      {evento.veredito_conformidade === 'Tudo em Ordem' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-xs font-medium text-foreground/90">
                        {evento.veredito_conformidade}
                      </span>
                   </div>
                ) : (
                   <span className="text-xs text-muted-foreground italic">Aguardando execução</span>
                )}

                {evento.status === 'Programado' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-border/40 text-muted-foreground hover:bg-muted/40"
                    onClick={() => handleIniciarExecucao(evento)}
                  >
                    Iniciar Recepção
                  </Button>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de Criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="!max-w-[90vw] !w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Evento de Recepção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Título do Evento *</Label>
              <Input
                placeholder="Ex: Previsão de Chegada 00X"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              />
            </div>

            <div>
              <Label>Data e Hora Prevista *</Label>
              <Input
                type="datetime-local"
                value={formData.data_prevista}
                onChange={(e) => setFormData(prev => ({ ...prev, data_prevista: e.target.value }))}
              />
            </div>

            <div>
              <Label className="mb-3 block">Pedidos a Consolidar *</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {pedidosDisponiveis.map(po => (
                  <div key={po.id} className="flex items-center gap-3 p-2 hover:bg-muted/40 rounded">
                    <Checkbox
                      checked={formData.pedidos_selecionados.includes(po.id)}
                      onCheckedChange={() => handleTogglePedido(po.id)}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{po.numero} - {po.fornecedor_nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {po.itens?.length || 0} itens - R$ {po.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarEvento} className="bg-emerald-600 hover:bg-emerald-700">
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assistente de Recepção */}
      {showAssistente && eventoExecucao && (
        <AssistenteRecepcao
          evento={eventoExecucao}
          onConcluir={handleConcluirExecucao}
          onCancelar={() => setShowAssistente(false)}
        />
      )}
    </div>
  );
}