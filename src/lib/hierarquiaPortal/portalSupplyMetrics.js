import { aggregateEstoqueDisplay } from '@/components/produtos/treegrid/useTreeGrid';
import {
  aggregateCatalogSalesVelocity,
  formatCatalogMedia30d,
  formatCatalogPontoFuturoQuantidade,
  getCatalogMedia30dFrom60d,
  getCatalogPontoFuturo,
} from '@/lib/catalogSalesVelocity';
import { portalEstoqueGrupo } from '@/lib/hierarquiaPortal/portalStockFormat';

/** Métricas consolidadas (estoque vitrine · média 30d · ponto futuro) — mesma lógica do TreeGrid. */
export function computePortalGroupMetrics(enrichedRows, velocityMap = {}) {
  const produtos = (enrichedRows || []).map((r) => r.produto).filter(Boolean);
  if (!produtos.length) {
    return {
      estoque_label: '—',
      estoque_quantidade: 0,
      estoque_sigla: '',
      media30_label: '—',
      ponto_futuro_label: '—',
      ponto_futuro: null,
      velocity: { qtd30: 0, qtd60: 0, unidade: null },
    };
  }

  const estDisp = aggregateEstoqueDisplay(produtos);
  const vitrine = portalEstoqueGrupo(enrichedRows);
  const velocity = aggregateCatalogSalesVelocity(produtos, velocityMap);
  const media30 = getCatalogMedia30dFrom60d(velocity);
  const media30Label = formatCatalogMedia30d(velocity) || '—';

  let pontoFuturo = null;
  let pontoLabel = '—';

  if (estDisp.mode === 'display' || estDisp.mode === 'base') {
    const unidade = velocity.unidade || estDisp.sigla || vitrine.sigla;
    const estoqueQtd = estDisp.quantidade ?? vitrine.quantidade ?? 0;
    if (unidade && (!velocity.unidade || velocity.unidade === unidade)) {
      pontoFuturo = estoqueQtd - media30;
      pontoLabel = formatCatalogPontoFuturoQuantidade(pontoFuturo, unidade) || '—';
    } else if (produtos.length === 1) {
      const p = produtos[0];
      const v = velocityMap[String(p.id)] || velocity;
      pontoFuturo = getCatalogPontoFuturo(p, v);
      pontoLabel = formatCatalogPontoFuturoQuantidade(pontoFuturo, v?.unidade || vitrine.sigla) || '—';
    }
  }

  const estoqueLabel =
    vitrine.label
    || (estDisp.mode === 'display' || estDisp.mode === 'base'
      ? `${(estDisp.quantidade ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${estDisp.sigla || ''}`.trim()
      : '—');

  return {
    estoque_label: estoqueLabel,
    estoque_quantidade: vitrine.quantidade ?? estDisp.quantidade ?? 0,
    estoque_sigla: vitrine.sigla || estDisp.sigla || velocity.unidade || '',
    media30_label: media30Label,
    media30,
    ponto_futuro: pontoFuturo,
    ponto_futuro_label: pontoLabel,
    ponto_negativo: pontoFuturo != null && pontoFuturo < 0,
    velocity,
  };
}

/** SKU com métricas individuais para detalhe. */
export function enrichPortalSkuMetrics(row, velocityMap = {}) {
  const produto = row.produto;
  const velocity = velocityMap[String(produto?.id)] || { qtd30: 0, qtd60: 0, unidade: row.estoque_sigla };
  const media30Label = formatCatalogMedia30d(velocity) || '—';
  const ponto = getCatalogPontoFuturo(produto, velocity);
  const pontoLabel =
    formatCatalogPontoFuturoQuantidade(ponto, velocity?.unidade || row.estoque_sigla) || '—';

  return {
    ...row,
    media30_label: media30Label,
    ponto_futuro: ponto,
    ponto_futuro_label: pontoLabel,
    ponto_negativo: ponto < 0,
    velocity,
  };
}
