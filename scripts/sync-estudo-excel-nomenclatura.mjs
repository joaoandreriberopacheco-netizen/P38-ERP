#!/usr/bin/env node
/**
 * Sincroniza nomenclatura do Excel estudo (fonte do Novo Catálogo) com o cadastro actual.
 *
 * Regra de negócio (João André):
 * - Excel = hierarquia + novo_sku + estoque (única fonte na UI Novo Ecosistema).
 * - Cadastro entra só via jobs (sync nomenclatura / sync estoque), nunca em runtime na UI.
 *
 *   npm run estudo:catalog-sync-nomenclatura
 *   npm run estudo:catalog-sync-nomenclatura -- --dry-run
 *   npm run estudo:catalog-sync-nomenclatura -- --force
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import {
  excelRowJaModernizado,
  proposeEstudoRowFromProduto,
  shouldOverwriteExcelRow,
} from '../src/lib/estudoCatalog/proposeEstudoRowFromProduto.js';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const FALLBACK_XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');

const DATA_SHEETS = [
  'A — Edificações',
  'B — Hidráulica',
  'B — Elétrica',
  'C — Acabamentos (prévia)',
  'C prévia — elétrica visível',
];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function readRowObj(row, idx) {
  const get = (k) => (idx[k] != null ? cellStr(row.getCell(idx[k])) : '');
  return {
    bloco: get('bloco'),
    sub_bloco: get('sub_bloco'),
    grupo: get('grupo'),
    grupo_ordem: get('grupo_ordem'),
    etapa: get('etapa'),
    core: get('core'),
    linha: get('linha'),
    produto_compra: get('produto_compra'),
    eixo_a: get('eixo_a'),
    eixo_b: get('eixo_b'),
    codigo_interno: get('codigo_interno'),
    novo_sku: get('novo_sku'),
    sku_atual: get('sku_atual'),
    status_mix: get('status_mix'),
  };
}

function writeFields(row, idx, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (idx[k] == null) continue;
    row.getCell(idx[k]).value = v ?? '';
  }
}

async function loadProdutosFromDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const { rows } = await client.query(`
    select
      codigo_interno,
      nome,
      coalesce(campo_hierarquico_1, '') as campo_hierarquico_1,
      coalesce(campo_hierarquico_2, '') as campo_hierarquico_2,
      coalesce(campo_hierarquico_3, '') as campo_hierarquico_3,
      coalesce(campo_hierarquico_4, '') as campo_hierarquico_4,
      coalesce(campo_hierarquico_5, '') as campo_hierarquico_5,
      coalesce(marca, '') as marca,
      coalesce(categoria_nome, '') as categoria_nome
    from produto
    where ativo = true
  `);
    await client.end();
    return rows;
  } catch (e) {
    console.warn('[estudo-sync] Supabase indisponível — fallback para export local:', e.message || e);
    return null;
  }
}

async function loadProdutosFromFallbackXlsx() {
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
      codigo_interno: codigo,
      nome: get('descrição completa (sku)') || get('descricao_completa') || get('nome'),
      campo_hierarquico_1: get('h1'),
      campo_hierarquico_2: get('h2'),
      campo_hierarquico_3: get('h3'),
      campo_hierarquico_4: get('h4'),
      campo_hierarquico_5: get('h5'),
      marca: '',
      categoria_nome: get('categoria'),
    });
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel não encontrado: ${EXCEL_PATH}`);
  }

  let produtos = await loadProdutosFromDb();
  let source = 'supabase';
  if (!produtos?.length) {
    produtos = await loadProdutosFromFallbackXlsx();
    source = 'P38-catalogo-skus-completo.xlsx';
  }

  const byCodigo = new Map(
    produtos.map((p) => [String(p.codigo_interno || '').trim().toUpperCase(), p]),
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const stats = {
    source,
    sku_atual_updated: 0,
    nomenclatura_updated: 0,
    skipped_modern: 0,
    skipped_low_conf: 0,
    no_cadastro: 0,
    in_excel: 0,
  };

  const codigosExcel = new Set();

  for (const sheetName of DATA_SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const headers = ws.getRow(1).values.slice(1).map((h) => String(h ?? '').trim());
    const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const existing = readRowObj(row, idx);
      const codigo = String(existing.codigo_interno || '').trim().toUpperCase();
      if (!codigo) continue;

      stats.in_excel += 1;
      codigosExcel.add(codigo);

      const produto = byCodigo.get(codigo);
      if (!produto) {
        stats.no_cadastro += 1;
        continue;
      }

      const proposed = proposeEstudoRowFromProduto(produto);
      const patch = {};

      if (produto.nome && produto.nome !== existing.sku_atual) {
        patch.sku_atual = produto.nome;
        stats.sku_atual_updated += 1;
      }

      if (shouldOverwriteExcelRow(existing, proposed, { force })) {
        Object.assign(patch, {
          novo_sku: proposed.novo_sku,
          produto_compra: proposed.produto_compra,
          eixo_a: proposed.eixo_a,
          eixo_b: proposed.eixo_b,
        });
        if (proposed.bloco) patch.bloco = proposed.bloco;
        if (proposed.sub_bloco) patch.sub_bloco = proposed.sub_bloco;
        if (proposed.grupo) patch.grupo = proposed.grupo;
        if (proposed.grupo_ordem) patch.grupo_ordem = proposed.grupo_ordem;
        if (proposed.etapa) patch.etapa = proposed.etapa;
        if (proposed.core) patch.core = proposed.core;
        if (proposed.linha) patch.linha = proposed.linha;
        stats.nomenclatura_updated += 1;
      } else if (excelRowJaModernizado(existing)) {
        stats.skipped_modern += 1;
      } else {
        stats.skipped_low_conf += 1;
      }

      if (Object.keys(patch).length && !dryRun) {
        writeFields(row, idx, patch);
      }
    }
  }

  const missingInExcel = [...byCodigo.keys()].filter((c) => !codigosExcel.has(c));

  if (!dryRun) {
    await wb.xlsx.writeFile(EXCEL_PATH);
  }

  console.log(`[estudo-sync] Excel: ${EXCEL_PATH}`);
  console.log(`  · Cadastro: ${byCodigo.size} SKUs (${source})`);
  console.log(`  · No Excel: ${stats.in_excel} linhas`);
  console.log(`  · sku_atual actualizado: ${stats.sku_atual_updated}`);
  console.log(`  · nomenclatura proposta aplicada: ${stats.nomenclatura_updated}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`  · ignorados (já modernos): ${stats.skipped_modern}`);
  console.log(`  · ignorados (confiança baixa): ${stats.skipped_low_conf}`);
  console.log(`  · no Excel sem cadastro: ${stats.no_cadastro}`);
  console.log(`  · no cadastro ainda fora do Excel: ${missingInExcel.length}`);
  if (missingInExcel.length && missingInExcel.length <= 15) {
    console.log(`    amostra: ${missingInExcel.slice(0, 15).join(', ')}`);
  }
  console.log('');
  console.log('Próximo passo: npm run estudo:catalog-manifest && npm run build');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
