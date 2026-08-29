import React from 'react';
import CatalogoLinhaMixTable from '@/components/catalogo-novo/CatalogoLinhaMixTable';
import CatalogoLinhaPortfolioTable from '@/components/catalogo-novo/CatalogoLinhaPortfolioTable';
import CatalogoLinhaSoloTable from '@/components/catalogo-novo/CatalogoLinhaSoloTable';

/** Tabela de valores por comportamento — não expande SKUs na árvore. */
export default function CatalogoLinhaValueTable({ linha, tipo }) {
  if (tipo === 'solo') return <CatalogoLinhaSoloTable linha={linha} />;
  if (tipo === 'portfolio') return <CatalogoLinhaPortfolioTable linha={linha} />;
  return <CatalogoLinhaMixTable linha={linha} />;
}
