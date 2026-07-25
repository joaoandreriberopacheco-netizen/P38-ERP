/**
 * Proxy same-origin para a Edge Function Supabase `p38-auth`.
 * Evita bloqueios mobile/CORS e erros JWT do rewrite externo do Vercel.
 */
const P38_AUTH_URL =
  process.env.P38_AUTH_URL ||
  'https://zhonvxkkqabfdyehyxpu.supabase.co/functions/v1/p38-auth';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, apikey');

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
    const auth = req.headers.authorization || req.headers.Authorization;
    const apikey = req.headers.apikey || req.headers['apikey'];
    if (typeof auth === 'string' && auth.trim()) headers.Authorization = auth.trim();
    if (typeof apikey === 'string' && apikey.trim()) headers.apikey = apikey.trim();

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
