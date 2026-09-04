import React from 'react';
import { ArrowRight, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PrecoVendaTabelaLinhas } from './quickBudgetUtils';
import { formatEstoqueDisponivelLabel } from '@/lib/productUnits';

export default function QuickBudgetFlowItemEditor({
  selectedProduct,
  tabelaPreco,
  stage,
  quantity,
  price,
  unitOptions = [],
  selectedUnit,
  onUnitChange,
  onQuantityChange,
  onPriceChange,
  onNext,
  onSave,
  quantityInputRef,
  priceInputRef,
}) {
  const handleQuantityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onNext();
    }
  };

  const handlePriceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave();
    }
  };

  if (!selectedProduct) {
    return (
      <div className="rounded-3xl bg-card shadow-sm px-4 py-10 text-center text-sm text-muted-foreground">
        Pesquise e selecione um produto para seguir o fluxo.
      </div>
    );
  }

  const isFreePrice = !!selectedProduct.preco_livre;
  const siglaAtiva = selectedUnit?.unidade || selectedProduct.unidade_principal || 'UN';

  return (
    <div className="rounded-3xl bg-card shadow-sm p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground break-words">{selectedProduct.nome}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Estoque: {formatEstoqueDisponivelLabel(selectedProduct)}</span>
            {selectedProduct.codigo_interno && (
              <span className="font-mono text-[10px] tracking-wide text-muted-foreground/80">
                #{selectedProduct.codigo_interno}
              </span>
            )}
            {isFreePrice && <span className="text-emerald-600 dark:text-emerald-400">Preço livre</span>}
          </div>
          <div className="mt-2">
            <PrecoVendaTabelaLinhas
              produto={selectedProduct}
              tabelaPreco={tabelaPreco}
              unitOption={selectedUnit}
              variant="quickBudget"
              finalClassName="text-lg font-bold text-foreground tabular-nums"
              labelBottom={false}
            />
          </div>
        </div>
      </div>

      {unitOptions.length > 1 && (
        <div className="rounded-2xl bg-muted/50 shadow-sm p-3">
          <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">Embalagem</p>
          <div className="flex flex-wrap gap-2">
            {unitOptions.map((opt) => {
              const active = opt.unidade === siglaAtiva;
              return (
                <button
                  key={opt.unidade}
                  type="button"
                  onClick={() => onUnitChange?.(opt)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border shadow-sm ${
                    active
                      ? 'border-primary/30 bg-primary text-primary-foreground dark:border-white dark:bg-card dark:text-foreground'
                      : 'border-border/40 bg-card text-foreground/90 hover:border-border/40 dark:border-border/40 dark:bg-background dark:text-foreground'
                  }`}
                >
                  {opt.unidade}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className={`rounded-2xl bg-muted/50 shadow-sm p-3 ${stage !== 'quantity' ? 'opacity-60' : ''}`}>
          <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">Quantidade</p>
          <p className="text-[10px] text-muted-foreground mb-2">
            Unidade: <span className="font-semibold text-foreground/90">{siglaAtiva}</span>
          </p>
          <Input
            ref={quantityInputRef}
            type="number"
            inputMode="decimal"
            min="1"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            onKeyDown={handleQuantityKeyDown}
            enterKeyHint="next"
            className="h-14 border-0 bg-card rounded-2xl shadow-sm text-lg text-center font-semibold"
          />
        </div>

        {isFreePrice && (
          <div className={`rounded-2xl bg-muted/50 shadow-sm p-3 ${stage !== 'price' ? 'opacity-60' : ''}`}>
            <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">Preço livre</p>
            <p className="text-[10px] text-muted-foreground mb-2">Piso custo: validado ao salvar</p>
            <Input
              ref={priceInputRef}
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
              onKeyDown={handlePriceKeyDown}
              enterKeyHint="go"
              className="h-14 border-0 bg-card rounded-2xl shadow-sm text-lg text-center font-semibold"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {stage === 'quantity' && (
          <Button onClick={onNext} className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground shadow-none">
            <ArrowRight className="w-4 h-4 mr-2" /> Próximo
          </Button>
        )}
        {stage === 'price' && (
          <Button onClick={onSave} className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground shadow-none">
            <ShoppingCart className="w-4 h-4 mr-2" /> Salvar carrinho
          </Button>
        )}
        {!isFreePrice && stage === 'quantity' && (
          <Button onClick={onSave} variant="outline" className="h-12 rounded-2xl border-0 bg-muted shadow-none text-foreground/90">
            <ShoppingCart className="w-4 h-4 mr-2" /> Salvar
          </Button>
        )}
      </div>
    </div>
  );
}
