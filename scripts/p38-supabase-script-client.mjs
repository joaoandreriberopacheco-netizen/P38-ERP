/**
 * Cliente P38 para scripts Node — stack Cursor → GitHub → Vercel → Supabase.
 * Não usa Base44. Service role para operações administrativas (CLI / Cloud Agent).
 */
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { createSupabaseEntityLayer } from '../src/integrations/p38/supabaseEntityLayer.js';
import { toSupabaseEdgeFunctionName } from '../src/lib/p38EdgeFunctionNames.js';

/**
 * @returns {{ supabase: import('@supabase/supabase-js').SupabaseClient, entities: object, functions: { invoke: Function } }}
 */
export function requireP38SupabaseScriptClient() {
  loadDotEnvFiles();
  const secrets = resolveP38Secrets();
  const url = secrets.supabaseUrl;
  const serviceRoleKey = secrets.serviceRoleKey;

  if (!url || !serviceRoleKey) {
    console.error(
      '[P38] Scripts Supabase: defina VITE_SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.',
    );
    console.error('Guia: docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md');
    console.error('(Base44 não faz parte deste projeto — dados e Edge Functions estão no Supabase.)');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const entities = createSupabaseEntityLayer(null, supabase);

  const functions = {
    async invoke(name, body) {
      const slug = toSupabaseEdgeFunctionName(name);
      const { data, error } = await supabase.functions.invoke(slug, {
        body: body ?? {},
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      });
      if (error) {
        const msg = error?.message || String(error);
        throw new Error(`Edge Function ${slug}: ${msg}`);
      }
      if (data && typeof data === 'object' && data.error && data.success !== true) {
        throw new Error(String(data.error));
      }
      return { data };
    },
  };

  return { supabase, entities, functions };
}

/** Formato legado `base44` usado pelas libs de domínio (só entidades + functions). */
export function asP38LegacyClient(scriptClient) {
  return {
    entities: scriptClient.entities,
    functions: scriptClient.functions,
  };
}
