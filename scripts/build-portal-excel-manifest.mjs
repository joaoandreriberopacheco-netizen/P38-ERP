#!/usr/bin/env node
/**
 * Gera manifest JSON do Excel mestre (docs/P38-catalogo-skus-completo.xlsx)
 * para o Portal Hierarquia mostrar só SKUs/LINHAS do ficheiro.
 *
 * npm run portal:excel-manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXCEL_CANDIDATES = [
  path.join(process.cwd(), 'docs', 'P38-catalogo-skus-completo.xlsx'),
  path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx'),
];

const OUT = path.join(process.cwd(), 'src', 'data', 'portalExcelManifest.generated.json');

/** Alinha nomes/códigos ao piloto Modelo (CERÂMICA BOLD · CERÂMICA RETIF). */
const LINHA_CANON = {
  CERAMICA_BOLD: { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD', tipo: 'portfolio', ordem: 10 },
  CERAMICA_RETIF: { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF', tipo: 'portfolio', ordem: 20 },
};

function resolveExcel() {
  for (const p of EXCEL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Excel não encontrado: ${EXCEL_CANDIDATES.join(', ')}`);
}

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function slugLinha(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'LINHA';
}

function slugPc(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'PC';
}

async function main() {
  const excelPath = resolveExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet('Catálogo SKUs');
  if (!ws) throw new Error('Aba "Catálogo SKUs" não encontrada');

  const skus = {};
  const linhasMap = new Map();

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const categoria = cellStr(row.getCell(1));
    const codigo = cellStr(row.getCell(2));
    const linhaNome = cellStr(row.getCell(3));
    const produtoCompra = cellStr(row.getCell(4));
    const exA = cellStr(row.getCell(5));
    const exB = cellStr(row.getCell(6));
    if (!codigo || !linhaNome) return;
    if (exB.toUpperCase() === 'ZUMBI') return;

    const linhaCodigo = slugLinha(linhaNome);
    const canon = LINHA_CANON[linhaCodigo];
    if (!canon) return;

    if (!linhasMap.has(linhaCodigo)) {
      linhasMap.set(linhaCodigo, { ...canon });
    }

    skus[codigo.toUpperCase()] = {
      codigo_interno: codigo,
      categoria: categoria || 'E - PISOS E REVESTIMENTOS',
      linha_codigo: canon.codigo,
      linha_nome: canon.nome,
      produto_compra: produtoCompra,
      produto_compra_codigo: slugPc(produtoCompra),
      ex_a: exA,
      ex_b: exB,
    };
  });

  const linhas = [...linhasMap.values()].sort((a, b) => a.ordem - b.ordem);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), excelPath),
    skuCount: Object.keys(skus).length,
    linhaCount: linhas.length,
    linhas,
    skus,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[portal:excel-manifest] ${payload.skuCount} SKUs · ${payload.linhaCount} LINHA(s) → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
