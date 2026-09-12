import {
  getSupabaseBrowserClient,
  normalizeSupabaseProjectUrl,
  resolveP38AccessToken,
} from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';

function resolveFunctionUrl() {
  const base = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  if (!base) return null;
  return `${base}/functions/v1/p38-core`;
}

function isJwtAnonKey(key) {
  return key.startsWith('eyJ');
}

function buildHeaders({ sessionToken, anonKey }) {
  const headers = { 'Content-Type': 'application/json' };

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
  if (/no api key found/i.test(msg)) {
    return 'Serviço de análise indisponível (ligação ao servidor). Tente novamente em instantes.';
  }
  if (/não autenticado|missing authorization/i.test(msg)) {
    return 'Sessão expirada ou ausente. Saia e entre novamente em /login.';
  }
  if (status === 401 && /unauthorized/i.test(msg)) {
    return 'Sessão expirada ou ausente. Saia e entre novamente em /login.';
  }
  if (/GEMINI_API_KEY|GOOGLE_API_KEY/i.test(msg)) {
    return 'Leitura com IA indisponível: configure GEMINI_API_KEY no Supabase → Edge Functions → Secrets.';
  }
  if (/pico de demanda|spike|unavailable|503|429|try again/i.test(msg)) {
    return 'O Gemini está sobrecarregado neste momento. Aguarde 30–60 segundos e tente de novo.';
  }
  if (msg) return msg;
  if (status === 502) return 'Serviço de análise indisponível. Tente novamente em instantes.';
  return `Erro na análise (${status || 'servidor'}).`;
}

/**
 * Invoca `p38-core` directamente no Supabase (sem proxy Vercel).
 */
export async function invokeP38Core(body) {
  const supabase = getSupabaseBrowserClient();
  const url = resolveFunctionUrl();
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();

  if (!url) {
    throw new Error('Supabase não configurado neste ambiente.');
  }

  const sessionToken = await resolveP38AccessToken(supabase);
  if (!sessionToken) {
    throw new Error('Sessão expirada ou ausente. Saia e entre novamente em /login.');
  }

  const headers = buildHeaders({ sessionToken, anonKey });

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

    throw new Error(humanizeP38CoreError(payload, response.status));
  } catch (err) {
    if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
      throw err;
    }
    throw new Error(
      err?.message?.includes('Failed to fetch')
        ? 'Sem ligação ao servidor de análise. Verifique a internet e tente novamente.'
        : err?.message || 'Falha ao contactar o servidor de análise.'
    );
  }
}
