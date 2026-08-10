import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { HIERARQUIA_PORTAL_ENABLED } from '@/config/hierarquiaPortalFlags';
import { cn } from '@/components/utils';

/**
 * Entrada ao portal de preview — não altera cadastro nem compras reais.
 */
export default function HierarquiaPortalEntry({ className, variant = 'outline', size = 'sm' }) {
  if (!HIERARQUIA_PORTAL_ENABLED) return null;

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
        title="Preview da nova hierarquia — não altera o sistema atual"
        aria-label="Portal hierarquia (preview)"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">Portal hierarquia</span>
            <span className="sm:hidden">Portal</span>
          </>
        )}
      </Link>
    </Button>
  );
}
