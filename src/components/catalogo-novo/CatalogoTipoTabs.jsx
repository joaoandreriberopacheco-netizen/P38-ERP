import React from 'react';
import { cn } from '@/components/utils';
import { CATALOGO_TIPO_TAB, CATALOGO_TIPO_TAB_GROUP } from '@/lib/catalogoP38Theme';

const TIPOS = [
  {
    id: 'solo',
    label: 'Solo',
    hint: 'Um SKU por LINHA — sem esquadra nem grelha de eixos',
  },
  {
    id: 'mix',
    label: 'Mix',
    hint: 'Produto compra + eixos (esquadra soldável, bitolas, etc.)',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    hint: 'Referências substituíveis na LINHA — saldo por família',
  },
];

/**
 * Uma aba = um comportamento. Solo, Mix e Portfolio não partilham o mesmo ecrã.
 */
export default function CatalogoTipoTabs({ tipoAtivo, onChange, counts }) {
  const active = TIPOS.find((t) => t.id === tipoAtivo) || TIPOS[1];

  return (
    <div className="space-y-1.5">
      <div className={CATALOGO_TIPO_TAB_GROUP} role="tablist" aria-label="Comportamento da LINHA">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tipoAtivo === t.id}
            data-active={tipoAtivo === t.id}
            onClick={() => onChange(t.id)}
            className={CATALOGO_TIPO_TAB}
          >
            {t.label}
            {counts?.[t.id] != null ? (
              <span className="ml-1 opacity-60 tabular-nums">({counts[t.id]})</span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground font-light leading-snug px-0.5">{active.hint}</p>
    </div>
  );
}
