#!/usr/bin/env node
/**
 * Excel — catálogo para comparação com Conta Azul (sem campos hierárquicos).
 *
 * npm run export:conta-azul
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-conta-azul.xlsx');

const COLUMNS = [
  { header: 'Código interno', key: 'codigo_interno', width: 16 },
  { header: 'Descrição do SKU', key: 'descricao_sku', width: 48 },
  { header: 'Unidade base', key: 'unidade_base', width: 14 },
  { header: 'Fator base', key: 'fator_base', width: 12 },
  { header: 'Unidade vitrine', key: 'unidade_vitrine', width: 16 },
  { header: 'Demais unidades', key: 'demais_unidades', width: 22 },
  { header: 'Fator de conversão', key: 'fatores_conversao', width: 20 },
  { header: 'Valor compra (base)', key: 'valor_compra', width: 18, numFmt: '#,##0.00' },
  { header: 'Frete (base)', key: 'custo_frete', width: 14, numFmt: '#,##0.00' },
  { header: 'Imposto 1 (base)', key: 'custo_imposto1', width: 16, numFmt: '#,##0.00' },
  { header: 'Imposto 2 (base)', key: 'custo_imposto2', width: 16, numFmt: '#,##0.00' },
  { header: 'Outros custos (base)', key: 'custo_outros', width: 18, numFmt: '#,##0.00' },
  { header: 'Avaria (%)', key: 'avaria_percentual', width: 12, numFmt: '#,##0.00' },
  { header: 'Desconto compra (base)', key: 'desconto_compra', width: 20, numFmt: '#,##0.00' },
  { header: 'Custo total (base)', key: 'custo_total', width: 18, numFmt: '#,##0.00' },
  { header: 'Markup (%)', key: 'markup', width: 14, numFmt: '#,##0.00' },
  { header: 'Valor venda (base)', key: 'valor_venda', width: 18, numFmt: '#,##0.00' },
  { header: 'Estoque atual (base)', key: 'estoque_atual', width: 18, numFmt: '#,##0.000' },
  { header: 'Estoque mínimo', key: 'estoque_minimo', width: 16, numFmt: '#,##0.000' },
  { header: 'Tempo reposição (dias)', key: 'tempo_reposicao', width: 22 },
  { header: 'Casas decimais', key: 'casas_decimais', width: 16 },
];

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

function normalizeSigla(value, fallback = 'UN') {
  const s = String(value ?? '').trim().toUpperCase();
  return s || fallback;
}

function parseNumericText(value) {
  const raw = String(value ?? '').replace(/[^0-9.,-]/g, '');
  if (!raw) return 0;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveVitrineSigla(unidadePrincipal, unidadeVitrine) {
  const principal = normalizeSigla(unidadePrincipal);
  const raw = String(unidadeVitrine ?? '').trim();
  if (!raw) return principal;
  const vitrine = normalizeSigla(raw, '');
  return vitrine || principal;
}

function formatAlternativas(unidadesAlternativas = []) {
  const siglas = [];
  const fatores = [];
  for (const item of unidadesAlternativas) {
    const sigla = normalizeSigla(item?.unidade, '');
    if (!sigla) continue;
    siglas.push(sigla);
    fatores.push(String(num(item?.fator_conversao, 1)));
  }
  return {
    demais_unidades: siglas.join(' | '),
    fatores_conversao: fatores.join(' | '),
  };
}

function calcMarkup(custoTotal, valorVenda, precoVendaPercentual) {
  if (custoTotal > 0 && valorVenda > 0) {
    return ((valorVenda - custoTotal) / custoTotal) * 100;
  }
  return num(precoVendaPercentual, 0);
}

function mapRow(row) {
  const unidadeBase = normalizeSigla(row.unidade_principal);
  const { demais_unidades, fatores_conversao } = formatAlternativas(row.unidades_alternativas);
  const valorCompra = num(row.valor_compra);
  const custoTotal = num(row.preco_custo_calculado);
  const valorVenda = num(row.preco_venda_padrao);

  return {
    codigo_interno: row.codigo_interno || '',
    descricao_sku: row.nome || '',
    unidade_base: unidadeBase,
    fator_base: 1,
    unidade_vitrine: resolveVitrineSigla(unidadeBase, row.unidade_vitrine),
    demais_unidades,
    fatores_conversao,
    valor_compra: valorCompra,
    custo_frete: num(row.custo_frete_padrao),
    custo_imposto1: num(row.custo_imposto1_padrao),
    custo_imposto2: num(row.custo_imposto2_padrao),
    custo_outros: num(row.custo_outros_padrao),
    avaria_percentual: num(row.avaria_percentual),
    desconto_compra: parseNumericText(row.desconto_compra_padrao),
    custo_total: custoTotal,
    markup: Math.round(calcMarkup(custoTotal, valorVenda, row.preco_venda_percentual) * 100) / 100,
    valor_venda: valorVenda,
    estoque_atual: num(row.estoque_atual),
    estoque_minimo: num(row.estoque_minimo),
    tempo_reposicao: row.tempo_reposicao_dias ?? '',
    casas_decimais: row.casas_decimais ?? 0,
  };
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(`
    select
      coalesce(codigo_interno, '') as codigo_interno,
      coalesce(nome, '') as nome,
      coalesce(unidade_principal, 'UN') as unidade_principal,
      coalesce(unidade_vitrine, '') as unidade_vitrine,
      coalesce(unidades_alternativas, '[]'::jsonb) as unidades_alternativas,
      coalesce(valor_compra, 0) as valor_compra,
      coalesce(custo_frete_padrao, 0) as custo_frete_padrao,
      coalesce(custo_imposto1_padrao, 0) as custo_imposto1_padrao,
      coalesce(custo_imposto2_padrao, 0) as custo_imposto2_padrao,
      coalesce(custo_outros_padrao, 0) as custo_outros_padrao,
      coalesce(avaria_percentual, 0) as avaria_percentual,
      desconto_compra_padrao,
      coalesce(preco_custo_calculado, 0) as preco_custo_calculado,
      coalesce(preco_venda_padrao, 0) as preco_venda_padrao,
      coalesce(preco_venda_percentual, 0) as preco_venda_percentual,
      coalesce(estoque_atual, 0) as estoque_atual,
      coalesce(estoque_minimo, 0) as estoque_minimo,
      tempo_reposicao_dias,
      coalesce(casas_decimais, 0) as casas_decimais
    from produto
    where ativo = true
    order by codigo_interno nulls last, nome
  `);
  await client.end();

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet('Catálogo Conta Azul', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS;
  styleHeader(ws.getRow(1));

  for (const row of rows) {
    const mapped = mapRow(row);
    const excelRow = ws.addRow(mapped);
    COLUMNS.forEach((col, idx) => {
      if (col.numFmt) {
        excelRow.getCell(idx + 1).numFmt = col.numFmt;
      }
    });
  }

  if (rows.length) {
    const lastCol = String.fromCharCode(64 + COLUMNS.length);
    ws.autoFilter = { from: 'A1', to: `${lastCol}${rows.length + 1}` };
  }

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
