import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { roundToTwoDecimals, formatCurrency as formatCurrencyValue } from '@/lib/financialUtils';
import { Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
// Dialog still used for isSolicitarEdicao modal
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { X, Save, PlusCircle, FileText, Truck, DollarSign, AlertCircle, Package, Ship, Box, MapPin, FileDown, FileUp, Download, Trash2, Calendar, Package as PackageIcon, Users, Undo, Redo, Printer, ShoppingCart, ChevronDown, MoreVertical, Clock, Send, Plus, History } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useCompactShell } from '@/hooks/use-breakpoint';
import { useProdutosListQuery, useTerceirosListQuery } from '@/hooks/useP38Entities';
import { addDays, format } from 'date-fns';
import { agora, dataHoje, formatarLogTime } from '@/components/utils/dateUtils';
import { registrarTransicao } from './transicaoHelper';
import { buildBypassAuthPayload } from '@/components/auth/operacaoAuthFlags';
import MobileProductSelector from './MobileProductSelector';
import AtualizarPrecosDialog from './AtualizarPrecosDialog';
import PendenciasPedido from './PendenciasPedido';
import LogsPedidoCompra from './LogsPedidoCompra';
import PedidoCompraFAB from './PedidoCompraFAB.jsx';
import ImportadorPedidoCompra from './ImportadorPedidoCompra.jsx';
import BannerStatusPedido from './BannerStatusPedido.jsx';
import AnexosPedidoCompra from './AnexosPedidoCompra.jsx';
import SolicitarEdicaoPDV from './SolicitarEdicaoPDV.jsx';
import LancamentosCompraPanel from './LancamentosCompraPanel.jsx';
import PainelCentralFinanceiroPedido from './PainelCentralFinanceiroPedido.jsx';
import PedidoCompraLogisticaTab from './PedidoCompraLogisticaTab.jsx';
import AbaRecepção from './AbaRecepção.jsx';
import { filterEmbarquesVisiveisParaPedido } from './embarqueFilters';
import { hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';
import {
  calcValorTotalPedidoCompra,
  cancelarLancamentosNaoPagosPedidoCompra,
  criarLancamentoAjustePedidoCompra,
  getPedidoCompraDisplayStatusFinanceiro,
  getPedidoCompraDisplayStatusFinanceiroLabel,
  listarLancamentosPedidoCompra,
  temLancamentoPagoParaPedido,
  evidenciaAprovacaoFinanceiraProcessada,
} from '@/lib/pedidoCompraFinanceiro';
import {
  pedidoAguardandoAprovacaoFinanceira,
  sincronizarPedidoCompraAprovacaoFinanceira,
} from '@/lib/aprovarPedidoCompraFinanceiro';
import {
  pickDefaultPurchaseUnit,
  normalizePurchaseItemToCommercial,
  commercialQuantityFromBase,
  resolveEffectiveQuantidadeBase,
  syncPedidoCompraItemQuantities,
  normalizeItemToCanonicalFactorOne,
  custoApresentacaoParaFator1,
  resolveValorDescontoCompraPadraoFator1,
  resolveDescontoPctCompraProduto,
  syncItemDescontoApresentacao,
  calcTotalItemCompraPedido,
  normalizePedidoCompraItemCustoLiquidoParaPersist,
} from '@/lib/productUnits';
import { savePedidoCompraItem } from '@/functions/savePedidoCompraItem';
import { uploadAnexoParaPedidoCompra } from '@/lib/uploadAnexoReferencia';
import { limparArquivoPedidoImportBridge } from '@/lib/torrePedidoImportBridge';
import { mergeLoteIntoItems, parseLoteQuantidade } from '@/lib/catalogLoteUtils';
import {
  calcularResumoNecessidadeDetalhe,
  resolverEmbarqueNecessidadeContexto,
} from '@/lib/pedidoCompraNecessidade';

export default function PedidoCompraForm({
  pedido,
  onSave,
  onClose,
  onPedidoRefresh,
  abaInicial = 'dados-gerais',
  autoOpenImporter = false,
  embarqueContextoId = null,
}) {
  const isPhone = useCompactShell();
  const { data: produtosCached, refetch: refetchProdutosCatalog } = useProdutosListQuery();
  const { data: terceirosCached } = useTerceirosListQuery();
  const draftKey = useMemo(() => pedido?.id ? `pedido-compra-draft:${pedido.id}` : 'pedido-compra-draft:novo', [pedido?.id]);
  const isRestoringDraftRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [formData, setFormData] = useState(pedido || {
    fornecedor_id: '',
    fornecedor_nome: '',
    data_emissao: format(new Date(), 'yyyy-MM-dd'),
    data_prevista_entrega: '',
    prazo_entrega_dias: 0,
    status: 'Rascunho',
    percentual_valor_embarcado: 0,
    itens: [],
    valor_itens: 0,
    valor_frete: 0,
    valor_desconto: 0,
    percentual_desconto: 0,
    valor_total: 0,
    observacoes: '',
    historico: '',
    condicoes_pagamento: '',
    tags: [],
    // Logística
    evento_logistico_id: '',
    nfe_emitida: false,
    manifesto_conferido: false,
    // Financeiro
    forma_pagamento_compra: 'Parcelado',
    num_parcelas: 1,
    intervalo_parcelas_dias: 30,
    data_primeiro_vencimento: '',
    conta_pagamento_id: ''
  });
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [selectedFornecedorIndex, setSelectedFornecedorIndex] = useState(-1);
  
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const lower = search.toLowerCase();
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(lower) || 
      (p.codigo_interno && p.codigo_interno.toLowerCase().includes(lower)) ||
      (p.codigo_barras && p.codigo_barras.includes(lower))
    ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 30);
  }, [produtos, search]);

  const filteredFornecedores = useMemo(() => {
    const sorted = [...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!searchFornecedor.trim()) return sorted;
    const lower = searchFornecedor.toLowerCase();
    return sorted.filter(f => 
      f.nome.toLowerCase().includes(lower) || 
      (f.codigo_interno && f.codigo_interno.toLowerCase().includes(lower))
    );
  }, [fornecedores, searchFornecedor]);
  const [contas, setContas] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [showAtualizarPrecos, setShowAtualizarPrecos] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSolicitarEdicaoOpen, setIsSolicitarEdicaoOpen] = useState(false);
  const [motivoEdicao, setMotivoEdicao] = useState('');
  const [isAnexosOpen, setIsAnexosOpen] = useState(false);
  const [empresa, setEmpresa] = useState(null);
  const [isNovoFornecedorOpen, setIsNovoFornecedorOpen] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState({ nome: '', email: '', telefone: '', endereco: '' });
  const [isImportadorPedidoOpen, setIsImportadorPedidoOpen] = useState(false);
  /** Quando true, o importador dispara o input file (PDF) uma vez — fluxo ?autoImportador=1 */
  const [importerLaunchPdfPicker, setImporterLaunchPdfPicker] = useState(false);
  const autoImporterHandledRef = useRef(false);
  const pendingAnexoImportRef = useRef(null);
  const anexoImportUploadedRef = useRef(false);
  const valorTotalBaseEdicaoRef = useRef(calcValorTotalPedidoCompra(pedido || {}));
  const [pedidoLogistica, setPedidoLogistica] = useState(pedido);
  const [abaPedidoDesktop, setAbaPedidoDesktop] = useState(abaInicial);
  const [lancamentosRefreshKey, setLancamentosRefreshKey] = useState(0);
  const [lancamentosPedido, setLancamentosPedido] = useState([]);
  const { toast } = useToast();

  const pedidoAtual = pedidoLogistica || pedido;
  const statusFinanceiroHeader = getPedidoCompraDisplayStatusFinanceiroLabel(
    getPedidoCompraDisplayStatusFinanceiro(pedidoAtual || {}, lancamentosPedido),
  );

  const produtosMapBasico = useMemo(() => {
    const map = {};
    (produtosCached || []).forEach((produto) => {
      if (produto?.id) map[produto.id] = produto;
    });
    return map;
  }, [produtosCached]);

  const embarqueNecessidadeContexto = useMemo(
    () => resolverEmbarqueNecessidadeContexto(pedidoAtual, embarqueContextoId, produtosMapBasico),
    [pedidoAtual, embarqueContextoId, produtosMapBasico],
  );

  const resumoNecessidadeDetalhe = useMemo(() => {
    if (!embarqueNecessidadeContexto) return null;
    return calcularResumoNecessidadeDetalhe(
      pedidoAtual,
      embarqueNecessidadeContexto,
      pedidoAtual?._embarques || [],
      produtosMapBasico,
    );
  }, [pedidoAtual, embarqueNecessidadeContexto, produtosMapBasico]);

  const handlePedidoFinanceiroAtualizado = async () => {
    if (onPedidoRefresh) {
      await onPedidoRefresh();
    } else if (pedido?.id) {
      const [atualizado] = await base44.entities.PedidoCompra.filter({ id: pedido.id });
      if (atualizado) {
        setFormData((prev) => ({ ...prev, ...atualizado }));
        setPedidoLogistica((prev) => ({ ...(prev || {}), ...atualizado }));
      }
    }
    setLancamentosRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (abaInicial) setAbaPedidoDesktop(abaInicial);
  }, [abaInicial]);

  useEffect(() => {
    if (!pedido?.id) {
      setLancamentosPedido([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const lancs = await listarLancamentosPedidoCompra(base44, pedido.id);
      if (cancelled) return;
      setLancamentosPedido(lancs);

      if (!pedidoAguardandoAprovacaoFinanceira(pedido, lancs)) return;

      const { synced } = await sincronizarPedidoCompraAprovacaoFinanceira({
        base44,
        pedido,
        lancamentos: lancs,
      });
      if (!cancelled && synced) {
        const [atualizado] = await base44.entities.PedidoCompra.filter({ id: pedido.id });
        if (atualizado) {
          setFormData((prev) => ({ ...prev, ...atualizado }));
          setPedidoLogistica((prev) => ({ ...(prev || {}), ...atualizado }));
        }
      }
    })().catch(() => {
      if (!cancelled) setLancamentosPedido([]);
    });

    return () => {
      cancelled = true;
    };
  }, [pedido?.id, pedido?.status, pedido?.status_aprovacao_financeira, lancamentosRefreshKey]);

  useEffect(() => {
    if (pedido) {
      // Se o pedido não tem data_emissao, usa a created_date como fallback
      const dataEmissao = pedido.data_emissao ||
        (pedido.created_date ? format(new Date(pedido.created_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      const pedidoComData = {
        ...pedido,
        data_emissao: dataEmissao,
        itens: (pedido.itens || []).map((item) => syncPedidoCompraItemQuantities(item)),
      };
      setFormData(pedidoComData);
      setPedidoLogistica(pedidoComData);
      setHistory([pedidoComData]);
      setHistoryIndex(0);
      return;
    }

    const savedDraft = localStorage.getItem(draftKey);
    if (!savedDraft) return;

    try {
      const parsedDraft = JSON.parse(savedDraft);
      if (!parsedDraft?.data) return;
      // Mostrar dialog em vez de restaurar automaticamente
      setPendingDraft(parsedDraft);
      setShowDraftDialog(true);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [pedido, draftKey]);

  useEffect(() => {
    if (!formData) return;
    if (isRestoringDraftRef.current) {
      isRestoringDraftRef.current = false;
      return;
    }

    const hasContent = Boolean(
      formData.fornecedor_id ||
      formData.fornecedor_nome ||
      formData.observacoes ||
      formData.condicoes_pagamento ||
      formData.tags?.length ||
      formData.itens?.length
    );

    if (!hasContent) {
      localStorage.removeItem(draftKey);
      return;
    }

    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: formData,
      }));
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [formData, draftKey]);

  useEffect(() => {
    const hasUnsavedChanges = !pedido?.id && Boolean(
      formData.fornecedor_id ||
      formData.fornecedor_nome ||
      formData.observacoes ||
      formData.condicoes_pagamento ||
      formData.tags?.length ||
      formData.itens?.length
    );

    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pedido?.id, formData]);

  useEffect(() => {
    setPedidoLogistica(pedido || null);
    valorTotalBaseEdicaoRef.current = calcValorTotalPedidoCompra(pedido || {});
  }, [pedido]);

  const handleImporterLaunchPdfPickerConsumed = useCallback(() => {
    setImporterLaunchPdfPicker(false);
  }, []);

  const enviarAnexoImportacaoPendente = useCallback(
    async (pedidoId, pedidoNumero, pending = pendingAnexoImportRef.current) => {
      if (!pedidoId || !pending?.file || anexoImportUploadedRef.current) return;
      try {
        await uploadAnexoParaPedidoCompra(base44, {
          file: pending.file,
          pedidoId,
          pedidoNumero: pedidoNumero || '',
          tipoDocumento: pending.tipoDocumentoAnexo || 'Comprovante',
          origem: 'torre_importador_pedido',
        });
        anexoImportUploadedRef.current = true;
        pendingAnexoImportRef.current = null;
        toast({
          title: 'Documento anexado ao pedido',
          description: `Arquivo classificado como ${pending.tipoDocumentoAnexo || 'Comprovante'}.`,
        });
      } catch (anexoErr) {
        console.warn('Anexo PDF (importação pedido):', anexoErr);
        toast({
          title: 'Itens importados, mas o PDF não foi anexado',
          description: anexoErr?.message || 'Tente anexar manualmente na aba de anexos.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!autoOpenImporter || autoImporterHandledRef.current) return;
    if (pedido?.id) return; // abertura automática é apenas no "novo pedido"
    autoImporterHandledRef.current = true;
    setImporterLaunchPdfPicker(true);
    setAbaPedidoDesktop('itens');
    setIsImportadorPedidoOpen(true);
  }, [autoOpenImporter, pedido?.id]);

  useEffect(() => {
    if (produtosCached) setProdutos(produtosCached);
  }, [produtosCached]);

  useEffect(() => {
    if (terceirosCached) {
      setFornecedores(terceirosCached.filter((t) => t.tipo === 'Fornecedor' || t.tipo === 'Ambos'));
    }
  }, [terceirosCached]);

  useEffect(() => {
    const loadDependencies = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const [contasRes, empresaRes] = await Promise.allSettled([
        base44.entities.ContasFinanceiras.list(),
        base44.entities.DadosEmpresa.list(),
      ]);

      const contasLista = contasRes.status === 'fulfilled' ? (contasRes.value || []) : [];
      const empresaLista = empresaRes.status === 'fulfilled' ? (empresaRes.value || []) : [];

      setContas(contasLista);
      if (empresaLista.length > 0) {
        setEmpresa(empresaLista[0]);
      }
    };
    loadDependencies();
  }, [pedido]);

  // Cálculos automáticos
  const { valorItens, valorTotal, percentualDesconto } = useMemo(() => {
    const itens = roundToTwoDecimals((formData.itens || []).reduce((acc, item) => acc + (item.total || 0), 0));
    const frete = roundToTwoDecimals(parseFloat(formData.valor_frete) || 0);
    const desconto = roundToTwoDecimals(parseFloat(formData.valor_desconto) || 0);
    const total = roundToTwoDecimals(itens + frete - desconto);
    const percentDesc = itens > 0 ? roundToTwoDecimals((desconto / itens) * 100) : 0;
    return { 
      valorItens: itens, 
      valorTotal: total,
      percentualDesconto: percentDesc
    };
  }, [formData.itens, formData.valor_frete, formData.valor_desconto]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      saveToHistory(newData);
      return newData;
    });
  };

  const saveToHistory = (newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, newData];
    });
    setHistoryIndex(prev => prev + 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setFormData(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setFormData(history[historyIndex + 1]);
    }
  };
  
  const handleFornecedorChange = (id) => {
    if (id === 'novo') {
      setIsNovoFornecedorOpen(true);
      return;
    }
    const fornecedor = fornecedores.find(f => f.id === id);
    if (fornecedor) {
      handleChange('fornecedor_id', id);
      handleChange('fornecedor_nome', fornecedor.nome);
    }
  };

  const handleCreateFornecedor = async () => {
    if (!novoFornecedor.nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    try {
      const novoF = await base44.entities.Terceiro.create({
        nome: novoFornecedor.nome,
        email: novoFornecedor.email || '',
        telefone: novoFornecedor.telefone || '',
        endereco: novoFornecedor.endereco || '',
        tipo: 'Fornecedor',
        ativo: true
      });

      setFornecedores(prev => [...prev, novoF]);
      handleChange('fornecedor_id', novoF.id);
      handleChange('fornecedor_nome', novoF.nome);

      setIsNovoFornecedorOpen(false);
      setNovoFornecedor({ nome: '', email: '', telefone: '', endereco: '' });
      toast({ title: 'Fornecedor criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar fornecedor', description: error.message, variant: 'destructive' });
    }
  };

  const handleDescontoPercentualChange = (value) => {
    const percent = roundToTwoDecimals(parseFloat(value) || 0);
    const descontoValor = roundToTwoDecimals((valorItens * percent) / 100);
    setFormData(prev => ({ 
      ...prev, 
      percentual_desconto: percent,
      valor_desconto: descontoValor 
    }));
  };

  const handleDescontoValorChange = (value) => {
    const desconto = roundToTwoDecimals(parseFloat(value) || 0);
    const percent = valorItens > 0 ? roundToTwoDecimals((desconto / valorItens) * 100) : 0;
    setFormData(prev => ({ 
      ...prev, 
      valor_desconto: desconto,
      percentual_desconto: percent 
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.itens];
    const item = newItems[index];

    // Support for bulk updates (field as object)
    if (typeof field === 'object' && field !== null) {
        Object.assign(item, field);
    } else {
        item[field] = value;
        
        if (field === 'produto_id') {
            const produto = produtos.find(p => p.id === value);
            if (produto) {
                const opt = pickDefaultPurchaseUnit(produto);
                item.produto_nome = produto.nome;
                item.codigo_produto = produto.codigo_interno || produto.codigo_barras;
                item.unidade_medida = opt?.unidade || produto.unidade_principal || 'UN';
                const fatorOpt = opt?.fator_conversao ?? 1;
                item.fator_conversao = fatorOpt;
                item.custo_unitario = opt
                  ? custoApresentacaoParaFator1(opt.valor_unitario ?? 0, fatorOpt)
                  : (produto.valor_compra || 0);
                item.valor_desconto_item = resolveValorDescontoCompraPadraoFator1(
                  produto,
                  item.custo_unitario,
                );
                item.desconto_pct_item = resolveDescontoPctCompraProduto(produto, item.custo_unitario);
            }
        }
    }

    const produtoItem = produtos.find((p) => p.id === item.produto_id);
    const itemJaCanonico =
      item.preco_eixo === 'FATOR_1' &&
      Number(item.quantidade_base) > 0 &&
      item.unidade_medida;
    if (produtoItem && !itemJaCanonico) {
      // `custo_unitario` é fator-1 (R$/[unidade base]); o total em R$ é qty_base × custo_unitario.
      const fatorAtual = parseFloat(item.fator_conversao) || 1;
      const totalBase = (parseFloat(item.quantidade) || 0) * fatorAtual * (parseFloat(item.custo_unitario) || 0);
      Object.assign(item, normalizePurchaseItemToCommercial(produtoItem, { ...item, total: totalBase }));
    }

    const fatorConversao = parseFloat(item.fator_conversao) || 1;
    const quantidadeBase = roundToTwoDecimals(resolveEffectiveQuantidadeBase(item));
    item.quantidade_base = quantidadeBase;
    item.quantidade = commercialQuantityFromBase(
      quantidadeBase,
      fatorConversao,
      item.unidade_medida || item.unidade_apresentacao,
    );

    const qty = parseFloat(item.quantidade) || 0;
    const qBaseLinha = parseFloat(item.quantidade_base) || qty * fatorConversao;
    Object.assign(item, syncItemDescontoApresentacao(item));
    const cost = roundToTwoDecimals(parseFloat(item.custo_unitario) || 0);
    const descUnit = roundToTwoDecimals(parseFloat(item.valor_desconto_item) || 0);
    const custoFinalUnitario = roundToTwoDecimals(cost - descUnit);
    item.custo_final_unitario = custoFinalUnitario;
    item.subtotal = roundToTwoDecimals(qBaseLinha * cost);
    item.total = calcTotalItemCompraPedido(item);
    Object.assign(item, normalizeItemToCanonicalFactorOne(item, 'custo'));

    const newData = { ...formData, itens: newItems };
    saveToHistory(newData);
    setFormData(newData);
  };

  const handleAddItem = (product = null) => {
    let newItem;
    
    const calculateItemTotals = (item) => {
        const qty = parseFloat(item.quantidade) || 0;
        const fatorConversao = parseFloat(item.fator_conversao) || 1;
        const synced = syncItemDescontoApresentacao({
          ...item,
          quantidade_base: qty * fatorConversao,
        });
        const cost = roundToTwoDecimals(parseFloat(synced.custo_unitario) || 0);
        const descUnit = roundToTwoDecimals(parseFloat(synced.valor_desconto_item) || 0);
        const custoFinalUnitario = roundToTwoDecimals(cost - descUnit);

        return {
            ...synced,
            subtotal: roundToTwoDecimals(qty * fatorConversao * cost),
            total: calcTotalItemCompraPedido(synced),
            custo_final_unitario: custoFinalUnitario,
            ...normalizeItemToCanonicalFactorOne({
              ...synced,
              custo_final_unitario: custoFinalUnitario,
            }, 'custo'),
        };
    };

    if (product && product.produto_id && product.quantidade) {
        newItem = calculateItemTotals(product);
    } else {
        const pu = product?.id ? pickDefaultPurchaseUnit(product) : null;
        const fatorPu = pu?.fator_conversao ?? 1;
        const custoF1 = pu
          ? custoApresentacaoParaFator1(pu.valor_unitario ?? 0, fatorPu)
          : (product?.valor_compra || 0);
        newItem = { 
            produto_id: product?.id || '', 
            produto_nome: product?.nome || '', 
            codigo_produto: product?.codigo_interno || product?.codigo_barras || '',
            quantidade: 1, 
            unidade_medida: pu?.unidade || product?.unidade_compra || 'UN',
            fator_conversao: fatorPu,
            custo_unitario: custoF1,
            valor_desconto_item: product
              ? resolveValorDescontoCompraPadraoFator1(product, custoF1)
              : 0,
            desconto_pct_item: product
              ? resolveDescontoPctCompraProduto(product, custoF1)
              : 0,
            observacao_item: ''
        };
        newItem = calculateItemTotals(newItem);
    }

    const newData = {
      ...formData,
      itens: [...formData.itens, newItem],
    };
    saveToHistory(newData);
    setFormData(newData);
  };

  const handleAddItemsBatch = (incoming = [], productsSource) => {
    if (!incoming.length) return;
    const catalog = productsSource?.length ? productsSource : produtos;

    const calculateItemTotals = (item) => {
      const qty = parseFloat(item.quantidade) || 0;
      const fatorConversao = parseFloat(item.fator_conversao) || 1;
      const synced = syncItemDescontoApresentacao({
        ...item,
        quantidade_base: qty * fatorConversao,
      });
      const cost = roundToTwoDecimals(parseFloat(synced.custo_unitario) || 0);
      const descUnit = roundToTwoDecimals(parseFloat(synced.valor_desconto_item) || 0);
      const custoFinalUnitario = roundToTwoDecimals(cost - descUnit);

      return {
        ...synced,
        subtotal: roundToTwoDecimals(qty * fatorConversao * cost),
        total: calcTotalItemCompraPedido(synced),
        custo_final_unitario: custoFinalUnitario,
        ...normalizeItemToCanonicalFactorOne({
          ...synced,
          custo_final_unitario: custoFinalUnitario,
        }, 'custo'),
      };
    };

    const buildFromProduct = (product, quantidade) => {
      const qty = parseLoteQuantidade(quantidade);
      const pu = pickDefaultPurchaseUnit(product);
      const fatorPu = pu?.fator_conversao ?? 1;
      const custoF1 = pu
        ? custoApresentacaoParaFator1(pu.valor_unitario ?? 0, fatorPu)
        : (product?.valor_compra || 0);
      const base = {
        produto_id: product.id,
        produto_nome: product.nome,
        codigo_produto: product.codigo_interno || product.codigo_barras || '',
        quantidade: qty,
        unidade_medida: pu?.unidade || product.unidade_compra || 'UN',
        fator_conversao: fatorPu,
        custo_unitario: custoF1,
        valor_desconto_item: resolveValorDescontoCompraPadraoFator1(product, custoF1),
        desconto_pct_item: resolveDescontoPctCompraProduto(product, custoF1),
        observacao_item: '',
      };
      return calculateItemTotals(base);
    };

    const merged = mergeLoteIntoItems(formData.itens, incoming, buildFromProduct, catalog);
    const recalc = merged.map((item) => calculateItemTotals(item));
    const newData = { ...formData, itens: recalc };
    saveToHistory(newData);
    setFormData(newData);
  };

  const handleExportModel = async () => {
    try {
      toast({ title: "Gerando planilha...", description: "Aguarde o download." });
      
      const response = await base44.functions.invoke('exportProdutosCompra');
      
      if (response.data && response.data.file_content) {
          // Decode Base64 properly handling UTF-8 characters
          const binaryString = window.atob(response.data.file_content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          
          const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', response.data.filename || 'modelo.csv');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } else {
          throw new Error("Formato de resposta inválido");
      }
      
    } catch (error) {
        console.error("Erro export:", error);
        toast({ title: "Erro ao exportar", description: "Verifique se a função backend está ativa.", variant: "destructive" });
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n');
        
        // Remove headers
        const dataRows = lines.slice(1);
        
        const newItems = [];
        let skippedCount = 0;
        let successCount = 0;

        dataRows.forEach(line => {
            if (!line.trim()) return;
            
            // Simple semi-colon split (assuming no semi-colons in quoted strings for simplicity, 
            // or basic regex split if needed. Excel CSV usually safe with split unless text has it)
            // Regex to split by semicolon, ignoring those inside quotes
            const cols = line.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            // Map columns based on our export order:
            // 0:ID, 1:COD, 2:NAME, 3:UNIT, 4:COST, 5:QTY, 6:NEW_COST, 7:FREIGHT, 8:IMP1, 9:IMP2, 10:DESC, 11:OUTROS, 12:MARKUP
            
            if (cols.length < 6) return; // Invalid row

            const id = cols[0]?.replace(/"/g, '').trim();
            const qtyStr = cols[5]?.replace(/"/g, '').trim();
            
            // Parse numbers (handle comma decimal)
            const parseBRFloat = (str) => {
                if (!str) return 0;
                return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
            };

            const qty = parseBRFloat(qtyStr);

            if (qty > 0 && id) {
                const product = produtos.find(p => p.id === id);
                if (product) {
                    const currentCost = parseBRFloat(cols[4]?.replace(/"/g, ''));
                    const newCost = parseBRFloat(cols[6]?.replace(/"/g, ''));
                    const discount = parseBRFloat(cols[10]?.replace(/"/g, ''));
                    
                    const finalCost = roundToTwoDecimals(newCost > 0 ? newCost : (currentCost > 0 ? currentCost : product.valor_compra));
                    const descontoImportado = roundToTwoDecimals(discount);
                    const custoFinalUnitario = roundToTwoDecimals(finalCost - descontoImportado);
                    const optImp = pickDefaultPurchaseUnit(product);
                    const fatorImp = optImp?.fator_conversao ?? 1;

                    newItems.push({
                        produto_id: product.id,
                        produto_nome: product.nome,
                        codigo_produto: product.codigo_interno || product.codigo_barras,
                        quantidade: qty,
                        unidade_medida: optImp?.unidade || product.unidade_principal || 'UN',
                        fator_conversao: fatorImp,
                        quantidade_base: roundToTwoDecimals(qty * fatorImp),
                        custo_unitario: finalCost,
                        valor_desconto_item: descontoImportado,
                        custo_final_unitario: custoFinalUnitario,
                        ...normalizeItemToCanonicalFactorOne({
                          unidade_medida: optImp?.unidade || product.unidade_principal || 'UN',
                          fator_conversao: fatorImp,
                          quantidade: qty,
                          quantidade_base: roundToTwoDecimals(qty * fatorImp),
                          custo_unitario: finalCost,
                          custo_final_unitario: custoFinalUnitario,
                        }, 'custo'),
                        // Total em R$: quantidade_base × custo_unitario (custo já em fator-1).
                        subtotal: roundToTwoDecimals(qty * fatorImp * finalCost),
                        total: roundToTwoDecimals(qty * fatorImp * custoFinalUnitario),
                        observacao_item: 'Importado via CSV'
                    });
                    successCount++;
                }
            } else {
                skippedCount++;
            }
        });

        if (newItems.length > 0) {
            setFormData(prev => ({
                ...prev,
                itens: [...prev.itens, ...newItems]
            }));
            toast({ 
                title: "Importação concluída", 
                description: `${successCount} itens adicionados.`,
                variant: "default"
            });
        } else {
            toast({ 
                title: "Nenhum item importado", 
                description: "Verifique se preencheu a coluna 'QUANTIDADE_COMPRA' na planilha.",
                variant: "warning"
            });
        }
        
        // Reset input
        e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formData.itens];
    newItems.splice(index, 1);
    const newData = { ...formData, itens: newItems };
    saveToHistory(newData);
    setFormData(newData);
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
  };

  const handleCloseWithProtection = () => {
    const hasUnsavedChanges = !pedido?.id && Boolean(
      formData.fornecedor_id ||
      formData.fornecedor_nome ||
      formData.observacoes ||
      formData.condicoes_pagamento ||
      formData.tags?.length ||
      formData.itens?.length
    );

    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('Há um rascunho salvo localmente. Deseja sair mesmo assim?');
      if (!shouldLeave) return;
    }

    onClose();
  };

  const executarSaveComAuth = async (saveOptions = {}) => {
    const authData = await buildBypassAuthPayload(() => base44.auth.me());
    await handleAuthSuccess(authData, saveOptions);
  };

  const handleInitiateSave = async (saveOptions = {}) => {
    if (!formData.fornecedor_id) {
      toast({
        title: "Fornecedor obrigatório",
        description: "Selecione um fornecedor antes de salvar.",
        variant: "destructive"
      });
      return;
    }

    if (formData.itens.length === 0) {
      toast({
        title: "Adicione itens",
        description: "O pedido precisa ter pelo menos um item.",
        variant: "destructive"
      });
      return;
    }

    void executarSaveComAuth(saveOptions);
  };

  const handleSolicitarEdicao = async () => {
    if (!motivoEdicao.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da solicitação de edição.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await base44.entities.PedidoCompra.update(pedido.id, {
        status_aprovacao_financeira: 'Solicitação de Edição Pendente',
        solicitacao_edicao_motivo: motivoEdicao,
        solicitacao_edicao_data: agora(),
        solicitacao_edicao_solicitante: currentUser?.full_name || currentUser?.email,
        historico: (formData.historico || '') + `\n[Solicitação de Edição: ${motivoEdicao} | Por: ${currentUser?.full_name} | ${formatarLogTime()}]`
      });

      toast({
        title: "Solicitação enviada",
        description: "O financeiro foi notificado. Aguarde aprovação para editar.",
        className: "bg-blue-100 text-blue-800"
      });

      setIsSolicitarEdicaoOpen(false);
      setMotivoEdicao('');
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleReopenForEdit = async (authData) => {
    try {
      const refNote = `| Ref: ${authData.operationCode} | ${formatarLogTime()}`;
      await cancelarLancamentosNaoPagosPedidoCompra(base44, pedido.id, refNote);
      const authNote = `\n[Reaberto para Edição: ${authData.intervenienteName} | Ref: ${authData.operationCode} | ${formatarLogTime()}]`;
      
      await base44.entities.PedidoCompra.update(pedido.id, {
        status_aprovacao_financeira: 'Pendente',
        status: 'Rascunho',
        historico: (formData.historico || '') + authNote
      });

      toast({
        title: "Pedido reaberto",
        description: "O pedido foi reaberto para edição. Ao salvar, precisará de nova aprovação.",
        className: "bg-blue-100 text-blue-800"
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const isAprovado = pedidoAtual && (pedidoAtual.status === 'Aprovado' || pedidoAtual.status === 'Aguardando Recepção');

  const isLocked = pedidoAtual && (
    pedidoAguardandoAprovacaoFinanceira(pedidoAtual, lancamentosPedido) ||
    evidenciaAprovacaoFinanceiraProcessada(pedidoAtual, lancamentosPedido) ||
    pedidoAtual.status_aprovacao_financeira === 'Aprovado' ||
    pedidoAtual.status_aprovacao_financeira === 'Aprovado Financeiramente' ||
    pedidoAtual.status_aprovacao_financeira === 'Rejeitado' ||
    pedidoAtual.status_aprovacao_financeira === 'Rejeitado Financeiramente' ||
    pedidoAtual.status_aprovacao_financeira === 'Solicitação de Edição Pendente'
  );

  const solicitacaoEdicaoPendente = pedidoAtual?.status_aprovacao_financeira === 'Solicitação de Edição Pendente';
  const podeSolicitarCorrecao =
    !!pedido?.id &&
    isLocked &&
    !solicitacaoEdicaoPendente &&
    pedidoAtual.status_aprovacao_financeira !== 'Rejeitado' &&
    pedidoAtual.status_aprovacao_financeira !== 'Rejeitado Financeiramente';

  const isLogisticaEnabled = true;

  const canReopen = currentUser?.role === 'admin' && isLocked;

  const handlePrintReport = async (tipo = 'pedido') => {
    if (!pedido?.id) {
      toast({ title: 'Salve o pedido antes de imprimir', variant: 'destructive' });
      return;
    }

    try {
      toast({ title: 'Gerando relatório...', description: 'Aguarde...' });

      let functionName = 'gerarRelatorioPedido';
      let fileName = `Pedido_${pedido.numero}.pdf`;

      if (tipo === 'precificacao') {
        functionName = 'gerarRelatorioPrecificacao';
        fileName = `Precificacao_${pedido.numero}.pdf`;
      } else if (tipo === 'pendencias') {
        functionName = 'gerarRelatorioPendencias';
        fileName = `Pendencias_${pedido.numero}.pdf`;
      }

      const response = await base44.functions.invoke(functionName, { pedido_id: pedido.id });

      console.log('Response completa:', response);
      console.log('Response status:', response?.status);
      console.log('Response data type:', typeof response?.data);

      if (!response || !response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: 'Relatório gerado com sucesso!' });
    } catch (error) {
      console.error('Erro completo:', error);
      console.error('Erro message:', error?.message);
      console.error('Erro stack:', error?.stack);
      const errorMsg = error?.message || error?.toString() || 'Erro desconhecido ao gerar relatório';
      toast({ 
        title: 'Erro ao gerar relatório', 
        description: errorMsg,
        variant: 'destructive',
        duration: 10000
      });
    }
  };

  const handleAuthSuccess = async (authData, saveOptions = {}) => {
    setIsSaving(true);
    
    try {
      const authNote = `\n[Autenticado: ${authData.intervenienteName} | Ref: ${authData.operationCode} | ${formatarLogTime()}]`;
      
      const statusAnterior = pedido?.status || 'Rascunho';
      // Com auth imediata (sem modal PIN), o status do formData pode ainda ser o anterior — saveOptions.status vem do FAB "Financeiro".
      const statusNovo = saveOptions.status ?? formData.status;
      const valorAnterior = roundToTwoDecimals(valorTotalBaseEdicaoRef.current || 0);
      const diferencaValor = roundToTwoDecimals(valorTotal - valorAnterior);
      const pedidoTemValorAlterado = Math.abs(diferencaValor) >= 0.01;
      let gerarAjusteFinanceiro = false;

      if (pedido?.id && pedidoTemValorAlterado) {
        const lancsExistentes = await listarLancamentosPedidoCompra(base44, pedido.id);
        if (temLancamentoPagoParaPedido(lancsExistentes)) {
          const valorAbs = Math.abs(diferencaValor);
          const direcao = diferencaValor > 0 ? 'a pagar' : 'a receber';
          const confirmouAjuste = window.confirm(
            `Este pedido já tem parcelas pagas.\n\n` +
            `Valor anterior: R$ ${valorAnterior.toFixed(2)}\n` +
            `Novo valor: R$ ${roundToTwoDecimals(valorTotal).toFixed(2)}\n` +
            `Diferença ${direcao}: R$ ${valorAbs.toFixed(2)}\n\n` +
            `Deseja salvar e gerar automaticamente a conta ${direcao}?`
          );
          if (!confirmouAjuste) {
            setIsSaving(false);
            return;
          }
          gerarAjusteFinanceiro = true;
        }
      }

      const dataToSave = { 
        ...formData,
        ...(saveOptions.status ? { status: saveOptions.status } : {}),
        valor_itens: valorItens,
        valor_total: valorTotal,
        historico: (formData.historico || '') + authNote,
      };
      
      // Salvar pedido primeiro
      const pedidoSalvo = await onSave(dataToSave);
      const pedidoId = pedidoSalvo?.id || pedido?.id;

      if (pedidoId && gerarAjusteFinanceiro) {
        const motivoAjuste = formData.solicitacao_edicao_motivo || pedido?.solicitacao_edicao_motivo || '';
        const responsavelAjuste = authData.intervenienteName || currentUser?.full_name || currentUser?.email || '';
        await criarLancamentoAjustePedidoCompra(base44, {
          pedido: {
            id: pedidoId,
            numero: pedidoSalvo?.numero || pedido?.numero,
            fornecedor_id: formData.fornecedor_id,
            fornecedor_nome: formData.fornecedor_nome,
          },
          diferenca: diferencaValor,
          valorAnterior,
          valorNovo: valorTotal,
          motivo: motivoAjuste,
          responsavel: responsavelAjuste,
        });
        toast({
          title: 'Ajuste financeiro criado',
          description:
            diferencaValor > 0
              ? 'Diferença registrada como conta a pagar.'
              : 'Diferença registrada como conta a receber.',
        });
      }

      if (pedidoId && pendingAnexoImportRef.current) {
        await enviarAnexoImportacaoPendente(
          pedidoId,
          pedidoSalvo?.numero || pedido?.numero,
          pendingAnexoImportRef.current
        );
      }

      // ── Sincroniza linhas canónicas em PedidoCompraItem (SQL) ──
      // replaceAll persiste cada linha; recomporPedido actualiza só totais (sem espelho JSON).
      if (pedidoId && Array.isArray(dataToSave?.itens)) {
        try {
          const itensCanonicos = dataToSave.itens.map((it, idx) => {
            const synced = syncItemDescontoApresentacao(it);
            const totalLinha = calcTotalItemCompraPedido(synced);
            const normalizado = normalizePedidoCompraItemCustoLiquidoParaPersist({
              ...synced,
              custo_unitario_fator1: Number(synced?.custo_unitario) || 0,
              quantidade_comercial: Number(synced?.quantidade) || 0,
              quantidade_base: Number(synced?.quantidade_base) || 0,
              fator_aplicado: Number(synced?.fator_conversao) || 1,
              frete_unitario_fator1: Number(synced?.custo_frete_unitario) || 0,
              outros_unitario_fator1: Number(synced?.custo_outros_unitario) || 0,
              desconto_unitario_fator1: Number(synced?.valor_desconto_item ?? synced?.desconto_unitario) || 0,
              total: Number(synced?.total) > 0 ? Number(synced.total) : totalLinha,
            });
            return {
              id: synced?.pedido_compra_item_id || synced?.id || undefined,
              produto_id: synced?.produto_id || '',
              produto_unidade_id: synced?.produto_unidade_id || '',
              unidade_sigla: synced?.unidade_medida || synced?.unidade_apresentacao || '',
              quantidade_comercial: (normalizado.quantidade_comercial ?? Number(synced?.quantidade)) || 0,
              custo_unitario_fator1: normalizado.custo_unitario_fator1,
              frete_unitario_fator1: normalizado.frete_unitario_fator1 ?? 0,
              outros_unitario_fator1: normalizado.outros_unitario_fator1 ?? 0,
              desconto_unitario_fator1: 0,
              valor_desconto_item: 0,
              total: normalizado.total ?? totalLinha,
              quantidade_vinculada: Number(synced?.quantidade_vinculada) || 0,
              ordem: idx,
              observacoes: typeof synced?.observacoes === 'string' ? synced.observacoes : '',
              status_recebimento: synced?.status_recebimento || 'Pendente',
            };
          }).filter((it) => it.produto_id && it.quantidade_comercial > 0);

          if (itensCanonicos.length > 0) {
            await savePedidoCompraItem({
              action: 'replaceAll',
              pedido_compra_id: pedidoId,
              items: itensCanonicos,
            });
            // replaceAll/recomporPedido pode recalcular totais sem desconto de linha — reafirmar o do formulário.
            await base44.entities.PedidoCompra.update(pedidoId, {
              valor_itens: valorItens,
              valor_total: valorTotal,
              valor_desconto: roundToTwoDecimals(parseFloat(formData.valor_desconto) || 0),
            });
          }
        } catch (canonicalErr) {
          console.warn('Sincronia canonica de PedidoCompraItem falhou:', canonicalErr?.message || canonicalErr);
          toast({
            title: 'Aviso de sincronia canonica',
            description: 'O pedido foi salvo, mas a entidade canonica PedidoCompraItem nao pode ser sincronizada. Detalhe: ' + (canonicalErr?.message || ''),
          });
        }
      }

      // ── Registrar transição no log sempre que houver mudança de status ──
      if (pedidoId && (!pedido?.id || statusAnterior !== statusNovo)) {
        await registrarTransicao({
          pedidoId,
          pedidoNumero: pedidoSalvo?.numero || pedido?.numero || dataToSave.numero,
          statusAnterior,
          statusNovo,
          responsavel: {
            id: authData.intervenienteId || currentUser?.id,
            nome: authData.intervenienteName || currentUser?.full_name,
            email: currentUser?.email,
          },
          codigoOperacao: authData.operationCode || '',
          observacao: authData.observacao || '',
          tipoAutenticacao: authData.intervenienteId ? 'Interveniente' : 'Usuario',
        });
      }

      // Verificar se mudou para "Aguardando Liberação" APÓS salvar
      const mudouParaAguardando = statusNovo === 'Aguardando Aprovação Financeira' && statusAnterior !== 'Aguardando Aprovação Financeira';
      let reenvioFinanceiroBloqueado = false;

      if (mudouParaAguardando && pedidoId) {
        // Buscar o pedido atualizado para ter certeza que tem todos os dados
        const pedidosAtualizados = await base44.entities.PedidoCompra.filter({ id: pedidoId });
        const currentPO = pedidosAtualizados[0];

        if (currentPO) {
          const lancsExistentes = await listarLancamentosPedidoCompra(base44, pedidoId);
          if (temLancamentoPagoParaPedido(lancsExistentes)) {
            const revertNote = `\n[Reenvio ao financeiro cancelado: há parcelas pagas | ${formatarLogTime()}]`;
            await base44.entities.PedidoCompra.update(pedidoId, {
              status: statusAnterior,
              status_aprovacao_financeira: pedido?.status_aprovacao_financeira || 'Pendente',
              historico: (currentPO.historico || '') + revertNote,
            });
            reenvioFinanceiroBloqueado = true;
            toast({
              title: 'Reenvio bloqueado',
              description: 'Este pedido tem parcelas já pagas. O financeiro precisa alinhar os pagamentos antes de um novo envio.',
              variant: 'destructive',
            });
          } else {
          const notaCancel = `| Reenvio ao financeiro | Ref: ${authData.operationCode || ''} | ${formatarLogTime()}`;
          await cancelarLancamentosNaoPagosPedidoCompra(base44, pedidoId, notaCancel);

          // 1. Criar Lançamentos Financeiros (Em Aberto, bloqueados para aprovação)
          const baseLancamento = {
            tipo: 'Despesa',
            terceiro_id: formData.fornecedor_id,
            terceiro_nome: formData.fornecedor_nome,
            status: 'Em Aberto',
            categoria: 'Compra de Mercadoria',
            referencia_id: currentPO.id,
            referencia_tipo: 'PedidoCompra',
            referencia_numero: currentPO.numero,
            is_custo_mercadoria: true,
            pedido_compra_vinculado_id: currentPO.id,
            pedido_compra_vinculado_numero: currentPO.numero,
          };

          if (formData.forma_pagamento_compra === 'À Vista') {
            await base44.entities.LancamentoFinanceiro.create({
              ...baseLancamento,
              descricao: `Compra de Mercadoria - ${currentPO.numero} (À Vista)`,
              forma_pagamento_tipo: 'À Vista',
              forma_pagamento_compra: 'À Vista',
              valor: valorTotal,
              data_vencimento: formData.data_primeiro_vencimento || dataHoje(),
              observacoes: `Pagamento à vista. Aguardando aprovação do financeiro.`,
            });
          } else {
            const numParcelas = formData.num_parcelas || 1;
            const valorParcela = valorTotal / numParcelas;
            const dataBase = formData.data_primeiro_vencimento ? 
              new Date(formData.data_primeiro_vencimento) : 
              addDays(new Date(), 30);

            for (let i = 0; i < numParcelas; i++) {
              const dataVencimento = addDays(dataBase, i * (formData.intervalo_parcelas_dias || 30));
              await base44.entities.LancamentoFinanceiro.create({
                ...baseLancamento,
                descricao: `Compra de Mercadoria - ${currentPO.numero} (${i + 1}/${numParcelas})`,
                forma_pagamento_tipo: 'Parcelado',
                forma_pagamento_compra: 'Parcelado',
                valor: valorParcela,
                data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
                observacoes: `Parcela ${i + 1} de ${numParcelas}. Aguardando aprovação do financeiro.`,
              });
            }
          }

          // 2. Atualizar status de aprovação financeira do pedido
          await base44.entities.PedidoCompra.update(currentPO.id, {
            status_aprovacao_financeira: 'Aguardando Aprovação Financeira'
          });
          
          // 3. Criar Tarefa de Recebimento
          await base44.entities.Tarefa.create({
            titulo: `Recebimento de Mercadoria - ${currentPO.numero}`,
            tipo: 'Recebimento de Mercadoria',
            status: 'Pendente',
            prioridade: 'Alta',
            responsavel_id: currentUser.id,
            responsavel_nome: currentUser.full_name,
            referencia_tipo: 'PedidoCompra',
            referencia_id: currentPO.id,
            referencia_numero: currentPO.numero,
            valor_pendente: valorTotal,
            descricao: `Aguardando recebimento da mercadoria do fornecedor ${formData.fornecedor_nome}. Informe despacho e chegada na aba Logística do pedido.`,
            data_vencimento: format(new Date(formData.data_prevista_entrega || new Date()), 'yyyy-MM-dd')
          });

          toast({
            title: "✓ PO Enviado para Aprovação!",
            description: `Conta a pagar criada e tarefa de acompanhamento gerada.`,
            className: "bg-emerald-100 text-emerald-800"
          });
          }
        }
      }

      clearDraft();
      valorTotalBaseEdicaoRef.current = roundToTwoDecimals(valorTotal);
      if (mudouParaAguardando && reenvioFinanceiroBloqueado) {
        // Pedido revertido no servidor; evitar toast de sucesso enganoso
      } else if (mudouParaAguardando && pedidoId) {
        // Sucesso já coberto pelo toast verde dentro do bloco de envio
      } else {
        toast({
          title: "Sucesso",
          description: "Pedido salvo com sucesso!",
          className: "bg-green-100 text-green-800 border-green-200"
        });
      }
      
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
    
    setIsSaving(false);
  };

  const formatCurrency = (value) => {
    return `R$ ${formatCurrencyValue(value)}`;
  };





  return (
    <div className="fixed inset-0 flex flex-col bg-card dark:text-foreground overflow-hidden font-din-1451 uppercase tracking-wide [&_label]:font-light [&_textarea]:normal-case [&_input[type=date]]:normal-case [&_input[type=number]]:normal-case">
      {/* Alerta de Bloqueio Desktop */}
      {isLocked && (
        <BannerStatusPedido pedido={pedidoAtual} lancamentos={lancamentosPedido} isMobile={isPhone} />
      )}
      {/* Header compacto */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3 border-b border-border/40 relative">
        <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400/60 via-teal-300/40 to-transparent rounded-t" />
        <Button variant="ghost" size="icon" onClick={handleCloseWithProtection} className="h-10 w-10">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-light text-foreground truncate">
              {pedido?.numero || 'Novo Pedido'}
            </span>
            {pedido?.id && statusFinanceiroHeader && statusFinanceiroHeader !== 'Rascunho' && (
              <Badge
                variant="secondary"
                className={
                  statusFinanceiroHeader === 'Aprovado'
                    ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300 shrink-0'
                    : statusFinanceiroHeader === 'Aguard. Pgto'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0'
                      : 'shrink-0'
                }
              >
                {statusFinanceiroHeader}
              </Badge>
            )}
          </div>
          <span className="text-sm font-light text-muted-foreground whitespace-nowrap ml-4 normal-case tabular-nums">
            {resumoNecessidadeDetalhe ? (
              <>
                {resumoNecessidadeDetalhe.qtdItens}{' '}
                {resumoNecessidadeDetalhe.qtdItens === 1 ? 'item' : 'itens'}{' '}
                ({formatCurrency(resumoNecessidadeDetalhe.valorTotal)})
              </>
            ) : (
              <>
                {formData.itens.length} item(s) • {formatCurrency(valorTotal)}
              </>
            )}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" title="Mais opções">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dark:bg-muted min-w-[12rem]">
            <DropdownMenuItem
              disabled={!pedido?.id}
              onClick={() => setAbaPedidoDesktop('pendencias')}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Pendências
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!pedido?.id}
              onClick={() => setAbaPedidoDesktop('logs')}
            >
              <History className="w-4 h-4 mr-2" />
              Logs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!pedido?.id} onClick={() => handlePrintReport('pedido')}>
              <Printer className="w-4 h-4 mr-2" />
              Relatório do Pedido
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!pedido?.id} onClick={() => handlePrintReport('precificacao')}>
              <Printer className="w-4 h-4 mr-2" />
              Análise de Precificação
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!pedido?.id} onClick={() => handlePrintReport('pendencias')}>
              <Printer className="w-4 h-4 mr-2" />
              Relatório de Pendências
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>


      </div>

      {/* Dialog de rascunho */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent className="max-w-sm rounded-2xl bg-card border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Rascunho encontrado</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Existe um rascunho salvo localmente
              {pendingDraft?.data?.fornecedor_nome ? ` para ${pendingDraft.data.fornecedor_nome}` : ''}
              {pendingDraft?.savedAt ? ` (${new Date(pendingDraft.savedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})` : ''}.
              Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              className="border-0 shadow-sm rounded-xl h-10 text-muted-foreground"
              onClick={() => {
                localStorage.removeItem(draftKey);
                setPendingDraft(null);
                setShowDraftDialog(false);
              }}
            >
              Começar do zero
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-background hover:bg-primary dark:bg-card dark:hover:bg-muted dark:text-foreground rounded-xl h-10"
              onClick={() => {
                if (pendingDraft?.data) {
                  isRestoringDraftRef.current = true;
                  setFormData(pendingDraft.data);
                  setHistory([pendingDraft.data]);
                  setHistoryIndex(0);
                  setDraftRestored(true);
                }
                setPendingDraft(null);
                setShowDraftDialog(false);
              }}
            >
              Continuar rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DESKTOP: Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={abaPedidoDesktop} onValueChange={setAbaPedidoDesktop} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="flex-shrink-0 bg-transparent border-b border-border/40 rounded-none h-auto p-0 flex w-full">
            {[
              { value: 'dados-gerais', icon: <FileText className="w-4 h-4 flex-shrink-0" />, short: 'Geral', disabled: false },
              { value: 'itens',        icon: <ShoppingCart className="w-4 h-4 flex-shrink-0" />, short: 'Itens', disabled: false },
              { value: 'pagamento',    icon: <DollarSign className="w-4 h-4 flex-shrink-0" />, short: 'Fin.', disabled: false },
              { value: 'logistica',    icon: <Ship className="w-4 h-4 flex-shrink-0" />, short: 'Log', disabled: false },
              { value: 'recepcao',     icon: <Package className="w-4 h-4 flex-shrink-0" />, short: 'Rec', disabled: !pedido?.id },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b-2 border-transparent data-[state=active]:border-teal-500 dark:data-[state=active]:border-teal-400 data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-300 rounded-none py-2 px-1 text-muted-foreground disabled:opacity-30 transition-colors min-w-0 font-light"
              >
                {tab.icon}
                <span className="text-[10px] font-light tracking-wider leading-none uppercase">
                  {tab.short}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(abaPedidoDesktop === 'pendencias' || abaPedidoDesktop === 'logs') && (
            <div className="flex-shrink-0 px-6 py-2 border-b border-border/30 text-sm font-light text-muted-foreground">
              {abaPedidoDesktop === 'pendencias' ? 'Pendências' : 'Logs'}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="dados-gerais" className="mt-0 space-y-6">
              <div className="grid grid-cols-12 gap-x-6 gap-y-6">
                {/* Fornecedor */}
                <div className="col-span-12 lg:col-span-6">
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Fornecedor *</Label>
                  <Select value={formData.fornecedor_id} onValueChange={handleFornecedorChange} disabled={isLocked}>
                    <SelectTrigger className="bg-muted/50 border-0 h-12 text-sm shadow-sm rounded-xl text-foreground">
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-muted border-0 shadow-lg z-[9999] max-h-[300px]">
                      <div className="sticky top-0 bg-muted/50 p-2 border-b border-border/40 z-10">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Buscar..."
                            className="pl-8 h-8 text-xs bg-card border-0"
                            value={searchFornecedor}
                            onChange={e => {
                              setSearchFornecedor(e.target.value);
                              setSelectedFornecedorIndex(-1);
                            }}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                              if (!filteredFornecedores.length) return;
                              
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSelectedFornecedorIndex(prev => 
                                  prev < filteredFornecedores.length - 1 ? prev + 1 : 0
                                );
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSelectedFornecedorIndex(prev => 
                                  prev > 0 ? prev - 1 : filteredFornecedores.length - 1
                                );
                              } else if (e.key === 'Enter' && selectedFornecedorIndex >= 0) {
                                e.preventDefault();
                                handleFornecedorChange(filteredFornecedores[selectedFornecedorIndex].id);
                                setSearchFornecedor('');
                                setSelectedFornecedorIndex(-1);
                              } else if (e.key === 'Tab' && filteredFornecedores.length > 0) {
                                e.preventDefault();
                                setSelectedFornecedorIndex(prev => 
                                  prev < filteredFornecedores.length - 1 ? prev + 1 : 0
                                );
                              }
                            }}
                          />
                        </div>
                      </div>
                      {filteredFornecedores.map((f, idx) => (
                        <SelectItem 
                          key={f.id} 
                          value={f.id}
                          className={idx === selectedFornecedorIndex ? 'bg-teal-50 dark:bg-teal-900/20' : ''}
                        >
                          {f.nome}
                        </SelectItem>
                      ))}
                      <div className="border-t border-border/40 p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-xs text-muted-foreground hover:bg-muted h-8"
                          onClick={() => {
                            handleFornecedorChange('novo');
                            setSearchFornecedor('');
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" />
                          Novo Fornecedor
                        </Button>
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tags */}
                <div className="col-span-12 lg:col-span-6">
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Tags</Label>
                  <Input 
                    className="bg-muted/50 border-0 h-12 text-sm shadow-sm rounded-xl text-foreground placeholder:text-muted-foreground" 
                    placeholder="Ex: Urgente, Reposição..."
                    value={formData.tags?.join(', ') || ''} 
                    onChange={e => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} 
                    disabled={isLocked}
                  />
                </div>
                
                <div className="col-span-12 md:col-span-6 lg:col-span-3">
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Data do Pedido</Label>
                  <Input
                    type="date"
                    className="bg-muted/50 border-0 h-12 text-sm shadow-sm rounded-xl text-foreground"
                    value={formData.data_emissao || ''}
                    onChange={e => handleChange('data_emissao', e.target.value)}
                    disabled={isLocked}
                  />
                </div>

                <div className="col-span-12 md:col-span-6 lg:col-span-3">
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Previsão de Entrega</Label>
                  <Input
                    type="date"
                    className="bg-muted/50 border-0 h-12 text-sm shadow-sm rounded-xl text-foreground"
                    value={formData.data_prevista_entrega || ''}
                    onChange={e => handleChange('data_prevista_entrega', e.target.value)}
                    disabled={isLocked}
                  />
                </div>

                {/* Observação em linha inteira */}
                <div className="col-span-12">
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Observações</Label>
                  <Textarea 
                    className="bg-muted/50 border-0 shadow-sm resize-none rounded-xl text-foreground placeholder:text-muted-foreground" 
                    placeholder="Observações do pedido..."
                    rows={3}
                    value={formData.observacoes} 
                    onChange={e => handleChange('observacoes', e.target.value)} 
                    disabled={isLocked}
                  />
                </div>
              </div>


            </TabsContent>

            {/* ABA: ITENS — usa o mesmo seletor estilo PDV */}
            <TabsContent value="itens" className="mt-0 h-full -mx-6 -mt-0">
              <MobileProductSelector
                items={formData.itens}
                products={produtos}
                onAddItem={handleAddItem}
                onAddItemsBatch={handleAddItemsBatch}
                onUpdateItem={handleItemChange}
                onRemoveItem={handleRemoveItem}
                formatCurrency={formatCurrency}
                onOpenAdjustPrices={() => setShowAtualizarPrecos(true)}
                isLocked={isLocked}
                onProductCreated={(novoProduto) => {
                  setProdutos(prev => [...prev, novoProduto]);
                }}
                onOpenImporter={() => setIsImportadorPedidoOpen(true)}
              />
            </TabsContent>

          {/* ABA: PAGAMENTO */}
          <TabsContent value="pagamento" className="mt-0 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-light text-muted-foreground mb-2 block">Forma de Pagamento *</Label>
                <Select value={formData.forma_pagamento_compra} onValueChange={v => handleChange('forma_pagamento_compra', v)}>
                  <SelectTrigger className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted border-0 shadow-lg z-[9999]">
                    <SelectItem value="À Vista">À Vista</SelectItem>
                    <SelectItem value="Parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-light text-muted-foreground mb-2 block">
                  {formData.forma_pagamento_compra === 'À Vista' ? 'Data de Pagamento' : 'Primeiro Vencimento'}
                </Label>
                <Input 
                  type="date" 
                  className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl"
                  value={formData.data_primeiro_vencimento} 
                  onChange={e => handleChange('data_primeiro_vencimento', e.target.value)} 
                  disabled={isLocked}
                />
              </div>
            </div>

            {formData.forma_pagamento_compra === 'Parcelado' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Número de Parcelas</Label>
                  <Input 
                    type="number" 
                    min="1"
                    className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl"
                    value={formData.num_parcelas} 
                    onChange={e => handleChange('num_parcelas', parseInt(e.target.value) || 1)} 
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm font-light text-muted-foreground mb-2 block">Intervalo entre Parcelas (dias)</Label>
                  <Input 
                    type="number" 
                    min="1"
                    className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl" 
                    value={formData.intervalo_parcelas_dias} 
                    onChange={e => handleChange('intervalo_parcelas_dias', parseInt(e.target.value) || 30)} 
                    disabled={isLocked}
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-light text-muted-foreground mb-2 block">Observações de Pagamento</Label>
              <Textarea 
                className="bg-muted/50 border-0 shadow-sm resize-none rounded-xl" 
                placeholder="Ex: Pagar via PIX, transferência, observações sobre o pagamento..."
                rows={3}
                value={formData.condicoes_pagamento} 
                onChange={e => handleChange('condicoes_pagamento', e.target.value)} 
                disabled={isLocked}
              />
            </div>

            {/* Central financeira + lançamentos */}
            <div className="pt-6 border-t border-border/40 space-y-6">
              <div className="text-right">
                <span className="text-xs text-muted-foreground block mb-0.5">Total do Pedido</span>
                <span className="text-2xl font-light text-foreground dark:text-foreground">{formatCurrency(valorTotal)}</span>
              </div>

              {pedido?.id && (
                <PainelCentralFinanceiroPedido
                  pedido={pedidoAtual}
                  onPedidoAtualizado={handlePedidoFinanceiroAtualizado}
                />
              )}

              {pedido?.id && (
                <div className="space-y-2">
                  <LancamentosCompraPanel pedidoId={pedido.id} refreshKey={lancamentosRefreshKey} />
                </div>
              )}
            </div>

            </TabsContent>

          {/* ABA: LOGÍSTICA */}
          <TabsContent value="logistica" className="mt-0">
            {pedido?.id ? (
              <PedidoCompraLogisticaTab
                pedido={pedidoLogistica || pedido}
                onIrParaRecepcao={() => setAbaPedidoDesktop('recepcao')}
                onPedidoUpdated={async () => {
                  const pedidoId = (pedidoLogistica || pedido)?.id;
                  if (!pedidoId) return;
                  const [atualizado, embarquesAtualizados] = await Promise.all([
                    base44.entities.PedidoCompra.filter({ id: pedidoId }),
                    base44.entities.Embarque.filter({ pedido_compra_id: pedidoId })
                  ]);
                  if (atualizado?.[0]) {
                    const embarquesHidratados = await hydrateEmbarquesPedidoFromSql(
                      base44,
                      pedidoId,
                      embarquesAtualizados || [],
                    );
                    const embarquesVisiveis = filterEmbarquesVisiveisParaPedido(embarquesHidratados);
                    const pedidoCompleto = { ...atualizado[0], _embarques: embarquesVisiveis };
                    setPedidoLogistica(pedidoCompleto);
                    setFormData(prev => ({ ...prev, ...pedidoCompleto }));
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">Salve o pedido primeiro para registrar embarques.</p>
              </div>
            )}
          </TabsContent>

          {/* ABA: RECEPÇÃO */}
          <TabsContent value="recepcao" className="mt-0">
            {pedido?.id ? (
              <AbaRecepção pedido={pedidoLogistica || pedido} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">Salve o pedido primeiro para registrar recebimentos.</p>
              </div>
            )}
          </TabsContent>

            {/* ABA: PENDÊNCIAS */}
            <TabsContent value="pendencias" className="mt-0">
              {pedido?.id && (
                <PendenciasPedido pedido={pedido} />
              )}
            </TabsContent>

            {/* ABA: LOGS */}
            <TabsContent value="logs" className="mt-0">
              <LogsPedidoCompra pedidoId={pedido?.id} pedido={pedido} />
            </TabsContent>
          </div>
        </Tabs>
      </div>



      <AtualizarPrecosDialog
        isOpen={showAtualizarPrecos}
        onClose={(updated) => {
          setShowAtualizarPrecos(false);
          if (updated) {
            // Recarregar produtos se houve atualização
            refetchProdutosCatalog().then(({ data }) => data && setProdutos(data));
          }
        }}
        itens={formData.itens || []}
        produtos={produtos}
      />

      <ImportadorPedidoCompra
        isOpen={isImportadorPedidoOpen}
        onClose={() => {
          limparArquivoPedidoImportBridge();
          setImporterLaunchPdfPicker(false);
          setIsImportadorPedidoOpen(false);
        }}
        launchPdfFilePickerOnce={importerLaunchPdfPicker}
        onLaunchPdfFilePickerConsumed={handleImporterLaunchPdfPickerConsumed}
        onImportComplete={({ fornecedorId, fornecedorNome, items: importedItems, anexoFonte, tipoDocumentoAnexo }) => {
          if (anexoFonte && !anexoImportUploadedRef.current) {
            pendingAnexoImportRef.current = {
              file: anexoFonte,
              tipoDocumentoAnexo: tipoDocumentoAnexo || 'Comprovante',
            };
            if (pedido?.id) {
              void enviarAnexoImportacaoPendente(pedido.id, pedido.numero, pendingAnexoImportRef.current);
            } else {
              toast({
                title: 'Documento guardado para anexo',
                description: `O ${anexoFonte.type?.startsWith('image/') ? 'arquivo de imagem' : 'PDF'} será anexado ao pedido quando você salvar.`,
              });
            }
          }
          setFormData(prev => {
            const novosItens = importedItems.map((item) => {
              const produtoItem = produtos.find((p) => p.id === item.produto_id);
              // Item já veio normalizado do importador (unidade do PDF); só re-normalizar se faltar eixo canônico.
              let line =
                produtoItem && !item?.quantidade_base
                  ? normalizePurchaseItemToCommercial(produtoItem, item)
                  : { ...item };
              line = syncItemDescontoApresentacao(line);
              line = normalizeItemToCanonicalFactorOne(line, 'custo');
              const cost = roundToTwoDecimals(parseFloat(line.custo_unitario) || 0);
              const descUnit = roundToTwoDecimals(parseFloat(line.valor_desconto_item) || 0);
              const qtdBase = parseFloat(line.quantidade_base) || 0;
              const totalLinha = calcTotalItemCompraPedido(line);
              return {
                ...line,
                subtotal: roundToTwoDecimals(qtdBase * cost),
                total: totalLinha,
                custo_final_unitario: roundToTwoDecimals(cost - descUnit),
              };
            });
            return {
              ...prev,
              fornecedor_id: fornecedorId || prev.fornecedor_id,
              fornecedor_nome: fornecedorNome || prev.fornecedor_nome,
              itens: [...prev.itens, ...novosItens],
            };
          });
        }}
      />



       {/* FAB multi-role com Bússola */}
       {!isLocked && (
         <PedidoCompraFAB 
           pedido={{ ...formData, id: pedido?.id, numero: pedido?.numero, valor_itens: valorItens, valor_total: valorTotal }}
           onSave={handleInitiateSave}
           isSaving={isSaving}
           mostrarEnviarFinanceiro={!isLocked && !!pedido?.id && formData.status === 'Rascunho' && formData.itens.length > 0}
           onEnviarFinanceiro={() => {
             handleInitiateSave({ status: 'Aguardando Aprovação Financeira' });
           }}
           mostrarSolicitarEdicao={false}
           onSolicitarEdicao={() => setIsSolicitarEdicaoOpen(true)}
         />
       )}
       {isLocked && (
         <PedidoCompraFAB 
           pedido={{ ...formData, id: pedido?.id, numero: pedido?.numero, valor_itens: valorItens, valor_total: valorTotal }}
           onSave={handleInitiateSave}
           isSaving={isSaving}
           mostrarSolicitarEdicao={podeSolicitarCorrecao}
           onSolicitarEdicao={() => setIsSolicitarEdicaoOpen(true)}
           />
           )}

           <AnexosPedidoCompra
         pedidoId={pedido?.id}
         pedidoNumero={pedido?.numero}
         isOpen={isAnexosOpen}
         onClose={() => setIsAnexosOpen(false)}
       />

       <SolicitarEdicaoPDV
         pedido={pedido}
         currentUser={currentUser}
         isAdmin={currentUser?.role === 'admin'}
         isOpen={isSolicitarEdicaoOpen}
         onClose={() => setIsSolicitarEdicaoOpen(false)}
         onSuccess={() => onClose()}
       />

       {/* Dialog Novo Fornecedor */}
       <Dialog open={isNovoFornecedorOpen} onOpenChange={setIsNovoFornecedorOpen}>
         <DialogContent className="max-w-sm bg-card border-0 shadow-2xl rounded-2xl">
           <DialogHeader>
             <DialogTitle className="text-foreground">Novo Fornecedor</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div>
               <Label className="text-sm font-light text-muted-foreground mb-2 block">Nome *</Label>
               <Input
                 placeholder="Nome do fornecedor"
                 value={novoFornecedor.nome}
                 onChange={e => setNovoFornecedor({...novoFornecedor, nome: e.target.value})}
                 className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl text-foreground"
                 />
                 </div>
                 <div>
                 <Label className="text-sm font-light text-muted-foreground mb-2 block">Email</Label>
                 <Input
                 placeholder="email@fornecedor.com"
                 value={novoFornecedor.email}
                 onChange={e => setNovoFornecedor({...novoFornecedor, email: e.target.value})}
                 className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl text-foreground"
                 />
                 </div>
                 <div>
                 <Label className="text-sm font-light text-muted-foreground mb-2 block">Telefone</Label>
               <Input
                 placeholder="(00) 00000-0000"
                 value={novoFornecedor.telefone}
                 onChange={e => setNovoFornecedor({...novoFornecedor, telefone: e.target.value})}
                 className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl text-foreground"
                 />
                 </div>
                 <div>
                 <Label className="text-sm font-light text-muted-foreground mb-2 block">Endereço</Label>
                 <Input
                 placeholder="Endereço completo"
                 value={novoFornecedor.endereco}
                 onChange={e => setNovoFornecedor({...novoFornecedor, endereco: e.target.value})}
                 className="bg-muted/50 border-0 h-12 shadow-sm rounded-xl text-foreground"
                 />
                 </div>
                 </div>
           <DialogFooter className="gap-2 flex justify-end">
             <Button
               variant="outline"
               onClick={() => setIsNovoFornecedorOpen(false)}
               className="border-0 shadow-sm rounded-xl h-12"
               >
               Cancelar
               </Button>
               <Button
               onClick={handleCreateFornecedor}
               className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 text-white rounded-xl h-12"
             >
               Criar
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       </div>
       );
       }