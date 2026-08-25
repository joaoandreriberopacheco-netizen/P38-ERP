/**
 * Resolve credenciais Supabase a partir de nomes canónicos (ver scripts/p38-secrets.mjs).
 */
import { resolveP38Secrets } from './p38-secrets.mjs';

export { parseProjectRefFromDatabaseUrl, parseProjectRefFromSupabaseUrl } from './p38-secrets.mjs';

/** @returns {{ databaseUrl?: string, accessToken?: string, projectRef?: string }} */
export function resolveSupabaseDeployEnv() {
  const s = resolveP38Secrets();
  return {
    databaseUrl: s.databaseUrl || undefined,
    accessToken: s.accessToken || undefined,
    projectRef: s.projectRef || undefined,
  };
}

/**
 * Opções pg.Client para Postgres Supabase em runners sem rota IPv6 (ex.: GitHub Actions).
 * @param {string} connectionString
 * @param {Record<string, unknown>} [extra]
 */
export function buildSupabasePgClientConfig(connectionString, extra = {}) {
  const trimmed = String(connectionString || '').trim();
  return {
    connectionString: trimmed,
    ssl: trimmed.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
    family: 4,
    ...extra,
  };
}
