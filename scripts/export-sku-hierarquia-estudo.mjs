#!/usr/bin/env node
/**
 * Export estudo: cadastro actual vs hierarquia portal (LINHA → PC → eixos → novo SKU).
 *
 * Uso:
 *   node scripts/export-sku-hierarquia-estudo.mjs
 *   node scripts/export-sku-hierarquia-estudo.mjs --format=xlsx
 *   node scripts/export-sku-hierarquia-estudo.mjs --format=csv --out=docs/exports/meu.csv
 *   node scripts/export-sku-hierarquia-estudo.mjs --format=both
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { loadDotEnvFiles } from './base44-env.mjs';
import { planInferenciaEstruturada, inferirLinhaCodigoEstruturado } from './lib/inferenciaHierarquiaEstudo.mjs';
import { planLinhaPorTipoProduto } from './lib/inferenciaLinhaPorTipo.mjs';
import {
  planInferenciaOutrosMacro,
  compactarRotulo,
  deveUsarOutros,
  isFalsoH1,
} from './lib/inferenciaOutrosMacro.mjs';
import { findLinhaMeta, mergeLinhasComManifest } from './lib/hierarquiaPortalLinhas.mjs';

loadDotEnvFiles();

const DEFAULT_BASENAME = 'P38-sku-hierarquia-estudo';
const DEFAULT_DIR = path.join(process.cwd(), 'docs', 'exports');
const MANIFEST_CANDIDATES = [
  path.join(process.cwd(), 'src', 'data', 'portalExcelManifest.generated.json'),
  path.join(process.cwd(), 'docs', 'exports', 'portal-excel-manifest.snapshot.json'),
];

const TINTA_H3_TO_PRODUTO_COMPRA = {
  ESMALTE: { codigo: 'TINTA_ESMALTE_SINTETICO', nome: 'TINTA ESMALTE SINTÉTICO' },
  'P/ PISO': { codigo: 'TINTA_P_PISO', nome: 'TINTA P/ PISO' },
  'ACR. FOSCO ECON.': { codigo: 'TINTA_ACR_FOSCO_ECON', nome: 'TINTA ACRÍLICA FOSCO ECONÔMICO' },
  'SEMI-BRILHO': { codigo: 'TINTA_SEMI_BRILHO', nome: 'TINTA SEMI-BRILHO' },
  STANDARD: { codigo: 'TINTA_STANDARD', nome: 'TINTA STANDARD' },
  'STANDARD POUPE+': { codigo: 'TINTA_STANDARD_POUPE', nome: 'TINTA STANDARD POUPE+' },
  'INT/EXT STAND': { codigo: 'TINTA_INT_EXT_STAND', nome: 'TINTA INT/EXT STANDARD' },
};

function parseArgs(argv) {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const formatArg = argv.find((a) => a.startsWith('--format='));
  const format = (formatArg?.slice(9) || 'xlsx').toLowerCase();
  if (!['xlsx', 'csv', 'both'].includes(format)) {
    throw new Error('--format deve ser xlsx, csv ou both');
  }
  let out = outArg ? outArg.slice(6) : null;
  if (!out) {
    if (format === 'csv') out = path.join(DEFAULT_DIR, `${DEFAULT_BASENAME}.csv`);
    else if (format === 'xlsx') out = path.join(DEFAULT_DIR, `${DEFAULT_BASENAME}.xlsx`);
    else out = path.join(DEFAULT_DIR, DEFAULT_BASENAME);
  }
  return { out, format };
}

function trim(s) {
  return String(s ?? '').trim();
}

function norm(s) {
  return trim(s).toUpperCase();
}

function slug(s) {
  return norm(s)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'ITEM';
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cols) {
  return cols.map(csvCell).join(',');
}

function loadManifest() {
  for (const p of MANIFEST_CANDIDATES) {
    if (fs.existsSync(p)) {
      return { manifest: JSON.parse(fs.readFileSync(p, 'utf8')), source: p };
    }
  }
  try {
    const raw = execSync('git show 96b80e9c:src/data/portalExcelManifest.generated.json', { encoding: 'utf8' });
    return { manifest: JSON.parse(raw), source: 'git:96b80e9c:portalExcelManifest' };
  } catch {
    throw new Error(
      'Manifest cerâmica não encontrado. Gere src/data/portalExcelManifest.generated.json ou docs/exports/portal-excel-manifest.snapshot.json',
    );
  }
}

function isSoldavel(produto) {
  const h2 = norm(produto.campo_hierarquico_2);
  return h2 === 'SOLDÁVEL' || h2 === 'SOLDAVEL';
}

function inferirLinhaCodigo(produto) {
  return inferirLinhaCodigoEstruturado(produto);
}

function mapTintaH3(h3Raw) {
  const h3 = norm(h3Raw);
  if (!h3) return null;
  return TINTA_H3_TO_PRODUTO_COMPRA[h3] ?? { codigo: `TINTA_${slug(h3)}`, nome: `TINTA ${h3}` };
}

function soldavelProdutoCompraNome(h1, h3) {
  const peca = norm(h1);
  const d3 = norm(h3);
  if (peca === 'JOELHO') {
    if (d3 === 'MISTO') return 'JOELHO MISTO SOLDÁVEL';
    if (d3 === '45' || d3 === '90') return `JOELHO ${d3}° SOLDÁVEL`;
  }
  return `${peca} SOLDÁVEL`;
}

function soldavelEixoB(h1, h3, h4) {
  const peca = norm(h1);
  const d3 = trim(h3);
  const d4 = trim(h4);
  if (peca === 'JOELHO' && ['45', '90', 'MISTO'].includes(norm(h3))) return d4 || d3;
  return d3 || d4;
}

function montarNomeProposto({ produtoCompraNome, eixoA, eixoB, marca }) {
  return [produtoCompraNome, eixoA, eixoB, marca].map((s) => trim(s)).filter(Boolean).join(' ');
}

function planLinhaCompraAnalise(produto = {}) {
  const structured = planInferenciaEstruturada(produto);
  if (structured) {
    return {
      linha_codigo: structured.linha_codigo,
      linha_nome: structured.linha_nome,
      linha_tipo: structured.linha_tipo,
      produto_compra_nome: structured.produto_compra_nome,
      eixo_a: structured.eixo_a,
      eixo_b: structured.eixo_b,
      confianca: structured.confianca,
      motivo: structured.motivo,
    };
  }

  const porTipo = planLinhaPorTipoProduto(produto);
  if (porTipo) {
    return {
      linha_codigo: porTipo.linha_codigo,
      linha_nome: porTipo.linha_nome,
      linha_tipo: porTipo.linha_tipo,
      produto_compra_nome: porTipo.produto_compra_nome,
      eixo_a: porTipo.eixo_a,
      eixo_b: porTipo.eixo_b,
      confianca: porTipo.confianca,
      motivo: porTipo.motivo,
    };
  }

  const macro = planInferenciaOutrosMacro(produto);
  if (macro) {
    return {
      linha_codigo: macro.linha_codigo,
      linha_nome: macro.linha_nome,
      linha_tipo: macro.linha_tipo,
      produto_compra_nome: macro.produto_compra_nome,
      eixo_a: macro.eixo_a,
      eixo_b: macro.eixo_b,
      confianca: macro.confianca,
      motivo: macro.motivo,
    };
  }

  const h1 = trim(produto.campo_hierarquico_1);
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);

  if (!h1) {
    return { linha_nome: '', produto_compra_nome: '', eixo_a: '', eixo_b: '', confianca: 'baixa' };
  }

  const h1u = norm(h1);
  let patch;

  if (h1u === 'PISO' && h2 && h3) {
    patch = { linha_nome: 'PISO / CERÂMICA DE PISO', produto_compra_nome: 'PISO', eixo_a: h2, eixo_b: h3, confianca: 'alta' };
  } else if (h1u.includes('CIMENTO')) {
    patch = {
      linha_nome: 'CIMENTO',
      produto_compra_nome: h1u.includes('BRANCO') ? 'CIMENTO BRANCO' : 'CIMENTO PORTLAND',
      eixo_a: '',
      eixo_b: '',
      confianca: 'alta',
    };
  } else if (h1u === 'ARGAMASSA' && h2 && h3) {
    patch = { linha_nome: 'ARGAMASSA', produto_compra_nome: 'ARGAMASSA', eixo_a: h3, eixo_b: h2, confianca: 'alta' };
  } else if (isSoldavel(produto)) {
    const med = soldavelEixoB(h1, h3, h4);
    patch = {
      linha_nome: 'SOLDÁVEL',
      produto_compra_nome: soldavelProdutoCompraNome(h1, h3),
      eixo_a: '',
      eixo_b: med || '',
      confianca: med ? 'alta' : 'baixa',
    };
  } else if (h1u === 'TINTA' && h2) {
    const map = mapTintaH3(h3);
    patch = map
      ? { linha_nome: 'TINTA', produto_compra_nome: map.nome, eixo_a: h2, eixo_b: h4 || '', confianca: 'alta' }
      : { linha_nome: 'TINTA', produto_compra_nome: '(tinta sem h3)', eixo_a: h2, eixo_b: h4 || '', confianca: 'baixa' };
  } else if (['ESGOTO', 'ROSCÁVEL', 'ROSCAVEL', 'ELETRODUTO', 'SOLDÁVEL', 'SOLDAVEL'].includes(norm(h2)) && !norm(h1).includes('BUCHA')) {
    const h2n = norm(h2);
    const linhaNome = h2n === 'ESGOTO' ? 'ESGOTO' : h2n.includes('ROSC') ? 'ROSCÁVEL' : h2n.includes('SOLD') ? 'SOLDÁVEL' : h2n.includes('ELETRO') ? 'ELETRODUTO' : h2;
    patch = {
      linha_nome: linhaNome,
      produto_compra_nome: `${h1u} ${h2}`.replace(/\s+/g, ' ').trim(),
      eixo_a: h3 || '',
      eixo_b: h4 || '',
      confianca: 'alta',
    };
  } else if (h2 && h3) {
    patch = { linha_nome: h1u, produto_compra_nome: h1u, eixo_a: h2, eixo_b: h3, confianca: 'media' };
  } else if (h2) {
    patch = { linha_nome: h1u, produto_compra_nome: h1u, eixo_a: h2, eixo_b: h4 || h3 || '', confianca: 'media' };
  } else {
    patch = { linha_nome: h1u, produto_compra_nome: h1u, eixo_a: '', eixo_b: '', confianca: 'media' };
  }

  return patch;
}

function enrichEstudo(produto, excelByCodigo, excelLinhas) {
  const cod = trim(produto.codigo_interno).toUpperCase();
  const excel = excelByCodigo[cod] || excelByCodigo[trim(produto.codigo_interno)];
  const plan = planLinhaCompraAnalise(produto);
  const falsoH1 = isFalsoH1(produto);

  if (excel) {
    const linhaMeta = excelLinhas[excel.linha_codigo] ?? {
      codigo: excel.linha_codigo,
      nome: excel.linha_nome,
      tipo: 'portfolio',
    };
    const solo = linhaMeta.tipo === 'solo';
    const pcNome = solo ? trim(linhaMeta.nome) : trim(excel.produto_compra);
    const eixoA = trim(excel.ex_a || plan.eixo_a);
    const eixoB = trim(excel.ex_b || plan.eixo_b);
    const novoSku = trim(excel.novo_sku) || montarNomeProposto({
      produtoCompraNome: pcNome,
      eixoA,
      eixoB,
      marca: produto.marca,
    });

    return {
      linha: trim(linhaMeta.nome),
      produto_compra: pcNome,
      eixo_a: eixoA,
      eixo_b: eixoB,
      novo_sku: novoSku || trim(produto.nome),
      confianca: 'excel',
      falso_h1: falsoH1,
    };
  }

  const usarOutros = deveUsarOutros(produto, plan);
  const linhaCod = usarOutros ? 'OUTROS' : (plan.linha_codigo || inferirLinhaCodigo(produto));
  const linhaMeta = plan.linha_codigo && !usarOutros
    ? { codigo: plan.linha_codigo, nome: plan.linha_nome, tipo: plan.linha_tipo }
    : findLinhaMeta(linhaCod, mergeLinhasComManifest(Object.values(excelLinhas)));
  const solo = linhaMeta.tipo === 'solo';
  const pcNome = solo ? trim(linhaMeta.nome) : trim(plan.produto_compra_nome || linhaMeta.nome);
  const eixoA = trim(plan.eixo_a);
  const eixoB = trim(plan.eixo_b);
  let novoSku;
  if (solo && linhaCod === 'OUTROS') {
    novoSku = trim(produto.nome);
  } else {
    const raw = montarNomeProposto({ produtoCompraNome: pcNome, eixoA, eixoB, marca: produto.marca });
    novoSku = (plan.motivo === 'macro_outros' || plan.motivo === 'linha_por_tipo' || plan.motivo === 'peca_conexao' ? compactarRotulo(raw) : raw)
      || trim(produto.nome);
  }

  return {
    linha: trim(linhaMeta.nome),
    produto_compra: solo ? '' : pcNome,
    eixo_a: eixoA,
    eixo_b: eixoB,
    novo_sku: novoSku || trim(produto.nome),
    confianca: plan.confianca,
    falso_h1: falsoH1,
  };
}

const EXPORT_HEADERS = [
  'codigo_interno',
  'categoria_atual',
  'linha',
  'produto_compra',
  'eixo_a',
  'eixo_b',
  'novo_sku',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'sku_atual',
];

function resolveCategoriaAtual(produto) {
  return trim(produto.categoria_atual || produto.categoria_nome);
}

function buildExportRows(produtos, excelByCodigo, excelLinhas) {
  return produtos.map((p) => {
    const estudo = enrichEstudo(p, excelByCodigo, excelLinhas);
    return [
      trim(p.codigo_interno),
      resolveCategoriaAtual(p),
      estudo.linha,
      estudo.produto_compra,
      estudo.eixo_a,
      estudo.eixo_b,
      estudo.novo_sku,
      trim(p.campo_hierarquico_1),
      trim(p.campo_hierarquico_2),
      trim(p.campo_hierarquico_3),
      trim(p.campo_hierarquico_4),
      trim(p.campo_hierarquico_5),
      trim(p.nome),
    ];
  });
}

function resolveOutputPaths(out, format) {
  if (format === 'both') {
    const base = out.endsWith('.csv') || out.endsWith('.xlsx')
      ? out.replace(/\.(csv|xlsx)$/i, '')
      : out;
    return { xlsx: `${base}.xlsx`, csv: `${base}.csv` };
  }
  if (format === 'csv') {
    return { csv: out.endsWith('.csv') ? out : `${out}.csv` };
  }
  return { xlsx: out.endsWith('.xlsx') ? out : `${out}.xlsx` };
}

async function writeCsv(filePath, headers, dataRows) {
  const lines = [csvLine(headers), ...dataRows.map((row) => csvLine(row))];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `\ufeff${lines.join('\n')}\n`, 'utf8');
}

async function writeXlsx(filePath, headers, dataRows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 export-sku-hierarquia-estudo';
  wb.created = new Date();

  const ws = wb.addWorksheet('Estudo hierarquia', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow(headers);
  for (const row of dataRows) ws.addRow(row);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };

  const widths = [14, 32, 22, 24, 12, 28, 42, 18, 14, 28, 14, 14, 42];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i] ?? 16;
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + dataRows.length, column: headers.length },
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);
}

async function main() {
  const { out, format } = parseArgs(process.argv.slice(2));
  const { manifest, source } = loadManifest();
  const excelByCodigo = Object.fromEntries(
    Object.entries(manifest.skus || {}).map(([k, v]) => [norm(k), v]),
  );
  const excelLinhas = mergeLinhasComManifest(manifest.linhas || []);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL em falta — ver npm run secrets:check');
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`
    select p.id, p.nome, p.codigo_interno, p.marca,
           coalesce(nullif(trim(p.categoria_nome), ''), cat_map.categoria_nome, '') as categoria_atual,
           p.categoria_nome,
           p.campo_hierarquico_1, p.campo_hierarquico_2, p.campo_hierarquico_3,
           p.campo_hierarquico_4, p.campo_hierarquico_5
    from public.produto p
    left join (
      select categoria_id, max(nullif(trim(categoria_nome), '')) as categoria_nome
      from public.produto
      where coalesce(ativo, true) = true
      group by categoria_id
    ) cat_map on cat_map.categoria_id = p.categoria_id
    where coalesce(p.ativo, true) = true
    order by categoria_atual nulls last, p.campo_hierarquico_1, p.codigo_interno
  `);
  await pool.end();

  const dataRows = buildExportRows(rows, excelByCodigo, excelLinhas);
  const paths = resolveOutputPaths(out, format);
  const written = [];

  if (paths.xlsx) {
    await writeXlsx(paths.xlsx, EXPORT_HEADERS, dataRows);
    written.push(paths.xlsx);
  }
  if (paths.csv) {
    await writeCsv(paths.csv, EXPORT_HEADERS, dataRows);
    written.push(paths.csv);
  }

  const excelCount = rows.filter((p) => excelByCodigo[norm(p.codigo_interno)]).length;
  const outrosCount = dataRows.filter((r) => r[2]?.includes('OUTROS')).length;
  const pcUnicos = new Set(dataRows.map((r) => r[3]).filter(Boolean)).size;
  const catPreenchida = dataRows.filter((r) => trim(r[1])).length;
  console.log('[export-sku-hierarquia-estudo] OK');
  for (const f of written) console.log(`  ficheiro: ${f}`);
  console.log(`  skus: ${rows.length}`);
  console.log(`  manifest: ${source}`);
  console.log(`  com excel cerâmica: ${excelCount}`);
  console.log(`  linha OUTROS: ${outrosCount}`);
  console.log(`  produtos compra únicos: ${pcUnicos}`);
  console.log(`  com categoria_atual: ${catPreenchida}`);
}

main().catch((err) => {
  console.error('[export-sku-hierarquia-estudo]', err.message);
  process.exit(1);
});
