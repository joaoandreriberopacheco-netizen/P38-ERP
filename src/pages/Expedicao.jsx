import React, { useState, useEffect } from 'react';
import { PedidoVenda } from '@/entities/PedidoVenda';
import { ProtocoloEntrega } from '@/entities/ProtocoloEntrega';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { Package, CheckCircle, Truck, Eye } from 'lucide-react';
import ConfirmarEntrega from '../components/vendas/ConfirmarEntrega';
import { useToast } from "@/components/ui/use-toast";

export default function ExpedicaoPage() {
  const [pedidosProntos, setPedidosProntos] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    const pedidos = await PedidoVenda.filter({ 
      status: 'Pronto para Expedição'
    });
    setPedidosProntos(pedidos);
  };

  const handleConfirmarEntrega = (pedido) => {
    setPedidoSelecionado(pedido);
    setIsDialogOpen(true);
  };

  const handleSuccess = () => {
    loadPedidos();
    toast({
      title: "Entrega confirmada!",
      description: "Pedido finalizado com sucesso.",
      className: "bg-green-100 text-green-800"
    });
  };

  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 font-din-1451 bg-background pb-[var(--p38-scroll-pad-below-nav)] md:pb-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-pulse-sensor="expedicao.titulo">Expedição e Entrega</h1>
        <p className="text-muted-foreground mb-8">Confirme a entrega dos pedidos separados.</p>

        {pedidosProntos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-8 text-center bg-background">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum pedido pronto para expedição</p>
          </div>
        ) : (
          <>
            <P38MobileLineList>
              {pedidosProntos.map((pedido, index) => (
                <P38MobileLine
                  key={pedido.id}
                  striped={index % 2 === 1}
                  accent="success"
                  title={pedido.numero}
                  subtitle={pedido.cliente_nome}
                  meta={
                    <>
                      <P38StatusLabel tone="success">Pronto</P38StatusLabel>
                      <span className="inline-flex items-center gap-1">
                        {pedido.metodo_entrega === 'Delivery' ? (
                          <><Truck className="w-3 h-3" /> Delivery</>
                        ) : (
                          <><Package className="w-3 h-3" /> Retirada</>
                        )}
                      </span>
                    </>
                  }
                  value={`R$ ${formatValor(pedido.valor_total)}`}
                  trailing={
                    <Button
                      size="sm"
                      data-pulse-sensor="expedicao.confirmar"
                      onClick={() => handleConfirmarEntrega(pedido)}
                      className="bg-[#4A5D23] hover:bg-[#3d4f1d] dark:bg-[#a4ce33] dark:hover:bg-[#8fb32a] dark:text-foreground gap-1 shrink-0 h-9"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirmar
                    </Button>
                  }
                />
              ))}
            </P38MobileLineList>

            <Card className="hidden desktop-layout:block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                  Pedidos Prontos para Expedição
                </CardTitle>
              </CardHeader>
              <CardContent>
                <P38TableShell className="min-w-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Método de Entrega</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosProntos.map(pedido => (
                        <TableRow key={pedido.id}>
                          <TableCell className="font-medium">{pedido.numero}</TableCell>
                          <TableCell>{pedido.cliente_nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {pedido.metodo_entrega === 'Delivery' ? (
                                <><Truck className="w-3 h-3" /> Delivery</>
                              ) : (
                                <><Package className="w-3 h-3" /> Retirada</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>R$ {formatValor(pedido.valor_total)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmarEntrega(pedido)}
                              className="bg-green-600 hover:bg-green-700 gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Confirmar Entrega
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </P38TableShell>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ConfirmarEntrega
        pedido={pedidoSelecionado}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}