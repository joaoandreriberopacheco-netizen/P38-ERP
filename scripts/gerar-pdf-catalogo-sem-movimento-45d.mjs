#!/usr/bin/env node
/**
 * PDFs — sem estoque · sem movimentação 45 dias (produto compra completo).
 * Gera: drill retrato · detalhe SKUs · unificado paisagem + nome Supabase
 *
 *   npm run export:pdf-catalogo-sem-movimento-45d
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildSemEstoqueSemMovimentoFilter,
  enrichFilterNomesSupabase,
} from './lib/catalogoEstoqueFilter.mjs';
import { exportCatalogoFiltradoXlsx } from './lib/catalogoFiltradoXlsx.mjs';

const ROOT = process.cwd();
const XLSX = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const FILTER = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-sem-movimento-45d-filter.json');
const OUT_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-sem-movimento-45d.pdf');
const OUT_4X = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-sem-movimento-45d.pdf');
const OUT_UNI = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-unificado-sem-movimento-45d-paisagem.pdf');
const XLS_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-sem-movimento-45d.xlsx');
const XLS_4X = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-sem-movimento-45d.xlsx');
const XLS_UNI = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-unificado-sem-movimento-45d.xlsx');

if (!fs.existsSync(XLSX)) {
  console.error(`Fonte em falta: ${XLSX}`);
  process.exit(1);
}

let filter = await buildSemEstoqueSemMovimentoFilter(XLSX, { dias: 45 });
filter = await enrichFilterNomesSupabase(filter);
fs.mkdirSync(path.dirname(FILTER), { recursive: true });
fs.writeFileSync(FILTER, JSON.stringify(filter, null, 2));

console.log(
  `[sem-mov-45d] ${filter.produtosCompraMatch}/${filter.produtosCompraTotal} produtos compra · ${filter.skusMatch} SKUs · desde ${filter.cutoff}`,
);

function runPy(script, out, extra = []) {
  const run = spawnSync(
    'python3',
    [path.join(ROOT, 'scripts', script), XLSX, out, FILTER, ...extra],
    { stdio: 'inherit' },
  );
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}

runPy('gerar-pdf-catalogo-4x3.py', OUT_4X3);
runPy('gerar-pdf-catalogo-4x-nivel.py', OUT_4X);
runPy('gerar-pdf-catalogo-unificado-paisagem.py', OUT_UNI);

const xls = await exportCatalogoFiltradoXlsx({
  catalogPath: XLSX,
  filterPath: FILTER,
  out4x3: XLS_4X3,
  outNivel: XLS_4X,
  outUnificado: XLS_UNI,
});
console.log(
  `[sem-mov-45d] Excel: ${xls.produtosCompra} produtos · ${xls.skus} SKUs → 3 ficheiros .xlsx`,
);
