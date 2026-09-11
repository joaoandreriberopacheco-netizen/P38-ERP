import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { resolveProdutoGaleria } from '@/lib/produtoImagens';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { AUTO_ACCENT_BG } from './autoAtendimentoUi';

export default function AutoProductImageGallery({ product, className }) {
  const [imagens, setImagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState(null);
  const [current, setCurrent] = useState(0);

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

  if (loading) {
    return (
      <div className={cn(`relative h-52 md:h-56 ${AUTO_ACCENT_BG} flex items-center justify-center`, className)}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imagens.length === 0) {
    return (
      <div className={cn(`relative h-52 md:h-56 ${AUTO_ACCENT_BG} flex items-center justify-center`, className)}>
        <ShoppingCart className="w-16 h-16 text-muted-foreground/30" />
      </div>
    );
  }

  if (imagens.length === 1) {
    return (
      <div className={cn(`relative h-52 md:h-56 ${AUTO_ACCENT_BG}`, className)}>
        <img
          src={imagens[0].url}
          alt=""
          className="w-full h-full object-contain bg-muted/20"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={cn(AUTO_ACCENT_BG, className)}>
      <div className="relative">
        <Carousel setApi={setApi} opts={{ align: 'center', loop: true }} className="w-full">
          <CarouselContent className="-ml-0">
            {imagens.map((img, idx) => (
              <CarouselItem key={img.id || `${img.url}-${idx}`} className="pl-0 basis-full">
                <div className="h-52 md:h-56 w-full flex items-center justify-center bg-muted/20">
                  <img
                    src={img.url}
                    alt=""
                    className="max-h-full max-w-full object-contain select-none"
                    draggable={false}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious
            className="left-2 border-border/40 bg-background/90 hover:bg-background disabled:opacity-30"
          />
          <CarouselNext
            className="right-2 border-border/40 bg-background/90 hover:bg-background disabled:opacity-30"
          />
        </Carousel>
        <p className="absolute bottom-2 right-3 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white tabular-nums">
          {current + 1} / {imagens.length}
        </p>
      </div>

      <div className="px-3 pt-1">
        <p className="text-xs text-center text-muted-foreground mb-2">
          Deslize a foto ou toque nas miniaturas
        </p>
      </div>
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto touch-pan-x snap-x snap-mandatory scrollbar-thin">
        {imagens.map((img, idx) => (
          <button
            key={img.id || `${img.url}-${idx}`}
            type="button"
            onClick={() => goTo(idx)}
            aria-label={`Ver imagem ${idx + 1}`}
            aria-current={current === idx ? 'true' : undefined}
            className={cn(
              'shrink-0 snap-start w-14 h-14 rounded-lg overflow-hidden border-2 transition-all',
              current === idx
                ? 'border-indigo-600 ring-2 ring-indigo-600/30 opacity-100'
                : 'border-transparent opacity-70 hover:opacity-100',
            )}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
