/** Tabelas pai→filho para dropdowns dependentes no Excel (OFFSET/MATCH/COUNTIF). */

import { LEGENDA_CAMINHO_SEP } from './catalogo3x3Map.mjs';

/** Chave composta — mesmo « · » da legenda 4×3 (`legendaCaminho4x`). */
export const CASCADE_KEY_SEP = LEGENDA_CAMINHO_SEP;

export function joinCascadeKey(parts) {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(CASCADE_KEY_SEP);
}

/** Expressão Excel que concatena células da Fact com « · » entre níveis. */
export function excelCascadeJoinExpr(...factCellRefs) {
  if (factCellRefs.length === 0) return '""';
  if (factCellRefs.length === 1) return factCellRefs[0];
  const q = CASCADE_KEY_SEP.replace(/"/g, '""');
  return factCellRefs.join(`&"${q}"&`);
}

/**
 * Pares únicos (parentKey, child) ordenados para blocos contíguos por parentKey.
 * @param {object[]} factRows
 * @param {(row: object) => string} parentKeyFn
 * @param {(row: object) => string} childFn
 */
export function uniqueParentChildPairs(factRows, parentKeyFn, childFn) {
  const seen = new Set();
  const out = [];
  for (const row of factRows) {
    const parent = parentKeyFn(row);
    const child = String(childFn(row) ?? '').trim();
    if (!parent || !child) continue;
    const sig = `${parent}\x1f${child}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ parent, child });
  }
  out.sort(
    (a, b) =>
      a.parent.localeCompare(b.parent, 'pt-BR') || a.child.localeCompare(b.child, 'pt-BR'),
  );
  return out;
}

/**
 * Fórmula Excel: lista filha dependente de uma ou mais células pai na Fact.
 * @param {{ sheet: string, parentCol: string, childCol: string, startRow: number, endRow: number, factParentExpr: string }} cfg
 */
export function dependentListFormula(cfg) {
  const { sheet, parentCol, childCol, startRow, endRow, factParentExpr, emptyGuard } = cfg;
  const parentRange = `${sheet}!$${parentCol}$${startRow}:$${parentCol}$${endRow}`;
  const childAnchor = `${sheet}!$${childCol}$${startRow}`;
  const offset = `OFFSET(${childAnchor},MATCH(${factParentExpr},${parentRange},0)-1,0,COUNTIF(${parentRange},${factParentExpr}),1)`;
  const guard = emptyGuard ?? `${factParentExpr}=""`;
  return `IF(${guard},"",${offset})`;
}

export function emptyGuardForCascade(cascadeId) {
  switch (cascadeId) {
    case 'etapa_categoria':
      return '$B2=""';
    case 'categoria_sub':
      return 'OR($B2="",$C2="")';
    case 'sub_linha':
      return 'OR($B2="",$C2="",$D2="")';
    case 'linha_comp1':
      return 'OR($B2="",$C2="",$D2="",$E2="")';
    case 'comp1_comp2':
      return 'OR($B2="",$C2="",$D2="",$E2="",$F2="")';
    case 'comp2_comp3':
      return 'OR($B2="",$C2="",$D2="",$E2="",$F2="",$G2="")';
    default:
      return 'FALSE';
  }
}

export function buildCascadeTables(factRows) {
  return {
    etapa_categoria: uniqueParentChildPairs(
      factRows,
      (r) => String(r.etapa ?? '').trim(),
      (r) => r.categoria,
    ),
    categoria_sub: uniqueParentChildPairs(
      factRows,
      (r) => joinCascadeKey([r.etapa, r.categoria]),
      (r) => r.subcategoria,
    ),
    sub_linha: uniqueParentChildPairs(
      factRows,
      (r) => joinCascadeKey([r.etapa, r.categoria, r.subcategoria]),
      (r) => r.linha,
    ),
    linha_comp1: uniqueParentChildPairs(
      factRows,
      (r) => joinCascadeKey([r.etapa, r.categoria, r.subcategoria, r.linha]),
      (r) => r.comp1,
    ),
    comp1_comp2: uniqueParentChildPairs(
      factRows,
      (r) => joinCascadeKey([r.etapa, r.categoria, r.subcategoria, r.linha, r.comp1]),
      (r) => r.comp2,
    ),
    comp2_comp3: uniqueParentChildPairs(
      factRows,
      (r) =>
        joinCascadeKey([
          r.etapa,
          r.categoria,
          r.subcategoria,
          r.linha,
          r.comp1,
          r.comp2,
        ]),
      (r) => r.comp3,
    ),
  };
}

/**
 * Escreve blocos de cascata na aba Listas (colunas I em diante, linha 2+).
 * @returns {Record<string, { parentCol: string, childCol: string, startRow: number, endRow: number }>}
 */
export function writeCascadeBlocks(ws, cascades, { extraRows = 80, styleHeaderRow, FILL_DIM }) {
  const blocks = [
    { id: 'etapa_categoria', title: 'Cascata → CATEGORIA', pairs: cascades.etapa_categoria },
    { id: 'categoria_sub', title: 'Cascata → SUB', pairs: cascades.categoria_sub },
    { id: 'sub_linha', title: 'Cascata → LINHA', pairs: cascades.sub_linha },
    { id: 'linha_comp1', title: 'Cascata → PRODUTO COMPRA', pairs: cascades.linha_comp1 },
    { id: 'comp1_comp2', title: 'Cascata → EIXO A', pairs: cascades.comp1_comp2 },
    { id: 'comp2_comp3', title: 'Cascata → EIXO B', pairs: cascades.comp2_comp3 },
  ];

  const startRow = 2;
  let startColIdx = 9; // coluna I
  const meta = {};

  ws.getCell(1, 8).value = '← Visão geral (A–G) · Cascatas dependentes →';
  ws.getCell(1, 8).font = { italic: true, color: { argb: 'FF64748B' } };

  for (const block of blocks) {
    const parentCol = colLetterFromIndex(startColIdx);
    const childCol = colLetterFromIndex(startColIdx + 1);
    ws.getColumn(startColIdx).width = 36;
    ws.getColumn(startColIdx + 1).width = 28;
    ws.getCell(1, startColIdx).value = block.title;
    ws.getCell(1, startColIdx + 1).value = 'Valor permitido';

    const bodyLen = Math.max(block.pairs.length, 1) + extraRows;
    const endRow = startRow + bodyLen - 1;

    for (let i = 0; i < bodyLen; i += 1) {
      const rowNum = startRow + i;
      const pair = block.pairs[i];
      if (pair) {
        const pCell = ws.getCell(rowNum, startColIdx);
        const cCell = ws.getCell(rowNum, startColIdx + 1);
        pCell.value = pair.parent;
        cCell.value = pair.child;
        for (const cell of [pCell, cCell]) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_DIM } };
        }
      }
    }

    meta[block.id] = { parentCol, childCol, startRow, endRow };
    startColIdx += 3; // gap column between blocks
  }

  return meta;
}

function colLetterFromIndex(index) {
  let n = index;
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
