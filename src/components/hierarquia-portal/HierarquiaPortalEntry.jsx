import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import {
  NOVO_ECOSSISTEMA_ENTRY_TITLE,
  NOVO_ECOSSISTEMA_ROUTE,
  NOVO_ECOSSISTEMA_TITLE,
} from '@/config/novoEcosistemaFlags';

/** Entrada ao Novo Ecosistema (HierarquiaPortal). */
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
        to={`${createPageUrl(NOVO_ECOSSISTEMA_ROUTE)}?tab=supply`}
        title={NOVO_ECOSSISTEMA_ENTRY_TITLE}
        aria-label={NOVO_ECOSSISTEMA_TITLE}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {!isIcon && (
          <>
            <span className="hidden sm:inline">{NOVO_ECOSSISTEMA_TITLE}</span>
            <span className="sm:hidden">Novo</span>
          </>
        )}
      </Link>
    </Button>
  );
}
