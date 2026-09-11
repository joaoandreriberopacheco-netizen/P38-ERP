import { useCallback, useEffect, useRef, useState } from 'react';
import { Expand, Loader2, ShoppingCart } from 'lucide-react';
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

const TIPO_LABEL = {
  principal: 'Produto',
  ambiente: 'Ambiente',
  piso: 'Piso',
  face: 'Face',
  outro: 'Foto',
};

const MAIN_HEIGHT = 'h-[min(52vw,280px)] sm:h-72 md:h-80';

export default function AutoProductImageGallery({ product, className, precoLabel = '' }) {
  const [imagens, setImagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState(null);
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbStripRef = useRef(null);

  const produtoNome = product?.nome || product?.produto_nome || '';

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
    const strip = thumbStripRef.current;
    const active = strip?.children?.[current];
    if (!strip || !active) return;
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current]);

  const openLightbox = () => {
    if (imagens.length > 0) setLightboxOpen(true);
  };

  const currentTipo = TIPO_LABEL[imagens[current]?.tipo] || imagens[current]?.tipo;

  if (loading) {
    return (
      <div className={cn('bg-muted/30 border-b border-border/40 flex items-center justify-center', MAIN_HEIGHT, className)}>
        <Loader2 className="w-9 h-9 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imagens.length === 0) {
    return (
      <div className={cn('bg-muted/30 border-b border-border/40 flex items-center justify-center', MAIN_HEIGHT, className)}>
        <ShoppingCart className="w-16 h-16 text-muted-foreground/25" />
      </div>
    );
  }

  const hasMultiple = imagens.length > 1;

  return (
    <>
      <div className={cn('bg-background border-b border-border/40', className)}>
        {/* Palco principal — estilo vitrine WooCommerce */}
        <div className={cn('relative group', MAIN_HEIGHT)}>
          {hasMultiple ? (
            <Carousel setApi={setApi} opts={{ align: 'center', loop: true, dragFree: false }} className="h-full w-full">
              <CarouselContent className="-ml-0 h-full">
                {imagens.map((img, idx) => (
                  <CarouselItem key={img.id || `${img.url}-${idx}`} className="pl-0 basis-full h-full">
                    <button
                      type="button"
                      className="h-full w-full flex items-center justify-center bg-muted/15 p-3 sm:p-4"
                      onClick={openLightbox}
                      aria-label="Ampliar foto"
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover:scale-[1.02]"
                        draggable={false}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                      />
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious
                className="left-2 h-10 w-10 border-border/50 bg-background/95 shadow-md hover:bg-background disabled:opacity-25"
              />
              <CarouselNext
                className="right-2 h-10 w-10 border-border/50 bg-background/95 shadow-md hover:bg-background disabled:opacity-25"
              />
            </Carousel>
          ) : (
            <button
              type="button"
              className="h-full w-full flex items-center justify-center bg-muted/15 p-3 sm:p-4"
              onClick={openLightbox}
              aria-label="Ampliar foto"
            >
              <img
                src={imagens[0].url}
                alt=""
                className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover:scale-[1.02]"
                loading="eager"
                draggable={false}
              />
            </button>
          )}

          {currentTipo && (
            <span className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {currentTipo}
            </span>
          )}

          <button
            type="button"
            onClick={openLightbox}
            className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            aria-label="Ver em tela cheia"
          >
            <Expand className="h-5 w-5" />
          </button>

          {hasMultiple && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-sm">
              {imagens.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Foto ${idx + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    current === idx ? 'w-5 bg-white' : 'w-2 bg-white/45 hover:bg-white/70',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Faixa de miniaturas — navegação horizontal */}
        {hasMultiple && (
          <div className="border-t border-border/30 bg-muted/20 px-3 py-3 sm:px-4">
            <div
              ref={thumbStripRef}
              className="flex gap-2.5 overflow-x-auto touch-pan-x snap-x snap-mandatory scrollbar-thin pb-0.5"
            >
              {imagens.map((img, idx) => {
                const tipo = TIPO_LABEL[img.tipo] || img.tipo;
                return (
                  <button
                    key={img.id || `${img.url}-${idx}`}
                    type="button"
                    onClick={() => goTo(idx)}
                    aria-label={`${tipo || 'Foto'} ${idx + 1}`}
                    aria-current={current === idx ? 'true' : undefined}
                    className={cn(
                      'shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-background transition-all',
                      current === idx
                        ? 'border-indigo-600 ring-2 ring-indigo-600/25 shadow-md scale-[1.02]'
                        : 'border-transparent opacity-75 hover:opacity-100 hover:border-border/60',
                    )}
                  >
                    <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]">
                      <img
                        src={img.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                    </div>
                    {tipo && (
                      <p className="truncate px-1 py-0.5 text-center text-[10px] font-medium text-muted-foreground max-w-[4.5rem]">
                        {tipo}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
