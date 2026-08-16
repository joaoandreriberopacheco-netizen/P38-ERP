import { Package } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import { AUTO_CARD_CLASS, formatAutoMoney } from './autoAtendimentoUi';

export default function AutoProductCard({ product, onClick }) {
  const displayUnit =
    pickDefaultSaleUnit(product, 1) || {
      unidade: getUnidadeExibicaoSigla(product),
      valor_unitario: product?.preco_venda_padrao || 0,
    };

  return (
    <button
      type="button"
      onClick={() => onClick(product)}
      className={`${AUTO_CARD_CLASS} p-3 text-left h-full flex flex-col hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.98]`}
    >
      <div className="aspect-square bg-muted/40 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {product.imagem_url ? (
          <img
            src={product.imagem_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground/60" />
        )}
      </div>
      <h3 className="font-semibold text-sm text-foreground line-clamp-3 leading-snug flex-1">
        {product.nome}
      </h3>
      <div className="mt-2 pt-2 border-t border-border/30">
        <span className="text-lg font-bold text-foreground tabular-nums">
          R$ {formatAutoMoney(displayUnit.valor_unitario)}
        </span>
        <span className="text-xs text-muted-foreground ml-1">{displayUnit.unidade || 'UN'}</span>
      </div>
    </button>
  );
}
