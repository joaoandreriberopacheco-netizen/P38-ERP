/**
 * Utilitários partilhados pelos proxies Vercel → Supabase Edge Functions.
 */

export function resolveSupabaseProjectUrl() {
  const base = String(
    process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ''
  ).trim();
  return base.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function resolveEdgeFunctionUrl(functionName) {
  const base = resolveSupabaseProjectUrl();
  if (!base) return '';
  const slug = String(functionName || '').trim();
  if (!slug) return '';
  return `${base}/functions/v1/${encodeURIComponent(slug)}`;
}

export function pickSessionAuthorization(req) {
  const raw = req.headers.authorization || req.headers.Authorization;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^Bearer eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function resolveSupabaseAnonKey() {
  return String(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
  ).trim();
}

export function buildUpstreamHeaders(req) {
  const headers = { 'Content-Type': 'application/json' };
  const anonKey = resolveSupabaseAnonKey();
  if (anonKey.startsWith('eyJ')) {
    headers.apikey = anonKey;
  }
  const sessionAuth = pickSessionAuthorization(req);
  if (sessionAuth) headers.Authorization = sessionAuth;
  return headers;
}

export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
}
