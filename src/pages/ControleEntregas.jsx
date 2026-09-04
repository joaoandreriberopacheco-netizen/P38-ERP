import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  Search,
  Filter,
  Calendar,
  User,
  MapPin,
  Phone,
  DollarSign,
  QrCode,
  ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LiberacaoEntrega from '@/components/vendas/LiberacaoEntrega';
import { dataHoje, dataMenosDiasSistema, inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { P38MobileLineList, P38MobileLine, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

export default function ControleEntregas() {
  const queryClient = useQueryClient();
  const getDefaultDates = () => ({
    inicio: dataMenosDiasSistema(7),
    fim: dataHoje()
  });

  const defaultDates = getDefaultDates();
  
  const [filtros, setFiltros] = useState({
    data_inicio: defaultDates.inicio,
    data_fim: defaultDates.fim,
    status: 'todos',
    cliente: '',
    metodo_entrega: 'todos'
  });

  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [mostrarLiberacao, setMostrarLiberacao] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Buscar pedidos
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-entrega', filtros],
    queryFn: async () => {
      const query = {};

      // Filtro de data
      if (filtros.data_inicio && filtros.data_fim) {
        query.created_date = {
          $gte: inicioDiaSistemaISO(filtros.data_inicio),
          $lte: fimDiaSistemaISO(filtros.data_fim)
        };
      }

      // Filtro de status
      if (filtros.status !== 'todos') {
        query.status = filtros.status;
      } else {
        query.status = {
          $in: ['Financeiro OK', 'Em Separação', 'Aguardando Retirada', 'Em Rota de Entrega', 'Pedido Concluído']
        };
      }

      // Filtro de método de entrega
      if (filtros.metodo_entrega !== 'todos') {
        query.metodo_entrega = filtros.metodo_entrega;
      }

      // Filtro de cliente
      if (filtros.cliente) {
        query.cliente_nome = { $regex: filtros.cliente, $options: 'i' };
      }

      const resultado = await base44.entities.PedidoVenda.filter(query, '-created_date', 200);
      return resultado;
    }
  });

  // Mutation para atualizar status
  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, novoStatus }) => {
      return await base44.entities.PedidoVenda.update(pedidoId, { status: novoStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-entrega'] });
    }
  });

  const getStatusConfig = (status) => {
    const configs = {
      'Financeiro OK': { cor: 'bg-yellow-100 text-yellow-800', icone: DollarSign, label: 'PAGAMENTO OK' },
      'Em Separação': { cor: 'bg-blue-100 text-blue-800', icone: Package, label: 'EM SEPARAÇÃO' },
      'Aguardando Retirada': { cor: 'bg-purple-100 text-purple-800', icone: MapPin, label: 'AGUARDANDO RETIRADA' },
      'Em Rota de Entrega': { cor: 'bg-indigo-100 text-indigo-800', icone: Truck, label: 'EM ROTA DE ENTREGA' },
      'Pedido Concluído': { cor: 'bg-green-100 text-green-800', icone: CheckCircle, label: 'CONCLUÍDO' }
    };
    return configs[status] || { cor: 'bg-muted text-foreground', icone: Clock, label: status };
  };

  const handleAbrirDetalhes = async (pedido) => {
    setPedidoSelecionado(pedido);
    
    // Buscar dados do cliente
    if (pedido.cliente_id) {
      const cliente = await base44.entities.Terceiro.get(pedido.cliente_id);
      setClienteSelecionado(cliente);
    }
    
    setMostrarDetalhes(true);
  };

  const handleMostrarLiberacao = async (pedido) => {
    setPedidoSelecionado(pedido);
    
    // Buscar dados do cliente
    if (pedido.cliente_id) {
      const cliente = await base44.entities.Terceiro.get(pedido.cliente_id);
      setClienteSelecionado(cliente);
    }
    
    setMostrarLiberacao(true);
  };

  const handleAtualizarStatus = async (pedidoId, novoStatus) => {
    await atualizarStatusMutation.mutateAsync({ pedidoId, novoStatus });
  };

  const formatValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  // Estatísticas
  const stats = {
    total: pedidos.length,
    emSeparacao: pedidos.filter(p => p.status === 'Em Separação').length,
    emRota: pedidos.filter(p => p.status === 'Em Rota de Entrega').length,
    concluidos: pedidos.filter(p => p.status === 'Pedido Concluído').length,
    valorTotal: pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0)
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">CONTROLE DE ENTREGAS E SEPARAÇÃO</h1>
        <p className="text-sm text-muted-foreground">ACOMPANHE O STATUS DOS PEDIDOS EM TEMPO REAL</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">TOTAL PEDIDOS</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.emSeparacao}</div>
            <div className="text-xs text-muted-foreground">EM SEPARAÇÃO</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{stats.emRota}</div>
            <div className="text-xs text-muted-foreground">EM ROTA</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.concluidos}</div>
            <div className="text-xs text-muted-foreground">CONCLUÍDOS</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-lg font-bold text-foreground">{formatValor(stats.valorTotal)}</div>
            <div className="text-xs text-muted-foreground">VALOR TOTAL</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground/90">FILTROS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">DATA INÍCIO</label>
              <Input
                type="date"
                value={filtros.data_inicio}
                onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">DATA FIM</label>
              <Input
                type="date"
                value={filtros.data_fim}
                onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">STATUS</label>
              <Select value={filtros.status} onValueChange={(value) => setFiltros({ ...filtros, status: value })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">TODOS</SelectItem>
                  <SelectItem value="Financeiro OK">PAGAMENTO OK</SelectItem>
                  <SelectItem value="Em Separação">EM SEPARAÇÃO</SelectItem>
                  <SelectItem value="Aguardando Retirada">AGUARDANDO RETIRADA</SelectItem>
                  <SelectItem value="Em Rota de Entrega">EM ROTA DE ENTREGA</SelectItem>
                  <SelectItem value="Pedido Concluído">CONCLUÍDO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ENTREGA</label>
              <Select value={filtros.metodo_entrega} onValueChange={(value) => setFiltros({ ...filtros, metodo_entrega: value })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">TODOS</SelectItem>
                  <SelectItem value="Delivery">DELIVERY</SelectItem>
                  <SelectItem value="Retirada">RETIRADA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CLIENTE</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-pulse-sensor="controle-entregas.busca-cliente"
                  placeholder="BUSCAR..."
                  value={filtros.cliente}
                  onChange={(e) => setFiltros({ ...filtros, cliente: e.target.value })}
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">CARREGANDO PEDIDOS...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">NENHUM PEDIDO ENCONTRADO</div>
      ) : (
        <P38MobileLineList>
          {pedidos.map((pedido, index) => {
            const statusConfig = getStatusConfig(pedido.status);
            const tone = p38StatusTone(pedido.status);
            const itensResumo =
              `${pedido.itens?.length || 0} ${pedido.itens?.length === 1 ? 'item' : 'itens'} · ` +
              (pedido.itens?.slice(0, 2).map((i) => i.produto_nome).join(', ') || '') +
              (pedido.itens?.length > 2 ? '…' : '');

            return (
              <P38MobileLine
                key={pedido.id}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(tone)}
                title={pedido.numero}
                subtitle={pedido.cliente_nome}
                meta={
                  <>
                    <P38StatusLabel tone={tone}>{statusConfig.label}</P38StatusLabel>
                    {pedido.senha_atendimento ? <span className="font-mono">SENHA {pedido.senha_atendimento}</span> : null}
                    {pedido.metodo_entrega === 'Delivery' ? <span>Delivery</span> : null}
                    <span className="tabular-nums truncate">{itensResumo}</span>
                  </>
                }
                value={formatValor(pedido.valor_total)}
                valueSub={new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                trailing={
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleMostrarLiberacao(pedido)} className="h-7 text-xs px-2">
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleAbrirDetalhes(pedido)} className="h-7 text-xs px-2">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                }
              />
            );
          })}
        </P38MobileLineList>
      )}

      {/* Dialog de Detalhes */}
      <Dialog open={mostrarDetalhes} onOpenChange={setMostrarDetalhes}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DETALHES DO PEDIDO {pedidoSelecionado?.numero}</DialogTitle>
          </DialogHeader>
          
          {pedidoSelecionado && (
            <div className="space-y-4">
              {/* Informações do Cliente */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">CLIENTE</h3>
                  <p className="font-semibold">{pedidoSelecionado.cliente_nome}</p>
                  {clienteSelecionado && (
                    <div className="text-sm text-muted-foreground space-y-1 mt-2">
                      {clienteSelecionado.telefone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{clienteSelecionado.telefone}</span>
                        </div>
                      )}
                      {clienteSelecionado.endereco && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5" />
                          <div>
                            <p>{clienteSelecionado.endereco}</p>
                            <p>
                              {clienteSelecionado.bairro && `${clienteSelecionado.bairro} - `}
                              {clienteSelecionado.cidade && `${clienteSelecionado.cidade}`}
                              {clienteSelecionado.estado && `/${clienteSelecionado.estado}`}
                              {clienteSelecionado.cep && ` - CEP: ${clienteSelecionado.cep}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Itens do Pedido */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">ITENS</h3>
                  <div className="space-y-2">
                    {pedidoSelecionado.itens?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantidade}x {item.produto_nome}</span>
                        <span className="font-semibold">{formatValor(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Ações de Status */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">ALTERAR STATUS</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {pedidoSelecionado.status !== 'Em Separação' && (
                      <Button
                        onClick={() => handleAtualizarStatus(pedidoSelecionado.id, 'Em Separação')}
                        size="sm"
                        variant="outline"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        EM SEPARAÇÃO
                      </Button>
                    )}
                    {pedidoSelecionado.metodo_entrega === 'Retirada' && pedidoSelecionado.status !== 'Aguardando Retirada' && (
                      <Button
                        onClick={() => handleAtualizarStatus(pedidoSelecionado.id, 'Aguardando Retirada')}
                        size="sm"
                        variant="outline"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        AGUARDANDO RETIRADA
                      </Button>
                    )}
                    {pedidoSelecionado.metodo_entrega === 'Delivery' && pedidoSelecionado.status !== 'Em Rota de Entrega' && (
                      <Button
                        onClick={() => handleAtualizarStatus(pedidoSelecionado.id, 'Em Rota de Entrega')}
                        size="sm"
                        variant="outline"
                      >
                        <Truck className="w-4 h-4 mr-2" />
                        EM ROTA
                      </Button>
                    )}
                    {pedidoSelecionado.status !== 'Pedido Concluído' && (
                      <Button
                        onClick={() => handleAtualizarStatus(pedidoSelecionado.id, 'Pedido Concluído')}
                        size="sm"
                        variant="outline"
                        className="col-span-2"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        MARCAR COMO CONCLUÍDO
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Liberação para Entrega */}
      {mostrarLiberacao && (
        <LiberacaoEntrega
          open={mostrarLiberacao}
          onClose={() => setMostrarLiberacao(false)}
          pedido={pedidoSelecionado}
          cliente={clienteSelecionado}
        />
      )}
    </div>
  );
}