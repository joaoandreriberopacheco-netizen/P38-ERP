import React from 'react';
import { calcularTotaisGrupo, formatCurrency } from '@/lib/agefinPrevisaoCalculos';
import AgefinPrevisaoRow from './AgefinPrevisaoRow';

function ListaLinhas({ items, modelosMap, onOpen }) {
  return (
    <div>
      {items.map((c) => (
        <AgefinPrevisaoRow
          key={c.id}
          competencia={c}
          modelo={modelosMap[c.serie_id]}
          onClick={onOpen}
        />
      ))}
    </div>
  );
}

function SecaoGrupo({ label, items, modelosMap, onOpen }) {
  if (!items?.length) return null;
  const totais = calcularTotaisGrupo(items, modelosMap);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 pb-1 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {label} ({items.length})
        </p>
        <p className="shrink-0 text-xs font-normal tabular-nums text-gray-400">
          −{formatCurrency(totais.total || 0)}
        </p>
      </div>
      <ListaLinhas items={items} modelosMap={modelosMap} onOpen={onOpen} />
    </div>
  );
}

export default function AgefinPrevisaoLista({
  grupos = [],
  competencias = [],
  modelosMap,
  onOpen,
  semAgrupamento = false,
}) {
  if (semAgrupamento || !grupos.length) {
    return <ListaLinhas items={competencias} modelosMap={modelosMap} onOpen={onOpen} />;
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      {grupos.map((grupo) => (
        <SecaoGrupo
          key={grupo.key}
          label={grupo.label}
          items={grupo.items}
          modelosMap={modelosMap}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
