import React from 'react';
import { cn } from '@/components/utils';
import {
  CATALOGO_VALUE_TABLE,
  CATALOGO_VALUE_TABLE_HEAD,
  CATALOGO_VALUE_TABLE_ROW,
  CATALOGO_VALUE_TABLE_CELL,
  CATALOGO_VALUE_TABLE_CELL_MUTED,
  CATALOGO_VALUE_TABLE_NUM,
} from '@/lib/catalogoP38Theme';
import { portalEstoqueGrupo } from '@/lib/hierarquiaPortal/portalStockFormat';

/** Portfolio — referências substituíveis (produto compra = família). */
export default function CatalogoLinhaPortfolioTable({ linha }) {
  const pcs = [...(linha.pcs || [])].sort((a, b) =>
    String(a.produto_compra_nome || '').localeCompare(String(b.produto_compra_nome || ''), 'pt'),
  );

  if (!pcs.length) {
    return (
      <div className={CATALOGO_VALUE_TABLE}>
        <p className="px-3 py-4 text-sm text-muted-foreground">Sem referências nesta LINHA.</p>
      </div>
    );
  }

  return (
    <div className={CATALOGO_VALUE_TABLE}>
      <div className={CATALOGO_VALUE_TABLE_HEAD}>
        <span>Referência</span>
        <span className="text-center">SKUs</span>
        <span className="text-right">Estoque</span>
      </div>
      {pcs.map((pc) => {
        const skus = pc.skus || [];
        const stock = portalEstoqueGrupo(skus);
        return (
          <div key={pc.produto_compra_codigo} className={CATALOGO_VALUE_TABLE_ROW}>
            <span className={CATALOGO_VALUE_TABLE_CELL}>{pc.produto_compra_nome}</span>
            <span className={cn(CATALOGO_VALUE_TABLE_CELL_MUTED, 'text-center')}>{skus.length}</span>
            <span className={CATALOGO_VALUE_TABLE_NUM}>{stock.label || '—'}</span>
          </div>
        );
      })}
    </div>
  );
}
