import React from 'react';
import { CATALOGO_VISTA_TAB, CATALOGO_VISTA_TAB_GROUP } from '@/lib/catalogoP38Theme';

const VISTAS = [
  {
    id: 'pathway',
    label: 'Pathway',
    hint: 'Árvore da obra — expande bloco → ramo → LINHA; valores em tabela',
  },
  {
    id: 'plano',
    label: 'Plano SKU',
    hint: 'Grade linear — um SKU por linha, ordenado',
  },
];

export default function CatalogoVistaToggle({ vista, onChange }) {
  const active = VISTAS.find((v) => v.id === vista) || VISTAS[0];

  return (
    <div className="space-y-1">
      <div className={CATALOGO_VISTA_TAB_GROUP} role="tablist" aria-label="Modo de visualização">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            data-active={vista === v.id}
            onClick={() => onChange(v.id)}
            className={CATALOGO_VISTA_TAB}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground font-light leading-snug px-0.5">{active.hint}</p>
    </div>
  );
}

export { VISTAS as CATALOGO_VISTAS };
