import React from 'react';
import { calcularTotaisGrupo } from '@/lib/agefinPrevisaoCalculos';
import AgefinPrevisaoRow from './AgefinPrevisaoRow';

function ListaLinhas({ items, modelosMap, onOpen }) {
  return (
    <>
      {items.map((c) => (
        <AgefinPrevisaoRow
          key={c.id}
          competencia={c}
          modelo={modelosMap[c.serie_id]}
          onClick={onOpen}
          striped={false}
        />
      ))}
    </>
  );
}

function SecaoGrupo({ label, items, modelosMap, onOpen }) {
  if (!items?.length) return null;
  const totais = calcularTotaisGrupo(items, modelosMap);

  return (
    <div>
      <div className="p38-sheet-section flex items-baseline justify-between gap-2">
        <p className="p38-sheet-section-title p38-labotrat-grupo-label">
          {label} ({items.length})
        </p>
        <p className="p38-sheet-section-sub tabular-nums shrink-0">
          −R${' '}
          {(totais.total || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
      <ListaLinhas items={items} modelosMap={modelosMap} onOpen={onOpen} />
    </div>
  );
}

/**
 * Lista de previsão — pensada para viver dentro de `.p38-single-sheet`
 * (um quadro branco contínuo, sem cartões separados).
 */
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
