/**
 * Cache de sessão para dados do usuário + perfil de acesso.
 * Armazena em memória (módulo singleton) para sobreviver a navegações SPA,
 * e em sessionStorage para sobreviver a reloads.
 * TTL: 10 minutos.
 */

const SESSION_KEY = 'p38_user_session';
const TTL = 10 * 60 * 1000;

/** @type {{ data: { user: object, perfilDeAcesso: object|null }, timestamp: number } | null} */
let memCacheEntry = null;

function readStorage() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > TTL) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { data: parsed.data, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

function writeStorage(data) {
  const timestamp = Date.now();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ data, timestamp }));
  } catch {
    // Falha silenciosa
  }
  return timestamp;
}

export function getCachedUserSession() {
  if (memCacheEntry && Date.now() - memCacheEntry.timestamp <= TTL) {
    return memCacheEntry.data;
  }
  const stored = readStorage();
  if (stored) {
    memCacheEntry = stored;
    return stored.data;
  }
  memCacheEntry = null;
  return null;
}

/** Sessão em cache ainda válida (evita auth.me + perfil no LCP). */
export function isCachedUserSessionFresh() {
  if (memCacheEntry && Date.now() - memCacheEntry.timestamp <= TTL) {
    return Boolean(memCacheEntry.data?.user);
  }
  const stored = readStorage();
  if (stored?.data?.user) {
    memCacheEntry = stored;
    return true;
  }
  return false;
}

export function setCachedUserSession(user, perfilDeAcesso) {
  const data = { user, perfilDeAcesso };
  const timestamp = writeStorage(data);
  memCacheEntry = { data, timestamp };
}

export function clearUserSessionCache() {
  memCacheEntry = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Falha silenciosa
  }
}