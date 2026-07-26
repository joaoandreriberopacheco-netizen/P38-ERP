export function axisCellKey(eixoA, eixoB) {
  const aId = eixoA?.id || '';
  const aTxt = String(eixoA?.nome || eixoA?.texto || '').trim().toUpperCase();
  const bId = eixoB?.id || '';
  const bTxt = String(eixoB?.nome || eixoB?.texto || '').trim().toUpperCase();
  return `${aId}|${aTxt}::${bId}|${bTxt}`;
}

export function cellKeyProdutoCompraB(produtoCompraId, eixoB) {
  const bId = eixoB?.id || '';
  const bTxt = String(eixoB?.nome || eixoB?.texto || '').trim().toUpperCase();
  return `${produtoCompraId}::${bId}|${bTxt}`;
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

function parseMeasureSortKey(nome) {
  const s = String(nome || '').trim();
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  const num = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (Number.isFinite(num) && num > 0) return num;
  return s.toUpperCase();
}

export function sortAxisValues(list = []) {
  return [...list].sort((a, b) => {
    const ka = parseMeasureSortKey(a.nome);
    const kb = parseMeasureSortKey(b.nome);
    if (typeof ka === 'number' && typeof kb === 'number') return ka - kb;
    return String(ka).localeCompare(String(kb), 'pt-BR', { numeric: true });
  });
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
  return sortAxisValues([...map.values()]);
}

const EMPTY_AXIS = { id: '', nome: '' };

/**
 * Indexa SKUs numa grelha para uma linha + produto_compra.
 *
 * Modos:
 * - a_x_b: matriz clássica (ex.: argamassa classe × embalagem, piso formato × modelo)
 * - cols_only: só eixo B (ex.: soldável — medidas numa linha, peça no produto_compra)
 * - rows_only: só eixo A
 * - produto_compra_x_b: várias peças × medidas (soldável com "todos" produtos de compra)
 */
export function buildGradeMatrix({
  produtos = [],
  linhaId,
  produtoCompraId,
  produtosCompra = [],
  eixosA = [],
  eixosB = [],
} = {}) {
  const scoped = produtos.filter((p) => {
    if (linhaId && p.linha_compra_id !== linhaId) return false;
    if (produtoCompraId && p.produto_compra_id !== produtoCompraId) return false;
    return true;
  });

  let rowsA = mergeAxisCatalog(eixosA, scoped, 'A');
  let colsB = mergeAxisCatalog(eixosB, scoped, 'B');
  const cells = new Map();

  const hasA = rowsA.length > 0;
  const hasB = colsB.length > 0;
  const multiPc = !produtoCompraId && produtosCompra.length > 1;

  let gridMode = 'none';

  if (multiPc && hasB && !hasA) {
    gridMode = 'produto_compra_x_b';
    const pcsInScope = produtosCompra.filter((pc) => scoped.some((p) => p.produto_compra_id === pc.id));
    rowsA = pcsInScope.map((pc) => ({
      id: pc.id,
      nome: pc.nome,
      isProdutoCompra: true,
    }));

    for (const p of scoped) {
      const b = axisEntryFromProduto(p, 'B');
      if (!b.nome && !b.id) continue;
      if (!p.produto_compra_id) continue;
      cells.set(cellKeyProdutoCompraB(p.produto_compra_id, b), p);
    }
  } else if (hasA && hasB) {
    gridMode = 'a_x_b';
    for (const p of scoped) {
      const a = axisEntryFromProduto(p, 'A');
      const b = axisEntryFromProduto(p, 'B');
      cells.set(axisCellKey(a, b), p);
    }
  } else if (!hasA && hasB) {
    gridMode = 'cols_only';
    rowsA = [{ id: '__single__', nome: '' }];
    for (const p of scoped) {
      const b = axisEntryFromProduto(p, 'B');
      cells.set(axisCellKey(EMPTY_AXIS, b), p);
    }
  } else if (hasA && !hasB) {
    gridMode = 'rows_only';
    colsB = [{ id: '__single__', nome: 'SKU' }];
    for (const p of scoped) {
      const a = axisEntryFromProduto(p, 'A');
      cells.set(axisCellKey(a, EMPTY_AXIS), p);
    }
  }

  return {
    produtos: scoped,
    rowsA,
    colsB,
    cells,
    gridMode,
    hasGrid: gridMode !== 'none',
  };
}

export function matrixCellKey(gridMode, row, col) {
  if (gridMode === 'produto_compra_x_b') return cellKeyProdutoCompraB(row.id, col);
  return axisCellKey(row, col);
}

export function countProdutosSemLinha(produtos = []) {
  return produtos.filter((p) => !p.linha_compra_id).length;
}

export function countProdutosPorLinha(produtos = [], linhaId) {
  return produtos.filter((p) => p.linha_compra_id === linhaId).length;
}
