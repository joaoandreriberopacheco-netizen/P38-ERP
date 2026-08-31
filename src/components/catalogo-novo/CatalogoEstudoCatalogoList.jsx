import React from 'react';
import { cn } from '@/components/utils';
import {
  CATALOGO_LIST_SHELL,
  CATALOGO_TIPO_CHIP,
  CATALOGO_VALUE_TABLE,
  CATALOGO_VALUE_TABLE_CELL,
  CATALOGO_VALUE_TABLE_CELL_MUTED,
  CATALOGO_VALUE_TABLE_HEAD,
  CATALOGO_VALUE_TABLE_NUM,
  CATALOGO_VALUE_TABLE_ROW,
} from '@/lib/catalogoP38Theme';
import { flattenEstudoCatalogSkus } from '@/lib/estudoCatalog/flattenEstudoCatalogSkus';
import { montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

function TipoChip({ tipo }) {
  if (!tipo) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span
      className={cn(
        'inline-flex rounded border px-1 py-0 text-[9px] font-light uppercase tracking-wide',
        CATALOGO_TIPO_CHIP[tipo] || CATALOGO_TIPO_CHIP.mix,
      )}
    >
      {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

/**
 * Visão catálogo — linha plana, SKU a SKU, ordem alfabética.
 * Todos os comportamentos na mesma lista (filtros de busca / LINHA no shell).
 */
export function CatalogoEstudoCatalogoList({ tree }) {
  const rows = flattenEstudoCatalogSkus(tree, { sort: 'alpha' });

  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum SKU com estes filtros.
      </div>
    );
  }

  return (
    <div className={CATALOGO_LIST_SHELL}>
      <div className={CATALOGO_VALUE_TABLE}>
        <div
          className={cn(
            CATALOGO_VALUE_TABLE_HEAD,
            'grid-cols-[minmax(0,1.35fr)_3.5rem_minmax(0,0.75fr)_minmax(0,0.65fr)_4.5rem]',
          )}
        >
          <span>SKU</span>
          <span>Tipo</span>
          <span>LINHA</span>
          <span>Código</span>
          <span className="text-right">Estoque</span>
        </div>
        {rows.map((row) => {
          const nome = montarNomePortalSku(row.sku);
          return (
            <div
              key={row.id}
              className={cn(
                CATALOGO_VALUE_TABLE_ROW,
                'grid-cols-[minmax(0,1.35fr)_3.5rem_minmax(0,0.75fr)_minmax(0,0.65fr)_4.5rem]',
              )}
            >
              <span className={CATALOGO_VALUE_TABLE_CELL}>{nome}</span>
              <TipoChip tipo={row.context.linha_tipo} />
              <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{row.context.linha_nome}</span>
              <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{row.sku.codigo_interno || '—'}</span>
              <span className={CATALOGO_VALUE_TABLE_NUM}>{row.sku.estoque_label || '—'}</span>
            </div>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[10px] text-muted-foreground/80 tabular-nums border-t border-border/35">
        {rows.length} SKU(s) · ordem A–Z
      </p>
    </div>
  );
}
