/**
 * Agrega linhas de sugestão no nível hierárquico 2 (ex.: PISO › 45×45).
 * Ordenação: ruptura futura → curva ABCD → velocidade.
 */
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';
import {
  aggregateCatalogSalesVelocity,
  formatCatalogMedia30d,
} from '@/lib/catalogSalesVelocity';
import {
  buildProjecaoEstoque30d,
  sugestaoPrecisaReposicao,
  sugestaoProjecaoEstoque30dNegativa,
} from '@/lib/calcularSugestaoCompraVelocidade';
import { aggregateSugestaoEstoqueVitrine, formatSugestaoAggregateEstoqueVitrine, produtoSnapshotVitrineCompra } from '@/lib/sugestaoCompraVitrineDisplay';
import { getLinhaAbcdLetter } from '@/lib/sugestaoCompraTree';

const ABCD_RANK = { A: 0, B: 1, C: 2, D: 3, E: 4 };

export function familiaNivel2KeyFromProduto(produto) {
  const h2 = String(produto?.campo_hierarquico_2 || '').trim();
  if (!h2) return null;
  const h1 = String(produto?.campo_hierarquico_1 || '').trim() || '(sem grupo)';
  return `${h1}\x00${h2}`;
}

export function parseFamiliaNivel2Key(key) {
  const parts = String(key || '').split('\x00');
  const h1 = parts[0] || '';
  const h2 = parts[1] || '';
  const labelParts = [];
  if (h1 && h1 !== '(sem grupo)') labelParts.push(h1);
  if (h2) labelParts.push(h2);
  return {
    h1,
    h2,
    label: labelParts.join(' › ') || h2 || h1 || '(sem hierarquia)',
  };
}

function abcdRank(letter) {
  return ABCD_RANK[String(letter || '').toUpperCase()] ?? 5;
}

function resolveEstoqueSku(sku = {}, linha = {}, incluirPedidos = false) {
  const pendente = Number(sku?.estoque_pedidos_aprovados) || Number(linha?.quantidade_pendente) || 0;
  const fisicoRaw = sku?.estoque_fisico;
  const fisico = Number.isFinite(Number(fisicoRaw)) ? Number(fisicoRaw) : null;
  let estoque = Number(sku?.estoque_atual) || 0;
  if (incluirPedidos) {
    if (pendente > 0) {
      const base = fisico != null ? fisico : Math.max(0, estoque - pendente);
      return base + pendente;
    }
    return estoque;
  }
  if (fisico != null) return fisico;
  if (pendente > 0) return Math.max(0, estoque - pendente);
  return estoque;
}

function skusUnicosDasLinhas(linhas = [], incluirPedidos = false) {
  const out = [];
  const seen = new Set();
  for (const linha of linhas) {
    const skus = linha?.skus?.length ? linha.skus : linha?.produto ? [linha.produto] : [];
    for (const sku of skus) {
      if (!sku?.id || seen.has(sku.id)) continue;
      seen.add(sku.id);
      out.push({
        ...sku,
        estoque_atual: resolveEstoqueSku(sku, linha, incluirPedidos),
      });
    }
  }
  return out;
}

export function resolveMensagemFamilia({
  projecao,
  qtdSugeridaBase,
  mediaDiaTotal,
  skusComAcao,
  skusSemGiro,
}) {
  if (sugestaoProjecaoEstoque30dNegativa(projecao)) {
    return { tom: 'danger', texto: 'Ruptura prevista — comprar com urgência' };
  }
  if ((Number(qtdSugeridaBase) || 0) > 0 || skusComAcao > 0) {
    return { tom: 'warning', texto: 'Repor em breve' };
  }
  if ((Number(mediaDiaTotal) || 0) <= 0 && skusSemGiro > 0) {
    return { tom: 'muted', texto: 'Giro baixo — stock baixo não pede compra' };
  }
  return { tom: 'success', texto: 'Pode esperar' };
}

function curvaDominanteFamilia(linhas = []) {
  let best = '';
  let bestRank = 99;
  for (const linha of linhas) {
    const letter = getLinhaAbcdLetter(linha, resolveProdutoAbcdClasse(linha?.produto || linha?.skus?.[0]));
    const rank = abcdRank(letter);
    if (rank < bestRank) {
      bestRank = rank;
      best = letter;
    }
  }
  return best || '—';
}

function sortLinhasUrgencia(linhas = []) {
  return [...linhas].sort((a, b) => {
    const pa = Number(a?.sugestao?.projecao_estoque_30d_base);
    const pb = Number(b?.sugestao?.projecao_estoque_30d_base);
    const ra = Number.isFinite(pa) && pa < 0 ? 0 : 1;
    const rb = Number.isFinite(pb) && pb < 0 ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const ab = abcdRank(getLinhaAbcdLetter(a)) - abcdRank(getLinhaAbcdLetter(b));
    if (ab !== 0) return ab;
    return (Number(b?.sugestao?.media_dia) || 0) - (Number(a?.sugestao?.media_dia) || 0);
  });
}

/**
 * @returns {Array<{
 *   key, label, h1, h2, linhas, linhaIds, estoqueTexto, media30dTexto,
 *   projecao, qtdSugeridaBase, curvaDominante, mensagem, skusRuptura, skusComAcao, skusSemGiro, skuCount
 * }>}
 */
export function buildFamiliasNivel2FromLinhas(linhas = [], options = {}) {
  const incluirPedidos = options.incluirPedidosAprovados === true;
  const velocityMap = options.salesVelocityMap || {};
  const buckets = new Map();

  for (const linha of linhas || []) {
    const skus = linha?.skus?.length ? linha.skus : linha?.produto ? [linha.produto] : [];
    for (const sku of skus) {
      const key = familiaNivel2KeyFromProduto(sku);
      if (!key) continue;
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          ...parseFamiliaNivel2Key(key),
          linhaById: new Map(),
        });
      }
      if (linha?.id) buckets.get(key).linhaById.set(linha.id, linha);
    }
  }

  const familias = [];
  for (const bucket of buckets.values()) {
    const linhasFam = sortLinhasUrgencia([...bucket.linhaById.values()]);
    if (!linhasFam.length) continue;

    const skus = skusUnicosDasLinhas(linhasFam, incluirPedidos);
    const estoqueDisp = aggregateSugestaoEstoqueVitrine(skus);
    const estoqueFmt = formatSugestaoAggregateEstoqueVitrine(estoqueDisp);
    const estoqueTexto = estoqueFmt?.primary
      ? `${estoqueFmt.primary}${estoqueFmt.secondary ? ` (${estoqueFmt.secondary})` : ''}`
      : '—';
    const velocityAgg = aggregateCatalogSalesVelocity(skus, velocityMap);
    const media30dTexto = formatCatalogMedia30d(velocityAgg, { tilde: true });

    const estoqueTotal = skus.reduce((s, sku) => s + (Number(sku?.estoque_atual) || 0), 0);
    const mediaDiaTotal = linhasFam.reduce(
      (s, linha) => s + (Number(linha?.sugestao?.media_dia) || 0),
      0,
    );
    const representativo = produtoSnapshotVitrineCompra(linhasFam[0]?.produto || skus[0]);
    const projecao = representativo
      ? buildProjecaoEstoque30d(representativo, estoqueTotal, mediaDiaTotal)
      : { projecao_estoque_30d_base: estoqueTotal - mediaDiaTotal * 30, projecao_estoque_30d_texto: '—' };

    const qtdSugeridaBase = linhasFam.reduce(
      (s, linha) => s + (Number(linha?.sugestao?.quantidade_sugerida_base) || 0),
      0,
    );

    let skusRuptura = 0;
    let skusComAcao = 0;
    let skusSemGiro = 0;
    for (const linha of linhasFam) {
      if (sugestaoPrecisaReposicao(linha?.sugestao)) skusComAcao += 1;
      if (sugestaoProjecaoEstoque30dNegativa(linha?.sugestao)) skusRuptura += 1;
      if ((Number(linha?.sugestao?.media_dia) || 0) <= 0) skusSemGiro += 1;
    }

    const mensagem = resolveMensagemFamilia({
      projecao,
      qtdSugeridaBase,
      mediaDiaTotal,
      skusComAcao,
      skusSemGiro,
    });

    familias.push({
      key: bucket.key,
      label: bucket.label,
      h1: bucket.h1,
      h2: bucket.h2,
      linhas: linhasFam,
      linhaIds: linhasFam.map((l) => l.id),
      estoqueTexto,
      media30dTexto: media30dTexto || '—',
      projecao,
      qtdSugeridaBase,
      curvaDominante: curvaDominanteFamilia(linhasFam),
      mensagem,
      skusRuptura,
      skusComAcao,
      skusSemGiro,
      skuCount: skus.length,
      mediaDiaTotal,
    });
  }

  familias.sort((a, b) => {
    const ruptA = sugestaoProjecaoEstoque30dNegativa(a.projecao) ? 0 : 1;
    const ruptB = sugestaoProjecaoEstoque30dNegativa(b.projecao) ? 0 : 1;
    if (ruptA !== ruptB) return ruptA - ruptB;
    const ab = abcdRank(a.curvaDominante) - abcdRank(b.curvaDominante);
    if (ab !== 0) return ab;
    if ((b.qtdSugeridaBase || 0) !== (a.qtdSugeridaBase || 0)) {
      return (b.qtdSugeridaBase || 0) - (a.qtdSugeridaBase || 0);
    }
    return (b.mediaDiaTotal || 0) - (a.mediaDiaTotal || 0);
  });

  return familias;
}

/** IDs de linhas com ação de compra dentro da família. */
export function linhaIdsComAcaoFamilia(familia) {
  return (familia?.linhas || [])
    .filter((linha) => sugestaoPrecisaReposicao(linha?.sugestao))
    .map((l) => l.id);
}
