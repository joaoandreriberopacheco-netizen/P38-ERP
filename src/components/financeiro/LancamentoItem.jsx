import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const formatCurrency = (v) =>
  `R$ ${Math.abs(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const categoriaLabel = (cat) => cat || 'Outros';

const statusConciliacaoConfig = {
  'Pendente': { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  'Conciliado': { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/10' },
  'Discrepância': { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10' },
  'N/A': { icon: CheckCircle2, color: 'text-muted-foreground', bg: '' },
};

export default function LancamentoItem({ lancamento, onClick }) {
  const isReceita = lancamento.tipo === 'Receita';
  const isPago = lancamento.status === 'Pago';
  const isPrevisto = !isPago && lancamento.status !== 'Cancelado';
  const concStatus = lancamento.status_conciliacao || 'N/A';
  const ConcIcon = statusConciliacaoConfig[concStatus]?.icon || Clock;
  const concColor = statusConciliacaoConfig[concStatus]?.color || 'text-muted-foreground';

  const dataRef = lancamento.data_pagamento || lancamento.data_vencimento;

  return (
    <button
      onClick={() => onClick && onClick(lancamento)}
      className="w-full max-w-full overflow-hidden flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors text-left active:scale-[0.99] touch-manipulation"
    >
      {/* Ícone */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isReceita
          ? isPago ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted'
          : isPago ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'
      }`}>
        {isReceita
          ? <ArrowDownLeft className={`w-4 h-4 ${isPago ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
          : <ArrowUpRight className={`w-4 h-4 ${isPago ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`} />
        }
      </div>

      {/* Descrição */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <p className={`text-sm font-medium truncate flex-1 min-w-0 ${isPrevisto ? 'text-muted-foreground' : 'text-foreground'}`}>
            {lancamento.descricao}
          </p>
          {isPrevisto && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground flex-shrink-0 whitespace-nowrap">prev.</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate overflow-hidden">
          {dataRef ? format(new Date(dataRef), 'dd MMM', { locale: ptBR }) : '—'}
          {lancamento.conta_financeira_nome ? ` · ${lancamento.conta_financeira_nome}` : ''}
        </p>
      </div>

      {/* Valor */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 max-w-[40%] min-w-0">
        <p className={`text-sm font-semibold truncate max-w-full ${
          isReceita
            ? isPago ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            : isPago ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
        }`}>
          {isReceita ? '+' : '-'}{formatCurrency(lancamento.valor)}
        </p>
        {concStatus !== 'N/A' && concStatus !== 'Conciliado' && (
          <ConcIcon className={`w-3 h-3 ${concColor}`} />
        )}
      </div>
    </button>
  );
}