import CotacoesManager from '@/components/compras/CotacoesManager';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';

export default function CotacoesPage() {
  return (
    <div className="w-full min-w-0 overflow-x-hidden font-din-1451 bg-background px-3 py-3 sm:p-4 lg:p-6 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="pb-3 border-b border-border/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <h1 className="text-lg sm:text-xl font-medium text-foreground truncate">
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
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug">
          Lista manda · Disputa compara · Aprovar gera pedido
        </p>
      </div>

      <div className="mt-3 sm:mt-4 min-h-0">
        <CotacoesManager />
      </div>
    </div>
  );
}
