import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { roundToTwoDecimals, formatCurrency } from '@/lib/financialUtils';
import { useKPIsCache } from '@/hooks/useKPIsCache';
import { Skeleton } from '@/components/ui/skeleton';

function formatValor(valor) {
  return formatCurrency(roundToTwoDecimals(valor || 0));
}

function SalesSummarySkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando resumo de vendas">
      <Skeleton className="h-9 w-44 rounded-lg" />
      <Skeleton className="h-4 w-36 rounded-md" />
    </div>
  );
}

/** Resumo de vendas do dia — consulta filtrada no SQL; skeleton até os dados chegarem. */
export default function HomeSalesSummary() {
  const [showBalance, setShowBalance] = React.useState(false);
  const { kpis, isPending } = useKPIsCache({ enabled: true });

  return (
    <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Resumo de Vendas</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">Hoje</p>
        </div>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          className="p-2 hover:bg-muted rounded-xl transition-colors touch-manipulation"
          aria-label={showBalance ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {showBalance ? (
            <Eye className="w-5 h-5 text-muted-foreground" />
          ) : (
            <EyeOff className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>
      {isPending ? (
        <SalesSummarySkeleton />
      ) : showBalance ? (
        <>
          <div className="text-3xl font-bold text-foreground mb-1">
            R$ {formatValor(kpis.valorVendasHoje)}
          </div>
          <p className="text-sm text-muted-foreground">
            {kpis.vendasHoje} {kpis.vendasHoje === 1 ? 'venda realizada' : 'vendas realizadas'}
          </p>
        </>
      ) : (
        <div className="text-3xl font-bold text-muted-foreground/50 mb-1">••••••</div>
      )}
    </div>
  );
}
