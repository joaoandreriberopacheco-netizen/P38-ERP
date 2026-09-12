import { Package } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import {
  AUTO_VITRINE_CARD,
  AUTO_ACCENT_TEXT,
  AUTO_IMAGE_STAGE,
  AUTO_PRODUCT_NAME,
  AUTO_PRICE,
  AUTO_LABEL,
  AUTO_EYEBROW,
  formatAutoMoney,
} from './autoAtendimentoUi';

export default function AutoProductCard({ product, onClick }) {
  const displayUnit =
    pickDefaultSaleUnit(product, 1) || {
      unidade: getUnidadeExibicaoSigla(product),
      valor_unitario: product?.preco_venda_padrao || 0,
    };

  const categoria = product?.categoria_nome || product?.categoria;

  return (
    <button
      type="button"
      onClick={() => onClick(product)}
      className={`${AUTO_VITRINE_CARD} p-3 sm:p-4 text-left h-full flex flex-col group`}
    >
      <div className={`aspect-square ${AUTO_IMAGE_STAGE} rounded-xl mb-3 flex items-center justify-center overflow-hidden`}>
        {product.imagem_url ? (
          <img
            src={product.imagem_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03] drop-shadow-[0_12px_24px_rgba(36,36,36,0.08)]"
          />
        ) : (
          <Package className={`w-10 h-10 ${AUTO_ACCENT_TEXT} opacity-40`} />
        )}
      </div>
      {categoria && (
        <p className={`${AUTO_EYEBROW} mb-1 line-clamp-1`}>{categoria.split(' > ')[0]}</p>
      )}
      <h3 className={`${AUTO_PRODUCT_NAME} flex-1`}>{product.nome}</h3>
      <div className="mt-3 pt-3 border-t border-[#e8ecef]/90">
        <span className={AUTO_PRICE}>R$ {formatAutoMoney(displayUnit.valor_unitario)}</span>
        <span className={`${AUTO_LABEL} ml-1.5 normal-case tracking-normal`}>
          / {displayUnit.unidade || 'UN'}
        </span>
      </div>
    </button>
  );
}
