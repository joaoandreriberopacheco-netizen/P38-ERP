import React, { useCallback, useMemo, useState } from 'react';
import { ChevronRight, FolderTree, Package, Layers, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  montarNomePortalSku,
  montarSubtituloPortalSku,
} from '@/lib/hierarquiaPortal/montarNomePortalSku';

const TIPO_BADGE = {
  solo: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  mix: 'bg-blue-200/80 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  portfolio: 'bg-violet-200/80 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
};

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

const NIVEL_META = {
  categoria: { label: 'Categoria', Icon: FolderTree, tone: 'text-foreground font-semibold' },
  linha: { label: 'LINHA', Icon: Package, tone: 'text-foreground font-medium' },
  produto_compra: { label: 'Prod. compra', Icon: Layers, tone: 'text-foreground' },
  sku: { label: 'SKU', Icon: Box, tone: 'text-muted-foreground' },
};

function TipoBadge({ tipo }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal uppercase tracking-wide', TIPO_BADGE[tipo] || '')}>
      {TIPO_LABEL[tipo] || tipo}
    </Badge>
  );
}

function filterTree(tree, filtroLinha, filtroTipos, search) {
  const q = search.trim().toLowerCase();
  const tipos = filtroTipos?.size ? filtroTipos : new Set(['solo', 'mix', 'portfolio']);

  return tree
    .map((cat) => ({
      ...cat,
      linhas: cat.linhas
        .filter((lin) => (!filtroLinha || lin.linha_codigo === filtroLinha) && tipos.has(lin.linha_tipo))
        .map((lin) => {
          if (!q) return lin;
          const matchLin = lin.linha_nome.toLowerCase().includes(q);
          const pcs = lin.pcs.filter(
            (pc) =>
              pc.produto_compra_nome.toLowerCase().includes(q) ||
              pc.skus.some((s) => s.produto.nome?.toLowerCase().includes(q)),
          );
          const solos = lin.solos.filter(
            (s) => s.produto.nome?.toLowerCase().includes(q) || matchLin,
          );
          if (!matchLin && !pcs.length && !solos.length) return null;
          return { ...lin, pcs: matchLin ? lin.pcs : pcs, solos: matchLin ? lin.solos : solos };
        })
        .filter(Boolean),
    }))
    .filter((cat) => cat.linhas.length > 0);
}

function collectExpandKeys(tree) {
  const keys = { cats: [], linhas: [], pcs: [] };
  for (const cat of tree) {
    keys.cats.push(`cat:${cat.nome}`);
    for (const lin of cat.linhas) {
      keys.linhas.push(`lin:${cat.nome}::${lin.linha_codigo}`);
      if (lin.linha_tipo === 'solo') {
        keys.pcs.push(`pc:${cat.nome}::${lin.linha_codigo}::solo`);
      } else {
        for (const pc of lin.pcs) {
          keys.pcs.push(`pc:${cat.nome}::${lin.linha_codigo}::${pc.produto_compra_codigo}`);
        }
      }
    }
  }
  return keys;
}

function HierarchyRow({
  rowKey,
  nivel,
  nome,
  tipo,
  skuCount,
  estoque,
  depth,
  open,
  hasChildren,
  onToggle,
  subtitle,
}) {
  const meta = NIVEL_META[nivel];
  const Icon = meta.Icon;
  const pad = 8 + depth * 20;

  return (
    <TableRow
      className={cn(
        p38Table.row,
        nivel === 'categoria' && 'bg-muted/30 dark:bg-[#343a42]',
        nivel === 'linha' && 'bg-background dark:bg-[#2f343c]/80',
        nivel === 'produto_compra' && 'bg-background/80 dark:bg-[#2a2e35]',
        nivel === 'sku' && 'hover:bg-secondary/20 dark:hover:bg-white/[0.03]',
      )}
    >
      <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40"
            aria-expanded={open}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="inline-block w-7" />
        )}
      </TableCell>
      <TableCell className={cn(p38Table.cell, 'w-[110px]')}>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          {meta.label}
        </span>
      </TableCell>
      <TableCell className={cn(p38Table.cell, 'min-w-0')}>
        <div style={{ paddingLeft: pad }} className="min-w-0">
          <p className={cn('truncate text-sm', meta.tone)}>{nome}</p>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </TableCell>
      <TableCell className={cn(p38Table.cell, 'w-[100px]')}>
        <TipoBadge tipo={tipo} />
      </TableCell>
      <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[72px]')}>
        {skuCount != null ? (
          <span className="tabular-nums text-sm">{skuCount}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
        {estoque != null ? (
          <span className="tabular-nums text-sm">{estoque}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function PortalCadastroPanel({ tree, filtroLinha, filtroTipos, search }) {
  const filtered = useMemo(
    () => filterTree(tree, filtroLinha, filtroTipos, search),
    [tree, filtroLinha, filtroTipos, search],
  );

  const allKeys = useMemo(() => collectExpandKeys(filtered), [filtered]);

  const [collapsedCats, setCollapsedCats] = useState(() => new Set());
  const [openLinhas, setOpenLinhas] = useState(() => new Set());
  const [openPcs, setOpenPcs] = useState(() => new Set());

  const toggleSet = useCallback((setter, key) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedCats(new Set());
    setOpenLinhas(new Set(allKeys.linhas));
    setOpenPcs(new Set(allKeys.pcs));
  }, [allKeys]);

  const collapseAll = useCallback(() => {
    setCollapsedCats(new Set(allKeys.cats));
    setOpenLinhas(new Set());
    setOpenPcs(new Set());
  }, [allKeys]);

  if (!filtered.length) {
    return (
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center">
        <p className="text-sm text-muted-foreground">Nada encontrado com estes filtros.</p>
        <p className="text-xs text-muted-foreground mt-1">Experimente activar Solo, Mix e Portfolio ou limpar a busca.</p>
      </div>
    );
  }

  const rows = [];

  for (const cat of filtered) {
    const catKey = `cat:${cat.nome}`;
    const catOpen = !collapsedCats.has(catKey);
    const catSkuCount = cat.linhas.reduce(
      (n, lin) => n + lin.pcs.reduce((s, p) => s + p.skus.length, 0) + lin.solos.length,
      0,
    );
    const catEstoque = cat.linhas.reduce(
      (n, lin) =>
        n
        + lin.pcs.reduce((s, p) => s + p.skus.reduce((e, sk) => e + sk.estoque, 0), 0)
        + lin.solos.reduce((e, sk) => e + sk.estoque, 0),
      0,
    );

    rows.push(
      <HierarchyRow
        key={catKey}
        rowKey={catKey}
        nivel="categoria"
        nome={cat.nome}
        skuCount={catSkuCount}
        estoque={catEstoque}
        depth={0}
        open={catOpen}
        hasChildren
        onToggle={() => toggleSet(setCollapsedCats, catKey)}
        subtitle={`${cat.linhas.length} LINHA(s)`}
      />,
    );

    if (!catOpen) continue;

    for (const lin of cat.linhas) {
      const linKey = `lin:${cat.nome}::${lin.linha_codigo}`;
      const linOpen = openLinhas.has(linKey);
      const linSkuCount = lin.pcs.reduce((s, p) => s + p.skus.length, 0) + lin.solos.length;
      const linEstoque =
        lin.pcs.reduce((s, p) => s + p.skus.reduce((e, sk) => e + sk.estoque, 0), 0)
        + lin.solos.reduce((e, sk) => e + sk.estoque, 0);

      rows.push(
        <HierarchyRow
          key={linKey}
          rowKey={linKey}
          nivel="linha"
          nome={lin.linha_nome}
          tipo={lin.linha_tipo}
          skuCount={linSkuCount}
          estoque={linEstoque}
          depth={1}
          open={linOpen}
          hasChildren
          onToggle={() => toggleSet(setOpenLinhas, linKey)}
          subtitle={lin.linha_codigo}
        />,
      );

      if (!linOpen) continue;

      if (lin.linha_tipo === 'solo') {
        const soloKey = `pc:${cat.nome}::${lin.linha_codigo}::solo`;
        const soloOpen = openPcs.has(soloKey);
        rows.push(
          <HierarchyRow
            key={soloKey}
            rowKey={soloKey}
            nivel="produto_compra"
            nome="SKUs directos (solo)"
            tipo="solo"
            skuCount={lin.solos.length}
            estoque={lin.solos.reduce((e, sk) => e + sk.estoque, 0)}
            depth={2}
            open={soloOpen}
            hasChildren={lin.solos.length > 0}
            onToggle={() => toggleSet(setOpenPcs, soloKey)}
            subtitle="Sem produto compra intermédio"
          />,
        );
        if (soloOpen) {
          for (const s of lin.solos) {
            rows.push(
              <HierarchyRow
                key={`sku:${s.produto.id}`}
                nivel="sku"
                nome={montarNomePortalSku(s)}
                estoque={s.estoque}
                depth={3}
                subtitle={montarSubtituloPortalSku(s) || undefined}
              />,
            );
          }
        }
        continue;
      }

      for (const pc of lin.pcs) {
        const pcKey = `pc:${cat.nome}::${lin.linha_codigo}::${pc.produto_compra_codigo}`;
        const pcOpen = openPcs.has(pcKey);
        const gridHint =
          pc.eixo_a_rotulo && pc.eixo_b_rotulo
            ? `${pc.eixo_a_rotulo} × ${pc.eixo_b_rotulo}`
            : undefined;

        rows.push(
          <HierarchyRow
            key={pcKey}
            rowKey={pcKey}
            nivel="produto_compra"
            nome={pc.produto_compra_nome}
            tipo={lin.linha_tipo}
            skuCount={pc.skus.length}
            estoque={pc.skus.reduce((e, sk) => e + sk.estoque, 0)}
            depth={2}
            open={pcOpen}
            hasChildren={pc.skus.length > 0}
            onToggle={() => toggleSet(setOpenPcs, pcKey)}
            subtitle={gridHint}
          />,
        );

        if (!pcOpen) continue;

        for (const s of pc.skus) {
          rows.push(
            <HierarchyRow
              key={`sku:${s.produto.id}`}
              nivel="sku"
              nome={montarNomePortalSku(s)}
              estoque={s.estoque}
              depth={3}
              subtitle={montarSubtituloPortalSku(s) || undefined}
            />,
          );
        }
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
          Categoria → LINHA → Produto compra → SKU
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={expandAll}>
            Expandir tudo
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
            Recolher
          </Button>
        </div>
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
              <TableHead className={cn(p38Table.head, 'w-[110px]')}>Nível</TableHead>
              <TableHead className={p38Table.head}>Nome</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[100px]')}>Tipo</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>SKUs</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{rows}</TableBody>
        </Table>
      </P38TableShell>
    </div>
  );
}
