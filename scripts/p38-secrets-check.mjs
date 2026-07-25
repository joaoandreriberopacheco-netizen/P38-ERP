#!/usr/bin/env node
/**
 * Checklist "avião comercial" — valida secrets antes de deploy.
 * Não imprime valores. Saída 0 = pronto; 1 = bloqueia deploy.
 *
 * Uso:
 *   npm run secrets:check
 *   npm run secrets:check -- --context=github
 *   npm run secrets:check -- --context=vercel
 *   npm run secrets:check -- --context=local
 */
import pg from 'pg';
import {
  checkProjectRefAlignment,
  maskPresence,
  resolveP38Secrets,
} from './p38-secrets.mjs';

const CONTEXTS = new Set(['all', 'github', 'vercel', 'local', 'cloud-agent']);

function parseContext() {
  for (const arg of process.argv.slice(2)) {
    if (arg === '--context' || arg.startsWith('--context=')) {
      const value = arg.includes('=') ? arg.split('=').slice(1).join('=') : process.argv[process.argv.indexOf(arg) + 1];
      if (!value || !CONTEXTS.has(value)) {
        console.error(`[secrets:check] Contexto inválido: ${value || '(vazio)'}. Use: ${[...CONTEXTS].join(', ')}`);
        process.exit(1);
      }
      return value;
    }
  }
  return 'all';
}

/**
 * @param {string} context
 * @param {ReturnType<typeof resolveP38Secrets>} secrets
 */
function requiredForContext(context, secrets) {
  /** @type {{ name: string, ok: boolean, hint?: string }[]} */
  const checks = [];

  const push = (name, ok, hint) => checks.push({ name, ok, hint });

  if (context === 'all' || context === 'local' || context === 'cloud-agent') {
    push('VITE_SUPABASE_URL', Boolean(secrets.viteSupabaseUrl), 'Supabase → Project Settings → API → Project URL');
    push(
      'VITE_SUPABASE_ANON_KEY',
      Boolean(secrets.viteSupabaseAnonKey),
      'Supabase → Project Settings → API → anon public'
    );
  }

  if (context === 'all' || context === 'github' || context === 'cloud-agent') {
    push('DATABASE_URL', Boolean(secrets.databaseUrl), 'Supabase → Database → Connection string (pooler)');
    push(
      'SUPABASE_ACCESS_TOKEN',
      Boolean(secrets.accessToken),
      'https://supabase.com/dashboard/account/tokens'
    );
    push('VITE_SUPABASE_URL', Boolean(secrets.viteSupabaseUrl));
    push('VITE_SUPABASE_ANON_KEY', Boolean(secrets.viteSupabaseAnonKey));
  }

  if (context === 'all' || context === 'github') {
    push('VERCEL_TOKEN', Boolean(secrets.vercelToken), 'https://vercel.com/account/tokens');
    push('VERCEL_ORG_ID', Boolean(secrets.vercelOrgId), 'Vercel → Settings → General');
    push('VERCEL_PROJECT_ID', Boolean(secrets.vercelProjectId), 'Project → Settings → General');
  }

  if (context === 'all' || context === 'vercel' || context === 'github') {
    push(
      'P38_AUTH_URL (derivável)',
      Boolean(secrets.p38AuthUrl),
      'Auto: VITE_SUPABASE_URL + /functions/v1/p38-auth — ou defina P38_AUTH_URL'
    );
  }

  const seen = new Set();
  return checks.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

async function testDatabase(url) {
  const client = new pg.Client({
    connectionString: url.trim(),
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const { rows } = await client.query('select 1 as ok');
    return { ok: rows[0]?.ok === 1 };
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
  const context = parseContext();
  const secrets = resolveP38Secrets();
  const alignment = checkProjectRefAlignment(secrets);
  const secretNames = process.env.CLOUD_AGENT_ALL_SECRET_NAMES || '(n/d)';

  console.log('[secrets:check] Checklist pré-decolagem P38');
  console.log(`  contexto: ${context}`);
  console.log(`  secrets carregados: ${secretNames}`);
  if (secrets.projectRef) console.log(`  project ref: ${secrets.projectRef}`);

  console.log('\n[secrets:check] Presença (sem valores):');
  console.log(' ', maskPresence('VITE_SUPABASE_URL', secrets.viteSupabaseUrl));
  console.log(' ', maskPresence('VITE_SUPABASE_ANON_KEY', secrets.viteSupabaseAnonKey));
  console.log(' ', maskPresence('DATABASE_URL', secrets.databaseUrl));
  console.log(' ', maskPresence('SUPABASE_ACCESS_TOKEN', secrets.accessToken));
  console.log(' ', maskPresence('SUPABASE_SERVICE_ROLE_KEY', secrets.serviceRoleKey));
  console.log(' ', maskPresence('P38_AUTH_URL', secrets.p38AuthUrl));
  console.log(' ', maskPresence('VERCEL_TOKEN', secrets.vercelToken));

  const checks = requiredForContext(context, secrets);
  const missing = checks.filter((c) => !c.ok);

  if (missing.length) {
    console.log('\n[secrets:check] EM FALTA para este contexto:');
    for (const m of missing) {
      console.log(`  ✗ ${m.name}`);
      if (m.hint) console.log(`    → ${m.hint}`);
    }
  } else {
    console.log('\n[secrets:check] Todos os obrigatórios presentes para', context);
  }

  if (alignment.issues.length) {
    console.log('\n[secrets:check] Alinhamento:');
    for (const issue of alignment.issues) {
      const prefix = issue.level === 'error' ? '✗' : '⚠';
      console.log(`  ${prefix} ${issue.message}`);
    }
  } else if (alignment.refFromVite) {
    console.log(`\n[secrets:check] Alinhamento OK (ref ${alignment.refFromVite}).`);
  }

  if (secrets.databaseUrl && (context === 'all' || context === 'github' || context === 'cloud-agent')) {
    process.stdout.write('\n[secrets:check] Teste DATABASE_URL … ');
    const db = await testDatabase(secrets.databaseUrl);
    if (db.ok) {
      console.log('ligação OK');
    } else {
      console.log('FALHOU');
      console.log(`  erro: ${db.error}`);
      console.log('  → Supabase Dashboard → Database → copiar connection string nova.');
    }
    if (!db.ok) process.exitCode = 1;
  }

  const hasErrors =
    missing.length > 0 || alignment.issues.some((i) => i.level === 'error') || process.exitCode === 1;

  console.log('\n[secrets:check] Resultado:');
  if (hasErrors) {
    console.log('  ✗ NÃO decolar — corrigir secrets antes de produção.');
    console.log('  → Ver docs/migration/P38_SECRETS_CANONICOS.md');
    process.exit(1);
  }

  if (alignment.issues.some((i) => i.level === 'warn')) {
    console.log('  ⚠ Pronto com avisos — migrar aliases legados quando possível.');
  } else {
    console.log('  ✓ Pronto para deploy (secrets coerentes).');
  }
}

main().catch((err) => {
  console.error('[secrets:check]', err.message);
  process.exit(1);
});
