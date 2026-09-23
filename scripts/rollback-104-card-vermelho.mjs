#!/usr/bin/env node
/**
 * Rollback views 104/105 → restaura estado da migration 103 (sem gate desmembramento).
 * Ver docs/compras-rollback-104-card-vermelho.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectPg } from './lib/pg-connect-ipv4.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migration103 = path.join(__dirname, '../supabase/migrations/103_saldo_embarcar_base_units_fix.sql');

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[rollback-104] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = await connectPg(process.env.DATABASE_URL);
  try {
    console.log('[rollback-104] A remover p38_pedido_desmembramento_iniciado…');
    await client.query('drop function if exists public.p38_pedido_desmembramento_iniciado(text);');

    console.log('[rollback-104] A reaplicar views da migration 103…');
    const sql = fs.readFileSync(migration103, 'utf8');
    await client.query(sql);

    console.log('[rollback-104] OK. Opcional: apagar 104/105 de supabase_migrations.schema_migrations');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[rollback-104]', err.message || err);
  process.exit(1);
});
