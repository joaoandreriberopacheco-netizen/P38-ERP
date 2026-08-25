/**
 * Ligação Postgres em CI (GitHub Actions) — runners sem rota IPv6 até Supabase.
 */
import dns from 'node:dns/promises';
import pg from 'pg';
import pgConnectionString from 'pg-connection-string';

function isSupabaseUrl(databaseUrl) {
  return String(databaseUrl).includes('supabase');
}

export function basePgOptions(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim();
  if (!trimmed) throw new Error('DATABASE_URL vazio');
  return {
    connectionString: trimmed,
    ssl: isSupabaseUrl(trimmed) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
    family: 4,
  };
}

/** @returns {Promise<pg.Client>} */
export async function connectPg(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim();
  const client = new pg.Client(basePgOptions(trimmed));
  try {
    await client.connect();
    return client;
  } catch (err) {
    const msg = err?.message || '';
    if (!isSupabaseUrl(trimmed) || !/ENETUNREACH|ECONNREFUSED|ETIMEDOUT/.test(msg)) {
      throw err;
    }
    const parsed = pgConnectionString.parse(trimmed);
    const host = parsed.host;
    if (!host) throw err;
    const { address } = await dns.lookup(host, { family: 4 });
    const fallback = new pg.Client({
      host: address,
      port: parsed.port ? Number(parsed.port) : 5432,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    await fallback.connect();
    return fallback;
  }
}
