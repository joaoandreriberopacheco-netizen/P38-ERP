import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  buildPurchaseUnitOptions,
  getCatalogoComercialView,
  normalizeUnitCode,
  resolveCustoTotalUnitBaseProduto,
} from '@/lib/productUnits';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import {
  montarEixosPortalSku,
  montarNomePortalSku,
} from '@/lib/hierarquiaPortal/montarNomePortalSku';
import {
  CERAM_MASSA_CRITICA_CX,
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';

/** Custo por caixa (CX) a partir do catálogo (`preco_custo_calculado`). */
export function resolveCustoPorCx(produto) {
  if (!produto) return 0;

  const view = getCatalogoComercialView(produto);
  if (normalizeUnitCode(view.sigla) === 'CX' && view.custoNaEmbalagem > 0) {
    return roundToTwoDecimals(view.custoNaEmbalagem);
  }

  const options = buildPurchaseUnitOptions(produto);
  const cxOpt = options.find((o) => normalizeUnitCode(o.unidade) === 'CX');
  const custoBase = resolveCustoTotalUnitBaseProduto(produto);

  if (cxOpt) {
    const fator = Number(cxOpt.fator_conversao) || 1;
    if (custoBase > 0 && fator > 0) return roundToTwoDecimals(custoBase * fator);
    if (cxOpt.valor_unitario > 0) {
      const vcBase = Number(produto.valor_compra) || 0;
      if (vcBase > 0 && custoBase > 0) {
        return roundToTwoDecimals(cxOpt.valor_unitario * (custoBase / vcBase));
      }
      return roundToTwoDecimals(cxOpt.valor_unitario);
    }
  }

  return roundToTwoDecimals(custoBase);
}

export function estimarCustoSkuMassaCritica(row, massaCritica = CERAM_MASSA_CRITICA_CX) {
  const cxAtual = portalEstoqueCx(row);
  const cxFaltam = Math.max(0, massaCritica - cxAtual);
  const custoPorCx = resolveCustoPorCx(row?.produto);
  return {
    cx_atual: cxAtual,
    cx_faltam: cxFaltam,
    custo_por_cx: custoPorCx,
    custo_estimado: roundToTwoDecimals(cxFaltam * custoPorCx),
    atinge_massa: atingeMassaCriticaCeramica(cxAtual, massaCritica),
    tem_custo: custoPorCx > 0,
  };
}

export function estimarCustoEsquadraMassaCritica(line, opts = {}) {
  const massaCritica = line?.massa_critica ?? opts.massaCritica ?? CERAM_MASSA_CRITICA_CX;
  const minLinhasSaldavel = line?.min_linhas_saldavel ?? opts.minLinhasSaldavel ?? CERAM_MIN_LINHAS_SALDAVEL;

  const skusDetalhe = (line?.skus || []).map((sku) => ({
    sku,
    ...estimarCustoSkuMassaCritica(sku, massaCritica),
  }));

  const comMassa = skusDetalhe.filter((s) => s.atinge_massa);
  const abaixoMassa = skusDetalhe
    .filter((s) => !s.atinge_massa)
    .sort((a, b) => a.cx_atual - b.cx_atual || b.custo_estimado - a.custo_estimado);

  const faltamLinhas = Math.max(0, minLinhasSaldavel - comMassa.length);
  const prioridadeIds = new Set(
    abaixoMassa.slice(0, faltamLinhas).map((s) => s.sku?.produto?.id).filter(Boolean),
  );

  const comCusto = skusDetalhe.filter((s) => s.custo_por_cx > 0);
  const mediaCustoCx = comCusto.length
    ? comCusto.reduce((sum, s) => sum + s.custo_por_cx, 0) / comCusto.length
    : 0;

  // Investimento mínimo: média custo/CX × 16 CX × modelos em falta (meta 9 modelos saldáveis).
  const mediaInvestimentoModelo = roundToTwoDecimals(mediaCustoCx * massaCritica);
  const investimentoMinimoSaldavel = roundToTwoDecimals(mediaInvestimentoModelo * minLinhasSaldavel);

  const custoParaSaldavel =
    faltamLinhas > 0 && mediaInvestimentoModelo > 0
      ? roundToTwoDecimals(mediaInvestimentoModelo * faltamLinhas)
      : 0;
  const custoTodosAbaixo =
    abaixoMassa.length > 0 && mediaInvestimentoModelo > 0
      ? roundToTwoDecimals(mediaInvestimentoModelo * abaixoMassa.length)
      : 0;
  const cxFaltamSaldavel = faltamLinhas > 0 ? faltamLinhas * massaCritica : 0;

  const skusComPrioridade = skusDetalhe.map((s) => {
    const prioridade = prioridadeIds.has(s.sku?.produto?.id);
    const custoEstimadoRelatorio =
      prioridade && mediaInvestimentoModelo > 0 ? mediaInvestimentoModelo : s.custo_estimado;
    return {
      ...s,
      prioridade_saldavel: prioridade,
      custo_estimado: custoEstimadoRelatorio,
    };
  });

  return {
    massa_critica: massaCritica,
    min_linhas_saldavel: minLinhasSaldavel,
    linhas_com_massa: comMassa.length,
    linhas_faltam_saldavel: faltamLinhas,
    skus_abaixo_massa: abaixoMassa.length,
    custo_para_saldavel: custoParaSaldavel,
    custo_todos_abaixo_massa: custoTodosAbaixo,
    cx_faltam_saldavel: cxFaltamSaldavel,
    media_custo_por_cx: roundToTwoDecimals(mediaCustoCx),
    media_investimento_modelo: mediaInvestimentoModelo,
    investimento_minimo_saldavel: investimentoMinimoSaldavel,
    skus_detalhe: skusComPrioridade,
  };
}

/** Monta payload do relatório a partir das esquadras já filtradas no portal. */
export function buildPortalMassaCriticaRelatorio(supplyLines = []) {
  const esquadras = (supplyLines || []).map((line) => {
    const est = estimarCustoEsquadraMassaCritica(line);
    return {
      key: line.key,
      linha_nome: line.linha_nome,
      linha_codigo: line.linha_codigo,
      produto_compra_nome: line.produto_compra_nome,
      categoria: line.categoria,
      saldavel: Boolean(line.saldavel),
      linhas_com_massa: est.linhas_com_massa,
      min_linhas_saldavel: est.min_linhas_saldavel,
      massa_critica: est.massa_critica,
      sku_count: line.skus?.length || 0,
      custo_para_saldavel: est.custo_para_saldavel,
      custo_completar_abaixo: est.custo_todos_abaixo_massa,
      media_custo_por_cx: est.media_custo_por_cx,
      media_investimento_modelo: est.media_investimento_modelo,
      investimento_minimo_saldavel: est.investimento_minimo_saldavel,
      cx_faltam_saldavel: est.cx_faltam_saldavel,
      linhas_faltam_saldavel: est.linhas_faltam_saldavel,
      skus: est.skus_detalhe.map((s) => ({
        id: s.sku?.produto?.id,
        eixos: montarEixosPortalSku(s.sku),
        nome: montarNomePortalSku(s.sku),
        cx_atual: s.cx_atual,
        cx_faltam: s.cx_faltam,
        custo_por_cx: s.custo_por_cx,
        custo_estimado: s.custo_estimado,
        atinge_massa: s.atinge_massa,
        prioridade_saldavel: s.prioridade_saldavel,
      })),
    };
  });

  esquadras.sort((a, b) => {
    if (b.custo_para_saldavel !== a.custo_para_saldavel) {
      return b.custo_para_saldavel - a.custo_para_saldavel;
    }
    return (a.produto_compra_nome || '').localeCompare(b.produto_compra_nome || '', 'pt-BR');
  });

  return {
    parametros: {
      massa_critica_cx: CERAM_MASSA_CRITICA_CX,
      min_linhas_saldavel: CERAM_MIN_LINHAS_SALDAVEL,
    },
    totais: {
      esquadras: esquadras.length,
      esquadras_saldaveis: esquadras.filter((e) => e.saldavel).length,
      custo_para_saldavel: roundToTwoDecimals(
        esquadras.reduce((sum, e) => sum + e.custo_para_saldavel, 0),
      ),
      custo_completar_abaixo: roundToTwoDecimals(
        esquadras.reduce((sum, e) => sum + e.custo_completar_abaixo, 0),
      ),
      sku_total: esquadras.reduce((sum, e) => sum + e.sku_count, 0),
    },
    esquadras,
  };
}
