#!/usr/bin/env node
/**
 * P38 · TurboCharger v2 — duas abas:
 *   Caminho_4  → cód. interno + classificação 4×
 *   Catalogo_atual → comp1–3 + Camp hier 1–5
 *
 *   npm run turbocharger:generate:v2
 *   npm run turbocharger:generate:v2 -- --with-supabase
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadFactRowsFrom4x3, SRC_4X3 } from './lib/turboChargerLoad4x3.mjs';
import { normalizeFactRowTaxonomy } from './lib/turboChargerCategorias.mjs';
import {
  buildTurboChargerV2Workbook,
  loadCampHierByCodigo,
} from './lib/turboChargerV2Workbook.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'exports', 'P38-TurboCharger-v2.xlsx');
const WITH_SB = process.argv.includes('--with-supabase');

async function main() {
  let factRows = await loadFactRowsFrom4x3();
  factRows = factRows.map((row) => normalizeFactRowTaxonomy({ ...row }));

  const campHierByCod = await loadCampHierByCodigo({ withSupabase: WITH_SB });
  const wb = buildTurboChargerV2Workbook(factRows, campHierByCod);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  const filledHier = factRows.filter((r) => campHierByCod.has(r.codigo_interno)).length;
  console.log(
    `[turbocharger:v2] ${OUT}\n  SKUs: ${factRows.length} · Camp hier: ${filledHier}/${factRows.length} · fonte 4×3: ${fs.existsSync(SRC_4X3) ? 'ok' : 'em falta'}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
