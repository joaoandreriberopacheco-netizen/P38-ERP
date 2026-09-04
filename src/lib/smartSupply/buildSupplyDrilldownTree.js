import { computePortalGroupMetrics, enrichPortalSkuMetrics } from '@/lib/hierarquiaPortal/portalSupplyMetrics';
import { enrichPortalSupplyLineCeramica } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import { FAIXA_LABEL } from '@/lib/smartSupply/smartSupplyCursorTableTheme';

function trim(s) {
  return String(s ?? '').trim();
}

function pcKey(row) {
  if (row.solo) return `${row.linha_codigo}::solo`;
  const parts = [
    row.linha_codigo,
    row.faixa || '',
    row.modelo_portfolio || '',
    row.kit_papel || '',
    row.produto_compra_codigo,
  ];
  return parts.join('::');
}

function enrichLine(base, velocityMap) {
  const skus = (base.skus || []).map((s) => enrichPortalSkuMetrics(s, velocityMap));
  const withSkus = { ...base, skus };
  withSkus.metrics = computePortalGroupMetrics(withSkus.skus, velocityMap);
  return enrichPortalSupplyLineCeramica(withSkus);
}

function makeNode(kind, key, label, extra = {}) {
  return {
    kind,
    key,
    label,
    children: [],
    openDefault: kind === 'linha' || kind === 'faixa',
    ...extra,
  };
}

function attachMetrics(node, lines, velocityMap) {
  const safeLines = (lines || []).filter(Boolean);
  const allSkus = safeLines.flatMap((l) => l.skus || []);
  const metrics = computePortalGroupMetrics(allSkus, velocityMap);
  const alertas = safeLines.filter((l) => l.alerta).length;
  const saldaveis = safeLines.filter((l) => l.saldavel).length;
  const zerados = safeLines.reduce((n, l) => n + (l.zerados || 0), 0);
  return {
    ...node,
    metrics,
    resumo: {
      esquadras_total: safeLines.length,
      esquadras_saldaveis: saldaveis,
      esquadras_alerta: alertas,
      sku_total: allSkus.length,
      zerados,
    },
    alerta: alertas > 0 || metrics.ponto_negativo || zerados > 0,
    saldavel: saldaveis === safeLines.length && safeLines.length > 0 && zerados === 0,
    lines: safeLines,
  };
}

function buildEsquadraNodes(lines, velocityMap) {
  return lines.map((line) => {
    const enriched = enrichLine(line, velocityMap);
    return makeNode('esquadra', enriched.key, enriched.produto_compra_nome, {
      line: enriched,
      skuNodes: (enriched.skus || []).map((s, idx) =>
        makeNode(
          'sku',
          `sku-${enriched.key}-${s.produto?.id || s.produto?.codigo_interno || idx}`,
          s.produto?.nome || s.novo_sku || '(SKU)',
          { sku: s, line: enriched },
        ),
      ),
    });
  });
}

function buildPortfolioKitBranch(faixaLines, faixaKey, velocityMap) {
  const faixaNode = makeNode('faixa', faixaKey, FAIXA_LABEL[faixaKey] || faixaKey, { faixa: faixaKey });

  if (faixaKey === 'portfolio') {
    const byModelo = new Map();
    for (const line of faixaLines) {
      const modelo = trim(line.modelo_portfolio) || '(sem modelo)';
      if (!byModelo.has(modelo)) byModelo.set(modelo, []);
      byModelo.get(modelo).push(line);
    }
    for (const [modelo, modeloLines] of [...byModelo.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))) {
      const modeloNode = makeNode('modelo', `${faixaKey}::${modelo}`, modelo);
      const byKit = new Map();
      for (const line of modeloLines) {
        const kit = trim(line.kit_papel) || trim(line.produto_compra_nome) || '(kit)';
        if (!byKit.has(kit)) byKit.set(kit, []);
        byKit.get(kit).push(line);
      }
      for (const [kit, kitLines] of [...byKit.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))) {
        const kitNode = makeNode('kit', `${faixaKey}::${modelo}::${kit}`, kit);
        kitNode.children = buildEsquadraNodes(kitLines, velocityMap);
        const merged = kitNode.children.map((c) => c.line);
        Object.assign(kitNode, attachMetrics(kitNode, merged, velocityMap));
        modeloNode.children.push(kitNode);
      }
      const modeloMerged = modeloNode.children.flatMap((k) => k.lines || []);
      Object.assign(modeloNode, attachMetrics(modeloNode, modeloMerged, velocityMap));
      faixaNode.children.push(modeloNode);
    }
  } else {
    faixaNode.children = buildEsquadraNodes(faixaLines, velocityMap);
    Object.assign(faixaNode, attachMetrics(faixaNode, faixaLines, velocityMap));
  }

  const faixaMerged = faixaNode.children.flatMap((c) => c.lines || c.children?.flatMap((k) => k.lines || []) || []);
  return attachMetrics(faixaNode, faixaMerged.length ? faixaMerged : faixaLines, velocityMap);
}

function buildLinhaNode(linhaKey, linhaMeta, lines, velocityMap) {
  const isKitLine = linhaMeta.linha_tipo === 'portfolio_kit' || lines.some((l) => trim(l.faixa));

  if (isKitLine) {
    const linhaNode = makeNode('linha', linhaKey, linhaMeta.linha_nome, { linha: linhaMeta });
    const byFaixa = new Map();
    for (const line of lines) {
      const faixa = trim(line.faixa) || 'mix_pvc';
      if (!byFaixa.has(faixa)) byFaixa.set(faixa, []);
      byFaixa.get(faixa).push(line);
    }
    const faixaOrder = ['portfolio', 'mix_pvc', 'mix_metal'];
    for (const faixaKey of faixaOrder) {
      if (!byFaixa.has(faixaKey)) continue;
      linhaNode.children.push(buildPortfolioKitBranch(byFaixa.get(faixaKey), faixaKey, velocityMap));
    }
    for (const [faixaKey, faixaLines] of byFaixa.entries()) {
      if (faixaOrder.includes(faixaKey)) continue;
      linhaNode.children.push(buildPortfolioKitBranch(faixaLines, faixaKey, velocityMap));
    }
    const merged = lines;
    return attachMetrics(linhaNode, merged, velocityMap);
  }

  const linhaNode = makeNode('linha', linhaKey, linhaMeta.linha_nome, { linha: linhaMeta });
  linhaNode.children = buildEsquadraNodes(lines, velocityMap);
  return attachMetrics(linhaNode, lines, velocityMap);
}

/**
 * Árvore drill-down Smart Supply a partir de linhas de esquadra (produto compra).
 * Mix: categoria → linha → esquadra → sku (5 níveis).
 * Portfólio+kit: + faixa → modelo → kit → sku (6 níveis).
 */
export function buildSupplyDrilldownTree(supplyLines, velocityMap = {}) {
  const byCat = new Map();

  for (const raw of supplyLines || []) {
    const cat = trim(raw.categoria) || '(sem categoria)';
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const byLinha = byCat.get(cat);
    const lk = raw.linha_codigo;
    if (!byLinha.has(lk)) {
      byLinha.set(lk, {
        linha_codigo: raw.linha_codigo,
        linha_nome: raw.linha_nome,
        linha_tipo: raw.linha_tipo,
        linha_ordem: raw.linha_ordem,
        categoria: cat,
        lines: [],
      });
    }
    byLinha.get(lk).lines.push(raw);
  }

  const roots = [];

  for (const [catNome, byLinha] of [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))) {
    const catNode = makeNode('categoria', catNome, catNome);
    for (const [, linhaMeta] of [...byLinha.values()].sort((a, b) => a.linha_ordem - b.linha_ordem)) {
      catNode.children.push(buildLinhaNode(linhaMeta.linha_codigo, linhaMeta, linhaMeta.lines, velocityMap));
    }
    const catLines = catNode.children.flatMap((l) => l.lines || []);
    roots.push(attachMetrics(catNode, catLines, velocityMap));
  }

  return roots;
}

export function flattenSupplyDrilldownLines(roots) {
  const out = [];
  const walk = (node) => {
    if (node.line) out.push(node.line);
    if (node.lines) out.push(...node.lines);
    for (const ch of node.children || []) walk(ch);
  };
  for (const r of roots || []) walk(r);
  const byKey = new Map();
  for (const l of out) {
    if (l?.key) byKey.set(l.key, l);
  }
  return [...byKey.values()];
}

/** Profundidade máxima visível por tipo de nó (para indent). */
export function supplyNodeDepth(kind) {
  const map = { categoria: 0, linha: 1, faixa: 2, modelo: 3, kit: 4, esquadra: 5, sku: 6 };
  if (kind === 'esquadra' && arguments[1] === 'mix') return 3;
  return map[kind] ?? 0;
}

export { pcKey };
