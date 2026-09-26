import React from 'react';
import { Link } from 'react-router-dom';
import ProdutosAccessGuard from '@/components/guard/ProdutosAccessGuard';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { ProdutosPageContent } from '@/pages/Produtos';

/**
 * Mesma tela do Catálogo (Produtos), com árvore e descrição no modelo 4×3 (Excel).
 * Implementação partilhada via ProdutosPageContent — ver Produtos.jsx.
 */
function ProdutosCatalogo4x3Inner() {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 py-1.5 border-b border-border/40 bg-muted/20 flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to={createPageUrl('Produtos')}>Voltar ao catálogo clássico (h1–h4)</Link>
        </Button>
      </div>
      <ProdutosPageContent hierarchyMode="4x3" />
    </div>
  );
}

export default function ProdutosCatalogo4x3Page() {
  return (
    <ProdutosAccessGuard>
      <ProdutosCatalogo4x3Inner />
    </ProdutosAccessGuard>
  );
}
