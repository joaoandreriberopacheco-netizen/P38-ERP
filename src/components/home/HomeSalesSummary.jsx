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
    <div className="mt-1 space-y-1.5" aria-busy="true" aria-label="Carregando resumo de vendas">
      <Skeleton className="h-7 w-36 rounded-md compact-shell:h-6 compact-shell:w-32" />
      <Skeleton className="h-3.5 w-28 rounded-md" />
    </div>
  );
}

/** Resumo de vendas do dia — consulta filtrada no SQL; skeleton até os dados chegarem. */
export default function HomeSalesSummary() {
  const [showBalance, setShowBalance] = React.useState(false);
  const { kpis, isPending } = useKPIsCache({ enabled: true });

  return (
    <div className="bg-card rounded-2xl compact-shell:rounded-xl p-4 compact-shell:p-3 md:p-5 shadow-sm border border-border/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide leading-tight">
            Resumo de Vendas · Hoje
          </p>
          {isPending ? (
            <SalesSummarySkeleton />
          ) : showBalance ? (
            <>
              <div className="text-xl md:text-2xl font-bold text-foreground mt-1 leading-none">
                R$ {formatValor(kpis.valorVendasHoje)}
              </div>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-1 uppercase tracking-wide">
                {kpis.vendasHoje} {kpis.vendasHoje === 1 ? 'venda realizada' : 'vendas realizadas'}
              </p>
            </>
          ) : (
            <div className="text-xl md:text-2xl font-bold text-muted-foreground/50 mt-1 leading-none">••••••</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors touch-manipulation shrink-0"
          aria-label={showBalance ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {showBalance ? (
            <Eye className="w-4 h-4 text-muted-foreground" />
          ) : (
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
