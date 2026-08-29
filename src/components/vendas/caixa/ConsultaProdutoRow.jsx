import React from 'react';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaAccentDot, caixaAccentBorder, caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { formatCommercialQuantity } from '@/lib/productUnits';

function resolveConsultaAccentDot(accent) {
  if (accent === 'aprovado') return p38Accent.aprovado.dot;
  if (accent === 'muted') return p38Accent.muted.dot;
  if (accent === 'citrus') return p38Accent.citrus.dot;
  if (accent === 'info') return p38Accent.info.dot;
  if (accent === 'warning') return p38Accent.warning.dot;
  if (accent === 'danger') return p38Accent.danger.dot;
  if (accent === 'success') return caixaAccentDot;
  return p38Table.accentDot;
}

function resolveConsultaAccentBorder(accent) {
  if (accent === 'aprovado') return p38Accent.aprovado.border;
  if (accent === 'muted') return p38Accent.muted.border;
  if (accent === 'citrus') return p38Accent.citrus.border;
  if (accent === 'info') return p38Accent.info.border;
  if (accent === 'warning') return p38Accent.warning.border;
  if (accent === 'danger') return p38Accent.danger.border;
  return caixaAccentBorder;
}

function ConsultaQtdUnCol({ qtd, unidade, accent = 'success', compact = false, exportPdf = false }) {
  const dotClass = resolveConsultaAccentDot(accent);
  return (
    <div className={cn(
      'relative flex-shrink-0 border-r border-border/40 dark:border-white/10 text-right',
      exportPdf ? 'w-[3.75rem] min-w-[3.75rem] py-3 pl-1 pr-1.5' : compact ? 'w-[2.5rem] pr-1 py-2.5' : 'w-[3.25rem] pr-1.5 py-2.5',
    )}
    >
      <span className={cn('absolute left-0.5 top-3.5 h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
      <p className={cn(
        'font-din-1451 tabular-nums text-foreground',
        exportPdf ? 'text-xs font-light leading-snug' : compact ? 'text-xs font-light leading-none' : 'text-base leading-none',
      )}
      >
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={cn(
        caixaTypo.labelSm,
        'truncate',
        exportPdf ? 'mt-1 text-[10px] font-light leading-snug' : compact ? 'mt-1 text-[10px] font-light leading-none' : 'mt-1.5 leading-none',
      )}
      >
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
  valorTone: valorToneProp,
  compact = false,
  detalheCustos = null,
  exportPdf = false,
}) {
  const precoListaEff = precoLista ?? precoUnitario;
  const borderClass = resolveConsultaAccentBorder(accent);
  const valorNum = Number(valorTotal) || 0;
  const precoEfetivo = resolvePrecoUnitarioEfetivo({
    quantidade,
    total: valorNum,
    precoLista: precoListaEff,
    descontoUnitario,
  });
  const precoTabela = Number(precoListaEff) || 0;
  const temDesconto = precoTabela > precoEfetivo + 0.009;
  const valorTone = valorToneProp ?? (valorNum < 0
    ? 'danger'
    : accent === 'muted'
      ? 'neutral'
      : accent === 'citrus' || accent === 'info'
        ? 'info'
        : accent === 'aprovado'
          ? 'success'
          : 'success');
  const showSigned = signedValor ?? accent !== 'muted';

  const rowShell = compact
    ? exportPdf
      ? 'border-b border-border/50 dark:border-white/10 border-l py-3.5 pr-2 pl-2 min-w-0 bg-background font-din-1451 font-light'
      : 'border-b border-border/50 dark:border-white/10 border-l py-3 pr-2 pl-3 min-w-0 bg-background font-din-1451 font-light'
    : p38Table.mobileLineThin;
  const titleClass = compact
    ? exportPdf
      ? 'font-din-1451 font-light text-sm leading-snug break-words flex-1 min-w-0 normal-case'
      : 'font-din-1451 font-light text-sm leading-snug line-clamp-2 break-words flex-1 min-w-0 normal-case'
    : cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug flex-1 min-w-0');

  return (
    <div
      className={cn(
        rowShell,
        borderClass,
        'flex min-w-0 w-full max-w-full',
        exportPdf ? 'overflow-visible' : 'overflow-hidden',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} compact={compact} exportPdf={exportPdf} />
      <div className={cn(
        'flex-1 min-w-0',
        exportPdf ? 'overflow-visible py-2.5 pr-1 pl-1.5' : 'overflow-hidden',
        !exportPdf && (compact ? 'py-2 pr-1 pl-1.5' : 'py-2 pr-3 pl-2'),
      )}>
        <div className="flex items-start justify-between gap-2 min-w-0">
          <p className={titleClass}>
            {nomePrefix}
            {nome}
          </p>
          {nomeSuffix ? <div className="shrink-0 pt-0.5">{nomeSuffix}</div> : null}
        </div>
        <div className={cn(
          'mt-1 min-w-0',
          compact ? 'flex flex-col gap-0.5' : 'flex items-baseline justify-between gap-3',
        )}
        >
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0 truncate ${compact ? 'font-light' : ''}`}>
            {temDesconto && (
              <span className="line-through text-muted-foreground/70 mr-1.5">
                {formatCaixaR(precoTabela)}
              </span>
            )}
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          {!hideValor && (
            <div className={compact ? 'shrink-0 self-end' : 'shrink-0'}>
              <CaixaValorDisplay valor={valorNum} tone={valorTone} signed={showSigned} size="sm" />
            </div>
          )}
        </div>
        {detalheCustos ? (
          <div className={cn('mt-1.5 space-y-0.5 min-w-0', caixaTypo.meta, 'font-light normal-case tabular-nums text-muted-foreground')}>
            <p>{detalheCustos.linha1}</p>
            <p>{detalheCustos.linha2}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
