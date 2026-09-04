import React, { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { ChevronRight, Package, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCatalogTreeGrid, flattenTree, mergeAdjacentDuplicateGroupHeaders, aggregateEstoqueDisplay, aggregateMetaEstoqueDisplay, collectSkus, catalogProdutosStructureSig, TREE_GRID_EXPAND_ALL_LEVEL, resolveExpandedKeysForMasterLevel } from './useTreeGrid';
import {
  catalogGroupAnalysisSig,
  getCatalogFlattenOptions,
  pruneTreeForGroupAnalysis,
} from '@/lib/catalogGroupAnalysis';
import { formatEstoqueApresentacao, getCatalogoComercialView, getCatalogUnitLabels } from '@/lib/productUnits';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { CATALOGO_VIRTUALIZE_MIN_ROWS } from '@/lib/p38VirtualList';
import { cn } from '@/components/utils';
import { catalogProdutoColStyle, computeCatalogProdutoColWidth, estimateCatalogProdutoRowHeight, CATALOG_PRODUTO_STICKY_CELL, CATALOG_PRODUTO_STICKY_HEAD } from '@/lib/catalogProdutoColumnLayout';
import { p38Table } from '@/lib/p38TableSurfaces';
import { computeTreeGridColumnLayout } from './treeGridColumnLayout';
import {
  aggregateCatalogPontoEsperadoLt,
  aggregateCatalogSalesVelocity,
  formatCatalogMedia30d,
  formatCatalogMetaQuantidade,
  formatCatalogPontoEsperadoLt,
  formatCatalogPontoFuturo,
  formatCatalogPontoFuturoQuantidade,
  formatCatalogSalesQuantity,
  getCatalogLeadTimeDias,
  getCatalogMedia30dFrom60d,
  getCatalogPontoFuturo,
} from '@/lib/catalogSalesVelocity';
import { aggregateCatalogEstoqueExibicao, resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { LevelControl } from './LevelControl';

export { LevelControl };

// ── Formatação ────────────────────────────────────────────────────────────────
const fmtR   = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtN   = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function renderMetaQuantidade(produto, field) {
  const text = formatCatalogMetaQuantidade(produto, produto[field]);
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {text || '—'}
    </span>
  );
}

function renderGroupMetaQuantidade(skus, field) {
  const disp = aggregateMetaEstoqueDisplay(skus, field);
  if (disp.mode === 'empty' || disp.quantidade <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (disp.mode === 'mixed') {
    return (
      <span className="text-xs text-muted-foreground tabular-nums inline-flex flex-col leading-tight items-end">
        <span>{fmtN(disp.quantidade)}</span>
        <span className="text-[10px] text-muted-foreground">un. base (mistura)</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {fmtN(disp.quantidade)} {disp.sigla}
    </span>
  );
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

function IepCodigoBadge({ code }) {
  const value = String(code || '').toUpperCase().trim();
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    value === 'TOP'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
      : value === 'ESP'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        : value === 'CAR'
          ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
          : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex h-5 items-center justify-center rounded px-1.5 text-[10px] font-bold ${tone}`}>
      {value}
    </span>
  );
}

function scoreCell(value, tilde = false, suffix = '') {
  const num = Number(value);
  if (value == null || !Number.isFinite(num)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const text = `${Math.round(num).toLocaleString('pt-BR')}${suffix || ''}`;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {tilde ? `~${text}` : text}
    </span>
  );
}

// ── Definição completa de colunas ─────────────────────────────────────────────
const COL_DEFS = [
  { id: 'status',               label: 'Status',         w: 72  },
  { id: 'codigo_interno',       label: 'Código',         w: 96  },
  { id: 'codigo_barras',        label: 'Cód. Barras',    w: 120 },
  { id: 'categoria',            label: 'Categoria',      w: 120 },
  { id: 'tags',                 label: 'Tags',           w: 110 },
  { id: 'fornecedor',           label: 'Fornecedor',     w: 130 },
  { id: 'preco_venda',          label: 'Preço de venda', w: 108 },
  { id: 'margem',               label: 'Margem',         w: 80  },
  { id: 'preco_custo',          label: 'Custo Total',    w: 104 },
  { id: 'valor_compra',         label: 'Vl. Compra',     w: 100 },
  { id: 'avaria_percentual',    label: 'Avaria %',       w: 80  },
  { id: 'markup',               label: 'Markup %',       w: 80  },
  { id: 'inventario_valorizado', label: 'Inventário R$', w: 108 },
  { id: 'estoque_atual',        label: 'Estoque',        w: 96  },
  { id: 'media_30d',            label: 'Média 30d',      w: 96  },
  { id: 'ponto_futuro',         label: 'Ponto futuro',   w: 96  },
  { id: 'ponto_esperado_lt',    label: 'Ponto LT',       w: 96  },
  { id: 'estoque_minimo',       label: 'Est. Mín',       w: 80  },
  { id: 'estoque_ideal',        label: 'Est. Ideal',     w: 80  },
  { id: 'estoque_maximo',       label: 'Est. Máx',       w: 80  },
  { id: 'tempo_reposicao',      label: 'Repos.',         w: 72  },
  { id: 'peso',                 label: 'Peso',           w: 72  },
  { id: 'dimensoes',            label: 'Dimensões',      w: 112 },
  { id: 'tipo',                 label: 'Tipo',           w: 80  },
  { id: 'unidade',              label: 'Unidades',       w: 72  },
  { id: 'unidades_pacote',      label: 'Un/Pct',         w: 72  },
  { id: 'abcd',                 label: 'Classe ABCD',    w: 72  },
  { id: 'iep_score',            label: 'IEP',            w: 84  },
  { id: 'iep_codigo_comportamento', label: 'Perfil IEP', w: 84  },
  { id: 'iep_score_nivel_1',    label: 'Média N1',       w: 80  },
  { id: 'iep_score_nivel_2',    label: 'Média N2',       w: 80  },
  { id: 'iep_score_nivel_3',    label: 'Média N3',       w: 80  },
  { id: 'iep_score_nivel_4',    label: 'Média N4',       w: 80  },
  { id: 'iep_score_nivel_5',    label: 'Média N5',       w: 80  },
];

export const ALL_COLS     = COL_DEFS;
export const DEFAULT_COLS = ['preco_venda', 'preco_custo', 'markup', 'inventario_valorizado'];
export { TREE_GRID_EXPAND_ALL_LEVEL };

const HIER_STEP = 20;    // recuo por nível hierárquico (filhos vs pais/solteiros)
const CELL_PAD = 4;
function VirtualPaddingRow({ height, produtoWidth, activeCols }) {
  if (height <= 0) return null;
  const padStyle = { height, padding: 0, border: 0, lineHeight: 0, fontSize: 0 };
  return (
    <tr aria-hidden="true">
      <td style={{ ...padStyle, width: produtoWidth, minWidth: produtoWidth }} />
      {activeCols.map((col) => (
        <td key={col.id} style={{ ...padStyle, width: col.width, minWidth: col.minW }} />
      ))}
    </tr>
  );
}

const catalogHierDepth = (level) => Math.max(0, (level ?? 1) - 1);

/** Rótulo principal — pais, solteiros de 1º nível e cabeçalho da tabela */
const CATALOG_ROW_LABEL_CLASS =
  'text-xs font-semibold text-foreground/90 dark:text-foreground whitespace-nowrap uppercase tracking-wide';

/** Descrição do produto em linhas de dados — no escuro, tom igual às demais células */
const CATALOG_ROW_DESC_CLASS =
  'text-xs font-semibold text-foreground/90 dark:text-muted-foreground uppercase tracking-wide break-words leading-snug';

/** Filhos (nível ≥ 2) — tom mais suave que o pai */
const CATALOG_CHILD_LABEL_CLASS =
  'text-xs font-normal text-muted-foreground uppercase break-words leading-snug';

/** Grupos na árvore — quebra dentro da coluna fixa */
const CATALOG_GROUP_LABEL_CLASS =
  'text-xs font-semibold text-foreground/90 dark:text-foreground uppercase tracking-wide break-words leading-snug';

/** Marcador verde mediterrâneo — pais e solteiros de 1º nível na árvore */
function CatalogTierDot() {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 p38-catalog-dot-ok"
      aria-hidden="true"
    />
  );
}

/**
 * Coluna Produto: trilho compacto (chevron | dot | ícone só quando usados).
 * Texto de pais (1º nível) e solteiros alinha no mesmo eixo; filhos recuam HIER_STEP.
 */
function CatalogProdutoCell({
  hierDepth = 0,
  showChevron = false,
  isExpanded = false,
  showTierDot = false,
  showIcon = false,
  produto = null,
  children,
}) {
  const hasRail = showChevron || showTierDot || showIcon;

  return (
    <div
      className="flex items-start min-w-0 w-full"
      style={{ paddingLeft: CELL_PAD + hierDepth * HIER_STEP }}
    >
      {hasRail && (
        <div className="flex items-start gap-1.5 flex-shrink-0 pt-0.5">
          {showChevron && (
            <span className="w-3.5 h-3.5 inline-flex items-center justify-center flex-shrink-0">
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 text-muted-foreground transition-transform duration-150',
                  isExpanded && 'rotate-90',
                )}
              />
            </span>
          )}
          {showTierDot && (
            <span className="w-1.5 inline-flex items-center justify-center flex-shrink-0">
              <CatalogTierDot />
            </span>
          )}
          {showIcon && (
            <span
              className="rounded bg-muted overflow-hidden inline-flex items-center justify-center flex-shrink-0"
              style={{ width: 32, height: 32 }}
            >
              {produto?.imagem_url ? (
                <img src={produto.imagem_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </span>
          )}
        </div>
      )}
      <div className={cn('flex flex-col min-w-0 flex-1 gap-0.5', hasRail && 'ml-1.5')}>
        {children}
      </div>
    </div>
  );
}

function CatalogRowActions({ onEdit, onDelete, produto }) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon"
        className="h-6 w-6"
        onClick={(e) => { e.stopPropagation(); onEdit(produto); }}>
        <Edit className="w-3 h-3 text-muted-foreground" />
      </Button>
      <Button variant="ghost" size="icon"
        className="h-6 w-6"
        onClick={(e) => { e.stopPropagation(); onDelete(produto); }}>
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
      </Button>
    </div>
  );
}

// ── Dot de status ─────────────────────────────────────────────────────────────
function StatusDot({ produto }) {
  const e = produto.estoque_atual  || 0;
  const m = produto.estoque_minimo || 0;
  const cls = !produto.ativo           ? 'bg-muted-foreground/40'
    : e <= 0                           ? 'bg-red-500 animate-pulse'
    : e <= m                           ? 'bg-orange-400'
    : 'p38-catalog-dot-ok';
  const label = !produto.ativo ? 'Inativo' : e <= 0 ? 'Crítico' : e <= m ? 'Baixo' : 'OK';
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Valor de célula SKU ───────────────────────────────────────────────────────
function skuCellValue(colId, produto, margem, lastro, markup, salesVelocityMap = {}, catalogStockContext = null) {
  const cat = getCatalogoComercialView(produto);
  const velocity = salesVelocityMap[String(produto?.id)];
  switch (colId) {
    case 'status':               return <StatusDot produto={produto} />;
    case 'codigo_interno':       return <span className="text-[10px] font-mono text-muted-foreground">{produto.codigo_interno || '—'}</span>;
    case 'codigo_barras':        return <span className="text-[10px] font-mono text-muted-foreground">{produto.codigo_barras || '—'}</span>;
    case 'categoria':            return <span className="text-xs text-muted-foreground uppercase">{produto.categoria_nome || '—'}</span>;
    case 'tags':                 return (
      <div className="flex flex-wrap gap-0.5 max-w-[100px]">
        {(produto.tags || []).slice(0, 2).map(t => (
          <span key={t} className="text-[9px] bg-muted text-muted-foreground px-1 rounded">#{t}</span>
        ))}
      </div>
    );
    case 'fornecedor':           return <span className="text-xs text-muted-foreground whitespace-nowrap">{produto.fornecedor_padrao_codigo || '—'}</span>;
    case 'preco_venda':          return (
      <span className="text-xs text-foreground/90 tabular-nums">
        {cat.precoVenda > 0 ? `R$ ${fmtR(cat.precoVenda)}` : '—'}
      </span>
    );
    case 'margem':               return <span className={`text-xs tabular-nums ${margem >= 30 ? 'p38-text-accent font-medium' : margem > 0 ? 'text-muted-foreground' : 'text-red-400'}`}>{margem > 0 ? fmtPct(margem) : '—'}</span>;
    case 'preco_custo':          return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {cat.custoNaEmbalagem > 0 ? `R$ ${fmtR(cat.custoNaEmbalagem)}` : '—'}
      </span>
    );
    case 'valor_compra':         return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {cat.valorCompraNaEmbalagem > 0 ? `R$ ${fmtR(cat.valorCompraNaEmbalagem)}` : '—'}
      </span>
    );
    case 'markup':               return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {lastro >= 0 && markup > 0 ? `${fmtN(markup)}%` : (produto.preco_venda_percentual > 0 ? `${fmtN(produto.preco_venda_percentual)}%` : '—')}
      </span>
    );
    case 'avaria_percentual':    return (
      <span className="text-xs text-muted-foreground tabular-nums">
        {(produto.avaria_percentual || 0) > 0 ? `${fmtN(produto.avaria_percentual)}%` : '—'}
      </span>
    );
    case 'inventario_valorizado':return <span className="text-xs text-muted-foreground tabular-nums">{lastro > 0 ? fmtR(lastro) : '—'}</span>;
    case 'estoque_atual': {
      const est = resolveCatalogEstoqueExibicao(produto, catalogStockContext);
      return (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={est.virtual && est.pendente > 0 ? 'Estoque virtual (inclui pedidos em trânsito)' : undefined}
        >
          {est.virtual && est.pendente > 0 ? '~' : ''}
          {fmtN(est.quantidade)} {est.unidade}
        </span>
      );
    }
    case 'media_30d': {
      const text = formatCatalogMedia30d(velocity);
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {text || '—'}
        </span>
      );
    }
    case 'ponto_futuro': {
      const text = formatCatalogPontoFuturo(produto, velocity, {}, catalogStockContext);
      const negativo = getCatalogPontoFuturo(produto, velocity, catalogStockContext) < 0;
      return (
        <span
          className={cn(
            'text-xs tabular-nums',
            negativo
              ? 'text-amber-700 dark:text-amber-300 font-medium'
              : 'text-muted-foreground',
          )}
        >
          {text || '—'}
        </span>
      );
    }
    case 'ponto_esperado_lt': {
      const lt = getCatalogLeadTimeDias(produto);
      const text = formatCatalogPontoEsperadoLt(velocity, lt);
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {text || '—'}
        </span>
      );
    }
    case 'estoque_minimo':       return renderMetaQuantidade(produto, 'estoque_minimo');
    case 'estoque_ideal':        return renderMetaQuantidade(produto, 'estoque_ideal');
    case 'estoque_maximo':       return renderMetaQuantidade(produto, 'estoque_maximo');
    case 'tempo_reposicao':      return <span className="text-xs text-muted-foreground tabular-nums">{produto.tempo_reposicao_dias || 0}d</span>;
    case 'peso':                 return <span className="text-xs text-muted-foreground tabular-nums">{fmtN(produto.peso_kg)}kg</span>;
    case 'dimensoes':            return <span className="text-xs text-muted-foreground">{produto.dimensoes_cm || '—'}</span>;
    case 'tipo':                 return <span className="text-xs text-muted-foreground">{produto.tipo || '—'}</span>;
    case 'unidade': {
      const { unidadeBase, unidadeComercial, mostramMesma } = getCatalogUnitLabels(produto);
      return (
        <span className="flex flex-col text-xs text-muted-foreground leading-tight">
          <span>{unidadeBase || '—'}</span>
          {!mostramMesma && (
            <span className="text-[9px] text-muted-foreground dark:text-muted-foreground mt-0.5">Vitrine: {unidadeComercial}</span>
          )}
        </span>
      );
    }
    case 'unidades_pacote':      return <span className="text-xs text-muted-foreground">{produto.unidades_por_pacote || 1}</span>;
    case 'abcd':                 return <AbcdBadge letter={produto.abcd} />;
    case 'iep_score':            return scoreCell(produto.iep_score, false, produto?.iep_confianca_simbolo || '');
    case 'iep_codigo_comportamento':
      return <IepCodigoBadge code={produto?.iep_codigo_comportamento} />;
    case 'iep_score_nivel_1':    return scoreCell(produto.iep_score_nivel_1);
    case 'iep_score_nivel_2':    return scoreCell(produto.iep_score_nivel_2);
    case 'iep_score_nivel_3':    return scoreCell(produto.iep_score_nivel_3);
    case 'iep_score_nivel_4':    return scoreCell(produto.iep_score_nivel_4);
    case 'iep_score_nivel_5':    return scoreCell(produto.iep_score_nivel_5);
    default:                     return <span className="text-xs text-muted-foreground">—</span>;
  }
}

// ── Valor agregado para grupos ────────────────────────────────────────────────
function groupCellValue(colId, row, salesVelocityMap = {}, catalogStockContext = null) {
  const tilde  = v => v > 0 ? <span className="text-xs text-muted-foreground tabular-nums">~{fmtR(v)}</span> : dash();
  const tildeP = v => v > 0 ? <span className="text-xs text-muted-foreground tabular-nums">~{fmtPct(v)}</span> : dash();
  const dash   = () => <span className="text-xs text-muted-foreground dark:text-foreground/90">—</span>;
  switch (colId) {
    case 'preco_venda':           return tilde(row.precoMedio);
    case 'preco_custo':           return tilde(row.custoMedio);
    case 'valor_compra':          return tilde(row.valorCompraMedio);
    case 'markup':                return tildeP(row.markupMedio);
    case 'avaria_percentual':     return row.avariaMedia > 0 ? `~${fmtN(row.avariaMedia)}%` : '—';
    case 'margem':                return tildeP(row.margemMedia);
    case 'inventario_valorizado': return row.lastroTotal > 0
      ? <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmtR(row.lastroTotal)}</span>
      : dash();
    case 'estoque_atual': {
      const skus = collectSkus(row.node);
      const disp = aggregateCatalogEstoqueExibicao(skus, catalogStockContext);
      if (disp.mode === 'empty') return dash();
      if (disp.mode === 'mixed') {
        return (
          <span className="text-xs text-muted-foreground tabular-nums inline-flex flex-col leading-tight items-end">
            <span>{fmtN(disp.quantidade)}</span>
            <span className="text-[10px] text-muted-foreground">un. base (mistura)</span>
          </span>
        );
      }
      return (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={disp.virtual && disp.pendente > 0 ? 'Estoque virtual (inclui pedidos em trânsito)' : undefined}
        >
          {disp.virtual && disp.pendente > 0 ? '~' : ''}
          {fmtN(disp.quantidade)} {disp.sigla || (skus[0]?.unidade_principal || 'UN')}
        </span>
      );
    }
    case 'media_30d': {
      const skus = collectSkus(row.node);
      const agg = aggregateCatalogSalesVelocity(skus, salesVelocityMap);
      const text = formatCatalogMedia30d(agg, { tilde: true });
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {text || '—'}
        </span>
      );
    }
    case 'ponto_futuro': {
      const skus = collectSkus(row.node);
      const est = aggregateCatalogEstoqueExibicao(skus, catalogStockContext);
      const velAgg = aggregateCatalogSalesVelocity(skus, salesVelocityMap);
      const media30 = getCatalogMedia30dFrom60d(velAgg);
      if (est.mode === 'empty') {
        return <span className="text-xs text-muted-foreground tabular-nums">—</span>;
      }
      const ponto = est.quantidade - media30;
      const un = velAgg.unidade || est.sigla;
      const text = formatCatalogPontoFuturoQuantidade(ponto, un, { tilde: true });
      return (
        <span
          className={cn(
            'text-xs tabular-nums',
            ponto < 0
              ? 'text-amber-700 dark:text-amber-300 font-medium'
              : 'text-muted-foreground',
          )}
        >
          {text || '—'}
        </span>
      );
    }
    case 'ponto_esperado_lt': {
      const skus = collectSkus(row.node);
      const agg = aggregateCatalogPontoEsperadoLt(skus, salesVelocityMap);
      const text = formatCatalogSalesQuantity(agg.quantidade, agg.unidade, { tilde: true });
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {text || '—'}
        </span>
      );
    }
    case 'estoque_minimo':        return renderGroupMetaQuantidade(collectSkus(row.node), 'estoque_minimo');
    case 'estoque_ideal':         return renderGroupMetaQuantidade(collectSkus(row.node), 'estoque_ideal');
    case 'estoque_maximo':        return renderGroupMetaQuantidade(collectSkus(row.node), 'estoque_maximo');
    case 'peso':                  return <span className="text-xs text-muted-foreground tabular-nums">{fmtN(row.pesoTotal)}kg</span>;
    case 'status':                return row.criticalCount > 0
      ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">
          {row.criticalCount} crítico{row.criticalCount > 1 ? 's' : ''}
        </Badge>
      )
      : (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium p38-catalog-badge-ok">
          OK
        </Badge>
      );
    case 'abcd':                  return <AbcdBadge letter={row.abcdDominante} />;
    case 'iep_score':             return scoreCell(row.iepScoreMedio, true, row.iepConfiancaSimbolo || '');
    case 'iep_codigo_comportamento':
      return <IepCodigoBadge code={row.iepCodigoComportamentoDominante} />;
    case 'iep_score_nivel_1':     return scoreCell(row.iepScoreNivel1Medio, true);
    case 'iep_score_nivel_2':     return scoreCell(row.iepScoreNivel2Medio, true);
    case 'iep_score_nivel_3':     return scoreCell(row.iepScoreNivel3Medio, true);
    case 'iep_score_nivel_4':     return scoreCell(row.iepScoreNivel4Medio, true);
    case 'iep_score_nivel_5':     return scoreCell(row.iepScoreNivel5Medio, true);
    default:                      return dash();
  }
}

// ── Linha de Grupo ─────────────────────────────────────────────────────────────
const GroupRow = React.memo(function GroupRow({ row, isExpanded, onToggle, activeCols, produtoWidth, produtoCellStyle, readOnly, salesVelocityMap, catalogStockContext }) {
  const isPrimeiroNivel = row.level === 1;
  const hierDepth = catalogHierDepth(row.level);

  return (
    <tr
      className={cn(p38Table.row, p38Table.rowInteractive, 'select-none group')}
      onClick={() => onToggle(row.key)}
    >
      <td
        className={cn(CATALOG_PRODUTO_STICKY_CELL, 'py-2 px-2 align-top')}
        style={{ left: 0, ...produtoCellStyle }}
      >
        <CatalogProdutoCell
          hierDepth={hierDepth}
          showChevron
          isExpanded={isExpanded}
          showTierDot={isPrimeiroNivel}
          showIcon={false}
        >
          <div className="flex items-start gap-1 min-w-0 w-full">
            <span className={cn(CATALOG_GROUP_LABEL_CLASS, 'flex-1 min-w-0')}>
              {row.label}
            </span>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium border-border/40 text-muted-foreground dark:border-border/40 dark:text-muted-foreground flex-shrink-0">
              {row.count}
            </Badge>
          </div>
        </CatalogProdutoCell>
      </td>
      {activeCols.map(col => (
        <td key={col.id} className="text-right py-2 px-2 whitespace-nowrap"
          style={{ width: col.width, minWidth: col.minW }}>
          {groupCellValue(col.id, row, salesVelocityMap, catalogStockContext)}
        </td>
      ))}
    </tr>
  );
});

// ── Linha de SKU ───────────────────────────────────────────────────────────────
const SkuRow = React.memo(function SkuRow({ row, onEdit, onDelete, activeCols, produtoWidth, produtoCellStyle, readOnly, salesVelocityMap, catalogStockContext }) {
  const p = row.produto;
  const isPrimeiroNivel = row.level === 1;
  const hierDepth = catalogHierDepth(row.level);

  return (
    <tr className={cn(p38Table.row, 'group')}>
      <td
        className={cn(CATALOG_PRODUTO_STICKY_CELL, 'py-2 px-2 align-top')}
        style={{ left: 0, ...produtoCellStyle }}
      >
        <div className="flex items-start gap-1 min-w-0 w-full">
          <CatalogProdutoCell
            hierDepth={hierDepth}
            showTierDot={isPrimeiroNivel}
            showIcon
            produto={p}
          >
            <span className={isPrimeiroNivel ? CATALOG_ROW_DESC_CLASS : CATALOG_CHILD_LABEL_CLASS}>
              {p.nome}
            </span>
            {p.codigo_interno && (
              <span className="text-[10px] font-mono text-muted-foreground break-all leading-tight">
                {p.codigo_interno}
              </span>
            )}
          </CatalogProdutoCell>
          {!readOnly && (
            <CatalogRowActions onEdit={onEdit} onDelete={onDelete} produto={p} />
          )}
        </div>
      </td>
      {activeCols.map(col => (
        <td key={col.id} className="text-right py-1.5 px-2 whitespace-nowrap"
          style={{ width: col.width, minWidth: col.minW }}>
          {skuCellValue(col.id, p, row.margem, row.lastro, row.markup, salesVelocityMap, catalogStockContext)}
        </td>
      ))}
    </tr>
  );
});

// ── Componente Principal ───────────────────────────────────────────────────────
// masterLevel é controlado pelo pai (painel fixo da página Produtos).
// expandedKeys é gerenciado internamente — toggle manual do usuário funciona
// independente do nível selecionado.
export default function TreeGrid({ produtos, onEdit, onDelete, visibleColumns = DEFAULT_COLS, masterLevel = TREE_GRID_EXPAND_ALL_LEVEL, readOnly = false, sortOrder = 'az', groupByCategory = false, onExpandedKeysChange, salesVelocityMap = {}, catalogStockContext = null, catalogFilters = null }) {
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const scrollContainerRef = useRef(null);
  const treeRef = useRef(null);
  const pendingScrollRestoreRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const rawTree = useCatalogTreeGrid(produtos, { groupByCategory });
  const tree = useMemo(
    () =>
      pruneTreeForGroupAnalysis(rawTree, {
        filters: catalogFilters,
        salesVelocityMap,
        catalogStockContext,
      }),
    [rawTree, catalogFilters, salesVelocityMap, catalogStockContext],
  );
  treeRef.current = tree;

  const produtosStructureSig = useMemo(
    () => catalogProdutosStructureSig(produtos, { groupByCategory }),
    [produtos, groupByCategory]
  );
  const groupAnalysisSig = useMemo(
    () => catalogGroupAnalysisSig(catalogFilters),
    [catalogFilters]
  );
  const flattenOptions = useMemo(
    () => getCatalogFlattenOptions(catalogFilters),
    [catalogFilters]
  );

  // Reinicia expansão só quando filtros/hierarquia mudam — não a cada rebuild por ABCD/IEP ou preços.
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      pendingScrollRestoreRef.current = scrollEl.scrollTop;
    }
    setExpandedKeys(
      resolveExpandedKeysForMasterLevel(treeRef.current, masterLevel, groupByCategory),
    );
  }, [produtosStructureSig, groupByCategory, masterLevel, groupAnalysisSig]);

  useEffect(() => {
    onExpandedKeysChange?.(expandedKeys);
  }, [expandedKeys, onExpandedKeysChange]);

  const rows = useMemo(
    () => mergeAdjacentDuplicateGroupHeaders(flattenTree(tree, expandedKeys, '', 0, sortOrder, flattenOptions)),
    [tree, expandedKeys, sortOrder, flattenOptions]
  );

  const produtoColWidth = useMemo(() => {
    let maxHierDepth = 0;
    const labels = [];
    for (const row of rows) {
      maxHierDepth = Math.max(maxHierDepth, catalogHierDepth(row.level));
      if (row.type === 'group') labels.push(row.label);
      else labels.push(row.produto?.nome);
    }
    return computeCatalogProdutoColWidth(labels, {
      readOnly,
      maxHierDepth,
      includeGroupBadge: rows.some((row) => row.type === 'group'),
    });
  }, [rows, readOnly]);

  useLayoutEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const top = pendingScrollRestoreRef.current;
    if (scrollEl != null && top != null) {
      scrollEl.scrollTop = top;
      pendingScrollRestoreRef.current = null;
    }
  }, [expandedKeys, rows.length]);

  const handleToggle = useCallback((key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Callbacks estáveis para onDelete fallback — evita recriar funções inline no map
  const noopDelete = useCallback(() => {}, []);

  const activeCols = useMemo(() => {
    const defsById = new Map(COL_DEFS.map((col) => [col.id, col]));
    return visibleColumns.map((id) => defsById.get(id)).filter(Boolean);
  }, [visibleColumns]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const columnLayout = useMemo(
    () => computeTreeGridColumnLayout({
      rows,
      activeCols,
      readOnly,
      containerWidth,
      salesVelocityMap,
      produtoWidth: produtoColWidth,
    }),
    [rows, activeCols, readOnly, containerWidth, salesVelocityMap, produtoColWidth],
  );
  const { produtoWidth, cols: layoutCols, tableWidth } = columnLayout;
  const produtoCellStyle = useMemo(
    () => catalogProdutoColStyle(produtoWidth),
    [produtoWidth],
  );

  const estimateRowSize = useCallback(
    (index) => {
      const row = rows[index];
      if (!row) return 52;
      if (row.type === 'group') {
        return estimateCatalogProdutoRowHeight(row.label, { colWidth: produtoWidth, isGroup: true });
      }
      return estimateCatalogProdutoRowHeight(row.produto?.nome, {
        colWidth: produtoWidth,
        codigoInterno: Boolean(row.produto?.codigo_interno),
      });
    },
    [rows, produtoWidth],
  );
  const virtualRows = useVirtualRows({
    itemCount: rows.length,
    estimateSize: estimateRowSize,
    overscan: 10,
    scrollElementRef: scrollContainerRef,
  });
  const shouldVirtualizeRows = rows.length >= CATALOGO_VIRTUALIZE_MIN_ROWS;
  const visibleRows = useMemo(
    () => shouldVirtualizeRows ? rows.slice(virtualRows.startIndex, virtualRows.endIndex) : rows,
    [rows, shouldVirtualizeRows, virtualRows.endIndex, virtualRows.startIndex]
  );
  const paddingTop = shouldVirtualizeRows ? virtualRows.paddingTop : 0;
  const paddingBottom = shouldVirtualizeRows ? virtualRows.paddingBottom : 0;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Scroll container — tabela rola livremente; coluna Produto é sticky */}
      <div
        className="flex-1 overflow-auto p38-catalog-table-scroll overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]"
        style={{ WebkitOverflowScrolling: 'touch' }}
        ref={scrollContainerRef}
      >
        <table
          style={{
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
            width: tableWidth,
          }}
        >
          {/* thead sticky no topo durante scroll vertical */}
          <thead className={p38Table.headerSolid}>
            <tr>
              <th
                className={cn(CATALOG_PRODUTO_STICKY_HEAD, p38Table.head, CATALOG_ROW_LABEL_CLASS, "text-left py-2")}
                style={{ left: 0, paddingLeft: 8, paddingRight: 8, ...produtoCellStyle }}
              >
                Produto
              </th>
              {layoutCols.map(col => (
                <th key={col.id}
                  className={cn(p38Table.head, p38Table.headRight, CATALOG_ROW_LABEL_CLASS, "py-2 whitespace-nowrap")}
                  style={{ width: col.width, minWidth: col.minW }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={layoutCols.length + 1} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              <>
                <VirtualPaddingRow height={paddingTop} produtoWidth={produtoWidth} activeCols={layoutCols} />
                {visibleRows.map(row =>
                  row.type === 'group'
                    ? <GroupRow key={row.key} row={row}
                        isExpanded={expandedKeys.has(row.key)}
                        onToggle={handleToggle}
                        activeCols={layoutCols}
                        produtoWidth={produtoWidth}
                        produtoCellStyle={produtoCellStyle}
                        readOnly={readOnly}
                        salesVelocityMap={salesVelocityMap}
                        catalogStockContext={catalogStockContext} />
                    : <SkuRow key={row.key} row={row}
                        onEdit={onEdit}
                        onDelete={onDelete || noopDelete}
                        activeCols={layoutCols}
                        produtoWidth={produtoWidth}
                        produtoCellStyle={produtoCellStyle}
                        readOnly={readOnly}
                        salesVelocityMap={salesVelocityMap}
                        catalogStockContext={catalogStockContext} />
                )}
                <VirtualPaddingRow height={paddingBottom} produtoWidth={produtoWidth} activeCols={layoutCols} />
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}