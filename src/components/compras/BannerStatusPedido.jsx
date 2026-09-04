import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import {
  evidenciaAprovacaoFinanceiraProcessada,
  getPedidoCompraDisplayStatusFinanceiro,
} from '@/lib/pedidoCompraFinanceiro';

/**
 * Banner contextual no topo do PedidoCompraForm.
 * Reforça o vínculo com aprovações financeiras e o caminho de correção (FAB → Solicitar correção).
 */
export default function BannerStatusPedido({ pedido, lancamentos = [], isMobile = false }) {
  if (!pedido) return null;

  const saf = pedido.status_aprovacao_financeira;
  const aprovadoEfetivo =
    pedido._financeiro_aprovado_efetivo || evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);
  const statusFinanceiroDisplay = getPedidoCompraDisplayStatusFinanceiro(pedido, lancamentos);
  const isAguardandoFin =
    !aprovadoEfetivo &&
    (statusFinanceiroDisplay === 'Aguardando Aprovação Financeira' ||
      pedido.status === 'Aguardando Liberação' ||
      saf === 'Aguardando Aprovação Financeira');
  const solicitacaoPendente = saf === 'Solicitação de Edição Pendente';
  const financeiroLiberado =
    aprovadoEfetivo ||
    saf === 'Aprovado Financeiramente' ||
    saf === 'Aprovado' ||
    statusFinanceiroDisplay === 'Aprovado Financeiramente' ||
    (['Aprovado', 'Despachado', 'Em Recepção', 'Concluído', 'Aguardando Recepção'].includes(pedido.status) &&
      saf !== 'Aguardando Aprovação Financeira' &&
      saf !== 'Pendente' &&
      !solicitacaoPendente);

  const baseClass = isMobile
    ? 'px-3 py-2 border-b'
    : 'px-4 py-2.5 border-b flex-shrink-0';

  if (solicitacaoPendente) {
    return (
      <div className={`${baseClass} bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-medium">Correção solicitada.</span>{' '}
            {isMobile
              ? 'Aguarde o financeiro liberar a edição.'
              : 'Libere a edição na aba Financeiro deste pedido ou em Aprovações Financeiras.'}
          </div>
        </div>
      </div>
    );
  }

  if (isAguardandoFin) {
    return (
      <div className={`${baseClass} bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-800 dark:text-yellow-200">
            <span className="font-medium">Aguardando aprovação financeira.</span>{' '}
            {isMobile
              ? 'Edição bloqueada. Aprove na aba Financeiro ou em Aprovações.'
              : 'Edição bloqueada até aprovar o pagamento. Use a aba Financeiro deste pedido (atalho) ou o módulo Aprovações Financeiras.'}
          </div>
        </div>
      </div>
    );
  }

  if (financeiroLiberado) {
    return (
      <div className="bg-lime-50 px-4 py-2.5 opacity-100 border-b flex-shrink-0 dark:bg-lime-900/20 border-lime-100 dark:border-lime-800">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-lime-800 dark:text-lime-200">
            <span className="font-medium">Aprovado financeiramente.</span>{' '}
            {isMobile
              ? 'Valores já passaram pelo financeiro. Para corrigir: menu flutuante → Solicitar correção.'
              : 'Para corrigir dados: menu flutuante → Solicitar correção; depois libere a edição na aba Financeiro ou em Aprovações.'}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
