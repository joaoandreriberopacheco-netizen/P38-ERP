import React, { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isProdutoPilotoGaleria, resolveProdutoGaleria } from '@/lib/produtoImagens';
import ProdutoGaleriaModal from '@/components/produtos/ProdutoGaleriaModal';

const SIZE_CLASS = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
};

/**
 * Miniatura de produto. No piloto PISO*, toque abre galeria fullscreen (swipe).
 */
export default function ProdutoThumb({
  produto,
  size = 'md',
  className,
  roundedClassName = 'rounded-2xl',
  fallbackClassName,
  enableGaleria,
  onClick,
  stopPropagation = true,
}) {
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [galeriaImagens, setGaleriaImagens] = useState([]);
  const [loadingGaleria, setLoadingGaleria] = useState(false);

  const nome = produto?.nome || produto?.produto_nome || '';
  const imagemUrl = produto?.imagem_url || null;
  const galeriaAtiva = enableGaleria ?? isProdutoPilotoGaleria(produto);
  const sizeClass = SIZE_CLASS[size] || size;

  const handleOpenGaleria = async (e) => {
    if (stopPropagation) e?.stopPropagation?.();
    if (!galeriaAtiva || !produto?.id) return;

    setLoadingGaleria(true);
    try {
      const imagens = await resolveProdutoGaleria(produto);
      if (imagens.length === 0) return;
      setGaleriaImagens(imagens);
      setGaleriaOpen(true);
    } finally {
      setLoadingGaleria(false);
    }
  };

  const thumbInner = imagemUrl ? (
    <img
      src={imagemUrl}
      alt=""
      className="w-full h-full object-cover pointer-events-none"
      loading="lazy"
      draggable={false}
    />
  ) : (
  <Package className="w-5 h-5 text-muted-foreground" />
  );

  const shellClass = cn(
    sizeClass,
    roundedClassName,
    'flex items-center justify-center flex-shrink-0 overflow-hidden bg-muted',
    fallbackClassName,
    galeriaAtiva && produto?.id && 'cursor-pointer active:scale-[0.98]',
    className,
  );

  return (
    <>
      {galeriaAtiva && produto?.id ? (
        <button
          type="button"
          className={shellClass}
          onClick={(e) => {
            onClick?.(e);
            if (!e?.defaultPrevented) handleOpenGaleria(e);
          }}
          aria-label={imagemUrl ? `Ver fotos de ${nome}` : `Produto ${nome}`}
        >
          {loadingGaleria ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            thumbInner
          )}
        </button>
      ) : (
        <div className={shellClass} onClick={onClick}>
          {thumbInner}
        </div>
      )}

      <ProdutoGaleriaModal
        open={galeriaOpen}
        onClose={() => setGaleriaOpen(false)}
        produtoNome={nome}
        imagens={galeriaImagens}
      />
    </>
  );
}
