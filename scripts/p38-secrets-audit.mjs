#!/usr/bin/env node
/**
 * Auditoria amigável dos secrets P38 — confirma presença e acesso real.
 * Não imprime valores das chaves.
 *
 * Uso: npm run secrets:audit
 */
import pg from 'pg';
import {
  checkProjectRefAlignment,
  P38_CANONICAL_PROJECT_REF,
  parseDatabaseUrlMeta,
  resolveP38Secrets,
} from './p38-secrets.mjs';

/** @type {{ key: string, label: string, gives: string, required: boolean, present: (s: ReturnType<typeof resolveP38Secrets>) => boolean }[]} */
const INVENTORY = [
  {
    key: 'VITE_SUPABASE_URL',
    label: 'URL do Supabase P38',
    gives: 'Site e scripts ligam ao projecto correcto',
    required: true,
    present: (s) => Boolean(s.viteSupabaseUrl),
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    label: 'Chave anon (pública)',
    gives: 'Login dos utilizadores e operações no browser',
    required: true,
    present: (s) => Boolean(s.viteSupabaseAnonKey),
  },
  {
    key: 'DATABASE_URL',
    label: 'Ligação Postgres',
    gives: 'Migrações SQL e scripts na base de dados',
    required: true,
    present: (s) => Boolean(s.databaseUrl),
  },
  {
    key: 'SUPABASE_ACCESS_TOKEN',
    label: 'Token pessoal Supabase (PAT)',
    gives: 'Publicar Edge Functions (login interno p38-auth)',
    required: true,
    present: (s) => Boolean(s.accessToken),
  },
  {
    key: 'VERCEL_TOKEN',
    label: 'Token Vercel',
    gives: 'Deploy automático do site via GitHub Actions',
    required: true,
    present: (s) => Boolean(s.vercelToken),
  },
  {
    key: 'VERCEL_ORG_ID',
    label: 'ID da conta Vercel',
    gives: 'Deploy na conta/organização correcta',
    required: true,
    present: (s) => Boolean(s.vercelOrgId),
  },
  {
    key: 'VERCEL_PROJECT_ID',
    label: 'ID do projecto Vercel',
    gives: 'Deploy no site p-38erp (não noutro projecto)',
    required: true,
    present: (s) => Boolean(s.vercelProjectId),
  },
];

async function testDatabase(url) {
  const client = new pg.Client({
    connectionString: url.trim(),
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 12000,
  });
  try {
    await client.connect();
    await client.query('select 1');
    return { ok: true };
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

async function testSupabaseApi(url, anonKey) {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    return { ok: res.status < 500 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const secrets = resolveP38Secrets();
  const alignment = checkProjectRefAlignment(secrets);
  const source = process.env.CLOUD_AGENT_ALL_SECRET_NAMES
    ? 'Cursor Cloud Secrets'
    : 'ambiente local / CI';

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  P38 — Auditoria de secrets (avião comercial)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Fonte: ${source}`);
  console.log(`  Projecto P38: ${P38_CANONICAL_PROJECT_REF}`);
  console.log('');

  let allOk = true;

  console.log('── Presença e função de cada chave ──');
  console.log('');

  for (const item of INVENTORY) {
    const ok = item.present(secrets);
    const icon = ok ? '✓' : '✗';
    const status = ok ? 'presente' : 'EM FALTA';
    console.log(`  ${icon} ${item.key}`);
    console.log(`      ${item.label} — ${status}`);
    console.log(`      → ${item.gives}`);
    if (!ok && item.required) allOk = false;
    console.log('');
  }

  console.log('── Testes de ligação (sem mostrar passwords) ──');
  console.log('');

  if (secrets.viteSupabaseUrl && secrets.viteSupabaseAnonKey) {
    process.stdout.write('  API Supabase (URL + anon key) … ');
    const api = await testSupabaseApi(secrets.viteSupabaseUrl, secrets.viteSupabaseAnonKey);
    if (api.ok) {
      console.log('✓ acesso OK');
    } else {
      console.log('✗ sem acesso');
      if (api.error) console.log(`      ${api.error}`);
      allOk = false;
    }
  } else {
    console.log('  API Supabase … — (faltam URL ou anon key)');
    allOk = false;
  }

  if (secrets.databaseUrl) {
    const meta = parseDatabaseUrlMeta(secrets.databaseUrl);
    process.stdout.write('  Base de dados (DATABASE_URL) … ');
    if (meta.projectRef === P38_CANONICAL_PROJECT_REF) {
      const db = await testDatabase(secrets.databaseUrl);
      if (db.ok) {
        console.log('✓ ligação OK');
      } else {
        console.log('✗ ligação falhou');
        console.log('      → Rever connection string no Supabase → Database → URI pooler');
        allOk = false;
      }
    } else {
      console.log(`✗ projecto detectado: ${meta.projectRef || '?'}`);
      console.log(`      → Utilizador deve ser postgres.${P38_CANONICAL_PROJECT_REF}`);
      allOk = false;
    }
  } else {
    console.log('  Base de dados … — (DATABASE_URL em falta)');
    allOk = false;
  }

  const blocking = alignment.issues.filter((i) => i.level === 'error');
  if (blocking.length) {
    console.log('');
    console.log('── Alinhamento ──');
    for (const issue of blocking) {
      console.log(`  ✗ ${issue.message}`);
    }
    allOk = false;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  if (allOk) {
    console.log('  ✓ Avião pronto para decolar');
    console.log('    Todos os acessos necessários estão configurados.');
  } else {
    console.log('  ✗ Ainda falta configurar secrets');
    console.log('    Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
  }
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error('[secrets:audit]', err.message);
  process.exit(1);
});
