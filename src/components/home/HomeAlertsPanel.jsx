import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { createPageUrl } from '@/components/utils';
import { useHomePedidosPendentesQuery } from '@/hooks/useP38Entities';

export default function HomeAlertsPanel({ allowedActionIds }) {
  const { data: pedidosPendentes = 0 } = useHomePedidosPendentesQuery({ enabled: true });
  const podeVerCaixa = allowedActionIds.includes('pdv');

  if (pedidosPendentes <= 0 || !podeVerCaixa) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
        Avisos
      </h2>
      <Link
        to={createPageUrl('PDVCaixa')}
        className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-start gap-3 hover:shadow-md transition-shadow touch-manipulation active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {pedidosPendentes}{' '}
            {pedidosPendentes === 1 ? 'venda aguardando' : 'vendas aguardando'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Processar pagamento no caixa</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </Link>
    </div>
  );
}
