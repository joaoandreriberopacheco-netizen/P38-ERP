import React from 'react';
import { cn } from '@/lib/utils';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
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
        draggable && dropCentroAtual === dropKey && draggingSerieId ? 'ring-2 ring-primary/40' : '',
      )}
    >
      <div className="p38-sheet-section">
        <p className="p38-sheet-section-title">{grupoLabel}</p>
        <p className="p38-sheet-section-sub">{sublabel || `${series.length} conta(s)`}</p>
      </div>
      {series.length > 0 ? (
        <P38MobileLineList className="!block rounded-none border-0 bg-transparent overflow-hidden md:!block">
          {series.map((s, idx) => (
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
              <AgefinPrevisaoModeloRow
                modelo={s}
                striped={false}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </P38MobileLineList>
      ) : (
        <p className="px-3 py-4 text-xs text-muted-foreground">Arraste uma conta para este centro.</p>
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
      <p className="text-xs text-muted-foreground px-3 py-4">
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
            <div className="p38-sheet-section">
              <p className="p38-sheet-section-title p38-labotrat-grupo-label">
                Recorrência {frequencia} ({totalSecao})
              </p>
              <p className="p38-sheet-section-sub">{DESCRICAO_FREQUENCIA_SERIE[frequencia]}</p>
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
