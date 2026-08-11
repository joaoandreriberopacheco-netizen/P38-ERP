import React from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { CADASTRO_PRODUTO_V2_ENABLED } from '@/config/cadastroProdutoV2Flags';
import { HIERARQUIA_PORTAL_ENABLED } from '@/config/hierarquiaPortalFlags';
import { cn } from '@/components/utils';

export default function CadastroProdutoV2Entry({ className, variant = 'outline', size = 'sm' }) {
  if (!CADASTRO_PRODUTO_V2_ENABLED) return null;

  const href = HIERARQUIA_PORTAL_ENABLED
    ? createPageUrl('HierarquiaPortal')
    : createPageUrl('CadastroProdutoV2');

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-1.5', className)}
      asChild
      title="Cadastro de produto (produto compra + eixos)"
    >
      <Link to={href}>
        <PackagePlus className="h-4 w-4" />
        {size !== 'icon' && <span className="hidden sm:inline">Cadastrar</span>}
      </Link>
    </Button>
  );
}
