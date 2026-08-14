/**
 * Parse partilhado: Excel / manifest → linhas portal_catalog.
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

export const EXCEL_CANDIDATES = [
  path.join(process.cwd(), 'docs', 'P38-catalogo-skus-completo.xlsx'),
  path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx'),
];

export const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'portalExcelManifest.generated.json');

export const LINHA_CANON = {
  CERAMICA_BOLD: { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD', tipo: 'portfolio', ordem: 10 },
  CERAMICA_RETIF: { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF', tipo: 'portfolio', ordem: 20 },
};

export function resolveExcelPath() {
  for (const p of EXCEL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Excel não encontrado: ${EXCEL_CANDIDATES.join(', ')}`);
}

export function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

export function slugLinha(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'LINHA';
}

export function slugPc(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'PC';
}

/** Converte linha Excel/manifest para payload upsert portal_catalog. */
export function rowToPortalCatalogPayload(row, fonte = 'excel') {
  const codigo = String(row.codigo_interno || row.codigo || '').trim().toUpperCase();
  if (!codigo) return null;

  const linhaCodigo = row.linha_codigo || slugLinha(row.linha_nome || row.linha);
  const canon = LINHA_CANON[linhaCodigo];
  const linha = canon || {
    codigo: linhaCodigo,
    nome: row.linha_nome || linhaCodigo,
    tipo: row.linha_tipo || 'portfolio',
    ordem: row.linha_ordem ?? 10,
  };

  const pcNome = String(row.produto_compra || row.produto_compra_nome || '').trim();
  const solo = linha.tipo === 'solo';

  return {
    codigo_interno: codigo,
    produto_id: row.produto_id || null,
    categoria_nome: row.categoria || row.categoria_nome || 'E - PISOS E REVESTIMENTOS',
    linha_codigo: linha.codigo,
    linha_nome: linha.nome,
    linha_tipo: linha.tipo,
    linha_ordem: linha.ordem ?? 10,
    produto_compra_codigo: solo ? null : (row.produto_compra_codigo || slugPc(pcNome) || null),
    produto_compra_nome: solo ? null : (pcNome || null),
    eixo_a_texto: row.ex_a || row.eixo_a_texto || '',
    eixo_b_texto: row.ex_b || row.eixo_b_texto || '',
    novo_sku:
      row.novo_sku
      || [pcNome, row.ex_a, row.ex_b].filter(Boolean).join(' ')
      || codigo,
    fonte,
    ativo: true,
    updated_at: new Date().toISOString(),
  };
}

export async function parsePortalCatalogFromExcel(excelPath = resolveExcelPath()) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet('Catálogo SKUs');
  if (!ws) throw new Error('Aba "Catálogo SKUs" não encontrada');

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const exB = cellStr(row.getCell(6));
    if (exB.toUpperCase() === 'ZUMBI') return;

    const payload = rowToPortalCatalogPayload(
      {
        categoria: cellStr(row.getCell(1)),
        codigo_interno: cellStr(row.getCell(2)),
        linha_nome: cellStr(row.getCell(3)),
        produto_compra: cellStr(row.getCell(4)),
        ex_a: cellStr(row.getCell(5)),
        ex_b: exB,
        novo_sku: cellStr(row.getCell(7)),
      },
      'excel',
    );
    if (!payload) return;
    if (!LINHA_CANON[payload.linha_codigo]) return;
    rows.push(payload);
  });
  return rows;
}

export function parsePortalCatalogFromManifest(manifestPath = MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest não encontrado: ${manifestPath}. Corra npm run portal:excel-manifest`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const skus = manifest.skus || {};
  return Object.values(skus)
    .map((sku) => rowToPortalCatalogPayload(sku, 'manifest'))
    .filter(Boolean);
}

export function deriveLinhasFromRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.linha_codigo)) {
      map.set(row.linha_codigo, {
        codigo: row.linha_codigo,
        nome: row.linha_nome,
        tipo: row.linha_tipo,
        ordem: row.linha_ordem,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}
