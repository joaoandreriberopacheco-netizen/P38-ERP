import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { CADASTRO_PRODUTO_V2_ENABLED } from '@/config/cadastroProdutoV2Flags';
import { HIERARQUIA_PORTAL_ENABLED } from '@/config/hierarquiaPortalFlags';
import CadastroProdutoV2Form from '@/components/cadastro-produto-v2/CadastroProdutoV2Form';

function CadastroProdutoV2Inner() {
  const supabaseOk = isSupabaseBrowserConfigured();

  if (!supabaseOk) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Supabase não configurado — cadastro v2 indisponível.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-din-1451 pb-10">
      <div className="max-w-5xl mx-auto px-4 py-4 md:py-6 space-y-5">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
            <Link to={createPageUrl('Produtos')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Catálogo
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-semibold font-glacial text-foreground flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-[#4a5240] dark:text-[#a4ce33]" />
            Cadastro de produto
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            LINHA → produto compra → grade de SKUs. Hidrata dos SKUs reais (preço, estoque).
            Grava em entidade própria — não altera o catálogo de produção directamente.
          </p>
        </div>

        <CadastroProdutoV2Form />
      </div>
    </div>
  );
}

export default function CadastroProdutoV2Page() {
  if (!CADASTRO_PRODUTO_V2_ENABLED) {
    return <Navigate to={createPageUrl('Home')} replace />;
  }
  if (HIERARQUIA_PORTAL_ENABLED) {
    return <Navigate to={createPageUrl('HierarquiaPortal')} replace />;
  }
  return <CadastroProdutoV2Inner />;
}
