import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';

function resolveFunctionUrls() {
  const urls = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/api/auth-p38`);
  }
  const base = normalizeSupabaseProjectUrl(import.meta.env.VITE_SUPABASE_URL || '');
  if (base) {
    urls.push(`${base}/functions/v1/p38-auth`);
  }
  return [...new Set(urls.filter(Boolean))];
}

function resolveAnonKey() {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
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

function buildHeaders(url, { authorized, anonKey, sessionToken }) {
  const headers = { 'Content-Type': 'application/json' };

  // Proxy Vercel → Supabase: sem apikey/JWT (evita erro ES256 no gateway).
  if (isSameOriginProxy(url)) {
    if (authorized && sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    return headers;
  }

  if (anonKey && isJwtAnonKey(anonKey)) {
    headers.apikey = anonKey;
    if (!authorized) {
      // Função pública com verify_jwt=false — não enviar Authorization com anon key.
      return headers;
    }
  }

  if (authorized && sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  return headers;
}

async function postJson(url, headers, body) {
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Invoca a Edge Function `p38-auth`.
 * Em produção usa primeiro `/api/auth-p38` (mesmo domínio Vercel).
 */
export async function invokeP38Auth(body, { authorized = false } = {}) {
  const supabase = getSupabaseBrowserClient();
  const urls = resolveFunctionUrls();
  const anonKey = resolveAnonKey();

  if (!urls.length) {
    throw new Error('Supabase não configurado neste ambiente.');
  }

  let sessionToken = null;
  if (authorized) {
    if (!supabase) throw new Error('Supabase não configurado.');
    const { data } = await supabase.auth.getSession();
    sessionToken = data?.session?.access_token;
    if (!sessionToken) throw new Error('Sessão ausente.');
  }

  let response = null;
  let data = null;
  let lastNetworkError = null;
  let lastHttpError = null;

  for (const url of urls) {
    const headers = buildHeaders(url, { authorized, anonKey, sessionToken });
    try {
      const attempt = await postJson(url, headers, body);
      let payload = null;
      try {
        payload = await attempt.json();
      } catch {
        payload = null;
      }

      if (attempt.ok) {
        response = attempt;
        data = payload;
        break;
      }

      const msg = payload?.error || payload?.message || `HTTP ${attempt.status}`;
      // JWT inválido no proxy → tentar URL directa seguinte.
      if (/invalid jwt/i.test(msg) && urls.length > 1) {
        lastHttpError = new Error(msg);
        continue;
      }
      response = attempt;
      data = payload;
      break;
    } catch (err) {
      lastNetworkError = err;
    }
  }

  if (!response) {
    if (lastHttpError) throw lastHttpError;
    throw new Error(
      lastNetworkError?.message?.includes('Failed to fetch')
        ? 'Sem ligação ao servidor de autenticação. Verifique a internet e tente novamente.'
        : lastNetworkError?.message || 'Falha ao contactar o servidor de autenticação.'
    );
  }

  if (!response.ok) {
    const msg =
      data?.error ||
      data?.message ||
      (response.status === 404
        ? 'Serviço de autenticação indisponível (p38-auth). Contacte o suporte.'
        : `Erro do servidor (${response.status}).`);
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function fetchP38AuthStatus() {
  return invokeP38Auth({ op: 'status' });
}

export async function bootstrapP38Admin({ login, password }) {
  return invokeP38Auth({ op: 'bootstrap', login, password });
}

export async function activateP38User({ login, password }) {
  return invokeP38Auth({ op: 'activate', login, password });
}

export async function createP38UserAsAdmin(payload) {
  return invokeP38Auth({ op: 'create_user', ...payload }, { authorized: true });
}
