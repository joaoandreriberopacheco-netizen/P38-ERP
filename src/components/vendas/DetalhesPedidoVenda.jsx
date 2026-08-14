import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from '@/api/base44Client';
import { 
  Receipt, 
  User, 
  Calendar, 
  DollarSign, 
  CreditCard,
  Package,
  Truck,
  FileText,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Hash,
  Clock,
  ShoppingBag,
  Banknote,
  ArrowLeft,
  MoreVertical,
  Share2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ComprovantePreVenda from '@/components/vendas/ComprovantePreVenda';
import ComprovanteCompra from '@/components/vendas/ComprovanteCompra';
import { formatarDataHora, formatarSoData } from '@/components/utils/dateUtils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  P38TableShell,
} from '@/components/ui/table';
import { P38MobileLineList, P38MobileLine } from '@/components/ui/p38-mobile-line';
import { formatCommercialQuantity, getUnidadeMedidaItemPedidoVenda } from '@/lib/productUnits';
import {
  calcularValoresCartao,
  isCartaoForma,
  resolveValorLiquidoPagamento,
} from '@/lib/pagamentoPedidoVendaFinanceiro';
const fmtDtHora = (d) => d ? formatarDataHora(d) : 'N/A';
const fmtData = (d) => d ? formatarSoData(d) : '-';

export default function DetalhesPedidoVenda({ pedido, isOpen, onClose }) {
  const [lancamentosFinanceiros, setLancamentosFinanceiros] = useState([]);
  const [movimentosEstoque, setMovimentosEstoque] = useState([]);
  const [showComprovante, setShowComprovante] = useState(false);

  useEffect(() => {
    if (pedido && isOpen) {
      loadDadosAdicionais();
    }
  }, [pedido, isOpen]);

  const loadDadosAdicionais = async () => {
    try {
      const lancamentos = await base44.entities.LancamentoFinanceiro.filter({
        referencia_id: pedido.id,
        referencia_tipo: 'PedidoVenda'
      });
      setLancamentosFinanceiros(lancamentos);

      const movimentos = await base44.entities.MovimentacaoEstoque.filter({
        referencia_id: pedido.id,
        referencia_tipo: 'PedidoVenda'
      });
      setMovimentosEstoque(movimentos);
    } catch (error) {
      console.error('Erro ao carregar dados adicionais:', error);
    }
  };

  if (!pedido) return null;

  const formatValor = (valor) => {
    return `R$ ${(Math.round((valor || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatItemQuantidade = (item) => {
    const unidade = getUnidadeMedidaItemPedidoVenda(item);
    return {
      unidade,
      quantidade: formatCommercialQuantity(item.quantidade, unidade),
    };
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Orçamento': 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90',
      'Aguardando Aprovação': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'Aguardando Pagamento': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'Aguardando Caixa': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Aprovado': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      'Aguardando Retirada': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'Envio Agendado': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      'Finalizado': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Cancelado': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    return statusMap[status] || 'bg-muted text-foreground/90';
  };

  const handleCompartilhar = () => {
    setShowComprovante(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-0 p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card p-4 md:p-6 border-b border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-lg font-medium text-foreground">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <span>Detalhes do Pedido</span>
                  <p className="text-sm font-normal text-muted-foreground">{pedido.numero}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pedido.status === 'Pedido Concluído' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="dark:bg-muted">
                      <DropdownMenuItem onClick={handleCompartilhar}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Compartilhar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  onClick={onClose}
                  className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Cabeçalho Info - Grid Responsivo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <Hash className="w-3 h-3" />
                Número
              </div>
              <div className="text-base md:text-lg font-semibold text-foreground">{pedido.numero}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <Clock className="w-3 h-3" />
                Status
              </div>
              <Badge className={`${getStatusBadge(pedido.status)} text-xs font-medium`}>
                {pedido.status}
              </Badge>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <Calendar className="w-3 h-3" />
                Data/Hora
              </div>
              <div className="text-sm md:text-base font-medium text-foreground/90">
                {fmtDtHora(pedido.created_date)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <DollarSign className="w-3 h-3" />
                Valor Total
              </div>
              <div className="text-lg md:text-xl font-semibold text-foreground">{formatValor(pedido.valor_total)}</div>
            </div>
          </div>

          {/* Segunda linha de info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pb-4 border-b border-border/40">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <User className="w-3 h-3" />
                Cliente
              </div>
              <div className="text-sm md:text-base font-medium text-foreground/90">{pedido.cliente_nome || 'Não informado'}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <User className="w-3 h-3" />
                Vendedor
              </div>
              <div className="text-sm md:text-base font-medium text-foreground/90">{pedido.vendedor_nome || 'Não informado'}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <ShoppingBag className="w-3 h-3" />
                Tipo
              </div>
              <div className="text-sm md:text-base font-medium text-foreground/90">{pedido.tipo || 'PDV'}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                <Truck className="w-3 h-3" />
                Entrega
              </div>
              <div className="text-sm md:text-base font-medium text-foreground/90">{pedido.metodo_entrega || 'N/A'}</div>
            </div>
          </div>

          {/* Abas */}
          <Tabs defaultValue="detalhes" className="w-full">
            <TabsList className="w-full bg-transparent border-b border-border/40 rounded-none h-auto p-0 mb-6">
              <div className="flex w-full">
                <TabsTrigger 
                  value="detalhes" 
                  className="flex-1 flex items-center justify-center gap-2 border-b-2 border-transparent data-[state=active]:border-border/40 dark:data-[state=active]:border-border/40 rounded-none py-4 md:py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[48px]"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="hidden md:inline text-sm font-normal text-muted-foreground">Detalhes</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="financeiro"
                  className="flex-1 flex items-center justify-center gap-2 border-b-2 border-transparent data-[state=active]:border-border/40 dark:data-[state=active]:border-border/40 rounded-none py-4 md:py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[48px]"
                >
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="hidden md:inline text-sm font-normal text-muted-foreground">Financeiro</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="estoque"
                  className="flex-1 flex items-center justify-center gap-2 border-b-2 border-transparent data-[state=active]:border-border/40 dark:data-[state=active]:border-border/40 rounded-none py-4 md:py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[48px]"
                >
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="hidden md:inline text-sm font-normal text-muted-foreground">Estoque</span>
                </TabsTrigger>
              </div>
            </TabsList>

            {/* ABA: DETALHES */}
            <TabsContent value="detalhes" className="space-y-6 mt-0">
              {/* Itens do Pedido */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Itens do Pedido</h3>
                </div>
                
                {/* Desktop Table */}
                <P38TableShell className="hidden desktop-layout:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.itens && pedido.itens.length > 0 ? (
                        pedido.itens.map((item, idx) => {
                          const { quantidade, unidade } = formatItemQuantidade(item);
                          return (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-medium">{item.produto_nome}</div>
                              <div className="text-xs text-muted-foreground font-mono">{item.produto_id?.substring(0, 8) || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right">{quantidade} {unidade}</TableCell>
                            <TableCell className="text-right">{formatValor(item.preco_unitario_praticado)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatValor(item.total)}</TableCell>
                          </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum item cadastrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </P38TableShell>

                {/* Mobile List */}
                {pedido.itens && pedido.itens.length > 0 ? (
                  <P38MobileLineList>
                    {pedido.itens.map((item, idx) => {
                      const { quantidade, unidade } = formatItemQuantidade(item);
                      return (
                      <P38MobileLine
                        key={idx}
                        striped={idx % 2 === 1}
                        title={item.produto_nome}
                        subtitle={item.produto_id?.substring(0, 8) || '-'}
                        meta={<span>{quantidade} {unidade} × {formatValor(item.preco_unitario_praticado)}</span>}
                        value={formatValor(item.total)}
                      />
                      );
                    })}
                  </P38MobileLineList>
                ) : (
                  <div className="desktop-layout:hidden p-8 text-center text-muted-foreground">
                    Nenhum item cadastrado
                  </div>
                )}
              </div>

              {/* Resumo de Valores */}
              <div className="bg-card p-4 md:p-6 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-sm md:text-base">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground/90">{formatValor(pedido.subtotal || pedido.valor_total)}</span>
                </div>
                {pedido.valor_desconto > 0 && (
                  <div className="flex justify-between items-center text-sm md:text-base">
                    <span className="text-red-600 dark:text-red-400">Desconto</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{formatValor(pedido.valor_desconto)}</span>
                  </div>
                )}
                {pedido.valor_frete > 0 && (
                  <div className="flex justify-between items-center text-sm md:text-base">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="font-medium text-foreground/90">{formatValor(pedido.valor_frete)}</span>
                  </div>
                )}
                <div className="border-t border-border/40 pt-3 flex justify-between items-center">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-xl md:text-2xl font-semibold text-foreground">{formatValor(pedido.valor_total)}</span>
                </div>
              </div>

              {/* Observações */}
              {pedido.observacoes && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Observações</h3>
                  </div>
                  <div className="bg-card p-4 rounded-xl">
                    <p className="text-sm text-foreground/90">{pedido.observacoes}</p>
                  </div>
                </div>
              )}

              {pedido.historico && String(pedido.historico).trim() !== '' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">
                      Histórico do pedido
                    </h3>
                  </div>
                  <div className="bg-card p-4 rounded-xl max-h-48 overflow-y-auto">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                      {pedido.historico}
                    </pre>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ABA: FINANCEIRO */}
            <TabsContent value="financeiro" className="space-y-6 mt-0">
              {/* Formas de Pagamento */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Formas de Pagamento</h3>
                </div>
                
                {pedido.pagamentos && pedido.pagamentos.length > 0 ? (
                  <div className="space-y-3">
                    {pedido.pagamentos.map((pag, idx) => {
                      const valorNominal = Number(pag.valor || 0);
                      const valorLiquido = resolveValorLiquidoPagamento(pag);
                      const mostraLiquido = isCartaoForma(pag.forma_pagamento) && valorLiquido !== valorNominal;
                      const tarifa = mostraLiquido
                        ? calcularValoresCartao(valorNominal, pag.taxa_maquininha || 0).tarifa
                        : 0;
                      return (
                      <div key={idx} className="bg-card p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {pag.forma_pagamento?.includes('Cartão') ? (
                              <CreditCard className="w-5 h-5 text-muted-foreground" />
                            ) : pag.forma_pagamento === 'PIX' ? (
                              <DollarSign className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <Banknote className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{pag.forma_pagamento}</div>
                            <div className="text-xs text-muted-foreground">
                              {pag.parcelas > 1 ? `${pag.parcelas}x` : 'À vista'}
                              {pag.taxa_pagamento ? ` • Taxa: ${pag.taxa_pagamento}%` : ''}
                              {pag.taxa_maquininha != null && pag.taxa_maquininha > 0
                                ? ` • Taxa maq.: ${pag.taxa_maquininha}%`
                                : ''}
                              {pag.maquininha_nome ? ` • ${pag.maquininha_nome}` : ''}
                              {pag.bandeira ? ` · ${pag.bandeira}` : ''}
                            </div>
                            {mostraLiquido && (
                              <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                Nominal (comprovante): {formatValor(valorNominal)} · Líquido empresa: {formatValor(valorLiquido)}
                                {tarifa > 0 ? ` · Tarifa ~${formatValor(tarifa)}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground">{formatValor(valorNominal)}</div>
                          {mostraLiquido && (
                            <div className="text-xs text-muted-foreground">Líq. empresa: {formatValor(valorLiquido)}</div>
                          )}
                        </div>
                      </div>
                    );})}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-card rounded-xl">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhuma forma de pagamento registrada</p>
                  </div>
                )}
              </div>

              {/* Lançamentos Financeiros */}
              {lancamentosFinanceiros.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Lançamentos Financeiros</h3>
                  </div>
                  <div className="space-y-3">
                    {lancamentosFinanceiros.map((lanc) => (
                      <div key={lanc.id} className="bg-card p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{lanc.descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            Venc: {fmtData(lanc.data_vencimento)}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <Badge className={lanc.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                            {lanc.status}
                          </Badge>
                          <span className="font-semibold text-foreground">{formatValor(lanc.valor)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lancamentosFinanceiros.length === 0 && (!pedido.pagamentos || pedido.pagamentos.length === 0) && (
                <div className="py-12 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma informação financeira disponível</p>
                </div>
              )}
            </TabsContent>

            {/* ABA: ESTOQUE */}
            <TabsContent value="estoque" className="space-y-6 mt-0">
              {/* Status de Entrega */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Status de Entrega</h3>
                </div>
                <div className="space-y-3">
                  {pedido.itens && pedido.itens.map((item, idx) => {
                    const { quantidade, unidade } = formatItemQuantidade(item);
                    return (
                  <div key={idx} className="bg-card p-4 md:p-4 rounded-xl flex items-center justify-between min-h-[64px]">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{item.produto_nome}</div>
                      <div className="text-sm text-muted-foreground">Qtd: {quantidade} {unidade}</div>
                    </div>
                    {pedido.status === 'Finalizado' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 px-3 py-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Entregue
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  );
                  })}
                </div>
              </div>

              {/* Movimentações de Estoque */}
              {movimentosEstoque.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-foreground/90 uppercase tracking-wide">Movimentações de Estoque</h3>
                  </div>
                  <div className="space-y-3">
                    {movimentosEstoque.map((mov) => (
                      <div key={mov.id} className="bg-card p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{mov.produto_nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {fmtDtHora(mov.created_date)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={mov.tipo === 'Saída' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>
                            {mov.tipo}
                          </Badge>
                          <span className="font-semibold text-foreground">{mov.quantidade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {movimentosEstoque.length === 0 && (
                <div className="py-12 text-center bg-card rounded-xl">
                  <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma movimentação de estoque registrada</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Dialog de Impressão */}
      {showComprovante && (
        pedido.tipo === 'Pedido' ? (
          <ComprovantePreVenda
            preVenda={pedido}
            open={showComprovante}
            onClose={() => setShowComprovante(false)}
          />
        ) : (
          <ComprovanteCompra
            pedido={pedido}
            open={showComprovante}
            onClose={() => setShowComprovante(false)}
          />
        )
      )}
    </Dialog>
  );
}