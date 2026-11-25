/**
 * Acesso temporário PagLeve — sem login: abre o catálogo em /acesso/:token (expira sozinho).
 * Segredo só no Vercel: CATALOGO_PAGLEVE_CONVITE_SECRET (igual ao script de gerar link).
 */
import { rewrite } from '@vercel/functions';

const TOKEN_PREFIX = 'v1';

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSlice(secretUtf8, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretUtf8),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToB64url(new Uint8Array(sig)).slice(0, 22);
}

async function verifyToken(token, secretUtf8) {
  const t = String(token || '').trim();
  const parts = t.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return { ok: false, reason: 'format' };
  const expMs = Number(parts[1]);
  if (!Number.isFinite(expMs)) return { ok: false, reason: 'format' };
  if (!secretUtf8 || secretUtf8.length < 16) return { ok: false, reason: 'secret' };
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = await hmacSlice(secretUtf8, payload);
  if (expected !== parts[3]) return { ok: false, reason: 'sig' };
  if (Date.now() > expMs) return { ok: false, reason: 'expired', expMs };
  return { ok: true, expMs };
}

function blockedHtml(expMs) {
  const when = expMs
    ? new Date(expMs).toLocaleString('pt-BR', {
        timeZone: 'America/Rio_Branco',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Acesso indisponível — PagLeve</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f4f4f5;color:#3f3f46;padding:24px;text-align:center}main{max-width:26rem}h1{font-size:1.1rem;margin:0 0 .5rem;color:#18181b}p{margin:0;font-size:.94rem;line-height:1.5}</style>
</head><body><main><h1>Link expirado ou inválido</h1>
<p>Este acesso temporário já não funciona.${when ? ` Terminou em ${when} (horário do Acre).` : ''} Peça um novo link à PagLeve.</p>
</main></body></html>`;
}

export const config = {
  matcher: ['/acesso/:path*'],
};

export default async function middleware(request) {
  const secret = process.env.CATALOGO_PAGLEVE_CONVITE_SECRET || '';
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'acesso' || !segments[1]) {
    return new Response(blockedHtml(), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const token = decodeURIComponent(segments[1]);
  const verdict = await verifyToken(token, secret);
  if (!verdict.ok) {
    const status = verdict.reason === 'expired' ? 410 : 403;
    return new Response(blockedHtml(verdict.expMs), {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return rewrite(new URL('/index.html', request.url));
}