import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';

function resolveFunctionUrls() {
  const urls = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    urls.push(`${window.location.origin}/api/p38-auth`);
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

async function postJson(url, headers, body) {
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Invoca a Edge Function `p38-auth`.
 * Em produção usa primeiro `/api/p38-auth` (mesmo domínio Vercel) — evita bloqueios mobile ao Supabase.
 */
export async function invokeP38Auth(body, { authorized = false } = {}) {
  const supabase = getSupabaseBrowserClient();
  const urls = resolveFunctionUrls();
  const anonKey = resolveAnonKey();

  if (!urls.length || !anonKey) {
    throw new Error('Supabase não configurado neste ambiente.');
  }

  const headers = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  if (authorized) {
    if (!supabase) throw new Error('Supabase não configurado.');
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sessão ausente.');
    headers.Authorization = `Bearer ${token}`;
  }

  let response = null;
  let lastNetworkError = null;

  for (const url of urls) {
    try {
      response = await postJson(url, headers, body);
      break;
    } catch (err) {
      lastNetworkError = err;
    }
  }

  if (!response) {
    throw new Error(
      lastNetworkError?.message?.includes('Failed to fetch')
        ? 'Sem ligação ao servidor de autenticação. Verifique a internet e tente novamente.'
        : lastNetworkError?.message || 'Falha ao contactar o servidor de autenticação.'
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
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
