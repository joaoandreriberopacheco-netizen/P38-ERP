import CotacoesManager from '@/components/compras/CotacoesManager';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';

export default function CotacoesPage() {
  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-background font-din-1451">
      <div className="shrink-0 border-b border-border/40 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="truncate text-lg font-medium text-foreground sm:text-xl">
            Cotações
          </h1>
          <P38HelpPopover label="Ajuda: cotações" side="bottom" align="start">
            <p className="font-medium text-foreground">Fluxo em 4 passos</p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Montagem</strong> — busque produtos ou importe lista por OCR (foto/PDF).
            </p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Disputa</strong> — compare propostas dos fornecedores com o custo de compra atual e registre observações.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong className="text-foreground">Aprovação</strong> — confirme os vencedores e gere pedido(s) de compra em rascunho.
            </p>
          </P38HelpPopover>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
          Lista manda · Disputa compara · Aprovar gera pedido
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 sm:px-4">
        <CotacoesManager />
      </div>
    </div>
  );
}
