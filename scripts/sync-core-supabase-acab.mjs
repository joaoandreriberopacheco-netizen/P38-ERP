#!/usr/bin/env node
/**
 * Sincroniza torneiras e fechaduras activas (Supabase) → P38-sku-hierarquia-core.xlsx.
 * Legados inactivos ou fora do Supabase vão para etapa Transversal (espaço).
 *
 *   npm run sync:core-acab
 *   npm run sync:core-acab -- --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { cellStr } from './lib/catalogo3x3Map.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const dryRun = process.argv.includes('--dry-run');

const HEADERS = [
  'codigo_interno',
  'etapa',
  'core',
  'linha',
  'produto_compra',
  'eixo_a',
  'eixo_b',
  'novo_sku',
  'sku_atual',
];

const ESPACO = {
  etapa: '8 — Transversal',
  core: 'CATALOGO_ESPACO',
  linha: 'Legado — fora do catálogo activo',
};

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isTorneiraH1(h1 = '') {
  const n = norm(h1);
  return n === 'TORNEIRA' || n === 'PURIFICADOR' || n.startsWith('TORNEIRA ') || n.startsWith('PURIFICADOR ');
}

function isFechaduraH1(h1 = '') {
  const n = norm(h1);
  return n === 'FECHADURA' || n.startsWith('FECHADURA ');
}

function isAcabRow(row) {
  const pc = norm(row.produto_compra).replace(/^LEGADO — /, '');
  const lin = norm(row.linha);
  const core = norm(row.core);
  if (core === 'CATALOGO_ESPACO') {
    if (pc.includes('FECHADURA')) return 'fechadura';
    if (pc.includes('TORNEIRA') || pc.includes('PURIFICADOR')) return 'torneira';
    return null;
  }
  if (pc.includes('FECHADURA') || lin.includes('FECHADURA')) return 'fechadura';
  if (pc.includes('TORNEIRA') || lin === 'TORNEIRA' || (core === 'BANHEIRO' && pc.includes('PURIFICADOR'))) return 'torneira';
  if (core === 'ESQUADRIAS' && pc.includes('FECHADURA')) return 'fechadura';
  return null;
}

function inferTorneiraH2(produto) {
  const h2 = cellStr(produto.campo_hierarquico_2);
  if (h2) return h2;

  const blob = norm([produto.campo_hierarquico_1, produto.nome].join(' '));
  if (blob.includes('AQUILA')) return 'Lavatório';
  if (blob.includes('PURIFICADOR') || blob.includes('BEBEDOURO') || blob.includes('FILTRO')) return 'Bebedouro / Filtro';
  if (blob.includes('COZINHA') || blob.includes(' PIA ') || blob.startsWith('PIA ')) return 'Cozinha';
  if (blob.includes('LAVANDERIA') || blob.includes(' MAQ ')) return 'Tanque / Lavanderia';
  if (blob.includes('TANQUE') || blob.includes('JARDIM')) return 'Tanque / Jardim';
  if (blob.includes('COZ')) return 'Cozinha';
  return 'Lavatório';
}

function inferTorneiraProdutoCompra(produto) {
  const h1 = norm(produto.campo_hierarquico_1);
  if (h1 === 'PURIFICADOR' || h1.startsWith('PURIFICADOR')) return 'TORNEIRA PURIFICADOR';
  const blob = norm([produto.campo_hierarquico_1, produto.nome].join(' '));
  if (blob.includes('PURIFICADOR')) return 'TORNEIRA PURIFICADOR';
  if (blob.includes('MONOCOMANDO')) return 'TORNEIRA MONOCOMANDO';
  return 'TORNEIRA';
}

function coreRowFromProduto(produto) {
  const codigo = cellStr(produto.codigo_interno).toUpperCase();
  const nome = cellStr(produto.nome);
  const h1 = cellStr(produto.campo_hierarquico_1);
  const h2 = cellStr(produto.campo_hierarquico_2);
  const h3 = cellStr(produto.campo_hierarquico_3);
  const h4 = cellStr(produto.campo_hierarquico_4);

  if (isFechaduraH1(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'ESQUADRIAS',
      linha: 'ESQUADRIAS E FERRAGENS',
      produto_compra: 'FECHADURA',
      eixo_a: h2 || 'STAM',
      eixo_b: h3 || h4 || '',
      novo_sku: nome,
      sku_atual: nome,
    };
  }

  if (isTorneiraH1(h1) || norm(produto.nome).includes('TORNEIRA')) {
    return {
      codigo_interno: codigo,
      etapa: '5 — Áreas molhadas',
      core: 'BANHEIRO',
      linha: 'TORNEIRA',
      produto_compra: inferTorneiraProdutoCompra(produto),
      eixo_a: inferTorneiraH2(produto),
      eixo_b: h3 || h4 || '',
      novo_sku: nome,
      sku_atual: nome,
    };
  }

  return null;
}

function markEspaco(row) {
  const pc = cellStr(row.produto_compra);
  const legadoPc = pc.startsWith('LEGADO — ') ? pc : `LEGADO — ${pc}`;
  return {
    ...row,
    etapa: ESPACO.etapa,
    core: ESPACO.core,
    linha: ESPACO.linha,
    produto_compra: legadoPc,
  };
}

function rowValues(row) {
  return HEADERS.map((key) => row[key] ?? '');
}

async function loadCoreRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) throw new Error('Aba Catálogo não encontrada');

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    rows.push({
      codigo_interno: cellStr(row.getCell(1).value).toUpperCase(),
      etapa: cellStr(row.getCell(2).value),
      core: cellStr(row.getCell(3).value),
      linha: cellStr(row.getCell(4).value),
      produto_compra: cellStr(row.getCell(5).value),
      eixo_a: cellStr(row.getCell(6).value),
      eixo_b: cellStr(row.getCell(7).value),
      novo_sku: cellStr(row.getCell(8).value),
      sku_atual: cellStr(row.getCell(9).value),
    });
  });
  return { wb, ws, rows };
}

async function fetchSupabaseAcab() {
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from('produto')
    .select(
      'codigo_interno,nome,ativo,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_3,campo_hierarquico_4,campo_hierarquico_5,imagem_url',
    )
    .eq('ativo', true)
    .or(
      'campo_hierarquico_1.eq.TORNEIRA,campo_hierarquico_1.eq.FECHADURA,campo_hierarquico_1.eq.PURIFICADOR,nome.ilike.%TORNEIRA%,campo_hierarquico_1.ilike.TORNEIRA%,campo_hierarquico_1.ilike.PURIFICADOR%,campo_hierarquico_1.ilike.FECHADURA%',
    );

  if (error) throw error;

  return (data || []).filter((p) => {
    const h1 = cellStr(p.campo_hierarquico_1);
    const nome = cellStr(p.nome);
    return isTorneiraH1(h1) || isFechaduraH1(h1) || norm(nome).includes('TORNEIRA');
  });
}

function writeRowToSheet(ws, rowNumber, row) {
  const values = rowValues(row);
  values.forEach((val, idx) => {
    ws.getRow(rowNumber).getCell(idx + 1).value = val;
  });
}

async function main() {
  if (!fs.existsSync(CORE_PATH)) throw new Error(`Core em falta: ${CORE_PATH}`);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY em falta');
  }

  const supabaseRows = await fetchSupabaseAcab();
  const activeMap = new Map();
  for (const p of supabaseRows) {
    const mapped = coreRowFromProduto(p);
    if (!mapped) continue;
    activeMap.set(mapped.codigo_interno, mapped);
  }

  const { wb, ws, rows: coreRows } = await loadCoreRows();
  const byCodigo = new Map(coreRows.map((r) => [r.codigo_interno, r]));

  let updated = 0;
  let added = 0;
  let espaco = 0;

  for (const [codigo, mapped] of activeMap) {
    if (byCodigo.has(codigo)) {
      byCodigo.set(codigo, mapped);
      updated += 1;
    } else {
      byCodigo.set(codigo, mapped);
      added += 1;
    }
  }

  for (const [codigo, row] of byCodigo) {
    const tipo = isAcabRow(row);
    if (!tipo) continue;
    if (activeMap.has(codigo)) continue;
    if (row.core === ESPACO.core) {
      if (!cellStr(row.produto_compra).startsWith('LEGADO — ')) {
        byCodigo.set(codigo, markEspaco(row));
        espaco += 1;
      }
      continue;
    }
    byCodigo.set(codigo, markEspaco(row));
    espaco += 1;
  }

  const finalRows = coreRows.map((row) => byCodigo.get(row.codigo_interno) || row);
  for (const mapped of activeMap.values()) {
    if (!coreRows.some((r) => r.codigo_interno === mapped.codigo_interno)) {
      finalRows.push(mapped);
    }
  }

  const torneirasActivas = [...activeMap.values()].filter((r) => r.linha === 'TORNEIRA').length;
  const fechadurasActivas = [...activeMap.values()].filter((r) => r.produto_compra === 'FECHADURA').length;
  const comImagem = supabaseRows.filter((p) => p.imagem_url).length;

  console.log('═══════════════════════════════════════════════════');
  console.log('  Sync core — torneiras + fechaduras (Supabase → Excel)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Supabase activos:     ${supabaseRows.length} (${comImagem} com imagem)`);
  console.log(`  Torneiras/purif.:   ${torneirasActivas}`);
  console.log(`  Fechaduras:         ${fechadurasActivas}`);
  console.log(`Core actualizado:     ${updated}`);
  console.log(`Core novos:           ${added}`);
  console.log(`Core → espaço:        ${espaco}`);
  console.log(`Total linhas core:    ${finalRows.length}`);
  console.log('');

  if (dryRun) {
    console.log('[dry-run] Sem gravar ficheiro.');
    return;
  }

  finalRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    if (rowNum > ws.rowCount) {
      ws.addRow(rowValues(row));
    } else {
      writeRowToSheet(ws, rowNum, row);
    }
  });
  await wb.xlsx.writeFile(CORE_PATH);

  try {
    fs.copyFileSync(CORE_PATH, '/opt/cursor/artifacts/P38-sku-hierarquia-core.xlsx');
  } catch {
    /* ok outside cloud agent */
  }

  console.log(`Gravado: ${CORE_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
