/**
 * Ligação Postgres em CI (GitHub Actions) — runners sem rota IPv6 até Supabase direct (db.*).
 * O host direct só tem AAAA; o pooler Supavisor (.pooler.supabase.com) tem IPv4.
 */
import dns from 'node:dns/promises';
import pg from 'pg';
import pgConnectionString from 'pg-connection-string';
import { parseProjectRefFromDatabaseUrl } from '../p38-secrets.mjs';

function isSupabaseUrl(databaseUrl) {
  return String(databaseUrl).includes('supabase');
}

function isDirectSupabaseDbHost(host) {
  return /^db\.[a-z0-9]+\.supabase\.co$/i.test(host || '');
}

function rewriteDirectUrlToPooler(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim().replace(/^['"]|['"]$/g, '');
  const url = new URL(trimmed.replace(/^postgresql:/, 'postgres:'));
  const m = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!m) return trimmed;

  const ref = m[1];
  const poolerHost =
    process.env.SUPABASE_POOLER_HOST?.trim() ||
    `aws-0-${process.env.SUPABASE_POOLER_REGION?.trim() || 'us-east-1'}.pooler.supabase.com`;

  url.hostname = poolerHost;
  url.port = '6543';
  if (!url.username.includes('.')) {
    url.username = `postgres.${ref}`;
  }

  return url.toString().replace(/^postgres:/, 'postgresql:');
}

async function fetchPoolerUrlFromApi(databaseUrl, accessToken, projectRef) {
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/database/pooler`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const configs = await res.json();
    const tx = configs.find(
      (c) => c.pool_mode === 'transaction' && c.database_type === 'PRIMARY'
    );
    if (!tx?.db_host) return null;

    const original = new URL(String(databaseUrl).trim().replace(/^postgresql:/, 'postgres:'));
    original.hostname = tx.db_host;
    original.port = String(tx.db_port || 6543);
    if (!original.username.includes('.')) {
      original.username = `postgres.${projectRef}`;
    }
    return original.toString().replace(/^postgres:/, 'postgresql:');
  } catch {
    return null;
  }
}

async function resolveSupabaseDatabaseUrl(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim();
  const parsed = pgConnectionString.parse(trimmed);
  if (!isDirectSupabaseDbHost(parsed.host)) return trimmed;

  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_TOKEN;
  const ref = parseProjectRefFromDatabaseUrl(trimmed);
  const fromApi = token && ref ? await fetchPoolerUrlFromApi(trimmed, token, ref) : null;
  const resolved = fromApi || rewriteDirectUrlToPooler(trimmed);

  if (resolved !== trimmed) {
    console.warn(
      '[pg-connect] DATABASE_URL direct db.* (IPv6) → pooler Supavisor (IPv4) para ligação Postgres'
    );
  }
  return resolved;
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
  const trimmed = await resolveSupabaseDatabaseUrl(databaseUrl);
  const client = new pg.Client(basePgOptions(trimmed));
  try {
    await client.connect();
    return client;
  } catch (err) {
    const msg = err?.message || '';
    if (!isSupabaseUrl(trimmed) || !/ENETUNREACH|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(msg)) {
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
