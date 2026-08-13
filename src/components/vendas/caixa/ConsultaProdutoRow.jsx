import React from 'react';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { formatCommercialQuantity } from '@/lib/productUnits';

function ConsultaQtdUnCol({ qtd, unidade, accent = 'success' }) {
  const dotClass =
    accent === 'muted' ? p38Accent.muted.dot
      : accent === 'info' ? p38Accent.info.dot
        : p38Table.accentDot;
  return (
    <div className="relative w-[3.25rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1.5 py-2.5 text-right">
      <span className={`absolute left-0 top-3 ${dotClass}`} aria-hidden />
      <p className="text-base font-din-1451 tabular-nums text-foreground leading-none">
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={`${caixaTypo.labelSm} mt-1.5 leading-none truncate`}>
        {(unidade || 'UN').toUpperCase()}
      </p>
    </div>
  );
}

function resolvePrecoUnitarioEfetivo({ quantidade, total, precoLista, descontoUnitario }) {
  const qtd = Number(quantidade) || 0;
  const totalNum = Number(total);
  if (qtd > 0 && Number.isFinite(totalNum)) {
    return roundToTwoDecimals(Math.abs(totalNum) / qtd);
  }
  const preco = Number(precoLista) || 0;
  const desconto = Number(descontoUnitario) || 0;
  return roundToTwoDecimals(preco - desconto);
}

export function ConsultaProdutoRow({
  quantidade,
  unidade,
  nome,
  valorTotal,
  precoLista,
  precoUnitario,
  descontoUnitario,
  striped = false,
  accent = 'success',
  hideValor = false,
  nomePrefix = null,
  nomeSuffix = null,
  signedValor,
}) {
  const precoListaEff = precoLista ?? precoUnitario;
  const borderClass =
    accent === 'muted' ? p38Accent.muted.border
      : accent === 'info' ? p38Accent.info.border
        : p38Accent.success.border;
  const valorNum = Number(valorTotal) || 0;
  const precoEfetivo = resolvePrecoUnitarioEfetivo({
    quantidade,
    total: valorNum,
    precoLista: precoListaEff,
    descontoUnitario,
  });
  const precoTabela = Number(precoListaEff) || 0;
  const temDesconto = precoTabela > precoEfetivo + 0.009;
  const valorTone = valorNum < 0
    ? 'danger'
    : accent === 'muted'
      ? 'neutral'
      : accent === 'info'
        ? 'info'
        : 'success';
  const showSigned = signedValor ?? accent !== 'muted';

  return (
    <div
      className={cn(
        p38Table.mobileLineThin,
        borderClass,
        'flex min-w-0',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} />
      <div className="flex-1 min-w-0 py-2 pr-3 pl-2">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <p className={cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug flex-1 min-w-0')}>
            {nomePrefix}
            {nome}
          </p>
          {nomeSuffix ? <div className="shrink-0 pt-0.5">{nomeSuffix}</div> : null}
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0`}>
            {temDesconto && (
              <span className="line-through text-muted-foreground/70 mr-1.5">
                {formatCaixaR(precoTabela)}
              </span>
            )}
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          {!hideValor && (
            <div className="shrink-0">
              <CaixaValorDisplay valor={valorNum} tone={valorTone} signed={showSigned} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
