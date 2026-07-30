import React from 'react';
import { cn } from '@/lib/utils';
import { P38_ACCENT, P38_KPI_SHELL } from './financeiroP38';

export const formatKpiValor = (v) =>
  `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

/** layout: inline = desktop na faixa do header; stack = mobile (lista vertical) */
export function FinanceiroKpiItem({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
  valueClass = 'text-foreground',
  className,
  layout = 'inline',
}) {
  if (layout === 'stack') {
    return (
      <div className={cn('flex min-w-0 items-center justify-between gap-4 py-2', className)}>
        <span className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-wide text-foreground/60">
          {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconClass)} />}
          <span className="truncate">{label}</span>
        </span>
        <div className="shrink-0 text-right">
          <span className={cn('text-base font-semibold tabular-nums leading-tight', valueClass)}>{value}</span>
          {sub && <p className="text-[11px] text-foreground/45">{sub}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0', className)}>
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[9px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className={cn('h-3 w-3 shrink-0', iconClass)} />}
        {label}
      </span>
      <span className={cn('text-[13px] font-semibold leading-none tabular-nums md:text-sm', valueClass)}>{value}</span>
      {sub && <span className="whitespace-nowrap text-[9px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function FinanceiroKpiSaldo({ label = 'Saldo', value, percent, positive, className, layout = 'inline' }) {
  if (layout === 'stack') {
    return (
      <div className={cn('space-y-2 py-2', className)}>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <span className="text-[11px] uppercase tracking-wide text-foreground/60">{label}</span>
          <span className={cn('text-base font-semibold tabular-nums', positive ? P38_ACCENT : 'text-foreground/80')}>
            {value}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary/80 dark:bg-[#383e47]">
            <div
              className="h-full rounded-full bg-[#4a5240] transition-all dark:bg-[#a4ce33]"
              style={{ width: `${Math.min(Number(percent), 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-foreground/50">{percent}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
      <span className="shrink-0 whitespace-nowrap text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('text-[13px] font-semibold leading-none tabular-nums md:text-sm', positive ? P38_ACCENT : 'text-foreground/80')}>
        {value}
      </span>
      <div className="flex min-w-[3.5rem] items-center gap-1">
        <div className="h-1 w-10 overflow-hidden rounded-full bg-secondary/80 dark:bg-[#383e47] sm:w-12">
          <div
            className="h-full rounded-full bg-[#4a5240] transition-all dark:bg-[#a4ce33]"
            style={{ width: `${Math.min(Number(percent), 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{percent}%</span>
      </div>
    </div>
  );
}

export function FinanceiroKpiStrip({ children, footer, layout = 'card' }) {
  if (layout === 'stack') {
    return (
      <div className={P38_KPI_SHELL}>
        <div className="divide-y divide-border/30 dark:divide-white/10">{children}</div>
        {footer}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div className="min-w-0 py-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-4">{children}</div>
        {footer}
      </div>
    );
  }

  return (
    <div className={cn(P38_KPI_SHELL, 'space-y-1.5')}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 md:flex-nowrap md:justify-between md:gap-x-4">
        {children}
      </div>
      {footer}
    </div>
  );
}
