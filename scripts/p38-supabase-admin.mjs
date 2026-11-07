/**
 * Cliente Supabase admin para scripts Node (sem Vite, sem Base44, sem entity layer).
 * NEXT_PUBLIC_SUPABASE_URL (recomendado) ou VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

export function resolveP38SupabaseAdminConfig() {
  loadDotEnvFiles();
  loadP38SecretsBundle();
  const secrets = resolveP38Secrets();
  let url = secrets.supabaseUrl || secrets.nextPublicSupabaseUrl;
  const serviceRoleKey = secrets.serviceRoleKey;

  if (!url && secrets.databaseUrl && secrets.projectRef) {
    url = `https://${secrets.projectRef}.supabase.co`;
  }

  return { url, serviceRoleKey, secrets };
}

export function requireP38SupabaseAdmin() {
  const { url, serviceRoleKey, secrets } = resolveP38SupabaseAdminConfig();

  if (!url) {
    console.error(
      '[P38] URL Supabase em falta. Defina NEXT_PUBLIC_SUPABASE_URL (recomendado) ou VITE_SUPABASE_URL.',
    );
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.error(
      '[P38] SUPABASE_SERVICE_ROLE_KEY em falta (service_role no dashboard Supabase → API).',
    );
    const all = (process.env.CLOUD_AGENT_ALL_SECRET_NAMES || '').split(',').map((s) => s.trim());
    if (all.length && !all.some((n) => /service.?role/i.test(n))) {
      console.error(
        '[P38] Cursor Cloud: este ambiente não lista supabase-service-role-key nem SUPABASE_SERVICE_ROLE_KEY.',
      );
      console.error(
        '[P38] No painel do ambiente, associe o secret (nome canónico SUPABASE_SERVICE_ROLE_KEY recomendado) e abra nova sessão.',
      );
    }
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    process.exit(1);
  }

  if (secrets.aliasesUsed?.length) {
    console.error(`[P38] Secrets (aliases): ${secrets.aliasesUsed.join(', ')}`);
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
