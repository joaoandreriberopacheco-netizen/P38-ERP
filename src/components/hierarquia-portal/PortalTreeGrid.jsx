import React, { useMemo, useState } from 'react';
import { FolderTree, Package, Layers, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { P38TableShell, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LevelControl, TREE_GRID_EXPAND_ALL_LEVEL } from '@/components/produtos/treegrid/LevelControl';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { filterTree, flattenPortalTreeGrid } from '@/lib/hierarquiaPortal/flattenPortalTreeGrid';

const TIPO_BADGE = {
  solo: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  mix: 'bg-blue-200/80 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  portfolio: 'bg-violet-200/80 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
};

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

const KIND_ICON = {
  categoria: FolderTree,
  linha: Package,
  produto_compra: Layers,
  sku: Box,
};

const KIND_LABEL = {
  categoria: 'Cat.',
  linha: 'LINHA',
  produto_compra: 'PC',
  sku: 'SKU',
};

function TipoBadge({ tipo }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal uppercase tracking-wide', TIPO_BADGE[tipo] || '')}>
      {TIPO_LABEL[tipo] || tipo}
    </Badge>
  );
}

function rowTone(kind) {
  if (kind === 'categoria') return 'bg-muted/40 dark:bg-[#343a42] font-semibold';
  if (kind === 'linha') return 'bg-background dark:bg-[#2f343c]';
  if (kind === 'produto_compra') return 'bg-background/90 dark:bg-[#2a2e35]';
  return 'text-muted-foreground';
}

export default function PortalTreeGrid({ tree, filtroLinha, filtroTipos, search }) {
  const [maxLevel, setMaxLevel] = useState(TREE_GRID_EXPAND_ALL_LEVEL);

  const filtered = useMemo(
    () => filterTree(tree, filtroLinha, filtroTipos, search),
    [tree, filtroLinha, filtroTipos, search],
  );

  const rows = useMemo(
    () => flattenPortalTreeGrid(filtered, maxLevel),
    [filtered, maxLevel],
  );

  if (!filtered.length) {
    return (
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center">
        <p className="text-sm text-muted-foreground">Nada encontrado com estes filtros.</p>
        <p className="text-xs text-muted-foreground mt-1">Experimente activar Solo, Mix e Portfolio ou limpar a busca.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
          TreeGrid — Categoria → LINHA → Produto compra → SKU
        </p>
        <LevelControl level={maxLevel} onChange={setMaxLevel} />
      </div>

      <P38TableShell
        className={cn(
          'max-h-[min(72vh,920px)] border-border/40 dark:border-white/10',
          'bg-background dark:bg-[#2a2e35]',
          'shadow-sm dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
        )}
      >
        <Table className="table-auto min-w-[720px]">
          <TableHeader
            className={cn(
              p38Table.headerSolid,
              'bg-muted dark:bg-[#383e47]',
              'border-b-2 border-[#4a5240] dark:border-[#a4ce33]',
            )}
          >
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className={cn(p38Table.head, 'w-[52px] sticky left-0 z-20 bg-muted dark:bg-[#383e47]')}>
                Nível
              </TableHead>
              <TableHead className={cn(p38Table.head, 'min-w-[280px] sticky left-[52px] z-20 bg-muted dark:bg-[#383e47] border-r border-border/40 dark:border-white/10')}>
                Nome
              </TableHead>
              <TableHead className={cn(p38Table.head, 'w-[96px]')}>Tipo</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[64px]')}>SKUs</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[120px]')}>Estoque vitrine</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const Icon = KIND_ICON[row.kind];
              const pad = 6 + row.depth * 18;
              return (
                <TableRow key={row.id} className={cn(p38Table.row, rowTone(row.kind), 'h-8')}>
                  <TableCell className={cn(p38Table.cell, 'py-1 sticky left-0 z-10 bg-inherit')}>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {KIND_LABEL[row.kind]}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      p38Table.cell,
                      'py-1 sticky left-[52px] z-10 bg-inherit border-r border-border/30 dark:border-white/5 min-w-[280px]',
                    )}
                  >
                    <div style={{ paddingLeft: pad }} className="min-w-0">
                      <p className={cn('truncate text-sm leading-tight', row.kind === 'sku' ? 'font-normal' : 'font-medium')}>
                        {row.label}
                      </p>
                      {row.subtitle && (
                        <p className="truncate text-[10px] text-muted-foreground leading-tight">{row.subtitle}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, 'py-1')}>
                    <TipoBadge tipo={row.tipo} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1 tabular-nums text-sm')}>
                    {row.skuCount != null ? row.skuCount : '—'}
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1 tabular-nums text-sm whitespace-nowrap')}>
                    {row.estoque?.mixed ? (
                      <span className="text-amber-700 dark:text-amber-300 text-xs">{row.estoque.label}</span>
                    ) : (
                      row.estoque?.label || '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </P38TableShell>
    </div>
  );
}
