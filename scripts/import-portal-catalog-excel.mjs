#!/usr/bin/env node
/**
 * Importa cerâmica piloto do Excel para public.portal_catalog.
 *
 *   npm run portal:catalog:import              # dry-run
 *   npm run portal:catalog:import -- --apply   # grava no Supabase
 *
 * Requer DATABASE_URL (e migração 067 aplicada).
 */
import pg from 'pg';
import { parsePortalCatalogFromExcel, deriveLinhasFromRows, resolveExcelPath } from './portal-catalog-excel-parse.mjs';
import { linkPortalCatalogProdutoIds, upsertPortalCatalogRows } from './portal-catalog-upsert.mjs';

const apply = process.argv.includes('--apply');

async function main() {
  const excelPath = resolveExcelPath();
  const rows = await parsePortalCatalogFromExcel(excelPath);
  const linhas = deriveLinhasFromRows(rows);

  console.log(`[portal:catalog:import] Excel: ${excelPath}`);
  console.log(`[portal:catalog:import] ${rows.length} SKU(s) · ${linhas.length} LINHA(s)`);
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));

  if (!apply) {
    console.log('\nDry-run. Para gravar: npm run portal:catalog:import -- --apply');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const n = await upsertPortalCatalogRows(rows, { client });
    await linkPortalCatalogProdutoIds(client);
    console.log(`[portal:catalog:import] ${n} linha(s) upsert em portal_catalog.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
