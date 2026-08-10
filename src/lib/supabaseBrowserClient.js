import { createClient } from '@supabase/supabase-js';
import { isP38Dev, p38PublicEnv } from '@/lib/p38PublicEnv';

let cached;

/**
 * Aceita só a raiz do projeto: `https://<ref>.supabase.co`.
 * Se vier com `/rest/v1` (copiar errado do painel), o supabase-js monta
 * `.../rest/v1/rest/v1/...` e a API responde "Invalid path specified in request URL".
 */
export function normalizeSupabaseProjectUrl(raw) {
  if (raw == null || raw === '') return '';
  let u = String(raw).trim();
  u = u.replace(/\s+/g, '');
  // Remove sufixo /rest/v1 ou /auth/v1 acidental
  u = u.replace(/\/rest\/v1\/?$/i, '');
  u = u.replace(/\/auth\/v1\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u;
}

/**
 * Cliente Supabase para browser (anon key). Só inicializa se URL + key estiverem definidos.
 */
export function getSupabaseBrowserClient() {
  if (cached !== undefined) {
    return cached;
  }

  const url = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  const anonKey = (p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();

  if (!url || !anonKey) {
    cached = null;
    return cached;
  }

  if (isP38Dev() && String(p38PublicEnv('VITE_SUPABASE_URL') || '').includes('/rest/v1')) {
    console.warn(
      '[P38] VITE_SUPABASE_URL não deve incluir /rest/v1 — use só a raiz (ex: https://xxxx.supabase.co). Normalizamos automaticamente.'
    );
  }

  cached = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    }
  });
  return cached;
}

export function isSupabaseBrowserConfigured() {
  const url = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  const key = (p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();
  return Boolean(url && key);
}

/** Aguarda sessão Supabase Auth após signIn (evita race antes do localStorage). */
export async function waitForSupabaseSession(supabase, { timeoutMs = 8000 } = {}) {
  if (!supabase) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return data.session;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}
