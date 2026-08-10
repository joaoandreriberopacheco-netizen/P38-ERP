/**
 * Proxy same-origin para a Edge Function Supabase `p38-core` (InvokeLLM, etc.).
 * Repassa o JWT do utilizador — evita falhas de gateway/CORS no browser.
 */
function resolveP38CoreUrl() {
  const explicit = String(process.env.P38_CORE_URL || '').trim();
  if (explicit) return explicit;
  const base = String(
    process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ''
  ).trim();
  if (base) return `${base.replace(/\/$/, '')}/functions/v1/p38-core`;
  return '';
}

const P38_CORE_URL = resolveP38CoreUrl();

function pickSessionAuthorization(req) {
  const raw = req.headers.authorization || req.headers.Authorization;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^Bearer eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function buildUpstreamHeaders(req) {
  const headers = { 'Content-Type': 'application/json' };
  const sessionAuth = pickSessionAuthorization(req);
  if (sessionAuth) headers.Authorization = sessionAuth;
  return headers;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!P38_CORE_URL) {
    res.status(502).json({ error: 'P38_CORE_URL / VITE_SUPABASE_URL não configurado no servidor.' });
    return;
  }

  try {
    const upstream = await fetch(P38_CORE_URL, {
      method: 'POST',
      headers: buildUpstreamHeaders(req),
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Falha no proxy p38-core.',
    });
  }
}
