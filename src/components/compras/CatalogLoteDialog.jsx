import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import CatalogLotePicker from '@/components/compras/CatalogLotePicker';
import { buildLoteIncomingFromDraft } from '@/lib/catalogLoteUtils';

/**
 * Dialog full-screen com CatalogLotePicker para importadores e buscas pontuais.
 */
export default function CatalogLoteDialog({
  open,
  onOpenChange,
  products = [],
  initialSearch = '',
  onConfirm,
  confirmLabel = 'Confirmar seleção',
}) {
  const [search, setSearch] = useState(initialSearch);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (open) {
      setSearch(initialSearch);
      setDraft({});
    }
  }, [open, initialSearch]);

  const handleOpenChange = (next) => {
    if (!next) {
      setDraft({});
      setSearch(initialSearch);
    }
    onOpenChange?.(next);
  };

  const handleConfirm = () => {
    const incoming = buildLoteIncomingFromDraft(draft);
    if (incoming.length > 0) {
      onConfirm?.(incoming);
    }
    setDraft({});
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] w-[96vw] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0">
        <div className="min-h-0 flex-1 overflow-hidden">
          <CatalogLotePicker
            products={products}
            search={search}
            onSearchChange={setSearch}
            draft={draft}
            onDraftChange={setDraft}
            onConfirm={handleConfirm}
            onExit={() => handleOpenChange(false)}
            confirmLabel={confirmLabel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
