import { formatEstoqueApresentacao, getCatalogoComercialView, getCatalogUnitLabels } from '@/lib/productUnits';
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
} from '@/lib/catalogSalesVelocity';
import { aggregateEstoqueDisplay, collectSkus, aggregateMetaEstoqueDisplay } from './useTreeGrid';

const HIER_STEP = 20;
const CELL_PAD = 4;
const PRODUTO_MIN_WIDTH = 180;
const COL_PAD_X = 16;

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

let measureCanvas;

function createTextMeasurer() {
  if (typeof document === 'undefined') {
    return (text) => String(text || '').length * 7;
  }
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  return (text, { size = 12, weight = 400, family = 'Inter, system-ui, sans-serif' } = {}) => {
    const value = String(text ?? '');
    if (!value) return 0;
    ctx.font = `${weight} ${size}px ${family}`;
    return Math.ceil(ctx.measureText(value).width);
  };
}

const catalogHierDepth = (level) => Math.max(0, (level ?? 1) - 1);

function produtoCellWidth(row, readOnly, measure) {
  const hierDepth = catalogHierDepth(row.level);
  let width = CELL_PAD + hierDepth * HIER_STEP + COL_PAD_X;

  if (row.type === 'group') {
    width += 14 + 6 + 6; // chevron + dot + gaps
    width += measure(String(row.label || '').toUpperCase(), { size: 12, weight: 600 });
    width += 12 + measure(String(row.count ?? ''), { size: 10, weight: 500 });
    return Math.max(PRODUTO_MIN_WIDTH, width);
  }

  const p = row.produto || {};
  const isPrimeiroNivel = row.level === 1;
  if (isPrimeiroNivel) width += 6;
  width += 32 + 6; // ícone SKU
  width += measure(String(p.nome || '').toUpperCase(), { size: 12, weight: isPrimeiroNivel ? 600 : 400 });
  if (p.codigo_interno) {
    width += 8 + measure(String(p.codigo_interno), { size: 10, weight: 400, family: 'ui-monospace, monospace' });
  }
  if (!readOnly) width += 52;
  return Math.max(PRODUTO_MIN_WIDTH, width);
}

function skuCellText(colId, produto, row, salesVelocityMap = {}) {
  const cat = getCatalogoComercialView(produto);
  const margem = row?.margem ?? 0;
  const lastro = row?.lastro ?? 0;
  const markup = row?.markup ?? 0;
  const velocity = salesVelocityMap[String(produto?.id)];

  switch (colId) {
    case 'status': {
      const e = produto.estoque_atual || 0;
      const m = produto.estoque_minimo || 0;
      const label = !produto.ativo ? 'Inativo' : e <= 0 ? 'Crítico' : e <= m ? 'Baixo' : 'OK';
      return label;
    }
    case 'codigo_interno': return produto.codigo_interno || '—';
    case 'codigo_barras': return produto.codigo_barras || '—';
    case 'categoria': return String(produto.categoria_nome || '—').toUpperCase();
    case 'tags': return (produto.tags || []).slice(0, 2).map((t) => `#${t}`).join(' ') || '—';
    case 'fornecedor': return produto.fornecedor_padrao_codigo || '—';
    case 'preco_venda': return cat.precoVenda > 0 ? `R$ ${fmtR(cat.precoVenda)}` : '—';
    case 'margem': return margem > 0 ? fmtPct(margem) : '—';
    case 'preco_custo': return cat.custoNaEmbalagem > 0 ? `R$ ${fmtR(cat.custoNaEmbalagem)}` : '—';
    case 'valor_compra': return cat.valorCompraNaEmbalagem > 0 ? `R$ ${fmtR(cat.valorCompraNaEmbalagem)}` : '—';
    case 'markup':
      return lastro >= 0 && markup > 0
        ? `${fmtN(markup)}%`
        : (produto.preco_venda_percentual > 0 ? `${fmtN(produto.preco_venda_percentual)}%` : '—');
    case 'inventario_valorizado': return lastro > 0 ? fmtR(lastro) : '—';
    case 'estoque_atual': {
      const apresent = formatEstoqueApresentacao(produto);
      const qtd = apresent ? apresent.quantidade : produto.estoque_atual;
      const un = apresent ? apresent.sigla : (produto.unidade_principal || 'UN');
      return `${fmtN(qtd)} ${un}`;
    }
    case 'media_30d': return formatCatalogMedia30d(velocity) || '—';
    case 'ponto_futuro': return formatCatalogPontoFuturo(produto, velocity) || '—';
    case 'ponto_esperado_lt': {
      const lt = getCatalogLeadTimeDias(produto);
      return formatCatalogPontoEsperadoLt(velocity, lt) || '—';
    }
    case 'estoque_minimo': return formatCatalogMetaQuantidade(produto, produto.estoque_minimo) || '—';
    case 'estoque_ideal': return formatCatalogMetaQuantidade(produto, produto.estoque_ideal) || '—';
    case 'estoque_maximo': return formatCatalogMetaQuantidade(produto, produto.estoque_maximo) || '—';
    case 'tempo_reposicao': return `${produto.tempo_reposicao_dias || 0}d`;
    case 'peso': return `${fmtN(produto.peso_kg)}kg`;
    case 'dimensoes': return produto.dimensoes_cm || '—';
    case 'tipo': return produto.tipo || '—';
    case 'unidade': {
      const { unidadeBase, unidadeComercial, mostramMesma } = getCatalogUnitLabels(produto);
      return mostramMesma ? (unidadeBase || '—') : `${unidadeBase || '—'} Vitrine: ${unidadeComercial}`;
    }
    case 'unidades_pacote': return String(produto.unidades_por_pacote || 1);
    case 'abcd': return String(produto.abcd || '—').toUpperCase();
    case 'iep_score': {
      const score = Number(produto.iep_score);
      if (!Number.isFinite(score)) return '—';
      return `${Math.round(score)}${produto?.iep_confianca_simbolo || ''}`;
    }
    case 'iep_codigo_comportamento': return String(produto?.iep_codigo_comportamento || '—').toUpperCase();
    case 'iep_score_nivel_1': return Number.isFinite(Number(produto.iep_score_nivel_1)) ? `~${Math.round(produto.iep_score_nivel_1)}` : '—';
    case 'iep_score_nivel_2': return Number.isFinite(Number(produto.iep_score_nivel_2)) ? `~${Math.round(produto.iep_score_nivel_2)}` : '—';
    case 'iep_score_nivel_3': return Number.isFinite(Number(produto.iep_score_nivel_3)) ? `~${Math.round(produto.iep_score_nivel_3)}` : '—';
    case 'iep_score_nivel_4': return Number.isFinite(Number(produto.iep_score_nivel_4)) ? `~${Math.round(produto.iep_score_nivel_4)}` : '—';
    case 'iep_score_nivel_5': return Number.isFinite(Number(produto.iep_score_nivel_5)) ? `~${Math.round(produto.iep_score_nivel_5)}` : '—';
    default: return '—';
  }
}

function groupCellText(colId, row, salesVelocityMap = {}) {
  switch (colId) {
    case 'preco_venda': return row.precoMedio > 0 ? `~${fmtR(row.precoMedio)}` : '—';
    case 'preco_custo': return row.custoMedio > 0 ? `~${fmtR(row.custoMedio)}` : '—';
    case 'valor_compra': return row.valorCompraMedio > 0 ? `~${fmtR(row.valorCompraMedio)}` : '—';
    case 'markup': return row.markupMedio > 0 ? `~${fmtPct(row.markupMedio)}` : '—';
    case 'margem': return row.margemMedia > 0 ? `~${fmtPct(row.margemMedia)}` : '—';
    case 'inventario_valorizado': return row.lastroTotal > 0 ? fmtR(row.lastroTotal) : '—';
    case 'estoque_atual': {
      const skus = collectSkus(row.node);
      const disp = aggregateEstoqueDisplay(skus);
      if (disp.mode === 'empty') return '—';
      if (disp.mode === 'mixed') return `${fmtN(disp.quantidade)} un. base (mistura)`;
      return `${fmtN(disp.quantidade)} ${disp.sigla || (skus[0]?.unidade_principal || 'UN')}`;
    }
    case 'media_30d': {
      const skus = collectSkus(row.node);
      const agg = aggregateCatalogSalesVelocity(skus, salesVelocityMap);
      return formatCatalogMedia30d(agg, { tilde: true }) || '—';
    }
    case 'ponto_futuro': {
      const skus = collectSkus(row.node);
      const est = aggregateEstoqueDisplay(skus);
      const velAgg = aggregateCatalogSalesVelocity(skus, salesVelocityMap);
      const media30 = getCatalogMedia30dFrom60d(velAgg);
      if (est.mode === 'empty') return '—';
      const ponto = est.quantidade - media30;
      const un = velAgg.unidade || est.sigla;
      return formatCatalogPontoFuturoQuantidade(ponto, un, { tilde: true }) || '—';
    }
    case 'ponto_esperado_lt': {
      const skus = collectSkus(row.node);
      const agg = aggregateCatalogPontoEsperadoLt(skus, salesVelocityMap);
      return formatCatalogSalesQuantity(agg.quantidade, agg.unidade, { tilde: true }) || '—';
    }
    case 'estoque_minimo': {
      const disp = aggregateMetaEstoqueDisplay(collectSkus(row.node), 'estoque_minimo');
      if (disp.mode === 'empty' || disp.quantidade <= 0) return '—';
      if (disp.mode === 'mixed') return `${fmtN(disp.quantidade)} un. base (mistura)`;
      return `${fmtN(disp.quantidade)} ${disp.sigla}`;
    }
    case 'estoque_ideal': {
      const disp = aggregateMetaEstoqueDisplay(collectSkus(row.node), 'estoque_ideal');
      if (disp.mode === 'empty' || disp.quantidade <= 0) return '—';
      if (disp.mode === 'mixed') return `${fmtN(disp.quantidade)} un. base (mistura)`;
      return `${fmtN(disp.quantidade)} ${disp.sigla}`;
    }
    case 'estoque_maximo': {
      const disp = aggregateMetaEstoqueDisplay(collectSkus(row.node), 'estoque_maximo');
      if (disp.mode === 'empty' || disp.quantidade <= 0) return '—';
      if (disp.mode === 'mixed') return `${fmtN(disp.quantidade)} un. base (mistura)`;
      return `${fmtN(disp.quantidade)} ${disp.sigla}`;
    }
    case 'peso': return `${fmtN(row.pesoTotal)}kg`;
    case 'status':
      return row.criticalCount > 0
        ? `${row.criticalCount} crítico${row.criticalCount > 1 ? 's' : ''}`
        : 'OK';
    case 'abcd': return String(row.abcdDominante || '—').toUpperCase();
    case 'iep_score': return Number.isFinite(Number(row.iepScoreMedio)) ? `~${Math.round(row.iepScoreMedio)}${row.iepConfiancaSimbolo || ''}` : '—';
    case 'iep_codigo_comportamento': return String(row.iepCodigoComportamentoDominante || '—').toUpperCase();
    case 'iep_score_nivel_1': return Number.isFinite(Number(row.iepScoreNivel1Medio)) ? `~${Math.round(row.iepScoreNivel1Medio)}` : '—';
    case 'iep_score_nivel_2': return Number.isFinite(Number(row.iepScoreNivel2Medio)) ? `~${Math.round(row.iepScoreNivel2Medio)}` : '—';
    case 'iep_score_nivel_3': return Number.isFinite(Number(row.iepScoreNivel3Medio)) ? `~${Math.round(row.iepScoreNivel3Medio)}` : '—';
    case 'iep_score_nivel_4': return Number.isFinite(Number(row.iepScoreNivel4Medio)) ? `~${Math.round(row.iepScoreNivel4Medio)}` : '—';
    case 'iep_score_nivel_5': return Number.isFinite(Number(row.iepScoreNivel5Medio)) ? `~${Math.round(row.iepScoreNivel5Medio)}` : '—';
    default: return '—';
  }
}

function dataCellWidth(colId, row, measure, salesVelocityMap = {}) {
  const text = row.type === 'group'
    ? groupCellText(colId, row, salesVelocityMap)
    : skuCellText(colId, row.produto, row, salesVelocityMap);
  return measure(text, { size: 12, weight: 400 }) + COL_PAD_X;
}

export function computeTreeGridColumnLayout({ rows, activeCols, readOnly, containerWidth, salesVelocityMap = {} }) {
  const measure = createTextMeasurer();

  let produtoWidth = PRODUTO_MIN_WIDTH;
  for (const row of rows || []) {
    produtoWidth = Math.max(produtoWidth, produtoCellWidth(row, readOnly, measure));
  }
  produtoWidth = Math.ceil(produtoWidth);

  const cols = (activeCols || []).map((col) => {
    let minW = Math.max(col.w || 72, measure(col.label, { size: 12, weight: 700 }) + COL_PAD_X);
    for (const row of rows || []) {
      minW = Math.max(minW, dataCellWidth(col.id, row, measure, salesVelocityMap));
    }
    return { ...col, minW: Math.ceil(minW), width: Math.ceil(minW) };
  });

  const dataMinSum = cols.reduce((sum, col) => sum + col.minW, 0);
  const contentMinWidth = produtoWidth + dataMinSum;
  const viewport = Math.max(0, Number(containerWidth) || 0);
  const tableWidth = Math.max(contentMinWidth, viewport);

  if (viewport > contentMinWidth && cols.length > 0) {
    const extra = viewport - contentMinWidth;
    const share = extra / cols.length;
    for (const col of cols) {
      col.width = col.minW + share;
    }
  }

  return { produtoWidth, cols, tableWidth, contentMinWidth };
}
