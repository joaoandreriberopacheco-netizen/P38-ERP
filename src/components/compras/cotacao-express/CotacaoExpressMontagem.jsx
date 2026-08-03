import { ArrowLeft, Camera, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/financialUtils';
import MobileProductSelector from '@/components/compras/MobileProductSelector';

export default function CotacaoExpressMontagem({
  cotacao,
  selectorItems,
  produtos,
  salvando = false,
  abrindoDisputa = false,
  onVoltar,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onProductCreated,
  onSalvarItens,
  onImportarLista,
  onAbrirDisputa,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVoltar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold font-glacial text-foreground">
              Montagem
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {cotacao?.titulo} · {cotacao?.numero}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImportarLista}
            className="h-9 shrink-0 rounded-xl"
          >
            <Camera className="mr-1 h-4 w-4" />
            OCR
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <MobileProductSelector
          items={selectorItems}
          products={produtos}
          onAddItem={onAddItem}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          formatCurrency={formatCurrency}
          onProductCreated={onProductCreated}
          onOpenImporter={onImportarLista}
        />
      </div>

      <div className="shrink-0 border-t border-border/40 bg-card/80 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-2xl"
            onClick={onSalvarItens}
            disabled={salvando}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar itens'}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl p38-btn-primary"
            onClick={onAbrirDisputa}
            disabled={abrindoDisputa || selectorItems.length === 0}
          >
            {abrindoDisputa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar para disputa
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
