/**
 * Proxy same-origin para a Edge Function Supabase `p38-core` (InvokeLLM, etc.).
 * Repassa JWT do utilizador + apikey — evita falhas de gateway/CORS no browser.
 */
import {
  applyCors,
  buildUpstreamHeaders,
  resolveEdgeFunctionUrl,
} from './_p38UpstreamProxy.js';

const P38_CORE_URL = resolveEdgeFunctionUrl('p38-core');

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!P38_CORE_URL) {
    res.status(502).json({
      error: 'VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL não configurado no servidor.',
    });
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
