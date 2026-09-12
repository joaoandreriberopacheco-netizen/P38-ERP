import { Package } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import {
  AUTO_SURFACE_CLASS,
  AUTO_CARD_HOVER,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_CITRUS_BORDER,
  formatAutoMoney,
} from './autoAtendimentoUi';

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
      className={`${AUTO_SURFACE_CLASS} ${AUTO_CARD_HOVER} p-3 text-left h-full flex flex-col`}
    >
      <div className={`aspect-square ${AUTO_ACCENT_BG} rounded-lg mb-3 flex items-center justify-center overflow-hidden`}>
        {product.imagem_url ? (
          <img
            src={product.imagem_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className={`w-10 h-10 ${AUTO_ACCENT_TEXT} opacity-50`} />
        )}
      </div>
      <h3 className="font-semibold text-sm text-foreground line-clamp-3 leading-snug flex-1">
        {product.nome}
      </h3>
      <div className={`mt-2 pt-2 border-t ${AUTO_CITRUS_BORDER}`}>
        <span className={`text-lg font-bold tabular-nums ${AUTO_ACCENT_TEXT}`}>
          R$ {formatAutoMoney(displayUnit.valor_unitario)}
        </span>
        <span className="text-xs text-muted-foreground ml-1">{displayUnit.unidade || 'UN'}</span>
      </div>
    </button>
  );
}
