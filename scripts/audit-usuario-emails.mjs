#!/usr/bin/env node
/**
 * Lista utilizadores em public.usuario e indica se têm email operacional cadastrado
 * (necessário para "Esqueci a senha" e reset de PIN por email).
 *
 * Uso:
 *   DATABASE_URL=... npm run usuario:audit-emails
 *   npm run usuario:audit-emails -- --only=joaoandreriberopacheco
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const P38_LOGIN_EMAIL_DOMAIN = 'login.p38.internal';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseArgs(argv) {
  let only = null;
  for (const a of argv) {
    if (a.startsWith('--only=')) {
      only = a.slice('--only='.length).trim().toLowerCase();
    }
  }
  return { only };
}

function normalizeLogin(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

function resolveOperationalEmail(row) {
  const candidates = [row.email_col, row.email_dados];
  for (const raw of candidates) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (email.endsWith(`@${P38_LOGIN_EMAIL_DOMAIN}`)) continue;
    return email;
  }
  return null;
}

function pgConfig(databaseUrl) {
  const cfg = { connectionString: databaseUrl, max: 1 };
  if (databaseUrl.includes('supabase')) {
    cfg.ssl = { rejectUnauthorized: false };
  }
  return cfg;
}

async function main() {
  const { only } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('[usuario:audit-emails] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client(pgConfig(databaseUrl));
  await client.connect();

  try {
    const params = [];
    let filterSql = '';
    if (only) {
      params.push(normalizeLogin(only));
      filterSql = `and lower(coalesce(nullif(trim(u.login), ''), u.nickname, u.dados->>'nickname', '')) = $1`;
    }

    const { rows } = await client.query(
      `
      select
        u.id,
        lower(trim(coalesce(nullif(trim(u.login), ''), u.nickname, u.dados->>'nickname', ''))) as login,
        coalesce(nullif(trim(u.full_name), ''), nullif(trim(u.dados->>'full_name'), '')) as full_name,
        nullif(trim(u.email), '') as email_col,
        nullif(trim(u.dados->>'email'), '') as email_dados,
        coalesce(u.auth_ativado, false) as auth_ativado,
        exists (
          select 1 from auth.users a
          where lower(a.email) = lower(trim(coalesce(nullif(trim(u.login), ''), u.nickname, u.dados->>'nickname', ''))) || '@login.p38.internal'
        ) as tem_auth
      from public.usuario u
      where coalesce(nullif(trim(u.login), ''), u.nickname, u.dados->>'nickname') is not null
        ${filterSql}
      order by login
      `,
      params,
    );

    if (!rows.length) {
      console.log(only ? `Nenhum utilizador encontrado para "${only}".` : 'Nenhum utilizador com login.');
      return;
    }

    let comEmail = 0;
    let semEmail = 0;

    console.log('');
    console.log('login | email cadastrado | auth | nome');
    console.log('------|------------------|------|-----');

    for (const row of rows) {
      const email = resolveOperationalEmail(row);
      const login = row.login || '(sem login)';
      if (email) {
        comEmail += 1;
        console.log(`${login} | ${email} | ${row.tem_auth ? 'sim' : 'não'} | ${row.full_name || '-'}`);
      } else {
        semEmail += 1;
        const hint = [row.email_col, row.email_dados].filter(Boolean).join(' / ') || '—';
        console.log(`${login} | FALTA (${hint}) | ${row.tem_auth ? 'sim' : 'não'} | ${row.full_name || '-'}`);
      }
    }

    console.log('');
    console.log(`Total: ${rows.length} | com email OK: ${comEmail} | sem email: ${semEmail}`);
    if (semEmail > 0) {
      console.log('');
      console.log('Utilizadores sem email não recebem link de "Esqueci a senha".');
      console.log('Corrija em Configurações → Usuários ou na tabela public.usuario (coluna email).');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[usuario:audit-emails]', err.message || err);
  process.exit(1);
});
