import React from 'react';
import {
  CATALOGO_VALUE_TABLE,
  CATALOGO_VALUE_TABLE_HEAD,
  CATALOGO_VALUE_TABLE_ROW,
  CATALOGO_VALUE_TABLE_CELL,
  CATALOGO_VALUE_TABLE_CELL_MUTED,
  CATALOGO_VALUE_TABLE_NUM,
} from '@/lib/catalogoP38Theme';

/** Solo — SKUs directos (sem produto compra / eixos). */
export default function CatalogoLinhaSoloTable({ linha }) {
  const solos = [...(linha.solos || [])].sort((a, b) =>
    String(a.novo_sku || a.codigo_interno || '').localeCompare(String(b.novo_sku || b.codigo_interno || ''), 'pt'),
  );

  if (!solos.length) {
    return (
      <div className={CATALOGO_VALUE_TABLE}>
        <p className="px-3 py-4 text-sm text-muted-foreground">Sem SKUs solo nesta LINHA.</p>
      </div>
    );
  }

  return (
    <div className={CATALOGO_VALUE_TABLE}>
      <div className={CATALOGO_VALUE_TABLE_HEAD}>
        <span>SKU</span>
        <span>Código</span>
        <span className="text-right">Estoque</span>
      </div>
      {solos.map((row) => (
        <div key={row.codigo_interno || row.id} className={CATALOGO_VALUE_TABLE_ROW}>
          <span className={CATALOGO_VALUE_TABLE_CELL}>{row.novo_sku || row.produto?.nome || '—'}</span>
          <span className={CATALOGO_VALUE_TABLE_CELL_MUTED}>{row.codigo_interno || '—'}</span>
          <span className={CATALOGO_VALUE_TABLE_NUM}>{row.estoque_label || '—'}</span>
        </div>
      ))}
    </div>
  );
}
