import { computePortalGroupMetrics, enrichPortalSkuMetrics } from '@/lib/hierarquiaPortal/portalSupplyMetrics';
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';

export { summarizePortalSupply };

/**
 * Agrupa esquadras (produto compra) por LINHA e consolida métricas dos níveis inferiores.
 */
export function buildPortalSupplyHierarchy(supplyLines, velocityMap = {}) {
  const byLinha = new Map();

  for (const line of supplyLines || []) {
    const key = line.linha_codigo;
    if (!byLinha.has(key)) {
      byLinha.set(key, {
        linha_codigo: line.linha_codigo,
        linha_nome: line.linha_nome,
        linha_tipo: line.linha_tipo,
        linha_ordem: line.linha_ordem,
        categoria: line.categoria,
        esquadras: [],
      });
    }
    const enrichedLine = {
      ...line,
      skus: line.skus.map((s) => enrichPortalSkuMetrics(s, velocityMap)),
      metrics: computePortalGroupMetrics(line.skus, velocityMap),
    };
    byLinha.get(key).esquadras.push(enrichedLine);
  }

  return [...byLinha.values()]
    .sort((a, b) => a.linha_ordem - b.linha_ordem)
    .map((linha) => {
      const allSkus = linha.esquadras.flatMap((e) => e.skus);
      const metrics = computePortalGroupMetrics(allSkus, velocityMap);
      const saldaveis = linha.esquadras.filter((e) => e.saldavel).length;
      const alertas = linha.esquadras.filter((e) => e.alerta).length;
      const total = linha.esquadras.length;

      let veredictoLinha;
      let veredictoTom = 'ok';
      if (saldaveis === total && total > 0) {
        veredictoLinha = `LINHA equilibrada — ${saldaveis}/${total} esquadras saldáveis · estoque ${metrics.estoque_label} · giro ${metrics.media30_label}`;
        veredictoTom = 'ok';
      } else if (metrics.ponto_negativo) {
        veredictoLinha = `Repor LINHA — ponto futuro ${metrics.ponto_futuro_label} (estoque ${metrics.estoque_label} vs giro ${metrics.media30_label}) · ${saldaveis}/${total} esquadras saldáveis`;
        veredictoTom = 'alerta';
      } else if (alertas > 0) {
        veredictoLinha = `${alertas} esquadra(s) em alerta · ${saldaveis}/${total} saldáveis · massa cerâmica incompleta`;
        veredictoTom = 'alerta';
      } else {
        veredictoLinha = `${saldaveis}/${total} esquadras saldáveis · estoque ${metrics.estoque_label}`;
      }

      return {
        ...linha,
        metrics,
        resumo: {
          esquadras_total: total,
          esquadras_saldaveis: saldaveis,
          esquadras_alerta: alertas,
          sku_total: allSkus.length,
        },
        veredicto_linha: veredictoLinha,
        veredicto_tom: veredictoTom,
        alerta: alertas > 0 || metrics.ponto_negativo,
      };
    });
}

/** Re-aplica cerâmica + métricas após velocity map disponível. */
export function enrichSupplyLinesWithMetrics(supplyLines, velocityMap = {}) {
  return (supplyLines || []).map((line) => {
    const metrics = computePortalGroupMetrics(line.skus, velocityMap);
    return {
      ...line,
      metrics,
      pfut_simulado: metrics.ponto_futuro != null ? Math.round(metrics.ponto_futuro) : line.pfut_simulado,
      ponto_futuro_label: metrics.ponto_futuro_label,
      media30_label: metrics.media30_label,
      alerta: line.alerta || metrics.ponto_negativo,
    };
  });
}
