/**
 * Ligação Postgres em CI (GitHub Actions) — runners sem rota IPv6 até Supabase direct.
 * Host db.{ref}.supabase.co só tem AAAA; pooler Supavisor (.pooler.supabase.com) tem IPv4.
 */
import dns from 'node:dns/promises';
import pg from 'pg';
import pgConnectionString from 'pg-connection-string';
import { parseProjectRefFromDatabaseUrl } from '../p38-secrets.mjs';

const POOLER_HOST_FALLBACKS = [
  'aws-0-sa-east-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
];

function isSupabaseUrl(databaseUrl) {
  return String(databaseUrl).includes('supabase');
}

function poolerClientConfig(parsed, projectRef, poolerHost, port = 6543) {
  const user =
    parsed.user && parsed.user !== 'postgres' && parsed.user.includes('.')
      ? parsed.user
      : `postgres.${projectRef}`;
  return {
    host: poolerHost,
    port,
    user,
    password: parsed.password,
    database: parsed.database || 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  };
}

async function fetchPoolerFromApi(accessToken, projectRef) {
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
    return { host: tx.db_host, port: Number(tx.db_port) || 6543 };
  } catch {
    return null;
  }
}

export function basePgOptions(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim();
  if (!trimmed) throw new Error('DATABASE_URL vazio');
  return {
    connectionString: trimmed,
    ssl: isSupabaseUrl(trimmed) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 20000,
    family: 4,
  };
}

async function tryConnectClient(config) {
  const client = new pg.Client(config);
  await client.connect();
  return client;
}

/** @returns {Promise<pg.Client>} */
export async function connectPg(databaseUrl) {
  const trimmed = String(databaseUrl || '').trim();
  const parsed = pgConnectionString.parse(trimmed);
  const host = parsed.host || '';
  const directRef = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];

  try {
    return await tryConnectClient(basePgOptions(trimmed));
  } catch (firstErr) {
    if (!isSupabaseUrl(trimmed)) throw firstErr;

    if (directRef) {
      const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_TOKEN;
      const apiPooler = token ? await fetchPoolerFromApi(token, directRef) : null;
      if (apiPooler) {
        console.warn(
          `[pg-connect] ${host} só IPv6 — pooler API ${apiPooler.host}:${apiPooler.port}…`,
        );
        try {
          return await tryConnectClient(
            poolerClientConfig(parsed, directRef, apiPooler.host, apiPooler.port)
          );
        } catch (apiErr) {
          console.warn(`[pg-connect] pooler API falhou: ${apiErr?.message || apiErr}`);
        }
      }

      for (const poolerHost of POOLER_HOST_FALLBACKS) {
        try {
          console.warn(
            `[pg-connect] ${host} só IPv6 no runner — tentando pooler ${poolerHost}:6543…`,
          );
          return await tryConnectClient(poolerClientConfig(parsed, directRef, poolerHost));
        } catch (poolerErr) {
          if (poolerHost === POOLER_HOST_FALLBACKS[POOLER_HOST_FALLBACKS.length - 1]) {
            throw poolerErr;
          }
        }
      }
    }

    const msg = firstErr?.message || '';
    if (host && /ENETUNREACH|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(msg)) {
      const { address } = await dns.lookup(host, { family: 4 });
      return await tryConnectClient({
        host: address,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: parsed.user,
        password: parsed.password,
        database: parsed.database,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
      });
    }

    throw firstErr;
  }
}
