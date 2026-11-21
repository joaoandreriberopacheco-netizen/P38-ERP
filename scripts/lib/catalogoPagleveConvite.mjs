/**
 * Convites temporários do catálogo PagLeve (HMAC, validade em horas).
 * O mesmo segredo deve existir em CATALOGO_PAGLEVE_CONVITE_SECRET (Vercel + gerador).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECRET_FILE = path.join(ROOT, 'files', 'pagleve', 'catalogo-convite-secret.local');

export const PAGLEVE_CATALOG_PUBLIC_ORIGIN =
  process.env.CATALOGO_PAGLEVE_PUBLIC_URL?.replace(/\/$/, '') ||
  'https://catalogo-pague-leve.vercel.app';

const TOKEN_PREFIX = 'v1';

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

/** @returns {Buffer} */
export function resolveConviteSecret() {
  const env = String(process.env.CATALOGO_PAGLEVE_CONVITE_SECRET || '').trim();
  if (env.length >= 16) return Buffer.from(env, 'utf8');
  if (fs.existsSync(SECRET_FILE)) {
    const raw = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (raw.length >= 16) return Buffer.from(raw, 'utf8');
  }
  return Buffer.alloc(0);
}

/** Cria ficheiro local gitignored se ainda não houver segredo. */
export function ensureLocalConviteSecret() {
  let sec = resolveConviteSecret();
  if (sec.length >= 16) return sec;
  sec = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, `${sec.toString('base64')}\n`, { mode: 0o600 });
  console.warn(
    `[pagleve-convite] Segredo gravado em ${path.relative(ROOT, SECRET_FILE)} — copie para Vercel: CATALOGO_PAGLEVE_CONVITE_SECRET`
  );
  return sec;
}

/**
 * @param {{ hours?: number, secret?: Buffer }} opts
 * @returns {{ token: string, expMs: number, url: string }}
 */
export function createConviteToken(opts = {}) {
  const hours = Math.max(1, Math.min(24 * 14, Number(opts.hours) || 24));
  const secret = opts.secret?.length ? opts.secret : ensureLocalConviteSecret();
  if (secret.length < 16) throw new Error('CATALOGO_PAGLEVE_CONVITE_SECRET em falta (mín. 16 caracteres).');
  const expMs = Date.now() + hours * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(6);
  const payload = `${TOKEN_PREFIX}.${expMs}.${b64url(nonce)}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest();
  const token = `${payload}.${b64url(sig).slice(0, 22)}`;
  const url = `${PAGLEVE_CATALOG_PUBLIC_ORIGIN}/acesso/${token}`;
  return { token, expMs, url, hours };
}

/**
 * @param {string} token
 * @param {Buffer | Uint8Array} secret
 * @returns {{ ok: boolean, expMs?: number, reason?: string }}
 */
export function verifyConviteToken(token, secret) {
  const t = String(token || '').trim();
  if (!t) return { ok: false, reason: 'missing' };
  const parts = t.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return { ok: false, reason: 'format' };
  const expMs = Number(parts[1]);
  if (!Number.isFinite(expMs)) return { ok: false, reason: 'format' };
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const sigGiven = parts[3];
  if (!secret?.length) return { ok: false, reason: 'secret' };
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest()).slice(0, 22);
  if (sig !== sigGiven) return { ok: false, reason: 'sig' };
  if (Date.now() > expMs) return { ok: false, reason: 'expired', expMs };
  return { ok: true, expMs };
}

export function formatExpiryPtBr(expMs) {
  return new Date(expMs).toLocaleString('pt-BR', {
    timeZone: 'America/Rio_Branco',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}