/**
 * Superfícies mobile P38 — extraídas do Relatório de Margem.
 * KPI grid, painel com barra verde, busca e labels micro.
 */
import React from 'react';
import { cn } from '@/components/utils';
import {
  p38Table,
  MARGIN_TABLE_PANEL,
  MARGIN_TABLE_BORDER,
  MARGIN_BODY_TEXT,
  MARGIN_TABLE_MICRO,
  MARGIN_ACCENT_VALUE,
} from '@/lib/p38TableSurfaces';
import { P38_LIGHT_CARD, P38_LIGHT_FIELD } from '@/lib/p38LightTheme';

/** Tokens de classe (sem JSX) */
export const p38Mobile = {
  searchInput: cn(P38_LIGHT_FIELD, 'h-11 dark:bg-[#26262e] dark:shadow-none focus-visible:ring-1'),
  filterChip:
    'px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-card shadow-sm text-muted-foreground dark:bg-[#26262e]',
  filterChipActive:
    'px-3 py-2 rounded-lg text-xs font-medium bg-[#e8b824]/14 text-[#a8942e] border-0 shadow-sm',
  panel: `${MARGIN_TABLE_PANEL} border-0 shadow-sm rounded-lg overflow-hidden`,
  panelAccentBar: p38Table.panelAccentBar,
  kpiGrid: 'grid grid-cols-2 gap-x-3 gap-y-2',
  kpiLabel: `${MARGIN_TABLE_MICRO} uppercase tracking-wide text-muted-foreground leading-none`,
  kpiValue: `${MARGIN_BODY_TEXT} tabular-nums mt-1 truncate`,
  kpiValueAccent: `${MARGIN_BODY_TEXT} tabular-nums mt-1 truncate ${MARGIN_ACCENT_VALUE}`,
  detailPanel: cn(P38_LIGHT_CARD, 'rounded-lg p-3 dark:bg-card/30'),
  detailLabel: 'text-xs uppercase tracking-wide text-muted-foreground leading-none mb-2',
};

/** Painel mobile com barra verde lateral (como Margem header). */
export function P38MobilePanelHeader({ title, subtitle, detail, footer, className }) {
  return (
    <div className={cn('relative', p38Mobile.panel, className)}>
      <div className={cn('absolute left-3 top-3 bottom-3 w-[3px] rounded-sm', p38Mobile.panelAccentBar)} aria-hidden />
      <div className="pl-7 pr-3 py-3 min-w-0">
        {title ? (
          <p className={cn(MARGIN_BODY_TEXT, 'font-semibold tracking-wide uppercase leading-tight')}>{title}</p>
        ) : null}
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{subtitle}</p>
        ) : null}
        {detail ? <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-3 leading-snug">{detail}</p> : null}
        {footer ? <p className="text-xs text-muted-foreground/70 mt-2 text-right tabular-nums">{footer}</p> : null}
      </div>
    </div>
  );
}

/** Grelha 2×N de KPIs compactos (Receita, Lucro, etc.). */
export function P38MobileKpiGrid({ items, className, columns = 2 }) {
  const gridClass = columns === 4 ? 'grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2' : p38Mobile.kpiGrid;

  return (
    <div className={cn(gridClass, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className={p38Mobile.kpiLabel}>{item.label}</p>
          <p className={item.accent ? p38Mobile.kpiValueAccent : cn(p38Mobile.kpiValue, 'text-foreground')}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Linha label + valor dentro de painel de detalhe (saldos, recebimentos). */
export function P38MobileDetailRows({ rows, className }) {
  return (
    <div className={cn('space-y-2 text-sm font-din-1451', className)}>
      {rows.map((row) => (
        <div key={row.label} className={cn('flex justify-between gap-2', row.highlight && 'pt-2 border-t border-border/15 font-bold')}>
          <span className="text-muted-foreground">{row.label}</span>
          <span className={cn('tabular-nums shrink-0', row.danger && 'text-red-600 dark:text-red-400', row.accent && MARGIN_ACCENT_VALUE, !row.danger && !row.accent && 'text-foreground font-semibold')}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
