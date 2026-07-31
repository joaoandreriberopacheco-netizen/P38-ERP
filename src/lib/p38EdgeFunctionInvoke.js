import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';
import { toSupabaseEdgeFunctionName } from '@/lib/p38EdgeFunctionNames';

function resolveFunctionUrls(edgeName) {
  const urls = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/api/p38-edge/${encodeURIComponent(edgeName)}`);
  }
  const base = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  if (base) {
    urls.push(`${base}/functions/v1/${encodeURIComponent(edgeName)}`);
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

function humanizeEdgeFunctionError(payload, status, functionName) {
  const raw = payload?.error || payload?.message || '';
  const msg = String(raw || '').trim();
  if (/não autenticado|missing authorization|unauthorized/i.test(msg) || status === 401) {
    return 'Sessão expirada ou ausente. Saia e entre novamente em /login.';
  }
  if (/not\.found|404/i.test(msg) || status === 404) {
    return `Função "${functionName}" ainda não foi migrada para Supabase Edge Functions.`;
  }
  if (msg) return msg;
  if (status === 502) return `Serviço "${functionName}" indisponível. Tente novamente em instantes.`;
  return `Erro ao invocar "${functionName}" (${status || 'servidor'}).`;
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

/**
 * Invoca uma Edge Function Supabase com proxy same-origin (Vercel) e fallback directo.
 * Substitui `supabase.functions.invoke()` no browser — evita FunctionsFetchError por CORS/gateway.
 */
export async function invokeP38EdgeFunction(functionName, body, { supabase: supabaseClient } = {}) {
  if (!functionName) {
    throw new Error('P38: nome da Edge Function obrigatório.');
  }

  const edgeName = toSupabaseEdgeFunctionName(functionName);
  const urls = resolveFunctionUrls(edgeName);
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();

  if (!urls.length) {
    const err = new Error(
      `Função "${functionName}" indisponível: Supabase não configurado (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).`
    );
    err.code = 'P38_SUPABASE_NOT_CONFIGURED';
    throw err;
  }

  const supabase = supabaseClient || getSupabaseBrowserClient();
  const { data: sessionData } = await supabase?.auth.getSession() ?? { data: null };
  const sessionToken = sessionData?.session?.access_token ?? null;

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

      const payload = await parseResponsePayload(response);

      if (response.ok) {
        if (payload && typeof payload === 'object' && payload.error && payload.success !== true) {
          throw new Error(String(payload.error));
        }
        return payload;
      }

      const msg = humanizeEdgeFunctionError(payload, response.status, functionName);
      if (/invalid jwt/i.test(msg) && urls.length > 1) {
        lastHttpError = new Error(msg);
        continue;
      }
      const enhanced = new Error(msg);
      enhanced.code = 'P38_SUPABASE_FUNCTION_ERROR';
      throw enhanced;
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
      ? `Sem ligação ao servidor (${functionName}). Verifique a internet e tente novamente.`
      : lastNetworkError?.message || `Falha ao contactar Edge Function "${functionName}".`
  );
}

/**
 * Variante binária (PDF, etc.) — devolve ArrayBuffer no campo `data`.
 */
export async function invokeP38EdgeFunctionBinary(functionName, body, options = {}) {
  const edgeName = toSupabaseEdgeFunctionName(functionName);
  const urls = resolveFunctionUrls(edgeName);
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();
  const supabase = options.supabase || getSupabaseBrowserClient();
  const { data: sessionData } = await supabase?.auth.getSession() ?? { data: null };
  const sessionToken = sessionData?.session?.access_token ?? null;

  if (!urls.length) {
    throw new Error(`Função "${functionName}" indisponível: Supabase não configurado.`);
  }

  let lastNetworkError = null;

  for (const url of urls) {
    const headers = buildHeaders(url, { sessionToken, anonKey });
    headers.Accept = '*/*';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
      });

      if (!response.ok) {
        let message = `Erro ao chamar ${functionName} (HTTP ${response.status})`;
        try {
          const ct = response.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const errJson = await response.json();
            message =
              errJson?.error ||
              errJson?.message ||
              errJson?.detail ||
              (typeof errJson === 'string' ? errJson : message);
          } else {
            const t = await response.text();
            if (t) message = t.slice(0, 500);
          }
        } catch {
          /* mantém message */
        }
        throw new Error(message);
      }

      const data = await response.arrayBuffer();
      return { data };
    } catch (err) {
      if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
        throw err;
      }
      lastNetworkError = err;
    }
  }

  throw new Error(
    lastNetworkError?.message?.includes('Failed to fetch')
      ? `Sem ligação ao servidor (${functionName}).`
      : lastNetworkError?.message || `Falha ao contactar Edge Function "${functionName}".`
  );
}
