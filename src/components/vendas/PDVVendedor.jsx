import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateBackOr } from '@/lib/navigateBackOr';
import { Produto } from '@/entities/Produto';
import { Terceiro } from '@/entities/Terceiro';
import { TabelaPreco } from '@/entities/TabelaPreco';
import { User } from '@/entities/User';
import { RascunhoPedidoVenda } from '@/entities/RascunhoPedidoVenda';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CaixaDialogContent } from '@/components/vendas/caixa/CaixaDialogContent';
import { CaixaOverlayStackProvider } from '@/components/vendas/caixa/CaixaOverlayStackContext';
import { Search, ShoppingCart, Trash2, UserPlus, ArrowRight, Barcode, Truck, Store, Keyboard, Plus, Minus, ArrowLeft, ChevronDown, ChevronRight, AlertCircle, Package, Boxes, Camera, Undo2, X, Edit, FileText, CreditCard } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useMobileLayout } from '@/hooks/use-breakpoint';
import {
  QUICK_ACCESS_NESTED_CHILD_DIALOG_CLASS,
  QUICK_ACCESS_NESTED_DIALOG_CLASS,
} from '@/lib/quickAccessOverlay';
import { format } from 'date-fns';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ComprovantePreVenda from './ComprovantePreVenda';
import ConfirmarImpressaoDialog from './ConfirmarImpressaoDialog';
import LostSalesForm from './LostSalesForm';
import OrcamentosRecentesSheet from './OrcamentosRecentesSheet';
import SimuladorTaxaCartao from './SimuladorTaxaCartao';
import BarcodeScanner from './BarcodeScanner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createPageUrl } from '@/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import { buildSaleUnitOptions, calculateBaseQuantity, formatEstoqueDisponivelLabel, getItemUnitKey, pickDefaultSaleUnit } from '@/lib/productUnits';
import { filterAndSortProducts, sortProductsAlphabetically } from '@/components/compras/productMatchingUtils';
import { productCodesMatch } from '@/lib/productCode';
import { isVendaSemEstoquePermitida } from '@/lib/configFlags';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';
import {
  filterProdutosDisponiveisPdv,
  isProdutoDisponivelPdv,
} from '@/lib/hierarquiaPortal/produtoPdvDisponibilidade';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

export default function PDVVendedor({ overlayMode = false, onClose } = {}) {
  const navigate = useNavigate();

  const handleClose = () => {
    if (overlayMode && onClose) {
      onClose();
      return;
    }
    navigateBackOr(navigate);
  };
  const [carrinho, setCarrinho] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtosSugeridos, setProdutosSugeridos] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidadeAtual, setQuantidadeAtual] = useState(''); // Changed from quantidadeInput
  const [produtos, setProdutos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tabelaPreco, setTabelaPreco] = useState(null);
  const [showClienteDialog, setShowClienteDialog] = useState(false);
  const [showNovoClienteForm, setShowNovoClienteForm] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientesFiltrados, setClientesFiltrados] = useState([]);
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    tipo_documento: 'CPF',
    numero_documento: '',
    perfil: '',
    data_nascimento: '',
    observacoes: ''
  });
  const [metodoEntrega, setMetodoEntrega] = useState('Retirada');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ultimaPreVenda, setUltimaPreVenda] = useState(null);
  const [showComprovante, setShowComprovante] = useState(false);
  const [showConfirmarImpressao, setShowConfirmarImpressao] = useState(false);
  const [produtoSelecionadoIndex, setProdutoSelecionadoIndex] = useState(0);
  const [clienteSelecionadoIndex, setClienteSelecionadoIndex] = useState(0);
  const [showLostSalesForm, setShowLostSalesForm] = useState(false);
  const [showCarrinhoMobile, setShowCarrinhoMobile] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [sugestoesContextuais, setSugestoesContextuais] = useState([]);
  const [configVenda, setConfigVenda] = useState(null);
  const [configEstoque, setConfigEstoque] = useState(null);
  const vendaSemEstoquePermitida = useMemo(
    () => isVendaSemEstoquePermitida(configVenda, configEstoque),
    [configVenda, configEstoque]
  );
  const [showReeditarDialog, setShowReeditarDialog] = useState(false);
  const [senhaReeditar, setSenhaReeditar] = useState('');
  const [rascunhoEmEdicaoId, setRascunhoEmEdicaoId] = useState(null);
  const [showOrcamentosRecentes, setShowOrcamentosRecentes] = useState(false);
  const [showSimuladorTaxa, setShowSimuladorTaxa] = useState(false);
  const [unitSelector, setUnitSelector] = useState({ open: false, product: null });

  useEffect(() => {
    if (produtos.length === 0) return;

    let candidates = [];

    if (carrinho.length > 0) {
      const lastItem = carrinho[carrinho.length - 1];
      const sourceProduct = produtos.find((p) => p.id === lastItem.produto_id);
      if (sourceProduct && sourceProduct.categoria_nome) {
        candidates = produtos.filter((p) =>
        p.id !== sourceProduct.id &&
        p.categoria_nome === sourceProduct.categoria_nome &&
        p.ativo &&
        !carrinho.some((c) => c.produto_id === p.id)
        );
      }
    }

    if (candidates.length < 4) {
      const others = produtos.filter((p) =>
      p.ativo &&
      !carrinho.some((c) => c.produto_id === p.id) &&
      !candidates.includes(p)
      );
      candidates = [...candidates, ...others];
    }

    setSugestoesContextuais(sortProductsAlphabetically(candidates).slice(0, 4));
  }, [carrinho, produtos]);

  const [tipoAjuste, setTipoAjuste] = useState('desconto');
  const [ajustePercentual, setAjustePercentual] = useState('');
  const [ajusteValor, setAjusteValor] = useState('');
  // valorAjuste e tipoValorAjuste mantidos para compatibilidade com o restante do código
  const [valorAjuste, setValorAjuste] = useState(0);
  const [tipoValorAjuste, setTipoValorAjuste] = useState('percentual');

  // Two-way binding handlers
  const handleAjustePercentualChange = (val) => {
    setAjustePercentual(val);
    const pct = parseFloat(val) || 0;
    setValorAjuste(pct);
    setTipoValorAjuste('percentual');
    if (subtotal > 0 && pct > 0) {
      setAjusteValor((subtotal * pct / 100).toFixed(2));
    } else {
      setAjusteValor('');
    }
  };

  const handleAjusteValorChange = (val) => {
    setAjusteValor(val);
    const v = parseFloat(val) || 0;
    setValorAjuste(v);
    setTipoValorAjuste('valor');
    if (subtotal > 0 && v > 0) {
      setAjustePercentual((v / subtotal * 100).toFixed(2));
    } else {
      setAjustePercentual('');
    }
  };

  const inputProdutoRef = useRef(null);
  const quantidadeInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const suggestionsListRef = useRef(null);
  const suggestionItemRefs = useRef([]);
  const clienteNomeRef = useRef(null);
  const precoLivreInputRef = useRef(null);
  const { toast } = useToast();

  // Feedback inline ao invés de toast
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const showFeedback = (type, message, duration = 2000) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), duration);
  };

  const isMobile = useMobileLayout();
  const inAppLayout = isMobile && !overlayMode;

  const { subtotal, valorTotal, valorAjusteCalculado, percentualAjuste, ajusteExcedido } = useMemo(() => {
    const sub = carrinho.reduce((acc, item) => acc + (item.total || 0), 0);

    let valorAjusteCalc = 0;
    if (valorAjuste > 0) {
      if (tipoValorAjuste === 'percentual') {
        valorAjusteCalc = sub * valorAjuste / 100;
      } else {
        valorAjusteCalc = valorAjuste;
      }
    }

    if (tipoAjuste === 'desconto') {
      valorAjusteCalc = Math.min(valorAjusteCalc, sub);
    }

    const percent = sub > 0 ? valorAjusteCalc / sub * 100 : 0;
    // Limite efetivo = maior entre o limite do usuário e o percentual_desconto_maximo da tabela
    const limiteUsuario = currentUser?.limite_desconto || 0;
    const limiteTabela = tabelaPreco?.percentual_desconto_maximo || 0;
    const limite = Math.max(limiteUsuario, limiteTabela);
    const excedido = tipoAjuste === 'desconto' && currentUser && limite > 0 && percent > limite;

    let total = sub;
    if (tipoAjuste === 'desconto') {
      total = sub - valorAjusteCalc;
    } else if (tipoAjuste === 'acrescimo') {
      total = sub + valorAjusteCalc;
    }

    return {
      subtotal: sub,
      valorTotal: total,
      valorAjusteCalculado: valorAjusteCalc,
      percentualAjuste: percent,
      ajusteExcedido: excedido
    };
  }, [carrinho, valorAjuste, tipoValorAjuste, tipoAjuste, currentUser]);

  const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);

  useEffect(() => {
    loadDependencies();
    loadConfiguracoesVenda();
    verificarRascunhoParaEdicao();
  }, []);

  // Resync valor R$ quando subtotal mudar e tiver % preenchido
  useEffect(() => {
    const pct = parseFloat(ajustePercentual) || 0;
    if (pct > 0 && subtotal > 0) {
      setAjusteValor((subtotal * pct / 100).toFixed(2));
      setValorAjuste(pct);
      setTipoValorAjuste('percentual');
    }
  }, [subtotal]);

  const loadConfiguracoesVenda = async () => {
    try {
      const [configsVenda, configsEstoque] = await Promise.all([
        base44.entities.ConfiguracoesVenda.list(),
        base44.entities.ConfiguracoesEstoque.list(),
      ]);
      if (configsVenda.length > 0) {
        setConfigVenda(configsVenda[0]);
        if (configsVenda[0].auto_delivery_balcao) {
          setMetodoEntrega('Retirada');
        }
      }
      if (configsEstoque.length > 0) {
        setConfigEstoque(configsEstoque[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const verificarRascunhoParaEdicao = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const rascunhoId = urlParams.get('rascunho_id');
    
    if (rascunhoId) {
      try {
        const rascunho = await base44.entities.RascunhoPedidoVenda.get(rascunhoId);
        
        if (rascunho && rascunho.status === 'Retornado para Edição') {
          // Recarregar o carrinho com os itens do rascunho
          const itensCarrinho = normalizeCartItems(rascunho.itens.map(item => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            codigo_interno: item.codigo_interno || '',
            quantidade: item.quantidade,
            unidade_medida: item.unidade_medida || 'UN',
            fator_conversao: item.fator_conversao || 1,
            quantidade_base: item.quantidade_base,
            preco_unitario: item.preco_unitario_praticado,
            preco_unitario_praticado: item.preco_unitario_praticado,
            custo_unitario_momento: item.custo_unitario_momento || 0,
            total: item.total,
            estoque_disponivel: 999
          })));
          
          setCarrinho(itensCarrinho);
          setRascunhoEmEdicaoId(rascunho.id);
          
          // Carregar cliente se existir
          if (rascunho.cliente_id) {
            const cliente = await base44.entities.Terceiro.get(rascunho.cliente_id);
            setClienteSelecionado(cliente);
          }
          
          // Definir método de entrega
          if (rascunho.metodo_entrega) {
            setMetodoEntrega(rascunho.metodo_entrega);
          }
          
          // Definir desconto se houver
          if (rascunho.valor_desconto > 0) {
            setTipoAjuste('desconto');
            setValorAjuste(rascunho.valor_desconto);
            setAjusteValor(rascunho.valor_desconto.toFixed(2));
            setTipoValorAjuste('valor');
            setAjustePercentual('');
          } else {
            setValorAjuste(0);
            setAjustePercentual('');
            setAjusteValor('');
            setTipoAjuste('desconto');
            setTipoValorAjuste('percentual');
          }
          showFeedback('info', `Editando rascunho - Senha ${rascunho.senha_atendimento.slice(-4)}`, 3000);
        }
      } catch (error) {
        console.error('Erro ao carregar rascunho:', error);
        showFeedback('error', 'Erro ao carregar rascunho para edição', 3000);
      }
    }
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {// Renamed to avoid confusion with local handleKeyDown
      if (showConfirmarImpressao) return;

      // F1 - Ajuda
      if (e.key === 'F1') {
        e.preventDefault();
        showFeedback('info', 'F1: Ajuda | F2: Novo Cliente | F3: Avançar | F4: Limpar | ESC: Sair', 4000);
        return;
      }

      // F2 - Novo Cliente (quando no dialog de cliente)
      if (e.key === 'F2' && showClienteDialog && !showNovoClienteForm) {
        e.preventDefault();
        setShowNovoClienteForm(true);
        setTimeout(() => clienteNomeRef.current?.focus(), 100);
        return;
      }

      // F3 - Finalizar Venda (avançar para seleção de cliente ou finalizar dentro do dialog)
      if (e.key === 'F3' && !showClienteDialog && carrinho.length > 0 && !ajusteExcedido) {
        e.preventDefault();
        handleAvancarParaCliente();
        return;
      }

      // F4 - Limpar Carrinho
      if (e.key === 'F4' && !showClienteDialog && carrinho.length > 0) {
        e.preventDefault();
        if (confirm('Limpar todo o carrinho?')) {
          handleLimparCarrinho();
        }
        return;
      }

      // ESC - Voltar à tela anterior (só se nenhum dialog de cliente estiver aberto)
      if (e.key === 'Escape' && !showClienteDialog && !showComprovante && !showConfirmarImpressao) {
        e.preventDefault();
        const confirmExit = confirm('Deseja sair do PDV e voltar à tela anterior?');
        if (confirmExit) {
          handleClose();
        }
        return;
      }

      // ESC - Fechar dialogs (prioriza o mais aninhado)
      if (e.key === 'Escape') {
        if (showNovoClienteForm) {
          e.preventDefault();
          setShowNovoClienteForm(false);
          return;
        } else if (showClienteDialog) {
          e.preventDefault();
          setShowClienteDialog(false);
          return;
        }
      }

      // Navegação por setas (sugestões de produto)
      if (showSuggestions && produtosSugeridos.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setProdutoSelecionadoIndex((prev) =>
          prev < produtosSugeridos.length - 1 ? prev + 1 : 0
          );
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setProdutoSelecionadoIndex((prev) =>
          prev > 0 ? prev - 1 : produtosSugeridos.length - 1
          );
        }
        if (e.key === 'Enter' && document.activeElement === inputProdutoRef.current) {// Updated ref
          e.preventDefault();
          if (produtosSugeridos[produtoSelecionadoIndex]) {
            handleSelecionarProduto(produtosSugeridos[produtoSelecionadoIndex]);
          }
        }
      }

      // Navegação nas sugestões de clientes
      if (showClienteDialog && !showNovoClienteForm && clientesFiltrados.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setClienteSelecionadoIndex((prev) =>
          prev < clientesFiltrados.length - 1 ? prev + 1 : 0
          );
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setClienteSelecionadoIndex((prev) =>
          prev > 0 ? prev - 1 : clientesFiltrados.length - 1
          );
        }
        if (e.key === 'Enter' && clientesFiltrados.length > 0) {
          e.preventDefault();
          handleSelecionarCliente(clientesFiltrados[clienteSelecionadoIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showClienteDialog, showNovoClienteForm, carrinho, showSuggestions, produtosSugeridos, produtoSelecionadoIndex, clientesFiltrados, clienteSelecionadoIndex, showComprovante, showConfirmarImpressao, ajusteExcedido]);

  useEffect(() => {
    if (inputProdutoRef.current && !showClienteDialog) {// Updated ref
      inputProdutoRef.current.focus();
    }
  }, [carrinho, showClienteDialog]);

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

  // Busca automática de clientes
  useEffect(() => {
    if (buscaCliente.trim().length >= 2) {
      const termo = buscaCliente.toLowerCase();
      const resultados = clientes.filter((c) =>
      c.nome?.toLowerCase().includes(termo) ||
      c.cpf_cnpj?.toLowerCase().includes(termo) ||
      c.telefone?.toLowerCase().includes(termo)
      );
      setClientesFiltrados(resultados);
      setClienteSelecionadoIndex(0); // Reset index quando filtrar
    } else {
      setClientesFiltrados([]);
      setClienteSelecionadoIndex(0);
    }
  }, [buscaCliente, clientes]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showSuggestions || produtosSugeridos.length === 0) return;
    suggestionItemRefs.current = suggestionItemRefs.current.slice(0, produtosSugeridos.length);
    const suggestionsContainer = suggestionsListRef.current;
    const activeItem = suggestionItemRefs.current[produtoSelecionadoIndex];
    if (!suggestionsContainer || !activeItem) return;
    activeItem.scrollIntoView({ block: 'nearest' });
  }, [showSuggestions, produtosSugeridos, produtoSelecionadoIndex]);

  const loadDependencies = async () => {
    try {
      const [produtosData, userData, clientesData] = await Promise.all([
      base44.entities.Produto.filter({ ativo: true }),
      base44.auth.me(),
      base44.entities.Terceiro.filter({ tipo: ['Cliente', 'Ambos'] })]
      );

      setProdutos(filterProdutosDisponiveisPdv(produtosData));
      setCurrentUser(userData);
      setClientes(clientesData);

      if (userData.tabela_preco_id) {
        const tabela = await base44.entities.TabelaPreco.get(userData.tabela_preco_id);
        setTabelaPreco(tabela);
      } else {
        const tabelas = await base44.entities.TabelaPreco.filter({ ativo: true, is_default: true });
        if (tabelas.length > 0) setTabelaPreco(tabelas[0]);
      }
    } catch (error) {
      showFeedback('error', `Erro ao carregar: ${error.message}`, 3000);
    }
  };

  const focarQuantidade = () => {
    setTimeout(() => {
      quantidadeInputRef.current?.focus();
    }, isMobile ? 400 : 100);
  };

  const normalizeCartItems = (itens = []) => itens.map((item) => {
    const unidadeMedida = item.unidade_medida || 'UN';
    const fatorConversao = item.fator_conversao || 1;
    const precoUnitario = item.preco_unitario_praticado ?? item.preco_unitario ?? 0;

    return {
      ...item,
      unidade_medida: unidadeMedida,
      fator_conversao: fatorConversao,
      quantidade_base: item.quantidade_base || calculateBaseQuantity(item.quantidade, fatorConversao),
      preco_unitario: precoUnitario,
      preco_unitario_praticado: precoUnitario,
      item_key: item.item_key || getItemUnitKey(item.produto_id, unidadeMedida),
    };
  });

  const aplicarUnidadeAoProdutoSelecionado = (produto, unidadeSelecionada) => {
    if (!produto || !unidadeSelecionada) return;

    setProdutoSelecionado({
      ...produto,
      unidade_medida: unidadeSelecionada.unidade,
      fator_conversao: unidadeSelecionada.fator_conversao,
      _preco_sugerido_unitade: unidadeSelecionada.valor_unitario,
      _item_key: getItemUnitKey(produto.id, unidadeSelecionada.unidade),
    });
    setQuantidadeAtual('');
    setUnitSelector({ open: false, product: null });
    focarQuantidade();
  };

  const handleSelecionarProduto = (produto) => {
    if (!isProdutoDisponivelPdv(produto)) {
      showFeedback('error', 'Produto na reserva — não disponível para venda no PDV.', 3000);
      return;
    }

    setBuscaProduto('');
    setShowSuggestions(false);
    setQuantidadeAtual('');

    if (isMobile) {
      inputProdutoRef.current?.blur();
    }

    const mult = tabelaPreco?.fator_ajuste || 1;
    const opcoes = buildSaleUnitOptions(produto, mult);
    const defaultOpt = pickDefaultSaleUnit(produto, mult);

    if (opcoes.length > 1) {
      aplicarUnidadeAoProdutoSelecionado(produto, defaultOpt || opcoes[0]);
      return;
    }

    aplicarUnidadeAoProdutoSelecionado(produto, opcoes[0]);
  };

  const handleConfirmarAdicao = () => {
    if (!produtoSelecionado) return;

    const quantidade = parseFloat(quantidadeAtual) || 1;
    const fatorConversao = produtoSelecionado.fator_conversao || 1;
    const quantidadeBase = calculateBaseQuantity(quantidade, fatorConversao);

    if (!vendaSemEstoquePermitida && produtoSelecionado.estoque_atual < quantidadeBase) {
      showFeedback('error', `Estoque insuficiente: ${formatEstoqueDisponivelLabel(produtoSelecionado)} disponível`, 3000);
      return;
    }

    let precoFinal = produtoSelecionado._preco_sugerido_unitade ?? produtoSelecionado.preco_venda_padrao;
    if (produtoSelecionado._preco_digitado_raw !== undefined) {
      const precoDigitado = parseFloat(String(produtoSelecionado._preco_digitado_raw).replace(',', '.'));
      const custoMinimo = (produtoSelecionado.preco_custo_calculado || 0) * fatorConversao;
      if (!Number.isFinite(precoDigitado)) {
        showFeedback('error', 'Informe um preço válido', 3000);
        return;
      }
      if (precoDigitado < custoMinimo) {
        showFeedback('error', `Preço não pode ser menor que o custo da unidade escolhida (R$ ${custoMinimo.toFixed(2)})`, 3000);
        return;
      }
      precoFinal = precoDigitado;
    } else if (produtoSelecionado._preco_digitado !== undefined) {
      const custoMinimo = (produtoSelecionado.preco_custo_calculado || 0) * fatorConversao;
      if (produtoSelecionado._preco_digitado < custoMinimo) {
        showFeedback('error', `Preço não pode ser menor que o custo da unidade escolhida (R$ ${custoMinimo.toFixed(2)})`, 3000);
        return;
      }
      precoFinal = produtoSelecionado._preco_digitado;
    }

    const itemKey = produtoSelecionado._item_key || getItemUnitKey(produtoSelecionado.id, produtoSelecionado.unidade_medida);
    const itemExistente = carrinho.find((item) => item.item_key === itemKey);

    if (itemExistente) {
      setCarrinho(carrinho.map((item) => {
        if (item.item_key !== itemKey) return item;
        const novaQuantidade = item.quantidade + quantidade;
        return {
          ...item,
          quantidade: novaQuantidade,
          quantidade_base: calculateBaseQuantity(novaQuantidade, item.fator_conversao || fatorConversao),
          total: novaQuantidade * item.preco_unitario,
        };
      }));
    } else {
      const unidadeSelecionada = produtoSelecionado.unidade_medida || pickDefaultSaleUnit(produtoSelecionado, tabelaPreco?.fator_ajuste || 1)?.unidade || 'UN';
      setCarrinho([...carrinho, {
        produto_id: produtoSelecionado.id,
        produto_nome: produtoSelecionado.nome,
        codigo_interno: produtoSelecionado.codigo_interno || '',
        quantidade: quantidade,
        unidade_medida: unidadeSelecionada,
        fator_conversao: fatorConversao,
        quantidade_base: quantidadeBase,
        item_key: itemKey,
        preco_unitario: precoFinal,
        preco_unitario_praticado: precoFinal,
        custo_unitario_momento: produtoSelecionado.preco_custo_calculado || 0,
        total: quantidade * precoFinal,
        estoque_disponivel: produtoSelecionado.estoque_atual,
        imagem_url: produtoSelecionado.imagem_url || null,
        preco_livre: produtoSelecionado.preco_livre || false,
        preco_original_tabela: precoFinal
      }]);
    }

    showFeedback('success', `${produtoSelecionado.nome} - ${quantidade} ${produtoSelecionado.unidade_medida || 'UN'}`, 1500);

    setProdutoSelecionado(null);
    setQuantidadeAtual('');
    quantidadeInputRef.current?.blur();
    setTimeout(() => inputProdutoRef.current?.focus(), 100);
  };

  // Original handleBuscaKeyDown - now merged into the main handleKeyDown for product input
  const handleKeyDown = (e) => {// This will be the local handler for the product search input
    if (e.key === 'Tab' && showSuggestions && produtosSugeridos.length > 0) {
      e.preventDefault();
      quantidadeInputRef.current?.focus();
    }
    // The Enter key handling for selecting suggestions is in the global useEffect listener
  };

  const handleQuantidadeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Se preço livre está ativado, focar no campo de preço em vez de confirmar
      if (produtoSelecionado?.preco_livre) {
        setTimeout(() => precoLivreInputRef.current?.focus(), 100);
        setTimeout(() => precoLivreInputRef.current?.select(), 100);
      } else {
        handleConfirmarAdicao();
      }
    }
  };

  const handleUpdateQuantity = (itemKey, novaQuantidade) => {
    if (novaQuantidade <= 0) {
      setCarrinho(carrinho.filter((item) => item.item_key !== itemKey));
    } else {
      const item = carrinho.find((i) => i.item_key === itemKey);
      const quantidadeBase = calculateBaseQuantity(novaQuantidade, item?.fator_conversao || 1);
      if (vendaSemEstoquePermitida || item && quantidadeBase <= item.estoque_disponivel) {
        setCarrinho(carrinho.map((item) =>
        item.item_key === itemKey ?
        { ...item, quantidade: novaQuantidade, quantidade_base: quantidadeBase, total: novaQuantidade * item.preco_unitario } :
        item
        ));
      } else {
        showFeedback('error', 'Estoque insuficiente', 3000);
      }
    }
  };

  const handleUpdatePrecoLivre = (itemKey, novoPreco) => {
    setCarrinho(carrinho.map((i) =>
      i.item_key === itemKey
        ? { ...i, _preco_editando: novoPreco }
        : i
    ));
  };

  const handleBlurPrecoLivre = (itemKey) => {
    const item = carrinho.find((i) => i.item_key === itemKey);
    if (!item) return;
    const raw = item._preco_editando ?? String(item.preco_unitario_praticado ?? '');
    const preco = parseFloat(String(raw).replace(',', '.'));
    const custoMinimo = (item.custo_unitario_momento || 0) * (item.fator_conversao || 1);
    if (!Number.isFinite(preco)) {
      setCarrinho(carrinho.map((i) =>
        i.item_key === itemKey ? { ...i, _preco_editando: undefined } : i
      ));
      return;
    }
    if (preco < custoMinimo) {
      showFeedback('error', `Preço mínimo: R$ ${custoMinimo.toFixed(2)} (custo)`, 2500);
      setCarrinho(carrinho.map((i) =>
        i.item_key === itemKey
          ? { ...i, _preco_editando: undefined }
          : i
      ));
      return;
    }
    setCarrinho(carrinho.map((i) =>
      i.item_key === itemKey
        ? {
            ...i,
            preco_unitario: preco,
            preco_unitario_praticado: preco,
            total: i.quantidade * preco,
            _preco_editando: undefined,
          }
        : i
    ));
  };

  const handleRemoveItem = (itemKey) => {
    setCarrinho(carrinho.filter((item) => item.item_key !== itemKey));
  };

  const handleLimparCarrinho = () => {
    setCarrinho([]);
    setProdutoSelecionado(null);
    setValorAjuste(0);
    setAjustePercentual('');
    setAjusteValor('');
    setTipoAjuste('desconto');
    setRascunhoEmEdicaoId(null);
    showFeedback('info', 'Carrinho limpo', 2000);
  };

  const handleAvancarParaCliente = () => {
    if (carrinho.length === 0) {
      showFeedback('error', 'Adicione produtos antes de continuar', 3000);
      return;
    }
    if (ajusteExcedido) {
      showFeedback('error', `Desconto excede seu limite de ${currentUser?.limite_desconto || 0}%`, 3000);
      return;
    }
    setShowClienteDialog(true);
    setShowNovoClienteForm(false);
    setBuscaCliente('');
    setClientesFiltrados([]);
    setClienteSelecionadoIndex(0);
  };

  const handleSelecionarCliente = (cliente) => {
    setClienteSelecionado(cliente);
    setBuscaCliente('');
    setClientesFiltrados([]);
    setClienteSelecionadoIndex(0);
  };

  const handleCriarNovoCliente = async (e) => {
    e.preventDefault();

    if (!novoCliente.nome) {
      showFeedback('error', 'Nome é obrigatório', 3000);
      return;
    }

    try {
      const clienteCriado = await Terceiro.create({
        nome: novoCliente.nome,
        telefone: novoCliente.telefone,
        endereco: novoCliente.endereco,
        cpf_cnpj: novoCliente.numero_documento,
        tipo: 'Cliente',
        perfil: novoCliente.perfil || undefined,
        data_nascimento: novoCliente.data_nascimento || undefined,
        observacoes: novoCliente.observacoes || undefined,
        ativo: true
      });

      setClienteSelecionado(clienteCriado);
      setClientes([...clientes, clienteCriado]);
      setNovoCliente({
        nome: '',
        telefone: '',
        endereco: '',
        tipo_documento: 'CPF',
        numero_documento: '',
        perfil: '',
        data_nascimento: '',
        observacoes: ''
      });
      setShowNovoClienteForm(false);

      showFeedback('success', 'Cliente cadastrado!', 2000);
    } catch (error) {
      showFeedback('error', `Erro: ${error.message}`, 3000);
    }
  };

  // Cria cliente rápido apenas com nome (sem form completo)
  const handleCriarClienteRapido = async (nome) => {
    try {
      const criado = await base44.entities.Terceiro.create({ nome, tipo: 'Cliente', ativo: true });
      setClienteSelecionado(criado);
      setClientes(prev => [...prev, criado]);
      setBuscaCliente('');
      showFeedback('success', `Cliente "${nome}" registrado!`, 2000);
    } catch (err) {
      showFeedback('error', `Erro: ${err.message}`, 3000);
    }
  };

  const handleFinalizarPreVenda = async () => {
    if (carrinho.length === 0) {
      showFeedback('error', 'Adicione produtos antes de finalizar', 3000);
      return;
    }

    if (ajusteExcedido) {
      showFeedback('error', `Desconto excede seu limite de ${currentUser.limite_desconto}%`, 3000);
      return;
    }

    setIsProcessing(true);

    try {
      let rascunhoFinal;

      // Se está editando um rascunho existente, atualizar
      if (rascunhoEmEdicaoId) {
        const rascunhoExistente = await base44.entities.RascunhoPedidoVenda.get(rascunhoEmEdicaoId);
        
        const clienteParaUsar = clienteSelecionado || {
          id: rascunhoExistente?.cliente_id ?? null,
          nome: rascunhoExistente?.cliente_nome || 'Avulso',
        };
        const rascunhoData = {
          cliente_id: clienteParaUsar.id,
          cliente_nome: clienteParaUsar.nome,
          vendedor_id: currentUser.id,
          vendedor_nome: currentUser.full_name,
          tabela_preco_id: tabelaPreco?.id,
          status: 'Aguardando Caixa',
          metodo_entrega: metodoEntrega,
          itens: carrinho.map((item) => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            unidade_medida: item.unidade_medida,
            fator_conversao: item.fator_conversao,
            quantidade_base: item.quantidade_base,
            preco_unitario_praticado: item.preco_unitario_praticado,
            custo_unitario_momento: item.custo_unitario_momento || 0,
            total: item.total
          })),
          subtotal,
          valor_desconto: tipoAjuste === 'desconto' ? valorAjusteCalculado : 0,
          valor_frete: 0,
          valor_total: valorTotal
        };

        await base44.entities.RascunhoPedidoVenda.update(rascunhoEmEdicaoId, rascunhoData);
        rascunhoFinal = {
          ...rascunhoExistente,
          ...rascunhoData,
          id: rascunhoEmEdicaoId
        };

        showFeedback('success', `Senha ${rascunhoExistente.senha_atendimento.slice(-4)} atualizada`, 3000);
      } else {
        // Criar novo rascunho
        const hoje = new Date();
        const ano = String(hoje.getFullYear()).slice(-2);
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const prefixoData = `${ano}${mes}${dia}`;

        const todosRascunhos = await base44.entities.RascunhoPedidoVenda.list();
        const rascunhosHoje = todosRascunhos.filter(r => 
          r.senha_atendimento?.startsWith(prefixoData)
        );
        const proximoSequencial = rascunhosHoje.length + 1;
        const senhaAtendimento = `${prefixoData}${String(proximoSequencial).padStart(3, '0')}`;

        const clienteParaUsar = clienteSelecionado || { id: null, nome: 'Avulso' };
        const rascunhoData = {
        senha_atendimento: senhaAtendimento,
        tipo: 'PDV',
        cliente_id: clienteParaUsar.id,
        cliente_nome: clienteParaUsar.nome,
          vendedor_id: currentUser.id,
          vendedor_nome: currentUser.full_name,
          tabela_preco_id: tabelaPreco?.id,
          status: 'Aguardando Caixa',
          metodo_entrega: metodoEntrega,
          itens: carrinho.map((item) => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            unidade_medida: item.unidade_medida,
            fator_conversao: item.fator_conversao,
            quantidade_base: item.quantidade_base,
            preco_unitario_praticado: item.preco_unitario_praticado,
            custo_unitario_momento: item.custo_unitario_momento || 0,
            total: item.total
          })),
          subtotal,
          valor_desconto: tipoAjuste === 'desconto' ? valorAjusteCalculado : 0,
          valor_frete: 0,
          valor_total: valorTotal
        };

        rascunhoFinal = await base44.entities.RascunhoPedidoVenda.create(rascunhoData);
        showFeedback('success', `Senha ${senhaAtendimento.slice(-4)} enviada ao caixa`, 3000);
      }

      setUltimaPreVenda(rascunhoFinal);
      setShowConfirmarImpressao(true);

      setCarrinho([]);
      setClienteSelecionado(null);
      setShowClienteDialog(false);
      setMetodoEntrega('Retirada');
      setValorAjuste(0);
      setAjustePercentual('');
      setAjusteValor('');
      setTipoAjuste('desconto');
      setRascunhoEmEdicaoId(null);

      setTimeout(() => inputProdutoRef.current?.focus(), 500);
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      showFeedback('error', `Erro: ${error.message}`, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCarregarOrcamento = (itensOrcamento, orcamento) => {
    setCarrinho(normalizeCartItems(itensOrcamento));
    // Reset desconto para evitar herança da venda anterior
    setValorAjuste(0);
    setAjustePercentual('');
    setAjusteValor('');
    setTipoAjuste('desconto');
    setTipoValorAjuste('percentual');
    showFeedback('success', `Orçamento de ${orcamento.cliente_nome || 'cliente'} carregado`, 2000);
  };

  const handleSair = () => {
    const confirmExit = confirm('Deseja sair do PDV e voltar à tela anterior?');
    if (confirmExit) {
      handleClose();
    }
  };

  const handleReeditarRascunho = async () => {
    if (!senhaReeditar || senhaReeditar.length < 4) {
      showFeedback('error', 'Digite os 4 últimos dígitos da senha', 3000);
      return;
    }

    try {
      // Buscar todos os rascunhos
      const todosRascunhos = await base44.entities.RascunhoPedidoVenda.list();
      
      // Filtrar pela senha (últimos 4 dígitos)
      const rascunhoEncontrado = todosRascunhos.find(r => 
        r.senha_atendimento?.slice(-4) === senhaReeditar
      );

      if (!rascunhoEncontrado) {
        showFeedback('error', 'Senha não encontrada', 3000);
        return;
      }

      // Permitir edição apenas se ainda não foi convertido, cancelado ou expirado
      const statusEditaveis = ['Aguardando Caixa', 'Em Edição', 'Retornado para Edição', 'Criado'];
      if (!statusEditaveis.includes(rascunhoEncontrado.status)) {
        showFeedback('error', 'Esta senha não pode mais ser editada', 3000);
        return;
      }

      // Recarregar o carrinho com os itens do rascunho
      const itensCarrinho = normalizeCartItems(rascunhoEncontrado.itens.map(item => ({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        codigo_interno: item.codigo_interno || '',
        quantidade: item.quantidade,
        unidade_medida: item.unidade_medida || 'UN',
        fator_conversao: item.fator_conversao || 1,
        quantidade_base: item.quantidade_base,
        preco_unitario: item.preco_unitario_praticado,
        preco_unitario_praticado: item.preco_unitario_praticado,
        custo_unitario_momento: item.custo_unitario_momento || 0,
        total: item.total,
        estoque_disponivel: 999
      })));
      
      setCarrinho(itensCarrinho);
      
      // Carregar cliente se existir
      if (rascunhoEncontrado.cliente_id) {
        const cliente = await base44.entities.Terceiro.get(rascunhoEncontrado.cliente_id);
        setClienteSelecionado(cliente);
      }
      
      // Definir método de entrega
      if (rascunhoEncontrado.metodo_entrega) {
        setMetodoEntrega(rascunhoEncontrado.metodo_entrega);
      }
      
      // Definir desconto se houver
      if (rascunhoEncontrado.valor_desconto > 0) {
        setTipoAjuste('desconto');
        setValorAjuste(rascunhoEncontrado.valor_desconto);
        setAjusteValor(rascunhoEncontrado.valor_desconto.toFixed(2));
        setTipoValorAjuste('valor');
        setAjustePercentual('');
      } else {
        setValorAjuste(0);
        setAjustePercentual('');
        setAjusteValor('');
        setTipoAjuste('desconto');
        setTipoValorAjuste('percentual');
      }
      // Armazenar ID para atualização posterior
      setRascunhoEmEdicaoId(rascunhoEncontrado.id);
      
      // Atualizar status do rascunho para "Em Edição"
      await base44.entities.RascunhoPedidoVenda.update(rascunhoEncontrado.id, {
        status: 'Em Edição'
      });
      
      setShowReeditarDialog(false);
      setSenhaReeditar('');
      showFeedback('success', `Editando senha ${senhaReeditar}`, 3000);
      setTimeout(() => inputProdutoRef.current?.focus(), 500);
    } catch (error) {
      console.error('Erro ao buscar rascunho:', error);
      showFeedback('error', 'Erro ao buscar rascunho', 3000);
    }
  };

  const screenShellBg = overlayMode ? 'bg-muted dark:bg-background' : 'bg-muted/40 dark:bg-background';

  return (
    <CaixaOverlayStackProvider active={overlayMode}>
    <div className={`${overlayMode || inAppLayout ? 'h-full min-h-0' : 'h-screen'} flex flex-col ${screenShellBg} relative`}>
      {/* Feedback Inline - Glacial Style */}
      <AnimatePresence>
        {feedback.message &&
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 ${overlayMode ? QUICK_ACCESS_NESTED_CHILD_DIALOG_CLASS : 'z-[100]'} px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-sm ${
          feedback.type === 'success' ? 'bg-emerald-500/90 text-white' :
          feedback.type === 'error' ? 'bg-red-500/90 text-white' :
          'bg-muted/90 text-white'}`
          }>

            {feedback.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header */}
      <div className={`${screenShellBg} px-3 md:px-5 pt-3 md:pt-5 pb-2 md:pb-3 flex-shrink-0`}>
        <div className="rounded-[28px] bg-card dark:bg-background shadow-sm px-4 py-3 md:px-5 md:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center shadow-sm shrink-0">
                <ShoppingCart className="w-4.5 h-4.5 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground dark:text-muted-foreground uppercase tracking-[0.18em]">Operação de vendas</p>
                <h1 className="text-xl md:text-2xl font-semibold text-foreground dark:text-white leading-tight font-glacial">PDV Vendedor</h1>
                {rascunhoEmEdicaoId && (
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium">Editando</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setShowOrcamentosRecentes(true)}
                className="h-9 w-9 rounded-2xl bg-muted dark:bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted dark:hover:bg-muted" title="Orçamentos recentes">
                <FileText className="w-4 h-4 stroke-[1.5]" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowReeditarDialog(true)}
                className="h-9 w-9 rounded-2xl bg-muted dark:bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted dark:hover:bg-muted" title="Reeditar rascunho">
                <Edit className="w-4 h-4 stroke-[1.5]" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSair}
                className="h-9 w-9 rounded-2xl bg-muted dark:bg-card text-muted-foreground hover:text-foreground/90 hover:bg-muted dark:hover:bg-muted">
                <Undo2 className="w-4 h-4 stroke-[1.5]" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden pb-20 md:pb-0">
        {/* Área Principal */}
        <div className={`flex-1 flex flex-col px-3 md:px-5 pb-28 md:pb-5 overflow-auto ${screenShellBg}`}>
          {/* Busca de Produto */}
          <div className="mb-4 md:mb-6 flex-shrink-0" ref={suggestionsRef}>
            <div className="flex gap-2.5 w-full">
                <div className="flex-1 relative min-w-0 rounded-2xl overflow-hidden">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <Input
                  ref={inputProdutoRef}
                  placeholder="Nome ou código (espaço ou ; para combinar termos)..."
                  className="w-full pl-12 pr-14 bg-card dark:bg-secondary border-0 outline-none ring-0 shadow-sm rounded-2xl text-foreground h-14 text-base focus:ring-0 focus:border-transparent focus:outline-none focus-visible:ring-0 focus-visible:outline-none active:outline-none appearance-none [-webkit-tap-highlight-color:transparent] placeholder:text-muted-foreground"
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus={false} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowBarcodeScanner(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:text-muted-foreground hover:bg-muted dark:hover:bg-card rounded-xl">
                    <Camera className="w-5 h-5" />
                  </Button>
                </div>
                <div className="w-20 md:w-24 shrink-0">
                  <Input
                  ref={quantidadeInputRef}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Qtd"
                  className="w-full bg-card dark:bg-secondary border-0 outline-none ring-0 shadow-sm rounded-2xl text-foreground h-14 text-center text-lg font-bold focus:ring-0 focus:border-transparent focus:outline-none focus-visible:ring-0 focus-visible:outline-none active:outline-none appearance-none [-webkit-tap-highlight-color:transparent]"
                  value={quantidadeAtual}
                  onChange={(e) => setQuantidadeAtual(e.target.value)}
                  onFocus={selectAllOnFocus}
                  onKeyDown={handleQuantidadeKeyDown}
                  min="0.01"
                  disabled={!produtoSelecionado} />
                </div>
            </div>
            {showSuggestions && produtosSugeridos.length > 0 &&
            <div
              ref={suggestionsListRef}
              className="absolute z-50 left-0 right-0 mt-2 bg-card dark:bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto border border-border/40 dark:border-border/40">
                  <div className="sticky top-0 bg-card dark:bg-background px-4 py-3 border-b border-border/40 dark:border-border/40 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {produtosSugeridos.length} resultado{produtosSugeridos.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted-foreground hidden desktop-layout:block">Tab para quantidade · Enter para adicionar</span>
                  </div>
                  {produtosSugeridos.map((produto, index) => {
                const mult = tabelaPreco?.fator_ajuste || 1;
                const opcoesVenda = buildSaleUnitOptions(produto, mult);
                const saleOpt = pickDefaultSaleUnit(produto, mult) || opcoesVenda[0];
                const precoTabela = saleOpt?.valor_unitario ?? produto.preco_venda_padrao * mult;
                const variasUnidades = opcoesVenda.length > 1;
                const estoqueStatus = produto.estoque_atual <= 0 ? 'sem' : produto.estoque_atual <= 5 ? 'baixo' : 'ok';
                const estoqueColor = estoqueStatus === 'sem' ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : estoqueStatus === 'baixo' ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
                return (
                  <div key={produto.id}
                    ref={(el) => { suggestionItemRefs.current[index] = el; }}
                    className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors border-b border-border/30 dark:border-border/40 last:border-b-0 ${
                    index === produtoSelecionadoIndex ? 'bg-muted/40 dark:bg-card' : 'hover:bg-muted/40 dark:hover:bg-muted/60'}`}
                    onClick={() => handleSelecionarProduto(produto)}>
                    <ProdutoThumb
                      produto={produto}
                      size="md"
                      roundedClassName="rounded-xl"
                      fallbackClassName={estoqueStatus === 'sem' ? 'bg-red-50 dark:bg-red-900/20' : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-foreground dark:text-foreground leading-snug break-words whitespace-normal">{produto.nome}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">#{produto.codigo_interno || '—'}</span>
                        {variasUnidades && (
                          <span title="Várias unidades de venda" className="inline-flex items-center text-muted-foreground">
                            <Boxes className="w-3.5 h-3.5" aria-hidden />
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estoqueColor}`}>
                          {formatEstoqueDisponivelLabel(produto)}
                        </span>
                        {variasUnidades && (
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline ml-auto sm:ml-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnitSelector({ open: true, product: produto });
                            }}
                          >
                            Outra unidade
                          </button>
                        )}
                        <span className="text-base font-bold text-foreground dark:text-foreground ml-auto tabular-nums">
                          R$ {precoTabela.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  </div>);
              })}
                </div>
            }
                {produtoSelecionado &&
                <div className="mt-3 p-4 bg-card dark:bg-background rounded-2xl shadow-sm border border-border/40 dark:border-border/40 space-y-3">
                <div className="flex items-center gap-3">
                <ProdutoThumb produto={produtoSelecionado} size="md" roundedClassName="rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground dark:text-foreground break-words whitespace-normal leading-snug">{produtoSelecionado.nome}</p>
                  {produtoSelecionado.preco_livre ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">Preço livre</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground dark:text-muted-foreground">R$</span>
                        <input autoComplete="off"
                          ref={precoLivreInputRef}
                          type="text" inputMode="decimal"
                          placeholder={((produtoSelecionado._preco_sugerido_unitade ?? (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0).toFixed(2)}
                          defaultValue={((produtoSelecionado._preco_sugerido_unitade ?? (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0).toFixed(2)}
                          onChange={(e) => {
                            setProdutoSelecionado({...produtoSelecionado, _preco_digitado_raw: e.target.value});
                          }}
                          onFocus={selectAllOnFocus}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConfirmarAdicao();
                            }
                          }}
                          className="w-full pl-8 h-10 bg-muted/40 dark:bg-muted/70 rounded-xl text-sm text-right border-0 outline-none ring-0 shadow-sm focus:ring-0 focus:outline-none focus-visible:ring-0 text-foreground dark:text-foreground font-semibold"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">× {parseFloat(quantidadeAtual) || 1} {produtoSelecionado.unidade_medida || 'UN'}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      R$ {((produtoSelecionado._preco_sugerido_unitade ?? (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0).toFixed(2)} × {parseFloat(quantidadeAtual) || 1} {produtoSelecionado.unidade_medida || 'UN'}
                      {' '}= <span className="font-semibold text-foreground">R$ {(((produtoSelecionado._preco_sugerido_unitade ?? (produtoSelecionado.preco_venda_padrao * (tabelaPreco?.fator_ajuste || 1))) || 0) * (parseFloat(quantidadeAtual) || 1)).toFixed(2)}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Equivale a {produtoSelecionado.fator_conversao || 1} {produtoSelecionado.unidade_principal || 'UN'} por {produtoSelecionado.unidade_medida || 'UN'}</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => { setProdutoSelecionado(null); setQuantidadeAtual(''); }}
                    variant="ghost" size="sm" className="h-10 px-3 text-muted-foreground hover:text-muted-foreground">
                    <X className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleConfirmarAdicao}
                    className="flex-1 h-10 p38-btn-primary text-sm rounded-xl shadow-none">
                    + Adicionar
                  </Button>
                </div>
                </div>
                }
            </div>
        </div>

        {/* Sidebar Carrinho - Desktop Only */}
        <div className={`hidden desktop-layout:flex w-80 lg:w-[22rem] ${screenShellBg} px-0 pr-5 pb-5 flex-col flex-shrink-0`}>
          <div className="rounded-[28px] bg-card dark:bg-background shadow-sm flex flex-col min-h-0 h-full overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-semibold text-foreground font-glacial">Carrinho</h2>
              {carrinho.length > 0 && (
                <span className="text-xs bg-muted dark:bg-card text-muted-foreground dark:text-muted-foreground px-2.5 py-1 rounded-full">{totalItens} un · {carrinho.length} itens</span>
              )}
            </div>

          {/* Lista de Itens */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {carrinho.length === 0 ?
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted dark:bg-card flex items-center justify-center mb-3">
                  <ShoppingCart className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Carrinho vazio</p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">Busque um produto acima</p>
              </div> :
            carrinho.map((item) =>
            <div key={item.item_key} className="group p-3 bg-muted/40 dark:bg-muted/60 rounded-xl hover:bg-muted dark:hover:bg-card transition-colors">
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <ProdutoThumb
                      produto={{
                        id: item.produto_id,
                        nome: item.produto_nome,
                        imagem_url: item.imagem_url,
                      }}
                      size="sm"
                      roundedClassName="rounded-lg"
                      className="mt-0.5"
                    />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug break-words">{item.produto_nome}</p>
                        {item.codigo_interno ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/80 font-mono tracking-wide">#{item.codigo_interno}</p>
                        ) : null}
                      </div>
                      <button onClick={() => handleRemoveItem(item.item_key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 flex-shrink-0 rounded-md hover:bg-red-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Preço livre editável */}
                     {item.preco_livre && (
                       <div className="flex items-center gap-2 mb-2.5">
                         <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide whitespace-nowrap">Preço livre</span>
                         <div className="relative flex-1">
                           <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground dark:text-muted-foreground">R$</span>
                           <input autoComplete="off"
                             type="text" inputMode="decimal"
                             value={item._preco_editando ?? String(item.preco_unitario_praticado ?? '')}
                             onChange={e => handleUpdatePrecoLivre(item.item_key, e.target.value)}
                             onFocus={selectAllOnFocus}
                             onBlur={() => handleBlurPrecoLivre(item.item_key)}
                             className="w-full pl-8 h-10 bg-muted/40 dark:bg-muted/70 rounded-lg text-sm text-right border-0 outline-none ring-0 shadow-sm focus:ring-0 focus:outline-none focus-visible:ring-0 text-foreground dark:text-foreground font-semibold"
                           />
                         </div>
                       </div>
                     )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">{item.quantidade} {item.unidade_medida || 'UN'} · base: {item.quantidade_base || item.quantidade}</p>
                        <div className="flex items-center bg-card dark:bg-background rounded-lg overflow-hidden shadow-sm">
                        <button onClick={() => handleUpdateQuantity(item.item_key, item.quantidade - 1)}
                          className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted dark:hover:bg-card transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-bold w-9 text-center text-foreground">{item.quantidade}</span>
                        <button onClick={() => handleUpdateQuantity(item.item_key, item.quantidade + 1)}
                          disabled={!vendaSemEstoquePermitida && calculateBaseQuantity(item.quantidade + 1, item.fator_conversao || 1) > item.estoque_disponivel}
                          className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted dark:hover:bg-card transition-colors disabled:opacity-40">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      </div>
                      <p className="text-base font-semibold text-foreground dark:text-foreground">R$ {item.total.toFixed(2)}</p>
                    </div>
                </div>
            )
            }
          </div>

          {/* Resumo e Ações */}
          <div className="border-t border-border/40 dark:border-border/40 p-4 space-y-3 flex-shrink-0">
            <button onClick={() => setShowLostSalesForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-lg transition-colors">
              <AlertCircle className="w-3.5 h-3.5" />
              Registrar Venda Perdida
            </button>

            {/* Botão simulador de taxa - desktop */}
            {carrinho.length > 0 && (
              <button onClick={() => setShowSimuladorTaxa(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card rounded-lg transition-colors">
                <CreditCard className="w-3.5 h-3.5" />
                Ver taxa no cartão
              </button>
            )}

            <div className="space-y-2.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              {/* Desconto Two-Way */}
              <div className="bg-muted/40 dark:bg-muted/60 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Desconto</span>
                  {tabelaPreco?.percentual_desconto_maximo > 0 && (
                    <span className="text-[10px] text-muted-foreground">máx {tabelaPreco.percentual_desconto_maximo}%</span>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Input type="number" min="0" max={Math.max(currentUser?.limite_desconto || 0, tabelaPreco?.percentual_desconto_maximo || 0) || 100} step="0.01"
                      value={ajustePercentual} onChange={(e) => handleAjustePercentualChange(e.target.value)}
                      onFocus={selectAllOnFocus}
                      className="pr-6 h-10 bg-card dark:bg-background border-0 shadow-sm rounded-lg text-sm text-right focus:ring-1 focus:ring-border/40 dark:focus:ring-ring"
                      placeholder="0" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <span className="text-muted-foreground dark:text-foreground/90 text-xs">=</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                    <Input type="number" min="0" step="0.01"
                      value={ajusteValor} onChange={(e) => handleAjusteValorChange(e.target.value)}
                      onFocus={selectAllOnFocus}
                      className="pl-7 h-10 bg-card dark:bg-background border-0 shadow-sm rounded-lg text-sm focus:ring-1 focus:ring-border/40 dark:focus:ring-ring"
                      placeholder="0,00" />
                  </div>
                </div>
                {ajusteExcedido && <p className="text-xs text-red-500">Excede limite de {Math.max(currentUser?.limite_desconto || 0, tabelaPreco?.percentual_desconto_maximo || 0)}%</p>}
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-foreground dark:text-white">R$ {valorTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={handleAvancarParaCliente} disabled={carrinho.length === 0 || ajusteExcedido}
              className="w-full h-12 p38-btn-primary rounded-xl shadow-none border-0 text-base disabled:opacity-40">
              Avançar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        </div>
      </div>

      {/* Barra inferior mobile: z-[55] fica acima do Dialog (z-50) — esconder com qualquer modal full-screen */}
      {!showClienteDialog && !showReeditarDialog && !unitSelector.open && (
          <div className="pointer-events-auto fixed left-0 right-0 z-[55] flex items-center gap-2 rounded-t-[26px] border-t border-border/40 bg-card/90 px-3 pt-3 backdrop-blur-md dark:border-border/40 dark:bg-muted/95 desktop-layout:hidden p38-bottom-dock shadow-[0_-10px_26px_rgba(15,23,42,0.08)] dark:shadow-[0_-10px_26px_rgba(0,0,0,0.32)] pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground leading-none mb-0.5">Total</div>
              <div className="text-xl font-bold text-foreground dark:text-white leading-tight">R$ {valorTotal.toFixed(2).replace('.', ',')}</div>
            </div>
            <button onClick={() => setShowLostSalesForm(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </button>
            {carrinho.length > 0 && (
              <button onClick={() => setShowSimuladorTaxa(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted dark:hover:bg-muted/80 flex-shrink-0">
                <CreditCard className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCarrinhoMobile(true)}
              aria-label="Abrir carrinho"
              className="relative w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted dark:hover:bg-muted/80 flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
              {carrinho.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-muted text-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center pointer-events-none">
                  {carrinho.length}
                </span>
              )}
            </button>
            <button onClick={handleAvancarParaCliente} disabled={carrinho.length === 0 || ajusteExcedido}
              className="flex items-center gap-1.5 h-10 px-4 bg-primary/20 border border-primary/35 hover:bg-primary/30 text-foreground font-semibold text-sm rounded-xl disabled:opacity-40 flex-shrink-0 shadow-none">
              <UserPlus className="w-4 h-4" />
              Cliente
            </button>
          </div>
      )}

      {/* Dialog de cliente - GLACIAL PROTOCOL */}
      <Dialog open={showClienteDialog} onOpenChange={setShowClienteDialog}>
        <CaixaDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card dark:bg-background text-foreground dark:text-foreground p-6 rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-border/40 dark:border-border/40">
            <DialogTitle className="text-xl font-medium text-foreground dark:text-white">Selecionar Cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!showNovoClienteForm ?
            <>
                <div className="space-y-2">
                  <Label className="text-sm font-normal text-muted-foreground dark:text-muted-foreground">Buscar Cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                    placeholder="Digite nome, documento ou telefone..."
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    className="pl-11 h-14 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl focus:ring-2 focus:ring-border/40 dark:focus:ring-ring transition-all text-base" />

                  </div>

                  {/* Lista de clientes filtrados */}
                  {clientesFiltrados.length > 0 &&
                <div className="mt-2 max-h-64 overflow-y-auto border border-border/40 dark:border-border/40 rounded-xl bg-card dark:bg-card shadow-sm">
                      {clientesFiltrados.map((cliente, index) =>
                  <div
                    key={cliente.id}
                    className={`p-4 hover:bg-muted/40 dark:hover:bg-muted/50 cursor-pointer border-b border-border/40 dark:border-border/40 last:border-b-0 transition-colors flex justify-between items-center ${
                    clienteSelecionado?.id === cliente.id ? 'bg-muted/40 dark:bg-muted/50' : ''} ${

                    index === clienteSelecionadoIndex ? 'bg-muted/40 dark:bg-muted/50' : ''}`
                    }
                    onClick={() => handleSelecionarCliente(cliente)}>

                          <div>
                            <p className="font-semibold text-foreground dark:text-foreground text-base">{cliente.nome}</p>
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">
                              {cliente.cpf_cnpj || 'Sem doc'} • {cliente.telefone || 'Sem tel'}
                            </p>
                          </div>
                          {clienteSelecionado?.id === cliente.id &&
                    <div className="w-2 h-2 rounded-full bg-background dark:bg-card"></div>
                    }
                        </div>
                  )}
                    </div>
                }

                  {!isMobile && clientesFiltrados.length > 0 &&
                <p className="text-xs text-muted-foreground dark:text-muted-foreground px-1">
                      Use as setas ↑↓ para navegar e Enter para selecionar
                    </p>
                }
                </div>

                {clienteSelecionado &&
              <div className="p-4 bg-muted/40 dark:bg-card rounded-xl border border-border/40 dark:border-border/40 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1">Selecionado</p>
                       <p className="text-lg font-semibold text-foreground dark:text-white">{clienteSelecionado.nome}</p>
                       <p className="text-sm text-muted-foreground dark:text-muted-foreground">{clienteSelecionado.telefone}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setClienteSelecionado(null)}>
                      <X className="w-5 h-5 text-muted-foreground" />
                    </Button>
                  </div>
              }

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/40 dark:border-border/40" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card dark:bg-background px-4 text-muted-foreground dark:text-muted-foreground font-medium tracking-widest">OU</span>
                  </div>
                </div>

                {/* Criação rápida por nome */}
                {buscaCliente.trim().length >= 2 && clientesFiltrados.length === 0 && (
                  <button
                    onClick={() => handleCriarClienteRapido(buscaCliente.trim())}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 dark:bg-card rounded-xl text-left hover:bg-muted dark:hover:bg-muted transition-colors">
                    <UserPlus className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground dark:text-muted-foreground">Usar "{buscaCliente.trim()}" como novo cliente</p>
                      <p className="text-xs text-muted-foreground">Cadastro rápido · detalhes podem ser adicionados depois</p>
                    </div>
                  </button>
                )}

                <Button
                onClick={() => {
                  setShowNovoClienteForm(true);
                  setTimeout(() => clienteNomeRef.current?.focus(), 100);
                }}
                variant="outline"
                className="w-full h-14 text-base font-medium border border-border/40 dark:border-border/40 text-foreground/90 dark:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card rounded-xl transition-all">
                  <UserPlus className="w-5 h-5 mr-2 text-muted-foreground" />
                  {isMobile ? 'Cadastrar Novo Cliente' : 'Cadastrar Novo Cliente (F2)'}
                </Button>

                {/* Método de Entrega */}
                <div className="pt-4">
                  <Label className="text-sm font-normal mb-3 block text-muted-foreground dark:text-muted-foreground">Método de Entrega</Label>
                  <RadioGroup value={metodoEntrega} onValueChange={setMetodoEntrega} className="space-y-1">
                    <div className={`flex items-center space-x-4 p-3 rounded-xl transition-all cursor-pointer group ${
                  metodoEntrega === 'Retirada' ?
                  'bg-muted dark:bg-card' :
                  'hover:bg-muted/40 dark:hover:bg-muted/50'}`
                  } onClick={() => setMetodoEntrega('Retirada')}>
                      <RadioGroupItem value="Retirada" id="ret" className="border-border/40 text-foreground w-5 h-5 mt-0.5" />
                      <Label htmlFor="ret" className="flex items-center gap-3 cursor-pointer flex-1 text-foreground dark:text-foreground font-normal text-base">
                        <div className={`p-2 rounded-lg ${metodoEntrega === 'Retirada' ? 'bg-card dark:bg-muted shadow-sm' : 'bg-muted dark:bg-card'}`}>
                          <Store className={`w-5 h-5 ${metodoEntrega === 'Retirada' ? 'text-foreground dark:text-white' : 'text-muted-foreground'}`} />
                        </div>
                        Retirada no Balcão
                      </Label>
                    </div>
                    
                    <div className={`flex items-center space-x-4 p-3 rounded-xl transition-all cursor-pointer group ${
                  metodoEntrega === 'Delivery' ?
                  'bg-muted dark:bg-card' :
                  'hover:bg-muted/40 dark:hover:bg-muted/50'}`
                  } onClick={() => setMetodoEntrega('Delivery')}>
                      <RadioGroupItem value="Delivery" id="del" className="border-border/40 text-foreground w-5 h-5 mt-0.5" />
                      <Label htmlFor="del" className="flex items-center gap-3 cursor-pointer flex-1 text-foreground dark:text-foreground font-normal text-base">
                        <div className={`p-2 rounded-lg ${metodoEntrega === 'Delivery' ? 'bg-card dark:bg-muted shadow-sm' : 'bg-muted dark:bg-card'}`}>
                          <Truck className={`w-5 h-5 ${metodoEntrega === 'Delivery' ? 'text-foreground dark:text-white' : 'text-muted-foreground'}`} />
                        </div>
                        Delivery / Entrega
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </> :

            <form onSubmit={handleCriarNovoCliente} className="space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Nome Completo *</Label>
                  <Input
                  ref={clienteNomeRef}
                  placeholder="Nome do cliente..."
                  value={novoCliente.nome}
                  onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                  required
                  className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl focus:ring-2 focus:ring-border/40 dark:focus:ring-ring transition-all" />

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Telefone</Label>
                    <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={novoCliente.telefone}
                    onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                    inputMode="tel"
                    className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl" />

                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Tipo de Documento</Label>
                    <Select
                    value={novoCliente.tipo_documento}
                    onValueChange={(v) => setNovoCliente({ ...novoCliente, tipo_documento: v })}>

                      <SelectTrigger className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card dark:bg-card text-foreground dark:text-foreground border-border/40 dark:border-border/40 rounded-xl">
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="RG">RG</SelectItem>
                        <SelectItem value="CNH">CNH</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="Passaporte">Passaporte</SelectItem>
                        <SelectItem value="Doc. Estrangeiro">Doc. Estrangeiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Número do Documento</Label>
                  <Input
                  placeholder="000.000.000-00"
                  value={novoCliente.numero_documento}
                  onChange={(e) => setNovoCliente({ ...novoCliente, numero_documento: e.target.value })}
                  className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl" />

                </div>

                <div>
                    <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Endereço</Label>
                    <Textarea
                  placeholder="Rua, número, bairro, cidade..."
                  value={novoCliente.endereco}
                  onChange={(e) => setNovoCliente({ ...novoCliente, endereco: e.target.value })}
                  rows={3}
                  className="bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl resize-none py-3" />

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Perfil do Cliente</Label>
                      <Select
                    value={novoCliente.perfil}
                    onValueChange={(v) => setNovoCliente({ ...novoCliente, perfil: v })}>

                        <SelectTrigger className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card dark:bg-card text-foreground dark:text-foreground border-border/40 dark:border-border/40 rounded-xl">
                          <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                          <SelectItem value="Profissional/Instalador">Profissional/Instalador</SelectItem>
                          <SelectItem value="Empresa/Loja">Empresa/Loja</SelectItem>
                          <SelectItem value="Construtora/Obra">Construtora/Obra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Data de Nascimento</Label>
                      <Input
                    type="date"
                    value={novoCliente.data_nascimento}
                    onChange={(e) => setNovoCliente({ ...novoCliente, data_nascimento: e.target.value })}
                    className="h-12 bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl" />

                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground/90 dark:text-muted-foreground mb-1.5 block">Observações</Label>
                    <Textarea
                  placeholder="Informações adicionais sobre o cliente..."
                  value={novoCliente.observacoes}
                  onChange={(e) => setNovoCliente({ ...novoCliente, observacoes: e.target.value })}
                  rows={2}
                  className="bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl resize-none" />

                  </div>

                  <div className="flex gap-3 pt-4">
                  <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNovoClienteForm(false)}
                  className="flex-1 h-12 border-border/40 dark:border-border/40 text-foreground/90 dark:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card rounded-xl font-medium">

                    Voltar
                  </Button>
                  <Button
                  type="submit"
                  className="flex-1 h-12 p38-btn-primary rounded-xl">

                    <UserPlus className="w-5 h-5 mr-2" />
                    Cadastrar
                  </Button>
                </div>
              </form>
            }
          </div>

          {!showNovoClienteForm &&
          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 mt-2">
              <Button
              variant="outline"
              onClick={() => setShowClienteDialog(false)}
              className="w-full sm:w-auto h-12 border-border/40 dark:border-border/40 text-foreground/90 dark:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card text-base font-medium rounded-xl">

                Cancelar {!isMobile && '(ESC)'}
              </Button>
              <Button
              onClick={handleFinalizarPreVenda}
              disabled={isProcessing || ajusteExcedido}
              className="bg-muted-foreground/30 hover:bg-muted dark:bg-muted dark:hover:bg-muted text-white w-full sm:w-auto h-12 text-base font-medium rounded-xl shadow-none disabled:opacity-50 border-0">

                {isProcessing ? 'Processando...' : currentUser?.pode_acessar_caixa ? 'Ir para Pagamento' : 'Enviar ao Caixa'}
              </Button>
            </DialogFooter>
          }
        </CaixaDialogContent>
      </Dialog>

      {showCarrinhoMobile &&
      <div className={`desktop-layout:hidden fixed inset-0 ${overlayMode ? QUICK_ACCESS_NESTED_DIALOG_CLASS : 'z-[70]'} ${screenShellBg} flex flex-col`}>
          {/* Header */}
          <div className="px-4 py-3 bg-card dark:bg-background border-b border-border/40 dark:border-border/40 flex items-center justify-between flex-shrink-0">
            <button onClick={() => setShowCarrinhoMobile(false)} className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted dark:hover:bg-card">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground dark:text-white">Carrinho</h2>
              <p className="text-[10px] text-muted-foreground">{totalItens} un · {carrinho.length} itens</p>
            </div>
            <div className="w-9" />
          </div>

          {/* Lista de Itens */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {carrinho.length === 0 ?
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-card dark:bg-background shadow-sm flex items-center justify-center mb-4">
                  <ShoppingCart className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
                </div>
                <p className="text-base text-muted-foreground">Carrinho vazio</p>
              </div> :
          carrinho.map((item) =>
          <div key={item.item_key} className="p-3.5 bg-card dark:bg-background rounded-2xl shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <ProdutoThumb
                      produto={{
                        id: item.produto_id,
                        nome: item.produto_nome,
                        imagem_url: item.imagem_url,
                      }}
                      size="md"
                      roundedClassName="rounded-xl"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground dark:text-foreground leading-snug break-words">{item.produto_nome}</p>
                        {item.codigo_interno ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/80 font-mono tracking-wide">#{item.codigo_interno}</p>
                        ) : null}
                      </div>
                      {item.preco_livre ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">Preço livre</span>
                          <div className="relative flex-1 max-w-[160px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground dark:text-muted-foreground">R$</span>
                            <input autoComplete="off"
                              type="text" inputMode="decimal"
                              value={item._preco_editando ?? String(item.preco_unitario_praticado ?? '')}
                              onChange={e => handleUpdatePrecoLivre(item.item_key, e.target.value)}
                              onFocus={selectAllOnFocus}
                              onBlur={() => handleBlurPrecoLivre(item.item_key)}
                              className="w-full pl-8 h-10 bg-muted/40 dark:bg-muted/70 rounded-lg text-sm text-right border-0 outline-none ring-0 shadow-sm focus:ring-0 focus:outline-none focus-visible:ring-0 text-foreground dark:text-foreground font-semibold"
                            />
                          </div>
                        </div>
                      ) : (
                         <p className="text-xs text-muted-foreground mt-0.5">{item.quantidade} {item.unidade_medida || 'UN'} × R$ {item.preco_unitario_praticado.toFixed(2).replace('.', ',')}</p>
                       )}
                    </div>
                    <button onClick={() => handleRemoveItem(item.item_key)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-400 rounded-lg flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{item.quantidade} {item.unidade_medida || 'UN'} · base: {item.quantidade_base || item.quantidade}</p>
                      <div className="flex items-center bg-muted/40 dark:bg-card rounded-xl overflow-hidden">
                      <button onClick={() => handleUpdateQuantity(item.item_key, item.quantidade - 1)}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground active:bg-muted dark:active:bg-muted">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-base font-bold w-10 text-center text-foreground dark:text-white">{item.quantidade}</span>
                      <button onClick={() => handleUpdateQuantity(item.item_key, item.quantidade + 1)}
                        disabled={!vendaSemEstoquePermitida && calculateBaseQuantity(item.quantidade + 1, item.fator_conversao || 1) > item.estoque_disponivel}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground active:bg-muted dark:active:bg-muted disabled:opacity-40">
                        <Plus className="w-4 h-4" />
                      </button>
                      </div>
                      </div>
                      <p className="text-lg font-bold text-foreground dark:text-white">R$ {item.total.toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>
          )
          }
          </div>

          {/* Footer - Resumo e Ação */}
          <div className="p-3 bg-card dark:bg-background border-t border-border/40 dark:border-border/40 space-y-3 flex-shrink-0">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>

            {/* Desconto Two-Way - Mobile */}
            <div className="bg-muted/40 dark:bg-card rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Desconto</span>
                {tabelaPreco?.percentual_desconto_maximo > 0 && (
                  <span className="text-[9px] text-muted-foreground">máx {tabelaPreco.percentual_desconto_maximo}%</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Input type="number" inputMode="decimal" min="0" max={Math.max(currentUser?.limite_desconto || 0, tabelaPreco?.percentual_desconto_maximo || 0) || 100} step="0.01"
                    value={ajustePercentual} onChange={(e) => handleAjustePercentualChange(e.target.value)}
                    onFocus={selectAllOnFocus}
                    className="pr-6 h-10 bg-card dark:bg-background border-0 shadow-sm rounded-xl text-sm text-right focus:ring-1 focus:ring-border/40"
                    placeholder="0" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                </div>
                <span className="text-muted-foreground dark:text-foreground/90 text-xs">=</span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                  <Input type="number" inputMode="decimal" min="0" step="0.01"
                    value={ajusteValor} onChange={(e) => handleAjusteValorChange(e.target.value)}
                    onFocus={selectAllOnFocus}
                    className="pl-7 h-10 bg-card dark:bg-background border-0 shadow-sm rounded-xl text-sm focus:ring-1 focus:ring-border/40"
                    placeholder="0,00" />
                </div>
              </div>
              {ajusteExcedido && <p className="text-[10px] text-red-500">Excede limite de {Math.max(currentUser?.limite_desconto || 0, tabelaPreco?.percentual_desconto_maximo || 0)}%</p>}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold text-foreground dark:text-white">R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
            </div>

            <Button onClick={() => { setShowCarrinhoMobile(false); handleAvancarParaCliente(); }}
              disabled={carrinho.length === 0 || ajusteExcedido}
              className="w-full h-12 p38-btn-primary rounded-2xl shadow-none border-0 disabled:opacity-40">
              Avançar <ArrowRight className="w-4 h-4 ml-1.5 inline" />
            </Button>
          </div>
        </div>
      }

      <ConfirmarImpressaoDialog
        open={showConfirmarImpressao}
        onOpenChange={setShowConfirmarImpressao}
        tipo="senha"
        numero={(ultimaPreVenda?.senha_atendimento || '').slice(-4)}
        numeroCompleto={ultimaPreVenda?.senha_atendimento}
        onSim={() => setShowComprovante(true)}
        onNao={() => {}}
      />

      {ultimaPreVenda &&
      <ComprovantePreVenda
        preVenda={ultimaPreVenda}
        open={showComprovante}
        onClose={() => {
          setShowComprovante(false);
        }} />

      }

      <LostSalesForm
        open={showLostSalesForm}
        onClose={() => setShowLostSalesForm(false)}
        currentUser={currentUser} />

      <OrcamentosRecentesSheet
        isOpen={showOrcamentosRecentes}
        onClose={() => setShowOrcamentosRecentes(false)}
        currentUser={currentUser}
        tabelaPreco={tabelaPreco}
        onCarregarOrcamento={handleCarregarOrcamento}
      />


      <SimuladorTaxaCartao
        open={showSimuladorTaxa}
        onClose={() => setShowSimuladorTaxa(false)}
        valorTotal={valorTotal}
        valorDesconto={tipoAjuste === 'desconto' ? valorAjusteCalculado : 0}
      />

      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(code) => {
          setBuscaProduto(code);
          setShowBarcodeScanner(false);
          const produto = produtos.find((p) =>
          p.codigo_barras === code || productCodesMatch(p.codigo_interno, code)
          );
          if (produto) {
            handleSelecionarProduto(produto);
          }
        }} />

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="sale"
        priceMultiplier={tabelaPreco?.fator_ajuste || 1}
        onClose={() => setUnitSelector({ open: false, product: null })}
        onConfirm={(unitOption) => aplicarUnidadeAoProdutoSelecionado(unitSelector.product, unitOption)}
      />

      {/* Dialog de Reeditar Rascunho */}
      <Dialog open={showReeditarDialog} onOpenChange={setShowReeditarDialog}>
        <CaixaDialogContent className="max-w-md bg-card dark:bg-background text-foreground dark:text-foreground p-6 rounded-3xl border-0 shadow-2xl">
          <DialogHeader className="pb-4 border-b border-border/40 dark:border-border/40">
            <DialogTitle className="text-xl font-medium text-foreground dark:text-white">Reeditar Rascunho</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-normal text-muted-foreground dark:text-muted-foreground mb-2 block">
                Digite os 4 últimos dígitos da senha
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0000"
                maxLength={4}
                value={senhaReeditar}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 4);
                  setSenhaReeditar(value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleReeditarRascunho();
                  }
                }}
                className="h-16 text-center text-2xl font-bold tracking-widest bg-muted/40 dark:bg-card border-border/40 dark:border-border/40 text-foreground dark:text-foreground rounded-xl"
                autoFocus
              />
            </div>

            <p className="text-xs text-muted-foreground dark:text-muted-foreground text-center">
              A senha está impressa no comprovante do cliente
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowReeditarDialog(false);
                setSenhaReeditar('');
              }}
              className="w-full sm:w-auto h-12 border-border/40 dark:border-border/40 text-foreground/90 dark:text-muted-foreground hover:bg-muted/40 dark:hover:bg-card text-base font-medium rounded-xl">

              Cancelar
            </Button>
            <Button
              onClick={handleReeditarRascunho}
              disabled={senhaReeditar.length < 4}
              className="p38-btn-primary w-full sm:w-auto h-12 text-base rounded-xl disabled:opacity-50">

              Carregar Rascunho
            </Button>
          </DialogFooter>
        </CaixaDialogContent>
      </Dialog>
    </div>
    </CaixaOverlayStackProvider>
  );

}