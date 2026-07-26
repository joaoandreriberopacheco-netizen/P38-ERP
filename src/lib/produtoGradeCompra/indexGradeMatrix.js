export function axisCellKey(eixoA, eixoB) {
  const aId = eixoA?.id || '';
  const aTxt = String(eixoA?.nome || eixoA?.texto || '').trim().toUpperCase();
  const bId = eixoB?.id || '';
  const bTxt = String(eixoB?.nome || eixoB?.texto || '').trim().toUpperCase();
  return `${aId}|${aTxt}::${bId}|${bTxt}`;
}

function axisEntryFromProduto(produto, eixo) {
  if (eixo === 'A') {
    return {
      id: produto.eixo_a_valor_id || '',
      nome: String(produto.eixo_a_texto || '').trim(),
    };
  }
  return {
    id: produto.eixo_b_valor_id || '',
    nome: String(produto.eixo_b_texto || '').trim(),
  };
}

function mergeAxisCatalog(catalog = [], produtos = [], eixo) {
  const map = new Map();
  for (const ev of catalog) {
    const key = ev.id || ev.nome;
    if (!key) continue;
    map.set(key, { id: ev.id || '', nome: ev.nome || '', codigo: ev.codigo || '' });
  }
  for (const p of produtos) {
    const entry = axisEntryFromProduto(p, eixo);
    if (!entry.nome && !entry.id) continue;
    const key = entry.id || entry.nome;
    if (!map.has(key)) map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}

/**
 * Indexa SKUs numa grelha A×B para uma linha + produto_compra.
 */
export function buildGradeMatrix({
  produtos = [],
  linhaId,
  produtoCompraId,
  eixosA = [],
  eixosB = [],
} = {}) {
  const scoped = produtos.filter((p) => {
    if (linhaId && p.linha_compra_id !== linhaId) return false;
    if (produtoCompraId && p.produto_compra_id !== produtoCompraId) return false;
    return true;
  });

  const rowsA = mergeAxisCatalog(eixosA, scoped, 'A');
  const colsB = mergeAxisCatalog(eixosB, scoped, 'B');

  const cells = new Map();
  for (const p of scoped) {
    const a = axisEntryFromProduto(p, 'A');
    const b = axisEntryFromProduto(p, 'B');
    if (!a.nome && !a.id && !b.nome && !b.id) {
      cells.set('__solo__', p);
      continue;
    }
    cells.set(axisCellKey(a, b), p);
  }

  return {
    produtos: scoped,
    rowsA,
    colsB,
    cells,
    hasGrid: rowsA.length > 0 && colsB.length > 0,
  };
}

export function countProdutosSemLinha(produtos = []) {
  return produtos.filter((p) => !p.linha_compra_id).length;
}

export function countProdutosPorLinha(produtos = [], linhaId) {
  return produtos.filter((p) => p.linha_compra_id === linhaId).length;
}
