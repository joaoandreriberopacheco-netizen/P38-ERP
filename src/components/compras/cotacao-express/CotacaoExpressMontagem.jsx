import { ArrowLeft, Camera, FileOutput, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/financialUtils';
import MobileProductSelector from '@/components/compras/MobileProductSelector';
import {
  cotacaoExpressFooterButtonsClass,
  cotacaoExpressFooterClass,
  cotacaoExpressHeaderClass,
  cotacaoExpressPrimaryBtnClass,
  cotacaoExpressSecondaryBtnClass,
  cotacaoExpressShellClass,
} from './cotacaoExpressLayout';

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
  onAddItemsBatch,
  onExportarSolicitacao,
}) {
  return (
    <div className={cotacaoExpressShellClass}>
      <div className={cotacaoExpressHeaderClass}>
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

      <div className="min-h-0 flex-1 overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] desktop-layout:pb-0">
        <MobileProductSelector
          items={selectorItems}
          products={produtos}
          onAddItem={onAddItem}
          onAddItemsBatch={onAddItemsBatch}
          onUpdateItem={onUpdateItem}
          onRemoveItem={onRemoveItem}
          formatCurrency={formatCurrency}
          onProductCreated={onProductCreated}
          onOpenImporter={onImportarLista}
        />
      </div>

      <div className={`${cotacaoExpressFooterClass} space-y-2`}>
        <div className={cotacaoExpressFooterButtonsClass}>
          <Button
            type="button"
            variant="outline"
            className={cotacaoExpressSecondaryBtnClass}
            onClick={onSalvarItens}
            disabled={salvando}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar itens'}
          </Button>
          <Button
            type="button"
            className={`${cotacaoExpressPrimaryBtnClass} p38-btn-primary`}
            onClick={onAbrirDisputa}
            disabled={abrindoDisputa || selectorItems.length === 0}
          >
            {abrindoDisputa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4 shrink-0" />
                Enviar para disputa
              </>
            )}
          </Button>
        </div>
        {selectorItems.length > 0 && onExportarSolicitacao && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full rounded-xl px-2 text-sm text-muted-foreground"
            onClick={onExportarSolicitacao}
          >
            <FileOutput className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">Gerar solicitação (HTML / PDF)</span>
          </Button>
        )}
      </div>
    </div>
  );
}
