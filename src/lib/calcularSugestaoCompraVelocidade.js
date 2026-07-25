/**
 * Sugestão de compra pela velocidade de giro (vendas 60d).
 * Coluna «Ponto futuro» = projeção de estoque em 30 dias (estoque − média_dia × 30).
 */

import {
  aggregateCatalogPontoEsperadoLt,
  aggregateCatalogSalesVelocity,
  calcularMediaDiaVendas60dCalendario,
  formatCatalogMedia30d,
  formatCatalogPontoEsperadoLt,
  getCatalogLeadTimeDias,
  getCatalogMedia30dFrom60d,
  getCatalogPontoEsperadoLt,
} from '@/lib/catalogSalesVelocity';
import {
  arredondarQuantidadeSugestao,
  calcularPontoPedidoBase,
  calcularQuantidadeReposicaoBase,
  resolveFatorUnidadeVitrineCompra,
  resolveLoteCompraVitrine,
} from '@/lib/calcularMetasEstoqueVendas';
import { formatCatalogSalesQuantity } from '@/lib/catalogSalesVelocity';
import { buildSnapshotExibicaoComercial, formatQuantidadeCatalogoApresentacao } from '@/lib/productUnits';

function resolveLeadTime(produto, leadTimePadrao = 20) {
  return getCatalogLeadTimeDias(produto, leadTimePadrao);
}

function estoqueMetaProduto(produto, estoqueAtual) {
  const pedidos = Number(produto?.estoque_pedidos_aprovados) || 0;
  if (pedidos <= 0) return {};
  const fisico = Number(produto?.estoque_fisico);
  return {
    estoque_fisico: Number.isFinite(fisico) ? fisico : estoqueAtual,
    estoque_pedidos_aprovados: pedidos,
  };
}

function estoqueMetaGrupo(skus) {
  const pedidos = (skus || []).reduce(
    (s, p) => s + (Number(p?.estoque_pedidos_aprovados) || 0),
    0,
  );
  if (pedidos <= 0) return {};
  const fisico = (skus || []).reduce((s, p) => {
    const f = Number(p?.estoque_fisico);
    return s + (Number.isFinite(f) ? f : Number(p?.estoque_atual) || 0);
  }, 0);
  return { estoque_fisico: fisico, estoque_pedidos_aprovados: pedidos };
}

const DIAS_PROJECAO_PONTO_FUTURO = 30;

function produtoExibicaoVitrine(produto) {
  return buildSnapshotExibicaoComercial(produto);
}

function formatGapReposicao(produto, gapBase) {
  const qty = Number(gapBase) || 0;
  if (qty <= 0) return null;
  const ap = formatQuantidadeCatalogoApresentacao(produtoExibicaoVitrine(produto), qty);
  return formatCatalogSalesQuantity(ap.quantidade, ap.sigla, { dashIfZero: false });
}

/** Déficit até o ponto de pedido — usado no filtro «abaixo do ponto», não na qtd sugerida. */
function buildGapReposicao(produto, pontoPedidoBase, estoqueAtual) {
  const gapBase = Math.max(0, (Number(pontoPedidoBase) || 0) - (Number(estoqueAtual) || 0));
  return {
    gap_ponto_futuro_base: gapBase,
    gap_ponto_futuro_texto: formatGapReposicao(produto, gapBase),
  };
}

/**
 * Quantidade sugerida = déficit até o ponto de pedido + um ciclo de reposição (estoque ideal).
 */
export function calcularQuantidadeSugeridaNovoCiclo(
  estoqueAtual,
  pontoPedido,
  estoqueIdeal,
  projecaoEstoque30d,
) {
  const estoque = Number(estoqueAtual) || 0;
  const ponto = Number(pontoPedido) || 0;
  const ideal = Number(estoqueIdeal) || 0;
  const projecao = Number(projecaoEstoque30d);
  const cicloReposicao = ideal > 0 ? ideal : ponto;
  if (cicloReposicao <= 0) return 0;

  const gapPonto = ponto > 0 ? Math.max(0, ponto - estoque) : 0;
  const rupturaEm30d = Number.isFinite(projecao) && projecao < 0;
  const abaixoPonto = ponto > 0 && estoque < ponto;

  if (!abaixoPonto && !rupturaEm30d) return 0;
  return gapPonto + cicloReposicao;
}

export function sugestaoPrecisaReposicao(sugestao) {
  if (!sugestao) return false;
  if ((Number(sugestao.quantidade_sugerida_base) || 0) > 0) return true;
  if ((Number(sugestao.gap_ponto_futuro_base) || 0) > 0) return true;
  if ((Number(sugestao.projecao_estoque_30d_base) || 0) < 0) return true;
  const ponto = Number(sugestao.ponto_pedido) || 0;
  const estoque = Number(sugestao.estoque_atual) || 0;
  return ponto > 0 && estoque < ponto;
}

function formatProjecaoEstoque30d(produto, projecaoBase) {
  const qty = Number(projecaoBase);
  if (!Number.isFinite(qty)) return null;
  const ap = formatQuantidadeCatalogoApresentacao(produtoExibicaoVitrine(produto), Math.abs(qty));
  const formatted = formatCatalogSalesQuantity(ap.quantidade, ap.sigla, { dashIfZero: false });
  if (qty < 0) return `−${formatted}`;
  return formatted;
}

/**
 * Ponto futuro = estoque projetado daqui a 30 dias à velocidade atual.
 * estoque_atual − (média_dia × 30); velocidade 0 mantém o estoque atual.
 */
export function buildProjecaoEstoque30d(produto, estoqueAtual, mediaDia) {
  const estoque = Number(estoqueAtual) || 0;
  const media = Number(mediaDia) || 0;
  const projecaoBase = estoque - media * DIAS_PROJECAO_PONTO_FUTURO;
  const texto =
    estoque > 0 || projecaoBase !== 0
      ? formatProjecaoEstoque30d(produto, projecaoBase)
      : null;
  return {
    projecao_estoque_30d_base: projecaoBase,
    projecao_estoque_30d_texto: texto,
  };
}

export function sugestaoProjecaoEstoque30dTexto(sugestao) {
  if (!sugestao) return '—';
  if (sugestao.projecao_estoque_30d_texto) return sugestao.projecao_estoque_30d_texto;
  const base = Number(sugestao.projecao_estoque_30d_base);
  if (Number.isFinite(base)) {
    const estoque = Number(sugestao.estoque_atual) || 0;
    if (estoque > 0 || base !== 0) {
      return base.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
  }
  return '—';
}

export function sugestaoProjecaoEstoque30dNegativa(sugestao) {
  return (Number(sugestao?.projecao_estoque_30d_base) || 0) < 0;
}

function buildMetricasVelocidade(produto, pedidos90d, salesVelocityMap, leadTime) {
  const prodId = String(produto?.id ?? '');
  const velocity = salesVelocityMap?.[prodId];
  const media = calcularMediaDiaVendas60dCalendario(produto, pedidos90d);
  const mediaDia = media.mediaDia || 0;
  const pontoPedido = calcularPontoPedidoBase(mediaDia, leadTime);
  const estoqueIdeal = calcularQuantidadeReposicaoBase(mediaDia, leadTime);

  return {
    media,
    velocity,
    mediaDia,
    media_30d_comercial: getCatalogMedia30dFrom60d(velocity),
    media_30d_texto: formatCatalogMedia30d(velocity) || null,
    ponto_futuro_comercial: getCatalogPontoEsperadoLt(velocity, leadTime),
    ponto_futuro_texto: formatCatalogPontoEsperadoLt(velocity, leadTime) || null,
    pontoPedido,
    estoqueIdeal,
  };
}

export function sugestaoTemGiroVelocidade(sugestao) {
  if (!sugestao) return false;
  return (Number(sugestao.media_dia) || 0) > 0 || (Number(sugestao.quantidade_limpa_60d) || 0) > 0;
}

export function calcularSugestaoCompraProdutoVelocidade(
  produto,
  pedidos90d = [],
  salesVelocityMap = {},
  options = {},
) {
  const roundingMode = options.roundingMode ?? 'auto';
  const leadTimePadrao = options.leadTimePadrao ?? 20;
  const fallbackCatalogo = options.fallbackCatalogo === true;
  const catalogoCompleto = options.catalogoCompleto === true;

  const estoqueAtual = Number(produto?.estoque_atual) || 0;
  const estoqueMeta = estoqueMetaProduto(produto, estoqueAtual);
  const leadTime = resolveLeadTime(produto, leadTimePadrao);
  const metricas = buildMetricasVelocidade(produto, pedidos90d, salesVelocityMap, leadTime);
  const { unidade, fator } = resolveFatorUnidadeVitrineCompra(produto);

  if (!metricas.media.teveMedia) {
    if (fallbackCatalogo) {
      const pontoCadastro = Number(produto?.estoque_minimo) || 0;
      const idealCadastro = Number(produto?.estoque_ideal) || 0;
      if (pontoCadastro <= 0) {
        return {
          elegivel: false,
          motivo: 'sem_venda',
          lead_time_dias: leadTime,
          estoque_atual: estoqueAtual,
          fonte: 'velocidade',
        };
      }
      const elegivel = estoqueAtual < pontoCadastro;
      const quantidadeSugeridaBase = elegivel
        ? arredondarQuantidadeSugestao(
            idealCadastro > 0 ? idealCadastro : pontoCadastro,
            produto,
            roundingMode,
          )
        : 0;
      const { unidade, fator } = resolveFatorUnidadeVitrineCompra(produto);
      const projecao = buildProjecaoEstoque30d(produto, estoqueAtual, 0);
      return {
        elegivel,
        motivo: elegivel ? 'abaixo_ponto_cadastro' : 'estoque_suficiente',
        ponto_pedido: pontoCadastro,
        estoque_ideal: idealCadastro,
        quantidade_sugerida_base: quantidadeSugeridaBase,
        lead_time_dias: leadTime,
        estoque_atual: estoqueAtual,
        ...estoqueMeta,
        media_30d_texto: null,
        ponto_futuro_texto: null,
        ...projecao,
        unidade_vitrine_compra: unidade,
        fator_vitrine: fator,
        lote_compra_vitrine: resolveLoteCompraVitrine(produto) || null,
        fonte: 'velocidade',
        fallback_cadastro: true,
        versao: 'v1-velocidade-fallback-catalogo',
      };
    }

    if (catalogoCompleto) {
      const projecao = buildProjecaoEstoque30d(produto, estoqueAtual, 0);
      return {
        elegivel: true,
        motivo: 'sem_venda',
        lead_time_dias: leadTime,
        estoque_atual: estoqueAtual,
        ...estoqueMeta,
        media_30d_texto: metricas.media_30d_texto,
        ponto_futuro_texto: null,
        ...projecao,
        gap_ponto_futuro_base: 0,
        gap_ponto_futuro_texto: null,
        quantidade_sugerida_base: 0,
        ponto_pedido: 0,
        unidade_vitrine_compra: unidade,
        fator_vitrine: fator,
        lote_compra_vitrine: resolveLoteCompraVitrine(produto) || null,
        fonte: 'velocidade',
        catalogo_completo: true,
      };
    }

    return {
      elegivel: false,
      motivo: 'sem_venda',
      lead_time_dias: leadTime,
      estoque_atual: estoqueAtual,
      media_30d_texto: metricas.media_30d_texto,
      ponto_futuro_texto: metricas.ponto_futuro_texto,
      fonte: 'velocidade',
    };
  }

  const { pontoPedido, estoqueIdeal } = metricas;
  const gap = buildGapReposicao(produto, pontoPedido, estoqueAtual);
  const projecao = buildProjecaoEstoque30d(produto, estoqueAtual, metricas.mediaDia);
  const qtdNovoCiclo = catalogoCompleto
    ? calcularQuantidadeSugeridaNovoCiclo(
        estoqueAtual,
        pontoPedido,
        estoqueIdeal,
        projecao.projecao_estoque_30d_base,
      )
    : 0;
  const elegivel = catalogoCompleto
    ? qtdNovoCiclo > 0
    : estoqueAtual < pontoPedido;
  const quantidadeSugeridaBase = catalogoCompleto
    ? qtdNovoCiclo > 0
      ? arredondarQuantidadeSugestao(qtdNovoCiclo, produto, roundingMode)
      : 0
    : elegivel
      ? arredondarQuantidadeSugestao(pontoPedido, produto, roundingMode)
      : 0;

  return {
    elegivel: catalogoCompleto ? true : elegivel,
    motivo: catalogoCompleto
      ? qtdNovoCiclo > 0
        ? 'reposicao_novo_ciclo'
        : 'estoque_suficiente'
      : elegivel
        ? 'abaixo_ponto_futuro'
        : 'estoque_suficiente',
    media_dia: metricas.mediaDia,
    ponto_pedido: pontoPedido,
    estoque_ideal: estoqueIdeal,
    quantidade_sugerida_base: quantidadeSugeridaBase,
    lead_time_dias: leadTime,
    estoque_atual: estoqueAtual,
    ...estoqueMeta,
    media_30d_comercial: metricas.media_30d_comercial,
    media_30d_texto: metricas.media_30d_texto,
    ponto_futuro_comercial: metricas.ponto_futuro_comercial,
    ponto_futuro_texto: metricas.ponto_futuro_texto,
    ...projecao,
    ...gap,
    quantidade_limpa_60d: metricas.media.quantidade_limpa_60d,
    unidade_vitrine_compra: unidade,
    fator_vitrine: fator,
    lote_compra_vitrine: resolveLoteCompraVitrine(produto) || null,
    fonte: 'velocidade',
    catalogo_completo: catalogoCompleto || undefined,
    versao: catalogoCompleto
      ? 'v5-catalogo-completo-ciclo-15lt'
      : 'v2-velocidade-ciclo-15lt',
  };
}

export function calcularSugestaoCompraGrupoVelocidade(
  skus,
  pedidos90d = [],
  salesVelocityMap = {},
  options = {},
) {
  const lista = (skus || []).filter(Boolean);
  if (!lista.length) {
    return { elegivel: false, motivo: 'grupo_vazio', fonte: 'velocidade' };
  }
  if (lista.length === 1) {
    return calcularSugestaoCompraProdutoVelocidade(lista[0], pedidos90d, salesVelocityMap, options);
  }

  const roundingMode = options.roundingMode ?? 'auto';
  const leadTimePadrao = options.leadTimePadrao ?? 20;
  const catalogoCompleto = options.catalogoCompleto === true;

  const sugestoes = lista.map((p) =>
    calcularSugestaoCompraProdutoVelocidade(p, pedidos90d, salesVelocityMap, {
      ...options,
      fallbackCatalogo: false,
      catalogoCompleto,
    }),
  );

  const comVenda = sugestoes.filter((s) => s.media_dia > 0 || s.quantidade_limpa_60d > 0);
  const usarFallbackGrupo = comVenda.length === 0 && options.fallbackCatalogo === true;

  if (usarFallbackGrupo) {
    const estoqueAtual = lista.reduce((s, p) => s + (Number(p.estoque_atual) || 0), 0);
    const estoqueMeta = estoqueMetaGrupo(lista);
    const pontoPedido = lista.reduce((s, p) => s + (Number(p.estoque_minimo) || 0), 0);
    const estoqueIdeal = lista.reduce((s, p) => s + (Number(p.estoque_ideal) || 0), 0);
    const leadTime = Math.max(...lista.map((p) => resolveLeadTime(p, leadTimePadrao)));
    const representativo = lista.find((p) => (Number(p.estoque_minimo) || 0) > 0) || lista[0];

    if (pontoPedido <= 0) {
      return {
        elegivel: false,
        motivo: 'sem_venda',
        lead_time_dias: leadTime,
        estoque_atual: estoqueAtual,
        skus_no_grupo: lista.length,
        agrupado: true,
        fonte: 'velocidade',
      };
    }

    const elegivel = estoqueAtual < pontoPedido;
    const quantidadeSugeridaBase = elegivel
      ? arredondarQuantidadeSugestao(
          estoqueIdeal > 0 ? estoqueIdeal : pontoPedido,
          representativo,
          roundingMode,
        )
      : 0;
    const { unidade, fator } = resolveFatorUnidadeVitrineCompra(representativo);

    return {
      elegivel,
      motivo: elegivel ? 'abaixo_ponto_cadastro' : 'estoque_suficiente',
      ponto_pedido: pontoPedido,
      estoque_ideal: estoqueIdeal,
      quantidade_sugerida_base: quantidadeSugeridaBase,
      lead_time_dias: leadTime,
      estoque_atual: estoqueAtual,
      ...estoqueMeta,
      produto_representativo_id: representativo.id,
      unidade_vitrine_compra: unidade,
      fator_vitrine: fator,
      skus_no_grupo: lista.length,
      agrupado: true,
      fonte: 'velocidade',
      fallback_cadastro: true,
      versao: 'v1-grupo-velocidade-fallback-catalogo',
    };
  }

  const estoqueAtual = lista.reduce((s, p) => s + (Number(p.estoque_atual) || 0), 0);
  const estoqueMeta = estoqueMetaGrupo(lista);
  const pontoPedido = comVenda.reduce((s, sg) => s + (Number(sg.ponto_pedido) || 0), 0);
  const estoqueIdeal = comVenda.reduce((s, sg) => s + (Number(sg.estoque_ideal) || 0), 0);
  const leadTime = Math.max(...lista.map((p) => resolveLeadTime(p, leadTimePadrao)));
  const representativo =
    lista.find((p) => p.id === comVenda[0]?.produto_representativo_id) ||
    lista.find((p) => (Number(p.estoque_atual) || 0) > 0) ||
    lista[0];

  if (pontoPedido <= 0 && !catalogoCompleto) {
    return {
      elegivel: false,
      motivo: 'sem_venda',
      lead_time_dias: leadTime,
      estoque_atual: estoqueAtual,
      skus_no_grupo: lista.length,
      agrupado: true,
      fonte: 'velocidade',
    };
  }

  const gap = buildGapReposicao(representativo, pontoPedido, estoqueAtual);
  const mediaDiaGrupo = lista.reduce(
    (s, _, idx) => s + (Number(sugestoes[idx]?.media_dia) || 0),
    0,
  );
  const projecao = buildProjecaoEstoque30d(representativo, estoqueAtual, mediaDiaGrupo);
  const qtdNovoCiclo = catalogoCompleto
    ? calcularQuantidadeSugeridaNovoCiclo(
        estoqueAtual,
        pontoPedido,
        estoqueIdeal,
        projecao.projecao_estoque_30d_base,
      )
    : 0;
  const elegivel = catalogoCompleto
    ? qtdNovoCiclo > 0
    : estoqueAtual < pontoPedido;
  const quantidadeSugeridaBase = catalogoCompleto
    ? qtdNovoCiclo > 0
      ? arredondarQuantidadeSugestao(qtdNovoCiclo, representativo, roundingMode)
      : 0
    : elegivel
      ? arredondarQuantidadeSugestao(pontoPedido, representativo, roundingMode)
      : 0;

  const velocityAgg = aggregateCatalogSalesVelocity(lista, salesVelocityMap);
  const pontoAgg = aggregateCatalogPontoEsperadoLt(lista, salesVelocityMap, leadTimePadrao);
  const { unidade, fator } = resolveFatorUnidadeVitrineCompra(representativo);

  if (catalogoCompleto && pontoPedido <= 0) {
    const projecaoSemVenda = buildProjecaoEstoque30d(representativo, estoqueAtual, 0);
    return {
      elegivel: true,
      motivo: 'sem_venda',
      lead_time_dias: leadTime,
      estoque_atual: estoqueAtual,
      ...estoqueMeta,
      media_30d_texto: formatCatalogMedia30d(velocityAgg, { tilde: true }) || null,
      ponto_futuro_texto: null,
      ...projecaoSemVenda,
      gap_ponto_futuro_base: 0,
      gap_ponto_futuro_texto: null,
      quantidade_sugerida_base: 0,
      ponto_pedido: 0,
      produto_representativo_id: representativo.id,
      unidade_vitrine_compra: unidade,
      fator_vitrine: fator,
      skus_no_grupo: lista.length,
      agrupado: true,
      fonte: 'velocidade',
      catalogo_completo: true,
    };
  }

  return {
    elegivel: catalogoCompleto ? true : elegivel,
    motivo: catalogoCompleto
      ? qtdNovoCiclo > 0
        ? 'reposicao_novo_ciclo'
        : 'estoque_suficiente'
      : elegivel
        ? 'abaixo_ponto_futuro'
        : 'estoque_suficiente',
    ponto_pedido: pontoPedido,
    estoque_ideal: estoqueIdeal,
    quantidade_sugerida_base: quantidadeSugeridaBase,
    lead_time_dias: leadTime,
    estoque_atual: estoqueAtual,
    ...estoqueMeta,
    media_30d_comercial: getCatalogMedia30dFrom60d(velocityAgg),
    media_30d_texto: formatCatalogMedia30d(velocityAgg, { tilde: true }) || null,
    ponto_futuro_comercial: pontoAgg.quantidade,
    ponto_futuro_texto: pontoAgg.quantidade > 0 && pontoAgg.unidade
      ? `${pontoAgg.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${pontoAgg.unidade}`
      : null,
    ...projecao,
    ...gap,
    produto_representativo_id: representativo.id,
    unidade_vitrine_compra: unidade,
    fator_vitrine: fator,
    skus_no_grupo: lista.length,
    agrupado: true,
    fonte: 'velocidade',
    catalogo_completo: catalogoCompleto || undefined,
    versao: catalogoCompleto
      ? 'v5-grupo-catalogo-completo-ciclo-15lt'
      : 'v2-grupo-velocidade-ciclo-15lt',
  };
}
