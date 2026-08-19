import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Eye, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';
import PedidoCompraForm from '@/components/compras/PedidoCompraForm';
import AprovacaoPedidoMobile from '@/components/compras/AprovacaoPedidoMobile';
import {
  aprovarPedidoCompraFinanceiro,
  pedidoAguardandoAprovacaoFinanceira,
  rejeitarPedidoCompraFinanceiro,
  sincronizarPedidoCompraSePagamentoCompleto,
} from '@/lib/aprovarPedidoCompraFinanceiro';
import {
  cancelarLancamentosNaoPagosPedidoCompra,
  listarLancamentosPedidoCompra,
  pedidoPagamentoCompleto,
  temLancamentoPagoParaPedido,
  calcValorTotalPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';

export default function FinanceiroAprovacoesPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [contas, setContas] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPedidoDetails, setShowPedidoDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [solicitacoesEdicao, setSolicitacoesEdicao] = useState([]);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    let pedidoStatusFilter;
    if (activeTab === 'pendentes') {
      pedidoStatusFilter = 'Aguardando Aprovação Financeira';
    } else if (activeTab === 'aprovados') {
      pedidoStatusFilter = 'Aprovado Financeiramente';
    } else if (activeTab === 'rejeitados') {
      pedidoStatusFilter = 'Rejeitado Financeiramente';
    }

    const [pedidosData, contasData, solicitacoesData] = await Promise.all([
      base44.entities.PedidoCompra.filter({ 
        status_aprovacao_financeira: pedidoStatusFilter
      }),
      base44.entities.ContasFinanceiras.filter({ ativo: true }),
      base44.entities.PedidoCompra.filter({
        status_aprovacao_financeira: 'Solicitação de Edição Pendente'
      })
    ]);

    const transactionsData = await Promise.all(
      pedidosData.map(async (pedido) => {
        const lancamentos = await listarLancamentosPedidoCompra(base44, pedido.id);
        return {
          ...pedido,
          lancamentos_financeiros: lancamentos,
          valor_total_lancamentos: lancamentos.reduce((sum, l) => sum + (l.valor || 0), 0),
        };
      }),
    );

    let transactionsFiltradas = transactionsData;
    if (activeTab === 'pendentes') {
      const pendentes = [];
      for (const pedido of transactionsData) {
        const lancs = pedido.lancamentos_financeiros || [];
        if (pedidoAguardandoAprovacaoFinanceira(pedido, lancs)) {
          pendentes.push(pedido);
        } else if (pedidoPagamentoCompleto(lancs, pedido)) {
          await sincronizarPedidoCompraSePagamentoCompleto({
            base44,
            pedido,
            lancamentos: lancs,
          });
        }
      }
      transactionsFiltradas = pendentes;
    }

    setPendingTransactions(transactionsFiltradas);
    setContas(contasData);
    setSolicitacoesEdicao(solicitacoesData);
    setIsLoading(false);
  };

  const handleApprove = (pedido) => {
    setSelectedTransaction(pedido);
    setContaSelecionada('');
  };

  const handleReject = (pedido) => {
    setSelectedTransaction(pedido);
    setIsRejectDialogOpen(true);
  };



  const handleInitiateApproval = () => {
    if (!contaSelecionada) {
      toast({
        title: "Conta obrigatória",
        description: "Selecione uma conta para realizar o pagamento.",
        variant: "destructive"
      });
      return;
    }
    void runOperacaoAuthBypass((authData) => handleAuthSuccess(authData, 'approve'));
  };



  const handleConfirmReject = () => {
    if (!motivoRejeicao.trim()) {
      toast({
        title: 'Motivação obrigatória',
        description: 'Informe o motivo da rejeição para feedback ao setor de compras.',
        variant: 'destructive'
      });
      return;
    }
    setIsRejectDialogOpen(false);
    const motivo = motivoRejeicao;
    void runOperacaoAuthBypass((authData) => handleAuthSuccess(authData, 'reject', { motivo }));
  };

  const handleAuthSuccess = async (authData, tipoAcao, opts = {}) => {
    const { pedido: pedidoOverride, contaId: contaIdOverride, motivo: motivoOverride } = opts;
    try {
      if (tipoAcao === 'approve') {
        const pedido = pedidoOverride ?? selectedTransaction;
        const contaId = contaIdOverride ?? contaSelecionada;
        if (!pedido?.id || !contaId) {
          toast({
            title: 'Erro',
            description: 'Dados incompletos para aprovar o pedido.',
            variant: 'destructive',
          });
          return;
        }
        const contaNome = contas.find((c) => c.id === contaId)?.nome || '';
        const resultado = await aprovarPedidoCompraFinanceiro({
          base44,
          pedido,
          contaId,
          contaNome,
          authData,
        });

        toast({
          title: resultado.jaEstavaPago ? 'Pagamento já estava realizado' : '✓ Pagamento aprovado',
          description: resultado.jaEstavaPago
            ? 'Status do pedido alinhado com as parcelas pagas. Logística liberada.'
            : 'Pedido aprovado. Logística liberada.',
          className: 'bg-muted text-foreground',
        });
      } else if (tipoAcao === 'reject') {
        const pedido = pedidoOverride ?? selectedTransaction;
        const motivo = motivoOverride ?? motivoRejeicao;
        if (!pedido?.id || !motivo?.trim()) {
          toast({
            title: 'Erro',
            description: 'Dados incompletos para rejeitar o pedido.',
            variant: 'destructive',
          });
          return;
        }

        await rejeitarPedidoCompraFinanceiro({ base44, pedido, motivo, authData });

        toast({
          title: 'Pedido rejeitado',
          description: 'Feedback registrado para o setor de compras.',
          variant: 'destructive',
        });
      }

      loadData();
      setSelectedTransaction(null);
      setMotivoRejeicao('');
      setContaSelecionada('');
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleLiberarEdicao = async (authData, pedidoAlvo) => {
    const pedido = pedidoAlvo ?? selectedSolicitacao;
    if (!pedido) return;
    try {
      const lancs = await listarLancamentosPedidoCompra(base44, pedido.id);
      if (temLancamentoPagoParaPedido(lancs)) {
        toast({
          title: 'Não é possível liberar edição',
          description:
            'Existem parcelas já pagas neste pedido. Ajuste ou estorne no financeiro antes de liberar a edição do pedido.',
          variant: 'destructive',
        });
        setSelectedSolicitacao(null);
        return;
      }
      const nota = `| Liberar edição | Ref: ${authData.operationCode} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
      await cancelarLancamentosNaoPagosPedidoCompra(base44, pedido.id, nota);

      await base44.entities.PedidoCompra.update(pedido.id, {
        status_aprovacao_financeira: 'Pendente',
        status: 'Rascunho',
        historico: (pedido.historico || '') +
          `\n[Liberado para Edição: ${authData.intervenienteName} | Ref: ${authData.operationCode} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`
      });

      toast({
        title: "Edição liberada",
        description: "Parcelas em aberto foram canceladas. Compras pode corrigir o pedido e reenviar ao financeiro.",
        className: "bg-muted text-foreground"
      });

      loadData();
      setSelectedSolicitacao(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value) => {
    return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };



  const filteredPedidos = pendingTransactions.filter(pedido => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pedido.numero?.toLowerCase().includes(search) ||
      pedido.fornecedor_nome?.toLowerCase().includes(search) ||
      pedido.observacoes?.toLowerCase().includes(search)
    );
  });

  const totalPendente = pendingTransactions.reduce(
    (sum, p) => sum + calcValorTotalPedidoCompra(p),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="pb-4 border-b border-border/40">
        <h1 className="text-2xl font-medium text-foreground mb-1">Aprovações Financeiras</h1>
        <p className="text-sm text-muted-foreground">Gerencie pagamentos e histórico de aprovações</p>
      </div>

      <div className="grid grid-cols-2 gap-6 pb-6 border-b border-border/40">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Total {activeTab === 'pendentes' ? 'Pendente' : activeTab === 'aprovados' ? 'Aprovado' : 'Rejeitado'}</div>
          <div className="text-3xl font-bold text-foreground">{formatCurrency(totalPendente)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Pedidos</div>
          <div className="text-3xl font-bold text-foreground">{pendingTransactions.length}</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="pendentes" className="rounded-lg data-[state=active]:bg-card">
              <Clock className="w-4 h-4 mr-2" />
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="aprovados" className="rounded-lg data-[state=active]:bg-card">
              <CheckCircle className="w-4 h-4 mr-2" />
              Aprovados
            </TabsTrigger>
            <TabsTrigger value="rejeitados" className="rounded-lg data-[state=active]:bg-card">
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitados
            </TabsTrigger>
          </TabsList>

          {solicitacoesEdicao.length > 0 && (
            <Badge className="bg-orange-100 text-orange-800 border-0 shadow-sm">
              <AlertCircle className="w-3 h-3 mr-1" />
              {solicitacoesEdicao.length} {solicitacoesEdicao.length === 1 ? 'solicitação' : 'solicitações'} de edição
            </Badge>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por pedido, fornecedor ou descrição..."
            className="pl-11 bg-muted/50 border-0 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <TabsContent value={activeTab} className="mt-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 animate-spin" />
              <p>Carregando...</p>
            </div>
          ) : filteredPedidos.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl shadow-sm">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground dark:text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? 'Nenhum resultado encontrado' : `Nenhum pedido ${activeTab === 'pendentes' ? 'pendente' : activeTab === 'aprovados' ? 'aprovado' : 'rejeitado'}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'Tente outro termo de busca' : `Não há pedidos ${activeTab} no momento`}
              </p>
            </div>
          ) : (
            <>
              <P38TableShell className="hidden desktop-layout:block min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-background/80">
                    <TableRow className="border-0">
                      <TableHead className="text-foreground/90">Pedido</TableHead>
                      <TableHead className="text-foreground/90">Fornecedor</TableHead>
                      <TableHead className="text-center text-foreground/90">Itens</TableHead>
                      <TableHead className="text-right text-foreground/90">Valor Total</TableHead>
                      {activeTab === 'aprovados' && (
                        <TableHead className="text-foreground/90">Data Aprovação</TableHead>
                      )}
                      {activeTab === 'rejeitados' && (
                        <TableHead className="text-foreground/90">Motivo</TableHead>
                      )}
                      <TableHead className="text-right text-foreground/90">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.map((pedido) => {
                      return (
                        <TableRow key={pedido.id} className={`border-0 hover:bg-muted/40 dark:hover:bg-muted/50 ${
                          activeTab === 'aprovados' ? 'bg-green-50/50 dark:bg-green-900/10' :
                          activeTab === 'rejeitados' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                        }`}>
                          <TableCell className="font-medium text-foreground">
                            {pedido.numero}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {pedido.fornecedor_nome}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {pedido.itens?.length || 0}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            {formatCurrency(calcValorTotalPedidoCompra(pedido))}
                          </TableCell>
                          {activeTab === 'aprovados' && (
                            <TableCell className="text-muted-foreground text-xs">
                              {pedido.data_aprovacao_financeira ? format(new Date(pedido.data_aprovacao_financeira), 'dd/MM/yyyy HH:mm') : '-'}
                            </TableCell>
                          )}
                          {activeTab === 'rejeitados' && (
                            <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                              {pedido.motivo_rejeicao_financeira || 'Sem motivo'}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={async () => {
                                  const pedidos = await base44.entities.PedidoCompra.filter({ id: pedido.id });
                                  setSelectedPedido(pedidos[0]);
                                  setShowPedidoDetails(true);
                                }}
                                title="Ver Detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {activeTab === 'pendentes' && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleReject(pedido)}
                                    title="Rejeitar"
                                  >
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  </Button>
                                  <Button 
                                    size="icon"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => handleApprove(pedido)}
                                    title="Aprovar"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </P38TableShell>

              <P38MobileLineList className="desktop-layout:hidden">
                {filteredPedidos.map((pedido, index) => {
                  const statusLabel =
                    activeTab === 'aprovados' ? 'Aprovado' : activeTab === 'rejeitados' ? 'Rejeitado' : 'Pendente';
                  const tone = p38StatusTone(statusLabel);
                  return (
                    <P38MobileLine
                      key={pedido.id}
                      striped={index % 2 === 1}
                      accent={p38AccentKeyFromTone(tone)}
                      title={pedido.numero}
                      subtitle={pedido.fornecedor_nome}
                      meta={
                        <>
                          <P38StatusLabel tone={tone}>{statusLabel}</P38StatusLabel>
                          <span>{pedido.itens?.length || 0} itens</span>
                          {activeTab === 'aprovados' && pedido.data_aprovacao_financeira && (
                            <span className="tabular-nums">
                              {format(new Date(pedido.data_aprovacao_financeira), 'dd/MM/yyyy HH:mm')}
                            </span>
                          )}
                          {activeTab === 'rejeitados' && (
                            <span className="truncate max-w-[12rem]">
                              {pedido.motivo_rejeicao_financeira || 'Sem motivo'}
                            </span>
                          )}
                        </>
                      }
                      value={formatCurrency(calcValorTotalPedidoCompra(pedido))}
                      trailing={
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              const pedidos = await base44.entities.PedidoCompra.filter({ id: pedido.id });
                              setSelectedPedido(pedidos[0]);
                              setShowPedidoDetails(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {activeTab === 'pendentes' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReject(pedido)}>
                                <XCircle className="w-4 h-4 text-red-600" />
                              </Button>
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={() => handleApprove(pedido)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </P38MobileLineList>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTransaction && !isRejectDialogOpen} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="dark:bg-muted border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Aprovar Pagamento
            </DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-6 py-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-foreground/90 font-medium mb-1">
                      {selectedTransaction.numero}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Pedido de compra com {selectedTransaction.itens?.length || 0} itens
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Fornecedor</div>
                  <div className="text-sm font-medium text-foreground">
                    {selectedTransaction.fornecedor_nome}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Criado em</div>
                  <div className="text-sm font-medium text-foreground">
                    {selectedTransaction.created_date ? format(new Date(selectedTransaction.created_date), 'dd/MM/yyyy') : '-'}
                  </div>
                </div>
              </div>

              <div className="bg-muted dark:bg-muted rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Valor Total</div>
                <div className="text-3xl font-bold text-foreground">
                  {formatCurrency(calcValorTotalPedidoCompra(selectedTransaction))}
                </div>
              </div>

              <div>
                <Label className="text-sm text-foreground/90 mb-2 block">
                  Conta de Pagamento *
                </Label>
                <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger className="bg-muted/40 dark:bg-muted border-0 shadow-sm">
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted border-0 shadow-lg">
                    {contas.map(conta => (
                      <SelectItem key={conta.id} value={conta.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{conta.nome}</span>
                          <span className="text-xs text-muted-foreground ml-3">
                            {formatCurrency(conta.saldo_atual)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelectedTransaction(null)}
              className="border-0 shadow-sm"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleInitiateApproval}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!contaSelecionada}
            >
              Autenticar e Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="dark:bg-muted border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Rejeitar Pagamento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground/90 font-medium mb-1">
                    Feedback para o setor de compras
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Informe o motivo da rejeição para futuras reuniões de alinhamento
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-foreground/90 mb-2 block">
                Motivo da Rejeição *
              </Label>
              <Textarea 
                placeholder="Ex: Orçamento ultrapassado, fornecedor não homologado, prazo incompatível..."
                className="bg-muted/40 dark:bg-muted border-0 shadow-sm resize-none"
                rows={4}
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsRejectDialogOpen(false);
                setMotivoRejeicao('');
              }}
              className="border-0 shadow-sm"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmReject}
              variant="destructive"
              disabled={!motivoRejeicao.trim()}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isMobile && selectedPedido && showPedidoDetails && activeTab === 'pendentes' ? (
        <AprovacaoPedidoMobile
          pedido={selectedPedido}
          contas={contas}
          onApprove={(pedido, contaId) => {
            setShowPedidoDetails(false);
            setSelectedPedido(null);
            void runOperacaoAuthBypass((authData) =>
              handleAuthSuccess(authData, 'approve', { pedido, contaId })
            );
          }}
          onReject={(pedido, motivo) => {
            setShowPedidoDetails(false);
            setSelectedPedido(null);
            void runOperacaoAuthBypass((authData) =>
              handleAuthSuccess(authData, 'reject', { pedido, motivo })
            );
          }}
          onClose={() => {
            setShowPedidoDetails(false);
            setSelectedPedido(null);
          }}
        />
      ) : showPedidoDetails && selectedPedido ? (
        <Dialog open={showPedidoDetails} onOpenChange={setShowPedidoDetails}>
          <PedidoCompraForm 
            pedido={selectedPedido}
            onClose={() => {
              setShowPedidoDetails(false);
              setSelectedPedido(null);
            }}
            onSave={async () => {
              setShowPedidoDetails(false);
              setSelectedPedido(null);
            }}
          />
        </Dialog>
      ) : null}

      {/* Solicitações de Edição */}
      {solicitacoesEdicao.length > 0 && (
        <div className="mt-8 pt-8 border-t-2 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <h2 className="text-xl font-medium text-foreground">Solicitações de Edição</h2>
          </div>

          <P38MobileLineList>
            {solicitacoesEdicao.map((pedido, index) => (
              <P38MobileLine
                key={pedido.id}
                striped={index % 2 === 1}
                accent="warning"
                title={pedido.numero}
                subtitle={pedido.solicitacao_edicao_solicitante}
                meta={
                  <>
                    <P38StatusLabel tone="warning">Edição solicitada</P38StatusLabel>
                    <span className="tabular-nums">
                      {pedido.solicitacao_edicao_data
                        ? format(new Date(pedido.solicitacao_edicao_data), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </span>
                    <span className="truncate max-w-[14rem]">{pedido.solicitacao_edicao_motivo}</span>
                  </>
                }
                trailing={
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={async () => {
                        const pedidos = await base44.entities.PedidoCompra.filter({ id: pedido.id });
                        setSelectedPedido(pedidos[0]);
                        setShowPedidoDetails(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => {
                        setSelectedSolicitacao(pedido);
                        void runOperacaoAuthBypass((authData) => handleLiberarEdicao(authData, pedido));
                      }}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                }
              />
            ))}
          </P38MobileLineList>
        </div>
      )}

      {/* Dialog de Autenticação para Liberar Edição */}
    </div>
  );
}