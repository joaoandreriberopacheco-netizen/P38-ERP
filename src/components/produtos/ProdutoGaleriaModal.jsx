import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { notifyProdutoGaleriaClosed } from '@/lib/produtoGaleriaGuard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { PRODUTO_GALERIA_Z_CLASS } from '@/lib/quickAccessOverlay';

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
  precoLabel = '',
  imagens = [],
  initialIndex = 0,
  showThumbnails = false,
  onIndexChange,
}) {
  const [api, setApi] = useState(null);
  const [current, setCurrent] = useState(initialIndex);
  const thumbStripRef = useRef(null);

  const onSelect = useCallback((emblaApi) => {
    const idx = emblaApi.selectedScrollSnap();
    setCurrent(idx);
    onIndexChange?.(idx);
  }, [onIndexChange]);

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
    if (!showThumbnails || !open) return;
    const strip = thumbStripRef.current;
    const active = strip?.children?.[current];
    if (!strip || !active) return;
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current, showThumbnails, open]);

  const handleClose = useCallback(() => {
    notifyProdutoGaleriaClosed();
    onClose?.();
  }, [onClose]);

  const closeFromOverlay = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  }, [handleClose]);

  const stopFotoHit = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const goTo = useCallback(
    (index) => {
      api?.scrollTo(index);
      setCurrent(index);
      onIndexChange?.(index);
    },
    [api, onIndexChange],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleClose]);

  if (!open || imagens.length === 0) return null;

  const overlay = (
    <div
      data-produto-galeria-modal
      className={cn('fixed inset-0', PRODUTO_GALERIA_Z_CLASS)}
      role="dialog"
      aria-modal="true"
      aria-label={produtoNome ? `Galeria: ${produtoNome}` : 'Galeria do produto'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/95"
        onPointerDown={closeFromOverlay}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col h-full min-h-0 pointer-events-none">
        <div className="flex items-start justify-between gap-3 px-4 py-3 text-white flex-shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            {produtoNome && (
              <p className="text-sm font-medium break-words leading-snug text-white">
                {produtoNome}
              </p>
            )}
            {precoLabel && (
              <p className="text-base font-semibold text-[#a4ce33] tabular-nums mt-1 leading-tight">
                {precoLabel}
              </p>
            )}
            <p className="text-xs text-white/70 mt-1.5">
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
            onPointerDown={closeFromOverlay}
            className="pointer-events-auto h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0"
            aria-label="Fechar galeria"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={cn(
            'flex-1 min-h-0 flex items-center justify-center px-2 pointer-events-none',
            showThumbnails && imagens.length > 1 ? 'pb-2' : 'pb-6',
          )}
        >
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: imagens.length > 1, startIndex: initialIndex }}
            className="w-full max-w-3xl pointer-events-none"
          >
            <CarouselContent className="-ml-0">
              {imagens.map((img, idx) => (
                <CarouselItem key={img.id || `${img.url}-${idx}`} className="pl-0 basis-full">
                  <div className="flex items-center justify-center h-[min(62vh,640px)] w-full px-2 pointer-events-none">
                    <img
                      src={img.url}
                      alt=""
                      className="pointer-events-auto max-h-full max-w-full object-contain select-none"
                      draggable={false}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      onPointerDown={stopFotoHit}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {imagens.length > 1 && (
              <>
                <CarouselPrevious
                  onPointerDown={stopFotoHit}
                  className={cn(
                    'pointer-events-auto left-2 border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white',
                    'disabled:opacity-30',
                  )}
                />
                <CarouselNext
                  onPointerDown={stopFotoHit}
                  className={cn(
                    'pointer-events-auto right-2 border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white',
                    'disabled:opacity-30',
                  )}
                />
              </>
            )}
          </Carousel>
        </div>

        {showThumbnails && imagens.length > 1 && (
          <div className="pointer-events-auto flex-shrink-0 border-t border-white/10 bg-black/40 px-4 py-3">
            <div
              ref={thumbStripRef}
              className="mx-auto flex max-w-3xl gap-2.5 overflow-x-auto touch-pan-x snap-x snap-mandatory pb-1"
            >
              {imagens.map((img, idx) => {
                const tipo = TIPO_LABEL[img.tipo] || img.tipo;
                return (
                  <button
                    key={img.id || `${img.url}-${idx}`}
                    type="button"
                    onPointerDown={stopFotoHit}
                    onClick={() => goTo(idx)}
                    aria-label={`${tipo || 'Imagem'} ${idx + 1}`}
                    aria-current={current === idx ? 'true' : undefined}
                    className={cn(
                      'shrink-0 snap-start overflow-hidden rounded-lg border-2 transition-all',
                      current === idx
                        ? 'border-[#a4ce33] ring-2 ring-[#a4ce33]/30 opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    <div className="h-14 w-14 sm:h-16 sm:w-16">
                      <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
