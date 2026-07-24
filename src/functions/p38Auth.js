import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

/**
 * Invoca a Edge Function `p38-auth` (login interno, bootstrap, criar utilizador).
 */
export async function invokeP38Auth(body, { authorized = false } = {}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase não configurado.');
  }

  const headers = {};
  if (authorized) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sessão ausente.');
    headers.Authorization = `Bearer ${token}`;
  }

  const { data, error } = await supabase.functions.invoke('p38-auth', {
    body,
    headers,
  });

  if (error) {
    throw new Error(error.message || 'Falha na função p38-auth.');
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
