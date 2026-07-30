import React, { useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { roundToTwoDecimals, formatCurrency } from '@/lib/financialUtils';
import { useKPIsCache } from '@/hooks/useKPIsCache';

function formatValor(valor) {
  return formatCurrency(roundToTwoDecimals(valor || 0));
}

/** Resumo de vendas do dia — carrega KPIs só quando montado. */
export default function HomeSalesSummary() {
  const [showBalance, setShowBalance] = React.useState(false);
  const { kpis, loadKPIs } = useKPIsCache({ enabled: true });

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

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
        >
          {showBalance ? (
            <Eye className="w-5 h-5 text-muted-foreground" />
          ) : (
            <EyeOff className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>
      {showBalance ? (
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
