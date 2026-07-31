import {
  buildUpstreamHeaders,
  resolveEdgeFunctionUrl,
} from '../../../../api/_p38UpstreamProxy.js';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request, context) {
  const params = await context.params;
  const functionName = String(params?.name || '').trim();
  if (!functionName) {
    return Response.json({ error: 'Nome da Edge Function em falta.' }, { status: 400, headers: CORS_HEADERS });
  }

  const upstreamUrl = resolveEdgeFunctionUrl(functionName);
  if (!upstreamUrl) {
    return Response.json(
      { error: 'VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL não configurado no servidor.' },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const headers = buildUpstreamHeaders({
    headers: Object.fromEntries(request.headers.entries()),
  });

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': contentType },
    });
  } catch (err) {
    return Response.json(
      { error: err?.message || `Falha no proxy p38-edge (${functionName}).` },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
