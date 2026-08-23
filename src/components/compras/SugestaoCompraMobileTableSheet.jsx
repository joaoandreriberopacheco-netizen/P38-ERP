import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SugestaoCompraMobileTable from '@/components/compras/SugestaoCompraMobileTable';
import { applyPreferredOrientation } from '@/lib/portraitOrientationLock';

/**
 * Tabela comparativa em fullscreen no telemóvel.
 * Respeita a preferência de orientação do menu Perfil.
 */
export default function SugestaoCompraMobileTableSheet({
  open,
  onClose,
  linhas,
  selectedItems,
  onToggleSelected,
  sugestaoDisplayLinha,
  onQuantidadeLinhaChange,
  renderFornecedorSelect,
}) {
  useEffect(() => {
    if (!open) return undefined;
    applyPreferredOrientation();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      applyPreferredOrientation();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Tabela comparativa de sugestões"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={onClose}
          aria-label="Voltar para lista"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">Tabela comparativa</p>
          <p className="text-[10px] text-muted-foreground">{linhas.length} itens</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SugestaoCompraMobileTable
          linhas={linhas}
          selectedItems={selectedItems}
          onToggleSelected={onToggleSelected}
          sugestaoDisplayLinha={sugestaoDisplayLinha}
          onQuantidadeLinhaChange={onQuantidadeLinhaChange}
          renderFornecedorSelect={renderFornecedorSelect}
          embedded
        />
      </div>
    </div>
  );
}
