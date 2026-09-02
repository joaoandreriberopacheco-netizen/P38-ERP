import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Check, FileText, Loader2, MessageCircle, Printer, Search, ShoppingCart, Receipt, X } from 'lucide-react';
import QuickBudgetProductSearch from '@/components/quick-budget/QuickBudgetProductSearch';
import QuickBudgetCartView from '@/components/quick-budget/QuickBudgetCartView';
import OrcamentosRapidosSalvosSheet from '@/components/quick-budget/OrcamentosRapidosSalvosSheet';
import OrcamentoRapidoCupomOverlay from '@/components/quick-budget/OrcamentoRapidoCupomOverlay';
import ProdutoQuantidadeDialog from '@/components/orcamento/ProdutoQuantidadeDialog';
import {
  buildQuickBudgetItem,
  computeOrcamentoRapidoDesconto,
  getFullPrice,
  getQuickBudgetUnitContext,
  recalculateItem,
} from '@/components/quick-budget/quickBudgetUtils';
import { shareOrDownloadHtmlDocument, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { toast } from 'sonner';
import {
  cleanupQuickAccessPortalLayers,
  QUICK_ACCESS_PANEL_SHELL_CLASS,
  QUICK_ACCESS_Z,
  QUICK_BUDGET_FLOW_CLASS,
  QUICK_BUDGET_SELECT_CLASS,
} from '@/lib/quickAccessOverlay';
import { getItemUnitKey } from '@/lib/productUnits';
import { createPageUrl } from '@/utils';
import { buildPDVVendedorQuickUrl } from '@/lib/pdvQuickAccessNavigate';
import {
  legacyItemToQuickBudget,
  salvarOrcamentoRapido,
} from '@/lib/orcamentoRapidoSql';
import { prepararOrcamentoParaPdv } from '@/lib/orcamentoRapidoPdvBridge';
import { quickBudgetStateToCupomProps, buildOrcamentoRapidoShareHtml } from '@/lib/orcamentoRapidoCupom';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';

function resolveFlowScreen({ itemDialog, isMobile, showCartMobile, showSalvos }) {
  if (itemDialog) return 'quantity';
  if (showSalvos) return 'salvos';
  if (isMobile && showCartMobile) return 'cart';
  return 'search';
}

const ORIGEM_CONFIG = {
  rapido: {
    eyebrow: 'Consulta de preços',
    title: 'Orçamento',
    ariaLabel: 'Orçamento',
  },
  tabela: {
    eyebrow: 'Tabela de preços',
    title: 'Orçamento',
    ariaLabel: 'Orçamento da tabela de preços',
  },
};

export default function OrcamentoPanel({
  open,
  onOpenChange,
  sessionKey = 0,
  origem = 'rapido',
  produtosIniciais = null,
  tabelaInicial = null,
  empresaInicial = null,
}) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [produtos, setProdutos] = useState([]);
  const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [itemDialog, setItemDialog] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showSalvos, setShowSalvos] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState(null);
  const [clienteNome, setClienteNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [empresa, setEmpresa] = useState(null);
  const [showCupom, setShowCupom] = useState(false);
  const [formatoImpressao, setFormatoImpressao] = useState('80mm');

  const [ajustePercentual, setAjustePercentual] = useState('');
  const [ajusteValor, setAjusteValor] = useState('');
  const [tipoValorAjuste, setTipoValorAjuste] = useState('percentual');
  const searchInputRef = useRef(null);

  const flowScreen = resolveFlowScreen({ itemDialog, isMobile, showCartMobile, showSalvos });
  const copy = ORIGEM_CONFIG[origem] || ORIGEM_CONFIG.rapido;
  const usaDadosExternos = origem === 'tabela' && Array.isArray(produtosIniciais);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + ((Number(item.quantidade) || 0) * (Number(item.preco_unitario) || 0)), 0),
    [items],
  );

  const handleAjustePercentualChange = useCallback((val) => {
    setAjustePercentual(val);
    setTipoValorAjuste('percentual');
    const pct = parseFloat(val) || 0;
    if (subtotal > 0 && pct > 0) {
      setAjusteValor((subtotal * pct / 100).toFixed(2));
    } else {
      setAjusteValor('');
    }
  }, [subtotal]);

  const handleAjusteValorChange = useCallback((val) => {
    setAjusteValor(val);
    setTipoValorAjuste('valor');
    const v = parseFloat(val) || 0;
    if (subtotal > 0 && v > 0) {
      setAjustePercentual((v / subtotal * 100).toFixed(2));
    } else {
      setAjustePercentual('');
    }
  }, [subtotal]);

  const descontoResumo = useMemo(
    () => computeOrcamentoRapidoDesconto({
      items,
      ajustePercentual,
      ajusteValor,
      tipoValorAjuste,
      limiteUsuario: currentUser?.limite_desconto,
      limiteTabela: tabelaSelecionada?.percentual_desconto_maximo,
    }),
    [items, ajustePercentual, ajusteValor, tipoValorAjuste, currentUser, tabelaSelecionada],
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (usaDadosExternos) {
      setProdutos(produtosIniciais);
      if (tabelaInicial) setTabelaSelecionada(tabelaInicial);
      if (empresaInicial) setEmpresa(empresaInicial);
      base44.auth.me().catch(() => null).then(setCurrentUser);
      return;
    }
    if (produtos.length > 0) return;
    (async () => {
      const [prods, tabelas, me, empresas] = await Promise.all([
        base44.entities.Produto.filter({ ativo: true }),
        base44.entities.TabelaPreco.filter({ ativo: true }).catch(() => []),
        base44.auth.me().catch(() => null),
        base44.entities.DadosEmpresa.list().catch(() => []),
      ]);
      setProdutos(prods || []);
      setCurrentUser(me);
      setEmpresa((empresas || [])[0] || null);
      const list = tabelas || [];
      const t =
        list.find((x) => x.id === me?.tabela_preco_id) ||
        list.find((x) => x.is_default) ||
        list[0] ||
        null;
      setTabelaSelecionada(t);
    })();
  }, [open, produtos.length, usaDadosExternos, produtosIniciais, tabelaInicial, empresaInicial]);

  useEffect(() => {
    if (!open || !usaDadosExternos) return;
    setProdutos(produtosIniciais || []);
  }, [open, usaDadosExternos, produtosIniciais]);

  useEffect(() => {
    if (!open || !tabelaInicial) return;
    setTabelaSelecionada(tabelaInicial);
  }, [open, tabelaInicial]);

  useEffect(() => {
    if (!open || !empresaInicial) return;
    setEmpresa(empresaInicial);
  }, [open, empresaInicial]);

  const resetFlow = () => {
    setItemDialog(null);
    setQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const resetPanel = () => {
    resetFlow();
    setItems([]);
    setIsSharing(false);
    setIsSaving(false);
    setShowCartMobile(false);
    setShowSalvos(false);
    setOrcamentoId(null);
    setClienteNome('');
    setObservacoes('');
    setShowCupom(false);
    setFormatoImpressao('80mm');
    setAjustePercentual('');
    setAjusteValor('');
    setTipoValorAjuste('percentual');
  };

  const handleClose = () => {
    cleanupQuickAccessPortalLayers();
    resetPanel();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      resetPanel();
      return undefined;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      cleanupQuickAccessPortalLayers();
    };
  }, [open]);

  useEffect(() => {
    if (!open || sessionKey === 0 || origem !== 'rapido') return;
    resetPanel();
    setProdutos([]);
  }, [sessionKey, open, origem]);

  const handleSelectProduct = (produto) => {
    const ctx = getQuickBudgetUnitContext(produto, tabelaSelecionada);
    const unidadeDefault = ctx.unidadeDefault;
    const sigla = unidadeDefault?.unidade || produto.unidade_principal || 'UN';
    const lineKey = getItemUnitKey(produto.id, sigla);
    const existing = items.find((item) => item.item_key === lineKey);
    setShowCartMobile(false);
    setItemDialog({
      produto,
      preco: getFullPrice(produto, tabelaSelecionada, unidadeDefault),
      unidadeSelecionada: unidadeDefault,
      unitOptions: ctx.unitOptions || [],
      qtdAtual: existing?.quantidade || 0,
    });
  };

  const closeItemDialog = () => setItemDialog(null);

  const handleDialogConfirm = (qtd, novoPreco, unidadeEscolhida) => {
    if (!itemDialog) return;
    const { produto } = itemDialog;
    const selectedUnit = unidadeEscolhida || itemDialog.unidadeSelecionada;

    if (qtd <= 0) {
      const lineKey = getItemUnitKey(produto.id, selectedUnit?.unidade || produto.unidade_principal || 'UN');
      setItems((prev) => prev.filter((item) => item.item_key !== lineKey));
      resetFlow();
      return;
    }

    const draft = buildQuickBudgetItem(produto, tabelaSelecionada, selectedUnit);
    const precoUnitario = produto.preco_livre && novoPreco != null ? novoPreco : draft.preco_unitario;
    const nextItem = recalculateItem({
      ...draft,
      quantidade: qtd,
      preco_unitario: precoUnitario,
    });
    const lineKey = nextItem.item_key;

    setItems((prev) => {
      const existing = prev.find((item) => item.item_key === lineKey);
      if (existing) {
        return prev.map((item) => (item.item_key === lineKey
          ? recalculateItem({
              ...item,
              preco_venda_lista: nextItem.preco_venda_lista,
              tem_ajuste_tabela: nextItem.tem_ajuste_tabela,
              preco_cheio: nextItem.preco_cheio,
              preco_minimo: nextItem.preco_minimo,
              quantidade: qtd,
              preco_unitario: nextItem.preco_unitario,
              unidade: nextItem.unidade,
              unidade_medida: nextItem.unidade_medida,
              unidade_sigla: nextItem.unidade_sigla,
              fator_conversao: nextItem.fator_conversao,
            })
          : item));
      }
      return [nextItem, ...prev];
    });

    resetFlow();
  };

  const handleRemoveItem = (itemKey) => {
    setItems((prev) => prev.filter((item) => item.item_key !== itemKey));
  };

  const handleUpdateQuantity = (itemKey, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(itemKey);
      return;
    }
    setItems((prev) => prev.map((item) => (
      item.item_key === itemKey ? recalculateItem({ ...item, quantidade: newQty }) : item
    )));
  };

  const handleCarregarSalvo = (orcamento) => {
    const loaded = (orcamento.itens || []).map(legacyItemToQuickBudget);
    setItems(loaded);
    setOrcamentoId(orcamento.id);
    setClienteNome(orcamento.cliente_nome || '');
    setObservacoes(orcamento.observacoes || '');
    if (Number(orcamento.valor_desconto) > 0) {
      setAjusteValor(String(orcamento.valor_desconto));
      setTipoValorAjuste('valor');
      setAjustePercentual('');
    } else {
      setAjustePercentual('');
      setAjusteValor('');
    }
    setShowSalvos(false);
    toast.success('Orçamento carregado');
    setTimeout(() => searchInputRef.current?.focus(), 80);
  };

  const persistirOrcamento = async () => {
    if (items.length === 0) return null;
    if (descontoResumo.ajusteExcedido) {
      toast.error(`Desconto excede o limite de ${descontoResumo.limite}%`);
      return null;
    }

    setIsSaving(true);
    try {
      const salvo = await salvarOrcamentoRapido({
        id: orcamentoId,
        items,
        clienteNome,
        observacoes,
        subtotal: descontoResumo.subtotal,
        valorDesconto: descontoResumo.valorDesconto,
        valorTotal: descontoResumo.total,
        tabelaPrecoId: tabelaSelecionada?.id,
        vendedorId: currentUser?.id,
        vendedorNome: currentUser?.full_name || currentUser?.nome,
      });
      setOrcamentoId(salvo?.id || orcamentoId);
      toast.success(orcamentoId ? 'Orçamento atualizado' : 'Orçamento salvo');
      return salvo;
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar o orçamento');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarOrcamento = async () => {
    await persistirOrcamento();
  };

  const handleImprimir = async () => {
    if (descontoResumo.ajusteExcedido) {
      toast.error(`Desconto excede o limite de ${descontoResumo.limite}%`);
      return;
    }
    await persistirOrcamento();
    setShowCupom(true);
  };

  const handleConcluir = async () => {
    if (items.length > 0) {
      await persistirOrcamento();
    }
    handleClose();
  };

  const mapItemsParaPdv = () => items.map((item) => ({
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    codigo_interno: item.codigo_interno || '',
    quantidade: item.quantidade,
    unidade_medida: item.unidade_medida || item.unidade || 'UN',
    fator_conversao: item.fator_conversao || 1,
    quantidade_base: item.quantidade_base,
    preco_unitario: item.preco_unitario,
    preco_unitario_praticado: item.preco_unitario,
    custo_unitario_momento: 0,
    total: item.total,
    estoque_disponivel: 999,
    item_key: item.item_key,
  }));

  const handleEnviarPdv = async () => {
    if (descontoResumo.ajusteExcedido) {
      toast.error(`Desconto excede o limite de ${descontoResumo.limite}%`);
      return;
    }
    const salvo = await persistirOrcamento();
    prepararOrcamentoParaPdv({
      items: mapItemsParaPdv(),
      clienteNome,
      observacoes,
      valorDesconto: descontoResumo.valorDesconto,
      orcamentoId: salvo?.id || orcamentoId,
      orcamentoNumero: salvo?.numero || '',
    });
    handleClose();
    if (isDesktop) {
      navigate(buildPDVVendedorQuickUrl());
    } else {
      navigate(createPageUrl('PDVVendedor'));
    }
  };

  const buildShareHtml = () => {
    const { subtotal: st, valorDesconto, total, catalogSubtotal } = descontoResumo;
    const cupom = quickBudgetStateToCupomProps({
      items,
      descontoResumo,
      clienteNome,
      observacoes,
    });
    return buildOrcamentoRapidoShareHtml({
      empresa,
      nomeTabela: tabelaSelecionada?.nome_tabela || tabelaSelecionada?.nome || '',
      clienteNome,
      numero: orcamentoId ? String(orcamentoId).slice(0, 8) : '',
      itens: cupom.itens,
      subtotal: st,
      desconto: valorDesconto,
      total,
      observacoes: cupom.observacoes,
      catalogSubtotal,
    });
  };

  const handleShare = async () => {
    if (items.length === 0 || isSharing) return;
    setIsSharing(true);
    const html = buildShareHtml();
    try {
      if (shouldUseMobileDocumentExport()) {
        const r = await shareOrDownloadHtmlDocument(html, `orcamento-rapido-${Date.now()}.html`, 'Orçamento rápido');
        if (r === 'downloaded') toast.success('Arquivo baixado');
      } else {
        const shareWindow = window.open('', '_blank');
        if (shareWindow) {
          shareWindow.document.open();
          shareWindow.document.write(html);
          shareWindow.document.close();
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Não foi possível exportar o orçamento');
    } finally {
      setIsSharing(false);
    }
  };

  const cartProps = {
    items,
    descontoResumo,
    ajustePercentual,
    ajusteValor,
    onAjustePercentualChange: handleAjustePercentualChange,
    onAjusteValorChange: handleAjusteValorChange,
    limiteTabela: tabelaSelecionada?.percentual_desconto_maximo,
    clienteNome,
    setClienteNome,
    observacoes,
    setObservacoes,
    formatoImpressao,
    setFormatoImpressao,
    onSaveCart: () => {
      setShowCartMobile(false);
      setTimeout(() => searchInputRef.current?.focus(), 80);
    },
    onSalvarOrcamento: handleSalvarOrcamento,
    onImprimir: handleImprimir,
    onEnviarPdv: handleEnviarPdv,
    onClose: handleConcluir,
    onShare: handleShare,
    isSharing,
    isSaving,
    onRemoveItem: handleRemoveItem,
    onUpdateQuantity: handleUpdateQuantity,
  };

  const cupomProps = quickBudgetStateToCupomProps({
    items,
    descontoResumo,
    clienteNome,
    observacoes,
  });

  if (!open || typeof document === 'undefined') return null;

  const panelZ = origem === 'tabela' ? 60 : QUICK_ACCESS_Z.panel;

  const shell = (
    <div
      className={cn(
        'fixed inset-0 flex min-h-0 flex-col overflow-hidden font-din-1451 bg-muted/40 dark:bg-background',
        QUICK_ACCESS_PANEL_SHELL_CLASS,
      )}
      style={{ zIndex: panelZ }}
      role="dialog"
      aria-modal="true"
      aria-label={copy.ariaLabel}
    >
      {flowScreen === 'search' && (
        <>
          <div className="flex-shrink-0 px-3 pt-3 pb-2">
            <div className={cn('rounded-[28px] bg-card dark:bg-background shadow-sm px-4 py-3', P38_FIELD_SURFACE)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{copy.eyebrow}</p>
                    <h2 className="text-xl font-semibold text-foreground font-glacial leading-tight">{copy.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {tabelaSelecionada?.nome_tabela || tabelaSelecionada?.nome || 'Tabela de preços'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSalvos(true)}
                    className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center text-muted-foreground"
                    aria-label="Buscar orçamentos salvos"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 min-h-0 flex-col px-3">
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden pb-28 md:pb-5">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-1">
                  <QuickBudgetProductSearch
                    inputRef={searchInputRef}
                    query={query}
                    onQueryChange={setQuery}
                    produtos={produtos}
                    tabelaPreco={tabelaSelecionada}
                    onAddProduct={handleSelectProduct}
                    onSubmitFirstResult={handleSelectProduct}
                  />

                  {items.length === 0 && (
                    <div className={cn('rounded-[28px] px-4 py-4 flex items-center gap-3 text-xs text-muted-foreground', P38_FIELD_SURFACE, 'bg-card dark:bg-background')}>
                      <Search className="w-4 h-4 shrink-0" />
                      Busque produtos, salve, imprima (cupom ou A4) ou envie ao PDV.
                    </div>
                  )}
                </div>
              </div>

              {items.length > 0 && !isMobile && (
                <div className="hidden desktop-layout:flex w-80 lg:w-[22rem] flex-shrink-0 pl-3 pb-5 flex-col min-h-0">
                  <QuickBudgetCartView {...cartProps} layout="sidebar" />
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="relative border-t border-border/40 bg-card/95 dark:bg-background/95 backdrop-blur-md px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4 shadow-[0_-10px_26px_rgba(15,23,42,0.08)] dark:shadow-[0_-10px_26px_rgba(0,0,0,0.32)]">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">Total</div>
                    <div className="text-xl font-bold text-foreground leading-tight font-glacial tabular-nums">
                      {descontoResumo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => setShowCartMobile(true)}
                      aria-label="Abrir carrinho"
                      className="relative w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted flex-shrink-0"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      <span className="absolute -top-0.5 -right-0.5 bg-[#a4ce33] text-[#1f1d22] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {items.length}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleImprimir}
                    disabled={isSaving || descontoResumo.ajusteExcedido}
                    className="h-10 px-3 p38-btn-primary rounded-xl font-medium flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Imprimir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConcluir}
                    disabled={isSaving}
                    className="h-10 px-3 bg-muted text-foreground/90 rounded-xl font-medium flex items-center justify-center gap-1.5 text-sm"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Concluir
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing}
                    className="h-10 px-3 bg-muted text-foreground rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {flowScreen === 'cart' && (
        <div className={`absolute inset-0 flex flex-col bg-muted/40 dark:bg-background ${QUICK_BUDGET_FLOW_CLASS.cart}`}>
          <div className="flex-shrink-0 px-3 pt-3 pb-2">
            <div className={cn('rounded-[28px] bg-card dark:bg-background shadow-sm px-4 py-3 flex items-center justify-between', P38_FIELD_SURFACE)}>
              <button
                type="button"
                onClick={() => setShowCartMobile(false)}
                className="w-10 h-10 rounded-2xl bg-muted dark:bg-card flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground font-glacial">Carrinho</p>
                <p className="text-[11px] text-muted-foreground">Orçamento</p>
              </div>
              <div className="w-10" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-8">
            <QuickBudgetCartView {...cartProps} compact />
          </div>
        </div>
      )}

      {flowScreen === 'salvos' && (
        <OrcamentosRapidosSalvosSheet
          isOpen
          onClose={() => setShowSalvos(false)}
          onCarregar={handleCarregarSalvo}
          tabelaNome={tabelaSelecionada?.nome_tabela || tabelaSelecionada?.nome || ''}
          empresa={empresa}
        />
      )}

      <OrcamentoRapidoCupomOverlay
        open={showCupom}
        cupomProps={cupomProps}
        formato={formatoImpressao}
        nomeTabela={tabelaSelecionada?.nome_tabela || tabelaSelecionada?.nome || ''}
        empresa={empresa}
        onClose={() => setShowCupom(false)}
      />

      {flowScreen === 'quantity' && itemDialog && (
        <ProdutoQuantidadeDialog
          embedded
          produto={itemDialog.produto}
          preco={itemDialog.preco}
          qtdAtual={itemDialog.qtdAtual}
          unidadeSelecionada={itemDialog.unidadeSelecionada}
          unitOptions={itemDialog.unitOptions}
          onClose={closeItemDialog}
          onConfirm={handleDialogConfirm}
          dialogTitleId="quick-budget-item-dialog-title"
          overlayClassName={QUICK_BUDGET_FLOW_CLASS.quantity}
          selectContentClassName={QUICK_BUDGET_SELECT_CLASS}
        />
      )}
    </div>
  );

  return createPortal(shell, document.body);
}
