import React, { useCallback, useEffect, useState } from 'react';
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
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={produtoNome ? `Galeria: ${produtoNome}` : 'Galeria do produto'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Fundo escuro: qualquer toque aqui fecha (área fora da foto). */}
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

        <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-6 pointer-events-none">
          <Carousel
            setApi={setApi}
            opts={{ align: 'center', loop: imagens.length > 1, startIndex: initialIndex }}
            className="w-full max-w-3xl pointer-events-none"
          >
            <CarouselContent className="-ml-0">
              {imagens.map((img, idx) => (
                <CarouselItem key={img.id || `${img.url}-${idx}`} className="pl-0 basis-full">
                  <div className="flex items-center justify-center h-[min(72vh,640px)] w-full px-2 pointer-events-none">
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
                    'disabled:opacity-30'
                  )}
                />
                <CarouselNext
                  onPointerDown={stopFotoHit}
                  className={cn(
                    'pointer-events-auto right-2 border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white',
                    'disabled:opacity-30'
                  )}
                />
              </>
            )}
          </Carousel>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
