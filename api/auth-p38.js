/**
 * Proxy same-origin para a Edge Function Supabase `p38-auth`.
 * Inclui retentativas — o gateway Supabase falha intermitentemente com JWT inválido.
 */
function resolveP38AuthUrl() {
  const explicit = String(process.env.P38_AUTH_URL || '').trim();
  if (explicit) return explicit;
  const base = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  if (base) return `${base.replace(/\/$/, '')}/functions/v1/p38-auth`;
  return 'https://zhonvxkkqabfdyehyxpu.supabase.co/functions/v1/p38-auth';
}

const P38_AUTH_URL = resolveP38AuthUrl();

const MAX_ATTEMPTS = 5;

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

async function callUpstream(body, headers) {
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const upstream = await fetch(P38_AUTH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    const text = await upstream.text();
    if (!/invalid jwt/i.test(text)) {
      return { status: upstream.status, text };
    }
    lastText = text;
    await new Promise((r) => setTimeout(r, 80 * attempt));
  }
  return { status: 502, text: lastText || '{"error":"Serviço de autenticação instável. Tente novamente."}' };
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
    const { status, text } = await callUpstream(req.body, buildUpstreamHeaders(req));
    res.status(status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: err?.message || 'Falha no proxy p38-auth.',
    });
  }
}
