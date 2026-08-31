import React from 'react';
import { cn } from '@/components/utils';
import {
  CATALOGO_LIST_SHELL,
  CATALOGO_VALUE_TABLE,
  CATALOGO_VALUE_TABLE_CELL,
  CATALOGO_VALUE_TABLE_CELL_MUTED,
  CATALOGO_VALUE_TABLE_HEAD,
  CATALOGO_VALUE_TABLE_NUM,
  CATALOGO_VALUE_TABLE_ROW,
} from '@/lib/catalogoP38Theme';
import {
  estudoSkuCaminhoCurto,
  flattenEstudoCatalogSkus,
} from '@/lib/estudoCatalog/flattenEstudoCatalogSkus';
import { montarEixosPortalSku, montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';

function PlanoHead({ tipo }) {
  if (tipo === 'solo') {
    return (
      <div className={cn(CATALOGO_VALUE_TABLE_HEAD, 'grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_4.5rem]')}>
        <span>SKU</span>
        <span>LINHA</span>
        <span className="text-right">Estoque</span>
      </div>
    );
  }
  if (tipo === 'portfolio') {
    return (
      <div className={cn(CATALOGO_VALUE_TABLE_HEAD, 'grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_4.5rem]')}>
        <span>SKU</span>
        <span>Referência</span>
        <span>LINHA</span>
        <span className="text-right">Estoque</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        CATALOGO_VALUE_TABLE_HEAD,
        'grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,0.65fr)_minmax(0,0.55fr)_4.5rem]',
      )}
    >
      <span>SKU</span>
      <span>Produto compra</span>
      <span>LINHA</span>
      <span>Eixos</span>
      <span className="text-right">Estoque</span>
    </div>
  );
}

function PlanoRow({ row, tipo }) {
  const nome = montarNomePortalSku(row.sku);
  const eixos = montarEixosPortalSku(row.sku);
  const caminho = estudoSkuCaminhoCurto(row.context);
  const linha = row.context.linha_nome;
  const estoque = row.sku.estoque_label || '—';

  if (tipo === 'solo') {
    return (
      <div className={cn(CATALOGO_VALUE_TABLE_ROW, 'grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_4.5rem]')}>
        <div className="min-w-0 space-y-0.5">
          <p className={CATALOGO_VALUE_TABLE_CELL}>{nome}</p>
          <p className="text-[10px] text-muted-foreground/75 truncate font-light">{caminho}</p>
        </div>
        <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{linha}</span>
        <span className={CATALOGO_VALUE_TABLE_NUM}>{estoque}</span>
      </div>
    );
  }

  if (tipo === 'portfolio') {
    return (
      <div
        className={cn(
          CATALOGO_VALUE_TABLE_ROW,
          'grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_4.5rem]',
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <p className={CATALOGO_VALUE_TABLE_CELL}>{nome}</p>
          <p className="text-[10px] text-muted-foreground/75 truncate font-light">{caminho}</p>
        </div>
        <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{row.produto_compra_nome || '—'}</span>
        <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{linha}</span>
        <span className={CATALOGO_VALUE_TABLE_NUM}>{estoque}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        CATALOGO_VALUE_TABLE_ROW,
        'grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,0.65fr)_minmax(0,0.55fr)_4.5rem]',
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className={CATALOGO_VALUE_TABLE_CELL}>{nome}</p>
        <p className="text-[10px] text-muted-foreground/75 truncate font-light">{caminho}</p>
      </div>
      <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{row.produto_compra_nome || '—'}</span>
      <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{linha}</span>
      <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{eixos || '—'}</span>
      <span className={CATALOGO_VALUE_TABLE_NUM}>{estoque}</span>
    </div>
  );
}

/** Vista plana — grade SKU a SKU (linear). */
export function CatalogoEstudoPlanoList({ tree, tipo = 'mix' }) {
  const rows = flattenEstudoCatalogSkus(tree);

  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum SKU neste comportamento com os filtros actuais.
      </div>
    );
  }

  return (
    <div className={CATALOGO_LIST_SHELL}>
      <div className={CATALOGO_VALUE_TABLE}>
        <PlanoHead tipo={tipo} />
        {rows.map((row) => (
          <PlanoRow key={row.id} row={row} tipo={tipo} />
        ))}
      </div>
    </div>
  );
}
