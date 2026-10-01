/**
 * Leitura flexível de planilhas de pedido (fornecedor) — sem template fixo P38.
 * Detecta colunas por sinónimos (descrição, quantidade, preço unitário, código, unidade).
 */

import ExcelJS from 'exceljs';

function normalizeHeaderLabel(label) {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function getCellValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v !== null && typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return v.result ?? null;
    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => (typeof t === 'string' ? t : t?.text ?? '')).join('');
    }
    if (typeof v.text === 'string' && Object.prototype.hasOwnProperty.call(v, 'hyperlink')) {
      return v.text;
    }
  }
  return v ?? null;
}

export function parseNumeroPlanilhaBr(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val).trim().replace(/\s/g, '');
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s) && !s.includes(',')) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const COL_RULES = {
  descricao: [
    'descricao',
    'descricao do produto',
    'descricao produto',
    'produto',
    'nome',
    'nome do produto',
    'item',
    'mercadoria',
    'material',
    'especificacao',
    'denominacao',
    'produtos',
  ],
  quantidade: [
    'quantidade',
    'qtd',
    'qtde',
    'qty',
    'quant',
    'qtd compra',
    'quantidade compra',
    'quant compra',
  ],
  preco_unitario: [
    'preco unitario',
    'preco unit',
    'preco',
    'valor unitario',
    'vl unitario',
    'vl unit',
    'vr unitario',
    'vr unit',
    'unitario',
    'preco un',
    'valor un',
    'custo unitario',
    'preco de venda',
    'valor',
  ],
  codigo: [
    'codigo',
    'cod',
    'cod produto',
    'codigo produto',
    'cod interno',
    'sku',
    'ref',
    'referencia',
    'cod fornecedor',
    'codigo fornecedor',
  ],
  unidade: ['unidade', 'und', 'um', 'unid', 'unidade medida', 'uom'],
  total_linha: ['total', 'valor total', 'total item', 'vl total', 'subtotal'],
};

const COL_EXCLUDE = new Set([
  'id',
  'id nao editar',
  'cnpj',
  'fornecedor',
  'data',
  'pedido',
  'numero',
  'n pedido',
  'observacao',
  'obs',
  'frete',
  'ipi',
  'icms',
  'ncm',
  'ean',
  'codigo barras',
  'cod barras',
  'gtin',
]);

function headerMatchesField(normHeader, field) {
  if (!normHeader || COL_EXCLUDE.has(normHeader)) return false;
  const aliases = COL_RULES[field] || [];
  if (aliases.some((a) => normHeader === a || normHeader.includes(a))) return true;
  if (field === 'preco_unitario') {
    if (/unit/.test(normHeader) && /(prec|valor|vr|vl|custo)/.test(normHeader)) return true;
    if (normHeader.includes('unitario') || normHeader.includes('unit')) return true;
  }
  if (field === 'unidade' && /unit/.test(normHeader)) return false;
  if (field === 'quantidade' && /^q(td|tde|ty|uant)/.test(normHeader)) return true;
  return false;
}

function detectarColunasNaLinha(row) {
  const map = {};
  row.eachCell?.((cell, colNumber) => {
    const label = normalizeHeaderLabel(getCellValue(cell));
    if (!label) return;
    for (const field of Object.keys(COL_RULES)) {
      if (map[field]) continue;
      if (headerMatchesField(label, field)) {
        map[field] = colNumber;
      }
    }
  });
  return map;
}

function pontuarMapaColunas(map) {
  let score = 0;
  if (map.descricao) score += 3;
  if (map.quantidade) score += 2;
  if (map.preco_unitario) score += 2;
  if (map.codigo) score += 1;
  if (map.unidade) score += 1;
  return score;
}

function detectarLinhaCabecalho(ws, maxScan = 25) {
  let best = { rowIndex: 1, map: {}, score: 0 };
  const limit = Math.min(ws.rowCount || maxScan, maxScan);
  for (let i = 1; i <= limit; i += 1) {
    const row = ws.getRow(i);
    const map = detectarColunasNaLinha(row);
    const score = pontuarMapaColunas(map);
    if (score > best.score) {
      best = { rowIndex: i, map, score };
    }
  }
  return best.score >= 4 ? best : null;
}

function inferirPrecoUnitario(row, map, quantidade) {
  if (map.preco_unitario) {
    const p = parseNumeroPlanilhaBr(getCellValue(row.getCell(map.preco_unitario)));
    if (p != null && p > 0) return p;
  }
  if (map.total_linha && quantidade > 0) {
    const total = parseNumeroPlanilhaBr(getCellValue(row.getCell(map.total_linha)));
    if (total != null && total > 0) return total / quantidade;
  }
  return null;
}

function linhaTemConteudo(row, colNumbers) {
  for (const cn of colNumbers) {
    const v = getCellValue(row.getCell(cn));
    if (v != null && String(v).trim() !== '') return true;
  }
  return false;
}

function extrairItensDeWorksheet(ws) {
  const header = detectarLinhaCabecalho(ws);
  if (!header?.map?.descricao) return [];

  const { rowIndex, map } = header;
  const colunasUsadas = Object.values(map);
  const itens = [];

  for (let i = rowIndex + 1; i <= ws.rowCount; i += 1) {
    const row = ws.getRow(i);
    if (!linhaTemConteudo(row, colunasUsadas)) continue;

    const descricao = String(getCellValue(row.getCell(map.descricao)) || '').trim();
    if (!descricao || descricao.length < 2) continue;
    if (/^(total|subtotal|obs|frete|desconto)\b/i.test(descricao)) continue;

    let quantidade = map.quantidade
      ? parseNumeroPlanilhaBr(getCellValue(row.getCell(map.quantidade)))
      : null;
    if (quantidade == null || quantidade <= 0) quantidade = 1;

    const preco_unitario = inferirPrecoUnitario(row, map, quantidade);
    if (preco_unitario == null || preco_unitario <= 0) continue;

    const codigo = map.codigo
      ? String(getCellValue(row.getCell(map.codigo)) || '').trim()
      : '';
    let unidade = map.unidade
      ? String(getCellValue(row.getCell(map.unidade)) || '').trim()
      : 'UN';
    unidade = unidade.toUpperCase().replace('M²', 'M2') || 'UN';

    if (quantidade > 50_000 || preco_unitario > 500_000) continue;
    if (quantidade * preco_unitario > 5_000_000) continue;

    itens.push({
      descricao,
      codigo,
      marca: '',
      quantidade,
      preco_unitario,
      unidade_medida_documento: unidade,
    });
  }

  return itens;
}

export function isArquivoPlanilhaPedido(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (/\.(xlsx|xls|csv)$/i.test(name)) return true;
  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') return true;
  return false;
}

function parseCsvPedido(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delim = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(delim).map((c) => c.replace(/^"|"$/g, '').trim()));

  let headerIdx = 0;
  let bestMap = {};
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const fakeRow = {
      eachCell: (fn) => {
        rows[i].forEach((val, idx) => fn({ value: val }, idx + 1));
      },
    };
    const map = detectarColunasNaLinha(fakeRow);
    const score = pontuarMapaColunas(map);
    if (score > bestScore) {
      bestScore = score;
      bestMap = map;
      headerIdx = i;
    }
  }
  if (bestScore < 4 || !bestMap.descricao) return [];

  const itens = [];
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const cols = rows[i];
    const fakeRow = {
      getCell: (n) => ({ value: cols[n - 1] ?? null }),
    };
    const descricao = String(cols[bestMap.descricao - 1] || '').trim();
    if (!descricao) continue;

    let quantidade = bestMap.quantidade
      ? parseNumeroPlanilhaBr(cols[bestMap.quantidade - 1])
      : 1;
    if (quantidade == null || quantidade <= 0) quantidade = 1;

    const preco_unitario = inferirPrecoUnitario(fakeRow, bestMap, quantidade);
    if (preco_unitario == null || preco_unitario <= 0) continue;

    itens.push({
      descricao,
      codigo: bestMap.codigo ? String(cols[bestMap.codigo - 1] || '').trim() : '',
      marca: '',
      quantidade,
      preco_unitario,
      unidade_medida_documento: bestMap.unidade
        ? String(cols[bestMap.unidade - 1] || 'UN').trim().toUpperCase()
        : 'UN',
    });
  }
  return itens;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {string} [fileName]
 * @returns {Promise<{ fornecedor: object, itens: object[] }>}
 */
export async function parsePlanilhaPedidoFlexFromBuffer(buffer, fileName = '') {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const itens = parseCsvPedido(text);
    return { fornecedor: { nome_identificado: '', cnpj_identificado: '' }, itens };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const allItens = [];
  for (const ws of wb.worksheets) {
    const nomeAba = normalizeHeaderLabel(ws.name);
    if (/fornecedor|instruc|ajuda|readme|cadastr/.test(nomeAba) && wb.worksheets.length > 1) {
      continue;
    }
    const itens = extrairItensDeWorksheet(ws);
    if (itens.length > allItens.length) {
      allItens.length = 0;
      allItens.push(...itens);
    } else if (!allItens.length) {
      allItens.push(...itens);
    }
  }

  return {
    fornecedor: { nome_identificado: '', cnpj_identificado: '' },
    itens: allItens,
  };
}

export async function parsePlanilhaPedidoFlexFromFile(file) {
  const buffer = await file.arrayBuffer();
  return parsePlanilhaPedidoFlexFromBuffer(buffer, file.name || '');
}

/**
 * Converte planilha em texto tabular para a IA (Groq) quando o parser flex não basta.
 */
export async function planilhaPedidoParaTexto(file) {
  const buffer = await file.arrayBuffer();
  const lower = String(file?.name || '').toLowerCase();

  if (lower.endsWith('.csv')) {
    return new TextDecoder('utf-8').decode(buffer).trim();
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const partes = [];

  for (const ws of wb.worksheets) {
    partes.push(`=== ${ws.name} ===`);
    const maxRow = Math.min(ws.rowCount || 0, 400);
    for (let r = 1; r <= maxRow; r += 1) {
      const row = ws.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cells[colNumber - 1] = String(getCellValue(cell) ?? '').trim();
      });
      if (!cells.length) continue;
      const line = cells.filter((c) => c !== '').join('\t');
      if (line) partes.push(line);
    }
    partes.push('');
  }

  return partes.join('\n').trim();
}
