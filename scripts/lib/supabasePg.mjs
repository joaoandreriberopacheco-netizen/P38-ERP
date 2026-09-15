/**
 * Ligação Postgres ao Supabase P38 — scripts de auditoria (sem Base44).
 */
import pg from 'pg';
import { loadDotEnvFiles } from '../base44-env.mjs';

loadDotEnvFiles();

export function getDatabaseUrl() {
  return String(process.env.DATABASE_URL || '').trim();
}

export function requireDatabaseUrl() {
  const url = getDatabaseUrl();
  if (!url) {
    console.error(
      '[supabase] DATABASE_URL em falta.\n' +
        '  Gravar no Cursor Cloud Secrets ou em secrets/p38-chaves.txt\n' +
        '  Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md',
    );
    process.exit(1);
  }
  return url;
}

/** @param {(client: import('pg').Client) => Promise<T>} fn */
export async function withSupabasePg(fn) {
  const client = new pg.Client({ connectionString: requireDatabaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
