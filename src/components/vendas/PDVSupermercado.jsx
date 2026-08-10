import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Produto } from '@/entities/Produto';
import { Terceiro } from '@/entities/Terceiro';
import { TabelaPreco } from '@/entities/TabelaPreco';
import { User } from '@/entities/User';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, ShoppingCart, Trash2, UserPlus, ArrowRight, Barcode, Camera, CreditCard, Banknote, Smartphone, CheckCircle2, Plus, Minus, X, AlertCircle, Package } from 'lucide-react';
import SimuladorCartaoSheet from '@/components/vendas/SimuladorCartaoSheet';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BarcodeScanner from './BarcodeScanner';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnsavedChangesWarning } from '@/components/utils/useUnsavedChangesWarning';
import { calculateBaseQuantity, getItemUnitKey, pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { productCodesMatch } from '@/lib/productCode';
import { isVendaSemEstoquePermitida } from '@/lib/configFlags';
import { selectAllOnFocus, focusAndSelect, selectAllOnMouseDown } from '@/lib/inputFocusUtils';

export default function PDVSupermercado() {
  const [carrinho, setCarrinho] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtosSugeridos, setProdutosSugeridos] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tabelaPreco, setTabelaPreco] = useState(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientes, setClientes] = useState([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showSimuladorTaxa, setShowSimuladorTaxa] = useState(false);

  // Product Entry States (Matching PDVVendedor)
  const [quantidadeAtual, setQuantidadeAtual] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [produtoSelecionadoIndex, setProdutoSelecionadoIndex] = useState(0);
  const [configVenda, setConfigVenda] = useState(null);
  const [configEstoque, setConfigEstoque] = useState(null);
  const vendaSemEstoquePermitida = useMemo(
    () => isVendaSemEstoquePermitida(configVenda, configEstoque),
    [configVenda, configEstoque]
  );

  // Payment States
  const [pagamentosDinheiro, setPagamentosDinheiro] = useState(0);
  const [pagamentosPix, setPagamentosPix] = useState(0);
  const [pagamentosDebito, setPagamentosDebito] = useState(0);
  const [pagamentosCredito, setPagamentosCredito] = useState(0);
  const [parcelasCredito, setParcelasCredito] = useState(1);
  const [formaPagamentoAtiva, setFormaPagamentoAtiva] = useState(0);
  
  const [inputDinheiro, setInputDinheiro] = useState('');
  const [inputPix, setInputPix] = useState('');
  const [inputDebito, setInputDebito] = useState('');
  const [inputCredito, setInputCredito] = useState('');

  const inputProdutoRef = useRef(null);
  const quantidadeInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  const inputRefs = {
    dinheiro: useRef(null),
    pix: useRef(null),
    debito: useRef(null),
    credito: useRef(null)
  };

  const { toast } = useToast();
  useUnsavedChangesWarning(carrinho.length > 0);

  const totalCarrinho = useMemo(() => carrinho.reduce((acc, item) => acc + item.total, 0), [carrinho]);
  const totalPago = pagamentosDinheiro + pagamentosPix + pagamentosDebito + pagamentosCredito;
  const valorRestante = Math.max(0, totalCarrinho - totalPago);
  const troco = Math.max(0, totalPago - totalCarrinho);
  const pagamentoValido = totalPago >= totalCarrinho && totalCarrinho > 0;

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    if (inputProdutoRef.current && !showPaymentDialog && !showClienteDialog && !produtoSelecionado) {
      inputProdutoRef.current.focus();
    }
  }, [carrinho, showPaymentDialog, showClienteDialog, produtoSelecionado]);

  // Keyboard Navigation for Suggestions
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (showSuggestions && produtosSugeridos.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setProdutoSelecionadoIndex(prev =>
            prev < produtosSugeridos.length - 1 ? prev + 1 : 0
          );
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setProdutoSelecionadoIndex(prev =>
            prev > 0 ? prev - 1 : produtosSugeridos.length - 1
          );
        }
        if (e.key === 'Enter' && document.activeElement === inputProdutoRef.current) {
          e.preventDefault();
          if (produtosSugeridos[produtoSelecionadoIndex]) {
            handleSelecionarProduto(produtosSugeridos[produtoSelecionadoIndex]);
          }
        }
      }
      
      if (e.key === 'F3' && carrinho.length > 0 && !showPaymentDialog) {
        e.preventDefault();
        handlePaymentOpen();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSuggestions, produtosSugeridos, produtoSelecionadoIndex, carrinho, showPaymentDialog]);

  const loadDependencies = async () => {
    try {
      const [produtosData, userData, clientesData, configsVendas, configsEstoque] = await Promise.all([
        base44.entities.Produto.filter({ ativo: true }),
        base44.auth.me(),
        base44.entities.Terceiro.filter({ tipo: ['Cliente', 'Ambos'] }),
        base44.entities.ConfiguracoesVenda.list(),
        base44.entities.ConfiguracoesEstoque.list(),
      ]);
      setProdutos(produtosData);
      setCurrentUser(userData);
      setClientes(clientesData);
      if (configsVendas.length > 0) {
        setConfigVenda(configsVendas[0]);
      }
      if (configsEstoque.length > 0) {
        setConfigEstoque(configsEstoque[0]);
      }
      if (userData.tabela_preco_id) {
        const tabela = await TabelaPreco.get(userData.tabela_preco_id);
        setTabelaPreco(tabela);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Product Search Logic
  useEffect(() => {
    if (buscaProduto.trim().length >= 2) {
      setProdutosSugeridos(filterAndSortProducts(produtos, buscaProduto));
      setShowSuggestions(true);
      setProdutoSelecionadoIndex(0);
    } else {
      setProdutosSugeridos([]);
      setShowSuggestions(false);
    }
  }, [buscaProduto, produtos]);

  const handleSelecionarProduto = (produto) => {
    setProdutoSelecionado(produto);
    setBuscaProduto('');
    setShowSuggestions(false);
    setQuantidadeAtual('');
    setTimeout(() => quantidadeInputRef.current?.focus(), 100);
  };

  const handleConfirmarAdicao = () => {
    if (!produtoSelecionado) return;

    const quantidade = parseInt(quantidadeAtual) || 1;
    const defaultOpt = pickDefaultSaleUnit(produtoSelecionado, tabelaPreco?.fator_ajuste || 1) || {
      unidade: getUnidadeExibicaoSigla(produtoSelecionado),
      fator_conversao: 1,
      valor_unitario: (produtoSelecionado.preco_venda_padrao || 0) * (tabelaPreco?.fator_ajuste || 1)
    };
    const unidade = defaultOpt.unidade || produtoSelecionado.unidade_principal || 'UN';
    const fator = Number(defaultOpt.fator_conversao) || 1;
    const preco = Number(defaultOpt.valor_unitario ?? 0) || 0;
    const quantidadeBaseAdd = calculateBaseQuantity(quantidade, fator);
    const itemKey = getItemUnitKey(produtoSelecionado.id, unidade);
    
    if (!vendaSemEstoquePermitida && produtoSelecionado.estoque_atual < quantidadeBaseAdd) {
      toast({ title: `Estoque insuficiente: ${produtoSelecionado.estoque_atual} ${produtoSelecionado.unidade_principal || 'UN'} disponível`, variant: "destructive" });
      return;
    }
    const itemExistente = carrinho.find(i => (i.item_key || getItemUnitKey(i.produto_id, i.unidade_medida)) === itemKey);
    
    if (itemExistente) {
      setCarrinho(carrinho.map(i => (i.item_key || getItemUnitKey(i.produto_id, i.unidade_medida)) === itemKey
        ? { 
            ...i, 
            quantidade: i.quantidade + quantidade, 
            quantidade_base: calculateBaseQuantity(i.quantidade + quantidade, fator),
            total: (i.quantidade + quantidade) * preco 
          } 
        : i));
    } else {
      setCarrinho([...carrinho, {
        item_key: itemKey,
        produto_id: produtoSelecionado.id,
        produto_nome: produtoSelecionado.nome,
        codigo_interno: produtoSelecionado.codigo_interno,
        quantidade: quantidade,
        quantidade_base: quantidadeBaseAdd,
        unidade_medida: unidade,
        fator_conversao: fator,
        preco_unitario: preco,
        preco_unitario_praticado: preco,
        total: quantidade * preco,
        estoque_disponivel: produtoSelecionado.estoque_atual
      }]);
    }

    setProdutoSelecionado(null);
    setQuantidadeAtual('');
    inputProdutoRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && showSuggestions && produtosSugeridos.length > 0) {
      e.preventDefault();
      quantidadeInputRef.current?.focus();
    }
  };

  const handleQuantidadeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmarAdicao();
    }
  };

  const handlePaymentOpen = () => {
    if (carrinho.length === 0) return;
    setPagamentosDinheiro(totalCarrinho);
    setInputDinheiro(formatarValorExibicao(totalCarrinho));
    setPagamentosPix(0); setInputPix('0,00');
    setPagamentosDebito(0); setInputDebito('0,00');
    setPagamentosCredito(0); setInputCredito('0,00');
    setShowPaymentDialog(true);
  };

  const handleFinalizarVenda = async () => {
    if (!pagamentoValido) return;
    setIsProcessing(true);

    try {
      const pagamentos = [];
      if (pagamentosDinheiro > 0) pagamentos.push({ forma_pagamento: 'Dinheiro', valor: pagamentosDinheiro, parcelas: 1 });
      if (pagamentosPix > 0) pagamentos.push({ forma_pagamento: 'PIX', valor: pagamentosPix, parcelas: 1 });
      if (pagamentosDebito > 0) pagamentos.push({ forma_pagamento: 'Cartão de Débito', valor: pagamentosDebito, parcelas: 1 });
      if (pagamentosCredito > 0) pagamentos.push({ forma_pagamento: 'Cartão de Crédito', valor: pagamentosCredito, parcelas: parcelasCredito });

      const pedidoData = {
        tipo: 'PDV Supermercado',
        cliente_id: cliente?.id,
        cliente_nome: cliente?.nome || 'Consumidor Final',
        vendedor_id: currentUser.id,
        vendedor_nome: currentUser.full_name,
        status: 'Finalizado',
        itens: carrinho.map(item => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          quantidade_base: item.quantidade_base || item.quantidade,
          unidade_medida: item.unidade_medida || 'UN',
          fator_conversao: item.fator_conversao || 1,
          preco_unitario_praticado: item.preco_unitario_praticado,
          total: item.total
        })),
        valor_total: totalCarrinho,
        pagamentos: pagamentos,
        caixa_destino_id: currentUser.caixa_destino_id
      };

      const novoPedido = await base44.entities.PedidoVenda.create(pedidoData);
      
      // Criar movimentações de estoque para cada item vendido
      for (const item of carrinho) {
        await base44.entities.MovimentacaoEstoque.create({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          tipo: 'Saída',
          motivo: 'Venda',
          quantidade: item.quantidade,
          quantidade_base: item.quantidade_base || item.quantidade,
          custo_unitario: 0,
          documento_referencia: novoPedido.numero,
          usuario_responsavel: currentUser.full_name
        });

        // Atualizar estoque do produto
        const produto = await base44.entities.Produto.get(item.produto_id);
        if (produto) {
          await base44.entities.Produto.update(item.produto_id, {
            estoque_atual: (produto.estoque_atual || 0) - (item.quantidade_base || item.quantidade)
          });
        }
      }

      toast({ title: "Venda Finalizada!", className: "bg-emerald-100 text-emerald-800" });
      
      // Temporariamente desabilita o aviso antes de limpar
      window.removeEventListener('beforeunload', () => {});
      
      setCarrinho([]);
      setCliente(null);
      setShowPaymentDialog(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao finalizar", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Formatter helpers
  const formatarValorExibicao = (valor) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleInputMascara = (e, setInput, setValor) => {
    handleCentavosMaskKeyDown(e, {
      setInput,
      setValor,
      formatDisplay: formatarValorExibicao,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-muted/40 dark:bg-background">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6" />
          <div>
            <h1 className="text-lg font-bold">PDV Supermercado</h1>
            <p className="text-xs opacity-80">Venda Rápida • Estoque & Financeiro Integrados</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden desktop-layout:block">
             <p className="text-xs opacity-80">Operador</p>
             <p className="font-semibold text-sm">{currentUser?.full_name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => window.location.href = '/'} className="hover:bg-indigo-700">
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product List */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden pb-28 md:pb-4">
          {/* Search and Add Product Area - MATCHING PDV VENDEDOR STYLE */}
          <div className="mb-4 flex-shrink-0" ref={suggestionsRef}>
            <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    ref={inputProdutoRef}
                    placeholder="Escanear, nome ou código..."
                    className="pl-12 pr-14 bg-card dark:bg-card border border-border/40 dark:border-border/40 rounded-xl text-foreground dark:text-muted-foreground h-14 md:h-14 text-base focus:ring-2 focus:ring-border/40 focus:border-border/40 placeholder:text-muted-foreground"
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:text-muted-foreground hover:bg-muted dark:hover:bg-muted"
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                </div>
              <Input 
                ref={quantidadeInputRef}
                type="number"
                inputMode="numeric"
                placeholder="Qtd"
                className="w-20 md:w-24 bg-card dark:bg-card border border-border/40 dark:border-border/40 rounded-xl text-foreground dark:text-muted-foreground h-14 md:h-14 text-center text-lg font-semibold focus:ring-2 focus:ring-border/40"
                value={quantidadeAtual}
                onChange={(e) => setQuantidadeAtual(parseInt(e.target.value) || 1)}
                onFocus={selectAllOnFocus}
                onKeyDown={handleQuantidadeKeyDown}
                min="1"
                disabled={!produtoSelecionado}
              />
            </div>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && produtosSugeridos.length > 0 && (
                <div className="absolute z-50 mt-2 w-full max-w-3xl bg-card dark:bg-card border border-border/40 dark:border-border/40 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto">
                  {produtosSugeridos.map((produto, index) => {
                    const defaultOpt = pickDefaultSaleUnit(produto, tabelaPreco?.fator_ajuste || 1);
                    const preco = Number(defaultOpt?.valor_unitario ?? (produto.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0;
                    const unidade = defaultOpt?.unidade || produto.unidade_principal || 'UN';
                    const isSelected = index === produtoSelecionadoIndex;
                    return (
                      <div
                        key={produto.id}
                        className={`p-3 md:p-4 hover:bg-muted/40 dark:hover:bg-muted/50 border-b border-border/40 dark:border-border/40 last:border-b-0 cursor-pointer transition-all flex justify-between items-center ${
                          isSelected ? 'bg-muted dark:bg-muted border-l-4 border-l-border pl-3' : 'pl-4'
                        }`}
                        onClick={() => handleSelecionarProduto(produto)}
                      >
                        <div>
                          <p className="font-semibold text-foreground dark:text-foreground text-base leading-tight">{produto.nome}</p>
                          <p className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground font-mono tracking-wide mt-1">
                            #{produto.codigo_interno || '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground dark:text-foreground">R$ {preco.toFixed(2)} / {unidade}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${produto.estoque_atual > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {produto.estoque_atual} {produto.unidade_principal || 'UN'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}

            {/* Selected Product Preview (Before Adding) */}
            {produtoSelecionado && (
              <div className="mt-3 p-3 md:p-4 bg-muted dark:bg-card rounded-xl border border-border/40 dark:border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted dark:bg-muted flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground dark:text-foreground truncate">{produtoSelecionado.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground">
                        <span>R$ {(pickDefaultSaleUnit(produtoSelecionado, tabelaPreco?.fator_ajuste || 1)?.valor_unitario || (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))).toFixed(2)} {pickDefaultSaleUnit(produtoSelecionado, tabelaPreco?.fator_ajuste || 1)?.unidade || produtoSelecionado.unidade_principal || 'UN'}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground/90 dark:text-muted-foreground">
                          Total: R$ {((pickDefaultSaleUnit(produtoSelecionado, tabelaPreco?.fator_ajuste || 1)?.valor_unitario || (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) * (parseInt(quantidadeAtual) || 1)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setProdutoSelecionado(null);
                        setQuantidadeAtual('');
                        inputProdutoRef.current?.focus();
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground/90"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConfirmarAdicao}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-white font-medium px-6"
                      size="sm"
                    >
                      Adicionar (Enter)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto bg-card dark:bg-card rounded-lg shadow-sm border p-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 dark:bg-muted text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Produto</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3 text-right">Unit.</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {carrinho.map(item => (
                  <tr key={item.item_key || item.produto_id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      <div className="flex flex-col">
                        <span>{item.produto_nome}</span>
                        {item.codigo_interno ? (
                          <span className="text-[10px] text-muted-foreground/80 font-mono tracking-wide">#{item.codigo_interno}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => {
                           const newQtd = item.quantidade - 1;
                           if(newQtd <= 0) setCarrinho(carrinho.filter(i => (i.item_key || i.produto_id) !== (item.item_key || item.produto_id)));
                           else setCarrinho(carrinho.map(i => (i.item_key || i.produto_id) === (item.item_key || item.produto_id)
                             ? {...i, quantidade: newQtd, quantidade_base: calculateBaseQuantity(newQtd, i.fator_conversao || 1), total: newQtd * i.preco_unitario_praticado}
                             : i));
                        }} className="min-h-11 min-w-11 bg-muted rounded hover:bg-muted font-bold text-base">-</button>
                        <span className="w-8 font-semibold">{item.quantidade}</span>
                        <button onClick={() => {
                           const newQtd = item.quantidade + 1;
                           const newBase = calculateBaseQuantity(newQtd, item.fator_conversao || 1);
                           if (vendaSemEstoquePermitida || newBase <= item.estoque_disponivel) {
                             setCarrinho(carrinho.map(i => (i.item_key || i.produto_id) === (item.item_key || item.produto_id)
                               ? {...i, quantidade: newQtd, quantidade_base: newBase, total: newQtd * i.preco_unitario_praticado}
                               : i));
                           } else {
                             toast({ title: 'Estoque insuficiente', variant: "destructive" });
                           }
                        }} className="min-h-11 min-w-11 bg-muted rounded hover:bg-muted font-bold text-base">+</button>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{item.unidade_medida || 'UN'}</div>
                    </td>
                    <td className="p-3 text-right">R$ {item.preco_unitario_praticado.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold">R$ {item.total.toFixed(2)}</td>
                    <td className="p-3">
                      <Trash2 className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-600" onClick={() => setCarrinho(carrinho.filter(i => (i.item_key || i.produto_id) !== (item.item_key || item.produto_id)))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {carrinho.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p className="text-lg">Carrinho Vazio</p>
                <p className="text-sm">Escaneie ou busque um produto</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary & Actions — tablet+ split; telemóvel usa barra inferior */}
        <div className="hidden desktop-layout:flex flex-col w-72 lg:w-80 xl:w-96 flex-shrink-0 bg-card dark:bg-card border-l p-4 lg:p-6 shadow-lg z-10">
          <div className="mb-6">
            <h2 className="text-muted-foreground uppercase text-xs font-bold tracking-wider mb-2">Resumo</h2>
            <div className="text-4xl font-bold text-foreground dark:text-white mb-1">R$ {totalCarrinho.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">{carrinho.reduce((acc, i) => acc + i.quantidade, 0)} itens</p>
          </div>

          <div className="space-y-3 mb-auto">
             <div className="p-3 bg-muted/40 rounded-lg border flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <UserPlus className="w-4 h-4 text-muted-foreground" />
                   <span className="text-sm">{cliente ? cliente.nome : 'Consumidor Final'}</span>
                </div>
                <Button variant="link" size="sm" onClick={() => setShowClienteDialog(true)}>Alterar</Button>
             </div>
          </div>

          {carrinho.length > 0 && (
            <button
              onClick={() => setShowSimuladorTaxa(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card py-2 rounded-xl transition-colors mb-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Simular taxa no cartão
            </button>
          )}
          <Button 
            size="lg" 
            className="h-16 text-xl font-bold bg-emerald-600 hover:bg-emerald-700 w-full rounded-xl shadow-emerald-200"
            onClick={handlePaymentOpen}
            disabled={carrinho.length === 0}
          >
            Finalizar Venda (F3)
          </Button>
        </div>
      </div>

      {/* Barra inferior — smartphone */}
      <div className="desktop-layout:hidden fixed left-0 right-0 bottom-0 z-50 flex items-center gap-3 border-t border-border/40 bg-card/95 backdrop-blur-md px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{carrinho.reduce((acc, i) => acc + i.quantidade, 0)} itens</p>
          <p className="text-xl font-bold text-foreground tabular-nums">R$ {totalCarrinho.toFixed(2)}</p>
        </div>
        <Button
          size="lg"
          className="h-12 px-6 font-bold bg-emerald-600 hover:bg-emerald-700"
          onClick={handlePaymentOpen}
          disabled={carrinho.length === 0}
        >
          Finalizar
        </Button>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
             <div className="space-y-4">
                {/* Input fields for payment methods */}
                {['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'].map((label, i) => {
                   const refs = [inputRefs.dinheiro, inputRefs.pix, inputRefs.debito, inputRefs.credito];
                   const vals = [inputDinheiro, inputPix, inputDebito, inputCredito];
                   const setters = [setInputDinheiro, setInputPix, setInputDebito, setInputCredito];
                   const numSetters = [setPagamentosDinheiro, setPagamentosPix, setPagamentosDebito, setPagamentosCredito];
                   const icons = [Banknote, Smartphone, CreditCard, CreditCard];
                   const Icon = icons[i];
                   
                   return (
                     <div key={label} 
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${formaPagamentoAtiva === i ? 'bg-muted border border-indigo-200' : 'border border-transparent'}`}
                        onClick={() => { setFormaPagamentoAtiva(i); focusAndSelect(refs[i].current); }}
                     >
                        <div className="flex items-center gap-2">
                           <Icon className="w-5 h-5 text-muted-foreground" />
                           <span>{label}</span>
                        </div>
                        <input autoComplete="off" 
                           ref={refs[i]}
                           value={vals[i]}
                           onChange={() => {}}
                           onKeyDown={(e) => handleInputMascara(e, setters[i], numSetters[i])}
                           onFocus={(e) => { selectAllOnFocus(e); setFormaPagamentoAtiva(i); }}
                           onMouseDown={selectAllOnMouseDown}
                           className="w-24 text-right bg-transparent font-bold outline-none"
                        />
                     </div>
                   );
                })}
             </div>
             <div className="bg-muted/40 p-6 rounded-xl flex flex-col justify-center items-center text-center">
                <p className="text-sm text-muted-foreground uppercase">Total a Pagar</p>
                <p className="text-3xl font-bold text-foreground mb-4">R$ {totalCarrinho.toFixed(2)}</p>
                
                {troco > 0 && <p className="text-emerald-600 font-bold text-xl">Troco: R$ {troco.toFixed(2)}</p>}
                {valorRestante > 0.01 && <p className="text-amber-600 font-bold text-xl">Falta: R$ {valorRestante.toFixed(2)}</p>}

                <Button 
                  onClick={handleFinalizarVenda} 
                  disabled={!pagamentoValido || isProcessing}
                  className="w-full mt-6 h-12 text-lg bg-indigo-600 hover:bg-indigo-700"
                >
                  {isProcessing ? 'Processando...' : 'Confirmar'}
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Selection Dialog */}
      <Dialog open={showClienteDialog} onOpenChange={setShowClienteDialog}>
        <DialogContent>
           <DialogHeader><DialogTitle>Selecionar Cliente</DialogTitle></DialogHeader>
           <Input placeholder="Buscar cliente..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} autoFocus />
           <div className="mt-4 max-h-60 overflow-y-auto">
              {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).map(c => (
                 <div key={c.id} className="p-3 hover:bg-muted/40 cursor-pointer border-b" onClick={() => { setCliente(c); setShowClienteDialog(false); }}>
                    <p className="font-bold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cpf_cnpj}</p>
                 </div>
              ))}
           </div>
           <Button variant="outline" onClick={() => { setCliente(null); setShowClienteDialog(false); }}>Consumidor Final</Button>
        </DialogContent>
      </Dialog>

      <SimuladorCartaoSheet
        open={showSimuladorTaxa}
        onClose={() => setShowSimuladorTaxa(false)}
        valorTotal={totalCarrinho}
        valorDesconto={0}
      />

      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(code) => {
          setBuscaProduto(code);
          setShowBarcodeScanner(false);
          const produto = produtos.find(p => 
            p.codigo_barras === code || productCodesMatch(p.codigo_interno, code)
          );
          if (produto) {
            handleSelecionarProduto(produto);
          }
        }}
      />
    </div>
  );
}