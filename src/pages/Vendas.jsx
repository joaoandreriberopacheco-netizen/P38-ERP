import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Search, Edit, Monitor, Receipt, Eye, Package } from 'lucide-react';
import PedidoVendaForm from '@/components/vendas/PedidoVendaForm';
import { formatarDataHora, formatarSoData } from '@/components/utils/dateUtils';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import { omitPedidoVendaEspelho } from '@/lib/omitEspelhoPersist';

const PedidosTab = () => {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [pedidoParaVer, setPedidoParaVer] = useState(null);

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    const data = await base44.entities.PedidoVenda.list('-created_date');
    const hydrated = await hydratePedidosVendaItensFromSql(base44, data);
    setPedidos(hydrated);
  };

  const handleSave = async (data) => {
    const payload = omitPedidoVendaEspelho({
      ...data,
      subtotal: Number(data.subtotal) || 0,
      valor_total: Number(data.valor_total) || 0,
    });
    let pedidoSalvo;
    if (data.id) {
      pedidoSalvo = await base44.entities.PedidoVenda.update(data.id, payload);
    } else {
      const allPOs = await base44.entities.PedidoVenda.list();
      const nextNumber = (allPOs.length > 0 ? Math.max(...allPOs.map(p => parseInt(p.numero?.split('-')[1] || 0))) : 0) + 1;
      pedidoSalvo = await base44.entities.PedidoVenda.create({
        ...payload,
        numero: `PV-${String(nextNumber).padStart(5, '0')}`,
      });
    }
    await loadPedidos();
    setIsFormOpen(false);
    const row = pedidoSalvo?.data ?? pedidoSalvo;
    return row?.id ? row : { id: data.id, ...payload };
  };

  const handleEdit = (pedido) => {
    setSelectedPedido(pedido);
    setIsFormOpen(true);
  };

  const handleView = (pedido) => {
    setPedidoParaVer(pedido);
    setIsViewOpen(true);
  };

  const handleAddNew = () => {
    setSelectedPedido(null);
    setIsFormOpen(true);
  };

  const getStatusBadge = (status) => {
    const variants = {
      "Orçamento": "bg-muted text-foreground",
      "Aguardando Caixa": "bg-yellow-100 text-yellow-800",
      "Aguardando Aprovação": "bg-orange-100 text-orange-800",
      "Aguardando Pagamento": "bg-yellow-100 text-yellow-800",
      "Aprovado": "bg-blue-100 text-blue-800",
      "Pronto para Expedição": "bg-purple-100 text-purple-800",
      "Finalizado": "bg-green-100 text-green-800",
      "Cancelado": "bg-red-100 text-red-800",
    };
    return variants[status] || "bg-muted text-foreground";
  };

  const formatValor = (valor) => {
    const num = roundToTwoDecimals(parseFloat(valor) || 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredPedidos = pedidos.filter(p =>
    p.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-0 pt-0 pb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por Nº ou cliente..." className="pl-9 bg-card" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Button onClick={handleAddNew} className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto shrink-0">
          <PlusCircle className="h-4 w-4" /> Novo Pedido/Orçamento
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-lg bg-card min-w-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPedidos.map(pedido => (
                <TableRow key={pedido.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">{pedido.numero}</TableCell>
                  <TableCell>{pedido.cliente_nome}</TableCell>
                  <TableCell>{formatarSoData(pedido.created_date)}</TableCell>
                  <TableCell>{pedido.vendedor_nome}</TableCell>
                  <TableCell>R$ {formatValor(pedido.valor_total)}</TableCell>
                  <TableCell><Badge className={getStatusBadge(pedido.status)}>{pedido.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleView(pedido)} title="Ver Detalhes">
                        <Eye className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(pedido)} title="Editar">
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialog de Edição */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <PedidoVendaForm
          pedido={selectedPedido}
          onSave={handleSave}
          onClose={() => setIsFormOpen(false)}
        />
      </Dialog>

      {/* Dialog de Visualização */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {pedidoParaVer && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h2 className="text-2xl font-bold">{pedidoParaVer.numero}</h2>
                  <p className="text-sm text-muted-foreground">{formatarDataHora(pedidoParaVer.created_date)}</p>
                </div>
                <Badge className={getStatusBadge(pedidoParaVer.status)}>{pedidoParaVer.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{pedidoParaVer.cliente_nome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendedor</p>
                  <p className="font-semibold">{pedidoParaVer.vendedor_nome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Método de Entrega</p>
                  <p className="font-semibold">{pedidoParaVer.metodo_entrega || 'Retirada'}</p>
                </div>
              </div>

              <div className="border-t pt-4 min-w-0">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Itens do Pedido
                </h3>
                <div className="overflow-x-auto -mx-1 px-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(pedidoParaVer.itens) && pedidoParaVer.itens.length > 0 ? (
                      pedidoParaVer.itens.map((item, idx) => (
                        <TableRow key={item.pedido_venda_item_id || item.produto_id || idx}>
                          <TableCell>{item.produto_nome}</TableCell>
                          <TableCell>{item.quantidade}</TableCell>
                          <TableCell>R$ {formatValor(item.preco_unitario_praticado)}</TableCell>
                          <TableCell>R$ {formatValor(item.total)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground text-center">
                          Sem linhas SQL para este pedido
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">R$ {formatValor(pedidoParaVer.subtotal)}</span>
                </div>
                {pedidoParaVer.valor_desconto > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto:</span>
                    <span className="font-semibold">- R$ {formatValor(pedidoParaVer.valor_desconto)}</span>
                  </div>
                )}
                {pedidoParaVer.valor_acrescimo > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Acréscimo:</span>
                    <span className="font-semibold">+ R$ {formatValor(pedidoParaVer.valor_acrescimo)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-green-600">R$ {formatValor(pedidoParaVer.valor_total)}</span>
                </div>
              </div>

              {pedidoParaVer.observacoes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{pedidoParaVer.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default function VendasPage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = urlParams.get('tab') || 'pedidos';

  // PDV deve abrir nas rotas fullscreen (sem sidebar do shell)
  useEffect(() => {
    if (activeTab === 'pdv-vendedor') {
      navigate(createPageUrl('PDVVendedor'), { replace: true });
    } else if (activeTab === 'pdv-caixa') {
      navigate(createPageUrl('PDVCaixa'), { replace: true });
    }
  }, [activeTab, navigate]);

  if (activeTab === 'pdv-vendedor' || activeTab === 'pdv-caixa') {
    return null;
  }

  // Caso contrário, renderizar tabs normais
  return (
    <div className="p-6 lg:p-8 min-h-screen bg-muted/40 dark:bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2">Módulo de Vendas</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mb-8">Gerencie orçamentos, pedidos e ponto de venda com fluxos especializados.</p>

        <Tabs value={activeTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="pedidos" className="gap-2" onClick={() => window.location.href = '/Vendas?tab=pedidos'}>
              <Edit className="w-4 h-4"/> Pedidos e Orçamentos
            </TabsTrigger>
            <TabsTrigger value="pdv-vendedor" className="gap-2" onClick={() => window.location.href = '/Vendas?tab=pdv-vendedor'}>
              <Monitor className="w-4 h-4"/> PDV - Vendedor
            </TabsTrigger>
            <TabsTrigger value="pdv-caixa" className="gap-2" onClick={() => window.location.href = '/Vendas?tab=pdv-caixa'}>
              <Receipt className="w-4 h-4"/> PDV - Caixa
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pedidos">
            <PedidosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}