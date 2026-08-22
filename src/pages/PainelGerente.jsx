import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock,
  DollarSign,
  Users,
  AlertCircle,
  Search,
  Filter,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { dataHoje, inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';

export default function PainelGerente() {
  const [filtros, setFiltros] = useState({
    data_inicio: dataHoje(),
    data_fim: dataHoje(),
    status: 'todos',
    cliente: ''
  });

  // Buscar pedidos com filtros
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['painel-gerente', filtros],
    queryFn: async () => {
      const query = {
        created_date: {
          $gte: inicioDiaSistemaISO(filtros.data_inicio),
          $lte: fimDiaSistemaISO(filtros.data_fim)
        }
      };

      if (filtros.status !== 'todos') {
        query.status = filtros.status;
      }

      if (filtros.cliente) {
        query.cliente_nome = { $regex: filtros.cliente, $options: 'i' };
      }

      return await base44.entities.PedidoVenda.filter(query, '-created_date', 500);
    }
  });

  // Calcular métricas
  const metricas = React.useMemo(() => {
    const total = pedidos.length;
    const emSeparacao = pedidos.filter(p => p.status === 'Aprovado').length;
    const emRota = pedidos.filter(p => p.status === 'Envio Agendado').length;
    const aguardandoRetirada = pedidos.filter(p => p.status === 'Aguardando Retirada').length;
    const concluidos = pedidos.filter(p => p.status === 'Finalizado').length;
    const valorTotal = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const ticketMedio = total > 0 ? valorTotal / total : 0;
    
    const delivery = pedidos.filter(p => p.metodo_entrega === 'Delivery').length;
    const retirada = pedidos.filter(p => p.metodo_entrega === 'Retirada').length;

    // Pedidos por vendedor
    const porVendedor = {};
    pedidos.forEach(p => {
      if (!porVendedor[p.vendedor_nome]) {
        porVendedor[p.vendedor_nome] = { total: 0, valor: 0 };
      }
      porVendedor[p.vendedor_nome].total++;
      porVendedor[p.vendedor_nome].valor += p.valor_total || 0;
    });

    return {
      total,
      emSeparacao,
      emRota,
      aguardandoRetirada,
      concluidos,
      valorTotal,
      ticketMedio,
      delivery,
      retirada,
      porVendedor: Object.entries(porVendedor)
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.valor - a.valor)
    };
  }, [pedidos]);

  const formatValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const statusLabelPedido = (status) => {
    if (status === 'Aprovado') return 'EM SEPARAÇÃO';
    if (status === 'Envio Agendado') return 'EM ROTA';
    if (status === 'Aguardando Retirada') return 'AGUARDANDO';
    return status;
  };

  const MetricCard = ({ titulo, valor, subtitulo, icone: Icon, cor, tendencia }) => (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">{titulo}</p>
            <p className={`text-2xl font-bold ${cor || 'text-foreground'}`}>
              {valor}
            </p>
            {subtitulo && (
              <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            cor ? `bg-${cor.split('-')[1]}-100 dark:bg-${cor.split('-')[1]}-900/20` : 'bg-muted'
          }`}>
            <Icon className={`w-5 h-5 ${cor || 'text-muted-foreground'}`} />
          </div>
        </div>
        {tendencia !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {tendencia > 0 ? (
              <>
                <ArrowUp className="w-3 h-3 text-green-500" />
                <span className="text-xs text-[#4A5D23] dark:text-[#a4ce33]">+{tendencia}%</span>
              </>
            ) : tendencia < 0 ? (
              <>
                <ArrowDown className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-600 dark:text-red-400">{tendencia}%</span>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-border/40 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">CARREGANDO DADOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">PAINEL GERENCIAL</h1>
        <p className="text-sm text-muted-foreground">VISÃO GERAL DAS OPERAÇÕES</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground/90">FILTROS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  <SelectItem value="Aprovado">EM SEPARAÇÃO</SelectItem>
                  <SelectItem value="Aguardando Retirada">AGUARDANDO RETIRADA</SelectItem>
                  <SelectItem value="Envio Agendado">EM ROTA DE ENTREGA</SelectItem>
                  <SelectItem value="Finalizado">CONCLUÍDO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CLIENTE</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-pulse-sensor="painel-gerente.busca-cliente"
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

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          titulo="TOTAL PEDIDOS"
          valor={metricas.total}
          icone={Package}
          cor="text-blue-600"
        />
        <MetricCard
          titulo="FATURAMENTO"
          valor={formatValor(metricas.valorTotal)}
          subtitulo={`Ticket Médio: ${formatValor(metricas.ticketMedio)}`}
          icone={DollarSign}
          cor="text-green-600"
        />
        <MetricCard
          titulo="CONCLUÍDOS"
          valor={metricas.concluidos}
          subtitulo={`${metricas.total > 0 ? Math.round((metricas.concluidos / metricas.total) * 100) : 0}% do total`}
          icone={CheckCircle}
          cor="text-green-600"
        />
        <MetricCard
          titulo="EM ANDAMENTO"
          valor={metricas.emSeparacao + metricas.emRota + metricas.aguardandoRetirada}
          subtitulo="Pedidos ativos"
          icone={Clock}
          cor="text-orange-600"
        />
      </div>

      {/* Tabela de Pedidos */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">PEDIDOS DO PERÍODO</h3>
          {pedidos.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">NENHUM PEDIDO ENCONTRADO</p>
          ) : (
            <>
              <P38TableShell className="hidden desktop-layout:block min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.map((pedido) => {
                      const statusTxt = statusLabelPedido(pedido.status);
                      const tone = p38StatusTone(pedido.status);
                      return (
                        <TableRow key={pedido.id}>
                          <TableCell className="font-medium text-foreground">{pedido.numero}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{pedido.cliente_nome}</TableCell>
                          <TableCell className="text-muted-foreground">{pedido.vendedor_nome || '-'}</TableCell>
                          <TableCell className="text-right font-semibold text-foreground tabular-nums">
                            {formatValor(pedido.valor_total)}
                          </TableCell>
                          <TableCell>
                            <P38StatusLabel tone={tone}>{statusTxt}</P38StatusLabel>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {pedido.metodo_entrega === 'Delivery' ? (
                              <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> Delivery</span>
                            ) : (
                              <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" /> Retirada</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </P38TableShell>

              <P38MobileLineList className="desktop-layout:hidden">
                {pedidos.map((pedido, index) => {
                  const statusTxt = statusLabelPedido(pedido.status);
                  const tone = p38StatusTone(pedido.status);
                  const entrega = pedido.metodo_entrega === 'Delivery' ? 'Delivery' : 'Retirada';
                  return (
                    <P38MobileLine
                      key={pedido.id}
                      striped={index % 2 === 1}
                      accent={p38AccentKeyFromTone(tone)}
                      title={pedido.cliente_nome || 'Cliente não informado'}
                      subtitle={pedido.numero}
                      meta={
                        <>
                          <P38StatusLabel tone={tone}>{statusTxt}</P38StatusLabel>
                          <span>{pedido.vendedor_nome || '-'}</span>
                          <span>{entrega}</span>
                          <span className="tabular-nums">{new Date(pedido.created_date).toLocaleDateString('pt-BR')}</span>
                        </>
                      }
                      value={formatValor(pedido.valor_total)}
                    />
                  );
                })}
              </P38MobileLineList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}