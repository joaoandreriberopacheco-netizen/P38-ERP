import { useMemo } from 'react';
import { Repeat2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import AgefinContasFixasGrupos from '@/components/agefin-previsao/AgefinContasFixasGrupos';
import AgefinConsultaOrganizer from '@/components/agefin/AgefinConsultaOrganizer';
import {
  agruparSeriesPorFrequenciaEGrupo,
  ordenarSeriesPorCentroENome,
} from '@/lib/agefinPrevisaoCalculos';

export default function ContasFixasTab({
  loading,
  modelos,
  centrosRegistrados,
  groupBy,
  sortOrder,
  onGroupByChange,
  onSortOrderToggle,
  draggingSerieId,
  dropCentroAtual,
  onDragStart,
  onDragEnd,
  onHoverCentro,
  onLeaveCentro,
  onDropCentro,
  onEdit,
  onDelete,
  onCadastrar,
}) {
  const seriesAtivas = useMemo(
    () => ordenarSeriesPorCentroENome(modelos.filter((m) => m.ativo !== false)),
    [modelos],
  );

  const agrupamento = useMemo(
    () =>
      agruparSeriesPorFrequenciaEGrupo(seriesAtivas, {
        centrosRegistrados,
        groupBy,
        sortOrder,
      }),
    [seriesAtivas, centrosRegistrados, groupBy, sortOrder],
  );

  return (
    <div className="min-w-0">
      <div className="p38-single-sheet">
        <div className="p38-sheet-block flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <P38HelpPopover label="Ajuda: contas fixas" side="bottom" align="start">
              <p className="font-medium text-foreground">Série = fonte de verdade</p>
              <p className="text-muted-foreground">
                Cada conta fixa é uma <strong className="text-foreground">série</strong>. Aqui defines
                valor, dia, frequência e centro de custo.
              </p>
            </P38HelpPopover>
          </div>
          <div className="shrink-0">
            <AgefinConsultaOrganizer
              variant="contasFixas"
              groupBy={groupBy}
              sortOrder={sortOrder}
              onGroupByChange={onGroupByChange}
              onSortOrderToggle={onSortOrderToggle}
            />
          </div>
        </div>

        <div className="p38-sheet-divider" role="presentation" />

        <FinanceiroListaEstado
          loading={loading}
          vazio={!loading && seriesAtivas.length === 0}
          vazioMensagem="Nenhuma série / conta fixa cadastrada."
          vazioIcon={Repeat2}
        >
          <AgefinContasFixasGrupos
            agrupamento={agrupamento}
            groupBy={groupBy}
            draggingSerieId={draggingSerieId}
            dropCentroAtual={dropCentroAtual}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onHoverCentro={onHoverCentro}
            onLeaveCentro={onLeaveCentro}
            onDropCentro={onDropCentro}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </FinanceiroListaEstado>

        {!loading && seriesAtivas.length === 0 && (
          <div className="flex justify-center px-4 pb-5 pt-2">
            <Button variant="outline" className="w-full max-w-xs border-0 bg-[#F4F4F5]" onClick={onCadastrar}>
              Cadastrar conta fixa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
