import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Copy, Package } from 'lucide-react';
import { isCadastroIncompleto, getStockStatusIndicator } from './ProdutosHelpers';
import { formatEstoqueApresentacao, getUnidadeExibicaoSigla, getCatalogUnitLabels, getCatalogoComercialView, resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { formatCatalogMedia30d, formatCatalogMetaQuantidade, formatCatalogPontoEsperadoLt, formatCatalogPontoFuturo, getCatalogLeadTimeDias, getCatalogPontoFuturo } from '@/lib/catalogSalesVelocity';
import { resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { formatQuantidadeCatalogoApresentacao } from '@/lib/productUnits';
import { p38Table } from '@/lib/p38TableSurfaces';
import { cn } from '@/components/utils';

const ACTIONS_WIDTH = 50;
const IMAGE_WIDTH = 60;
const PRODUCT_LEFT = ACTIONS_WIDTH + IMAGE_WIDTH;

const PRODUTO_STICKY_SHADOW = 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)]';

const CATALOG_ROW_LABEL_CLASS =
  'text-xs font-semibold text-foreground/90 dark:text-foreground whitespace-nowrap uppercase tracking-wide';

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
  status: 'min-w-[100px]',
  cadastro: 'min-w-[110px]',
  codigo_interno: 'min-w-[110px]',
  codigo_barras: 'min-w-[130px]',
  categoria: 'min-w-[130px]',
  tags: 'min-w-[130px]',
  fornecedor: 'min-w-[140px]',
  preco_venda: 'min-w-[110px]',
  preco_custo: 'min-w-[110px]',
  margem: 'min-w-[90px]',
  valor_compra: 'min-w-[110px]',
  markup: 'min-w-[90px]',
  estoque_atual: 'min-w-[110px]',
  media_30d: 'min-w-[100px]',
  ponto_futuro: 'min-w-[100px]',
  ponto_esperado_lt: 'min-w-[100px]',
  estoque_minimo: 'min-w-[90px]',
  estoque_ideal: 'min-w-[90px]',
  estoque_maximo: 'min-w-[90px]',
  tempo_reposicao: 'min-w-[100px]',
  peso: 'min-w-[90px]',
  dimensoes: 'min-w-[120px]',
  tipo: 'min-w-[90px]',
  unidade: 'min-w-[70px]',
  unidades_pacote: 'min-w-[90px]',
  show_comercial: 'min-w-[120px]',
  show_logistica: 'min-w-[120px]',
  inventario_valorizado: 'min-w-[120px]',
};

function renderProdutoColumnCell(col, { produto, cadastroStatus, cat, margem, formatarNumero, fornecedorMap, salesVelocityMap = {}, catalogStockContext = null }) {
  const velocity = salesVelocityMap[String(produto?.id)];
  switch (col) {
    case 'codigo_interno':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.codigo_interno}</TableCell>;
    case 'codigo_barras':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.codigo_barras || '-'}</TableCell>;
    case 'categoria':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.categoria_nome || '-'}</TableCell>;
    case 'tags':
      return <TableCell key={col}><div className="flex flex-wrap gap-1">{(produto.tags || []).slice(0, 2).map(tag => <span key={tag} className="text-[10px] px-1 py-0.5 bg-muted text-foreground/90 rounded">#{tag}</span>)}</div></TableCell>;
    case 'status':
      return <TableCell key={col}>{getStockStatusIndicator(produto)}</TableCell>;
    case 'cadastro':
      return <TableCell key={col}>{cadastroStatus.incompleto ? <div className="flex flex-col gap-0.5">{cadastroStatus.checks.semCategoria && <span className="text-[10px] text-red-600 dark:text-red-400">Sem categoria</span>}{cadastroStatus.checks.semFornecedor && <span className="text-[10px] text-red-600 dark:text-red-400">Sem fornecedor</span>}{cadastroStatus.checks.semPrecoVenda && <span className="text-[10px] text-red-600 dark:text-red-400">Sem preço</span>}{cadastroStatus.checks.semCodigoBarras && <span className="text-[10px] text-red-600 dark:text-red-400">Sem cód. barras</span>}{cadastroStatus.checks.semImagem && <span className="text-[10px] text-red-600 dark:text-red-400">Sem imagem</span>}</div> : <span className="text-xs p38-text-accent">Completo</span>}</TableCell>;
    case 'fornecedor':
      return <TableCell key={col}>{fornecedorMap[produto.fornecedor_padrao_id] ? <div className="text-xs text-muted-foreground">{fornecedorMap[produto.fornecedor_padrao_id]}</div> : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>;
    case 'preco_venda':
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          R$ {formatarNumero(cat.precoVenda)}
        </TableCell>
      );
    case 'margem':
      return (
        <TableCell key={col} className="text-xs tabular-nums">
          <span className={cn(
            margem >= 30 ? 'p38-text-accent font-medium' : margem > 0 ? 'text-muted-foreground' : 'text-red-400',
          )}>
            {margem > 0 ? `${formatarNumero(margem)}%` : '—'}
          </span>
        </TableCell>
      );
    case 'preco_custo':
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          R$ {formatarNumero(cat.custoNaEmbalagem)}
        </TableCell>
      );
    case 'valor_compra':
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          R$ {formatarNumero(cat.valorCompraNaEmbalagem)}
        </TableCell>
      );
    case 'markup':
      return <TableCell key={col} className="text-xs text-muted-foreground">{cat.markupSobreCustoPct > 0 ? `${formatarNumero(cat.markupSobreCustoPct)}%` : `${produto.preco_venda_percentual || 0}%`}</TableCell>;
    case 'estoque_atual': {
      const est = resolveCatalogEstoqueExibicao(produto, catalogStockContext);
      return (
        <TableCell
          key={col}
          className="text-xs text-muted-foreground tabular-nums"
          title={est.virtual && est.pendente > 0 ? 'Estoque virtual (inclui pedidos em trânsito)' : undefined}
        >
          {est.virtual && est.pendente > 0 ? '~' : ''}
          {formatarNumero(est.quantidade)} {est.unidade}
        </TableCell>
      );
    }
    case 'media_30d':
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          {formatCatalogMedia30d(velocity) || '—'}
        </TableCell>
      );
    case 'ponto_futuro': {
      const text = formatCatalogPontoFuturo(produto, velocity, {}, catalogStockContext);
      const negativo = getCatalogPontoFuturo(produto, velocity, catalogStockContext) < 0;
      return (
        <TableCell key={col} className="text-xs tabular-nums">
          <span
            className={cn(
              negativo
                ? 'text-amber-700 dark:text-amber-300 font-medium'
                : 'text-muted-foreground',
            )}
          >
            {text || '—'}
          </span>
        </TableCell>
      );
    }
    case 'ponto_esperado_lt':
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          {formatCatalogPontoEsperadoLt(velocity, getCatalogLeadTimeDias(produto)) || '—'}
        </TableCell>
      );
    case 'estoque_minimo': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_minimo || 0);
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_minimo || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </TableCell>
      );
    }
    case 'estoque_ideal': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_ideal || 0);
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_ideal || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </TableCell>
      );
    }
    case 'estoque_maximo': {
      const ap = formatQuantidadeCatalogoApresentacao(produto, produto.estoque_maximo || 0);
      return (
        <TableCell key={col} className="text-xs text-muted-foreground tabular-nums">
          {(produto.estoque_maximo || 0) > 0 ? `${formatarNumero(ap.quantidade)} ${ap.sigla}` : '—'}
        </TableCell>
      );
    }
    case 'tempo_reposicao':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.tempo_reposicao_dias || 0}d</TableCell>;
    case 'peso':
      return <TableCell key={col} className="text-xs text-muted-foreground">{formatarNumero(produto.peso_kg)}kg</TableCell>;
    case 'dimensoes':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.dimensoes_cm || '-'}</TableCell>;
    case 'tipo':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.tipo}</TableCell>;
    case 'unidade': {
      const { unidadeBase, unidadeComercial, mostramMesma } = getCatalogUnitLabels(produto);
      return (
        <TableCell key={col} className="text-xs text-muted-foreground">
          <div className="flex flex-col leading-tight">
            <span>{unidadeBase}</span>
            {!mostramMesma && (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                com. {unidadeComercial}
              </span>
            )}
          </div>
        </TableCell>
      );
    }
    case 'unidades_pacote':
      return <TableCell key={col} className="text-xs text-muted-foreground">{produto.unidades_por_pacote || 1}</TableCell>;
    case 'inventario_valorizado': {
      const custo = resolveCustoTotalUnitBaseProduto(produto);
      const lastro = custo * (produto.estoque_atual || 0);
      return <TableCell key={col} className="text-xs text-muted-foreground">{lastro > 0 ? `R$ ${formatarNumero(lastro)}` : '—'}</TableCell>;
    }
    case 'show_comercial':
      return <TableCell key={col} className="text-xs text-muted-foreground">{getUnidadeExibicaoSigla(produto, produto.unidade_principal || 'UN')}</TableCell>;
    case 'show_logistica':
      return <TableCell key={col} className="text-xs text-muted-foreground">{(produto.unidade_exibicao_sigla || getUnidadeExibicaoSigla(produto, produto.unidade_principal || 'UN') || produto.unidade_show_logistica || '-').toString().toUpperCase()}</TableCell>;
    default:
      return <TableCell key={col} className="text-xs text-muted-foreground">-</TableCell>;
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
  const leadingCols = readOnly ? 1 : 3;
  const colSpan = leadingCols + visibleColumns.length;
  const productLeft = readOnly ? 0 : PRODUCT_LEFT;
  const containerClass = embedded
    ? 'w-full h-full overflow-auto bg-card'
    : 'hidden desktop-layout:block w-full h-full overflow-auto border border-border/40 rounded bg-card';

  return (
    <div
      ref={scrollContainerRef}
      className={cn(containerClass, 'overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable]')}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <table
        className={cn('w-full caption-bottom table-fixed', p38Table.bodyText)}
        style={{ borderCollapse: 'separate', borderSpacing: 0 }}
      >
        <thead className={p38Table.headerSolid}>
          <TableRow className="border-b border-border/40 dark:border-white/10 hover:bg-transparent">
            {!readOnly && (
              <TableHead
                className={cn(p38Table.stickyHeadLeft, p38Table.stickyCell, 'w-[50px] text-left py-2')}
                style={{ left: 0, paddingLeft: 4, paddingRight: 4 }}
              />
            )}
            {!readOnly && (
              <TableHead
                className={cn(p38Table.stickyHead, p38Table.stickyCell, 'min-w-[60px] text-center py-2')}
                style={{ left: ACTIONS_WIDTH }}
              >
                Img
              </TableHead>
            )}
            <TableHead
              className={cn(
                p38Table.stickyHead,
                p38Table.stickyCell,
                PRODUTO_STICKY_SHADOW,
                CATALOG_ROW_LABEL_CLASS,
                'text-left min-w-[220px] py-2',
                readOnly && p38Table.stickyHeadLeft,
              )}
              style={{ left: productLeft, paddingLeft: 8, paddingRight: 8 }}
            >
              Produto
            </TableHead>
            {visibleColumns.map(col => (
              <TableHead key={col} className={cn(p38Table.head, p38Table.headRight, 'whitespace-nowrap', widthMap[col] || 'min-w-[90px]')}>
                {headMap[col] || col}
              </TableHead>
            ))}
          </TableRow>
        </thead>
        <TableBody>
          {virtualRows.paddingTop > 0 && (
            <TableRow aria-hidden="true">
              <TableCell colSpan={colSpan} style={{ height: virtualRows.paddingTop, padding: 0, border: 0 }} />
            </TableRow>
          )}
          {visibleProdutos.map(produto => {
            const cat = getCatalogoComercialView(produto);
            const margem =
              cat.precoVenda > 0 && cat.custoNaEmbalagem >= 0 ? cat.margemContribuicaoPct : 0;
            const cadastroStatus = isCadastroIncompleto(produto);

            return (
              <TableRow key={produto.id}>
                {!readOnly && (
                  <TableCell
                    className={cn(p38Table.stickyCellLeft, p38Table.stickyCell, 'p-1')}
                    style={{ left: 0, width: ACTIONS_WIDTH, minWidth: ACTIONS_WIDTH }}
                  >
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5 text-foreground/90 dark:text-muted-foreground" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-50 dark:bg-muted dark:border-border/40" sideOffset={5}>
                        <DropdownMenuItem onClick={() => handleEdit(produto)} className="dark:text-foreground dark:hover:bg-primary/90 text-xs"><Edit className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCreateSimilar(produto)} className="dark:text-foreground dark:hover:bg-primary/90 text-xs"><Copy className="mr-2 h-3.5 w-3.5" />Produto similar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setProdutoParaExcluir(produto)} className="text-red-600 dark:text-red-400 dark:hover:bg-primary/90 text-xs"><Trash2 className="mr-2 h-3.5 w-3.5" />{produto.ativo ? 'Excluir / Inativar' : 'Reativar'}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
                {!readOnly && (
                  <TableCell
                    className={cn(p38Table.stickyCell, 'p-1 text-center')}
                    style={{ left: ACTIONS_WIDTH, width: IMAGE_WIDTH, minWidth: IMAGE_WIDTH }}
                  >
                    <div className="w-8 h-8 mx-auto bg-muted rounded-md flex items-center justify-center overflow-hidden">
                      {produto.imagem_url ? <img src={produto.imagem_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </TableCell>
                )}
                <TableCell
                  className={cn(
                    p38Table.stickyCell,
                    PRODUTO_STICKY_SHADOW,
                    'py-1.5',
                    readOnly && p38Table.stickyCellLeft,
                  )}
                  style={{ left: productLeft, paddingLeft: 8, paddingRight: 8, minWidth: 220 }}
                >
                  <div className={CATALOG_ROW_LABEL_CLASS}>{produto.nome}</div>
                  <div className="text-[10px] text-foreground/70 dark:text-foreground/80 font-mono uppercase whitespace-nowrap">{produto.codigo_interno}</div>
                </TableCell>
                {visibleColumns.map((col) => renderProdutoColumnCell(col, { produto, cadastroStatus, cat, margem, formatarNumero, fornecedorMap, salesVelocityMap, catalogStockContext }))}
              </TableRow>
            );
          })}
          {virtualRows.paddingBottom > 0 && (
            <TableRow aria-hidden="true">
              <TableCell colSpan={colSpan} style={{ height: virtualRows.paddingBottom, padding: 0, border: 0 }} />
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  );
}
