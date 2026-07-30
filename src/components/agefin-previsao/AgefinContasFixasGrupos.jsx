import React from 'react';
import { cn } from '@/lib/utils';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { FinanceiroGrupo } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import AgefinPrevisaoModeloRow from '@/components/agefin-previsao/AgefinPrevisaoModeloRow';
import {
  DESCRICAO_FREQUENCIA_SERIE,
  ORDEM_FREQUENCIAS_CONTAS_FIXAS,
} from '@/lib/agefinPrevisaoCalculos';

function chaveDrop(frequencia, centroKey) {
  return `${frequencia}::${centroKey}`;
}

function totalValorSeries(series) {
  return (series || []).reduce((s, item) => s + (Number(item.valor_previsto) || 0), 0);
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
        'rounded-xl border border-border/60 bg-card/40',
        draggable && dropCentroAtual === dropKey && draggingSerieId
          ? 'ring-2 ring-primary/50 border-primary/50'
          : '',
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div>
          <p className="text-xs font-semibold text-foreground">{grupoLabel}</p>
          <p className="text-[11px] text-muted-foreground">{sublabel || `${series.length} conta(s)`}</p>
        </div>
      </div>
      {series.length > 0 ? (
        <P38MobileLineList className="block md:!block rounded-none overflow-hidden">
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
                striped={idx % 2 === 1}
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
      <p className="text-xs text-muted-foreground px-1">
        Nenhuma conta fixa cadastrada. Use o botão + para criar e escolha a recorrência no formulário.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {secoesComContas.map((frequencia) => {
        const grupos = (agrupamento[frequencia] || []).filter((g) => (g.items || []).length > 0);
        const totalSecao = grupos.reduce((n, g) => n + (g.items?.length || 0), 0);
        const totalValor = grupos.reduce((n, g) => n + totalValorSeries(g.items), 0);

        return (
          <FinanceiroGrupo
            key={frequencia}
            label={`Recorrência ${frequencia} (${totalSecao})`}
            labelClassName="text-xs font-semibold normal-case tracking-normal text-foreground"
            despesas={totalValor}
            liquido={-totalValor}
            card
            defaultOpen
          >
            <div className="space-y-3 px-1 pb-1">
              <p className="text-[11px] text-muted-foreground -mt-1">
                {DESCRICAO_FREQUENCIA_SERIE[frequencia]}
              </p>
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
          </FinanceiroGrupo>
        );
      })}
    </div>
  );
}
