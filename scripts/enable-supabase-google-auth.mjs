#!/usr/bin/env node
/**
 * Activa login Google no projecto Supabase P38 (Management API).
 *
 * Secrets necessários (Cursor Cloud / GitHub Actions):
 *   SUPABASE_ACCESS_TOKEN     — https://supabase.com/dashboard/account/tokens
 *   GOOGLE_OAUTH_CLIENT_ID    — Google Cloud Console → OAuth 2.0 Client ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Opcional:
 *   SUPABASE_PROJECT_REF      — default: extrai de VITE_SUPABASE_URL / DATABASE_URL
 *   P38_SITE_URL              — default: https://p-38erp.vercel.app
 *
 * Uso: node scripts/enable-supabase-google-auth.mjs
 */
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

const SITE_URL = (process.env.P38_SITE_URL || 'https://p-38erp.vercel.app').replace(/\/+$/, '');
const REDIRECT_URLS = [
  `${SITE_URL}/auth/callback`,
  'http://localhost:5173/auth/callback',
  'http://127.0.0.1:5173/auth/callback',
];

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`::error::Secret ${name} em falta.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const { accessToken, projectRef } = resolveSupabaseDeployEnv();
  const token = accessToken || requireEnv('SUPABASE_ACCESS_TOKEN');
  const ref = projectRef || requireEnv('SUPABASE_PROJECT_REF');
  const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET');

  const getRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    const body = await getRes.text();
    console.error(`::error::Falha ao ler auth config (${getRes.status}): ${body}`);
    process.exit(1);
  }
  const current = await getRes.json();

  const existingRedirects = String(current.uri_allow_list || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const uriAllowList = [...new Set([...existingRedirects, ...REDIRECT_URLS])].join('\n');

  const patchBody = {
    external_google_enabled: true,
    external_google_client_id: clientId,
    external_google_secret: clientSecret,
    site_url: SITE_URL,
    uri_allow_list: uriAllowList,
  };

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text();
    console.error(`::error::Falha ao activar Google (${patchRes.status}): ${body}`);
    process.exit(1);
  }

  const updated = await patchRes.json();
  console.log('OK: Google OAuth activo no Supabase.');
  console.log(`  project: ${ref}`);
  console.log(`  site_url: ${updated.site_url || SITE_URL}`);
  console.log(`  google_enabled: ${updated.external_google_enabled}`);
  console.log('');
  console.log('No Google Cloud Console, confirma Authorized redirect URI:');
  console.log(`  https://${ref}.supabase.co/auth/v1/callback`);
  console.log('');
  console.log('Depois, no deploy Vercel, define VITE_P38_ENABLE_GOOGLE_LOGIN=true e faz redeploy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
