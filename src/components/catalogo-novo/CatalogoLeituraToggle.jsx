import React from 'react';
import { cn } from '@/components/utils';
import { CATALOGO_VISTA_TAB, CATALOGO_VISTA_TAB_GROUP } from '@/lib/catalogoP38Theme';

const LEITURAS = [
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'compra', label: 'Compra' },
  { id: 'cadastro', label: 'Cadastrar' },
];

/** Catálogo (Produtos-like) vs Compra (pathway) vs Cadastrar (PC + eixos). */
export default function CatalogoLeituraToggle({ leitura, onChange, showCadastro = false, comfortable = false }) {
  const tabs = showCadastro ? LEITURAS : LEITURAS.filter((l) => l.id !== 'cadastro');

  return (
    <div
      className={CATALOGO_VISTA_TAB_GROUP}
      role="tablist"
      aria-label="Visão catálogo, compra ou cadastro"
    >
      {tabs.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={leitura === l.id}
          aria-label={l.label}
          data-active={leitura === l.id}
          onClick={() => onChange(l.id)}
          className={cn(CATALOGO_VISTA_TAB, comfortable && 'min-h-[44px] py-3 text-xs')}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export { LEITURAS as CATALOGO_LEITURAS };
