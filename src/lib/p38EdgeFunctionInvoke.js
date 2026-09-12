import {
  getSupabaseBrowserClient,
  normalizeSupabaseProjectUrl,
  resolveP38AccessToken,
} from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';
import { toSupabaseEdgeFunctionName } from '@/lib/p38EdgeFunctionNames';

function resolveFunctionUrl(edgeName) {
  const base = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  if (!base) return null;
  return `${base}/functions/v1/${encodeURIComponent(edgeName)}`;
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

function isBinaryContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  return (
    ct.includes('application/pdf') ||
    ct.includes('application/octet-stream') ||
    ct.includes('application/zip')
  );
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (isBinaryContentType(contentType)) {
    return { __binary: true, data: await response.arrayBuffer() };
  }
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

function assertSupabaseConfigured(functionName) {
  const url = resolveFunctionUrl(toSupabaseEdgeFunctionName(functionName));
  if (url) return url;
  const err = new Error(
    `Função "${functionName}" indisponível: Supabase não configurado (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).`
  );
  err.code = 'P38_SUPABASE_NOT_CONFIGURED';
  throw err;
}

/**
 * Invoca uma Edge Function Supabase directamente (sem proxy Vercel).
 */
export async function invokeP38EdgeFunction(functionName, body, { supabase: supabaseClient } = {}) {
  if (!functionName) {
    throw new Error('P38: nome da Edge Function obrigatório.');
  }

  const edgeName = toSupabaseEdgeFunctionName(functionName);
  const url = assertSupabaseConfigured(functionName);
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();

  const supabase = supabaseClient || getSupabaseBrowserClient();
  const sessionToken = (await resolveP38AccessToken(supabase)) ?? null;
  const headers = buildHeaders({ sessionToken, anonKey });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });

    const payload = await parseResponsePayload(response);

    if (response.ok) {
      if (payload?.__binary) {
        return { data: payload.data };
      }
      if (payload && typeof payload === 'object' && payload.error && payload.success !== true) {
        throw new Error(String(payload.error));
      }
      return payload;
    }

    const msg = humanizeEdgeFunctionError(payload, response.status, functionName);
    const enhanced = new Error(msg);
    enhanced.code = 'P38_SUPABASE_FUNCTION_ERROR';
    throw enhanced;
  } catch (err) {
    if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
      throw err;
    }
    throw new Error(
      err?.message?.includes('Failed to fetch')
        ? `Sem ligação ao servidor (${functionName}). Verifique a internet e tente novamente.`
        : err?.message || `Falha ao contactar Edge Function "${functionName}".`
    );
  }
}

/**
 * Variante binária (PDF, etc.) — devolve ArrayBuffer no campo `data`.
 */
export async function invokeP38EdgeFunctionBinary(functionName, body, options = {}) {
  const url = assertSupabaseConfigured(functionName);
  const anonKey = String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();
  const supabase = options.supabase || getSupabaseBrowserClient();
  const sessionToken = (await resolveP38AccessToken(supabase)) ?? null;
  const headers = buildHeaders({ sessionToken, anonKey });
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
    throw new Error(
      err?.message?.includes('Failed to fetch')
        ? `Sem ligação ao servidor (${functionName}).`
        : err?.message || `Falha ao contactar Edge Function "${functionName}".`
    );
  }
}
