import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Overlay de carregamento para módulos pesados (financeiro, etc.).
 * Evita mostrar tela “inacabada” com valores zerados.
 */
export default function P38ModuleLoadingOverlay({
  open = false,
  message = 'Carregando…',
  className,
}) {
  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/88 backdrop-blur-[2px]',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-medium text-foreground/85">{message}</p>
      <div className="h-1.5 w-56 rounded-full bg-muted animate-pulse" />
    </div>
  );
}
