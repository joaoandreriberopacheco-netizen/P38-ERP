import React, { useCallback, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/utils';
import { montarNomePortalSku, montarSubtituloPortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';
import {
  SUPPLY_CURSOR,
  supplyCursorIndent,
  NODE_KIND_LABEL,
} from '@/lib/smartSupply/smartSupplyCursorTableTheme';
import { massaLabel, resolveAggregateLed, SUPPLY_LED } from '@/lib/smartSupply/supplyDrilldownLed';

function Num({ value, negativo }) {
  if (!value || value === '—') {
    return <span className="text-muted-foreground/40 tabular-nums">—</span>;
  }
  return (
    <span className={cn('tabular-nums text-sm', negativo && 'text-red-500 dark:text-red-400 font-medium')}>
      {value}
    </span>
  );
}

function SupplyDot({ tone = 'off', pulse = false }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full shrink-0',
        SUPPLY_LED[tone] || SUPPLY_LED.alerta,
        pulse && tone !== 'off' && 'animate-pulse',
      )}
      aria-hidden
    />
  );
}

function hasChildren(node) {
  if (node.kind === 'esquadra') return (node.line?.skus?.length || 0) > 0;
  if (node.kind === 'sku') return false;
  return (node.children?.length || 0) > 0 || (node.skuNodes?.length || 0) > 0;
}

function childNodes(node) {
  if (node.kind === 'esquadra') {
    return (node.line?.skus || []).map((s) => ({
      kind: 'sku',
      key: `sku-${s.produto?.id || s.produto?.codigo_interno}`,
      label: montarNomePortalSku(s),
      sku: s,
      line: node.line,
    }));
  }
  if (node.skuNodes?.length) return node.skuNodes;
  return node.children || [];
}

function DrilldownRow({ node, depth, openSet, toggleOpen }) {
  const expandable = hasChildren(node);
  const open = openSet.has(node.key);
  const tone = resolveAggregateLed(node);
  const indent = supplyCursorIndent(depth);
  const metrics = node.metrics || node.line?.metrics;
  const isStrong = node.kind === 'categoria' || node.kind === 'linha';
  const skuCount = node.resumo?.sku_total ?? node.line?.sku_count ?? (node.kind === 'sku' ? 1 : '');

  return (
    <>
      <TableRow className={cn(SUPPLY_CURSOR.row, 'h-9 border-l-2', tone === 'off' ? 'border-l-transparent' : 'border-l-[#e8b824]/70')}>
        <TableCell className={cn(SUPPLY_CURSOR.cell, 'w-8 px-1')}>
          {expandable ? (
            <button
              type="button"
              onClick={() => toggleOpen(node.key)}
              className={SUPPLY_CURSOR.toggleBtn}
              aria-expanded={open}
              style={{ marginLeft: indent }}
            >
              <ChevronRight className={cn(SUPPLY_CURSOR.chevron, open && 'rotate-90')} />
            </button>
          ) : (
            <span className="inline-block w-6" style={{ marginLeft: indent }} />
          )}
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, 'w-6 px-1')}>
          <SupplyDot tone={tone} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, 'min-w-0 max-w-0')}>
          <div className="min-w-0" style={{ paddingLeft: indent ? 0 : 4 }}>
            <span className={cn(isStrong ? SUPPLY_CURSOR.labelStrong : SUPPLY_CURSOR.label, 'block truncate')}>
              {node.label}
            </span>
            {node.kind === 'sku' && node.sku && (
              <span className={cn(SUPPLY_CURSOR.labelMuted, 'block truncate tabular-nums')}>
                {montarSubtituloPortalSku(node.sku)}
              </span>
            )}
            {node.kind !== 'sku' && node.kind !== 'esquadra' && NODE_KIND_LABEL[node.kind] && (
              <span className={cn(SUPPLY_CURSOR.labelMuted, 'block truncate text-[10px] uppercase tracking-wide')}>
                {NODE_KIND_LABEL[node.kind]}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, SUPPLY_CURSOR.cellNumeric, 'w-[52px]')}>
          {skuCount !== '' ? skuCount : ''}
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, SUPPLY_CURSOR.cellNumeric, 'w-[100px]')}>
          <Num value={metrics?.estoque_label || node.sku?.estoque_label} negativo={node.sku && (node.sku.estoque_vitrine ?? 0) <= 0} />
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, SUPPLY_CURSOR.cellNumeric, 'w-[88px]')}>
          <Num value={metrics?.media30_label || node.sku?.media30_label} />
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, SUPPLY_CURSOR.cellNumeric, 'w-[88px]')}>
          <Num
            value={metrics?.ponto_futuro_label || node.sku?.ponto_futuro_label}
            negativo={metrics?.ponto_negativo || node.sku?.ponto_negativo}
          />
        </TableCell>
        <TableCell className={cn(SUPPLY_CURSOR.cell, SUPPLY_CURSOR.cellNumeric, 'w-[56px] text-xs')}>
          {massaLabel(node)}
        </TableCell>
      </TableRow>
      {open &&
        childNodes(node).map((child) => (
          <DrilldownRow
            key={child.key}
            node={child}
            depth={depth + 1}
            openSet={openSet}
            toggleOpen={toggleOpen}
          />
        ))}
    </>
  );
}

function collectDefaultOpen(nodes, acc = new Set()) {
  for (const node of nodes || []) {
    if (node.alerta || node.openDefault) acc.add(node.key);
    if (node.children?.length) collectDefaultOpen(node.children, acc);
  }
  return acc;
}

export default function SmartSupplyDrilldownTable({ roots, somenteAlerta }) {
  const filteredRoots = useMemo(() => {
    if (!somenteAlerta) return roots || [];
    const filterNode = (node) => {
      const kids = (node.children || []).map(filterNode).filter(Boolean);
      if (node.alerta || kids.length) return { ...node, children: kids };
      return null;
    };
    return (roots || []).map(filterNode).filter(Boolean);
  }, [roots, somenteAlerta]);

  const [openSet, setOpenSet] = useState(() => collectDefaultOpen(filteredRoots));

  const toggleOpen = useCallback((key) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!filteredRoots.length) {
    return (
      <div className="py-12 text-center border-b border-border/25 dark:border-white/[0.06]">
        <p className="text-sm text-muted-foreground">Nenhum alerta no funil.</p>
      </div>
    );
  }

  return (
    <div className={SUPPLY_CURSOR.shell}>
      <Table className={SUPPLY_CURSOR.table}>
        <TableHeader>
          <TableRow className={SUPPLY_CURSOR.headerRow}>
            <TableHead className={cn(SUPPLY_CURSOR.head, 'w-8')} />
            <TableHead className={cn(SUPPLY_CURSOR.head, 'w-6')} />
            <TableHead className={SUPPLY_CURSOR.head}>Funil / unidade</TableHead>
            <TableHead className={cn(SUPPLY_CURSOR.head, SUPPLY_CURSOR.headRight, 'w-[52px]')}>SKUs</TableHead>
            <TableHead className={cn(SUPPLY_CURSOR.head, SUPPLY_CURSOR.headRight, 'w-[100px]')}>Estoque</TableHead>
            <TableHead className={cn(SUPPLY_CURSOR.head, SUPPLY_CURSOR.headRight, 'w-[88px]')}>Média 30d</TableHead>
            <TableHead className={cn(SUPPLY_CURSOR.head, SUPPLY_CURSOR.headRight, 'w-[88px]')}>P. futuro</TableHead>
            <TableHead className={cn(SUPPLY_CURSOR.head, SUPPLY_CURSOR.headRight, 'w-[56px]')}>Massa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRoots.map((node) => (
            <DrilldownRow key={node.key} node={node} depth={0} openSet={openSet} toggleOpen={toggleOpen} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
