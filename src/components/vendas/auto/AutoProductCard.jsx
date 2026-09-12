import { Package } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import {
  AUTO_VITRINE_CARD,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_CITRUS_BORDER,
  AUTO_PRODUCT_NAME,
  AUTO_PRICE,
  AUTO_LABEL,
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
      className={`${AUTO_VITRINE_CARD} p-3 text-left h-full flex flex-col`}
    >
      <div className={`aspect-square ${AUTO_ACCENT_BG} rounded-xl mb-3 flex items-center justify-center overflow-hidden bg-[#fafafa]`}>
        {product.imagem_url ? (
          <img
            src={product.imagem_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
          />
        ) : (
          <Package className={`w-10 h-10 ${AUTO_ACCENT_TEXT} opacity-40`} />
        )}
      </div>
      <h3 className={`${AUTO_PRODUCT_NAME} flex-1`}>{product.nome}</h3>
      <div className={`mt-3 pt-3 border-t ${AUTO_CITRUS_BORDER}`}>
        <span className={AUTO_PRICE}>R$ {formatAutoMoney(displayUnit.valor_unitario)}</span>
        <span className={`${AUTO_LABEL} ml-1.5 normal-case tracking-normal`}>
          / {displayUnit.unidade || 'UN'}
        </span>
      </div>
    </button>
  );
}
