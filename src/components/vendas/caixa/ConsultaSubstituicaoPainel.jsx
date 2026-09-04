import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { formatSubstituicaoQuantidade } from '@/lib/consultaVendaPosMovimentacao';

function LinhaSubstituicao({ tipo, item }) {
  const entrou = tipo === 'entrou';
  const Icon = entrou ? ArrowUp : ArrowDown;
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-4 py-2.5 text-sm',
        entrou
          ? 'bg-emerald-50/80 dark:bg-emerald-950/20'
          : 'bg-red-50/70 dark:bg-red-950/15'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          entrou
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground leading-snug">
          <span className="tabular-nums">
            {formatSubstituicaoQuantidade(item.quantidade, item.unidade_medida)}
          </span>{' '}
          {item.produto_nome}
        </p>
        {item.devolucaoNumero ? (
          <p className={`${caixaTypo.meta} mt-0.5 font-mono`}>{item.devolucaoNumero}</p>
        ) : null}
      </div>
      <CaixaValorDisplay
        valor={entrou ? item.total : -Math.abs(Number(item.total) || 0)}
        tone={entrou ? 'success' : 'danger'}
        signed
        size="sm"
      />
    </div>
  );
}

export default function ConsultaSubstituicaoPainel({ substituicoes = [], saldoOperacao = 0 }) {
  const entrou = substituicoes.filter((item) => item.tipo === 'entrou');
  const saiu = substituicoes.filter((item) => item.tipo === 'saiu');
  if (!entrou.length && !saiu.length) return null;

  const saldo = Number(saldoOperacao) || 0;

  return (
    <div className="border-t border-dashed border-border/50 dark:border-white/10">
      <div className="px-4 py-2">
        <p className={`${caixaTypo.labelSm}`}>Substituição</p>
      </div>
      <div className="divide-y divide-border/30 dark:divide-white/5">
        {entrou.map((item, idx) => (
          <LinhaSubstituicao key={`in-${item.produto_id}-${idx}`} tipo="entrou" item={item} />
        ))}
        {saiu.map((item, idx) => (
          <LinhaSubstituicao key={`out-${item.produto_id}-${idx}`} tipo="saiu" item={item} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3 dark:border-white/10">
        <span className={`${caixaTypo.meta}`}>Saldo da operação</span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            saldo > 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : saldo < 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-foreground'
          )}
        >
          {saldo > 0 ? `Vale ${formatCaixaR(saldo)}` : saldo < 0 ? `A pagar ${formatCaixaR(Math.abs(saldo))}` : formatCaixaR(0)}
        </span>
      </div>
    </div>
  );
}
