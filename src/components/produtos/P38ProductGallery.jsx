import { useCallback, useEffect, useRef, useState } from 'react';
import { Expand, Loader2, Package } from 'lucide-react';
import { resolveProdutoGaleria } from '@/lib/produtoImagens';
import ProdutoGaleriaModal from '@/components/produtos/ProdutoGaleriaModal';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { P38_LIGHT_CITRUS_RING } from '@/lib/p38LightTheme';

export const P38_GALLERY_TIPO_LABEL = {
  principal: 'Produto',
  ambiente: 'Ambiente',
  piso: 'Piso',
  face: 'Face',
  outro: 'Foto',
};

const THUMB_ACTIVE =
  'border-[#4a5240] ring-2 ring-[#4a5240]/20 shadow-sm scale-[1.02]';
const THUMB_IDLE =
  'border-border/50 opacity-80 hover:opacity-100 hover:border-[#e8b824]/40';

/**
 * Galeria PDP P38 — miniaturas verticais (desktop) / horizontais (mobile),
 * palco grande, lightbox e tokens branco · carvão · oliva · cítrico.
 */
export default function P38ProductGallery({
  product,
  className,
  precoLabel = '',
  layout = 'responsive',
  mainClassName,
}) {
  const [imagens, setImagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState(null);
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mobileThumbRef = useRef(null);
  const desktopThumbRef = useRef(null);

  const produtoNome = product?.nome || product?.produto_nome || '';
  const verticalThumbs = layout === 'vertical' || layout === 'responsive';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImagens([]);
    setCurrent(0);

    if (!product?.id) {
      setLoading(false);
      return undefined;
    }

    resolveProdutoGaleria(product)
      .then((imgs) => {
        if (!cancelled) setImagens(imgs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const onSelect = useCallback((emblaApi) => {
    setCurrent(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return undefined;
    onSelect(api);
    api.on('select', onSelect);
    return () => api.off('select', onSelect);
  }, [api, onSelect]);

  const goTo = useCallback(
    (index) => {
      api?.scrollTo(index);
      setCurrent(index);
    },
    [api],
  );

  useEffect(() => {
    const strip = mobileThumbRef.current || desktopThumbRef.current;
    const active = strip?.children?.[current];
    if (!strip || !active) return;
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current]);

  const openLightbox = () => {
    if (imagens.length > 0) setLightboxOpen(true);
  };

  const currentTipo = P38_GALLERY_TIPO_LABEL[imagens[current]?.tipo] || imagens[current]?.tipo;
  const hasMultiple = imagens.length > 1;

  const mainStage = cn(
    'relative flex min-h-0 flex-1 items-center justify-center bg-[#fafafa] p-4 sm:p-6',
    mainClassName ?? 'min-h-[min(52vw,300px)] sm:min-h-[320px]',
  );

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-[#fafafa]', mainStage, className)}>
        <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imagens.length === 0) {
    return (
      <div className={cn('flex items-center justify-center bg-[#fafafa]', mainStage, className)}>
        <Package className="h-16 w-16 text-muted-foreground/25" />
      </div>
    );
  }

  const thumbButton = (img, idx, compact = false) => {
    const tipo = P38_GALLERY_TIPO_LABEL[img.tipo] || img.tipo;
    return (
      <button
        key={img.id || `${img.url}-${idx}`}
        type="button"
        onClick={() => goTo(idx)}
        aria-label={`${tipo || 'Foto'} ${idx + 1}`}
        aria-current={current === idx ? 'true' : undefined}
        className={cn(
          'shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-white transition-all',
          current === idx ? THUMB_ACTIVE : THUMB_IDLE,
        )}
      >
        <div className={cn(compact ? 'h-14 w-14' : 'h-16 w-16 sm:h-[4.25rem] sm:w-[4.25rem]')}>
          <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
        </div>
        {!compact && tipo && (
          <p className="max-w-[4.25rem] truncate px-1 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
            {tipo}
          </p>
        )}
      </button>
    );
  };

  const mainImage = hasMultiple ? (
    <Carousel setApi={setApi} opts={{ align: 'center', loop: true }} className="h-full w-full">
      <CarouselContent className="-ml-0 h-full">
        {imagens.map((img, idx) => (
          <CarouselItem key={img.id || `${img.url}-${idx}`} className="h-full pl-0 basis-full">
            <button
              type="button"
              className="flex h-full w-full items-center justify-center"
              onClick={openLightbox}
              aria-label="Ampliar foto"
            >
              <img
                src={img.url}
                alt=""
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2 h-10 w-10 border-border/50 bg-white/95 shadow-md hover:bg-white disabled:opacity-25" />
      <CarouselNext className="right-2 h-10 w-10 border-border/50 bg-white/95 shadow-md hover:bg-white disabled:opacity-25" />
    </Carousel>
  ) : (
    <button
      type="button"
      className="flex h-full w-full items-center justify-center"
      onClick={openLightbox}
      aria-label="Ampliar foto"
    >
      <img
        src={imagens[0].url}
        alt=""
        className="max-h-full max-w-full object-contain select-none"
        loading="eager"
        draggable={false}
      />
    </button>
  );

  return (
    <>
      <div
        className={cn(
          'overflow-hidden bg-white',
          verticalThumbs && hasMultiple && 'md:flex md:gap-3 md:p-3',
          className,
        )}
      >
        {verticalThumbs && hasMultiple && (
          <div
            ref={desktopThumbRef}
            className="hidden md:flex md:w-[4.75rem] md:shrink-0 md:flex-col md:gap-2 md:overflow-y-auto md:touch-pan-y md:max-h-[360px]"
          >
            {imagens.map((img, idx) => thumbButton(img, idx, true))}
          </div>
        )}

        <div className={cn('flex min-w-0 flex-1 flex-col', mainStage)}>
          <div className="relative h-full w-full min-h-[inherit]">
            {mainImage}

            {currentTipo && (
              <span className="absolute left-3 top-3 rounded-full bg-[#242424]/80 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {currentTipo}
              </span>
            )}

            <button
              type="button"
              onClick={openLightbox}
              className={cn(
                'absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full',
                'bg-white/90 text-[#242424] shadow-md transition-colors hover:bg-white',
                P38_LIGHT_CITRUS_RING,
              )}
              aria-label="Ver em tela cheia"
            >
              <Expand className="h-5 w-5" />
            </button>

            {hasMultiple && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-[#242424]/70 px-2.5 py-1.5 backdrop-blur-sm">
                {imagens.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => goTo(idx)}
                    aria-label={`Foto ${idx + 1}`}
                    className={cn(
                      'h-2 rounded-full transition-all',
                      current === idx ? 'w-5 bg-[#e8b824]' : 'w-2 bg-white/45 hover:bg-white/75',
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {hasMultiple && (
        <div className="border-t border-border/35 bg-[#f5f5f5] px-3 py-3 md:hidden">
          <div
            ref={mobileThumbRef}
            className="flex gap-2.5 overflow-x-auto touch-pan-x snap-x snap-mandatory pb-0.5"
          >
            {imagens.map((img, idx) => thumbButton(img, idx))}
          </div>
        </div>
      )}

      <ProdutoGaleriaModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        produtoNome={produtoNome}
        precoLabel={precoLabel}
        imagens={imagens}
        initialIndex={current}
        showThumbnails
        onIndexChange={goTo}
      />
    </>
  );
}
