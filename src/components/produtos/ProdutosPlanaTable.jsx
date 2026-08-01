import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Edit, Package, Trash2 } from 'lucide-react';
import { isCadastroIncompleto, getStockStatusIndicator } from './ProdutosHelpers';
import { getUnidadeExibicaoSigla, getCatalogUnitLabels, getCatalogoComercialView, resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { formatCatalogMedia30d, formatCatalogPontoEsperadoLt, formatCatalogPontoFuturo, getCatalogLeadTimeDias, getCatalogPontoFuturo } from '@/lib/catalogSalesVelocity';
import { resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { formatQuantidadeCatalogoApresentacao } from '@/lib/productUnits';
import { p38Table } from '@/lib/p38TableSurfaces';
import { cn } from '@/components/utils';

const PRODUTO_MIN_WIDTH = 280;
const PRODUTO_STICKY_SHADOW = 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)]';

const CATALOG_ROW_LABEL_CLASS =
  'text-xs font-semibold text-foreground/90 dark:text-foreground whitespace-nowrap uppercase tracking-wide';

const DATA_CELL_CLASS = 'text-right py-1.5 px-2 whitespace-nowrap align-middle';

const headMap = {
  status: 'Status',
  cadastro: 'Cadastro',
  codigo_interno: 'Código',
  codigo_barras: 'Cód. Barras',
  categoria: 'Categoria',
  tags: 'Tags',
  fornecedor: 'Fornecedor',
  preco_venda: 'Preço Venda',
  preco_custo: 'Custo Total',
  margem: 'Margem',
  valor_compra: 'Vl. Compra',
  markup: 'Markup %',
  estoque_atual: 'Estoque',
  media_30d: 'Média 30d',
  ponto_futuro: 'Ponto futuro',
  ponto_esperado_lt: 'Ponto LT',
  estoque_minimo: 'Est. Mín',
  estoque_ideal: 'Est. Ideal',
  estoque_maximo: 'Est. Máx',
  tempo_reposicao: 'Repos.',
  peso: 'Peso',
  dimensoes: 'Dimensões',
  tipo: 'Tipo',
  unidade: 'Unid.',
  unidades_pacote: 'Un/Pct',
  show_comercial: 'Unidade comercial (PDV)',
  show_logistica: 'Unidade de exibição (sigla)',
  inventario_valorizado: 'Inventário valorizado',
};

const widthMap = {
  status: 100,
  cadastro: 110,
  codigo_interno: 110,
  codigo_barras: 130,
  categoria: 130,
  tags: 130,
  fornecedor: 140,
  preco_venda: 110,
  preco_custo: 110,
  margem: 90,
  valor_compra: 110,
  markup: 90,
  estoque_atual: 110,
  media_30d: 100,
  ponto_futuro: 100,
  ponto_esperado_lt: 100,
  estoque_minimo: 90,
  estoque_ideal: 90,
  estoque_maximo: 90,
  tempo_reposicao: 100,
  peso: 90,
  dimensoes: 120,
  tipo: 90,
  unidade: 70,
  unidades_pacote: 90,
  show_comercial: 120,
  show_logistica: 120,
  inventario_valorizado: 120,
};

function PlanaRowActions({ produto, onEdit, onDelete, onCreateSimilar }) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => { e.stopPropagation(); onEdit(produto); }}
      >
        <Edit className="w-3 h-3 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => { e.stopPropagation(); onCreateSimilar(produto); }}
      >
        <Copy className="w-3 h-3 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => { e.stopPropagation(); onDelete(produto); }}
      >
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
      </Button>
    </div>
  );
}

function renderPlanaCellContent(col, { produto, cadastroStatus, cat, margem, formatarNumero, fornecedorMap, salesVelocityMap = {}, catalogStockContext = null }) {
  const velocity = salesVelocityMap[String(produto?.id)];
  switch (col) {
    case 'codigo_interno':
      return <span className="text-[10px] font-mono text-muted-foreground">{produto.codigo_interno || '—'}</span>;
    case 'codigo_barras':
      return <span className="text-[10px] font-mono text-muted-foreground">{produto.codigo_barras || '—'}</span>;
    case 'categoria':
      return <span className="text-xs text-muted-foreground uppercase">{produto.categoria_nome || '—'}</span>;
    case 'tags':
      return (
        <div className="flex flex-wrap gap-0.5 max-w-[100px] justify-end ml-auto">
          {(produto.tags || []).slice(0, 2).map(tag => (
            <span key={tag} className="text-[9px] bg-muted text-muted-foreground px-1 rounded">#{tag}</span>
          ))}
        </div>
      );
    case 'status':
      return getStockStatusIndicator(produto);
    case 'cadastro':
      return cadastroStatus.incompleto ? (
        <div className="flex flex-col gap-0.5 items-end">
          {cadastroStatus.checks.semCategoria && <span className="text-[10px] text-red-600 dark:text-red-400">Sem categoria</span>}
          {cadastroStatus.checks.semFornecedor && <span className="text-[10px] text-red-600 dark:text-red-400">Sem fornecedor</span>}
          {cadastroStatus.checks.semPrecoVenda && <span className="text-[10px] text-red-600 dark:text-red-400">Sem preço</span>}
          {cadastroStatus.checks.semCodigoBarras && <span className="text-[10px] text-red-600 dark:text-red-400">Sem cód. barras</span>}
          {cadastroStatus.checks.semImagem && <span className="text-[10px] text-red-600 dark:text-red-400">Sem imagem</span>}
        </div>
      ) : (
        <span className="text-xs p38-text-accent">Completo</span>
      );
    case 'fornecedor':
      return (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {fornecedorMap[produto.fornecedor_padrao_id] || '—'}
        </span>
      );
    case 'preco_venda':
      return (
        <span className="text-xs text-foreground/90 tabular-nums">
          {cat.precoVenda > 0 ? `R$ ${formatarNumero(cat.precoVenda)}` : '—'}
        </span>
      );
    case 'margem':
      return (
        <span className={cn(
          'text-xs tabular-nums',
          margem >= 30 ? 'p38-text-accent font-medium' : margem > 0 ? 'text-muted-foreground' : 'text-red-400',
        )}>
          {margem > 0 ? `${formatarNumero(margem)}%` : '—'}
        </span>
      );
    case 'preco_custo':
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {cat.custoNaEmbalagem > 0 ? `R$ ${formatarNumero(cat.custoNaEmbalagem)}` : '—'}
        </span>
      );
    case 'valor_compra':
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {cat.valorCompraNaEmbalagem > 0 ? `R$ ${formatarNumero(cat.valorCompraNaEmbalagem)}` : '—'}
        </span>
      );
    case 'markup':
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {cat.markupSobreCustoPct > 0 ? `${formatarNumero(cat.markupSobreCustoPct)}%` : (produto.preco_venda_percentual > 0 ? `${formatarNumero(produto.preco_venda_percentual)}%` : '—')}
        </span>
      );
    case 'estoque_atual': {
      const est = resolveCatalogEstoqueExibicao(produto, catalogStockContext);
      return (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={est.virtual && est.pendente > 0 ? 'Estoque virtual (inclui pedidos em trânsito)' : undefined}
        >
          {est.virtual && est.pendente > 0 ? '~' : ''}
          {formatarNumero(est.quantidade)} {est.unidade}
        </span>
      );
    }
    case 'media_30d':
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCatalogMedia30d(velocity) || '—'}
        </span>
      );
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
    case 'ponto_esperado_lt':
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCatalogPontoEsperadoLt(velocity, getCatalogLeadTimeDias(produto)) || '—'}
        </span>
      );
    case 'estoque_minimo': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_minimo || 0);
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_minimo || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </span>
      );
    }
    case 'estoque_ideal': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_ideal || 0);
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_ideal || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </span>
      );
    }
    case 'estoque_maximo': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_maximo || 0);
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_maximo || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </span>
      );
    }
    case 'tempo_reposicao':
      return <span className="text-xs text-muted-foreground tabular-nums">{produto.tempo_reposicao_dias || 0}d</span>;
    case 'peso':
      return <span className="text-xs text-muted-foreground tabular-nums">{formatarNumero(produto.peso_kg)}kg</span>;
    case 'dimensoes':
      return <span className="text-xs text-muted-foreground">{produto.dimensoes_cm || '—'}</span>;
    case 'tipo':
      return <span className="text-xs text-muted-foreground">{produto.tipo || '—'}</span>;
    case 'unidade': {
      const { unidadeBase, unidadeComercial, mostramMesma } = getCatalogUnitLabels(produto);
      return (
        <span className="flex flex-col text-xs text-muted-foreground leading-tight items-end">
          <span>{unidadeBase || '—'}</span>
          {!mostramMesma && (
            <span className="text-[9px] text-muted-foreground mt-0.5">Vitrine: {unidadeComercial}</span>
          )}
        </span>
      );
    }
    case 'unidades_pacote':
      return <span className="text-xs text-muted-foreground">{produto.unidades_por_pacote || 1}</span>;
    case 'inventario_valorizado': {
      const custo = resolveCustoTotalUnitBaseProduto(produto);
      const lastro = custo * (produto.estoque_atual || 0);
      return <span className="text-xs text-muted-foreground tabular-nums">{lastro > 0 ? `R$ ${formatarNumero(lastro)}` : '—'}</span>;
    }
    case 'show_comercial':
      return <span className="text-xs text-muted-foreground">{getUnidadeExibicaoSigla(produto, produto.unidade_principal || 'UN')}</span>;
    case 'show_logistica':
      return (
        <span className="text-xs text-muted-foreground">
          {(produto.unidade_exibicao_sigla || getUnidadeExibicaoSigla(produto, produto.unidade_principal || 'UN') || produto.unidade_show_logistica || '—').toString().toUpperCase()}
        </span>
      );
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
}

export default function ProdutosPlanaTable({
  filteredProdutos,
  visibleColumns,
  handleEdit,
  setProdutoParaExcluir,
  formatarNumero,
  fornecedorMap,
  handleCreateSimilar,
  readOnly = false,
  embedded = false,
  salesVelocityMap = {},
  catalogStockContext = null,
}) {
  const scrollContainerRef = useRef(null);
  const virtualRows = useVirtualRows({
    itemCount: filteredProdutos.length,
    estimateSize: 46,
    overscan: 10,
    scrollElementRef: scrollContainerRef,
  });
  const visibleProdutos = filteredProdutos.slice(virtualRows.startIndex, virtualRows.endIndex);
  const colSpan = 1 + visibleColumns.length;
  const containerClass = embedded
    ? 'w-full h-full overflow-auto bg-background'
    : 'hidden desktop-layout:block w-full h-full overflow-auto border border-border/40 rounded bg-background';

  return (
    <div
      ref={scrollContainerRef}
      className={cn(containerClass, 'overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]')}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <table
        className={cn(p38Table.bodyText)}
        style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: '100%' }}
      >
        <thead className={p38Table.headerSolid}>
          <tr className="border-b border-border/40 dark:border-white/10">
            <th
              className={cn(
                p38Table.stickyHeadLeft,
                p38Table.stickyCell,
                PRODUTO_STICKY_SHADOW,
                p38Table.head,
                CATALOG_ROW_LABEL_CLASS,
                'text-left py-2',
              )}
              style={{ left: 0, paddingLeft: 8, paddingRight: 8, width: PRODUTO_MIN_WIDTH, minWidth: PRODUTO_MIN_WIDTH }}
            >
              Produto
            </th>
            {visibleColumns.map(col => (
              <th
                key={col}
                className={cn(p38Table.head, p38Table.headRight, CATALOG_ROW_LABEL_CLASS, 'py-2 whitespace-nowrap')}
                style={{ width: widthMap[col] || 90, minWidth: widthMap[col] || 90 }}
              >
                {headMap[col] || col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtualRows.paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colSpan} style={{ height: virtualRows.paddingTop, padding: 0, border: 0 }} />
            </tr>
          )}
          {visibleProdutos.map(produto => {
            const cat = getCatalogoComercialView(produto);
            const margem =
              cat.precoVenda > 0 && cat.custoNaEmbalagem >= 0 ? cat.margemContribuicaoPct : 0;
            const cadastroStatus = isCadastroIncompleto(produto);
            const cellCtx = { produto, cadastroStatus, cat, margem, formatarNumero, fornecedorMap, salesVelocityMap, catalogStockContext };

            return (
              <tr key={produto.id} className={cn(p38Table.row, 'group')}>
                <td
                  className={cn(p38Table.stickyCellLeft, p38Table.stickyCell, PRODUTO_STICKY_SHADOW, 'py-1.5')}
                  style={{ left: 0, paddingRight: 8, width: PRODUTO_MIN_WIDTH, minWidth: PRODUTO_MIN_WIDTH }}
                >
                  <div className="flex items-center gap-1 w-max max-w-none">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="rounded bg-muted overflow-hidden inline-flex items-center justify-center flex-shrink-0"
                        style={{ width: 32, height: 32 }}
                      >
                        {produto.imagem_url ? (
                          <img src={produto.imagem_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 ml-1.5">
                        <span className={CATALOG_ROW_LABEL_CLASS}>{produto.nome}</span>
                        {produto.codigo_interno && (
                          <span className="text-[10px] flex-shrink-0 font-mono whitespace-nowrap text-foreground/70 dark:text-foreground/80">
                            {produto.codigo_interno}
                          </span>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <PlanaRowActions
                        produto={produto}
                        onEdit={handleEdit}
                        onDelete={setProdutoParaExcluir}
                        onCreateSimilar={handleCreateSimilar}
                      />
                    )}
                  </div>
                </td>
                {visibleColumns.map((col) => (
                  <td
                    key={col}
                    className={DATA_CELL_CLASS}
                    style={{ width: widthMap[col] || 90, minWidth: widthMap[col] || 90 }}
                  >
                    {renderPlanaCellContent(col, cellCtx)}
                  </td>
                ))}
              </tr>
            );
          })}
          {virtualRows.paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colSpan} style={{ height: virtualRows.paddingBottom, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
