#!/usr/bin/env node
/**
 * Diagnóstico rápido antes de `npm run supabase:deploy`.
 * Não imprime valores de secrets — só presença e testes de ligação.
 */
import pg from 'pg';
import { listMigrationFiles } from './apply-supabase-migrations.mjs';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

function mask(name, value) {
  return value ? `${name}=ok` : `${name}=EM FALTA`;
}

async function testDatabase(url) {
  const client = new pg.Client({
    connectionString: url.trim(),
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = '_p38_schema_migrations'`
    );
    const hasTracking = rows[0]?.n > 0;
    let applied = 0;
    if (hasTracking) {
      const r = await client.query('select count(*)::int as n from public._p38_schema_migrations');
      applied = r.rows[0]?.n ?? 0;
    }
    return { ok: true, hasTracking, applied };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const { databaseUrl, accessToken, projectRef } = resolveSupabaseDeployEnv();
  const secretNames = process.env.CLOUD_AGENT_ALL_SECRET_NAMES || '(n/d)';

  console.log('[supabase:deploy:check] Secrets carregados:', secretNames);
  console.log(' ', mask('DATABASE_URL', databaseUrl));
  console.log(' ', mask('SUPABASE_ACCESS_TOKEN', accessToken));
  console.log(' ', mask('PROJECT_REF', projectRef));

  const migrations = listMigrationFiles();
  console.log(`\n[supabase:deploy:check] Migrações no repo: ${migrations.length}`);
  console.log('  última:', migrations.at(-1));

  if (databaseUrl) {
    process.stdout.write('\n[supabase:deploy:check] Teste DATABASE_URL … ');
    const db = await testDatabase(databaseUrl);
    if (db.ok) {
      console.log('ligação OK');
      console.log(`  tracking _p38_schema_migrations: ${db.hasTracking ? 'sim' : 'não (será criado)'}`);
      if (db.hasTracking) console.log(`  migrações já aplicadas: ${db.applied}`);
    } else {
      console.log('FALHOU');
      console.log(`  erro: ${db.error}`);
      console.log('  → Supabase Dashboard → Project Settings → Database → copiar connection string nova.');
    }
  }

  const readyMigrations = Boolean(databaseUrl);
  const readyFunctions = Boolean(accessToken && projectRef);

  console.log('\n[supabase:deploy:check] Pronto para deploy?');
  console.log('  migrações:', readyMigrations ? 'sim (se ligação OK)' : 'não');
  console.log('  functions:', readyFunctions ? 'sim' : 'não');

  if (!readyFunctions) {
    console.log('\nPara Edge Functions (nome exacto do secret):');
    console.log('  SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens');
    if (!projectRef) {
      console.log('  VITE_SUPABASE_URL ou DATABASE_URL com host Supabase');
    }
  }

  if (!readyMigrations || !readyFunctions) {
    console.log('\nMapa canónico: docs/migration/P38_SECRETS_CANONICOS.md');
    console.log('Checklist completo: npm run secrets:check');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[supabase:deploy:check]', err.message);
  process.exit(1);
});
