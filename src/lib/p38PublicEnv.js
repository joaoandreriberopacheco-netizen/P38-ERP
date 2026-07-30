/**
 * Lê variáveis públicas em Vite (`VITE_*`) ou Next (`NEXT_PUBLIC_*`).
 * Usado durante a migração paralela — mesma lógica nos dois builds.
 */
function readProcessEnv(key) {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const value = process.env[key];
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function readViteEnv(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
      const value = import.meta.env[key];
      if (value === undefined || value === null || value === '') return undefined;
      return value;
    }
  } catch {
    /* Next SSR pode não expor import.meta.env */
  }
  return undefined;
}

/** @param {string} viteKey Ex.: `VITE_SUPABASE_URL` */
export function p38PublicEnv(viteKey) {
  const viteName = viteKey.startsWith('VITE_') ? viteKey : `VITE_${viteKey}`;
  const nextName = viteName.replace(/^VITE_/, 'NEXT_PUBLIC_');
  return readProcessEnv(nextName) ?? readProcessEnv(viteName) ?? readViteEnv(viteName);
}

/** @param {string} viteKey @param {boolean} [defaultValue] */
export function p38PublicEnvBool(viteKey, defaultValue = false) {
  const value = p38PublicEnv(viteKey);
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase().trim() === 'true';
}

export function isP38Dev() {
  if (readProcessEnv('NODE_ENV') === 'development') return true;
  try {
    return import.meta.env?.DEV === true;
  } catch {
    return false;
  }
}
