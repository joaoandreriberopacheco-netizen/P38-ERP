import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';

/**
 * Entrada ao preview do catálogo novo (UI linhas finas + SMART SUPPLY).
 */
export default function CatalogoNovoEntry({ className, variant = 'outline', size = 'sm' }) {
  const isIcon = size === 'icon';

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        !isIcon && 'gap-1.5 border-[#e8b824]/45 text-[#a8942e] dark:border-[#636B2F]/50 dark:text-[#A8B56E]',
        className,
      )}
      asChild
    >
      <Link
        to={createPageUrl('CatalogoNovo')}
        title="Preview catálogo novo — linhas finas, cítrico/oliva, SMART SUPPLY"
        aria-label="Catálogo novo (preview)"
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">Catálogo novo</span>
            <span className="sm:hidden">Novo</span>
          </>
        )}
      </Link>
    </Button>
  );
}
