/**
 * Cruza catálogo 4×3 com estoque (Supabase ou Excel fallback).
 * Produto compra sem estoque = todos os SKUs do catálogo nesse comp1 têm estoque ≤ 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';

const STOCK_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');
const CATALOG_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-4x3.xlsx');

function cellStr(v) {
  return String(v ?? '').trim();
}

function produtoKey(etapa, categoria, subcategoria, linha, comp1) {
  return [etapa, categoria, subcategoria, linha, comp1].map((p) => cellStr(p)).join('\x00');
}

export async function loadEstoquePorCodigo() {
  const map = new Map();

  if (process.env.DATABASE_URL) {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      const { rows } = await client.query(`
        select coalesce(codigo_interno, '') as codigo_interno,
               coalesce(estoque_atual, 0)::numeric as estoque_atual
        from produto
        where ativo = true
      `);
      for (const r of rows) {
        const cod = cellStr(r.codigo_interno).toUpperCase();
        if (cod) map.set(cod, Number(r.estoque_atual) || 0);
      }
      await client.end();
      return { map, source: 'supabase' };
    } catch {
      await client.end().catch(() => {});
    }
  }

  if (!fs.existsSync(STOCK_XLSX)) {
    throw new Error(
      `Sem DATABASE_URL e sem ${STOCK_XLSX}. Correr: npm run export:catalogo-skus`,
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(STOCK_XLSX);
  const ws = wb.getWorksheet('Catálogo SKUs');
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cod = cellStr(row.getCell(2).value).toUpperCase();
    const est = Number(row.getCell(9).value) || 0;
    if (cod) map.set(cod, est);
  });
  return { map, source: 'P38-catalogo-skus-completo.xlsx' };
}

export async function buildSemEstoqueFilter(catalogPath = CATALOG_XLSX) {
  const { map: estoque, source } = await loadEstoquePorCodigo();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(catalogPath);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) throw new Error('Aba Catálogo 4×3 não encontrada');

  /** @type {Map<string, { total: number, comEstoque: number, codigos: string[] }>} */
  const porProduto = new Map();
  /** @type {Set<string>} */
  const codigosCatalogo = new Set();

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(10).value).toUpperCase();
    if (!codigo) return;
    codigosCatalogo.add(codigo);

    const etapa = cellStr(row.getCell(3).value);
    const categoria = cellStr(row.getCell(4).value);
    const sub = cellStr(row.getCell(5).value);
    const linha = cellStr(row.getCell(6).value);
    const comp1 = cellStr(row.getCell(7).value);
    const pk = produtoKey(etapa, categoria, sub, linha, comp1);

    if (!porProduto.has(pk)) {
      porProduto.set(pk, { total: 0, comEstoque: 0, codigos: [] });
    }
    const bucket = porProduto.get(pk);
    bucket.total += 1;
    bucket.codigos.push(codigo);
    const est = estoque.get(codigo) ?? 0;
    if (est > 0) bucket.comEstoque += 1;
  });

  const produtoKeysSemEstoque = [];
  for (const [pk, info] of porProduto) {
    if (info.comEstoque === 0) produtoKeysSemEstoque.push(pk);
  }

  const codigosSemEstoque = new Set();
  for (const pk of produtoKeysSemEstoque) {
    for (const cod of porProduto.get(pk).codigos) codigosSemEstoque.add(cod);
  }

  return {
    source,
    estoqueSkus: estoque.size,
    produtosCompraTotal: porProduto.size,
    produtosCompraSemEstoque: produtoKeysSemEstoque.length,
    skusSemEstoque: codigosSemEstoque.size,
    produto_keys: produtoKeysSemEstoque,
    codigos: [...codigosSemEstoque],
  };
}
