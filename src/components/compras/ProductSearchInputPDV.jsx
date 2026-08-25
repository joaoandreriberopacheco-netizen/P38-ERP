import { useState, useRef, useMemo } from 'react';
import { Search, Plus, Wand2, X, Pencil, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import NovoProdutoRapidoDialog from '@/components/compras/NovoProdutoRapidoDialog';
import CatalogLoteDialog from '@/components/compras/CatalogLoteDialog';
import { filterAndSortProducts, getProdutoLabel } from '@/components/compras/productMatchingUtils';

export default function ProductSearchInputPDV({
  item,
  index,
  produtos,
  getSuggestedProduct,
  setItems,
  setProductSearch,
  productSearch,
  onProductCreated,
  enableLotePicker = false,
  onLoteRows,
  size = 'default',
}) {
  const comfortable = size === 'comfortable';
  const [isFocused, setIsFocused] = useState(false);
  const [showNovoProduto, setShowNovoProduto] = useState(false);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const currentQuery = productSearch[index] || '';
  const suggestedProduct = getSuggestedProduct(item);
  // Se já tem produto selecionado (inclusive sugestão da IA), considera como selecionado
  const selectedProduct = item.selected_product_id && item.selected_product_id !== 'create_new'
    ? produtos.find(p => p.id === item.selected_product_id)
    : null;
  const isConfirmed = !!selectedProduct;

  const handleChange = (e) => {
    const value = e.target.value;
    setProductSearch(prev => ({ ...prev, [index]: value }));
    setItems(prev => prev.map((c, i) => i === index ? { ...c, selected_product_id: '' } : c));
  };

  const handleSelect = (id, nome) => {
    setItems(prev => prev.map((c, i) => i === index ? { ...c, selected_product_id: id, ignored: false } : c));
    setProductSearch(prev => ({ ...prev, [index]: nome }));
    setIsFocused(false);
  };

  const handleClear = (e) => {
    e.preventDefault();
    setItems(prev => prev.map((c, i) => i === index ? { ...c, selected_product_id: '' } : c));
    setProductSearch(prev => ({ ...prev, [index]: '' }));
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleOpenNovoProduto = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFocused(false);
    setShowNovoProduto(true);
  };

  const handleNovoProdutoSuccess = (novoProduto) => {
    if (novoProduto) {
      const label = getProdutoLabel(novoProduto);
      onProductCreated?.(novoProduto);
      setItems(prev => prev.map((c, i) => i === index ? { ...c, selected_product_id: novoProduto.id, ignored: false } : c));
      setProductSearch(prev => ({ ...prev, [index]: label }));
    }
    setShowNovoProduto(false);
  };

  const visibleProducts = useMemo(() => {
    if (!isFocused) return [];
    return filterAndSortProducts(produtos, currentQuery, {
      includeEmpty: true,
      limit: currentQuery.trim() ? null : 12,
    });
  }, [isFocused, currentQuery, produtos]);

  return (
    <>
      <div className="relative min-w-0" ref={containerRef}>
        {isConfirmed && !isFocused ? (
          <div
            className={cn(
              'rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2',
              comfortable ? 'px-4 py-3' : 'px-3 py-2',
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-none" />
            <span
              className={cn(
                'flex-1 font-medium text-emerald-800 dark:text-emerald-300 truncate',
                comfortable ? 'text-base' : 'text-sm',
              )}
            >
              {getProdutoLabel(selectedProduct)}
            </span>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsFocused(true);
                setProductSearch(prev => ({ ...prev, [index]: '' }));
                setItems(prev => prev.map((c, i) => i === index ? { ...c, selected_product_id: '' } : c));
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              className="w-6 h-6 rounded-full bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground flex-none"
              title="Trocar produto"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={handleClear}
              className="w-5 h-5 rounded-full flex items-center justify-center text-emerald-400 hover:text-emerald-700 flex-none"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={handleOpenNovoProduto}
              className="w-6 h-6 rounded-full bg-card shadow-sm flex items-center justify-center text-muted-foreground flex-none"
              title="Criar novo produto"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className={cn('rounded-2xl bg-card transition-all dark:bg-background', comfortable && 'shadow-sm border border-border/40')}>
            <div className={cn('flex items-center gap-2 px-2 sm:px-3', comfortable ? 'h-14' : 'h-12')}>
              {!comfortable ? (
              <span className={cn(
                "text-[11px] sm:text-xs truncate max-w-[90px] sm:max-w-[110px] text-right",
                item.selected_product_id === 'create_new' ? 'text-muted-foreground' :
                selectedProduct ? 'text-emerald-700 dark:text-emerald-400' :
                suggestedProduct ? 'text-emerald-600 dark:text-emerald-400' :
                'text-red-400 dark:text-red-500'
              )}>
                {item.selected_product_id === 'create_new' ? 'Criando...' :
                 selectedProduct ? getProdutoLabel(selectedProduct) :
                 suggestedProduct ? `IA: ${getProdutoLabel(suggestedProduct)}` :
                 'Não encontrado'}
              </span>
              ) : (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                  item.selected_product_id === 'create_new'
                    ? 'bg-muted text-muted-foreground'
                    : selectedProduct
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : suggestedProduct
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
                )}
              >
                {item.selected_product_id === 'create_new'
                  ? 'Salvando'
                  : selectedProduct
                    ? 'OK'
                    : suggestedProduct
                      ? 'Sugestão'
                      : 'Pendente'}
              </span>
              )}

              <div className="relative flex-1 min-w-0">
                <Search className={cn('text-muted-foreground absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none', comfortable ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
                <input autoComplete="off"
                  ref={inputRef}
                  type="text"
                  value={currentQuery}
                  onChange={handleChange}
                  onFocus={() => setIsFocused(true)}
                  className={cn(
                    'w-full bg-transparent pr-1 text-foreground placeholder:text-foreground/45 dark:placeholder:text-muted-foreground outline-none',
                    comfortable ? 'h-12 pl-6 text-base' : 'h-10 pl-5 text-xs sm:text-sm',
                  )}
                  placeholder={comfortable ? 'Buscar no catálogo…' : 'Buscar item'}
                />
              </div>

              {!isFocused && !currentQuery && suggestedProduct && !item.selected_product_id && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSelect(suggestedProduct.id, getProdutoLabel(suggestedProduct))}
                  className={cn(
                    'rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-none',
                    comfortable ? 'w-9 h-9' : 'w-6 h-6',
                  )}
                  title="Aceitar sugestão IA"
                >
                  <Wand2 className={cn('text-emerald-600 dark:text-emerald-400', comfortable ? 'w-4 h-4' : 'w-3 h-3')} />
                </button>
              )}

              {(item.selected_product_id || currentQuery) && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={handleClear}
                  className={cn(
                    'rounded-full bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground/90 flex-none',
                    comfortable ? 'w-9 h-9' : 'w-6 h-6',
                  )}
                >
                  <X className={cn(comfortable ? 'w-4 h-4' : 'w-3 h-3')} />
                </button>
              )}

              <button
                type="button"
                tabIndex={-1}
                onMouseDown={handleOpenNovoProduto}
                className={cn(
                  'rounded-full bg-card shadow-sm flex items-center justify-center text-foreground/90 hover:bg-muted flex-none',
                  comfortable ? 'w-10 h-10' : 'w-7 h-7',
                )}
                title="Criar novo produto"
              >
                <Plus className={cn(comfortable ? 'w-5 h-5' : 'w-3.5 h-3.5')} />
              </button>
            </div>

            {isFocused && (
                <div className={cn('max-h-72 overflow-y-auto bg-card dark:bg-background', comfortable && 'border-t border-border/40')}>
                {visibleProducts.length > 0 ? (
                  visibleProducts.map(produto => (
                    <button
                      key={produto.id}
                      type="button"
                      tabIndex={0}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(produto.id, getProdutoLabel(produto)); }}
                      className={cn(
                        'w-full text-left text-foreground hover:bg-muted/55 dark:hover:bg-muted/40',
                        comfortable ? 'px-4 py-3.5 text-base' : 'px-3 sm:px-4 py-2.5 text-xs sm:text-sm',
                      )}
                    >
                      {getProdutoLabel(produto)}
                    </button>
                  ))
                ) : currentQuery ? (
                  <div className="px-4 py-3 text-sm text-foreground/70">
                    Nenhum produto encontrado para "{currentQuery}"
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-foreground/70">
                    Nenhum produto no catálogo
                  </div>
                )}
                {enableLotePicker && onLoteRows && currentQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 border-t border-border/40 bg-muted/30 px-4 py-3 text-xs font-medium text-foreground hover:bg-muted/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsFocused(false);
                      setLoteDialogOpen(true);
                    }}
                  >
                    <Layers className="h-4 w-4" />
                    Seleção em lote desta busca
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <NovoProdutoRapidoDialog
        isOpen={showNovoProduto}
        onClose={() => setShowNovoProduto(false)}
        onSuccess={handleNovoProdutoSuccess}
        nomeInicial={currentQuery || item?.descricao || ''}
      />

      {enableLotePicker && onLoteRows && (
        <CatalogLoteDialog
          open={loteDialogOpen}
          onOpenChange={setLoteDialogOpen}
          products={produtos}
          initialSearch={currentQuery}
          onConfirm={onLoteRows}
          confirmLabel="Adicionar linhas"
        />
      )}
    </>
  );
}