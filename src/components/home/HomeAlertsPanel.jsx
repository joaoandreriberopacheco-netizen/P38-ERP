import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Package } from 'lucide-react';
import { createPageUrl } from '@/components/utils';
import { useKPIsCache } from '@/hooks/useKPIsCache';

export default function HomeAlertsPanel({ allowedActionIds }) {
  const { kpis, loadKPIs } = useKPIsCache({ enabled: true });

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  const temAvisos = kpis.estoqueAlerta > 0 || kpis.pedidosPendentes > 0;
  const podeVerCaixa = allowedActionIds.includes('pdv');
  const podeVerEstoque =
    allowedActionIds.includes('produtos') || allowedActionIds.includes('tabelaprecos');
  const temAvisoValido =
    (kpis.pedidosPendentes > 0 && podeVerCaixa) || (kpis.estoqueAlerta > 0 && podeVerEstoque);

  if (!temAvisos || !temAvisoValido) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
        Avisos
      </h2>
      {kpis.pedidosPendentes > 0 && podeVerCaixa && (
        <Link
          to={createPageUrl('PDVCaixa')}
          className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-start gap-3 hover:shadow-md transition-shadow touch-manipulation active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {kpis.pedidosPendentes}{' '}
              {kpis.pedidosPendentes === 1 ? 'venda aguardando' : 'vendas aguardando'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Processar pagamento no caixa</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </Link>
      )}
      {kpis.estoqueAlerta > 0 && podeVerEstoque && (
        <Link
          to={createPageUrl('Produtos')}
          className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-start gap-3 hover:shadow-md transition-shadow touch-manipulation active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {kpis.estoqueAlerta}{' '}
              {kpis.estoqueAlerta === 1 ? 'produto' : 'produtos'} em estoque baixo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Verificar reposição</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </Link>
      )}
    </div>
  );
}
