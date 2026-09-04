/**
 * Proxy same-origin para qualquer Edge Function Supabase (gerar-numero-sequencial,
 * save-pedido-compra-item, processar-venda-caixa, etc.).
 * Evita falhas de gateway/CORS quando o browser chama supabase.functions.invoke().
 */
import {
  applyCors,
  buildUpstreamHeaders,
  resolveEdgeFunctionUrl,
} from '../_p38UpstreamProxy.js';

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

  const functionName = String(req.query?.name || '').trim();
  if (!functionName) {
    res.status(400).json({ error: 'Nome da Edge Function em falta.' });
    return;
  }

  const upstreamUrl = resolveEdgeFunctionUrl(functionName);
  if (!upstreamUrl) {
    res.status(502).json({
      error: 'VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL não configurado no servidor.',
    });
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: buildUpstreamHeaders(req),
      body: JSON.stringify(req.body ?? {}),
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: err?.message || `Falha no proxy p38-edge (${functionName}).`,
    });
  }
}
