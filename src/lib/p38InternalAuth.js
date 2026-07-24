/** Domínio sintético para auth.users (nunca mostrado ao utilizador). */
export const P38_LOGIN_EMAIL_DOMAIN = 'login.p38.internal';

/** Normaliza nome de utilizador para login interno. */
export function normalizeP38Login(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function isValidP38Login(login) {
  const n = normalizeP38Login(login);
  return n.length >= 2 && n.length <= 40;
}

/** Converte login visível → email técnico do Supabase Auth. */
export function loginToAuthEmail(login) {
  const n = normalizeP38Login(login);
  if (!n) return '';
  return `${n}@${P38_LOGIN_EMAIL_DOMAIN}`;
}

/** Extrai login a partir do email técnico (ou devolve null). */
export function loginFromAuthEmail(email) {
  if (!email) return null;
  const lower = String(email).trim().toLowerCase();
  const suffix = `@${P38_LOGIN_EMAIL_DOMAIN}`;
  if (!lower.endsWith(suffix)) return null;
  return lower.slice(0, -suffix.length);
}

/** Aceita payload { login, password } ou legado { email, password }. */
export function resolveLoginCredentials(payload = {}) {
  const login = normalizeP38Login(payload.login || payload.username || '');
  if (login) {
    return { login, email: loginToAuthEmail(login), password: payload.password };
  }
  const email = String(payload.email || '').trim().toLowerCase();
  if (email) {
    const fromInternal = loginFromAuthEmail(email);
    return {
      login: fromInternal || email.split('@')[0] || '',
      email,
      password: payload.password,
    };
  }
  return { login: '', email: '', password: payload.password };
}
