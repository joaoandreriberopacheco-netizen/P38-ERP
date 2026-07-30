import { compareTreeLabels, sortedTreeChildEntries } from '@/lib/treeSort';
import { CUSTO_MARGEM_CAMPOS, criarCamposCustoComponentesZerados } from '@/lib/relatorioMargemCalculos';

function getMarginSortValue(entity, sortField) {
  if (!entity) return sortField === 'nome' ? '' : 0;
  if (sortField === 'nome') return entity.nome ?? entity.label ?? '';
  if (sortField === 'margem_percentual') {
    if (entity.margem_percentual != null && !Number.isNaN(entity.margem_percentual)) {
      return entity.margem_percentual;
    }
    const receita = Number(entity.receita_liquida) || 0;
    const lucro = Number(entity.lucro_total) || 0;
    return receita > 0 ? (lucro / receita) * 100 : 0;
  }
  const raw = entity[sortField];
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function compareMarginSort(aEntity, bEntity, sortField, sortOrder, { aLabel = '', bLabel = '' } = {}) {
  const aVal = sortField === 'nome' ? aLabel || getMarginSortValue(aEntity, sortField) : getMarginSortValue(aEntity, sortField);
  const bVal = sortField === 'nome' ? bLabel || getMarginSortValue(bEntity, sortField) : getMarginSortValue(bEntity, sortField);

  let cmp = 0;
  if (sortField === 'nome') {
    cmp = compareTreeLabels(aVal, bVal);
  } else {
    const aNum = Number(aVal) || 0;
    const bNum = Number(bVal) || 0;
    if (aNum !== bNum) cmp = aNum - bNum;
  }

  if (cmp === 0) {
    const aName = aLabel || aEntity?.nome || aEntity?.label || '';
    const bName = bLabel || bEntity?.nome || bEntity?.label || '';
    cmp = compareTreeLabels(aName, bName);
  }

  return sortOrder === 'asc' ? cmp : -cmp;
}

function sortMarginItems(items, sortField = 'nome', sortOrder = 'asc') {
  return [...(items || [])].sort((a, b) => compareMarginSort(a, b, sortField, sortOrder));
}

function sortMarginTreeChildEntries(nodeMap, sortField = 'nome', sortOrder = 'asc') {
  const entries = sortedTreeChildEntries(nodeMap);
  if (sortField === 'nome' && sortOrder === 'asc') return entries;
  return [...entries].sort(([keyA, nodeA], [keyB, nodeB]) => {
    const aggA = nodeA?._agg || aggregateMarginItems(collectMarginItems(nodeA));
    const aggB = nodeB?._agg || aggregateMarginItems(collectMarginItems(nodeB));
    return compareMarginSort(aggA, aggB, sortField, sortOrder, { aLabel: keyA, bLabel: keyB });
  });
}

/** Folhas do nó (catálogo usa skus; margem usa items). */
function nodeLeafItems(node) {
  if (!node) return [];
  if (Array.isArray(node.items)) return node.items;
  if (Array.isArray(node.skus)) return node.skus;
  return [];
}

function nodeChildren(node) {
  return node?.children && typeof node.children === 'object' ? node.children : {};
}

function resolveCollapsedKey(baseKey, startNode, targetNode) {
  if (startNode === targetNode) return baseKey;
  const children = nodeChildren(startNode);
  const childKey = Object.keys(children)[0];
  if (!childKey) return baseKey;
  return resolveCollapsedKey(
    `${baseKey}||${childKey}`,
    children[childKey],
    targetNode
  );
}

/** Deep collapse para árvore de margem (items em vez de skus). */
function deepCollapseMargin(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { label: '', node: node ?? {} };
  }
  const children = nodeChildren(node);
  const childKeys = Object.keys(children);
  if (!childKeys.length) {
    return { label: node.label || '', node };
  }
  if (childKeys.length === 1 && nodeLeafItems(node).length === 0) {
    const child = children[childKeys[0]];
    const inner = deepCollapseMargin(child);
    return {
      label: `${node.label} › ${inner.label}`,
      node: inner.node,
    };
  }
  return { label: node.label || '', node };
}

/** Expande até nível visual alvo (ignora _rootItems na raiz). */
export function buildExpandedForLevel(treeNode, targetLevel, parentKey = '', visualLevel = 0) {
  const keys = new Set();
  if (!treeNode || typeof treeNode !== 'object' || visualLevel >= targetLevel) return keys;

  for (const [key, node] of sortedTreeChildEntries(treeNode)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

    const rawKey = parentKey ? `${parentKey}||${key}` : key;
    const { node: finalNode } = deepCollapseMargin(node);
    const nodeKey = resolveCollapsedKey(rawKey, node, finalNode);
    const rowLevel = visualLevel + 1;
    const children = nodeChildren(finalNode);

    keys.add(nodeKey);

    if (rowLevel < targetLevel && Object.keys(children).length > 0) {
      const childKeys = buildExpandedForLevel(children, targetLevel, nodeKey, rowLevel);
      childKeys.forEach((k) => keys.add(k));
    }
  }
  return keys;
}

/**
 * Unidade da coluna UN em linhas de grupo: mesma sigla só se todas as folhas coincidem.
 * @returns {string|null} sigla normalizada ou null (mistura / sem folhas)
 */
export function resolveMarginGroupUnidadeExibicao(items) {
  if (!items?.length) return null;
  const units = new Set(
    items
      .map((r) => String(r.unidade_exibicao || 'UN').trim().toUpperCase())
      .filter(Boolean)
  );
  if (units.size === 1) return [...units][0];
  return null;
}

/** Coluna UN em linhas de grupo: sigla comum ou travessão se mistura. */
export function formatMarginGroupUnidadeLabel(unidadeExibicao) {
  return unidadeExibicao ? unidadeExibicao : '\u2014';
}

/** Soma métricas de vendas de linhas do relatório de margem. */
export function aggregateMarginItems(items) {
  if (!items?.length) {
    return {
      quantidade_vendida: 0,
      total_recebido: 0,
      total_desconto_venda: 0,
      receita_liquida: 0,
      custo_total: 0,
      lucro_total: 0,
      valor_unitario_medio: 0,
      markup_percentual: 0,
      count: 0,
      unidade_exibicao: null,
      ...criarCamposCustoComponentesZerados(),
    };
  }

  const quantidade_vendida = items.reduce((s, r) => s + (r.quantidade_vendida || 0), 0);
  const total_recebido = items.reduce((s, r) => s + (r.total_recebido || 0), 0);
  const total_desconto_venda = items.reduce((s, r) => s + (r.total_desconto_venda || 0), 0);
  const receita_liquida = items.reduce((s, r) => s + (r.receita_liquida || 0), 0);
  const custo_total = items.reduce((s, r) => s + (r.custo_total || 0), 0);
  const lucro_total = items.reduce((s, r) => s + (r.lucro_total || 0), 0);
  const custoComponentes = items.reduce(
    (acc, row) => {
      const next = { ...acc };
      for (const campo of CUSTO_MARGEM_CAMPOS) {
        next[campo.totalKey] = (next[campo.totalKey] || 0) + (row[campo.totalKey] || 0);
      }
      return next;
    },
    criarCamposCustoComponentesZerados(),
  );

  return {
    quantidade_vendida,
    total_recebido,
    total_desconto_venda,
    receita_liquida,
    custo_total,
    lucro_total,
    ...custoComponentes,
    valor_unitario_medio:
      quantidade_vendida > 0 ? total_recebido / quantidade_vendida : 0,
    markup_percentual: custo_total > 0 ? (lucro_total / custo_total) * 100 : 0,
    margem_percentual: receita_liquida > 0 ? (lucro_total / receita_liquida) * 100 : 0,
    count: items.length,
    unidade_exibicao: resolveMarginGroupUnidadeExibicao(items),
  };
}

function collectMarginItems(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  const items = [...nodeLeafItems(node)];
  for (const child of Object.values(nodeChildren(node))) {
    items.push(...collectMarginItems(child));
  }
  return items;
}

/**
 * Árvore h1–h4 com folhas = linhas de margem por produto vendido.
 */
export function buildMarginTree(marginItems) {
  const root = {};
  const list = Array.isArray(marginItems) ? marginItems : [];

  for (const item of list) {
    const h1 = String(item.campo_hierarquico_1 || '(sem grupo)').trim();
    const h2 = String(item.campo_hierarquico_2 || '').trim();
    const h3 = String(item.campo_hierarquico_3 || '').trim();
    const h4 = String(item.campo_hierarquico_4 || '').trim();

    const ensure = (parent, key, level) => {
      if (!parent[key]) {
        parent[key] = { label: key, level, children: {}, items: [] };
      }
      return parent[key];
    };

    if (!h2) {
      if (!root._rootItems) root._rootItems = [];
      root._rootItems.push(item);
      continue;
    }
    const n1 = ensure(root, h1, 1);
    const n2 = ensure(n1.children, h2, 2);
    if (!h3) {
      n2.items.push(item);
      continue;
    }
    const n3 = ensure(n2.children, h3, 3);
    if (!h4) {
      n3.items.push(item);
      continue;
    }
    const n4 = ensure(n3.children, h4, 4);
    n4.items.push(item);
  }

  function precompute(nodeMap) {
    if (!nodeMap || typeof nodeMap !== 'object') return;
    for (const [key, node] of Object.entries(nodeMap)) {
      if (key === '_rootItems' || key === '_rootSkus') continue;
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      const children = nodeChildren(node);
      if (Object.keys(children).length > 0) {
        precompute(children);
      }
      node._agg = aggregateMarginItems(collectMarginItems(node));
    }
  }
  precompute(root);

  return root;
}

/** Lista todas as folhas (produtos) da árvore — exportação PDF/CSV. */
export function collectAllMarginLeaves(tree, sortField = 'nome', sortOrder = 'asc') {
  if (!tree || typeof tree !== 'object') return [];
  const leaves = [...(tree._rootItems || [])];
  function walk(nodeMap) {
    if (!nodeMap || typeof nodeMap !== 'object') return;
    for (const [, node] of sortMarginTreeChildEntries(nodeMap, sortField, sortOrder)) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      leaves.push(...nodeLeafItems(node));
      walk(nodeChildren(node));
    }
  }
  walk(tree);
  return sortMarginItems(leaves, sortField, sortOrder);
}

function makeMarginProductRow(item, level) {
  return {
    type: 'produto',
    key: item.produto_id || item.codigo_interno || item.nome,
    item,
    level,
  };
}

function flattenMarginGroupBranch(
  key,
  node,
  expanded,
  parentKey,
  visualLevel,
  sortField = 'nome',
  sortOrder = 'asc'
) {
  const rows = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return rows;

  const rawKey = parentKey ? `${parentKey}||${key}` : key;
  const { label: collapsedLabel, node: finalNode } = deepCollapseMargin(node);
  const nodeKey = resolveCollapsedKey(rawKey, node, finalNode);
  const agg = finalNode._agg || aggregateMarginItems(collectMarginItems(finalNode));
  const rowLevel = visualLevel + 1;
  const children = nodeChildren(finalNode);
  const leafItems = sortMarginItems(nodeLeafItems(finalNode), sortField, sortOrder);
  const isLeafGroup = Object.keys(children).length === 0;
  const isExpanded = expanded.has(nodeKey);
  const isRoot = visualLevel === 0;

  /** Um único produto no grupo-folha: sem linha de grupo redundante (tela, mobile, PDF). */
  if (isLeafGroup && leafItems.length === 1) {
    rows.push(makeMarginProductRow(leafItems[0], rowLevel));
    return rows;
  }

  if (!isRoot && isLeafGroup) {
    for (const item of leafItems) {
      rows.push(makeMarginProductRow(item, rowLevel));
    }
    return rows;
  }

  rows.push({
    type: 'group',
    key: nodeKey,
    label: collapsedLabel,
    level: rowLevel,
    isLeafGroup,
    /** Métricas só na linha de grupo quando está recolhido (evita duplicar totais ao expandir). */
    showMetrics: !isExpanded,
    ...agg,
  });

  if (isLeafGroup || isExpanded) {
    if (Object.keys(children).length > 0) {
      rows.push(
        ...flattenMarginTree(children, expanded, nodeKey, rowLevel, sortField, sortOrder)
      );
    }
    for (const item of leafItems) {
      rows.push(makeMarginProductRow(item, rowLevel + 1));
    }
  }

  return rows;
}

/**
 * Achata a árvore de margem para linhas de tabela (grupo | produto).
 */
export function flattenMarginTree(
  treeNode,
  expandedKeys,
  parentKey = '',
  visualLevel = 0,
  sortField = 'nome',
  sortOrder = 'asc'
) {
  const rows = [];
  const expanded = expandedKeys ?? new Set();
  const root = treeNode && typeof treeNode === 'object' ? treeNode : {};

  if (visualLevel === 0) {
    const rootEntries = [];
    for (const item of root._rootItems || []) {
      rootEntries.push({ sortEntity: item, sortLabel: item.nome || '', kind: 'orphan', item });
    }
    for (const [key, node] of Object.entries(root)) {
      if (key === '_rootItems' || key === '_rootSkus') continue;
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      const agg = node._agg || aggregateMarginItems(collectMarginItems(node));
      rootEntries.push({ sortEntity: agg, sortLabel: key, kind: 'group', key, node });
    }
    rootEntries.sort((a, b) =>
      compareMarginSort(a.sortEntity, b.sortEntity, sortField, sortOrder, {
        aLabel: a.sortLabel,
        bLabel: b.sortLabel,
      })
    );
    for (const entry of rootEntries) {
      if (entry.kind === 'orphan') {
        rows.push(makeMarginProductRow(entry.item, 1));
      } else {
        rows.push(
          ...flattenMarginGroupBranch(
            entry.key,
            entry.node,
            expanded,
            parentKey,
            visualLevel,
            sortField,
            sortOrder
          )
        );
      }
    }
    return rows;
  }

  for (const [key, node] of sortMarginTreeChildEntries(root, sortField, sortOrder)) {
    rows.push(
      ...flattenMarginGroupBranch(key, node, expanded, parentKey, visualLevel, sortField, sortOrder)
    );
  }

  return rows;
}
