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
import { omitPedidoVendaEspelho } from '@/lib/omitEspelhoPersist';
import { syncPedidoVendaItens } from '@/lib/syncPedidoVendaItens';
import { selectAllOnFocus, focusAndSelect, selectAllOnMouseDown, handleCentavosMaskKeyDown } from '@/lib/inputFocusUtils';
import {
  filterProdutosDisponiveisPdv,
  isProdutoDisponivelPdv,
} from '@/lib/hierarquiaPortal/produtoPdvDisponibilidade';
import {
  AUTO_HEADER_CLASS,
  AUTO_PRIMARY_BTN,
  AUTO_SURFACE_CLASS,
  AUTO_SHELL_BG,
  AUTO_FIELD_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
} from '@/components/vendas/auto/autoAtendimentoUi';

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
      setProdutos(filterProdutosDisponiveisPdv(produtosData));
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
    if (!isProdutoDisponivelPdv(produto)) {
      toast({ title: 'Produto na reserva — não disponível para venda no PDV.', variant: 'destructive' });
      return;
    }

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

      const itensLegado = carrinho.map(item => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          quantidade_base: item.quantidade_base || item.quantidade,
          unidade_medida: item.unidade_medida || 'UN',
          fator_conversao: item.fator_conversao || 1,
          preco_unitario_praticado: item.preco_unitario_praticado,
          total: item.total
        }));

      const pedidoData = omitPedidoVendaEspelho({
        tipo: 'PDV Supermercado',
        cliente_id: cliente?.id,
        cliente_nome: cliente?.nome || 'Consumidor Final',
        vendedor_id: currentUser.id,
        vendedor_nome: currentUser.full_name,
        status: 'Finalizado',
        valor_total: totalCarrinho,
        pagamentos: pagamentos,
        caixa_destino_id: currentUser.caixa_destino_id
      });

      const novoPedido = await base44.entities.PedidoVenda.create(pedidoData);

      try {
        await syncPedidoVendaItens(novoPedido.id, itensLegado);
      } catch (canonicalErr) {
        console.warn('Sincronia PedidoVendaItem falhou:', canonicalErr?.message || canonicalErr);
      }
      
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

  const getCartItemKey = (item) => item.item_key || item.produto_id;

  const removeCartItem = (item) => {
    const key = getCartItemKey(item);
    setCarrinho(carrinho.filter((i) => getCartItemKey(i) !== key));
  };

  const updateCartItemQuantity = (item, delta) => {
    const key = getCartItemKey(item);
    const newQtd = item.quantidade + delta;

    if (newQtd <= 0) {
      removeCartItem(item);
      return;
    }

    const newBase = calculateBaseQuantity(newQtd, item.fator_conversao || 1);
    if (!vendaSemEstoquePermitida && delta > 0 && newBase > item.estoque_disponivel) {
      toast({ title: 'Estoque insuficiente', variant: 'destructive' });
      return;
    }

    setCarrinho(carrinho.map((i) => (
      getCartItemKey(i) === key
        ? {
            ...i,
            quantidade: newQtd,
            quantidade_base: newBase,
            total: newQtd * i.preco_unitario_praticado,
          }
        : i
    )));
  };

  const totalItensCarrinho = carrinho.reduce((acc, i) => acc + i.quantidade, 0);

  return (
    <div className={`h-screen flex flex-col ${AUTO_SHELL_BG}`}>
      {/* Header — mesmo visual indigo do auto-atendimento */}
      <header className={`${AUTO_HEADER_CLASS} px-3 py-2.5 desktop-layout:px-4 desktop-layout:py-3`}>
        <div className="flex items-center gap-2 desktop-layout:gap-3 min-w-0">
          <div className="w-9 h-9 desktop-layout:w-10 desktop-layout:h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base desktop-layout:text-lg font-bold truncate">PDV Supermercado</h1>
            <p className="text-xs text-indigo-100 hidden desktop-layout:block">Venda Rápida • Estoque & Financeiro Integrados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 desktop-layout:gap-4 flex-shrink-0">
          <div className="text-right hidden desktop-layout:block">
             <p className="text-xs text-indigo-100">Operador</p>
             <p className="font-semibold text-sm">{currentUser?.full_name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowClienteDialog(true)}
            className="desktop-layout:hidden h-9 w-9 text-white hover:bg-indigo-700 hover:text-white"
            aria-label="Selecionar cliente"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { window.location.href = '/'; }}
            className="h-9 w-9 text-white hover:bg-indigo-700 hover:text-white"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product List */}
        <div className="flex-1 flex flex-col p-3 desktop-layout:p-4 overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] desktop-layout:pb-4">
          {/* Search and Add Product Area - MATCHING PDV VENDEDOR STYLE */}
          <div className="mb-3 desktop-layout:mb-4 flex-shrink-0 relative px-3 py-3 -mx-3 desktop-layout:mx-0 desktop-layout:px-0 desktop-layout:py-0 bg-background dark:bg-card border-b border-border/40 dark:border-border/40 desktop-layout:bg-transparent desktop-layout:border-0" ref={suggestionsRef}>
            <div className="flex gap-2">
                <div className="flex-1 relative min-w-0">
                  <Barcode className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${AUTO_ACCENT_TEXT} opacity-70`} />
                  <Input 
                    ref={inputProdutoRef}
                    placeholder="Buscar ou escanear..."
                    className={`pl-10 pr-12 ${AUTO_FIELD_CLASS} text-foreground h-12 desktop-layout:h-14 text-base focus-visible:ring-[#4a5240]/25 placeholder:text-muted-foreground`}
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
                    className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 ${AUTO_ACCENT_TEXT} hover:bg-secondary/60 dark:hover:bg-[#26262e]`}
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                </div>
              <Input 
                ref={quantidadeInputRef}
                type="number"
                inputMode="numeric"
                placeholder="Qtd"
                className={`w-[4.5rem] desktop-layout:w-24 ${AUTO_FIELD_CLASS} text-foreground h-12 desktop-layout:h-14 text-center text-lg font-semibold focus-visible:ring-[#4a5240]/25`}
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
                <div className={`absolute z-50 left-0 right-0 mt-2 ${AUTO_SURFACE_CLASS} shadow-lg max-h-[min(50dvh,400px)] overflow-y-auto`}>
                  {produtosSugeridos.map((produto, index) => {
                    const defaultOpt = pickDefaultSaleUnit(produto, tabelaPreco?.fator_ajuste || 1);
                    const preco = Number(defaultOpt?.valor_unitario ?? (produto.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0;
                    const unidade = defaultOpt?.unidade || produto.unidade_principal || 'UN';
                    const isSelected = index === produtoSelecionadoIndex;
                    return (
                      <div
                        key={produto.id}
                        className={`p-3 desktop-layout:p-4 hover:bg-secondary/60 dark:hover:bg-[#26262e] border-b border-border/40 dark:border-border/40 last:border-b-0 cursor-pointer transition-all flex justify-between items-start gap-3 ${
                          isSelected ? 'bg-secondary/60 dark:bg-[#26262e] border-l border-l-[#4a5240] dark:border-l-[#a4ce33] pl-3' : 'pl-4'
                        }`}
                        onClick={() => handleSelecionarProduto(produto)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground dark:text-foreground text-sm desktop-layout:text-base leading-tight line-clamp-2">{produto.nome}</p>
                          <p className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground font-mono tracking-wide mt-1">
                            #{produto.codigo_interno || '—'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base desktop-layout:text-lg font-bold text-foreground dark:text-foreground whitespace-nowrap">R$ {preco.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">/{unidade}</p>
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${produto.estoque_atual > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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
              <div className={`mt-3 p-3 desktop-layout:p-4 ${AUTO_SURFACE_CLASS}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${AUTO_ACCENT_BG} flex items-center justify-center flex-shrink-0`}>
                      <Package className={`w-5 h-5 ${AUTO_ACCENT_TEXT}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground dark:text-foreground truncate">{produtoSelecionado.nome}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground dark:text-muted-foreground">
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
                      className="flex-1 text-muted-foreground hover:text-foreground/90"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConfirmarAdicao}
                      className={`flex-[2] ${AUTO_PRIMARY_BTN}`}
                      size="sm"
                    >
                      <span className="desktop-layout:hidden">Adicionar</span>
                      <span className="hidden desktop-layout:inline">Adicionar (Enter)</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cart List */}
          <div className={`flex-1 overflow-y-auto ${AUTO_SURFACE_CLASS} min-h-0 bg-background dark:bg-card`}>
            {/* Mobile: cards */}
            <div className="desktop-layout:hidden p-2 space-y-2">
              {carrinho.map((item) => (
                <div key={getCartItemKey(item)} className={`${AUTO_SURFACE_CLASS} p-3 hover:border-[#4a5240]/30 transition-colors`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-snug line-clamp-2">{item.produto_nome}</p>
                      {item.codigo_interno ? (
                        <p className="text-[10px] text-muted-foreground/80 font-mono tracking-wide mt-0.5">#{item.codigo_interno}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground mt-1">
                        R$ {item.preco_unitario_praticado.toFixed(2)} / {item.unidade_medida || 'UN'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-base font-bold tabular-nums">R$ {item.total.toFixed(2)}</p>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item)}
                        className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        aria-label="Remover item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quantidade</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item, -1)}
                        className={`min-h-11 min-w-11 ${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT} rounded-lg hover:bg-muted dark:hover:bg-[#383e47] font-bold text-lg`}
                        aria-label="Diminuir quantidade"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-base tabular-nums">{item.quantidade}</span>
                      <button
                        type="button"
                        onClick={() => updateCartItemQuantity(item, 1)}
                        className={`min-h-11 min-w-11 ${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT} rounded-lg hover:bg-muted dark:hover:bg-[#383e47] font-bold text-lg`}
                        aria-label="Aumentar quantidade"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden desktop-layout:block p-2">
            <table className="w-full text-left text-sm">
              <thead className={`${AUTO_ACCENT_BG} text-muted-foreground border-b border-border/40 dark:border-border/40`}>
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
                  <tr key={getCartItemKey(item)} className="border-b last:border-0">
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
                        <button type="button" onClick={() => updateCartItemQuantity(item, -1)} className={`min-h-11 min-w-11 ${AUTO_ACCENT_BG} rounded-lg hover:bg-muted dark:hover:bg-[#383e47] font-bold text-base ${AUTO_ACCENT_TEXT}`}>-</button>
                        <span className="w-8 font-semibold">{item.quantidade}</span>
                        <button type="button" onClick={() => updateCartItemQuantity(item, 1)} className={`min-h-11 min-w-11 ${AUTO_ACCENT_BG} rounded-lg hover:bg-muted dark:hover:bg-[#383e47] font-bold text-base ${AUTO_ACCENT_TEXT}`}>+</button>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{item.unidade_medida || 'UN'}</div>
                    </td>
                    <td className="p-3 text-right">R$ {item.preco_unitario_praticado.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold">R$ {item.total.toFixed(2)}</td>
                    <td className="p-3">
                      <Trash2 className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-600" onClick={() => removeCartItem(item)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {carrinho.length === 0 && (
              <div className="h-full min-h-[12rem] flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <div className={`w-16 h-16 desktop-layout:w-20 desktop-layout:h-20 rounded-2xl ${AUTO_ACCENT_BG} flex items-center justify-center mb-3 desktop-layout:mb-4`}>
                  <ShoppingCart className={`w-8 h-8 desktop-layout:w-10 desktop-layout:h-10 ${AUTO_ACCENT_TEXT}`} />
                </div>
                <p className="text-base desktop-layout:text-lg font-medium text-foreground">Carrinho Vazio</p>
                <p className="text-sm text-muted-foreground">Escaneie ou busque um produto</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary & Actions — tablet+ split; telemóvel usa barra inferior */}
        <div className={`hidden desktop-layout:flex flex-col w-72 lg:w-80 xl:w-96 flex-shrink-0 bg-background dark:bg-card border-l border-border/40 dark:border-border/40 p-4 lg:p-6 shadow-lg z-10`}>
          <div className="mb-6">
            <h2 className={`${AUTO_ACCENT_TEXT} uppercase text-xs font-bold tracking-wider mb-2 opacity-80`}>Resumo</h2>
            <div className={`text-4xl font-bold mb-1 tabular-nums ${AUTO_ACCENT_TEXT}`}>R$ {totalCarrinho.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">{totalItensCarrinho} itens</p>
          </div>

          <div className="space-y-3 mb-auto">
             <div className={`p-3 ${AUTO_SURFACE_CLASS} flex justify-between items-center`}>
                <div className="flex items-center gap-2 min-w-0">
                   <div className={`w-8 h-8 rounded-lg ${AUTO_ACCENT_BG} flex items-center justify-center flex-shrink-0`}>
                     <UserPlus className={`w-4 h-4 ${AUTO_ACCENT_TEXT}`} />
                   </div>
                   <span className="text-sm truncate">{cliente ? cliente.nome : 'Consumidor Final'}</span>
                </div>
                <Button variant="link" size="sm" onClick={() => setShowClienteDialog(true)} className={`${AUTO_ACCENT_TEXT} shrink-0`}>Alterar</Button>
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
            className={`h-16 text-xl font-bold w-full ${AUTO_PRIMARY_BTN}`}
            onClick={handlePaymentOpen}
            disabled={carrinho.length === 0}
          >
            Finalizar Venda (F3)
          </Button>
        </div>
      </div>

      {/* Barra inferior — smartphone (estilo auto-atendimento) */}
      <div className="desktop-layout:hidden fixed left-0 right-0 bottom-0 z-50 border-t border-border/40 dark:border-border/40 bg-background dark:bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={() => setShowClienteDialog(true)}
            className={`flex min-w-0 max-w-[34%] flex-col rounded-xl border border-border/40 dark:border-border/40 ${AUTO_ACCENT_BG} px-3 py-2 text-left`}
          >
            <span className={`text-[10px] uppercase tracking-wide ${AUTO_ACCENT_TEXT} opacity-80`}>Cliente</span>
            <span className="truncate text-sm font-medium">{cliente ? cliente.nome : 'Consumidor Final'}</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <div className="relative shrink-0">
              <div className={`w-11 h-11 ${AUTO_ACCENT_BG} rounded-xl flex items-center justify-center ${AUTO_ACCENT_TEXT}`}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              {totalItensCarrinho > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItensCarrinho}
                </span>
              )}
            </div>
            <div className="text-right min-w-0">
              <p className="text-xs text-muted-foreground">{totalItensCarrinho} itens</p>
              <p className="text-xl font-bold text-foreground tabular-nums">R$ {totalCarrinho.toFixed(2)}</p>
            </div>
          </div>
          <Button
            size="lg"
            className={`h-12 shrink-0 px-5 text-base ${AUTO_PRIMARY_BTN}`}
            onClick={handlePaymentOpen}
            disabled={carrinho.length === 0}
          >
            Finalizar
          </Button>
        </div>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="desktop-layout:max-w-2xl max-w-none w-full h-[100dvh] desktop-layout:h-auto desktop-layout:max-h-[90vh] left-0 top-0 desktop-layout:left-[50%] desktop-layout:top-[50%] translate-x-0 translate-y-0 desktop-layout:translate-x-[-50%] desktop-layout:translate-y-[-50%] rounded-none desktop-layout:rounded-lg overflow-y-auto p-0 desktop-layout:p-0 gap-0">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shrink-0" />
          <div className={`${AUTO_HEADER_CLASS} rounded-none`}>
            <DialogTitle className="text-lg font-bold text-white">Pagamento</DialogTitle>
            <p className="text-sm text-indigo-100 tabular-nums">R$ {totalCarrinho.toFixed(2)}</p>
          </div>
          <div className={`p-4 desktop-layout:p-6 grid grid-cols-1 desktop-layout:grid-cols-2 gap-4 desktop-layout:gap-8 ${AUTO_SHELL_BG}`}>
             <div className="space-y-3 desktop-layout:space-y-4 order-2 desktop-layout:order-1">
                {['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito'].map((label, i) => {
                   const refs = [inputRefs.dinheiro, inputRefs.pix, inputRefs.debito, inputRefs.credito];
                   const vals = [inputDinheiro, inputPix, inputDebito, inputCredito];
                   const setters = [setInputDinheiro, setInputPix, setInputDebito, setInputCredito];
                   const numSetters = [setPagamentosDinheiro, setPagamentosPix, setPagamentosDebito, setPagamentosCredito];
                   const icons = [Banknote, Smartphone, CreditCard, CreditCard];
                   const iconBg = [`${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT}`, 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700', 'bg-teal-100 dark:bg-teal-900/40 text-teal-700', `${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT}`];
                   const Icon = icons[i];
                   
                   return (
                     <div key={label} 
                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer min-h-[3.5rem] transition-all ${
                          formaPagamentoAtiva === i
                            ? `${AUTO_SURFACE_CLASS} border-2 border-[#4a5240] dark:border-[#a4ce33] shadow-sm`
                            : `${AUTO_SURFACE_CLASS} border-2 border-transparent hover:border-[#4a5240]/30`
                        }`}
                        onClick={() => { setFormaPagamentoAtiva(i); focusAndSelect(refs[i].current); }}
                     >
                        <div className="flex items-center gap-3 min-w-0">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg[i]}`}>
                             <Icon className="w-5 h-5" />
                           </div>
                           <span className="text-sm desktop-layout:text-base font-medium">{label}</span>
                        </div>
                        <input autoComplete="off" 
                           ref={refs[i]}
                           value={vals[i]}
                           onChange={() => {}}
                           onKeyDown={(e) => handleInputMascara(e, setters[i], numSetters[i])}
                           onFocus={(e) => { selectAllOnFocus(e); setFormaPagamentoAtiva(i); }}
                           onMouseDown={selectAllOnMouseDown}
                           className={`w-28 desktop-layout:w-24 text-right bg-transparent font-bold outline-none text-base ${AUTO_ACCENT_TEXT}`}
                        />
                     </div>
                   );
                })}
             </div>
             <div className={`${AUTO_SURFACE_CLASS} p-4 desktop-layout:p-6 flex flex-col justify-center items-center text-center order-1 desktop-layout:order-2 sticky top-0 desktop-layout:static z-10`}>
                <p className={`text-xs desktop-layout:text-sm ${AUTO_ACCENT_TEXT} uppercase font-semibold tracking-wide opacity-80`}>Total a Pagar</p>
                <p className={`text-3xl font-bold mb-2 desktop-layout:mb-4 tabular-nums ${AUTO_ACCENT_TEXT}`}>R$ {totalCarrinho.toFixed(2)}</p>
                
                {troco > 0 && <p className="text-emerald-600 font-bold text-lg desktop-layout:text-xl tabular-nums">Troco: R$ {troco.toFixed(2)}</p>}
                {valorRestante > 0.01 && <p className="text-amber-600 font-bold text-lg desktop-layout:text-xl tabular-nums">Falta: R$ {valorRestante.toFixed(2)}</p>}

                <Button 
                  onClick={handleFinalizarVenda} 
                  disabled={!pagamentoValido || isProcessing}
                  className={`w-full mt-4 desktop-layout:mt-6 h-12 text-base desktop-layout:text-lg ${AUTO_PRIMARY_BTN}`}
                >
                  {isProcessing ? 'Processando...' : 'Confirmar'}
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Selection Dialog */}
      <Dialog open={showClienteDialog} onOpenChange={setShowClienteDialog}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] desktop-layout:w-full p-0 gap-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-6 bg-background dark:bg-card">
           <DialogHeader><DialogTitle className={AUTO_ACCENT_TEXT}>Selecionar Cliente</DialogTitle></DialogHeader>
           <Input placeholder="Buscar cliente..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} autoFocus className={`mt-4 ${AUTO_FIELD_CLASS}`} />
           <div className="mt-4 max-h-60 overflow-y-auto space-y-1">
              {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).map(c => (
                 <div key={c.id} className="p-3 hover:bg-secondary/60 dark:hover:bg-[#26262e] cursor-pointer rounded-xl border border-transparent hover:border-border/40" onClick={() => { setCliente(c); setShowClienteDialog(false); }}>
                    <p className="font-bold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cpf_cnpj}</p>
                 </div>
              ))}
           </div>
           <Button variant="outline" onClick={() => { setCliente(null); setShowClienteDialog(false); }} className={`w-full mt-4 rounded-xl border-border/40 ${AUTO_ACCENT_TEXT} hover:bg-secondary/60`}>Consumidor Final</Button>
          </div>
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