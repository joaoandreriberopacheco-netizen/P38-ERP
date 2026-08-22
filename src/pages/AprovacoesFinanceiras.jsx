import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle, XCircle, Eye, DollarSign, ArrowUpRight, ArrowDownLeft, Clock, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { calcValorTotalPedidoCompra, listarLancamentosPedidoCompra, pedidoPrecisaSincronizarAprovacaoFinanceira } from '@/lib/pedidoCompraFinanceiro';
import {
  aprovarPedidoCompraFinanceiro,
  pedidoAguardandoAprovacaoFinanceira,
  sincronizarPedidoCompraAprovacaoFinanceira,
} from '@/lib/aprovarPedidoCompraFinanceiro';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

export default function AprovacoesFinanceirasPage() {
  const navigate = useNavigate();
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [contas, setContas] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedPedidosIds, setSelectedPedidosIds] = useState([]);
  const [modoSelecaoLote, setModoSelecaoLote] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [showHistorico, setShowHistorico] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pedidosLiberacao, pedidosAprovacaoFinanceira, pedidosPorSaf, contasData] = await Promise.all([
      base44.entities.PedidoCompra.filter({ status: 'Aguardando Liberação' }),
      base44.entities.PedidoCompra.filter({ status: 'Aguardando Aprovação Financeira' }),
      base44.entities.PedidoCompra.filter({ status_aprovacao_financeira: 'Aguardando Aprovação Financeira' }),
      base44.entities.ContasFinanceiras.filter({ ativo: true }),
    ]);

    const pedidosPorId = new Map();
    [...pedidosLiberacao, ...pedidosAprovacaoFinanceira, ...pedidosPorSaf].forEach((p) => {
      if (p?.id) pedidosPorId.set(p.id, p);
    });

    const pedidosPendentes = [];
    for (const p of pedidosPorId.values()) {
      const lancs = await listarLancamentosPedidoCompra(base44, p.id);
      if (pedidoAguardandoAprovacaoFinanceira(p, lancs)) {
        pedidosPendentes.push(p);
      } else if (pedidoPrecisaSincronizarAprovacaoFinanceira(p, lancs)) {
        await sincronizarPedidoCompraAprovacaoFinanceira({ base44, pedido: p, lancamentos: lancs });
      }
    }
    const adaptados = pedidosPendentes.map(p => ({
      id: p.id,
      referencia_id: p.id,
      referencia_tipo: 'PedidoCompra',
      referencia_numero: p.numero,
      descricao: `Compra - ${p.fornecedor_nome}`,
      valor: calcValorTotalPedidoCompra(p),
      status: p.status,
      _pedido: p,
    }));
    setPendingTransactions(adaptados);
    setContas(contasData);
  };

  const loadHistorico = async () => {
    setLoadingHistorico(true);
    try {
      // Busca pedidos aprovados recentemente
      const aprovados = await base44.entities.PedidoCompra.filter({ status: 'Aprovado' });
      const cancelados = await base44.entities.PedidoCompra.filter({ status: 'Cancelado' });
      const todos = [...aprovados, ...cancelados]
        .sort((a, b) => new Date(b.data_aprovacao_financeira || b.updated_date) - new Date(a.data_aprovacao_financeira || a.updated_date))
        .slice(0, 30);
      setHistorico(todos);
    } catch (e) {
      console.error(e);
    }
    setLoadingHistorico(false);
  };

  const handleViewPedido = (transaction) => {
    if (transaction.referencia_tipo === 'PedidoCompra' && transaction.referencia_id) {
      navigate(`/PedidoCompraDetalhe?id=${transaction.referencia_id}&tab=pagamento`);
    }
  };

  const handleTogglePedidoLote = (pedidoId) => {
    setSelectedPedidosIds((prev) => prev.includes(pedidoId)
      ? prev.filter((id) => id !== pedidoId)
      : [...prev, pedidoId]);
  };

  const handleInitiateApproval = () => {
    if (!contaSelecionada) {
      alert('Selecione uma conta para realizar o pagamento.');
      return;
    }
    if (!selectedTransaction?._pedido) {
      toast({
        title: 'Erro',
        description: 'Pedido não encontrado para aprovar.',
        variant: 'destructive',
      });
      return;
    }
    const pedidoSnapshot = selectedTransaction._pedido;
    const contaSnapshot = contaSelecionada;
    void runOperacaoAuthBypass((authData) =>
      handleAuthSuccess(authData, 'approve', { pedidos: [pedidoSnapshot], contaId: contaSnapshot })
    );
  };

  const handleInitiateBatchApproval = () => {
    if (!selectedPedidosIds.length) {
      alert('Selecione ao menos um pedido para aprovar em lote.');
      return;
    }
    if (!contaSelecionada) {
      alert('Selecione uma conta para realizar o pagamento.');
      return;
    }
    const idsSnapshot = [...selectedPedidosIds];
    const pedidosSnapshot = pendingTransactions
      .filter((item) => idsSnapshot.includes(item.id))
      .map((item) => item._pedido)
      .filter(Boolean);
    const contaSnapshot = contaSelecionada;
    void runOperacaoAuthBypass((authData) =>
      handleAuthSuccess(authData, 'approve_batch', { pedidos: pedidosSnapshot, contaId: contaSnapshot })
    );
  };

  const handleAuthSuccess = async (authData, tipoAcao, opts = {}) => {
    const { pedidos: pedidosOverride, contaId: contaIdOverride } = opts;
    setIsProcessingApproval(true);

    const pedidosParaAprovar = Array.isArray(pedidosOverride) && pedidosOverride.length > 0
      ? pedidosOverride
      : [];

    const contaId = contaIdOverride ?? contaSelecionada;

    try {
      if (tipoAcao === 'approve' || tipoAcao === 'approve_batch') {
        if (!contaId || pedidosParaAprovar.length === 0) {
          toast({
            title: 'Erro',
            description: 'Dados incompletos para concluir a aprovação.',
            variant: 'destructive',
          });
          return;
        }

        const contaSelecionadaNome = contas.find(c => c.id === contaId)?.nome || '';
        let aprovadosOk = 0;
        let aprovadosErro = 0;
        let ultimoErro = null;

        for (const pedido of pedidosParaAprovar) {
          try {
            await aprovarPedidoCompraFinanceiro({
              base44,
              pedido,
              contaId,
              contaNome: contaSelecionadaNome,
              authData,
            });
            aprovadosOk += 1;
          } catch (itemError) {
            console.error('[AprovacoesFinanceiras] falha no pedido', pedido?.numero || pedido?.id, itemError);
            aprovadosErro += 1;
            ultimoErro = itemError;
          }
        }

        if (aprovadosErro === 0) {
          toast({
            title: aprovadosOk > 1 ? 'Pedidos aprovados' : 'Pedido aprovado',
            description: aprovadosOk > 1
              ? `${aprovadosOk} pedidos aprovados com sucesso.`
              : 'Aprovação financeira concluída.',
          });
        } else if (aprovadosOk === 0) {
          throw ultimoErro || new Error('Nenhum pedido foi aprovado.');
        } else {
          toast({
            title: 'Aprovação parcial',
            description: `${aprovadosOk} aprovado(s), ${aprovadosErro} com erro. ${ultimoErro?.message || 'Verifique os pedidos pendentes.'}`,
            variant: 'destructive',
          });
        }
      }

      await loadData();
      setSelectedTransaction(null);
      setSelectedPedidosIds([]);
      setModoSelecaoLote(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro na aprovação',
        description: error?.message || 'Não foi possível concluir. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const groupedTransactions = pendingTransactions.reduce((acc, t) => {
    const key = t.referencia_numero || t.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const pedidosSelecionadosLote = useMemo(
    () => pendingTransactions.filter((item) => selectedPedidosIds.includes(item.id)),
    [pendingTransactions, selectedPedidosIds]
  );

  const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => { try { return format(new Date(d), 'dd/MM/yy HH:mm', { locale: ptBR }); } catch { return '-'; } };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-glacial">
              Aprovações Financeiras
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {Object.keys(groupedTransactions).length} pendente{Object.keys(groupedTransactions).length !== 1 ? 's' : ''}
              {' · '}
              <span className="text-teal-600 dark:text-teal-400">Toque no olho para aprovar na aba Financeiro do pedido</span>
            </p>
          </div>
          <Button
            data-pulse-sensor="aprovacoes-financeiras.aprovar-lote"
            variant="ghost"
            onClick={() => {
              setModoSelecaoLote((prev) => !prev);
              setSelectedPedidosIds([]);
            }}
            className="rounded-2xl"
          >
            {modoSelecaoLote ? 'Cancelar lote' : 'Aprovar em lote'}
          </Button>
        </div>

        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="bg-card rounded-3xl p-12 text-center shadow-sm">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-base font-medium text-muted-foreground">
              Nenhuma aprovação pendente
            </p>
          </div>
        ) : (
          <P38MobileLineList allViewports>
            {Object.entries(groupedTransactions).map(([refNumero, transacoes], index) => {
              const primeira = transacoes[0];
              const total = primeira.valor || 0;
              const tone = p38StatusTone('pendente');
              return (
                <P38MobileLine
                  key={refNumero}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(tone)}
                  title={refNumero}
                  subtitle={primeira.descricao}
                  meta={
                    <>
                      <P38StatusLabel tone={tone}>Pendente</P38StatusLabel>
                      {primeira._pedido?.fornecedor_nome ? (
                        <span className="truncate">{primeira._pedido.fornecedor_nome}</span>
                      ) : null}
                    </>
                  }
                  value={formatCurrency(total)}
                  trailing={
                    <div className="flex flex-col gap-1 shrink-0">
                      {modoSelecaoLote && (
                        <button
                          type="button"
                          onClick={() => handleTogglePedidoLote(primeira.id)}
                          className={`h-5 w-5 rounded-full transition-colors ${selectedPedidosIds.includes(primeira.id) ? 'bg-emerald-600' : 'bg-muted'}`}
                        />
                      )}
                      {primeira.referencia_tipo === 'PedidoCompra' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewPedido(primeira)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {!modoSelecaoLote && (
                        <Button
                          size="icon"
                          className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setSelectedTransaction(primeira)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  }
                />
              );
            })}
          </P38MobileLineList>
        )}

        {modoSelecaoLote && (
          <div className="bg-card rounded-3xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Aprovação em lote</p>
                <p className="text-xs text-muted-foreground">{pedidosSelecionadosLote.length} pedido(s) selecionado(s)</p>
              </div>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(pedidosSelecionadosLote.reduce((acc, item) => acc + (item.valor || 0), 0))}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 dark:bg-muted/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo do lançamento</p>
                <p className="mt-1 text-sm font-medium text-foreground">Despesa CMV automática</p>
                <p className="mt-1 text-xs text-muted-foreground">Pedidos aprovados no financeiro geram contas de compra como custo de mercadoria vendida.</p>
              </div>
              <div>
                <Label>Conta para Pagamento</Label>
                <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInitiateBatchApproval} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!pedidosSelecionadosLote.length}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirmar lote
              </Button>
            </div>
          </div>
        )}

        {/* Modal de aprovação */}
        {selectedTransaction && (
          <Dialog open={!!selectedTransaction} onOpenChange={() => { setSelectedTransaction(null); }}>
            <DialogContent className="dark:bg-muted">
              <DialogHeader>
                <p className="font-semibold text-lg">Aprovar Pagamento</p>
                </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-2xl bg-muted/40 dark:bg-muted/60 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo do lançamento</p>
                  <p className="mt-1 text-sm font-medium text-foreground">Despesa CMV automática</p>
                  <p className="mt-1 text-xs text-muted-foreground">Este pagamento de compra será salvo como custo de mercadoria vendida.</p>
                </div>
                <div>
                  <Label>Conta para Pagamento</Label>
                  <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Cancelar</Button>
                <Button onClick={handleInitiateApproval} className="bg-emerald-600">Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {isProcessingApproval && (
          <div className="fixed inset-0 z-[70] bg-card/80 dark:bg-background/80 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="bg-card shadow-xl rounded-3xl px-6 py-7 flex flex-col items-center gap-3 max-w-xs w-full text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground font-glacial">Processando aprovação</p>
                <p className="text-sm text-muted-foreground mt-1">Aguarde para evitar confirmações acidentais.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAB Histórico */}
      <button
        onClick={() => { setShowHistorico(true); loadHistorico(); }}
        className="fixed right-6 z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-xl dark:bg-muted p38-bottom-fab1 lg:bottom-8"
        title="Histórico de aprovações"
      >
        <Clock className="w-5 h-5" />
      </button>

      {/* Sheet de Histórico */}
      {showHistorico && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowHistorico(false)} />
          <div className="relative w-full max-w-lg bg-card rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Histórico de Aprovações
              </h2>
              <button onClick={() => setShowHistorico(false)} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingHistorico && <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>}
              {!loadingHistorico && historico.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</div>
              )}
              {historico.map(p => (
                <div key={p.id} className="flex items-start justify-between p-3 rounded-xl bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.numero}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.fornecedor_nome}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {p.data_aprovacao_financeira ? fmtDate(p.data_aprovacao_financeira) : fmtDate(p.updated_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-semibold text-foreground dark:text-foreground">
                      R$ {calcValorTotalPedidoCompra(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      p.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}