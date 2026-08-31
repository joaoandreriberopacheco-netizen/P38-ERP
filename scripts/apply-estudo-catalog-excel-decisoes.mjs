#!/usr/bin/env node
/**
 * Aplica decisões de negócio directamente no Excel de estudo (fonte canónica).
 * Não usar overrides JSON — actualizar o Excel e regenerar o manifest.
 *
 *   npm run estudo:catalog-excel-apply
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { applySprayLinhaRules } from '../src/lib/estudoCatalog/applySprayLinhaRules.js';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const LINHAS_JSON = path.join(process.cwd(), 'src', 'data', 'hierarquiaPortalLinhas.json');
const SHEET_A = 'A — Edificações';
const SHEET_C = 'C — Acabamentos (prévia)';

const C_BLOCO = 'C — Acabamentos (prévia)';
const C1 = {
  sub_bloco: 'C1 Revestimentos',
  etapa: '4 — Revestimentos',
  core: 'ASSENTAMENTO_CERAMICA',
};
const C2 = {
  sub_bloco: 'C2 Pintura',
  etapa: '6 — Acabamento seco',
  core: 'PINTURA_OBRA',
};

const C1_LINHAS = new Set([
  'ARGAMASSA',
  'REJUNTE',
  'CERAMICA_BOLD',
  'CERAMICA_RETIF',
  'PISOS_E_REVESTIMENTOS',
]);

const C2_LINHAS = new Set([
  'TINTA',
  'TINTA_SPRAY',
  'TINTA_SPRAY_METALICO',
  'VERNIZ',
  'THINNER',
  'MASSA_CORRIDA',
  'MASSA_ACRILICA',
  'LIXA',
  'FERRAMENTAS',
]);

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function normLinha(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/·[NRC]$/i, '')
    .trim()
    .toUpperCase();
}

function loadLinhasMestre() {
  const raw = JSON.parse(fs.readFileSync(LINHAS_JSON, 'utf8'));
  const byNome = new Map();
  for (const l of raw.linhas || []) {
    byNome.set(normLinha(l.nome), l);
    byNome.set(normLinha(l.codigo), l);
  }
  const metaByCodigo = new Map((raw.linhas || []).map((l) => [l.codigo, l]));
  return { byNome, metaByCodigo, version: raw.version };
}

function resolveLinhaCodigo(linhaCell, { byNome }) {
  const base = normLinha(linhaCell);
  const meta = byNome.get(base);
  if (meta) return meta.codigo;
  return base.replace(/[^A-Z0-9]+/g, '_').slice(0, 48) || 'OUTROS';
}

function readRowObj(row, idx) {
  const get = (k) => cellStr(row.getCell(idx[k]));
  return {
    bloco: get('bloco'),
    sub_bloco: get('sub_bloco'),
    etapa: get('etapa'),
    core: get('core'),
    linha: get('linha'),
    produto_compra: get('produto_compra'),
    produto_compra_nome: get('produto_compra'),
    eixo_a: get('eixo_a'),
    eixo_b: get('eixo_b'),
    codigo_interno: get('codigo_interno'),
    novo_sku: get('novo_sku'),
    sku_atual: get('sku_atual'),
    status_mix: get('status_mix'),
  };
}

function writeRowObj(row, idx, data) {
  for (const [k, v] of Object.entries(data)) {
    if (idx[k] != null) row.getCell(idx[k]).value = v ?? '';
  }
}

function classifyDestino(rowObj, linhaCodigo) {
  if (linhaCodigo === 'PINTURA_QUIMICOS') {
    const pc = `${rowObj.produto_compra || ''}`;
    if (rowObj.core === 'ALVENARIA' || /ADITIVO/i.test(pc)) return null;
    return C2;
  }
  if (C1_LINHAS.has(linhaCodigo) || linhaCodigo.includes('PISOS')) return C1;
  if (C2_LINHAS.has(linhaCodigo)) return C2;
  return null;
}

function ensureSheet(wb, name, headerRow) {
  let ws = wb.getWorksheet(name);
  if (!ws) {
    ws = wb.addWorksheet(name);
    ws.addRow(headerRow);
  }
  return ws;
}

async function main() {
  const { byNome, metaByCodigo } = loadLinhasMestre();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const wsA = wb.getWorksheet(SHEET_A);
  if (!wsA) throw new Error(`Folha não encontrada: ${SHEET_A}`);

  const headers = wsA.getRow(1).values.slice(1).map((h) => String(h ?? '').trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const wsC = ensureSheet(wb, SHEET_C, headers);

  const toMove = [];
  let sprayUpdates = 0;

  for (let r = 2; r <= wsA.rowCount; r += 1) {
    const row = wsA.getRow(r);
    const raw = readRowObj(row, idx);
    if (!raw.codigo_interno) continue;

    let linhaCodigo = resolveLinhaCodigo(raw.linha, { byNome });
    let working = {
      ...raw,
      linha_codigo: linhaCodigo,
      linha_nome: byNome.get(normLinha(raw.linha))?.nome || raw.linha,
      linha_pathway_key: linhaCodigo,
    };

    const sprayed = applySprayLinhaRules(working, metaByCodigo);
    if (sprayed.linha_codigo !== linhaCodigo || sprayed.linha !== raw.linha) {
      sprayUpdates += 1;
      linhaCodigo = sprayed.linha_codigo;
      working = sprayed;
    }

    const dest = classifyDestino(raw, linhaCodigo);
    if (!dest) continue;

    toMove.push({
      fromRow: r,
      data: {
        bloco: C_BLOCO,
        sub_bloco: dest.sub_bloco,
        etapa: dest.etapa,
        core: dest.core,
        linha: sprayed.linha || raw.linha,
        produto_compra: sprayed.produto_compra_nome || sprayed.produto_compra || raw.produto_compra,
        eixo_a: sprayed.eixo_a ?? raw.eixo_a,
        eixo_b: sprayed.eixo_b ?? raw.eixo_b,
        codigo_interno: raw.codigo_interno,
        novo_sku: sprayed.novo_sku || raw.novo_sku,
        sku_atual: raw.sku_atual,
        status_mix: raw.status_mix,
      },
    });
  }

  for (const { fromRow, data } of [...toMove].sort((a, b) => b.fromRow - a.fromRow)) {
    wsA.spliceRows(fromRow, 1);
  }

  for (const { data } of toMove) {
    const newRow = wsC.addRow([]);
    writeRowObj(newRow, idx, data);
  }

  await wb.xlsx.writeFile(EXCEL_PATH);

  console.log(`[estudo-excel] ${EXCEL_PATH}`);
  console.log(`  · ${toMove.length} SKU(s) A → ${SHEET_C}`);
  console.log(`  · ${sprayUpdates} linha(s) spray normalizadas`);
  console.log(`  · ${wsA.rowCount - 1} SKU(s) restantes em ${SHEET_A}`);
  console.log(`  · ${wsC.rowCount - 1} SKU(s) em ${SHEET_C}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
