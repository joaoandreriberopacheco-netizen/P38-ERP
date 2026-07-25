import { getSupabaseBrowserClient, normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';

function resolveFunctionsUrl() {
  const base = normalizeSupabaseProjectUrl(import.meta.env.VITE_SUPABASE_URL || '');
  if (!base) return '';
  return `${base}/functions/v1/p38-auth`;
}

function resolveAnonKey() {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

/**
 * Invoca a Edge Function `p38-auth` via fetch directo (mais fiável em mobile que functions.invoke).
 */
export async function invokeP38Auth(body, { authorized = false } = {}) {
  const supabase = getSupabaseBrowserClient();
  const url = resolveFunctionsUrl();
  const anonKey = resolveAnonKey();

  if (!url || !anonKey) {
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

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      err?.message?.includes('Failed to fetch')
        ? 'Sem ligação ao servidor de autenticação. Verifique a internet e tente novamente.'
        : err?.message || 'Falha ao contactar o servidor de autenticação.'
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
