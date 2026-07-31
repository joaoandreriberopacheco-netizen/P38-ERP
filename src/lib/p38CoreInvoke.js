import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';

function resolveFunctionUrls() {
  const urls = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/api/p38-core`);
  }
  const base = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  if (base) {
    urls.push(`${base}/functions/v1/p38-core`);
  }
  return [...new Set(urls.filter(Boolean))];
}

function isSameOriginProxy(url) {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

function isJwtAnonKey(key) {
  return key.startsWith('eyJ');
}

function buildHeaders(url, { sessionToken, anonKey }) {
  const headers = { 'Content-Type': 'application/json' };

  if (isSameOriginProxy(url)) {
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    return headers;
  }

  if (anonKey && isJwtAnonKey(anonKey)) {
    headers.apikey = anonKey;
  }
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

function humanizeP38CoreError(payload, status) {
  const raw = payload?.error || payload?.message || '';
  const msg = String(raw || '').trim();
  if (/não autenticado|missing authorization|unauthorized/i.test(msg) || status === 401) {
    return 'Sessão expirada ou ausente. Saia e entre novamente em /login.';
  }
  if (/OPENAI_API_KEY/i.test(msg)) {
    return 'Leitura com IA indisponível: chave OpenAI não configurada no Supabase (secret OPENAI_API_KEY).';
  }
  if (msg) return msg;
  if (status === 502) return 'Serviço de análise indisponível. Tente novamente em instantes.';
  return `Erro na análise (${status || 'servidor'}).`;
}

/**
 * Invoca `p38-core` com JWT do utilizador (paridade com `invokeP38Auth`).
 */
export async function invokeP38Core(body) {
  const supabase = getSupabaseBrowserClient();
  const urls = resolveFunctionUrls();
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();

  if (!urls.length) {
    throw new Error('Supabase não configurado neste ambiente.');
  }

  const { data: sessionData } = await supabase?.auth.getSession() ?? { data: null };
  const sessionToken = sessionData?.session?.access_token;
  if (!sessionToken) {
    throw new Error('Sessão expirada ou ausente. Saia e entre novamente em /login.');
  }

  let lastNetworkError = null;
  let lastHttpError = null;

  for (const url of urls) {
    const headers = buildHeaders(url, { sessionToken, anonKey });
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.ok) {
        if (payload?.error) throw new Error(humanizeP38CoreError(payload, response.status));
        return payload;
      }

      const msg = humanizeP38CoreError(payload, response.status);
      if (/invalid jwt/i.test(msg) && urls.length > 1) {
        lastHttpError = new Error(msg);
        continue;
      }
      throw new Error(msg);
    } catch (err) {
      if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
        throw err;
      }
      lastNetworkError = err;
    }
  }

  if (lastHttpError) throw lastHttpError;
  throw new Error(
    lastNetworkError?.message?.includes('Failed to fetch')
      ? 'Sem ligação ao servidor de análise. Verifique a internet e tente novamente.'
      : lastNetworkError?.message || 'Falha ao contactar o servidor de análise.'
  );
}
