import { useEffect, useState } from 'react';
import { FileText, FileDown, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Gera solicitação HTML (mobile) ou PDF (A4) para enviar ao fornecedor.
 */
export default function CotacaoFornecedorExportDialog({
  open,
  onOpenChange,
  cotacao,
  fornecedoresOpcoes = [],
  exporting = false,
  onExportHtml,
  onExportPdf,
}) {
  const [fornecedorId, setFornecedorId] = useState('');

  useEffect(() => {
    if (!open) setFornecedorId('');
  }, [open]);

  const fornecedorSelecionado = fornecedoresOpcoes.find((f) => f.fornecedor_id === fornecedorId || f.id === fornecedorId);

  const buildFornecedorPayload = () => {
    if (!fornecedorSelecionado) return null;
    return {
      nome: fornecedorSelecionado.fornecedor_nome || fornecedorSelecionado.nome,
      email: fornecedorSelecionado.email,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Solicitação para fornecedor</DialogTitle>
          <DialogDescription>
            Gere um documento com os itens da cotação {cotacao?.numero} para enviar por WhatsApp, e-mail ou impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {fornecedoresOpcoes.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Destinatário (opcional)</Label>
              <select
                className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                disabled={exporting}
              >
                <option value="">Todos / sem destinatário</option>
                {fornecedoresOpcoes.map((f) => {
                  const id = f.fornecedor_id || f.id;
                  const nome = f.fornecedor_nome || f.nome;
                  return (
                    <option key={id} value={id}>{nome}</option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">HTML</strong> — responsivo no celular; ideal para compartilhar link/arquivo.</p>
            <p><strong className="text-foreground">PDF</strong> — folha A4; ideal para anexar em e-mail.</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="h-12 w-full rounded-2xl"
            disabled={exporting}
            onClick={() => onExportHtml?.(buildFornecedorPayload())}
          >
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Gerar HTML
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-2xl"
            disabled={exporting}
            onClick={() => onExportPdf?.(buildFornecedorPayload())}
          >
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Gerar PDF (A4)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
