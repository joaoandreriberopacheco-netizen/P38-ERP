#!/usr/bin/env node
/**
 * Aplica migrações pendentes em supabase/migrations/NNN_*.sql.
 * Mantém histórico em public._p38_schema_migrations (só aplica ficheiros novos).
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npm run db:apply-migrations
 *   DATABASE_URL="..." npm run db:apply-migrations -- --dry-run
 *
 * URI: Supabase Dashboard → Project Settings → Database → Connection string (pooler :6543 ou direct :5432).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { loadDotEnvFiles } from './base44-env.mjs';
import { buildSupabasePgClientConfig } from './supabase-env.mjs';

loadDotEnvFiles();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');

const TRACKING_TABLE = '_p38_schema_migrations';

export function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Pasta não encontrada: ${migrationsDir}`);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && /^\d{3}_/.test(f))
    .sort();
}

async function ensureTrackingTable(client) {
  await client.query(`
    create table if not exists public.${TRACKING_TABLE} (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getAppliedSet(client) {
  const { rows } = await client.query(
    `select filename from public.${TRACKING_TABLE} order by filename`
  );
  return new Set(rows.map((r) => r.filename));
}

/**
 * @param {{ databaseUrl: string, dryRun?: boolean, client?: pg.Client }} opts
 */
export async function applySupabaseMigrations({ databaseUrl, dryRun = false, client: externalClient }) {
  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL é obrigatório.');
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    throw new Error(`Nenhum ficheiro NNN_*.sql em ${migrationsDir}`);
  }

  const ownClient = externalClient
    ? null
    : new pg.Client(buildSupabasePgClientConfig(databaseUrl));

  const client = externalClient || ownClient;
  let connectedHere = false;

  try {
    if (!externalClient) {
      await client.connect();
      connectedHere = true;
    }

    await ensureTrackingTable(client);
    const applied = await getAppliedSet(client);
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      return { applied: [], skipped: files, pending: [] };
    }

    console.log(
      `[db:apply-migrations] ${pending.length} pendente(s), ${applied.size} já aplicada(s).`
    );

    const appliedNow = [];
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      process.stdout.write(`  → ${file} … `);
      if (dryRun) {
        console.log('dry-run (ignorado)');
        appliedNow.push(file);
        continue;
      }
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
          `insert into public.${TRACKING_TABLE} (filename) values ($1) on conflict do nothing`,
          [file]
        );
        await client.query('commit');
        console.log('ok');
        appliedNow.push(file);
      } catch (err) {
        await client.query('rollback').catch(() => {});
        console.log('FALHOU');
        err.filename = file;
        throw err;
      }
    }

    return { applied: appliedNow, skipped: files.filter((f) => applied.has(f)), pending };
  } finally {
    if (connectedHere) {
      await client.end().catch(() => {});
    }
  }
}

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error(
      '[db:apply-migrations] Defina DATABASE_URL (Supabase → Database → Connection string).\n' +
        '  Ex.: DATABASE_URL="postgresql://postgres.[ref]:[senha]@...pooler.supabase.com:6543/postgres"'
    );
    process.exit(1);
  }

  try {
    const result = await applySupabaseMigrations({ databaseUrl, dryRun });
    if (dryRun) {
      console.log('[db:apply-migrations] Dry-run — pendentes:', result.applied.join(', ') || '(nenhum)');
    } else {
      console.log('[db:apply-migrations] Concluído.', result.applied.length, 'aplicada(s).');
    }
  } catch (err) {
    console.error('[db:apply-migrations]', err.filename ? `${err.filename}: ` : '', err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
