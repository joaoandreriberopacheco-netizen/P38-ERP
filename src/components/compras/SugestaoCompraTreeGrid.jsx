import React, { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { ChevronRight, Layers, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useCatalogTreeGrid,
  flattenTree,
  mergeAdjacentDuplicateGroupHeaders,
  catalogProdutosStructureSig,
  TREE_GRID_EXPAND_ALL_LEVEL,
  resolveExpandedKeysForMasterLevel,
} from '@/components/produtos/treegrid/useTreeGrid';
import { LevelControl } from '@/components/produtos/treegrid/TreeGrid';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import {
  aggregateSugestaoTreeGroupMetrics,
  countDescendantSugestaoLinhas,
  getLinhaAbcdLetter,
  resolveSugestaoLinhaForTreeRow,
} from '@/lib/sugestaoCompraTree';
import {
  formatSugestaoAggregateEstoqueVitrine,
  formatSugestaoEstoqueLinha,
  formatSugestaoQuantidadeVitrine,
} from '@/lib/sugestaoCompraVitrineDisplay';
import {
  compareSugestaoCompraLinhas,
  columnSortToCatalogTreeOrder,
  DEFAULT_SUGESTAO_COLUMN_SORT,
} from '@/lib/sugestaoCompraColumnSort';
import {
  sugestaoProjecaoEstoque30dNegativa,
  sugestaoProjecaoEstoque30dTexto,
} from '@/lib/calcularSugestaoCompraVelocidade';
import {
  SUGESTAO_OPERATIONAL_MODES,
  linhaExigeAcaoCompra,
  treeGroupExigeAcaoRadar,
} from '@/lib/sugestaoCompraOperationalMode';
import { SugestaoCompraDesktopSelectHeader } from '@/components/compras/SugestaoCompraDesktopToolbar';

/** Listas típicas de sugestão (<250 linhas): render completo evita tela vazia da virtualização. */
const SUGESTAO_VIRTUALIZE_MIN_ROWS = 250;

const HIER_STEP = 20;
const CELL_PAD = 4;
/** Largura fixa da coluna produto — evita “empurrar” as colunas de valores. */
const CHECKBOX_COL_WIDTH = 48;
const PRODUTO_COL_WIDTH = 248;
const COL_WIDTHS = {
  abcd: 56,
  estoque: 72,
  media30d: 84,
  pontoFuturo: 84,
  qtdSugerida: 116,
  fornecedor: 148,
};
const TABLE_MIN_WIDTH =
  CHECKBOX_COL_WIDTH
  + PRODUTO_COL_WIDTH
  + COL_WIDTHS.abcd
  + COL_WIDTHS.estoque
  + COL_WIDTHS.media30d
  + COL_WIDTHS.pontoFuturo
  + COL_WIDTHS.qtdSugerida
  + COL_WIDTHS.fornecedor;
const PRODUTO_STICKY_SHADOW = 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)]';

const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function StackedHead({ top, bottom, align = 'right' }) {
  return (
    <span className={cn('inline-flex flex-col leading-tight', align === 'center' && 'items-center', align === 'left' && 'items-start', align === 'right' && 'items-end')}>
      <span>{top}</span>
      {bottom ? <span className="text-[9px] font-normal opacity-75">{bottom}</span> : null}
    </span>
  );
}

function SortableHead({
  column,
  columnSort,
  onColumnSort,
  top,
  bottom,
  align = 'right',
  className,
}) {
  const active = columnSort?.column === column;
  const direction = active ? columnSort.direction : null;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onColumnSort?.(column)}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground',
        align === 'center' && 'justify-center w-full',
        align === 'left' && 'justify-start',
        align === 'right' && 'justify-end w-full',
        className,
      )}
      title="Ordenar coluna"
    >
      <StackedHead top={top} bottom={bottom} align={align} />
      <Icon className={cn('w-3 h-3 shrink-0 opacity-70', active && 'opacity-100')} />
    </button>
  );
}

function pontoFuturoProjecaoTexto(sugestao) {
  return sugestaoProjecaoEstoque30dTexto(sugestao);
}

function AbcdBadge({ letter }) {
  const value = String(letter || '').toUpperCase();
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    value === 'A' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    : value === 'B' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
    : value === 'C' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
    : value === 'E' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
    : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ${tone}`}>
      {value}
    </span>
  );
}

const catalogHierDepth = (level) => Math.max(0, (level ?? 1) - 1);

function ProdutoCell({ row, isExpanded, onToggle }) {
  const isCategoryBand = !!row.isCategoryBand;
  const isGroup = row.type === 'group';
  const hierDepth = isCategoryBand ? 0 : catalogHierDepth(row.level);
  const p = row.produto;
  const label = isGroup ? row.label : p?.nome;
  const isPrimeiroNivel = row.level === 1;

  return (
    <div
      className="flex min-w-0 w-full max-w-full"
      style={{ paddingLeft: CELL_PAD + hierDepth * HIER_STEP }}
    >
      {isGroup ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(row.key); }}
          className="flex items-start gap-1.5 min-w-0 w-full text-left"
        >
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 mt-0.5',
              isExpanded && 'rotate-90',
            )}
          />
          <span className={cn(
            'flex-1 min-w-0 text-xs uppercase tracking-wide break-words leading-snug',
            isCategoryBand
              ? 'font-bold text-teal-800 dark:text-teal-300'
              : isPrimeiroNivel
                ? 'font-semibold text-foreground/90'
                : 'font-normal text-muted-foreground',
          )}>
            {label}
          </span>
          {row.count > 0 ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 px-1.5 text-[10px] font-medium flex-shrink-0 mt-0.5',
                isCategoryBand
                  ? 'border-teal-200/60 text-teal-700 dark:border-teal-800 dark:text-teal-300'
                  : 'border-border/40 text-muted-foreground',
              )}
            >
              {row.count}
            </Badge>
          ) : null}
        </button>
      ) : (
        <div className="flex flex-col min-w-0 w-full ml-5 gap-0.5">
          <span className={cn(
            'text-xs uppercase break-words leading-snug',
            isPrimeiroNivel ? 'font-semibold text-foreground/90 dark:text-muted-foreground' : 'text-muted-foreground',
          )}>
            {label}
          </span>
          {p?.codigo_interno ? (
            <span className="text-[10px] font-mono text-muted-foreground break-all leading-tight">
              {p.codigo_interno}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function QtdSugeridaInput({ linha, disp, onQuantidadeLinhaChange }) {
  const qty = disp?.quantidade ?? 0;
  const unidade = disp?.unidade || '';
  const [localValue, setLocalValue] = useState(() => String(qty));

  useEffect(() => {
    setLocalValue(String(qty));
  }, [linha.id, qty]);

  const commit = () => {
    const parsed = Number(String(localValue).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setLocalValue(String(qty));
      return;
    }
    onQuantidadeLinhaChange?.(linha, parsed);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-16 px-1.5 text-right text-xs tabular-nums"
        onClick={(e) => e.stopPropagation()}
      />
      {unidade ? (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{unidade}</span>
      ) : null}
      {linha.tipo === 'grupo' ? (
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
          <Layers className="w-3 h-3" />
          {linha.skus?.length ?? 0}
        </div>
      ) : null}
    </div>
  );
}

function SugestaoDataCells({
  linha,
  row,
  linhaLookup,
  agruparHierarquia,
  incluirPedidosAprovados,
  salesVelocityMap,
  disp,
  onQuantidadeLinhaChange,
  renderFornecedorSelect,
}) {
  if (!linha) {
    const groupAbcd = row?.abcdDominante || '';
    const agg = row?.type === 'group' && row?.node
      ? aggregateSugestaoTreeGroupMetrics(row, linhaLookup, {
        agruparHierarquia,
        salesVelocityMap,
        incluirPedidosAprovados,
      })
      : null;

    if (!agg) {
      return (
        <>
          <td className="text-center py-2 px-2 whitespace-nowrap overflow-hidden">
            {groupAbcd ? <AbcdBadge letter={groupAbcd} /> : <span className="text-xs text-muted-foreground">—</span>}
          </td>
          <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden"><span className="text-xs text-muted-foreground">—</span></td>
          <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden"><span className="text-xs text-muted-foreground">—</span></td>
          <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden"><span className="text-xs text-muted-foreground">—</span></td>
          <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden"><span className="text-xs text-muted-foreground">—</span></td>
          <td className="py-2 px-2 overflow-hidden"><span className="text-xs text-muted-foreground">—</span></td>
        </>
      );
    }

    const estoqueFmt = formatSugestaoAggregateEstoqueVitrine(agg.estoqueDisp);
    const pontoFuturoProjecao = sugestaoProjecaoEstoque30dTexto(agg.projecao);
    const projecaoNegativa = sugestaoProjecaoEstoque30dNegativa(agg.projecao);
    const qtdSugeridaTexto = agg.representativo && agg.qtdSugeridaBase > 0
      ? formatSugestaoQuantidadeVitrine(agg.representativo, agg.qtdSugeridaBase, { tilde: true })
      : null;

    return (
      <>
        <td className="text-center py-2 px-2 whitespace-nowrap overflow-hidden">
          {groupAbcd ? <AbcdBadge letter={groupAbcd} /> : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
          {estoqueFmt ? (
            <span className="text-xs text-muted-foreground tabular-nums inline-flex flex-col items-end leading-tight">
              <span>{estoqueFmt.primary}</span>
              {estoqueFmt.secondary ? (
                <span className="text-[10px] text-muted-foreground">{estoqueFmt.secondary}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
          <span className="text-xs text-muted-foreground tabular-nums">
            {agg.media30dTexto || '—'}
          </span>
        </td>
        <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
          <span className={cn(
            'text-xs tabular-nums',
            projecaoNegativa
              ? 'text-rose-700 dark:text-rose-400 font-medium'
              : 'text-muted-foreground',
          )}>
            {pontoFuturoProjecao}
          </span>
        </td>
        <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
          <span className="text-xs text-muted-foreground tabular-nums">
            {qtdSugeridaTexto || '—'}
          </span>
        </td>
        <td className="py-2 px-2 overflow-hidden">
          <span className="text-xs text-muted-foreground">—</span>
        </td>
      </>
    );
  }

  const sugestao = linha.sugestao;
  const produto = linha.produto;
  const estoqueFmt = formatSugestaoEstoqueLinha(produto, sugestao, {
    incluirPedidosAprovados,
    quantidadePendente: linha?.quantidade_pendente,
  });
  const media30d = sugestao?.media_30d_texto;
  const pontoFuturoProjecao = pontoFuturoProjecaoTexto(sugestao);
  const abcd = getLinhaAbcdLetter(linha, row?.abcdDominante);

  return (
    <>
      <td className="text-center py-2 px-2 whitespace-nowrap overflow-hidden">
        <AbcdBadge letter={abcd} />
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
        <span className="inline-flex flex-col items-end text-xs text-muted-foreground tabular-nums">
          <span>{estoqueFmt.primary}</span>
          {estoqueFmt.secondary ? (
            <span className="text-[10px] text-muted-foreground">{estoqueFmt.secondary}</span>
          ) : null}
        </span>
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
        <span className="text-xs text-muted-foreground tabular-nums">
          {media30d || '—'}
        </span>
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden">
        <span className={cn(
          'text-xs tabular-nums',
          sugestaoProjecaoEstoque30dNegativa(sugestao)
            ? 'text-rose-700 dark:text-rose-400 font-medium'
            : 'text-muted-foreground',
        )}>
          {pontoFuturoProjecao}
        </span>
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <QtdSugeridaInput
          linha={linha}
          disp={disp}
          onQuantidadeLinhaChange={onQuantidadeLinhaChange}
        />
      </td>
      <td className="py-2 px-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {renderFornecedorSelect?.(linha)}
      </td>
    </>
  );
}

export default function SugestaoCompraTreeGrid({
  produtos,
  linhaLookup,
  agruparHierarquia = true,
  operationalMode = SUGESTAO_OPERATIONAL_MODES.livre,
  incluirPedidosAprovados = false,
  sortOrder = 'az',
  columnSort = DEFAULT_SUGESTAO_COLUMN_SORT,
  onColumnSort,
  sortCtx,
  groupByCategory = false,
  masterLevel = 1,
  salesVelocityMap = {},
  selectedItems = {},
  onToggleSelected,
  allVisibleSelected = false,
  someVisibleSelected = false,
  onSelectAllVisible,
  sugestaoDisplayLinha,
  onQuantidadeLinhaChange,
  renderFornecedorSelect,
}) {
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const scrollContainerRef = useRef(null);
  const treeRef = useRef(null);

  const tree = useCatalogTreeGrid(produtos, { groupByCategory });
  treeRef.current = tree;

  const produtosStructureSig = useMemo(
    () => catalogProdutosStructureSig(produtos, { groupByCategory }),
    [produtos, groupByCategory],
  );

  useEffect(() => {
    setExpandedKeys(resolveExpandedKeysForMasterLevel(treeRef.current, masterLevel, groupByCategory));
  }, [produtosStructureSig, groupByCategory, masterLevel]);

  const treeSortOrder = useMemo(
    () => columnSortToCatalogTreeOrder(columnSort) || sortOrder,
    [columnSort, sortOrder],
  );

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
  }, [produtosStructureSig, groupByCategory, masterLevel, treeSortOrder, columnSort]);

  const rows = useMemo(
    () => mergeAdjacentDuplicateGroupHeaders(
      flattenTree(tree, expandedKeys, '', 0, treeSortOrder, { groupByCategory }),
    ),
    [tree, expandedKeys, treeSortOrder, groupByCategory],
  );

  const sortedRows = useMemo(() => {
    const column = columnSort?.column || 'produto';
    if (column === 'produto' || column === 'abcd') return rows;

    return [...rows].sort((rowA, rowB) => {
      const linhaA = resolveSugestaoLinhaForTreeRow(rowA, linhaLookup, { agruparHierarquia });
      const linhaB = resolveSugestaoLinhaForTreeRow(rowB, linhaLookup, { agruparHierarquia });
      if (!linhaA && !linhaB) {
        return String(rowA?.label || '').localeCompare(String(rowB?.label || ''), 'pt-BR');
      }
      if (!linhaA) return 1;
      if (!linhaB) return -1;
      return compareSugestaoCompraLinhas(linhaA, linhaB, columnSort, sortCtx);
    });
  }, [rows, columnSort, linhaLookup, agruparHierarquia, sortCtx]);

  const displayRows = useMemo(() => {
    const baseRows = sortedRows;

    if (operationalMode !== SUGESTAO_OPERATIONAL_MODES.radar) {
      return baseRows;
    }

    const radarOpts = {
      agruparHierarquia,
      salesVelocityMap,
      incluirPedidosAprovados,
    };

    return baseRows.filter((row) => {
      if (row.type === 'sku') return true;
      if (row.type !== 'group' || !row.node) return true;
      if (row.isCategoryBand) {
        return treeGroupExigeAcaoRadar(row, linhaLookup, radarOpts);
      }
      const linha = resolveSugestaoLinhaForTreeRow(row, linhaLookup, { agruparHierarquia });
      if (linha) return linhaExigeAcaoCompra(linha);
      return treeGroupExigeAcaoRadar(row, linhaLookup, radarOpts);
    });
  }, [
    sortedRows,
    operationalMode,
    agruparHierarquia,
    salesVelocityMap,
    incluirPedidosAprovados,
    linhaLookup,
  ]);

  const handleToggle = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const estimateRowSize = useCallback(
    (index) => (displayRows[index]?.type === 'group' ? 44 : 56),
    [displayRows],
  );
  const virtualRows = useVirtualRows({
    itemCount: displayRows.length,
    estimateSize: estimateRowSize,
    overscan: 12,
    scrollElementRef: scrollContainerRef,
  });
  const shouldVirtualizeRows = displayRows.length >= SUGESTAO_VIRTUALIZE_MIN_ROWS;
  const visibleRows = useMemo(
    () => (shouldVirtualizeRows ? displayRows.slice(virtualRows.startIndex, virtualRows.endIndex) : displayRows),
    [displayRows, shouldVirtualizeRows, virtualRows.endIndex, virtualRows.startIndex],
  );
  const paddingTop = shouldVirtualizeRows ? virtualRows.paddingTop : 0;
  const paddingBottom = shouldVirtualizeRows ? virtualRows.paddingBottom : 0;

  const colSpan = 8;
  const produtoColStyle = {
    left: CHECKBOX_COL_WIDTH,
    width: PRODUTO_COL_WIDTH,
    minWidth: PRODUTO_COL_WIDTH,
    maxWidth: PRODUTO_COL_WIDTH,
  };

  return (
    <div className="flex flex-col min-h-0 w-full border border-border/40 rounded-lg overflow-hidden bg-card">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto overscroll-contain max-h-[min(70vh,720px)] [overflow-anchor:none]"
      >
        <table
          className="w-full"
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            width: '100%',
            minWidth: TABLE_MIN_WIDTH,
          }}
        >
          <colgroup>
            <col style={{ width: CHECKBOX_COL_WIDTH }} />
            <col style={{ width: PRODUTO_COL_WIDTH }} />
            <col style={{ width: COL_WIDTHS.abcd }} />
            <col style={{ width: COL_WIDTHS.estoque }} />
            <col style={{ width: COL_WIDTHS.media30d }} />
            <col style={{ width: COL_WIDTHS.pontoFuturo }} />
            <col style={{ width: COL_WIDTHS.qtdSugerida }} />
            <col style={{ width: COL_WIDTHS.fornecedor }} />
          </colgroup>
          <thead className={p38Table.headerSolid}>
            <tr className="border-b border-border/40">
              <th
                className={cn(p38Table.stickyHeadLeft, p38Table.stickyCell, PRODUTO_STICKY_SHADOW, p38Table.head, 'text-center py-2')}
                style={{ left: 0, width: CHECKBOX_COL_WIDTH }}
              >
                <div className="flex items-center justify-center">
                  <SugestaoCompraDesktopSelectHeader
                    allSelected={allVisibleSelected}
                    someSelected={someVisibleSelected}
                    onSelectAllVisible={onSelectAllVisible}
                  />
                </div>
              </th>
              <th
                className={cn(p38Table.stickyHeadLeft, p38Table.stickyCell, PRODUTO_STICKY_SHADOW, p38Table.head, 'text-left py-2')}
                style={produtoColStyle}
              >
                <SortableHead
                  column="produto"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Produto"
                  align="left"
                />
              </th>
              <th className={cn(p38Table.head, 'text-center py-2')}>
                <SortableHead
                  column="abcd"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="ABCD"
                  align="center"
                />
              </th>
              <th className={cn(p38Table.head, p38Table.headRight, 'py-2')}>
                <SortableHead
                  column="estoque"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Est."
                  bottom="atual"
                />
              </th>
              <th className={cn(p38Table.head, p38Table.headRight, 'py-2')}>
                <SortableHead
                  column="media30d"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Média"
                  bottom="30d"
                />
              </th>
              <th className={cn(p38Table.head, p38Table.headRight, 'py-2')}>
                <SortableHead
                  column="pontoFuturo"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Ponto"
                  bottom="futuro"
                />
              </th>
              <th className={cn(p38Table.head, p38Table.headRight, 'py-2')}>
                <SortableHead
                  column="qtdSugerida"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Qtd"
                  bottom="sug."
                />
              </th>
              <th className={cn(p38Table.head, 'text-left py-2')}>
                <SortableHead
                  column="fornecedor"
                  columnSort={columnSort}
                  onColumnSort={onColumnSort}
                  top="Forn."
                  bottom="edor"
                  align="left"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum item na árvore.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 ? (
                  <tr aria-hidden="true"><td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
                ) : null}
                {visibleRows.map((row) => {
                  const linha = resolveSugestaoLinhaForTreeRow(row, linhaLookup, { agruparHierarquia });
                  const isExpanded = expandedKeys.has(row.key);
                  const sugestaoCount = row.type === 'group' && !linha
                    ? countDescendantSugestaoLinhas(row, linhaLookup, { agruparHierarquia })
                    : 0;
                  const isSelected = linha ? !!selectedItems[linha.id] : false;

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        p38Table.row,
                        row.isCategoryBand && 'bg-teal-50/40 dark:bg-teal-950/20',
                        linha && 'hover:bg-muted/30 cursor-pointer',
                        isSelected && 'bg-teal-50/70 dark:bg-teal-950/30 ring-1 ring-inset ring-teal-500/25',
                      )}
                      onClick={() => {
                        if (!linha) return;
                        onToggleSelected?.(linha.id, !isSelected);
                      }}
                    >
                      <td
                        className={cn(p38Table.stickyCellLeft, p38Table.stickyCell, PRODUTO_STICKY_SHADOW, 'py-2 text-center')}
                        style={{ left: 0, width: CHECKBOX_COL_WIDTH }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {linha ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => onToggleSelected?.(linha.id, !!c)}
                            className="h-5 w-5 border-2 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                            aria-label={`Selecionar ${linha.label}`}
                          />
                        ) : sugestaoCount > 0 ? (
                          <span className="text-[10px] text-muted-foreground tabular-nums">{sugestaoCount}</span>
                        ) : null}
                      </td>
                      <td
                        className={cn(p38Table.stickyCellLeft, p38Table.stickyCell, PRODUTO_STICKY_SHADOW, 'py-2 align-top')}
                        style={produtoColStyle}
                      >
                        <ProdutoCell row={row} isExpanded={isExpanded} onToggle={handleToggle} />
                      </td>
                      <SugestaoDataCells
                        linha={linha}
                        row={row}
                        linhaLookup={linhaLookup}
                        agruparHierarquia={agruparHierarquia}
                        incluirPedidosAprovados={incluirPedidosAprovados}
                        salesVelocityMap={salesVelocityMap}
                        disp={linha ? sugestaoDisplayLinha?.(linha) : null}
                        onQuantidadeLinhaChange={onQuantidadeLinhaChange}
                        renderFornecedorSelect={renderFornecedorSelect}
                      />
                    </tr>
                  );
                })}
                {paddingBottom > 0 ? (
                  <tr aria-hidden="true"><td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
                ) : null}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { LevelControl, TREE_GRID_EXPAND_ALL_LEVEL };
