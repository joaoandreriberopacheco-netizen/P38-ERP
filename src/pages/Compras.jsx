import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { ShoppingCart, PlusCircle, Search, Edit, Eye, Truck, DollarSign, CalendarRange, FileText, Weight, Package as PackageIcon, Calendar, Trash2, AlertTriangle, RefreshCw, QrCode } from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { toast } from 'sonner';
import PedidoCompraForm from '../components/compras/PedidoCompraForm';
import SugestaoCompra from '../components/compras/SugestaoCompra';
import CotacoesManager from '../components/compras/CotacoesManager';
import ImportadorNotaFiscal from '../components/compras/ImportadorNotaFiscal';
import GestaoCodigosConferencia from '../components/logistica/GestaoCodigosConferencia';
import HierarquiaPortalEntry from '@/components/hierarquia-portal/HierarquiaPortalEntry';
import PainelConferencias from '../components/compras/PainelConferencias';
import { cn } from '@/components/utils';
import { useCompactShell } from '@/hooks/use-breakpoint';

const getStatusBadge = (status) => {
  const variants = {
    'Rascunho': 'bg-muted text-foreground',
    'Enviado': 'bg-blue-100 text-blue-800',
    'Aguardando Recepção': 'bg-yellow-100 text-yellow-800',
    'Recebido Parcialmente': 'bg-orange-100 text-orange-800',
    'Recebido': 'bg-emerald-100 text-emerald-800',
    'Recebido com Discrepância': 'bg-red-100 text-red-800',
    'Cancelado': 'bg-red-100 text-red-800'
  };
  return variants[status] || 'bg-muted text-foreground';
};

const PedidosCompraTab = () => {
  const [pedidos, setPedidos] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showImportador, setShowImportador] = useState(false);
  const [statusPedidoCompra, setStatusPedidoCompra] = useState([]);

  useEffect(() => {
    loadPedidos();
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const statusPC = await base44.entities.StatusPedidoCompra.list('ordem');
      setStatusPedidoCompra(statusPC);
    } catch (error) {
      console.error("Erro ao carregar status:", error);
    }
  };

  const getStatusNome = (codigo) => {
    const status = statusPedidoCompra.find(s => s.codigo === codigo);
    return status?.nome || codigo;
  };



  const loadPedidos = async () => {
    try {
      const data = await base44.entities.PedidoCompra.list('-created_date');
      setPedidos(data);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    }
  };

  const handleEdit = (pedido) => {
    setPedidoSelecionado(pedido);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setPedidoSelecionado(null);
    setIsFormOpen(true);
  };

  const handleVerDetalhes = (pedido) => {
    setPedidoSelecionado(pedido);
    setIsFormOpen(true);
  };

  const handleSave = async (pedidoData) => {
    try {
      // Ensure numeric fields are numbers to prevent "NaN" issues or API errors
      const sanitizedData = {
        ...pedidoData,
        // Ensure numeric fields are actually numbers
        valor_total: Number(pedidoData.valor_total) || 0,
        valor_frete: Number(pedidoData.valor_frete) || 0,
        valor_desconto: Number(pedidoData.valor_desconto) || 0
      };

      if (sanitizedData.id) {
        await base44.entities.PedidoCompra.update(sanitizedData.id, sanitizedData);
      } else {
        const { id, ...newPedido } = sanitizedData;
        
        if (!newPedido.numero) {
           const count = pedidos.length + 1;
           newPedido.numero = `PC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
        }
        
        await base44.entities.PedidoCompra.create(newPedido);
      }
      await loadPedidos();
      // setIsFormOpen(false); // Mantendo aberto para feedback
    } catch (error) {
      console.error("Erro ao salvar pedido:", error);
      throw error; 
    }
  };

  let pedidosFiltrados = pedidos.filter(pedido => {
    const matchSearch = pedido.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       pedido.fornecedor_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFiltro === 'todos' || pedido.status === statusFiltro;
    return matchSearch && matchStatus;
  });

  if (dataInicio && dataFim) {
    const inicio = startOfDay(new Date(dataInicio));
    const fim = endOfDay(new Date(dataFim));
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      if (!p.created_date) return false;
      const pedidoDate = parseISO(p.created_date);
      return isWithinInterval(pedidoDate, { start: inicio, end: fim });
    });
  } else if (dataInicio) {
    const inicio = startOfDay(new Date(dataInicio));
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      if (!p.created_date) return false;
      const pedidoDate = parseISO(p.created_date);
      return pedidoDate >= inicio;
    });
  } else if (dataFim) {
    const fim = endOfDay(new Date(dataFim));
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      if (!p.created_date) return false;
      const pedidoDate = parseISO(p.created_date);
      return pedidoDate <= fim;
    });
  }

  const subtotalFiltrado = pedidosFiltrados.reduce((acc, p) => acc + (p.valor_total || 0), 0);
  const quantidadeFiltrada = pedidosFiltrados.length;

  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Filtros e Ações - Glacial: Limpo, sem bordas pesadas */}
      <div className="bg-card rounded-2xl p-3 md:p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Nº ou fornecedor..." 
                className="pl-9 bg-muted/40 border-transparent focus:bg-card transition-all dark:bg-background dark:text-foreground rounded-lg" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-full sm:w-[180px] bg-muted/40 border-transparent focus:bg-card transition-all dark:bg-background dark:text-foreground rounded-lg">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="dark:bg-muted dark:border-border/40">
                <SelectItem value="todos">Todos os Status</SelectItem>
                {statusPedidoCompra.filter(s => s.ativo).map(status => (
                  <SelectItem key={status.codigo} value={status.codigo}>{status.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="ml-auto flex gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowImportador(true)} variant="outline" className="gap-2 w-full sm:w-auto rounded-xl shadow-sm border-0 bg-muted text-foreground/90 hover:bg-muted dark:hover:bg-primary/90">
                <FileText className="w-4 h-4" />
                Importar NF
              </Button>
              <Button onClick={handleAddNew} className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-card dark:hover:bg-muted dark:text-foreground gap-2 w-full sm:w-auto rounded-xl shadow-sm">
                <PlusCircle className="w-4 h-4" />
                Novo Pedido
              </Button>
            </div>
          </div>

          {/* Filtros de Data Compactos */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 pt-3 border-t border-border/30 dark:border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
              <CalendarRange className="w-3 h-3" />
              Período
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="flex-1 sm:w-32 h-9 text-xs bg-muted/40 border-transparent rounded-lg"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="flex-1 sm:w-32 h-9 text-xs bg-muted/40 border-transparent rounded-lg"
              />
            </div>
            {(dataInicio || dataFim) && (
              <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); }} className="h-8 text-xs text-muted-foreground hover:text-foreground/90">
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Totais - Glacial: Texto grande e limpo */}
      <div className="flex items-baseline gap-4 px-1">
        <h2 className="text-xl md:text-2xl font-light text-foreground dark:text-foreground">
          <span className="font-semibold">R$ {formatValor(subtotalFiltrado)}</span>
          <span className="text-xs md:text-sm text-muted-foreground ml-2 font-normal">em {quantidadeFiltrada} pedidos</span>
        </h2>
      </div>

      {/* Lista Cards - Glacial */}
      <div className="grid gap-3 md:gap-3">
        {/* Responsive: Cards for Mobile, Table for Desktop */}
        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-background shadow-sm overflow-auto">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <P38TableShell className="hidden desktop-layout:block min-w-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosFiltrados.map((pedido) => {
                    const statusLabel = getStatusNome(pedido.status);
                    const tone = p38StatusTone(statusLabel || pedido.status);
                    return (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium text-foreground">
                        {pedido.numero}
                      </TableCell>
                      <TableCell>
                        <P38StatusLabel tone={tone}>{statusLabel}</P38StatusLabel>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pedido.fornecedor_nome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pedido.created_date ? format(new Date(pedido.created_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                         {pedido.data_prevista_entrega ? format(new Date(pedido.data_prevista_entrega), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground tabular-nums">
                        R$ {formatValor(pedido.valor_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleVerDetalhes(pedido)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(pedido)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </P38TableShell>

            {/* Mobile: linhas P38 compactas */}
            <P38MobileLineList>
              {pedidosFiltrados.map((pedido, index) => {
                const statusLabel = getStatusNome(pedido.status);
                const tone = p38StatusTone(statusLabel || pedido.status);
                const emissao = pedido.created_date ? format(new Date(pedido.created_date), 'dd/MM/yyyy') : '-';
                const entrega = pedido.data_prevista_entrega ? format(new Date(pedido.data_prevista_entrega), 'dd/MM/yyyy') : '-';

                return (
                  <P38MobileLine
                    key={pedido.id}
                    striped={index % 2 === 1}
                    accent={p38AccentKeyFromTone(tone)}
                    title={pedido.fornecedor_nome || 'Fornecedor não informado'}
                    subtitle={pedido.numero}
                    meta={
                      <>
                        <P38StatusLabel tone={tone}>{statusLabel}</P38StatusLabel>
                        <span className="tabular-nums">Emissão {emissao}</span>
                        <span className="tabular-nums">Entrega {entrega}</span>
                      </>
                    }
                    value={`R$ ${formatValor(pedido.valor_total)}`}
                    trailing={
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleVerDetalhes(pedido)} className="h-8 w-8 text-muted-foreground">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(pedido)} className="h-8 w-8 text-muted-foreground">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </P38MobileLineList>
          </>
        )}
      </div>

      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <PedidoCompraForm
            pedido={pedidoSelecionado}
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSave={handleSave}
          />
        </Dialog>
      )}

      <ImportadorNotaFiscal 
        isOpen={showImportador}
        onClose={() => setShowImportador(false)}
        onSuccess={loadPedidos}
      />
    </div>
  );
};

export default function ComprasPage() {
  const [sugestaoKey, setSugestaoKey] = useState(0);
  const [activeTab, setActiveTab] = useState('sugestoes');
  const isMobile = useCompactShell();
  const sugestoesFullHeight = isMobile && activeTab === 'sugestoes';
  const cotacoesFullHeight = activeTab === 'cotacoes';
  const tabFullHeight = sugestoesFullHeight || cotacoesFullHeight;

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'sugestoes') {
      setSugestaoKey(prev => prev + 1);
    }
  };

  const tabs = [
    { value: 'sugestoes', label: 'Sugestões', icon: ShoppingCart },
    { value: 'cotacoes', label: 'Cotações', icon: FileText },
    { value: 'pedidos', label: 'Pedidos', icon: DollarSign },
    { value: 'hub-logistico', label: 'Hub Logístico', icon: Truck },
  ];

  return (
    <div
      className={cn(
        tabFullHeight
          ? 'flex flex-col h-full min-h-0 overflow-hidden w-full max-w-full bg-background'
          : 'max-w-7xl mx-auto space-y-0 px-0 md:px-2 py-2 md:py-4',
      )}
    >
      {/* Header */}
      <div className={cn('shrink-0', tabFullHeight ? 'px-4 pb-2 pt-0' : 'px-4 md:px-0 pb-4')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground font-glacial">Compras</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestão completa do ciclo de suprimentos</p>
          </div>
          <HierarquiaPortalEntry className="shrink-0" />
        </div>
      </div>

      {/* Tab Bar - PDV Style pill tabs */}
      <div className={cn('shrink-0', tabFullHeight ? 'px-4' : 'px-4 md:px-0')}>
        <div className="flex gap-1 bg-muted rounded-2xl p-1 w-full overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-card dark:bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div
        className={cn(
          tabFullHeight
            ? 'flex-1 min-h-0 overflow-hidden'
            : 'px-4 md:px-0 pt-4 min-w-0 max-w-full overflow-x-clip',
        )}
      >
        {activeTab === 'sugestoes' && <SugestaoCompra key={sugestaoKey} />}
        {activeTab === 'cotacoes' && <CotacoesManager />}
        {activeTab === 'pedidos' && <PedidosCompraTab />}
        {activeTab === 'hub-logistico' && (
          <HubLogisticoCompleto />
        )}
      </div>
    </div>
  );
}

function HubLogisticoCompleto() {
  const [activeSubTab, setActiveSubTab] = useState('conferencia');

  const subTabs = [
    { value: 'conferencia', label: 'Conferência', icon: QrCode },
  ];

  return (
    <div className="space-y-4">
      <GlacialTabsList scrollable>
        {subTabs.map(tab => (
          <GlacialTabsTrigger
            key={tab.value}
            value={tab.value}
            activeValue={activeSubTab}
            onSelect={setActiveSubTab}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </GlacialTabsList>

      {activeSubTab === 'conferencia' && <ConferenciaSubTab />}
    </div>
  );
}

function ConferenciaSubTab() {
  const [activeConf, setActiveConf] = useState('codigos');
  const confTabs = [
    { value: 'codigos', label: 'Gerar Códigos' },
    { value: 'fiscalizacao', label: 'Fiscalização' },
  ];
  return (
    <div className="space-y-4">
      <GlacialTabsList>
        {confTabs.map(tab => (
          <GlacialTabsTrigger
            key={tab.value}
            value={tab.value}
            activeValue={activeConf}
            onSelect={setActiveConf}
            label={tab.label}
          />
        ))}
      </GlacialTabsList>
      {activeConf === 'codigos' && <ConferenciaTab />}
      {activeConf === 'fiscalizacao' && <PainelConferencias />}
    </div>
  );
}

function ConferenciaTab() {
  const [supermanifestos, setSupermanifestos] = useState([]);
  const [manifestos, setManifestos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [smData, meData] = await Promise.all([
        base44.entities.Supermanifesto.list('-created_date', 50),
        base44.entities.ManifestoEntrada.list('-created_date', 50)
      ]);
      setSupermanifestos(smData);
      setManifestos(meData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  const manifestosPendentes = manifestos.filter(m => 
    m.status_codigo_conferencia_itens !== 'Concluído'
  );

  const supermanifestosPendentes = supermanifestos.filter(s => 
    s.status_codigo_conferencia_volumes !== 'Concluído'
  );

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
              Geração de Códigos para Conferência
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Gere códigos únicos para conferência de volumes e itens. Os conferentes usarão estes códigos na armazenagem.
            </p>
          </div>
        </div>
      </div>

      {supermanifestosPendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground/90 mb-3">SUPERMANIFESTOS</h3>
          <div className="grid gap-3">
            {supermanifestosPendentes.map((sm) => (
              <div key={sm.id} className="bg-card rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-sm">{sm.numero}</div>
                    <div className="text-xs text-muted-foreground">{sm.transportadora_nome}</div>
                  </div>
                  <Badge variant="outline">{sm.status}</Badge>
                </div>
                <GestaoCodigosConferencia 
                  manifesto={sm} 
                  tipo="volumes" 
                  onUpdate={carregarDados}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {manifestosPendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground/90 mb-3">MANIFESTOS DE ENTRADA</h3>
          <div className="grid gap-3">
            {manifestosPendentes.map((me) => (
              <div key={me.id} className="bg-card rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-sm">{me.numero}</div>
                    <div className="text-xs text-muted-foreground">Pedido: {me.pedido_numero}</div>
                  </div>
                  <Badge variant="outline">{me.status}</Badge>
                </div>
                <GestaoCodigosConferencia 
                  manifesto={me} 
                  tipo="itens" 
                  onUpdate={carregarDados}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {manifestosPendentes.length === 0 && supermanifestosPendentes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum manifesto aguardando conferência
        </div>
      )}
    </div>
  );
}