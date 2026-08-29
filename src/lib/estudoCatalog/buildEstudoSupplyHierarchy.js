/** Hierarquia SMART SUPPLY a partir de linhas de estudo (Excel). */

function computeGroupMetrics(skus = []) {
  const estoque = skus.reduce((a, s) => a + (Number(s.estoque_vitrine ?? s.estoque) || 0), 0);
  const sigla = skus.find((s) => s.estoque_sigla)?.estoque_sigla || 'cx';
  const media30 = Math.max(1, Math.round(skus.length * 1.2));
  const pontoFuturo = estoque - media30;
  return {
    estoque_label: `${estoque} ${sigla}`,
    media30_label: `${media30} cx/mês*`,
    ponto_futuro_label: `${pontoFuturo >= 0 ? '+' : ''}${pontoFuturo} cx*`,
    ponto_futuro: pontoFuturo,
    ponto_negativo: pontoFuturo < 0,
  };
}

export function enrichEstudoSupplyForPanel(lines = []) {
  return lines.map((line) => {
    const skus = (line.skus || []).map((s) => ({
      ...s,
      estoque_label: s.estoque_label || `${s.estoque} cx`,
      media30_label: '—',
      ponto_futuro_label: s.zerado ? '0 cx' : `${s.estoque} cx`,
      ponto_negativo: s.zerado,
    }));
    const metrics = computeGroupMetrics(skus);
    return {
      ...line,
      skus,
      metrics,
      pfut_simulado: metrics.ponto_futuro,
      ponto_futuro_label: metrics.ponto_futuro_label,
    };
  });
}

export function buildEstudoSupplyHierarchy(supplyLines = []) {
  const byLinha = new Map();

  for (const line of supplyLines) {
    const key = line.linha_pathway_key || line.linha_codigo;
    if (!byLinha.has(key)) {
      byLinha.set(key, {
        linha_codigo: line.linha_codigo,
        linha_pathway_key: key,
        linha_nome: line.linha_nome,
        linha_tipo: line.linha_tipo,
        linha_ordem: line.linha_ordem,
        bloco: line.bloco,
        sub_bloco: line.sub_bloco,
        grupo: line.grupo,
        core: line.core,
        pathway_papel: line.pathway_papel,
        esquadras: [],
      });
    }
    byLinha.get(key).esquadras.push({
      ...line,
      key: line.key,
      produto_compra_nome: line.produto_compra_nome,
      metrics: line.metrics,
      skus: line.skus,
      saldavel: line.saldavel,
      alerta: line.alerta,
      zerados: line.zerados,
      sku_count: line.sku_count,
      veredicto_tom: line.zerados > 0 ? 'critico' : line.alerta ? 'alerta' : 'ok',
      veredicto: line.alerta ? 'Repor ou completar mix' : 'Saldável',
      massa_critica: line.massa_critica,
      linhas_com_massa_critica: line.linhas_com_massa_critica,
    });
  }

  return [...byLinha.values()]
    .sort((a, b) => a.linha_ordem - b.linha_ordem)
    .map((linha) => {
      const allSkus = linha.esquadras.flatMap((e) => e.skus);
      const metrics = computeGroupMetrics(allSkus);
      const saldaveis = linha.esquadras.filter((e) => e.saldavel).length;
      const alertas = linha.esquadras.filter((e) => e.alerta).length;
      const total = linha.esquadras.length;

      return {
        ...linha,
        metrics,
        resumo: {
          esquadras_total: total,
          esquadras_saldaveis: saldaveis,
          esquadras_alerta: alertas,
          sku_total: allSkus.length,
        },
        veredicto_linha: alertas
          ? `${alertas} esquadra(s) em alerta · estudo Excel`
          : `${saldaveis}/${total} saldáveis · estudo Excel`,
        veredicto_tom: alertas ? 'alerta' : 'ok',
        alerta: alertas > 0 || metrics.ponto_negativo,
      };
    });
}
