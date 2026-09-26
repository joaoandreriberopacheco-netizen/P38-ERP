import React from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';

/** Atalho ao Catálogo 4×3 (mesma tela Produtos, drill Excel). */
export default function HierarquiaPortalEntry({ className, variant = 'outline', size = 'sm' }) {
  const isIcon = size === 'icon';

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        !isIcon && 'gap-1.5 border-dashed border-emerald-500/50 text-emerald-800 dark:text-emerald-200/90',
        className,
      )}
      asChild
    >
      <Link
        to={createPageUrl('ProdutosCatalogo4x3')}
        title="Catálogo 4×3 — ETAPA, LINHA, produto compra e SKU (Excel)"
        aria-label="Catálogo 4×3"
      >
        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">Catálogo 4×3</span>
            <span className="sm:hidden">4×3</span>
          </>
        )}
      </Link>
    </Button>
  );
}
