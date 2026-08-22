import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Truck, Package, Weight, Calendar, Trash2, Eye, AlertTriangle, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import GestaoCodigosConferencia from '@/components/logistica/GestaoCodigosConferencia';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
  p38StatusTone,
} from '@/components/ui/p38-mobile-line';

export default function HubLogistico() {
  const navigate = useNavigate();
  const [manifestos, setManifestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [manifestoSelecionado, setManifestoSelecionado] = useState(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [pedidoParaRemover, setPedidoParaRemover] = useState(null);
  const [showConfirmRemocao, setShowConfirmRemocao] = useState(false);

  useEffect(() => {
    loadManifestos();
  }, []);

  const loadManifestos = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Supermanifesto.list('-eta');
      setManifestos(data);
    } catch (error) {
      console.error('Erro ao carregar manifestos:', error);
      toast.error('Erro ao carregar manifestos');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalhes = (manifesto) => {
    setManifestoSelecionado(manifesto);
    setShowDetalhes(true);
  };

  const handleRemoverPedido = (manifesto, pedido) => {
    setManifestoSelecionado(manifesto);
    setPedidoParaRemover(pedido);
    setShowConfirmRemocao(true);
  };

  const confirmarRemocao = async () => {
    try {
      const pedidosAtualizados = manifestoSelecionado.pedidos_vinculados.filter(
        p => p.pedido_id !== pedidoParaRemover.pedido_id
      );

      // Se era o único pedido, perguntar se quer excluir o manifesto
      if (pedidosAtualizados.length === 0) {
        if (!confirm('Este era o único pedido do manifesto. Deseja excluir o Manifesto vazio?')) {
          setShowConfirmRemocao(false);
          return;
        }
        
        await base44.entities.Supermanifesto.delete(manifestoSelecionado.id);
        toast.success('Manifesto excluído com sucesso');
      } else {
        // Recalcular peso e observações
        const pesoTotal = pedidosAtualizados.reduce((sum, p) => sum + (p.peso_informado_kg || 0), 0);
        const observacoesConsolidadas = pedidosAtualizados
          .map(p => `${p.pedido_numero}: ${p.descritivo_volumes}`)
          .filter(o => o.trim() !== ':')
          .join(' | ');

        await base44.entities.Supermanifesto.update(manifestoSelecionado.id, {
          pedidos_vinculados: pedidosAtualizados,
          peso_total_bruto_kg: pesoTotal,
          observacoes_consolidadas: observacoesConsolidadas
        });

        toast.success('Pedido removido do manifesto');
      }

      // Resetar status do pedido
      await base44.entities.PedidoCompra.update(pedidoParaRemover.pedido_id, {
        status: 'Enviado',
        supermanifesto_id: null
      });

      setShowConfirmRemocao(false);
      setShowDetalhes(false);
      loadManifestos();

    } catch (error) {
      console.error('Erro ao remover pedido:', error);
      toast.error('Erro ao remover pedido do manifesto');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Pendente': 'bg-yellow-100 text-yellow-800',
      'Em Trânsito': 'bg-blue-100 text-blue-800',
      'Recebido': 'bg-emerald-100 text-emerald-800',
      'Cancelado': 'bg-red-100 text-red-800'
    };
    return variants[status] || 'bg-muted text-foreground';
  };

  const manifestosFiltrados = manifestos.filter(m => 
    m.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.transportadora_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 font-din-1451 bg-background pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <P38PageHeader
          variant="page"
          title="Hub Logístico Inbound"
          description="Gestão de manifestos e planejamento de recebimento"
        />
        <div className="flex gap-2">
          <Button onClick={loadManifestos} variant="outline" size="sm" className="gap-2 border-0 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('ConferenciaEntrada'))}
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground shadow-lg gap-2"
            size="sm"
          >
            <QrCode className="w-4 h-4" />
            Conferência
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background p-3">
        <Input
          placeholder="Buscar por manifesto ou transportadora..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md p38-search-field border-0 h-11"
        />
      </div>

      {manifestosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border/40">
          <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum manifesto encontrado</p>
        </div>
      ) : (
        <P38MobileLineList>
          {manifestosFiltrados.map((manifesto, index) => {
            const tone = p38StatusTone(manifesto.status);
            return (
              <P38MobileLine
                key={manifesto.id}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(tone)}
                title={manifesto.numero}
                subtitle={manifesto.transportadora_nome}
                meta={
                  <>
                    <P38StatusLabel tone={tone}>{manifesto.status}</P38StatusLabel>
                    <span className="tabular-nums">ETA {format(parseISO(manifesto.eta), 'dd/MM/yyyy HH:mm')}</span>
                    <span>{manifesto.pedidos_vinculados?.length || 0} pedidos</span>
                    <span className="tabular-nums">{manifesto.peso_total_bruto_kg?.toFixed(2) || 0} kg</span>
                  </>
                }
                trailing={
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleVerDetalhes(manifesto)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                }
              />
            );
          })}
        </P38MobileLineList>
      )}

      {/* Modal de Detalhes */}
      {showDetalhes && manifestoSelecionado && (
        <Dialog open={showDetalhes} onOpenChange={setShowDetalhes}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                {manifestoSelecionado.numero} - Detalhes
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Transportadora</p>
                  <p className="font-medium">{manifestoSelecionado.transportadora_nome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={getStatusBadge(manifestoSelecionado.status)}>
                    {manifestoSelecionado.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ETA</p>
                  <p className="font-medium">{format(parseISO(manifestoSelecionado.eta), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Peso Total</p>
                  <p className="font-medium">{manifestoSelecionado.peso_total_bruto_kg?.toFixed(2) || 0} kg</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Pedidos Vinculados ({manifestoSelecionado.pedidos_vinculados?.length || 0})
                </h4>
                <div className="space-y-2">
                  {manifestoSelecionado.pedidos_vinculados?.map((pedido, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3 border border-border/40 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{pedido.pedido_numero}</p>
                        <p className="text-xs text-muted-foreground mt-1">{pedido.descritivo_volumes}</p>
                        <p className="text-xs text-muted-foreground mt-1">Peso: {pedido.peso_informado_kg} kg</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverPedido(manifestoSelecionado, pedido)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {manifestoSelecionado.observacoes_consolidadas && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="text-sm font-semibold mb-2 text-amber-900 dark:text-amber-200">
                    Descritivo Consolidado de Volumes
                  </h4>
                  <p className="text-sm text-foreground/90">
                    {manifestoSelecionado.observacoes_consolidadas}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-3">Conferência Cega</h4>
                  <div className="grid gap-3">
                    <GestaoCodigosConferencia 
                      manifesto={manifestoSelecionado} 
                      tipo="volumes"
                      onUpdate={loadManifestos}
                    />
                  </div>
                </div>
                

              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetalhes(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}



      {/* Modal de Confirmação de Remoção */}
      {showConfirmRemocao && pedidoParaRemover && (
        <Dialog open={showConfirmRemocao} onOpenChange={setShowConfirmRemocao}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirmar Remoção
              </DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja remover o pedido <strong>{pedidoParaRemover.pedido_numero}</strong> deste manifesto?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                O pedido voltará ao status "Enviado" e poderá ser vinculado a outro manifesto.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmRemocao(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmarRemocao} className="bg-red-600 hover:bg-red-700">
                Confirmar Remoção
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}