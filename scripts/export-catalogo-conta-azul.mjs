#!/usr/bin/env node
/**
 * Preenche a planilha modelo oficial da Conta Azul com o catálogo P38.
 *
 * npm run export:conta-azul
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const TEMPLATE = path.join(
  process.cwd(),
  'docs',
  '[Conta Azul] Planilha modelo - Cadastro de produtos (2).xlsx',
);
const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-conta-azul.xlsx');

const FORBIDDEN_CHARS_RE = /['"!@#%¨&*()ªº§+_\-?°\[\]{}:;]/g;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSigla(value, fallback = '') {
  const s = String(value ?? '').trim().toUpperCase();
  return s || fallback;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function sanitizeContaAzulText(value) {
  return String(value ?? '')
    .replace(FORBIDDEN_CHARS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSku(value) {
  return String(value ?? '')
    .replace(FORBIDDEN_CHARS_RE, '')
    .replace(/\s+/g, '')
    .trim();
}

function sanitizeBarcode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || '';
}

function resolveVitrineSigla(unidadePrincipal, unidadeVitrine) {
  const principal = normalizeSigla(unidadePrincipal, 'UN') || 'UN';
  const raw = String(unidadeVitrine ?? '').trim();
  if (!raw) return principal;
  return normalizeSigla(raw, principal) || principal;
}

function findAltUnit(unidadesAlternativas, sigla) {
  const target = normalizeSigla(sigla, '');
  if (!target) return null;
  for (const item of unidadesAlternativas || []) {
    if (normalizeSigla(item?.unidade, '') === target) return item;
  }
  return null;
}

function resolveExportUnit(row) {
  const base = normalizeSigla(row.unidade_principal, 'UN') || 'UN';
  const exportUnit = resolveVitrineSigla(base, row.unidade_vitrine);
  if (exportUnit === base) {
    return { exportUnit: base, fator: 1 };
  }
  const alt = findAltUnit(row.unidades_alternativas, exportUnit);
  const fator = num(alt?.fator_conversao, 1) || 1;
  return { exportUnit, fator: fator > 0 ? fator : 1 };
}

function qtyBaseToCommercial(qtyBase, fator, casasDecimais = 0) {
  const f = fator > 0 ? fator : 1;
  const raw = num(qtyBase) / f;
  if (casasDecimais <= 0) return Math.max(0, Math.round(raw));
  return round2(Math.max(0, raw));
}

function valueBaseToCommercial(valueBase, fator) {
  const f = fator > 0 ? fator : 1;
  return round2(num(valueBase) * f);
}

function mapRow(row) {
  const { exportUnit, fator } = resolveExportUnit(row);
  const casasDecimais = num(row.casas_decimais, 0);
  const custoBase = num(row.preco_custo_calculado) || num(row.valor_compra);
  const precoBase = num(row.preco_venda_padrao);
  const estoqueMax = num(row.estoque_maximo);

  return [
    sanitizeContaAzulText(row.nome),
    sanitizeSku(row.codigo_interno),
    qtyBaseToCommercial(row.estoque_atual, fator, casasDecimais),
    valueBaseToCommercial(custoBase, fator),
    valueBaseToCommercial(precoBase, fator),
    sanitizeBarcode(row.codigo_barras),
    sanitizeContaAzulText(exportUnit),
    '',
    sanitizeContaAzulText(row.categoria_nome),
    '',
    '',
    estoqueMax > 0 ? qtyBaseToCommercial(estoqueMax, fator, casasDecimais) : '',
    qtyBaseToCommercial(row.estoque_minimo, fator, casasDecimais),
    0,
    '',
  ];
}

async function fetchProdutos(client) {
  const { rows } = await client.query(`
    select
      coalesce(codigo_interno, '') as codigo_interno,
      coalesce(codigo_barras, '') as codigo_barras,
      coalesce(nome, '') as nome,
      coalesce(categoria_nome, '') as categoria_nome,
      coalesce(unidade_principal, 'UN') as unidade_principal,
      coalesce(unidade_vitrine, '') as unidade_vitrine,
      coalesce(unidades_alternativas, '[]'::jsonb) as unidades_alternativas,
      coalesce(valor_compra, 0) as valor_compra,
      coalesce(preco_custo_calculado, 0) as preco_custo_calculado,
      coalesce(preco_venda_padrao, 0) as preco_venda_padrao,
      coalesce(estoque_atual, 0) as estoque_atual,
      coalesce(estoque_minimo, 0) as estoque_minimo,
      coalesce(estoque_maximo, 0) as estoque_maximo,
      coalesce(casas_decimais, 0) as casas_decimais
    from produto
    where ativo = true
    order by codigo_interno nulls last, nome
  `);
  return rows;
}

async function main() {
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error(`Planilha modelo não encontrada: ${TEMPLATE}`);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const rows = await fetchProdutos(client);
  await client.end();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet('Produtos');
  if (!ws) throw new Error('Aba "Produtos" não encontrada no modelo Conta Azul');

  const startRow = 2;
  const maxTemplateRows = ws.rowCount;
  for (let r = startRow; r <= maxTemplateRows; r++) {
    ws.getRow(r).values = [];
  }

  rows.forEach((row, idx) => {
    const excelRow = ws.getRow(startRow + idx);
    const values = mapRow(row);
    values.forEach((value, colIdx) => {
      excelRow.getCell(colIdx + 1).value = value === '' ? null : value;
    });
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  const artifact = '/opt/cursor/artifacts/P38-catalogo-conta-azul.xlsx';
  try {
    fs.copyFileSync(OUT, artifact);
  } catch {
    // ok fora do Cloud Agent
  }

  console.log(`[export-catalogo-conta-azul] ${rows.length} SKUs → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
