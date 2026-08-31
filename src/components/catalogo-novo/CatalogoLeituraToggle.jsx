import React from 'react';
import { CATALOGO_VISTA_TAB, CATALOGO_VISTA_TAB_GROUP } from '@/lib/catalogoP38Theme';

const LEITURAS = [
  {
    id: 'catalogo',
    label: 'Catálogo',
    hint: 'Igual Produtos — TreeGrid, colunas e mobile; árvore pathway (Edificações → …)',
  },
  {
    id: 'compra',
    label: 'Compra',
    hint: 'Pathway da obra — ecrã separado por comportamento (Solo / Mix / Portfolio)',
  },
  {
    id: 'cadastro',
    label: 'Cadastrar',
    hint: 'Descrição nova — LINHA, produto compra, eixo A e eixo B (não h1–h5)',
  },
];

/** Catálogo (Produtos-like) vs Compra (pathway) vs Cadastrar (PC + eixos). */
export default function CatalogoLeituraToggle({ leitura, onChange, showCadastro = false }) {
  const tabs = showCadastro ? LEITURAS : LEITURAS.filter((l) => l.id !== 'cadastro');
  const active = tabs.find((l) => l.id === leitura) || tabs[0];

  return (
    <div className="space-y-1">
      <div className={CATALOGO_VISTA_TAB_GROUP} role="tablist" aria-label="Visão catálogo ou compra">
        {tabs.map((l) => (
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
