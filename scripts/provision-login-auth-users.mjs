#!/usr/bin/env node
/**
 * Cria credenciais em auth.users para utilizadores já existentes em public.usuario
 * (login interno P38) que ainda não têm conta em auth.
 *
 * Uso:
 *   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... npm run usuario:provision-login-auth
 *   npm run usuario:provision-login-auth -- --dry-run
 *   npm run usuario:provision-login-auth -- --only=siltbt2020
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const P38_LOGIN_EMAIL_DOMAIN = 'login.p38.internal';

function parseArgs(argv) {
  let onlyLogins = null;
  for (const a of argv) {
    if (a.startsWith('--only=')) {
      onlyLogins = a
        .slice('--only='.length)
        .split(',')
        .map((s) => normalizeLogin(s))
        .filter(Boolean);
    }
  }
  return {
    dryRun: argv.includes('--dry-run'),
    onlyLogins: onlyLogins?.length ? onlyLogins : null,
  };
}

function normalizeLogin(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

function loginToAuthEmail(login) {
  return `${normalizeLogin(login)}@${P38_LOGIN_EMAIL_DOMAIN}`;
}

function randomPassword(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

function pgConfig(databaseUrl) {
  const cfg = { connectionString: databaseUrl, max: 1 };
  if (databaseUrl.includes('supabase')) {
    cfg.ssl = { rejectUnauthorized: false };
  }
  return cfg;
}

async function loadUsuariosSemAuth(client) {
  const { rows } = await client.query(`
    select
      u.id,
      lower(trim(u.login)) as login,
      coalesce(nullif(trim(u.full_name), ''), nullif(trim(u.dados->>'full_name'), ''), lower(trim(u.login))) as full_name,
      coalesce(nullif(trim(u.role), ''), nullif(trim(u.dados->>'role'), ''), 'user') as role,
      coalesce(u.perfil_acesso_id, u.dados->>'perfil_acesso_id') as perfil_acesso_id,
      coalesce(u.perfil_acesso_nome, u.dados->>'perfil_acesso_nome') as perfil_acesso_nome,
      coalesce(u.nickname, u.dados->>'nickname') as nickname
    from public.usuario u
    where u.login is not null
      and trim(u.login) <> ''
      and not exists (
        select 1
        from auth.users a
        where lower(a.email) = lower(trim(u.login)) || '@login.p38.internal'
           or lower(coalesce(a.raw_user_meta_data->>'login', '')) = lower(trim(u.login))
      )
    order by lower(trim(u.login))
  `);
  return rows;
}

async function listAuthUsersByLogin(admin) {
  const map = new Map();
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data?.users || []) {
      const login = user.user_metadata?.login || user.email?.split('@')[0];
      if (login) map.set(normalizeLogin(login), user);
    }
    if ((data?.users?.length || 0) < 200) break;
    page += 1;
  }
  return map;
}

async function main() {
  const { dryRun, onlyLogins } = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[usuario:provision-login-auth] Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error('[usuario:provision-login-auth] DATABASE_URL em falta.');
    process.exit(1);
  }

  const pgClient = new pg.Client(pgConfig(databaseUrl));
  await pgClient.connect();

  try {
    let rows = await loadUsuariosSemAuth(pgClient);
    if (onlyLogins) {
      rows = rows.filter((r) => onlyLogins.includes(normalizeLogin(r.login)));
      console.log(`[usuario:provision-login-auth] filtro --only: ${onlyLogins.join(', ')}`);
    }

    if (!rows.length) {
      console.log('[usuario:provision-login-auth] Nenhum utilizador pendente de credencial.');
      return;
    }

    console.log(`[usuario:provision-login-auth] ${rows.length} utilizador(es) sem credencial auth.`);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authByLogin = await listAuthUsersByLogin(supabase.auth.admin);

    let created = 0;
    for (const row of rows) {
      const login = normalizeLogin(row.login);
      if (!login) continue;
      if (authByLogin.has(login)) {
        console.log(`  ~ ${login}: já existe em auth (skip)`);
        continue;
      }

      const email = loginToAuthEmail(login);
      const meta = {
        login,
        nickname: row.nickname || login,
        full_name: row.full_name || login,
        role: String(row.role || 'user').toLowerCase(),
        perfil_acesso_id: row.perfil_acesso_id || null,
        perfil_acesso_nome: row.perfil_acesso_nome || null,
        usuario_operacional_id: row.id,
        must_activate: true,
        password_set: false,
      };

      if (dryRun) {
        console.log(`  [dry-run] criaria auth para ${login} (${email})`);
        created += 1;
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword(24),
        email_confirm: true,
        user_metadata: meta,
      });
      if (error) {
        console.error(`  ✗ ${login}: ${error.message}`);
        continue;
      }

      await pgClient.query(
        `update public.usuario set login = $2, auth_ativado = false where id = $1`,
        [row.id, login],
      );

      console.log(`  ✓ ${login}: credencial criada (${data.user?.id})`);
      created += 1;
    }

    console.log(
      `[usuario:provision-login-auth] Concluído: ${created}/${rows.length}. Próximo passo: /ativar-acesso`,
    );
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('[usuario:provision-login-auth]', err.message || err);
  process.exit(1);
});
