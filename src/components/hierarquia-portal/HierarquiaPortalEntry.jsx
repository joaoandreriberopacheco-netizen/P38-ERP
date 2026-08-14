import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';

/**
 * Entrada ao portal de catálogo cerâmica — trabalha em tabela auxiliar, não altera cadastro real.
 */
export default function HierarquiaPortalEntry({ className, variant = 'outline', size = 'sm' }) {
  const isIcon = size === 'icon';

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        !isIcon && 'gap-1.5 border-dashed border-amber-500/50 text-amber-800 dark:text-amber-200/90',
        className,
      )}
      asChild
    >
      <Link
        to={createPageUrl('HierarquiaPortal')}
        title="Portal catálogo cerâmica — tabela auxiliar, não altera o cadastro de produção"
        aria-label="Portal catálogo cerâmica"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">Portal catálogo</span>
            <span className="sm:hidden">Portal</span>
          </>
        )}
      </Link>
    </Button>
  );
}
