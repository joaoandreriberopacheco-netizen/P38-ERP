/**
 * Cálculo ABCD / IEP ao vivo no catálogo (sem gravar no cadastro).
 * Ao abrir o catálogo, enrichProdutosComIep recalcula com vendas dos últimos 90 dias.
 */

import {
  ABCD_CURVA_VERSAO,
  abcdClasseParaProduto,
  agregarLucroPorGrupoAbcd,
  classificarGruposAbcdPareto,
  grupoAbcdKey,
} from '@/lib/abcdCurvaOrganizacao';
import { resolveCommercialDisplay, resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';

export { ABCD_CURVA_VERSAO, grupoAbcdKey };

function q3(values) {
  if (!values || values.length === 0) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil(sorted.length * 0.75) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function average(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function quantile(values, q) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const right = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (right - sorted[base]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hierarchyKey(parts) {
  return parts.filter(Boolean).join('\x00');
}

export function resolveCustoCalculadoProduto(produto) {
  return resolveCustoTotalUnitBaseProduto(produto);
}

export function lineQuantityBase(item) {
  const qtyBase = item?.quantidade_base;
  if (qtyBase != null && Number.isFinite(Number(qtyBase)) && Number(qtyBase) > 0) {
    return Number(qtyBase) || 0;
  }
  const qty = Number(item?.quantidade ?? item?.quantidade_comercial) || 0;
  const fator = Number(item?.fator_conversao ?? item?.fator_aplicado) || 1;
  return qty * fator;
}

export function collectItensVendaProduto(produto, pedidos90d) {
  const pid = String(produto?.id ?? '');
  if (!pid) return [];
  return (pedidos90d || [])
    .flatMap((p) => p.itens || [])
    .filter((it) => String(it?.produto_id ?? it?.produtoId ?? '') === pid);
}

/** Linhas de venda do produto via índice (mais fiável que espelho vazio no pedido). */
export function collectItensVendaProdutoFromIndex(produto, itensPorProduto) {
  const pid = String(produto?.id ?? '');
  if (!pid) return [];
  return itensPorProduto?.[pid] || [];
}

function resolveItensVendaProduto(produto, pedidos90d, itensPorProduto) {
  const doIndex = collectItensVendaProdutoFromIndex(produto, itensPorProduto);
  if (doIndex.length) return doIndex;
  return collectItensVendaProduto(produto, pedidos90d);
}

/** Valor da linha de venda (total gravado ou qty × preço unitário). */
export function lineReceitaItem(it) {
  const total = Number(it?.total);
  if (Number.isFinite(total) && total > 0) return total;

  const qtyBase = lineQuantityBase(it);
  if (qtyBase > 0) {
    const unit =
      Number(it?.preco_final_unitario_fator1) ||
      Number(it?.preco_unitario_fator1) ||
      Number(it?.preco_unitario_praticado) ||
      Number(it?.preco_unitario) ||
      0;
    if (unit > 0) return qtyBase * unit;
  }

  const qtyCom = Number(it?.quantidade_comercial ?? it?.quantidade) || 0;
  const precoCom = Number(it?.preco_unitario_comercial) || 0;
  if (qtyCom > 0 && precoCom > 0) return qtyCom * precoCom;

  return 0;
}

export function calcularLucroSkuComQ4(produto, pedidos90d, itensPorProduto = null) {
  const custoUnit = resolveCustoCalculadoProduto(produto);
  const itens = resolveItensVendaProduto(produto, pedidos90d, itensPorProduto);

  if (itens.length === 0) {
    return { lucro: 0, precoMedio: 0, quantidade: 0, teveVenda: false, receita: 0 };
  }

  const linhas = itens
    .map((it) => {
      const qtyBase = lineQuantityBase(it);
      const total = lineReceitaItem(it);
      const unitPrice = qtyBase > 0 ? total / qtyBase : 0;
      return { unitPrice, qtyBase, total };
    })
    .filter((l) => l.qtyBase > 0 && l.total > 0);

  if (linhas.length === 0) {
    return { lucro: 0, precoMedio: 0, quantidade: 0, teveVenda: false, receita: 0 };
  }

  const unitPrices = linhas.map((l) => l.unitPrice);
  const limiteQ3 = q3(unitPrices);
  const linhasCore =
    linhas.length < 4 ? linhas : linhas.filter((l) => l.unitPrice <= limiteQ3);

  const quantidade = linhasCore.reduce((acc, l) => acc + l.qtyBase, 0);
  const receita = linhasCore.reduce((acc, l) => acc + l.total, 0);
  const precoMedio = quantidade > 0 ? receita / quantidade : 0;
  const lucro = receita - custoUnit * quantidade;

  return { lucro, precoMedio, quantidade, teveVenda: quantidade > 0, receita };
}

export function calcularMapaAbcdGrupo(produtos, metricasPorSku) {
  const entradas = agregarLucroPorGrupoAbcd(produtos, metricasPorSku);
  const { mapaAbcdGrupo } = classificarGruposAbcdPareto(entradas);
  return mapaAbcdGrupo;
}

function normalizarScore0a100(lucro, lucroMax, teveVenda) {
  if (!teveVenda) return null;
  if (lucroMax <= 0) return lucro > 0 ? 50 : 1;
  const raw = (Math.max(0, lucro) / lucroMax) * 100;
  return Math.round(Math.max(1, Math.min(100, raw)));
}

function isoWeekKey(rawDate) {
  if (!rawDate) return '';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '';
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function buildMovimentoStatsBySku(produtos, pedidos90d, itensPorProduto) {
  const stats = {};
  const produtoById = {};
  for (const produto of produtos || []) {
    const pid = String(produto?.id || '');
    if (!pid) continue;
    produtoById[pid] = produto;
    const vitrine = resolveCommercialDisplay(produto, 0, produto?.unidade_principal || 'UN');
    stats[pid] = {
      pedidoIds: new Set(),
      weekKeys: new Set(),
      receitaPorPedido: {},
      quantidadeTotal: 0,
      quantidadeVitrineTotal: 0,
      unidadeVitrine: vitrine?.unidade || produto?.unidade_principal || 'UN',
      receitaTotal: 0,
    };
  }

  const touch = (skuId, pedidoId, weekKey, qty, total) => {
    const id = String(skuId || '');
    if (!id || !stats[id]) return;
    const produto = produtoById[id];
    const quantidadeBase = Math.max(0, qty);
    const qtyVitrine = resolveCommercialDisplay(
      produto,
      quantidadeBase,
      produto?.unidade_principal || 'UN',
    )?.quantidade;
    if (pedidoId) {
      stats[id].pedidoIds.add(pedidoId);
      stats[id].receitaPorPedido[pedidoId] = (stats[id].receitaPorPedido[pedidoId] || 0) + Math.max(0, total);
    }
    if (weekKey) stats[id].weekKeys.add(weekKey);
    stats[id].quantidadeTotal += quantidadeBase;
    stats[id].quantidadeVitrineTotal += Math.max(0, Number(qtyVitrine) || 0);
    stats[id].receitaTotal += Math.max(0, total);
  };

  for (const pedido of pedidos90d || []) {
    const pedidoId = String(pedido?.id || '');
    const weekKey = isoWeekKey(pedido?.created_date ?? pedido?.created_at);
    for (const item of pedido?.itens || []) {
      const skuId = String(item?.produto_id ?? item?.produtoId ?? '');
      if (!skuId) continue;
      touch(skuId, pedidoId, weekKey, lineQuantityBase(item), lineReceitaItem(item));
    }
  }

  for (const [skuId, itens] of Object.entries(itensPorProduto || {})) {
    if (!stats[skuId] || stats[skuId].pedidoIds.size > 0) continue;
    for (const item of itens || []) {
      const pedidoId = String(item?.pedido_venda_id || '');
      touch(skuId, pedidoId, '', lineQuantityBase(item), lineReceitaItem(item));
    }
  }

  const out = {};
  for (const [skuId, entry] of Object.entries(stats)) {
    const pedidoCount = entry.pedidoIds.size;
    const weekCount = entry.weekKeys.size;
    const receitaPedidos = Object.values(entry.receitaPorPedido);
    const maxReceitaPedido = receitaPedidos.length ? Math.max(...receitaPedidos) : 0;
    const maxPedidoShare = entry.receitaTotal > 0 ? maxReceitaPedido / entry.receitaTotal : 0;
    out[skuId] = {
      movimentoPedidos: pedidoCount,
      semanasAtivas: weekCount,
      maxPedidoShare,
      quantidadeTotal: entry.quantidadeTotal,
      quantidadeVitrineTotal: entry.quantidadeVitrineTotal,
      unidadeVitrine: entry.unidadeVitrine,
      receitaTotal: entry.receitaTotal,
    };
  }
  return out;
}

function buildMovimentoContextoGlobal(movimentoBySku) {
  const values = Object.values(movimentoBySku || {})
    .map((entry) => Number(entry?.movimentoPedidos) || 0)
    .filter((v) => v > 0);

  if (!values.length) return { low: 0, high: 1 };
  const q3Base = quantile(values, 0.75);
  const trimmed = values.filter((value) => value <= q3Base);
  const base = trimmed.length ? trimmed : values;
  const low = quantile(base, 0.25);
  const high = Math.max(low + 1, quantile(base, 0.75));
  return { low, high };
}

function scoreMovimentoContextual(movimentos, contexto) {
  const m = Number(movimentos) || 0;
  if (m <= 0) return 0;
  const low = Number(contexto?.low) || 0;
  const high = Number(contexto?.high) || Math.max(low + 1, 1);
  if (m <= low) return 25;
  if (m >= high) {
    const extra = high > 0 ? ((m - high) / high) * 15 : 0;
    return Math.round(clamp(80 + extra, 80, 95));
  }
  const ratio = (m - low) / Math.max(1, high - low);
  return Math.round(25 + ratio * 55);
}

function calcularConfiancaAmostra(stats, contexto) {
  const pedidos = Number(stats?.movimentoPedidos) || 0;
  const semanas = Number(stats?.semanasAtivas) || 0;
  const quantidade = Number(stats?.quantidadeVitrineTotal) || Number(stats?.quantidadeTotal) || 0;
  const maxPedidoShare = clamp(Number(stats?.maxPedidoShare) || 0, 0, 1);
  const movimentoContextual = scoreMovimentoContextual(pedidos, contexto);

  const pedidosNorm = clamp((pedidos / 8) * 100, 0, 100);
  const semanasNorm = clamp((semanas / 6) * 100, 0, 100);
  const quantidadeNorm = clamp((quantidade / 30) * 100, 0, 100);
  const concentracaoNorm = clamp((1 - maxPedidoShare) * 100, 0, 100);

  return Math.round(
    pedidosNorm * 0.3 +
      semanasNorm * 0.2 +
      movimentoContextual * 0.2 +
      concentracaoNorm * 0.2 +
      quantidadeNorm * 0.1,
  );
}

function buildMemoriaConfianca(stats, contexto) {
  const pedidos = Number(stats?.movimentoPedidos) || 0;
  const semanas = Number(stats?.semanasAtivas) || 0;
  const quantidade = Number(stats?.quantidadeVitrineTotal) || Number(stats?.quantidadeTotal) || 0;
  const maxPedidoShare = clamp(Number(stats?.maxPedidoShare) || 0, 0, 1);
  const movimentoContextual = scoreMovimentoContextual(pedidos, contexto);
  const pedidosNorm = clamp((pedidos / 8) * 100, 0, 100);
  const semanasNorm = clamp((semanas / 6) * 100, 0, 100);
  const quantidadeNorm = clamp((quantidade / 30) * 100, 0, 100);
  const concentracaoNorm = clamp((1 - maxPedidoShare) * 100, 0, 100);
  const indiceConfianca = Math.round(
    pedidosNorm * 0.3 +
      semanasNorm * 0.2 +
      movimentoContextual * 0.2 +
      concentracaoNorm * 0.2 +
      quantidadeNorm * 0.1,
  );
  return {
    indiceConfianca,
    pedidos,
    semanas,
    quantidadeVitrine: Math.round(quantidade * 100) / 100,
    unidadeVitrine: stats?.unidadeVitrine || 'UN',
    maxPedidoSharePct: Math.round(maxPedidoShare * 1000) / 10,
    movimentoContextual,
    limitesMovimento: {
      low: Math.round((Number(contexto?.low) || 0) * 100) / 100,
      high: Math.round((Number(contexto?.high) || 0) * 100) / 100,
    },
    componentes: {
      pedidosNorm: Math.round(pedidosNorm),
      semanasNorm: Math.round(semanasNorm),
      quantidadeNorm: Math.round(quantidadeNorm),
      concentracaoNorm: Math.round(concentracaoNorm),
      movimentoContextual: Math.round(movimentoContextual),
    },
    pesos: {
      pedidos: 0.3,
      semanas: 0.2,
      quantidade: 0.1,
      concentracao: 0.2,
      movimento: 0.2,
    },
  };
}

function simboloConfiancaAmostra(indice) {
  const score = Number(indice) || 0;
  if (score >= 70) return '++';
  if (score >= 40) return '+';
  return '-';
}

function fatorConfiancaAmostra(indice) {
  const simbolo = simboloConfiancaAmostra(indice);
  if (simbolo === '++') return 1;
  if (simbolo === '+') return 0.85;
  return 0.65;
}

function scoreIepAjustadoPorConfianca(scoreBase, indiceConfianca) {
  const base = Number(scoreBase);
  if (!Number.isFinite(base) || base <= 0) return scoreBase;
  const ajustado = Math.round(base * fatorConfiancaAmostra(indiceConfianca));
  return clamp(ajustado, 1, 100);
}

function classificarCodigoComportamento({ scoreBase, scoreAjustado, confianca, movimentoStats, lucro, teveVenda }) {
  if (!teveVenda) return 'NEU';
  const pedidos = Number(movimentoStats?.movimentoPedidos) || 0;
  const semanas = Number(movimentoStats?.semanasAtivas) || 0;
  const maxPedidoShare = Number(movimentoStats?.maxPedidoShare) || 0;

  const luckyGuy =
    confianca < 40 &&
    pedidos <= 2 &&
    semanas <= 2 &&
    maxPedidoShare >= 0.7 &&
    ((Number(scoreBase) || 0) >= 60 || (Number(lucro) || 0) > 0);
  if (luckyGuy) return 'ESP';
  if ((Number(scoreAjustado) || 0) < 40 && confianca >= 60) return 'CAR';
  if ((Number(scoreAjustado) || 0) >= 70 && confianca >= 70) return 'TOP';
  return 'NEU';
}

function buildLucroReferenciaGlobal(metricasPorSku) {
  const values = Object.values(metricasPorSku || {})
    .map((m) => Math.max(0, Number(m?.lucro) || 0))
    .filter((v) => v > 0);
  if (!values.length) return 0;
  const p95 = quantile(values, 0.95);
  return Math.max(p95, values[0] || 0);
}

/** Chave do grupo ABCD — reexportada de abcdCurvaOrganizacao (h1+h2 ou só h1). */
// grupoAbcdKey importado acima

/** Calcula métricas IEP para todos os produtos (não grava no BD). */
export function calcularMetricasIepParaCatalogo(produtos, pedidos90d, itensPorProduto = null) {
  const lista = Array.isArray(produtos) ? produtos : [];
  const pedidos = Array.isArray(pedidos90d) ? pedidos90d : [];

  const metricasPorSku = {};
  for (const produto of lista) {
    metricasPorSku[produto.id] = calcularLucroSkuComQ4(produto, pedidos, itensPorProduto);
  }

  const mapaAbcdGrupo = calcularMapaAbcdGrupo(lista, metricasPorSku);
  const lucroRefGlobal = buildLucroReferenciaGlobal(metricasPorSku);
  const movimentoBySku = buildMovimentoStatsBySku(lista, pedidos, itensPorProduto);
  const movimentoContextoGlobal = buildMovimentoContextoGlobal(movimentoBySku);

  function classeAbcdProduto(produto) {
    return abcdClasseParaProduto(produto, mapaAbcdGrupo, metricasPorSku[produto.id]);
  }

  const skusPorChaveNivel = (nivel) => {
    const map = {};
    for (const produto of lista) {
      const parts = [
        produto.campo_hierarquico_1,
        produto.campo_hierarquico_2,
        produto.campo_hierarquico_3,
        produto.campo_hierarquico_4,
        produto.campo_hierarquico_5,
      ].slice(0, nivel);
      if (parts.filter(Boolean).length < nivel) continue;
      const key = hierarchyKey(parts);
      if (!map[key]) map[key] = [];
      map[key].push(produto.id);
    }
    return map;
  };

  const mediaLucroPorChave = {};
  for (let nivel = 2; nivel <= 5; nivel += 1) {
    const grupos = skusPorChaveNivel(nivel);
    for (const [key, skuIds] of Object.entries(grupos)) {
      const lucros = skuIds.map((id) => metricasPorSku[id]?.lucro ?? 0);
      mediaLucroPorChave[`n${nivel}:${key}`] = average(lucros);
    }
  }

  const mediaNivel2PorH1 = {};
  for (const [key, media] of Object.entries(mediaLucroPorChave)) {
    if (!key.startsWith('n2:')) continue;
    const h1 = key.slice(3).split('\x00')[0];
    if (!h1) continue;
    if (!mediaNivel2PorH1[h1]) mediaNivel2PorH1[h1] = [];
    mediaNivel2PorH1[h1].push(media);
  }
  const mediaNivel1PorH1 = {};
  for (const [h1, medias] of Object.entries(mediaNivel2PorH1)) {
    mediaNivel1PorH1[h1] = average(medias);
  }

  function rollupNivel(produto, nivel) {
    const parts = [
      produto.campo_hierarquico_1,
      produto.campo_hierarquico_2,
      produto.campo_hierarquico_3,
      produto.campo_hierarquico_4,
      produto.campo_hierarquico_5,
    ].slice(0, nivel);
    if (parts.filter(Boolean).length < nivel) return null;
    const key = `n${nivel}:${hierarchyKey(parts)}`;
    const val = mediaLucroPorChave[key];
    return val == null ? null : Math.round(val);
  }

  const porId = {};
  for (const produto of lista) {
    const sku = metricasPorSku[produto.id];
    const h1 = produto.campo_hierarquico_1 || 'unassigned';
    const classe = classeAbcdProduto(produto);
    const scoreBase = normalizarScore0a100(sku.lucro, lucroRefGlobal, sku.teveVenda);
    const movimentoStats = movimentoBySku[String(produto.id)] || {
      movimentoPedidos: 0,
      semanasAtivas: 0,
      maxPedidoShare: 0,
      quantidadeTotal: 0,
      quantidadeVitrineTotal: 0,
      unidadeVitrine: produto?.unidade_vitrine || produto?.unidade_principal || 'UN',
    };
    const contexto = movimentoContextoGlobal || { low: 0, high: 1 };
    const memoriaConfianca = buildMemoriaConfianca(movimentoStats, contexto);
    const confianca = memoriaConfianca.indiceConfianca;
    const confiancaSimbolo = simboloConfiancaAmostra(confianca);
    const fatorConfianca = fatorConfiancaAmostra(confianca);
    const scoreAjustado = scoreIepAjustadoPorConfianca(scoreBase, confianca);
    const codigoComportamento = classificarCodigoComportamento({
      scoreBase,
      scoreAjustado,
      confianca,
      movimentoStats,
      lucro: sku.lucro,
      teveVenda: sku.teveVenda,
    });
    porId[produto.id] = {
      abcd: classe,
      iep_score: scoreAjustado,
      iep_score_base: scoreBase,
      iep_confianca_indice: confianca,
      iep_confianca_simbolo: confiancaSimbolo,
      iep_score_exibicao: scoreAjustado != null ? `${scoreAjustado}${confiancaSimbolo}` : null,
      iep_codigo_comportamento: codigoComportamento,
      iep_quantidade_vitrine_90d: Math.round((Number(movimentoStats?.quantidadeVitrineTotal) || 0) * 100) / 100,
      iep_unidade_vitrine: movimentoStats?.unidadeVitrine || produto?.unidade_vitrine || produto?.unidade_principal || 'UN',
      iep_lucro_90d: Math.round((Number(sku?.lucro) || 0) * 100) / 100,
      iep_lucro_ref_global: Math.round((Number(lucroRefGlobal) || 0) * 100) / 100,
      iep_coef_confianca: fatorConfianca,
      iep_memoria_confianca: memoriaConfianca,
      iep_score_nivel_1: mediaNivel1PorH1[h1] != null ? Math.round(mediaNivel1PorH1[h1]) : null,
      iep_score_nivel_2: rollupNivel(produto, 2),
      iep_score_nivel_3: rollupNivel(produto, 3),
      iep_score_nivel_4: rollupNivel(produto, 4),
      iep_score_nivel_5: rollupNivel(produto, 5),
      iep_classe: produto.iep_trava_manual ? produto.iep_classe || classe : classe,
    };
  }

  return porId;
}

const CAMPOS_ABCD_IEP_CATALOGO = [
  'abcd',
  'iep_score',
  'iep_score_base',
  'iep_confianca_indice',
  'iep_confianca_simbolo',
  'iep_score_exibicao',
  'iep_codigo_comportamento',
  'iep_quantidade_vitrine_90d',
  'iep_unidade_vitrine',
  'iep_lucro_90d',
  'iep_lucro_ref_global',
  'iep_coef_confianca',
  'iep_memoria_confianca',
  'iep_score_nivel_1',
  'iep_score_nivel_2',
  'iep_score_nivel_3',
  'iep_score_nivel_4',
  'iep_score_nivel_5',
  'iep_classe',
];

/** Remove ABCD/IEP gravados no cadastro — o catálogo usa só o cálculo ao vivo. */
export function stripAbcdIepCadastro(produto) {
  if (!produto || typeof produto !== 'object') return produto;
  const next = { ...produto };
  for (const key of CAMPOS_ABCD_IEP_CATALOGO) {
    delete next[key];
  }
  return next;
}

/**
 * Aplica métricas IEP/ABCD calculadas a partir das vendas de 90 dias.
 * Aceita pedidos90d[] ou { pedidos90d, itensPorProduto }.
 */
export function enrichProdutosComIep(produtos, vendasDados) {
  const lista = Array.isArray(produtos) ? produtos : [];
  const pedidos90d = Array.isArray(vendasDados)
    ? vendasDados
    : vendasDados?.pedidos90d;
  const itensPorProduto = Array.isArray(vendasDados) ? null : vendasDados?.itensPorProduto;

  if (!lista.length || !Array.isArray(pedidos90d)) {
    return lista.map(stripAbcdIepCadastro);
  }

  const calculado = calcularMetricasIepParaCatalogo(lista, pedidos90d, itensPorProduto);
  return lista.map((produto) => {
    const m = calculado[produto.id];
    if (!m) return stripAbcdIepCadastro(produto);
    const merged = { ...stripAbcdIepCadastro(produto), ...m };
    if (produto.iep_trava_manual) {
      const locked = String(produto.iep_classe || '').toUpperCase().trim();
      if (locked) merged.abcd = locked;
    }
    return merged;
  });
}

export function iso90DiasAtras() {
  const data = new Date();
  data.setDate(data.getDate() - 90);
  return data.toISOString();
}

/** Chave yyyy-MM-dd para filtros Base44 (mesmo padrão do Dashboard). */
export function isoDiasAtrasDateKey(dias = 90) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function pedidoDentroJanela90d(pedido, dataISO) {
  const cut = new Date(dataISO).getTime();
  const raw = pedido?.created_date ?? pedido?.created_at;
  if (!raw) return true;
  return new Date(raw).getTime() >= cut;
}

export function pedidoElegivelIep(pedido) {
  const status = String(pedido?.status ?? '');
  if (status === 'Cancelado') return false;
  const tipo = String(pedido?.tipo ?? 'PDV').trim().toUpperCase();
  if (tipo === 'PEDIDO') return true;
  if (tipo === 'PDV' || tipo.startsWith('PDV ')) return true;
  return false;
}
