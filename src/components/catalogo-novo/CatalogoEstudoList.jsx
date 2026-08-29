import React from 'react';
import { CatalogoEstudoPlanoList } from '@/components/catalogo-novo/CatalogoEstudoPlanoList';
import CatalogoEstudoTree from '@/components/catalogo-novo/CatalogoEstudoTree';

/**
 * Novo Catálogo — duas leituras do mesmo dado:
 * - pathway: árvore da obra (expande à direita; tabela por LINHA)
 * - plano: grade linear SKU a SKU
 */
export default function CatalogoEstudoList({
  tree,
  tipo = 'mix',
  vista = 'pathway',
  mobileComfortable = false,
}) {
  if (!tree?.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada encontrado neste comportamento com os filtros actuais.
      </div>
    );
  }

  if (vista === 'plano') {
    return <CatalogoEstudoPlanoList tree={tree} tipo={tipo} />;
  }

  return (
    <CatalogoEstudoTree tree={tree} tipo={tipo} mobileComfortable={mobileComfortable} />
  );
}
