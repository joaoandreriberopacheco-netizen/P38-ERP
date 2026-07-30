import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AgefinPrevisaoDetalheDrawer from '@/components/agefin-previsao/AgefinPrevisaoDetalheDrawer';
import AgefinParcelamentoDialog from '@/components/agefin-previsao/AgefinParcelamentoDialog';
import AgefinSerieDialog from '@/components/agefin-previsao/AgefinSerieDialog';
import FolhaCentrosCustoDialog from '@/components/folha-previsao/FolhaCentrosCustoDialog';
import FolhaCentroCustoDragOverlay from '@/components/folha-previsao/FolhaCentroCustoDragOverlay';
import AgefinImportador from '@/components/agefin/AgefinImportador';

export function PlanejamentoFab({ onCentros, onImportar, onNovaConta }) {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="fixed right-3 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 sm:right-4 lg:right-8">
      {fabOpen && (
        <div className="mb-2 flex w-[min(calc(100vw-1.5rem),16.5rem)] flex-col items-stretch gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-md justify-center"
            onClick={() => {
              setFabOpen(false);
              onCentros();
            }}
          >
            Centros de custo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-md justify-center"
            onClick={() => {
              setFabOpen(false);
              onImportar();
            }}
          >
            Importar conta (PDF)
          </Button>
          <Button
            size="sm"
            className="rounded-full shadow-md justify-center p38-labotrat-cta"
            onClick={() => {
              setFabOpen(false);
              onNovaConta();
            }}
          >
            Nova conta fixa
          </Button>
        </div>
      )}
      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg p38-labotrat-cta"
        onClick={() => setFabOpen((v) => !v)}
        aria-label={fabOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

export default function PlanejamentoDialogs({
  selectedComp,
  selectedModelo,
  onCloseSelected,
  centrosRegistrados,
  centrosCustoRegistros,
  categorias,
  onCategoriasChange,
  onCentrosChange,
  serieDialog,
  onCloseSerieDialog,
  onSaveSerie,
  saving,
  parcelamentoDialog,
  onCloseParcelamentoDialog,
  onCriarParcelamento,
  salvandoParcelamento,
  centroDialogOpen,
  onCloseCentroDialog,
  onCentrosChanged,
  draggingSerieId,
  serieArrastando,
  dropCentroAtual,
  onHoverCentro,
  onLeaveCentro,
  onDropCentro,
  showImportador,
  onCloseImportador,
  importadorLancamentoId,
  onImportadorSuccess,
  syncing,
  onSyncFinanceiro,
  onAbrirSerieNoMes,
  abrindoMes,
  onVincularBoleto,
  onSalvarManual,
  salvandoManual,
  podeParcelarConta,
  onParcelar,
  onSalvarParcela,
  onRemoverParcelamento,
  removendoParcelamento,
}) {
  return (
    <>
      <AgefinPrevisaoDetalheDrawer
        open={Boolean(selectedComp)}
        onClose={onCloseSelected}
        competencia={selectedComp}
        modelo={selectedModelo}
        onSyncFinanceiro={onSyncFinanceiro}
        syncing={syncing}
        onAbrirMes={onAbrirSerieNoMes}
        abrindoMes={abrindoMes}
        onVincularBoleto={onVincularBoleto}
        onSalvarManual={onSalvarManual}
        salvandoManual={salvandoManual}
        onParcelar={podeParcelarConta ? onParcelar : undefined}
        onSalvarParcela={onSalvarParcela}
        onRemoverParcelamento={onRemoverParcelamento}
        removendoParcelamento={removendoParcelamento}
      />

      <AgefinParcelamentoDialog
        open={parcelamentoDialog}
        onClose={onCloseParcelamentoDialog}
        competencia={selectedComp}
        modelo={selectedModelo}
        onConfirm={onCriarParcelamento}
        saving={salvandoParcelamento}
      />

      <AgefinSerieDialog
        open={Boolean(serieDialog)}
        onClose={onCloseSerieDialog}
        serie={serieDialog}
        categorias={categorias}
        centrosCustoRegistros={centrosCustoRegistros}
        onCategoriasChange={onCategoriasChange}
        onCentrosChange={onCentrosChange}
        onSave={onSaveSerie}
        saving={saving}
      />

      <FolhaCentrosCustoDialog open={centroDialogOpen} onClose={onCloseCentroDialog} onChanged={onCentrosChanged} />

      <FolhaCentroCustoDragOverlay
        open={Boolean(draggingSerieId)}
        centros={centrosRegistrados}
        pessoaNome={serieArrastando?.nome}
        dropCentroAtual={dropCentroAtual}
        onHoverCentro={onHoverCentro}
        onLeaveCentro={(chave) => onLeaveCentro(chave)}
        onDropCentro={onDropCentro}
      />

      <Dialog open={showImportador} onOpenChange={(open) => !open && onCloseImportador()}>
        <DialogContent className="flex min-h-0 max-h-[92vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-xl">
          <div className="shrink-0 border-b border-border/40 p-5">
            <h2 className="text-lg font-semibold text-foreground">Anexar boleto (PDF)</h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AgefinImportador
              modoAtualizacao={Boolean(importadorLancamentoId || selectedComp?.lancamento_id)}
              somenteAnexo
              lancamentoFinanceiroId={importadorLancamentoId || selectedComp?.lancamento_id || undefined}
              dadosContaExistente={
                selectedComp
                  ? { descricao: selectedComp.serie_nome, terceiro_nome: selectedComp.terceiro_nome }
                  : undefined
              }
              onSuccess={onImportadorSuccess}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
