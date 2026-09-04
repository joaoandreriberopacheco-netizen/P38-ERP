import React, { Suspense } from 'react';
import ProdutoFormCompleto from '@/components/produtos/ProdutoFormCompleto';

/**
 * Formulário completo do catálogo (mesmo do /Produtos) sobreposto ao portal.
 */
export default function CadastroSkuProdutoEditor({ produto, onSave, onClose }) {
  if (!produto) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background dark:bg-[#1f1d22]">
      <Suspense
        fallback={(
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            A carregar formulário…
          </div>
        )}
      >
        <ProdutoFormCompleto produto={produto} onSave={onSave} onClose={onClose} />
      </Suspense>
    </div>
  );
}
