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

const LINHAS_MESTRE = [
  { ordem: 10, codigo: 'CIMENTO', nome: 'CIMENTO', tipo: 'solo' },
  { ordem: 20, codigo: 'ARGAMASSA', nome: 'ARGAMASSA', tipo: 'mix' },
  { ordem: 30, codigo: 'PISO', nome: 'PISO / CERÂMICA DE PISO', tipo: 'portfolio' },
  { ordem: 40, codigo: 'PORCELANATO', nome: 'PORCELANATO', tipo: 'portfolio' },
  { ordem: 50, codigo: 'REVESTIMENTO', nome: 'REVESTIMENTO', tipo: 'portfolio' },
  { ordem: 55, codigo: 'ELETRODUTO', nome: 'ELETRODUTO', tipo: 'mix' },
  { ordem: 56, codigo: 'FIO', nome: 'FIOS ELÉTRICOS', tipo: 'mix' },
  { ordem: 57, codigo: 'VERGALHAO', nome: 'VERGALHÃO', tipo: 'mix' },
  { ordem: 60, codigo: 'SOLDAVEL', nome: 'SOLDÁVEL', tipo: 'mix' },
  { ordem: 70, codigo: 'ESGOTO', nome: 'ESGOTO', tipo: 'mix' },
  { ordem: 80, codigo: 'ROSCAVEL', nome: 'ROSCÁVEL', tipo: 'mix' },
  { ordem: 90, codigo: 'TINTA', nome: 'TINTA', tipo: 'portfolio' },
  { ordem: 100, codigo: 'VERNIZ', nome: 'VERNIZ', tipo: 'portfolio' },
  { ordem: 110, codigo: 'MASSA_CORRIDA', nome: 'MASSA CORRIDA', tipo: 'mix' },
  { ordem: 120, codigo: 'MASSA_ACRILICA', nome: 'MASSA ACRÍLICA', tipo: 'mix' },
  { ordem: 130, codigo: 'REJUNTE', nome: 'REJUNTE', tipo: 'mix' },
  { ordem: 140, codigo: 'PREGO', nome: 'PREGO', tipo: 'solo' },
  { ordem: 150, codigo: 'PARAFUSO', nome: 'PARAFUSO', tipo: 'mix' },
  { ordem: 160, codigo: 'TORNEIRA', nome: 'TORNEIRA', tipo: 'portfolio' },
  { ordem: 170, codigo: 'METAIS_SANITARIOS', nome: 'METAIS SANITÁRIOS', tipo: 'portfolio' },
  { ordem: 180, codigo: 'TUBO', nome: 'TUBO (geral)', tipo: 'mix' },
  { ordem: 190, codigo: 'LIXA', nome: 'LIXA', tipo: 'mix' },
  { ordem: 200, codigo: 'ELETRICA', nome: 'MATERIAL ELÉTRICO', tipo: 'mix' },
  { ordem: 210, codigo: 'FERRAGEM', nome: 'FERRAGEM', tipo: 'mix' },
  { ordem: 220, codigo: 'IMPERMEABILIZANTE', nome: 'IMPERMEABILIZANTE', tipo: 'mix' },
  { ordem: 230, codigo: 'ADESIVO', nome: 'ADESIVO', tipo: 'mix' },
  { ordem: 900, codigo: 'OUTROS', nome: 'OUTROS / A CLASSIFICAR', tipo: 'solo' },
];

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

function findLinhaMeta(codigo) {
  return LINHAS_MESTRE.find((l) => l.codigo === codigo) ?? LINHAS_MESTRE.find((l) => l.codigo === 'OUTROS');
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
  } else if (['ESGOTO', 'ROSCÁVEL', 'ROSCAVEL', 'ELETRODUTO'].includes(norm(h2)) && !norm(h1).includes('BUCHA')) {
    patch = {
      linha_nome: norm(h2) === 'ESGOTO' ? 'ESGOTO' : norm(h2).includes('ROSC') ? 'ROSCÁVEL' : h1u,
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

function isFalsoH1(produto) {
  const h1 = trim(produto.campo_hierarquico_1);
  const nome = trim(produto.nome);
  if (!h1) return false;
  if (norm(h1) === norm(nome)) return true;
  if (nome.toUpperCase().startsWith(h1.toUpperCase()) && h1.length > 25) return true;
  if (h1.length > 45) return true;
  const tokens = h1.split(/\s+/);
  if (tokens.length >= 5 && tokens.filter((t) => /\d/.test(t)).length >= 2) return true;
  return false;
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

  const linhaCod = falsoH1 ? 'OUTROS' : (plan.linha_codigo || inferirLinhaCodigo(produto));
  const linhaMeta = plan.linha_codigo
    ? { codigo: plan.linha_codigo, nome: plan.linha_nome, tipo: plan.linha_tipo }
    : findLinhaMeta(linhaCod);
  const solo = linhaMeta.tipo === 'solo';
  const pcNome = solo ? trim(linhaMeta.nome) : trim(plan.produto_compra_nome || linhaMeta.nome);
  const eixoA = trim(plan.eixo_a);
  const eixoB = trim(plan.eixo_b);
  let novoSku;
  if (solo && linhaCod === 'OUTROS') {
    // Falsos h1 / por classificar — mantém nome actual até passar pelo Excel.
    novoSku = trim(produto.nome);
  } else if (solo) {
    novoSku = montarNomeProposto({ produtoCompraNome: pcNome, eixoA, eixoB, marca: produto.marca }) || trim(produto.nome);
  } else {
    novoSku = montarNomeProposto({ produtoCompraNome: pcNome, eixoA, eixoB, marca: produto.marca }) || trim(produto.nome);
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
  'categoria',
];

function buildExportRows(produtos, excelByCodigo, excelLinhas) {
  return produtos.map((p) => {
    const estudo = enrichEstudo(p, excelByCodigo, excelLinhas);
    return [
      trim(p.codigo_interno),
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
      trim(p.categoria_nome),
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

  const widths = [14, 22, 24, 12, 28, 42, 18, 14, 28, 14, 14, 42, 28];
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
  const excelLinhas = Object.fromEntries((manifest.linhas || []).map((l) => [l.codigo, l]));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL em falta — ver npm run secrets:check');
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`
    select id, nome, codigo_interno, marca, categoria_nome,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3,
           campo_hierarquico_4, campo_hierarquico_5
    from public.produto
    where coalesce(ativo, true) = true
    order by categoria_nome nulls last, campo_hierarquico_1, codigo_interno
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
  console.log('[export-sku-hierarquia-estudo] OK');
  for (const f of written) console.log(`  ficheiro: ${f}`);
  console.log(`  skus: ${rows.length}`);
  console.log(`  manifest: ${source}`);
  console.log(`  com excel cerâmica: ${excelCount}`);
}

main().catch((err) => {
  console.error('[export-sku-hierarquia-estudo]', err.message);
  process.exit(1);
});
