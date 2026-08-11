import React from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { CADASTRO_PRODUTO_V2_ENABLED } from '@/config/cadastroProdutoV2Flags';
import { cn } from '@/components/utils';

export default function CadastroProdutoV2Entry({ className, variant = 'outline', size = 'sm' }) {
  if (!CADASTRO_PRODUTO_V2_ENABLED) return null;
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-1.5', className)}
      asChild
      title="Cadastro de produto (produto compra + eixos)"
    >
      <Link to={createPageUrl('CadastroProdutoV2')}>
        <PackagePlus className="h-4 w-4" />
        {size !== 'icon' && <span className="hidden sm:inline">Cadastrar</span>}
      </Link>
    </Button>
  );
}
