import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import { AUTO_PRIMARY_BTN, formatAutoMoney } from './autoAtendimentoUi';

export default function ProductDetailDialog({ isOpen, onClose, product, onConfirm }) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen) setQuantity(1);
  }, [isOpen, product?.id]);

  if (!product) return null;

  const displayUnit =
    pickDefaultSaleUnit(product, 1) || {
      unidade: getUnidadeExibicaoSigla(product),
      valor_unitario: product.preco_venda_padrao || 0,
    };

  const unitPrice = Number(displayUnit.valor_unitario) || 0;
  const total = unitPrice * quantity;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <div className="relative h-48 bg-muted flex items-center justify-center">
          {product.imagem_url ? (
            <img src={product.imagem_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ShoppingCart className="w-16 h-16 text-muted-foreground/30" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/30 hover:bg-black/50 text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground leading-snug">{product.nome}</h2>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                R$ {formatAutoMoney(unitPrice)}
              </span>
              <span className="text-sm text-muted-foreground">{displayUnit.unidade || 'UN'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/40 p-3 bg-muted/30">
            <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-lg bg-card border border-border/40 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-lg">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 rounded-lg bg-card border border-border/40 flex items-center justify-center text-indigo-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={onClose} className="h-12 rounded-xl flex-1">
              Voltar
            </Button>
            <Button
              onClick={() => {
                onConfirm(product, quantity);
                onClose();
              }}
              className={`h-12 rounded-xl flex-1 ${AUTO_PRIMARY_BTN}`}
            >
              Adicionar · R$ {formatAutoMoney(total)}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
