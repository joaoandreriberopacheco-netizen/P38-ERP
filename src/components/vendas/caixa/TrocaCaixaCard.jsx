import React from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';
import { formatCommercialQuantity } from '@/lib/productUnits';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { resolveResumoTrocaCaixa } from '@/lib/substituicoesVendaCaixa';

function TrocaMovimentoRow({ kind, item, striped }) {
  const isRetorno = kind === 'retorno';
  const Icon = isRetorno ? ArrowDownLeft : ArrowUpRight;
  const label = isRetorno ? 'Retorno' : 'Levou';
  const qtd = Number(item.quantidade) || 0;
  const unit = Number(item.preco_unitario) || 0;
  const total = Number(item.total) || unit * qtd;

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 border-b border-border/30 last:border-0',
        isRetorno
          ? 'bg-red-50/35 dark:bg-red-950/15'
          : 'bg-emerald-50/35 dark:bg-emerald-950/15',
        striped && 'opacity-95',
      )}
    >
      <div className="flex flex-col items-center gap-1 w-14 flex-shrink-0 pt-0.5">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            isRetorno
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wide text-center leading-tight',
            isRetorno ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300',
          )}
        >
          {label}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-2 leading-snug')}>{item.produto_nome}</p>
        <div className="flex items-baseline justify-between gap-3 mt-1.5">
          <p className={`${caixaTypo.meta} tabular-nums`}>
            {formatCommercialQuantity(qtd, item.unidade_medida || 'UN')}{' '}
            {(item.unidade_medida || 'UN').toUpperCase()} · {formatCaixaR(unit)} un.
          </p>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums shrink-0',
              isRetorno ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300',
            )}
          >
            {isRetorno ? '−' : ''}
            {formatCaixaR(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TrocaCaixaCard({ venda, meta, onVerDetalhes, compact = false }) {
  const resumo = resolveResumoTrocaCaixa(venda, meta);
  const hora = venda.created_date ? formatarDataHora(venda.created_date).split(' ')[1] || '' : '';

  const header = (
    <button
      type="button"
      onClick={() => onVerDetalhes?.(venda)}
      className={cn(
        'w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-amber-200/50 dark:border-amber-800/40 text-left transition-colors',
        onVerDetalhes && 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className={`${p38Table.mobileLineTitle} truncate`}>{venda.numero}</p>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
          >
            Troca
          </Badge>
          {resumo.devolucaoNumero && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
              {resumo.devolucaoNumero}
            </Badge>
          )}
          <FormaPagamentoBadges pagamentos={venda.pagamentos} size="xs" />
        </div>
        <p className={`${p38Table.mobileLineSubtitle} truncate`}>
          {venda.cliente_nome || 'Avulso'}
          {hora ? ` · ${hora}` : ''}
          {resumo.pedidoOrigem ? ` · origem ${resumo.pedidoOrigem}` : ''}
        </p>
      </div>
      {!compact && (
        <div className="text-right shrink-0">
          <p className={`${caixaTypo.labelSm} text-amber-700 dark:text-amber-300`}>Entrada no caixa</p>
          <CaixaValorDisplay valor={resumo.entradaCaixa} tone="warning" size="sm" />
        </div>
      )}
    </button>
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden ring-1 ring-amber-200/70 dark:ring-amber-800/50">
      {header}

      <div>
        {resumo.itensRetorno.map((item, idx) => (
          <TrocaMovimentoRow key={`ret-${idx}`} kind="retorno" item={item} striped={idx % 2 === 1} />
        ))}
        {resumo.itensLevou.map((item, idx) => (
          <TrocaMovimentoRow key={`lev-${idx}`} kind="levou" item={item} striped={idx % 2 === 1} />
        ))}
      </div>

      <div className="px-4 py-3 border-t border-dashed border-amber-200/60 dark:border-amber-800/40 space-y-2 bg-amber-50/30 dark:bg-amber-950/10">
        {resumo.subtotalProdutos > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Produtos novos</span>
            <span className="font-medium tabular-nums">{formatCaixaR(resumo.subtotalProdutos)}</span>
          </div>
        )}
        {resumo.creditoDevolucao > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Crédito do retorno</span>
            <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
              − {formatCaixaR(resumo.creditoDevolucao)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-amber-200/50 dark:border-amber-800/30 gap-3">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Diferença paga no caixa</p>
            <FormaPagamentoBadges pagamentos={venda.pagamentos} size="xs" className="mt-1" />
          </div>
          <CaixaValorDisplay valor={resumo.entradaCaixa} tone="warning" size="md" />
        </div>
      </div>
    </div>
  );
}
