import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, X } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import AutoProductImageGallery from './AutoProductImageGallery';
import {
  AUTO_PRIMARY_BTN,
  AUTO_SURFACE_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_CITRUS_BORDER,
  formatAutoMoney,
} from './autoAtendimentoUi';

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
      <DialogContent hideClose className="max-w-xl max-h-[92dvh] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-2xl">
        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y">
          <div className="relative">
            <AutoProductImageGallery
              product={product}
              precoLabel={`R$ ${formatAutoMoney(unitPrice)} / ${displayUnit.unidade || 'UN'}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-3 right-14 z-20 rounded-full bg-black/35 hover:bg-black/50 text-white sm:right-16"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-5 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-foreground leading-snug">{product.nome}</h2>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-2xl font-bold tabular-nums ${AUTO_ACCENT_TEXT}`}>
                R$ {formatAutoMoney(unitPrice)}
              </span>
              <span className="text-sm text-muted-foreground">{displayUnit.unidade || 'UN'}</span>
            </div>
          </div>

          <div className={`flex items-center justify-between rounded-xl border ${AUTO_CITRUS_BORDER} p-3 ${AUTO_SURFACE_CLASS}`}>
            <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className={`w-10 h-10 rounded-lg ${AUTO_ACCENT_BG} flex items-center justify-center ${AUTO_ACCENT_TEXT}`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-lg">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className={`w-10 h-10 rounded-lg ${AUTO_ACCENT_BG} flex items-center justify-center ${AUTO_ACCENT_TEXT}`}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
