/**
 * Proxy same-origin para a Edge Function Supabase `p38-auth`.
 * Não reencaminha apikey nem tokens inválidos (evita erro ES256 no gateway Supabase).
 */
const P38_AUTH_URL =
  process.env.P38_AUTH_URL ||
  'https://zhonvxkkqabfdyehyxpu.supabase.co/functions/v1/p38-auth';

function pickSessionAuthorization(req) {
  const raw = req.headers.authorization || req.headers.Authorization;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Só JWT de sessão do utilizador (HS256 legado Supabase).
  if (/^Bearer eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
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

  try {
    const headers = { 'Content-Type': 'application/json' };
    const sessionAuth = pickSessionAuthorization(req);
    if (sessionAuth) headers.Authorization = sessionAuth;

    const upstream = await fetch(P38_AUTH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Falha no proxy p38-auth.',
    });
  }
}
