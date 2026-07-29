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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <P38HelpPopover label="Ajuda: contas fixas" side="bottom" align="start">
          <p className="font-medium text-foreground">Série = fonte de verdade</p>
          <p className="text-muted-foreground">
            Cada conta fixa é uma <strong className="text-foreground">série</strong> (aluguel, energia,
            telefone…). Aqui defines valor, dia, frequência e centro de custo.
          </p>
          <p className="text-muted-foreground mt-2">
            A <strong className="text-foreground">Previsão do mês</strong> é só projeção virtual. O
            lançamento real nasce quando <strong className="text-foreground">abres o mês</strong>.
          </p>
          <p className="text-muted-foreground mt-2">
            Fretes e despesas avulsas não entram aqui — ficam na AGEFIN Consulta pelo vencimento.
          </p>
        </P38HelpPopover>
        <AgefinConsultaOrganizer
          variant="contasFixas"
          groupBy={groupBy}
          sortOrder={sortOrder}
          onGroupByChange={onGroupByChange}
          onSortOrderToggle={onSortOrderToggle}
        />
      </div>

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
        <div className="flex justify-center -mt-6 pb-4">
          <Button variant="outline" onClick={onCadastrar}>
            Cadastrar conta fixa
          </Button>
        </div>
      )}
    </div>
  );
}
