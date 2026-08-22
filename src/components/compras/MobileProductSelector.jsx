import React, { useState, useMemo, useEffect, useRef } from 'react';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Minus, ShoppingCart, ChevronLeft, Trash2, DollarSign, AlertCircle, ArrowRight, TrendingDown, TrendingUp, Boxes } from 'lucide-react';
import NovoProdutoRapidoDialog from './NovoProdutoRapidoDialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import CatalogLotePicker, { CatalogLoteModeToggle } from '@/components/compras/CatalogLotePicker';
import CatalogProductStockLine from '@/components/compras/CatalogProductStockLine';
import { buildLoteIncomingFromDraft } from '@/lib/catalogLoteUtils';
import { cn } from '@/lib/utils';
import {
  P38_ACCENT,
  P38_DROPDOWN_PANEL,
  P38_FIELD_SURFACE,
  P38_SEARCH,
  P38_SEARCH_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import {
  buildPurchaseUnitOptions,
  pickDefaultPurchaseUnit,
  calculateBaseQuantity,
  syncItemQuantidadeBaseComercial,
  getItemUnitKey,
  applyPurchaseUnitOptionToItem,
  getCustoApresentacaoItem,
  getDescontoApresentacaoItem,
  getCustoFinalApresentacaoItem,
  getDescontoPctApresentacaoItem,
  isItemAcrescimoCompra,
  applyItemDescontoPctApresentacao,
  applyItemDescontoValorApresentacao,
  calcTotalItemCompraPedido,
  custoApresentacaoParaFator1,
  custoFator1ParaApresentacao,
  resolveValorDescontoCompraPadraoFator1,
  resolveDescontoPctCompraProduto,
  syncItemDescontoApresentacao,
  normalizeItemToCanonicalFactorOne,
  getItemCompraExibicaoVitrine,
} from '@/lib/productUnits';

/** Mobile: overlay fullscreen. Desktop: painel dentro da montagem da cotação. */
const SELECTOR_PANEL_CLASS = cn(
  'fixed inset-0 z-[60] flex flex-col bg-card',
  'desktop-layout:relative desktop-layout:inset-auto desktop-layout:z-0',
  'desktop-layout:flex-1 desktop-layout:min-h-0 desktop-layout:overflow-hidden',
);

const SELECTOR_FAB_CLASS =
  'fixed right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full p38-btn-primary shadow-lg transition-shadow hover:shadow-xl p38-bottom-fab1 desktop-layout:absolute desktop-layout:right-4 desktop-layout:bottom-4';

/** Barra de busca — contraste sobre fundo branco no modo claro. */
const CATALOG_SEARCH_FIELD = cn(
  P38_SEARCH,
  'h-12 border-0 shadow-sm bg-card',
  'focus-within:ring-2 focus-within:ring-[#f07a1a]/18',
  'dark:focus-within:ring-[#a4ce33]/20',
);

/** Item destacado na navegação ↑↓ (lista desktop). */
const CATALOG_LIST_ITEM_SELECTED =
  'border-l-[#4a5240] bg-[#4a5240]/10 dark:border-l-[#a4ce33] dark:bg-[#a4ce33]/12';

/** Card destacado na navegação ↑↓ (mobile). */
const CATALOG_CARD_SELECTED = cn(
  'ring-2 ring-[#4a5240]/55 dark:ring-[#a4ce33]/70',
  'bg-[#4a5240]/10 dark:bg-[#a4ce33]/12 shadow-sm',
);

/** Scroll dentro do painel certo — scrollIntoView no desktop ia para o ancestor errado. */
function scrollElementIntoScrollParent(scrollParent, element, { paddingTop = 0, paddingBottom = 0 } = {}) {
  if (!scrollParent || !element) return;
  const parentRect = scrollParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const relativeTop = elementRect.top - parentRect.top + scrollParent.scrollTop;
  const relativeBottom = relativeTop + elementRect.height;
  const viewTop = scrollParent.scrollTop + paddingTop;
  const viewBottom = scrollParent.scrollTop + scrollParent.clientHeight - paddingBottom;
  if (relativeTop < viewTop) {
    scrollParent.scrollTop = relativeTop - paddingTop;
  } else if (relativeBottom > viewBottom) {
    scrollParent.scrollTop = relativeBottom - scrollParent.clientHeight + paddingBottom;
  }
}

export default function MobileProductSelector({ 
  items, 
  products, 
  onAddItem, 
  onUpdateItem, 
  onRemoveItem,
  formatCurrency,
  onOpenAdjustPrices,
  isLocked,
  onProductCreated,
  onOpenImporter,
  onAddItemsBatch,
}) {
  const [view, setView] = useState('menu'); // 'menu' | 'discount-entry' | 'catalog' | 'cart' | 'edit'
  const [search, setSearch] = useState('');
  const [modoLote, setModoLote] = useState(false);
  const [loteDraft, setLoteDraft] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [custoInput, setCustoInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showNovoProduto, setShowNovoProduto] = useState(false);
  const [unitSelector, setUnitSelector] = useState({ open: false, product: null });
  const [editUnitSelector, setEditUnitSelector] = useState({ open: false });
  // Desconto global sobre preços de compra
  const [descontoGlobalPct, setDescontoGlobalPct] = useState(0);
  const [descontoGlobalPctInput, setDescontoGlobalPctInput] = useState('');
  // Desconto por item na tela de edição (interdependentes)
  const [descontoPctInput, setDescontoPctInput] = useState('');
  const [descontoValorInput, setDescontoValorInput] = useState('');
  // Estado da tela de entrada de desconto global
  const [discountInputVal, setDiscountInputVal] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('desconto');
  const discountInputRef = React.useRef(null);
  const quantidadeInputRef = React.useRef(null);
  const custoInputRef = React.useRef(null);
  const descontoPctInputRef = React.useRef(null);
  const descontoValorInputRef = React.useRef(null);
  const catalogScrollRef = useRef(null);
  const catalogStickyRef = useRef(null);
  const catalogDropdownScrollRef = useRef(null);
  const catalogDropdownStickyRef = useRef(null);
  const catalogItemRefs = useRef([]);

  // Auto-focus ao entrar na tela de edição
  useEffect(() => {
    if (view === 'edit' && quantidadeInputRef.current) {
      setTimeout(() => {
        quantidadeInputRef.current?.focus();
        quantidadeInputRef.current?.select();
      }, 100);
    }
  }, [view]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    return filterAndSortProducts(products, search, { limit: 60 });
  }, [products, search]);

  /** pt-BR: "1.234,56" ou decimal com ponto "15.49". */
  const parsePtBr = (s) => {
    const str = String(s ?? '').trim();
    if (!str) return 0;
    if (str.includes(',')) {
      return roundToTwoDecimals(parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0);
    }
    return roundToTwoDecimals(parseFloat(str) || 0);
  };
  const fmtBR = (n) => roundToTwoDecimals(parseFloat(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const applyDescontoInputsFromItem = (item) => {
    const custoApres = roundToTwoDecimals(getCustoApresentacaoItem(item));
    const descApres = Math.abs(roundToTwoDecimals(getDescontoApresentacaoItem(item)));
    const pct = getDescontoPctApresentacaoItem(item);
    setCustoInput(custoApres.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setDescontoPctInput(pct > 0 ? String(Math.round(pct * 100) / 100) : '');
    setDescontoValorInput(descApres > 0 ? descApres.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  };

  const hydrateEditInputs = (item) => {
    const synced = syncItemQuantidadeBaseComercial(syncItemDescontoApresentacao(item));
    setQuantidadeInput((parseFloat(synced.quantidade) || 1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    applyDescontoInputsFromItem(synced);
    return synced;
  };

  /** Garante que a qty digitada no input (estado React) entra no item antes de converter unidade ou salvar. */
  const mergeEditingQuantidadeFromInput = (item) => {
    if (!item) return item;
    const qtyInput = parsePtBr(quantidadeInput);
    const qty = qtyInput > 0 ? qtyInput : (parseFloat(item.quantidade) || 0);
    return syncItemQuantidadeBaseComercial({ ...item, quantidade: qty });
  };

  const syncDescontoFromPct = (item, custoApres, pctRaw) => {
    const pct = roundToTwoDecimals(parsePtBr(pctRaw));
    return applyItemDescontoPctApresentacao(item, custoApres, pct, isItemAcrescimoCompra(item));
  };

  const syncDescontoFromValor = (item, custoApres, valorRaw) => {
    const absDesc = roundToTwoDecimals(parsePtBr(valorRaw));
    return applyItemDescontoValorApresentacao(item, custoApres, absDesc, isItemAcrescimoCompra(item));
  };

  const syncCustoFromInput = (item, custoApresRaw) => {
    const custoApres = roundToTwoDecimals(parsePtBr(custoApresRaw));
    const pctStored = parseFloat(item?.desconto_pct_item);
    const pct = pctStored > 0 ? pctStored : getDescontoPctApresentacaoItem(item);
    let next = syncItemDescontoApresentacao(item, custoApres);
    if (pct > 0) {
      next = applyItemDescontoPctApresentacao(next, custoApres, pct, isItemAcrescimoCompra(item));
    }
    return next;
  };

  const startEditingProductWithUnit = (product, selectedUnit) => {
    if (!product || !selectedUnit) return;

    const unitKey = getItemUnitKey(product.id, selectedUnit.unidade);
    const index = items.findIndex(i => (i.item_key || getItemUnitKey(i.produto_id, i.unidade_medida || 'UN')) === unitKey);
    if (index >= 0) {
      handleEditItem(index);
      return;
    }

    const fator = parseFloat(selectedUnit.fator_conversao) || 1;
    const custoApres = roundToTwoDecimals(selectedUnit.valor_unitario || 0);
    const custoF1 = roundToTwoDecimals(custoApresentacaoParaFator1(custoApres, fator));
    const descontoValor = descontoGlobalPct !== 0
      ? roundToTwoDecimals(
          (descontoGlobalPct < 0 ? -1 : 1) * custoF1 * Math.abs(descontoGlobalPct) / 100,
        )
      : resolveValorDescontoCompraPadraoFator1(product, custoF1);

    let newItem = applyPurchaseUnitOptionToItem(
      {
        produto_id: product.id,
        produto_nome: product.nome,
        codigo_produto: product.codigo_interno || product.codigo_barras || '',
        item_key: unitKey,
        quantidade: 1,
        custo_unitario: custoF1,
        valor_desconto_item: descontoValor,
        desconto_pct_item: descontoGlobalPct !== 0
          ? Math.abs(descontoGlobalPct)
          : resolveDescontoPctCompraProduto(product, custoF1),
      },
      product,
      selectedUnit,
      { preserveQuantidadeBase: false, usarCustoSugerido: true },
    );
    newItem = syncItemDescontoApresentacao(syncItemQuantidadeBaseComercial(newItem), custoApres);

    setEditingItem(newItem);
    setQuantidadeInput((1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    applyDescontoInputsFromItem(newItem);
    setEditingIndex(-1);
    setView('edit');
  };

  const handleSelectProduct = (product) => {
    const defaultOpt = pickDefaultPurchaseUnit(product);
    if (!defaultOpt) return;
    startEditingProductWithUnit(product, defaultOpt);
  };

  const handleEditItem = (index) => {
    const item = items[index];
    const synced = hydrateEditInputs(item);
    setEditingItem(synced);
    setEditingIndex(index);
    setView('edit');
  };

  const handleConfirmUnitInEdit = (unitOption) => {
    if (!editingItem || !unitOption) return;
    const product = products.find((p) => p.id === editingItem.produto_id);
    if (!product) return;
    const itemComQtyAtual = mergeEditingQuantidadeFromInput(editingItem);
    const updated = applyPurchaseUnitOptionToItem(itemComQtyAtual, product, unitOption, {
      preserveQuantidadeBase: true,
    });
    const custoApres = roundToTwoDecimals(unitOption.valor_unitario || getCustoApresentacaoItem(updated));
    const synced = syncItemDescontoApresentacao(updated, custoApres);
    setEditingItem(synced);
    hydrateEditInputs(synced);
    setEditUnitSelector({ open: false });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    const itemComQtyAtual = mergeEditingQuantidadeFromInput(editingItem);
    const quantidade = parseFloat(itemComQtyAtual.quantidade) || 0;
    const fatorConversao = parseFloat(itemComQtyAtual.fator_conversao) || 1;
    const custoApres = roundToTwoDecimals(parsePtBr(custoInput));
    const isAcrescimo = isItemAcrescimoCompra(editingItem);
    const descApres = roundToTwoDecimals(parsePtBr(descontoValorInput));
    const pctItem = roundToTwoDecimals(parsePtBr(descontoPctInput));

    let itemDraft = {
      ...itemComQtyAtual,
      quantidade,
      quantidade_base: calculateBaseQuantity(quantidade, fatorConversao),
    };
    itemDraft = syncItemDescontoApresentacao(itemDraft, custoApres);
    if (pctItem > 0) {
      itemDraft = applyItemDescontoPctApresentacao(itemDraft, custoApres, pctItem, isAcrescimo);
    } else if (descApres > 0) {
      itemDraft = applyItemDescontoValorApresentacao(itemDraft, custoApres, descApres, isAcrescimo);
    }

    const custoF1 = roundToTwoDecimals(itemDraft.custo_unitario);
    const descontoF1 = roundToTwoDecimals(itemDraft.valor_desconto_item);
    const quantidadeBase = itemDraft.quantidade_base;
    const custoFinalF1 = roundToTwoDecimals(custoF1 - descontoF1);

    let itemAtualizado = normalizeItemToCanonicalFactorOne({
      ...itemDraft,
      quantidade_base: quantidadeBase,
      subtotal: roundToTwoDecimals(quantidadeBase * custoF1),
      custo_final_unitario: custoFinalF1,
      total: calcTotalItemCompraPedido(itemDraft),
    }, 'custo');

    if (editingIndex >= 0) {
      onUpdateItem(editingIndex, itemAtualizado);
    } else {
      onAddItem(itemAtualizado);
    }
    
    // Reset form and return to catalog for quick next product
    setEditingItem(null);
    setEditingIndex(-1);
    setSearch('');
    setView('catalog');
    
    // Small delay to ensure state is updated before next action
    setTimeout(() => {
      const searchInput = document.querySelector('[placeholder="Buscar produto..."]');
      searchInput?.focus();
    }, 100);
  };

  const calculateTotal = (item) => {
    if (!item) return 0;
    const synced = syncItemDescontoApresentacao(syncItemQuantidadeBaseComercial(item));
    return calcTotalItemCompraPedido(synced);
  };

  const cartProductIds = useMemo(
    () => items.map((i) => i.produto_id).filter(Boolean),
    [items],
  );

  const handleConfirmLote = () => {
    const incoming = buildLoteIncomingFromDraft(loteDraft);
    if (incoming.length === 0) return;
    if (onAddItemsBatch) {
      onAddItemsBatch(incoming, products);
    } else {
      incoming.forEach(({ produto_id, quantidade }) => {
        const product = products.find((p) => p.id === produto_id);
        if (!product) return;
        onAddItem({
          produto_id: product.id,
          produto_nome: product.nome,
          quantidade,
        });
      });
    }
    setLoteDraft({});
  };

  const patchEditingQuantidade = (quantidade) => {
    setEditingItem((prev) => {
      if (!prev) return prev;
      return syncItemQuantidadeBaseComercial({ ...prev, quantidade });
    });
  };

  // Sincroniza ao entrar na tela de desconto
  useEffect(() => {
    if (view === 'discount-entry') {
      setDiscountInputVal(descontoGlobalPct !== 0 ? String(Math.abs(descontoGlobalPct)) : '');
      setTipoDesconto(descontoGlobalPct < 0 ? 'acrescimo' : 'desconto');
      setTimeout(() => discountInputRef.current?.focus(), 150);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'catalog' || selectedIndex < 0 || filteredProducts.length === 0) return;
    catalogItemRefs.current = catalogItemRefs.current.slice(0, filteredProducts.length);
    const activeItem = catalogItemRefs.current[selectedIndex];
    if (!activeItem) return;

    const raf = requestAnimationFrame(() => {
      const dropdown = catalogDropdownScrollRef.current;
      if (dropdown?.getClientRects().length) {
        const stickyH = catalogDropdownStickyRef.current?.offsetHeight ?? 0;
        scrollElementIntoScrollParent(dropdown, activeItem, { paddingTop: stickyH, paddingBottom: 4 });
        return;
      }
      const scrollRoot = catalogScrollRef.current;
      if (!scrollRoot) return;
      const stickyH = catalogStickyRef.current?.offsetHeight ?? 0;
      scrollElementIntoScrollParent(scrollRoot, activeItem, { paddingTop: stickyH, paddingBottom: 8 });
    });
    return () => cancelAnimationFrame(raf);
  }, [view, selectedIndex, filteredProducts, search]);

  if (view === 'discount-entry') {
    const numVal = parseFloat(discountInputVal.replace(',', '.')) || 0;

    const handleConfirm = () => {
      const final = tipoDesconto === 'acrescimo' ? -numVal : numVal;
      setDescontoGlobalPct(final);
      setDescontoGlobalPctInput(numVal !== 0 ? String(numVal) : '');
      setView('catalog');
    };

    const isDesconto = tipoDesconto === 'desconto';

    return (
      <div className={SELECTOR_PANEL_CLASS}>
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-border/15 dark:border-white/10 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="h-10 w-10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="ml-2 font-semibold text-foreground">Desconto / Acréscimo Global</span>
        </div>

        <div className="flex-1 flex flex-col px-6 pt-8 pb-6 gap-6">
          {/* Toggle Desconto / Acréscimo */}
          <div className="flex rounded-2xl bg-muted p-1 gap-1">
            <button
              onClick={() => setTipoDesconto('desconto')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                isDesconto
                  ? 'bg-card dark:bg-muted text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              Desconto
            </button>
            <button
              onClick={() => setTipoDesconto('acrescimo')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                !isDesconto
                  ? 'bg-card dark:bg-muted text-red-600 dark:text-red-400 shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Acréscimo
            </button>
          </div>

          {/* Visor com input nativo */}
          <div className="bg-muted/50 rounded-2xl px-6 py-8 flex flex-col items-center shadow-sm gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">
              {isDesconto ? 'Desconto sobre todos os itens' : 'Acréscimo sobre todos os itens'}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-5xl font-bold ${isDesconto ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {isDesconto ? '−' : '+'}
              </span>
              <input autoComplete="off"
                ref={discountInputRef}
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.01"
                value={discountInputVal}
                onChange={e => setDiscountInputVal(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="0"
                className={`w-40 text-center text-6xl font-bold bg-transparent border-none outline-none tabular-nums ${
                  isDesconto ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                }`}
                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
              />
              <span className="text-3xl font-medium text-muted-foreground">%</span>
            </div>
            {numVal > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Ex: R$ 100,00 → <strong className={isDesconto ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>
                  R$ {(isDesconto ? 100 - numVal : 100 + numVal).toFixed(2)}
                </strong>
              </p>
            )}
          </div>

          <div className="flex-1" />

          {/* Botões de ação */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-14 text-base rounded-2xl border-0 shadow-sm"
              onClick={() => {
                setDescontoGlobalPct(0);
                setDescontoGlobalPctInput('');
                setView('catalog');
              }}
            >
              Sem desc./acrésc.
            </Button>
            <Button
              className="flex-1 h-14 text-base rounded-2xl"
              onClick={handleConfirm}
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Buscar Itens
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Menu Principal
  if (view === 'menu') {
    const menuCardClass = cn(
      'w-full rounded-2xl p-5 text-left shadow-sm transition-all active:scale-[0.99]',
      P38_FIELD_SURFACE,
    );
  const cartBadgeClass =
    'absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#a4ce33] px-1 text-xs font-bold text-[#1f1d22]';

    return (
      <div className="flex h-full min-h-0 flex-col bg-card">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 desktop-layout:max-w-4xl desktop-layout:mx-auto desktop-layout:w-full desktop-layout:content-start">
          {/* Buscar Produtos */}
          <button
            onClick={() => setView('catalog')}
            className={cn(menuCardClass, 'flex items-center gap-4')}
            disabled={isLocked}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
              <Search className="w-6 h-6 text-foreground/90" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-foreground">Buscar Produtos</div>
              <div className="text-xs text-muted-foreground mt-0.5">Adicionar itens ao pedido</div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" />
          </button>

          {/* Resumo do Pedido */}
          <button
            onClick={() => setView('cart')}
            className={cn(menuCardClass, 'flex items-center gap-4')}
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
              <ShoppingCart className="w-6 h-6 text-foreground/90" />
              {items.length > 0 && (
                <div className={cartBadgeClass}>
                  {items.length}
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-foreground">Resumo do Pedido</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {items.length > 0 ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : 'Nenhum item adicionado'}
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" />
          </button>

          {/* Importar itens */}
          <button
            onClick={() => onOpenImporter?.()}
            className={cn(menuCardClass, 'flex items-center gap-4')}
            disabled={isLocked}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
              <Plus className="w-6 h-6 text-foreground/90" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-foreground">Importar Itens</div>
              <div className="text-xs text-muted-foreground mt-0.5">Abre já em PDF — ou escolha foto</div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" />
          </button>

          {/* Ajustar Preços */}
          <button
            onClick={() => onOpenAdjustPrices?.()}
            disabled={items.length === 0}
            className={cn(
              menuCardClass,
              'flex items-center gap-4',
              items.length === 0 && 'opacity-50',
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
              <DollarSign className="w-6 h-6 text-foreground/90" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-foreground">Ajustar Preços</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {items.length === 0 ? 'Adicione itens primeiro' : 'Atualizar custos dos produtos'}
              </div>
            </div>
            <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  if (view === 'edit' && editingItem) {
    const total = calculateTotal(editingItem);
    const editProduct = products.find((p) => p.id === editingItem.produto_id);
    const editHasAltUnits = editProduct && buildPurchaseUnitOptions(editProduct).length > 1;
    return (
      <>
      <div className={SELECTOR_PANEL_CLASS}>
        <div className="flex items-center p-4 border-b border-border/15 dark:border-white/10 flex-shrink-0 gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setEditingItem(null);
            setEditingIndex(-1);
            setView('catalog');
          }} className="h-10 w-10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="ml-2 font-medium truncate flex-1 text-foreground">{editingItem.produto_nome}</div>
          {editHasAltUnits ? (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => {
                setEditingItem((prev) => mergeEditingQuantidadeFromInput(prev));
                setEditUnitSelector({ open: true });
              }}
              className="flex items-center gap-1 shrink-0"
            >
              <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground border-0 shadow-sm">
                {editingItem.unidade_medida || 'UN'}
              </Badge>
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">trocar</span>
            </button>
          ) : (
            <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground border-0 shadow-sm shrink-0">
              {editingItem.unidade_medida || 'UN'}
            </Badge>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-5 desktop-layout:mx-auto desktop-layout:w-full desktop-layout:max-w-2xl">
          {isLocked && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <span className="font-medium">Edição bloqueada.</span> Pedido em aprovação financeira.
                </p>
              </div>
            </div>
          )}
          {/* Quantity Stepper */}
          <div className={cn('flex flex-col items-center justify-center rounded-2xl p-5', P38_FIELD_SURFACE)}>
             <Label className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Quantidade ({editingItem.unidade_medida})</Label>
             <div className="flex items-center gap-5">
                <Button 
                 variant="outline" size="icon" className="h-11 w-11 rounded-full border-border/40 dark:border-border/40"
                 onClick={() => {
                   const newVal = Math.max(1, (parseFloat(editingItem.quantidade) || 0) - 1);
                   patchEditingQuantidade(newVal);
                   setQuantidadeInput(newVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                 }}
                 disabled={isLocked}
                >
                 <Minus className="w-5 h-5" />
                </Button>
                <Input 
                ref={quantidadeInputRef}
                type="text"
                inputMode="decimal"
                className="w-20 text-center h-11 text-2xl font-bold bg-transparent border-none focus-visible:ring-0 p-0 shadow-none text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                value={quantidadeInput}
                onChange={e => {
                  const val = e.target.value;
                  if (/^[\d.,]*$/.test(val)) {
                    setQuantidadeInput(val);
                    const numVal = parseFloat(val.replace(',', '.'));
                    if (!isNaN(numVal)) {
                      patchEditingQuantidade(numVal);
                    }
                  }
                }}
                onFocus={e => e.target.select()}
                onBlur={() => {
                  const num = parseFloat(quantidadeInput.replace(',', '.')) || 1;
                  setQuantidadeInput(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  patchEditingQuantidade(num);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    custoInputRef.current?.focus();
                    custoInputRef.current?.select();
                  }
                }}
                placeholder="0,00"
                disabled={isLocked}
                />
                <Button 
                 variant="default" size="icon" className="h-11 w-11 rounded-full"
                 onClick={() => {
                   const newVal = (parseFloat(editingItem.quantidade) || 0) + 1;
                   patchEditingQuantidade(newVal);
                   setQuantidadeInput(newVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                 }}
                 disabled={isLocked}
                >
                 <Plus className="w-5 h-5" />
                </Button>
             </div>
             {editProduct && (
               <CatalogProductStockLine
                 product={editProduct}
                 purchaseUnit={editingItem.unidade_medida}
                 className="mt-4 justify-center"
                 size="md"
               />
             )}
          </div>

          {/* Pricing Field */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2.5 block">
              Preço de Compra (R$ / {editingItem.unidade_medida || 'UN'})
            </Label>
            <Input 
              ref={custoInputRef}
              type="text"
              inputMode="decimal"
              className="h-13 text-xl font-bold bg-muted/50 border-0 shadow-sm text-center text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
              value={custoInput}
              onChange={e => {
                const val = e.target.value;
                if (/^[\d.,]*$/.test(val)) {
                  setCustoInput(val);
                  setEditingItem(prev => {
                    const next = syncCustoFromInput(prev, val);
                    const descApres = Math.abs(getDescontoApresentacaoItem(next));
                    setDescontoValorInput(descApres > 0 ? fmtBR(descApres) : '');
                    return next;
                  });
                }
              }}
              onFocus={e => e.target.select()}
              onBlur={() => {
                const num = parsePtBr(custoInput);
                setCustoInput(fmtBR(num));
                setEditingItem(prev => {
                  const next = syncCustoFromInput(prev, num);
                  const descApres = Math.abs(getDescontoApresentacaoItem(next));
                  setDescontoValorInput(descApres > 0 ? fmtBR(descApres) : '');
                  return next;
                });
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); descontoPctInputRef.current?.focus(); descontoPctInputRef.current?.select(); } }}
              placeholder="0,00"
              disabled={isLocked}
            />
          </div>

          {/* Desconto/Acréscimo - campos interdependentes */}
          {(() => {
            const isAcrescimo = isItemAcrescimoCompra(editingItem);
            const labelPct = isAcrescimo ? 'Acréscimo %' : 'Desconto %';
            const labelVal = isAcrescimo ? 'Acréscimo R$' : 'Desconto R$';
            const flipDescontoAcrescimo = () => {
              setEditingItem(prev => {
                const v = parseFloat(prev.valor_desconto_item) || 0;
                const flipped = v === 0 ? (isAcrescimo ? 0.01 : -0.01) : -v;
                const next = { ...prev, valor_desconto_item: roundToTwoDecimals(flipped) };
                const custoApres = parsePtBr(custoInput) || getCustoApresentacaoItem(next);
                const pct = getDescontoPctApresentacaoItem(next);
                const synced = pct > 0
                  ? applyItemDescontoPctApresentacao(next, custoApres, pct, isItemAcrescimoCompra(next))
                  : next;
                const descApres = Math.abs(getDescontoApresentacaoItem(synced));
                setDescontoPctInput(pct > 0 ? String(Math.round(pct * 100) / 100) : '');
                setDescontoValorInput(descApres > 0 ? fmtBR(descApres) : '');
                return synced;
              });
            };
            return (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={flipDescontoAcrescimo}
                    disabled={isLocked}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      isAcrescimo
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isAcrescimo
                      ? <><TrendingUp className="w-3 h-3" /> Acréscimo</>
                      : <><TrendingDown className="w-3 h-3" /> Desconto</>}
                  </button>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">{labelPct}</Label>
                  <Input
                    ref={descontoPctInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={descontoPctInput}
                    onChange={e => {  const v = e.target.value;
                      if (/^[\d.,]*$/.test(v)) {
                        setDescontoPctInput(v);
                        const custoApres = parsePtBr(custoInput);
                        setEditingItem(prev => {
                          const next = syncDescontoFromPct(prev, custoApres, v);
                          const descApres = Math.abs(getDescontoApresentacaoItem(next));
                          setDescontoValorInput(descApres > 0 ? fmtBR(descApres) : '');
                          return next;
                        });
                      }
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={() => {
                      const pct = parsePtBr(descontoPctInput);
                      setDescontoPctInput(pct > 0 ? String(Math.round(pct * 100) / 100) : '');
                      const custoApres = parsePtBr(custoInput);
                      setEditingItem(prev => syncDescontoFromPct(prev, custoApres, pct));
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); descontoValorInputRef.current?.focus(); descontoValorInputRef.current?.select(); } }}
                    className="h-11 text-center bg-muted/50 border-0 shadow-sm text-sm rounded-xl"
                    disabled={isLocked}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">{labelVal}</Label>
                  <Input
                    ref={descontoValorInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={descontoValorInput}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^[\d.,]*$/.test(v)) {
                        setDescontoValorInput(v);
                        const custoApres = parsePtBr(custoInput);
                        setEditingItem(prev => {
                          const next = syncDescontoFromValor(prev, custoApres, v);
                          const novoPct = getDescontoPctApresentacaoItem(next);
                          setDescontoPctInput(novoPct > 0 ? String(Math.round(novoPct * 100) / 100) : '');
                          return next;
                        });
                      }
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={() => {
                      const desc = parsePtBr(descontoValorInput);
                      setDescontoValorInput(desc > 0 ? fmtBR(desc) : '');
                      const custoApres = parsePtBr(custoInput);
                      setEditingItem(prev => syncDescontoFromValor(prev, custoApres, desc));
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); } }}
                    className="h-11 text-center bg-muted/50 border-0 shadow-sm text-sm rounded-xl"
                    disabled={isLocked}
                  />
                </div>
              </div>
              </div>
            );
          })()}

          {/* Custo líquido (desconto/acréscimo) — avaria % é interna, fora do pedido ao fornecedor */}
          {(() => {
            const liquido = getCustoFinalApresentacaoItem(editingItem);
            const isAcrescimo = isItemAcrescimoCompra(editingItem);
            return (parseFloat(editingItem?.valor_desconto_item) || 0) !== 0 ? (
              <div className="flex justify-between items-center text-sm px-1">
                <span className="text-muted-foreground">Custo {isAcrescimo ? 'com acréscimo' : 'líquido'}</span>
                <span className={`font-semibold ${isAcrescimo ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatCurrency(liquido)}</span>
              </div>
            ) : null;
          })()}

          <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
             <span className="font-medium text-muted-foreground text-sm">Total do Item</span>
             <span className={cn('text-xl font-bold', P38_ACCENT)}>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="p-4 border-t border-border/15 dark:border-white/10">
          {editingIndex >= 0 ? (
            <div className="space-y-2">
              <Button 
                className="w-full h-14 rounded-2xl text-base p38-btn-primary" 
                onClick={handleSaveEdit}
                disabled={isLocked}
              >
                Salvar Alterações
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-14 rounded-2xl text-base"
                  onClick={() => {
                    setEditingItem(null);
                    setEditingIndex(-1);
                    setView('catalog');
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 h-14 rounded-2xl text-base"
                  onClick={() => {
                     onRemoveItem(editingIndex);
                     setEditingItem(null);
                     setEditingIndex(-1);
                     setView('catalog');
                  }}
                  disabled={isLocked}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                variant="outline"
                className="flex-1 h-14 rounded-2xl text-base"
                onClick={() => {
                  setEditingItem(null);
                  setEditingIndex(-1);
                  setView('catalog');
                }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 h-14 rounded-2xl text-base p38-btn-primary"
                onClick={handleSaveEdit}
                disabled={isLocked}
              >
                OK
              </Button>
            </div>
          )}
        </div>
      </div>
      <ProductUnitSelectorDialog
        open={editUnitSelector.open}
        product={editProduct}
        mode="purchase"
        onClose={() => setEditUnitSelector({ open: false })}
        onConfirm={handleConfirmUnitInEdit}
      />
      </>
    );
  }

  const totalItems = items.length;
  const totalValue = roundToTwoDecimals(items.reduce((acc, item) => acc + (item.total || 0), 0));

  // View: Catalog (Busca de Produtos)
  if (view === 'catalog') {
    return (
      <>
        <div className={SELECTOR_PANEL_CLASS}>
          <div className="flex items-center p-4 border-b border-border/15 dark:border-white/10 flex-shrink-0 gap-2">
            <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="h-10 w-10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="ml-2 font-medium flex-1 text-foreground">Buscar Produtos</div>
            <CatalogLoteModeToggle
              active={modoLote}
              disabled={isLocked}
              onClick={() => {
                setModoLote((v) => !v);
                setLoteDraft({});
              }}
            />
            {items.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setView('cart')}
                className="h-10 w-10 relative"
              >
                <ShoppingCart className="w-5 h-5 text-foreground/90" />
                <div className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a4ce33] px-1 text-[10px] font-bold text-[#1f1d22]">
                  {items.length}
                </div>
              </Button>
            )}
          </div>

          <div ref={catalogScrollRef} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {modoLote ? (
              <CatalogLotePicker
                products={products}
                search={search}
                onSearchChange={setSearch}
                draft={loteDraft}
                onDraftChange={setLoteDraft}
                onConfirm={handleConfirmLote}
                onExit={() => {
                  setModoLote(false);
                  setLoteDraft({});
                }}
                formatCurrency={formatCurrency}
                cartProductIds={cartProductIds}
                isLocked={isLocked}
                confirmLabel="Adicionar selecionados"
              />
            ) : (
            <>
            <div ref={catalogStickyRef} className={cn('sticky top-0 z-10 p-4 pb-3 border-b border-border/15 dark:border-white/10', P38_SEARCH_SURFACE, 'rounded-none bg-[hsl(var(--p38-search))] dark:bg-background/95')}>
              {/* Badge de desconto global ativo */}
              {descontoGlobalPct !== 0 && (
                <button
                  onClick={() => setView('discount-entry')}
                  className={`w-full mb-3 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium ${
                    descontoGlobalPct > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}
                >
                  {descontoGlobalPct > 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {descontoGlobalPct > 0 ? 'Desconto' : 'Acréscimo'} global de {Math.abs(descontoGlobalPct)}% ativo — toque para alterar
                </button>
              )}
              <div className={cn('relative rounded-xl', CATALOG_SEARCH_FIELD)}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  className="pl-11 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 rounded-xl text-foreground placeholder:text-foreground/45 dark:placeholder:text-muted-foreground"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedIndex(-1); }}
                  onKeyDown={e => {
                    if (!filteredProducts.length) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : 0); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredProducts.length - 1); }
                    else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); handleSelectProduct(filteredProducts[selectedIndex]); setSelectedIndex(-1); }
                    else if (e.key === 'Tab' && filteredProducts.length > 0) { e.preventDefault(); setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : 0); }
                  }}
                  autoFocus
                  disabled={isLocked}
                />
              </div>
              {search.trim() && filteredProducts.length > 0 && (
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground desktop-layout:hidden">
                  {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
                </p>
              )}

              {/* Desktop: lista suspensa (não cards) */}
              {search.trim() !== '' && (
                <div ref={catalogDropdownScrollRef} className={cn('hidden desktop-layout:block -mx-4 mt-3 max-h-[min(24rem,50vh)] overflow-y-auto', P38_DROPDOWN_PANEL)}>
                  {filteredProducts.length > 0 ? (
                    <>
                      <div ref={catalogDropdownStickyRef} className="sticky top-0 z-[1] flex items-center justify-between bg-card px-4 py-2.5 dark:bg-background">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">
                          {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] text-muted-foreground">↑↓ navegar · Enter selecionar</span>
                      </div>
                      {filteredProducts.map((product, idx) => {
                        const inCart = items.find(i => i.produto_id === product.id);
                        const isSelected = idx === selectedIndex;
                        const purchaseOpts = buildPurchaseUnitOptions(product);
                        const variasUnidades = purchaseOpts.length > 1;
                        const custoApresentacao = pickDefaultPurchaseUnit(product)?.valor_unitario ?? product.valor_compra;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            ref={(el) => { catalogItemRefs.current[idx] = el; }}
                            onClick={() => { if (!isLocked) handleSelectProduct(product); }}
                            className={cn(
                              'flex w-full items-start gap-3 border-l px-4 py-3 text-left transition-colors',
                              isSelected
                                ? CATALOG_LIST_ITEM_SELECTED
                                : 'border-l-transparent hover:bg-muted/40 dark:hover:bg-muted/30',
                              inCart && !isSelected && 'bg-[#a4ce33]/8',
                              isLocked && 'pointer-events-none opacity-50',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">{product.nome}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/75">
                                <span className="font-mono text-foreground/60">#{product.codigo_interno || '—'}</span>
                                <span className="text-foreground/40">·</span>
                                <span className="font-medium tabular-nums">{formatCurrency(custoApresentacao)}</span>
                                <CatalogProductStockLine product={product} className="inline-flex" />
                                {variasUnidades && (
                                  <button
                                    type="button"
                                    className={cn('font-medium hover:underline', P38_ACCENT)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUnitSelector({ open: true, product });
                                    }}
                                  >
                                    Outra unidade
                                  </button>
                                )}
                              </div>
                            </div>
                            {inCart && (() => {
                              const exibCart = getItemCompraExibicaoVitrine(inCart, product);
                              return (
                                <Badge className="shrink-0 border-0 bg-[#a4ce33]/20 text-[#3d4535] dark:text-[#a4ce33]">
                                  {exibCart.quantidade_formatada} {exibCart.unidade_medida}
                                </Badge>
                              );
                            })()}
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <div className="px-4 py-4 text-sm text-foreground/70">
                      Nenhum produto encontrado para &quot;{search}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {search.trim() === '' && (
              <div className="hidden desktop-layout:flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="mb-4 h-14 w-14 opacity-25" />
                <p className="font-medium text-foreground/80">Digite para buscar</p>
                <p className="mt-1 text-sm">Ex: areia, tinta, tubo...</p>
              </div>
            )}

            <div className="space-y-3 p-4 desktop-layout:hidden">
              {search.trim() === '' ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Digite para buscar</p>
                  <p className="text-sm mt-1">Ex: areia, tinta, tubo...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product, idx) => {
                  const inCart = items.find(i => i.produto_id === product.id);
                  const isSelected = idx === selectedIndex;
                  const purchaseOpts = buildPurchaseUnitOptions(product);
                  const variasUnidades = purchaseOpts.length > 1;
                  const custoApresentacao = pickDefaultPurchaseUnit(product)?.valor_unitario ?? product.valor_compra;
                  return (
                    <div
                      key={product.id}
                      ref={(el) => { catalogItemRefs.current[idx] = el; }}
                      onClick={() => { if (!isLocked) handleSelectProduct(product); }}
                      className={cn(
                        'rounded-2xl p-5 cursor-pointer transition-all active:scale-[0.99]',
                        P38_FIELD_SURFACE,
                        isSelected && CATALOG_CARD_SELECTED,
                        inCart && !isSelected && 'ring-2 ring-[#a4ce33]/40 dark:ring-[#a4ce33]/30',
                        isLocked && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-medium leading-snug text-foreground truncate">
                            {product.nome}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            <span className="truncate block">
                              <span className="font-mono text-xs">
                                #{product.codigo_interno || '—'}
                              </span>
                              <span className="mx-2">·</span>
                              <span>{formatCurrency(custoApresentacao)}</span>
                            </span>
                            <CatalogProductStockLine product={product} className="mt-2" />
                            {variasUnidades && (
                              <span className="mt-2 flex items-center gap-2 flex-wrap">
                                <Boxes className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                                <button
                                  type="button"
                                  className={cn('text-xs font-medium hover:underline', P38_ACCENT)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUnitSelector({ open: true, product });
                                  }}
                                >
                                  Outra unidade
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                        {inCart && (() => {
                          const exibCart = getItemCompraExibicaoVitrine(inCart, product);
                          return (
                          <Badge className="bg-[#a4ce33]/20 text-[#4a5240] dark:text-[#a4ce33] border-0 shrink-0">
                            {exibCart.quantidade_formatada} {exibCart.unidade_medida}
                          </Badge>
                          );
                        })()}
                      </div>
                      {inCart && (
                        <div className="mt-3 pt-3 border-t border-border/15 dark:border-white/10 flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Total do item</span>
                          <span className={cn('text-sm font-bold', P38_ACCENT)}>{formatCurrency(inCart.total || 0)}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Nenhum produto encontrado</p>
                  <p className="text-sm mt-1">para "{search}"</p>
                </div>
              )}
            </div>
            </>
            )}
          </div>
          {/* FAB - Criar Produto */}
          {!isLocked && !modoLote && (
            <button
              onClick={() => {
                document.activeElement?.blur();
                setShowNovoProduto(true);
              }}
              className={SELECTOR_FAB_CLASS}
              title="Criar novo produto"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
        <NovoProdutoRapidoDialog
          isOpen={showNovoProduto}
          onClose={() => setShowNovoProduto(false)}
          nomeInicial={search}
          onSuccess={(novoProduto) => {
            if (onProductCreated) onProductCreated(novoProduto);
            handleSelectProduct(novoProduto);
            setSearch('');
            setShowNovoProduto(false);
          }}
        />
        <ProductUnitSelectorDialog
          open={unitSelector.open}
          product={unitSelector.product}
          mode="purchase"
          onClose={() => setUnitSelector({ open: false, product: null })}
          onConfirm={(unitOption) => {
            startEditingProductWithUnit(unitSelector.product, unitOption);
            setUnitSelector({ open: false, product: null });
          }}
        />
      </>
    );
  }

  // View: Cart (Resumo com edição de itens)
  const sortedItems = [...items].sort((a, b) => 
    (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR')
  );

  return (
    <div className={SELECTOR_PANEL_CLASS}>
      <div className="flex items-center p-4 border-b border-border/15 dark:border-white/10 flex-shrink-0 gap-2">
        <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="h-10 w-10">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="ml-2 font-medium flex-1 text-foreground">Carrinho</div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {totalItems} {totalItems === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium mb-1 text-foreground/80">Nenhum item adicionado</p>
            <p className="text-sm mb-6">Adicione produtos ao pedido</p>
            <Button 
              onClick={() => setView('catalog')}
              className="h-14 rounded-2xl px-6 p38-btn-primary"
              disabled={isLocked}
            >
              <Plus className="w-4 h-4 mr-2" />
              Buscar Produtos
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item, index) => {
              const originalIndex = items.findIndex(i => (i.item_key || getItemUnitKey(i.produto_id, i.unidade_medida || 'UN')) === (item.item_key || getItemUnitKey(item.produto_id, item.unidade_medida || 'UN')));
              const produtoItem = products.find((p) => p.id === item.produto_id);
              const exibVitrine = getItemCompraExibicaoVitrine(item, produtoItem);
              return (
              <div 
                key={originalIndex} 
                onClick={() => {
                  if (!isLocked) handleEditItem(originalIndex);
                }}
                className={cn(
                  'rounded-2xl p-5 cursor-pointer transition-all active:scale-[0.99]',
                  P38_FIELD_SURFACE,
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-foreground mb-2 line-clamp-2 leading-snug">
                      {item.produto_nome || "Produto"}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {exibVitrine.quantidade_formatada} {exibVitrine.unidade_medida} × {formatCurrency(exibVitrine.preco_unitario)}
                    </div>
                    {produtoItem && (
                      <CatalogProductStockLine product={produtoItem} className="mb-2" />
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-border/15 dark:border-white/10">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className={cn('font-bold text-base', P38_ACCENT)}>
                        {formatCurrency(item.total || 0)}
                      </span>
                    </div>
                  </div>
                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(originalIndex);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border/15 dark:border-white/10 bg-card/95 p-4 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total do pedido</span>
          <div className="text-right">
            <div className={cn('text-2xl font-bold tabular-nums', P38_ACCENT)}>{formatCurrency(totalValue)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}