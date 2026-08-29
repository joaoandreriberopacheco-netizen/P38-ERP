import React from 'react';
import { CATALOGO_VISTA_TAB, CATALOGO_VISTA_TAB_GROUP } from '@/lib/catalogoP38Theme';

const LEITURAS = [
  {
    id: 'catalogo',
    label: 'Catálogo',
    hint: 'Linha plana — SKU a SKU, ordem alfabética; filtros de busca e LINHA',
  },
  {
    id: 'compra',
    label: 'Compra',
    hint: 'Pathway da obra — ecrã separado por comportamento (Solo / Mix / Portfolio)',
  },
];

/** Catálogo (plano) vs Compra (pathway por comportamento). */
export default function CatalogoLeituraToggle({ leitura, onChange }) {
  const active = LEITURAS.find((l) => l.id === leitura) || LEITURAS[0];

  return (
    <div className="space-y-1">
      <div className={CATALOGO_VISTA_TAB_GROUP} role="tablist" aria-label="Visão catálogo ou compra">
        {LEITURAS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={leitura === l.id}
            data-active={leitura === l.id}
            onClick={() => onChange(l.id)}
            className={CATALOGO_VISTA_TAB}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground font-light leading-snug px-0.5">{active.hint}</p>
    </div>
  );
}

export { LEITURAS as CATALOGO_LEITURAS };
