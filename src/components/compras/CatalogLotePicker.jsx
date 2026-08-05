import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import {
  P38_CHIP_ACTIVE,
  P38_CHIP_INACTIVE,
  P38_FIELD_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import {
  countLoteDraft,
  getDefaultPurchaseUnitLabel,
  parseLoteQuantidade,
} from '@/lib/catalogLoteUtils';
import { parseCountQuantity } from '@/lib/inventoryCountUnits';
import CatalogProductStockLine from '@/components/compras/CatalogProductStockLine';

/**
 * Seleção em lote a partir do universo filtrado pela busca.
 * Fluxo: lista generosa → toque no SKU → painel de quantidade (focus + teclado numérico) → Salvar/Cancelar → volta à lista.
 */
export default function CatalogLotePicker({
  products = [],
  search = '',
  onSearchChange,
  draft = {},
  onDraftChange,
  onConfirm,
  onExit,
  formatCurrency,
  cartProductIds = [],
  isLocked = false,
  showSelectAll = true,
  confirmLabel = 'Adicionar ao carrinho',
  getUnitLabel,
  searchPlaceholder = 'Ex: REJU QUART; quartzolit...',
  exitModeLabel = 'Modo rápido',
  emptySearchTitle = 'Busque para montar o lote',
  emptySearchHint = 'Combine termos com espaço — ex:',
  emptySearchExample = 'REJU QUART',
  sortResultsAlphabetically = false,
  showStockLine = true,
  stockApresentacao = false,
  allowZeroQty = false,
}) {
  const resolveUnitLabel = getUnitLabel || getDefaultPurchaseUnitLabel;
  const resolveQty = (raw) => (allowZeroQty ? parseCountQuantity(raw) : parseLoteQuantidade(raw));
  const [editingProduct, setEditingProduct] = useState(null);
  const [qtyInput, setQtyInput] = useState('1');
  const qtyRef = useRef(null);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    const list = filterAndSortProducts(products, search);
    if (!sortResultsAlphabetically) return list;
    return [...list].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base', numeric: true }),
    );
  }, [products, search, sortResultsAlphabetically]);

  const { itens: draftCount, unidades: draftUnits } = useMemo(() => {
    const entries = Object.values(draft);
    if (!allowZeroQty) return countLoteDraft(draft);
    return {
      itens: entries.length,
      unidades: entries.reduce((sum, entry) => sum + (parseCountQuantity(entry?.quantidade) ?? 0), 0),
    };
  }, [draft, allowZeroQty]);

  const openQtyPanel = (product) => {
    const existing = draft[product.id];
    setEditingProduct(product);
    setQtyInput(
      existing != null
        ? String(existing.quantidade ?? '')
        : (allowZeroQty ? '' : '1'),
    );
  };

  useEffect(() => {
    if (!editingProduct) return;
    const t = setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, [editingProduct]);

  const handleSaveQty = () => {
    if (!editingProduct) return;
    const quantidade = resolveQty(qtyInput);
    if (allowZeroQty && quantidade === null) return;
    onDraftChange({
      ...draft,
      [editingProduct.id]: { quantidade },
    });
    setEditingProduct(null);
  };

  const handleCancelQty = () => {
    setEditingProduct(null);
  };

  const handleSelectAll = () => {
    const next = { ...draft };
    filteredProducts.forEach((p) => {
      if (!next[p.id]) {
        next[p.id] = { quantidade: 1 };
      }
    });
    onDraftChange(next);
  };

  const handleClearDraft = () => {
    onDraftChange({});
  };

  if (editingProduct) {
    const unidade = resolveUnitLabel(editingProduct);
    return (
      <div className="flex h-full min-h-0 flex-col bg-card">
        <div className="shrink-0 border-b border-border/40 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Quantidade
          </p>
          <p className="mt-1 text-base font-medium leading-snug text-foreground line-clamp-3">
            {editingProduct.nome}
          </p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            #{editingProduct.codigo_interno || editingProduct.codigo_barras || '—'} · {unidade}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          <label className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Digite a quantidade
          </label>
          <Input
            ref={qtyRef}
            type="text"
              inputMode="decimal"
              enterKeyHint="done"
              min={allowZeroQty ? 0 : undefined}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveQty();
              }
            }}
            className={cn(
              'h-20 max-w-xs rounded-2xl border-0 text-center text-4xl font-semibold tabular-nums shadow-sm',
              P38_FIELD_SURFACE,
            )}
            disabled={isLocked}
            aria-label="Quantidade"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {unidade}
            {formatCurrency && editingProduct.valor_compra > 0 && (
              <span className="ml-2">· {formatCurrency(editingProduct.valor_compra)}</span>
            )}
          </p>
          {showStockLine && (
            <CatalogProductStockLine
              product={editingProduct}
              className="mt-4 justify-center"
              size="md"
              apresentacao={stockApresentacao}
            />
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground max-w-xs">
            {allowZeroQty ? (
              <>Informe <strong>0</strong> quando o produto estiver zerado. Enter também salva.</>
            ) : (
              <>Deixe em branco ou confirme para usar <strong>1</strong>. Enter também salva.</>
            )}
          </p>
        </div>

        <div className="shrink-0 grid grid-cols-2 gap-3 border-t border-border/40 p-4">
          <Button
            type="button"
            variant="outline"
            className="h-14 rounded-2xl text-base"
            onClick={handleCancelQty}
          >
            <X className="mr-2 h-5 w-5" />
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-14 rounded-2xl text-base p38-btn-primary"
            onClick={handleSaveQty}
            disabled={isLocked}
          >
            <Check className="mr-2 h-5 w-5" />
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn('shrink-0 space-y-3 p-4 pb-3', P38_FIELD_SURFACE, 'rounded-none')}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="h-12 border-0 bg-transparent pl-11 shadow-none focus-visible:ring-0"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            autoFocus
            disabled={isLocked}
          />
        </div>

        {search.trim() && filteredProducts.length > 0 && showSelectAll && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', P38_CHIP_INACTIVE)}
              disabled={isLocked}
            >
              Selecionar todos ({filteredProducts.length})
            </button>
            {draftCount > 0 && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}

        {search.trim() && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
            {draftCount > 0 && (
              <span className="text-foreground/70">
                {' '}· {draftCount} selecionado{draftCount !== 1 ? 's' : ''} ({draftUnits} un.)
              </span>
            )}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-2 space-y-3">
        {!search.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Search className="mb-4 h-14 w-14 opacity-20" />
            <p className="font-medium text-foreground/80">{emptySearchTitle}</p>
            <p className="mt-1 max-w-xs text-sm">
              {emptySearchHint} <span className="font-mono">{emptySearchExample}</span>
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-medium">Nenhum produto para &quot;{search}&quot;</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const inDraft = draft[product.id];
            const inCart = cartProductIds.includes(product.id);
            const unidade = resolveUnitLabel(product);
            return (
              <button
                key={product.id}
                type="button"
                disabled={isLocked}
                onClick={() => openQtyPanel(product)}
                className={cn(
                  'w-full rounded-2xl p-5 text-left transition-all active:scale-[0.99]',
                  P38_FIELD_SURFACE,
                  inDraft && 'ring-2 ring-[#a4ce33]/60 dark:ring-[#a4ce33]/50',
                  inCart && !inDraft && 'opacity-90',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                      inDraft
                        ? 'border-[#a4ce33] bg-[#a4ce33]/20 text-[#4a5240] dark:text-[#a4ce33]'
                        : 'border-border/50 bg-muted/30 text-transparent',
                    )}
                  >
                    {inDraft && <Check className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium leading-snug text-foreground">
                      {product.nome}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">#{product.codigo_interno || '—'}</span>
                      <span className="mx-2">·</span>
                      <span>{unidade}</span>
                      {formatCurrency && product.valor_compra > 0 && (
                        <>
                          <span className="mx-2">·</span>
                          <span>{formatCurrency(product.valor_compra)}</span>
                        </>
                      )}
                    </p>
                    {showStockLine && (
                      <CatalogProductStockLine
                        product={product}
                        className="mt-2"
                        apresentacao={stockApresentacao}
                      />
                    )}
                    {inDraft && (
                      <p className="mt-2 text-sm font-semibold text-[#4a5240] dark:text-[#a4ce33]">
                        Qtd: {resolveQty(inDraft.quantidade) ?? 0} {unidade}
                      </p>
                    )}
                    {inCart && !inDraft && (
                      <p className="mt-1 text-xs text-muted-foreground">Já no carrinho</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-card/95 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {exitModeLabel}
          </button>
          {draftCount > 0 && (
            <span className="tabular-nums text-muted-foreground">
              {draftCount} item{draftCount !== 1 ? 's' : ''} · {draftUnits} un.
            </span>
          )}
        </div>
        <Button
          type="button"
          className="h-14 w-full rounded-2xl text-base p38-btn-primary"
          disabled={draftCount === 0 || isLocked}
          onClick={onConfirm}
        >
          {draftCount > 0
            ? `${confirmLabel} (${draftCount})`
            : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export function CatalogLoteModeToggle({ active, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
      )}
    >
      Lote
    </button>
  );
}
