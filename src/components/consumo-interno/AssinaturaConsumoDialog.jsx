import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, Check, X } from 'lucide-react';

export default function AssinaturaConsumoDialog({ open, onOpenChange, onConfirm }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [nome, setNome] = useState('');
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 220 * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = '220px';
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, 220);
  }, [open]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (event) => {
    const ctx = canvasRef.current.getContext('2d');
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setDrawing(true);
  };

  const move = (event) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const end = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirm = async () => {
    const file = await new Promise((resolve) => {
      canvasRef.current.toBlob((blob) => {
        resolve(new File([blob], 'assinatura-consumo.png', { type: 'image/png' }));
      }, 'image/png');
    });
    onConfirm({ nome, file });
    onOpenChange(false);
    setNome('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center">
      <button type="button" aria-label="Fechar assinatura" className="absolute inset-0" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 flex h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] bg-card shadow-2xl dark:bg-background md:h-auto md:max-h-[90vh] md:rounded-[32px]">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm dark:bg-muted dark:text-foreground/90"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <div>
            <p className="text-lg font-semibold text-foreground">Assinatura do recolhedor</p>
            <p className="text-sm text-muted-foreground">Assine na tela para anexar a minuta.</p>
          </div>

          <div className="space-y-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do recolhedor"
              className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-muted"
            />
          </div>

          <div ref={wrapperRef} className="overflow-hidden rounded-[24px] bg-muted/40 p-2 shadow-inner dark:bg-muted">
            <canvas
              ref={canvasRef}
              className="w-full touch-none rounded-[20px] bg-card"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clearCanvas} className="flex-1 rounded-2xl border-0 shadow-sm">
              <RotateCcw className="mr-2 h-4 w-4" />Limpar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={!nome.trim()} className="flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">
              <Check className="mr-2 h-4 w-4" />Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}