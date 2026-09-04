import React from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { MODELO_CATALOGO_ENABLED } from '@/config/modeloCatalogoFlags';
import { cn } from '@/components/utils';

/** Entrada para o laboratório Catálogo Modelo (universo paralelo). */
export default function ModeloCatalogoEntry({ className, variant = 'outline', size = 'sm' }) {
  if (!MODELO_CATALOGO_ENABLED) return null;
  return (
    <Button variant={variant} size={size} className={cn('gap-1.5', className)} asChild title="Catálogo Modelo (laboratório)">
      <Link to={createPageUrl('ModeloCatalogo')}>
        <FlaskConical className="h-4 w-4 text-violet-600" />
        {size !== 'icon' && <span className="hidden sm:inline">Modelo</span>}
      </Link>
    </Button>
  );
}
