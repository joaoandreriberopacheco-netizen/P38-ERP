import React, { useState } from 'react';
import { ChevronRight, FolderTree, Package, Layers, Box, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/utils';

const TIPO_BADGE = {
  solo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  mix: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  portfolio: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
};

function TipoBadge({ tipo }) {
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal', TIPO_BADGE[tipo] || '')}>
      {tipo}
    </Badge>
  );
}

function ExpandRow({ icon: Icon, label, meta, depth, open, onToggle, hasChildren }) {
  const pad = 8 + depth * 16;
  return (
    <button
      type="button"
      onClick={hasChildren ? onToggle : undefined}
      className={cn(
        'w-full flex items-center gap-2 py-1.5 pr-2 text-left text-sm hover:bg-muted/60 rounded-md',
        !hasChildren && 'cursor-default',
      )}
      style={{ paddingLeft: pad }}
    >
      {hasChildren ? (
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate font-medium">{label}</span>
      {meta}
    </button>
  );
}

function SkuLeaf({ row, depth }) {
  return (
    <div
      className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
      style={{ paddingLeft: 8 + depth * 16 + 20 }}
    >
      <Box className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{row.produto.nome}</span>
      <span className="shrink-0 tabular-nums">est. {row.estoque}</span>
      {row.eixo_b && <span className="truncate opacity-70">· {row.eixo_b}</span>}
    </div>
  );
}

function ProdutoCompraBlock({ pc, linhaTipo, depth, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const gridCells = [...new Set(pc.skus.map((s) => s.eixo_b).filter(Boolean))];

  return (
    <div>
      <ExpandRow
        icon={Layers}
        label={pc.produto_compra_nome}
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        hasChildren
        meta={
          <>
            <TipoBadge tipo={linhaTipo} />
            <span className="text-[10px] text-muted-foreground">{pc.skus.length} SKU(s)</span>
          </>
        }
      />
      {open && (
        <div className="mx-2 mb-2 p-2 rounded-lg bg-muted/40 border border-border/50 text-[11px]">
          {pc.eixo_a_rotulo && pc.eixo_b_rotulo ? (
            <p className="text-muted-foreground mb-1">
              Grelha: <strong className="text-foreground">{pc.eixo_a_rotulo}</strong> ×{' '}
              <strong className="text-foreground">{pc.eixo_b_rotulo}</strong>
              {gridCells.length
                ? ` · ${gridCells.slice(0, 6).join(', ')}${gridCells.length > 6 ? '…' : ''}`
                : ''}
            </p>
          ) : (
            <p className="text-muted-foreground mb-1">Critérios de compra nesta esquadra (preview)</p>
          )}
          {pc.skus.map((s) => <SkuLeaf key={s.produto.id} row={s} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function LinhaSection({ lin }) {
  const [open, setOpen] = useState(lin.linha_codigo === 'SOLDAVEL');
  const skuCount = lin.pcs.reduce((s, p) => s + p.skus.length, 0) + lin.solos.length;

  return (
    <div>
      <ExpandRow
        icon={Package}
        label={lin.linha_nome}
        depth={1}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        hasChildren
        meta={
          <>
            <TipoBadge tipo={lin.linha_tipo} />
            <span className="text-[10px] text-muted-foreground">{skuCount} SKU(s)</span>
          </>
        }
      />
      {open && (
        <>
          {lin.pcs.map((pc, i) => (
            <ProdutoCompraBlock
              key={pc.produto_compra_codigo}
              pc={pc}
              linhaTipo={lin.linha_tipo}
              depth={2}
              defaultOpen={lin.linha_codigo === 'SOLDAVEL' && i === 0}
            />
          ))}
          {lin.solos.map((s) => <SkuLeaf key={s.produto.id} row={s} depth={2} />)}
        </>
      )}
    </div>
  );
}

function CatSection({ cat }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="py-2">
      <ExpandRow
        icon={FolderTree}
        label={cat.nome}
        depth={0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        hasChildren
        meta={<span className="text-[10px] text-muted-foreground">{cat.linhas.length} LINHA(s)</span>}
      />
      {open && cat.linhas.map((lin) => <LinhaSection key={lin.linha_codigo} lin={lin} />)}
    </div>
  );
}

function filterTree(tree, filtroLinha, search) {
  const q = search.trim().toLowerCase();

  return tree
    .map((cat) => ({
      ...cat,
      linhas: cat.linhas
        .filter((lin) => !filtroLinha || lin.linha_codigo === filtroLinha)
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

export default function PortalCadastroPanel({ tree, filtroLinha, search }) {
  const filtered = filterTree(tree, filtroLinha, search);

  if (!filtered.length) {
    return <p className="text-sm text-muted-foreground p-4">Nada encontrado com estes filtros.</p>;
  }

  return (
    <div className="divide-y divide-border/50">
      {filtered.map((cat) => <CatSection key={cat.nome} cat={cat} />)}
    </div>
  );
}
