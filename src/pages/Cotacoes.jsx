import CotacoesManager from '@/components/compras/CotacoesManager';

export default function CotacoesPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background font-din-1451 pb-[var(--p38-bottom-nav-total,0px)] md:pb-0">
      <div className="shrink-0 border-b border-border/40 px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold text-foreground font-glacial md:text-2xl">
          Cotações
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 md:text-sm">
          Compare propostas, registre disputas e gere pedidos de compra
        </p>
      </div>
      <div className="min-h-0 flex-1 p-3 md:p-6 md:pt-4">
        <CotacoesManager />
      </div>
    </div>
  );
}
