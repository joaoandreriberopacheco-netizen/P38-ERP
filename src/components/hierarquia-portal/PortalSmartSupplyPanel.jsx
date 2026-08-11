import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  P38TableShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';

const TIPO_BADGE = {
  solo: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  mix: 'bg-blue-200/80 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  portfolio: 'bg-violet-200/80 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
};

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

function TipoBadge({ tipo }) {
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal uppercase tracking-wide', TIPO_BADGE[tipo] || '')}>
      {TIPO_LABEL[tipo] || tipo}
    </Badge>
  );
}

function PfutCell({ value }) {
  const neg = value < 0;
  return (
    <span
      className={cn(
        'tabular-nums text-sm font-medium',
        neg ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

function SupplyRow({ line, open, onToggle }) {
  return (
    <>
      <TableRow
        className={cn(
          p38Table.row,
          'bg-background dark:bg-[#2f343c]/80',
          line.alerta && 'border-l-2 border-l-amber-500 dark:border-l-amber-400',
        )}
      >
        <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40"
            aria-expanded={open}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
          </button>
        </TableCell>
        <TableCell className={cn(p38Table.cell, 'min-w-0')}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-medium">{line.produto_compra_nome}</span>
            {line.alerta && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Alerta" />
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
            {line.categoria} · {line.linha_nome}
          </p>
        </TableCell>
        <TableCell className={cn(p38Table.cell, 'w-[100px]')}>
          <TipoBadge tipo={line.linha_tipo} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[72px]')}>
          <span className="tabular-nums text-sm">{line.sku_count}</span>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[120px]')}>
          <span className="tabular-nums text-sm whitespace-nowrap">{line.estoque_label || line.estoque_total}</span>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[72px]')}>
          <PfutCell value={line.pfut_simulado} />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/20 dark:bg-[#2a2e35] hover:bg-muted/20 dark:hover:bg-[#2a2e35]">
          <TableCell colSpan={6} className={cn(p38Table.cell, 'py-2')}>
            <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1 uppercase tracking-wide">
              <Layers className="h-3 w-3" />
              Detalhe por SKU (preview — não gera pedido)
            </p>
            <ul className="space-y-1 pl-1">
              {line.skus.map((s) => (
                <li
                  key={s.produto.id}
                  className="flex justify-between gap-3 text-xs text-muted-foreground border-b border-border/30 dark:border-white/5 py-1 last:border-0"
                >
                  <span className="truncate">{s.produto.nome}</span>
                  <span className="shrink-0 tabular-nums whitespace-nowrap">
                    {s.estoque_label || s.estoque}
                    {s.eixo_b ? ` · ${s.eixo_b}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function SupplyLine({ line }) {
  const [open, setOpen] = useState(false);
  return <SupplyRow line={line} open={open} onToggle={() => setOpen((v) => !v)} />;
}

export default function PortalSmartSupplyPanel({ lines, somenteAlerta }) {
  const visible = somenteAlerta ? lines.filter((l) => l.alerta) : lines;

  if (!visible.length) {
    return (
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {somenteAlerta ? 'Nenhuma esquadra em alerta com estes filtros.' : 'Sem linhas para exibir.'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Experimente activar Solo, Mix e Portfolio ou limpar a busca.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
          Linhas de reposição por produto compra · P.FUT simulado
        </p>
        <p className="text-[10px] text-muted-foreground">
          {visible.length} esquadra(s){somenteAlerta ? ' em alerta' : ''}
        </p>
      </div>

      <P38TableShell
        className={cn(
          'border-border/40 dark:border-white/10',
          'bg-background dark:bg-[#2a2e35]',
          'shadow-sm dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
        )}
      >
        <Table>
          <TableHeader
            className={cn(
              p38Table.headerSolid,
              'bg-muted dark:bg-[#383e47]',
              'border-b-2 border-[#4a5240] dark:border-[#a4ce33]',
            )}
          >
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className={cn(p38Table.head, 'w-8')} />
              <TableHead className={p38Table.head}>Produto compra</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[100px]')}>Tipo</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>SKUs</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[120px]')}>Estoque vitrine</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>P.FUT*</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((line) => (
              <SupplyLine key={line.key} line={line} />
            ))}
          </TableBody>
        </Table>
        <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/40 dark:border-white/10">
          * P.FUT simulado (portal) — na SMART SUPPLY real usa vendas 90d e lead time.
        </p>
      </P38TableShell>
    </div>
  );
}
