#!/usr/bin/env node
/**
 * Seed public.portal_catalog a partir do manifest JSON (174 SKUs piloto).
 *
 *   npm run portal:catalog:seed              # dry-run
 *   npm run portal:catalog:seed -- --apply   # grava no Supabase
 */
import pg from 'pg';
import { parsePortalCatalogFromManifest, deriveLinhasFromRows } from './portal-catalog-excel-parse.mjs';
import { linkPortalCatalogProdutoIds, upsertPortalCatalogRows } from './portal-catalog-upsert.mjs';

const apply = process.argv.includes('--apply');

async function main() {
  const rows = parsePortalCatalogFromManifest();
  const linhas = deriveLinhasFromRows(rows);

  console.log(`[portal:catalog:seed] ${rows.length} SKU(s) · ${linhas.length} LINHA(s) do manifest`);
  console.log(JSON.stringify(rows.slice(0, 3), null, 2));

  if (!apply) {
    console.log('\nDry-run. Para gravar: npm run portal:catalog:seed -- --apply');
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
    console.log(`[portal:catalog:seed] ${n} linha(s) upsert em portal_catalog.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
