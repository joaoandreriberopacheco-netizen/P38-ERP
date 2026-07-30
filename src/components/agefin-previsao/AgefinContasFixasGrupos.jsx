import React from 'react';
import { cn } from '@/lib/utils';
import AgefinPrevisaoModeloRow from '@/components/agefin-previsao/AgefinPrevisaoModeloRow';
import {
  DESCRICAO_FREQUENCIA_SERIE,
  ORDEM_FREQUENCIAS_CONTAS_FIXAS,
} from '@/lib/agefinPrevisaoCalculos';

function chaveDrop(frequencia, centroKey) {
  return `${frequencia}::${centroKey}`;
}

function BlocoGrupo({
  dropKey,
  grupoLabel,
  sublabel,
  series,
  draggable,
  draggingSerieId,
  dropCentroAtual,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}) {
  return (
    <div
      onDragOver={draggable ? onDragOver : undefined}
      onDragLeave={draggable ? onDragLeave : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={cn(
        draggable && dropCentroAtual === dropKey && draggingSerieId
          ? 'rounded-xl ring-2 ring-[#1B4D2E]/35'
          : '',
      )}
    >
      <div className="pb-1 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{grupoLabel}</p>
        <p className="mt-0.5 text-xs font-normal text-gray-400">
          {sublabel || `${series.length} conta(s)`}
        </p>
      </div>
      {series.length > 0 ? (
        <div>
          {series.map((s) => (
            <div
              key={s.id}
              draggable={draggable}
              onDragStart={
                draggable
                  ? (e) => {
                      e.dataTransfer.setData('text/plain', s.id);
                      onDragStart(s.id);
                    }
                  : undefined
              }
              onDragEnd={draggable ? onDragEnd : undefined}
            >
              <AgefinPrevisaoModeloRow modelo={s} onEdit={onEdit} onDelete={onDelete} />
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-xs text-gray-400">Arraste uma conta para este centro.</p>
      )}
    </div>
  );
}

export default function AgefinContasFixasGrupos({
  agrupamento,
  groupBy = 'centro_custo',
  draggingSerieId,
  dropCentroAtual,
  onDragStart,
  onDragEnd,
  onDropCentro,
  onHoverCentro,
  onLeaveCentro,
  onEdit,
  onDelete,
}) {
  const permiteArrastar = groupBy === 'centro_custo';

  const secoesComContas = ORDEM_FREQUENCIAS_CONTAS_FIXAS.filter((freq) => {
    const grupos = agrupamento[freq] || [];
    return grupos.some((g) => (g.items || []).length > 0);
  });

  if (!secoesComContas.length) {
    return (
      <p className="py-4 text-xs text-gray-400">
        Nenhuma conta fixa cadastrada. Use o botão + para criar e escolha a recorrência no formulário.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      {secoesComContas.map((frequencia) => {
        const grupos = (agrupamento[frequencia] || []).filter((g) => (g.items || []).length > 0);
        const totalSecao = grupos.reduce((n, g) => n + (g.items?.length || 0), 0);

        return (
          <div key={frequencia}>
            <div className="pb-1 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Recorrência {frequencia} ({totalSecao})
              </p>
              <p className="mt-0.5 text-xs font-normal text-gray-400">
                {DESCRICAO_FREQUENCIA_SERIE[frequencia]}
              </p>
            </div>
            {grupos.map((grupo) => {
              const centroKey = grupo.centroKey || grupo.key?.replace(/^cc:/, '') || '__sem__';
              const dropKey = chaveDrop(frequencia, centroKey);

              return (
                <BlocoGrupo
                  key={`${frequencia}::${grupo.key}`}
                  dropKey={dropKey}
                  grupoLabel={grupo.label}
                  sublabel={`${grupo.items.length} conta(s)`}
                  series={grupo.items}
                  draggable={permiteArrastar}
                  draggingSerieId={draggingSerieId}
                  dropCentroAtual={dropCentroAtual}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingSerieId) onHoverCentro(dropKey);
                  }}
                  onDragLeave={onLeaveCentro}
                  onDrop={(e) => {
                    e.preventDefault();
                    const serieId = e.dataTransfer.getData('text/plain');
                    onDropCentro(serieId, centroKey === '__sem__' ? '' : centroKey);
                  }}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
