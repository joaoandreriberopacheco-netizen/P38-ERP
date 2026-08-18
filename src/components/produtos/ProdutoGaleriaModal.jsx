import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

const TIPO_LABEL = {
  principal: 'Cerâmica',
  ambiente: 'Ambiente',
  piso: 'Piso',
  face: 'Face',
  outro: 'Imagem',
};

export default function ProdutoGaleriaModal({
  open,
  onClose,
  produtoNome = '',
  imagens = [],
  initialIndex = 0,
}) {
  const [api, setApi] = useState(null);
  const [current, setCurrent] = useState(initialIndex);

  const onSelect = useCallback((emblaApi) => {
    setCurrent(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return undefined;
    onSelect(api);
    api.on('select', onSelect);
    return () => api.off('select', onSelect);
  }, [api, onSelect]);

  useEffect(() => {
    if (!open || !api) return;
    api.scrollTo(initialIndex, true);
    setCurrent(initialIndex);
  }, [open, api, initialIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || imagens.length === 0) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={produtoNome ? `Galeria: ${produtoNome}` : 'Galeria do produto'}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white flex-shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{produtoNome}</p>
          <p className="text-xs text-white/70">
            {current + 1} / {imagens.length}
            {imagens[current]?.tipo && (
              <span className="ml-2 opacity-80">
                · {TIPO_LABEL[imagens[current].tipo] || imagens[current].tipo}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0"
          aria-label="Fechar galeria"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-6">
        <Carousel
          setApi={setApi}
          opts={{ align: 'center', loop: imagens.length > 1, startIndex: initialIndex }}
          className="w-full max-w-3xl"
        >
          <CarouselContent className="-ml-0">
            {imagens.map((img, idx) => (
              <CarouselItem key={img.id || `${img.url}-${idx}`} className="pl-0 basis-full">
                <div className="flex items-center justify-center h-[min(72vh,640px)] w-full px-2">
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
          {imagens.length > 1 && (
            <>
              <CarouselPrevious
                className={cn(
                  'left-2 border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white',
                  'disabled:opacity-30'
                )}
              />
              <CarouselNext
                className={cn(
                  'right-2 border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white',
                  'disabled:opacity-30'
                )}
              />
            </>
          )}
        </Carousel>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
