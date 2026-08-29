import React from 'react';
import { CatalogoEstudoCatalogoList } from '@/components/catalogo-novo/CatalogoEstudoCatalogoList';
import CatalogoEstudoTree from '@/components/catalogo-novo/CatalogoEstudoTree';

/**
 * Novo Catálogo — duas visões de negócio:
 * - catalogo: linha plana SKU A–Z (auditoria / cadastro)
 * - compra: pathway por comportamento (solo | mix | portfolio)
 */
export default function CatalogoEstudoList({
  tree,
  tipo = 'mix',
  leitura = 'catalogo',
  mobileComfortable = false,
}) {
  if (!tree?.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada encontrado com os filtros actuais.
      </div>
    );
  }

  if (leitura === 'catalogo') {
    return <CatalogoEstudoCatalogoList tree={tree} />;
  }

  return (
    <CatalogoEstudoTree tree={tree} tipo={tipo} mobileComfortable={mobileComfortable} />
  );
}
