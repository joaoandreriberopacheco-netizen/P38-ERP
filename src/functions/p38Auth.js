import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl, resolveP38AccessToken } from '@/lib/supabaseBrowserClient';

import { p38PublicEnv } from '@/lib/p38PublicEnv';

function resolveFunctionUrl() {
  const base = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  if (!base) return null;
  return `${base}/functions/v1/p38-auth`;
}

function resolveAnonKey() {
  return String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();
}

function isJwtAnonKey(key) {
  return key.startsWith('eyJ');
}

function buildHeaders({ authorized, anonKey, sessionToken }) {
  const headers = { 'Content-Type': 'application/json' };

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
 * Invoca a Edge Function `p38-auth` directamente no Supabase.
 */
export async function invokeP38Auth(body, { authorized = false } = {}) {
  const supabase = getSupabaseBrowserClient();
  const url = resolveFunctionUrl();
  const anonKey = resolveAnonKey();

  if (!url) {
    throw new Error('Supabase não configurado neste ambiente.');
  }

  let sessionToken = null;
  if (authorized) {
    if (!supabase) throw new Error('Supabase não configurado.');
    sessionToken = await resolveP38AccessToken(supabase);
    if (!sessionToken) throw new Error('Sessão ausente.');
  }

  const headers = buildHeaders({ authorized, anonKey, sessionToken });

  let response;
  let data = null;

  try {
    response = await postJson(url, headers, body);
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } catch (err) {
    throw new Error(
      err?.message?.includes('Failed to fetch')
        ? 'Sem ligação ao servidor de autenticação. Verifique a internet e tente novamente.'
        : err?.message || 'Falha ao contactar o servidor de autenticação.'
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

export async function requestP38PasswordReset({ login, app_origin }) {
  return invokeP38Auth({
    op: 'request_password_reset',
    login,
    app_origin,
  });
}
