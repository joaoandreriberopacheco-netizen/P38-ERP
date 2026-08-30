#!/usr/bin/env node
/**
 * Actualiza colunas de estoque no Excel estudo a partir do cadastro (Supabase).
 * Chave relacional: codigo_interno.
 *
 * A UI Novo Catálogo / Smart Supply NÃO lê Supabase em runtime — só este job (ou manual).
 *
 *   npm run estudo:catalog-sync-estoque
 *   npm run estudo:catalog-sync-estoque -- --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const FALLBACK_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');

const DATA_SHEETS = [
  'A — Edificações',
  'B — Hidráulica',
  'B — Elétrica',
  'C — Acabamentos (prévia)',
  'C prévia — elétrica visível',
];

const STOCK_HEADERS = ['estoque_atual', 'estoque_sigla', 'estoque_minimo', 'estoque_atualizado_em'];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function ensureStockHeaders(ws) {
  const headerRow = ws.getRow(1);
  const existing = new Set();
  let nextCol = 1;
  for (let c = 1; c <= headerRow.cellCount; c += 1) {
    const h = cellStr(headerRow.getCell(c));
    if (!h) continue;
    existing.add(h);
    nextCol = Math.max(nextCol, c + 1);
  }
  const idx = Object.fromEntries(
    [...Array(headerRow.cellCount)].map((_, i) => {
      const h = cellStr(headerRow.getCell(i + 1));
      return h ? [h, i + 1] : null;
    }).filter(Boolean),
  );
  for (const h of STOCK_HEADERS) {
    if (!existing.has(h)) {
      headerRow.getCell(nextCol).value = h;
      idx[h] = nextCol;
      nextCol += 1;
    }
  }
  return idx;
}

async function loadEstoqueFromDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const { rows } = await client.query(`
      select
        upper(trim(coalesce(codigo_interno, ''))) as codigo_interno,
        coalesce(estoque_atual, 0)::numeric as estoque_atual,
        coalesce(estoque_minimo, 0)::numeric as estoque_minimo,
        coalesce(nullif(trim(unidade_principal), ''), 'UN') as unidade_principal
      from produto
      where ativo = true and nullif(trim(codigo_interno), '') is not null
    `);
    await client.end();
    return rows;
  } catch (e) {
    console.warn('[estudo-estoque] Supabase indisponível — fallback export local:', e.message || e);
    return null;
  }
}

async function loadEstoqueFromFallbackXlsx() {
  if (!fs.existsSync(FALLBACK_XLSX)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FALLBACK_XLSX);
  const ws = wb.worksheets[0];
  const headers = ws.getRow(1).values.slice(1).map((h) => String(h ?? '').trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const get = (k) => (idx[k] != null ? cellStr(row.getCell(idx[k])) : '');
    const codigo = get('codigo interno') || get('codigo_interno');
    if (!codigo) continue;
    rows.push({
      codigo_interno: codigo.toUpperCase(),
      estoque_atual: Number(get('estoque atual') || get('estoque_atual')) || 0,
      estoque_minimo: 0,
      unidade_principal: 'UN',
    });
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel não encontrado: ${EXCEL_PATH}`);
  }

  let produtos = await loadEstoqueFromDb();
  let source = 'supabase';
  if (!produtos?.length) {
    produtos = await loadEstoqueFromFallbackXlsx();
    source = 'P38-catalogo-skus-completo.xlsx';
  }

  const byCodigo = new Map(
    produtos.map((p) => [String(p.codigo_interno || '').trim().toUpperCase(), p]),
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const snapshotEm = new Date().toISOString();
  const stats = {
    source,
    in_excel: 0,
    updated: 0,
    no_cadastro: 0,
    unchanged: 0,
  };

  for (const sheetName of DATA_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const idx = ensureStockHeaders(ws);

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const codigo = cellStr(row.getCell(idx.codigo_interno)).toUpperCase();
      if (!codigo) continue;

      stats.in_excel += 1;
      const produto = byCodigo.get(codigo);
      if (!produto) {
        stats.no_cadastro += 1;
        continue;
      }

      const patch = {
        estoque_atual: Number(produto.estoque_atual) || 0,
        estoque_sigla: String(produto.unidade_principal || 'UN').trim() || 'UN',
        estoque_minimo: Number(produto.estoque_minimo) || 0,
        estoque_atualizado_em: snapshotEm,
      };

      const prev = {
        estoque_atual: cellStr(row.getCell(idx.estoque_atual)),
        estoque_sigla: cellStr(row.getCell(idx.estoque_sigla)),
        estoque_minimo: cellStr(row.getCell(idx.estoque_minimo)),
        estoque_atualizado_em: cellStr(row.getCell(idx.estoque_atualizado_em)),
      };

      const changed =
        String(patch.estoque_atual) !== prev.estoque_atual
        || patch.estoque_sigla !== prev.estoque_sigla
        || String(patch.estoque_minimo) !== prev.estoque_minimo
        || patch.estoque_atualizado_em !== prev.estoque_atualizado_em;

      if (changed) {
        stats.updated += 1;
        if (!dryRun) {
          row.getCell(idx.estoque_atual).value = patch.estoque_atual;
          row.getCell(idx.estoque_sigla).value = patch.estoque_sigla;
          row.getCell(idx.estoque_minimo).value = patch.estoque_minimo;
          row.getCell(idx.estoque_atualizado_em).value = patch.estoque_atualizado_em;
        }
      } else {
        stats.unchanged += 1;
      }
    }
  }

  if (!dryRun) {
    await wb.xlsx.writeFile(EXCEL_PATH);
  }

  console.log(`[estudo-estoque] Excel: ${EXCEL_PATH}`);
  console.log(`  · Cadastro: ${byCodigo.size} SKUs (${source})`);
  console.log(`  · Linhas no Excel: ${stats.in_excel}`);
  console.log(`  · estoque actualizado: ${stats.updated}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`  · sem alteração: ${stats.unchanged}`);
  console.log(`  · no Excel sem cadastro: ${stats.no_cadastro}`);
  console.log(`  · snapshot: ${snapshotEm}`);
  console.log('');
  console.log('Próximo passo: npm run estudo:catalog-manifest && npm run build');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
