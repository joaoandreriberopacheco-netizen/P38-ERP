export const P38_LOGIN_EMAIL_DOMAIN = 'login.p38.internal';

export function normalizeLogin(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function isValidLogin(login: string): boolean {
  return login.length >= 2 && login.length <= 40;
}

export function loginToAuthEmail(login: string): string {
  return `${normalizeLogin(login)}@${P38_LOGIN_EMAIL_DOMAIN}`;
}

export function loginFromAuthEmail(email?: string | null): string | null {
  if (!email) return null;
  const lower = email.trim().toLowerCase();
  const suffix = `@${P38_LOGIN_EMAIL_DOMAIN}`;
  if (!lower.endsWith(suffix)) return null;
  return lower.slice(0, -suffix.length);
}

export function randomPassword(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email operacional do utilizador (não o sintético @login.p38.internal). */
export function resolveUsuarioOperationalEmail(row: {
  email?: string | null;
  dados?: Record<string, unknown> | null;
}): string | null {
  const candidates = [row.email, row.dados?.email];
  for (const raw of candidates) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) continue;
    if (email.endsWith(`@${P38_LOGIN_EMAIL_DOMAIN}`)) continue;
    return email;
  }
  return null;
}

export function maskOperationalEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}
