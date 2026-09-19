#!/usr/bin/env node
/**
 * Gera PDF dossiê CCG (Iquine, Hidracor, Hipercor) — estilo Relatório Resumo Global (jsPDF + Barlow).
 *
 * Uso: npm run dossie:tintas-ccg
 * Saída: docs/exports/ccg-dossie-tintas-iquine-hidracor-hipercor.pdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'docs/exports/ccg-tintas-dossie-data.json');
const OUT_PDF = path.join(ROOT, 'docs/exports/ccg-dossie-tintas-iquine-hidracor-hipercor.pdf');

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('Dados não encontrados:', DATA_PATH);
    console.error('Corra primeiro a extração do PDF CCG.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  const vite = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const mod = await vite.ssrLoadModule('/src/lib/dossieTintasCcgPdf/generateDossieTintasCcgPdf.js');
    const { generateDossieTintasCcgPdf } = mod;

    const result = await generateDossieTintasCcgPdf(data);
    const pdfBytes = result?.data ?? result;
    fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
    fs.writeFileSync(OUT_PDF, Buffer.from(pdfBytes));

    const kb = (pdfBytes.byteLength / 1024).toFixed(1);
    const brandNames = Object.keys(data.brands || {});
    console.log('PDF gerado:', OUT_PDF);
    console.log(`Tamanho: ${kb} KB | Páginas: ${result?.pages ?? '?'} | Marcas: ${brandNames.join(', ')}`);
    if (result?.build) console.log(`Build: ${result.build}`);
  } finally {
    await vite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
