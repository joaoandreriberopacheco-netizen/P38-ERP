/**
 * Lê variáveis públicas em Vite (`VITE_*`) ou Next (`NEXT_PUBLIC_*`).
 * Usado durante a migração paralela — mesma lógica nos dois builds.
 *
 * Next.js só embute no bundle do browser referências **literais** a
 * `process.env.NEXT_PUBLIC_*` — `process.env[chave]` dinâmico fica vazio no cliente.
 */
const P38_PUBLIC_ENV = {
  VITE_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  VITE_P38_PROVIDER: process.env.NEXT_PUBLIC_P38_PROVIDER,
  VITE_P38_BYPASS_BASE44: process.env.NEXT_PUBLIC_P38_BYPASS_BASE44,
  VITE_P38_USE_SUPABASE_AUTH: process.env.NEXT_PUBLIC_P38_USE_SUPABASE_AUTH,
  VITE_P38_ENABLE_GOOGLE_LOGIN: process.env.NEXT_PUBLIC_P38_ENABLE_GOOGLE_LOGIN,
  VITE_P38_SAFE_MODE: process.env.NEXT_PUBLIC_P38_SAFE_MODE,
  VITE_P38_ENABLE_SUBPAYZE: process.env.NEXT_PUBLIC_P38_ENABLE_SUBPAYZE,
  VITE_P38_SUBPAYZE_READY: process.env.NEXT_PUBLIC_P38_SUBPAYZE_READY,
  VITE_USE_SUPABASE_ENTITIES: process.env.NEXT_PUBLIC_USE_SUPABASE_ENTITIES,
  VITE_BASE44_APP_ID: process.env.NEXT_PUBLIC_BASE44_APP_ID,
  VITE_BASE44_BACKEND_URL: process.env.NEXT_PUBLIC_BASE44_BACKEND_URL,
  VITE_SUBPAYZE_API_URL: process.env.NEXT_PUBLIC_SUBPAYZE_API_URL,
  VITE_SUBPAYZE_API_KEY: process.env.NEXT_PUBLIC_SUBPAYZE_API_KEY,
  VITE_SUBPAYZE_WEBHOOK_SECRET: process.env.NEXT_PUBLIC_SUBPAYZE_WEBHOOK_SECRET,
  VITE_FINANCEIRO_GATE_PASSWORD: process.env.NEXT_PUBLIC_FINANCEIRO_GATE_PASSWORD,
  VITE_OPERACAO_AUTH_ENABLED: process.env.NEXT_PUBLIC_OPERACAO_AUTH_ENABLED,
  VITE_OPERACAO_AUTH_PHOTO_ENABLED: process.env.NEXT_PUBLIC_OPERACAO_AUTH_PHOTO_ENABLED,
  VITE_PEDIDO_COMPRA_SAVE_AUTH_PIN: process.env.NEXT_PUBLIC_PEDIDO_COMPRA_SAVE_AUTH_PIN,
  VITE_HIERARQUIA_PORTAL_ENABLED: process.env.NEXT_PUBLIC_HIERARQUIA_PORTAL_ENABLED,
  VITE_CADASTRO_PRODUTO_V2_ENABLED: process.env.NEXT_PUBLIC_CADASTRO_PRODUTO_V2_ENABLED,
  VITE_MODELO_CATALOGO_ENABLED: process.env.NEXT_PUBLIC_MODELO_CATALOGO_ENABLED,
  VITE_P38_BYPASS_USER_JSON: process.env.NEXT_PUBLIC_P38_BYPASS_USER_JSON,
  VITE_P38_BYPASS_USER_ID: process.env.NEXT_PUBLIC_P38_BYPASS_USER_ID,
  VITE_P38_BYPASS_USER_EMAIL: process.env.NEXT_PUBLIC_P38_BYPASS_USER_EMAIL,
  VITE_P38_BYPASS_USER_NAME: process.env.NEXT_PUBLIC_P38_BYPASS_USER_NAME,
  VITE_P38_BYPASS_USER_ROLE: process.env.NEXT_PUBLIC_P38_BYPASS_USER_ROLE,
  VITE_P38_BYPASS_USER_PERFIL_ID: process.env.NEXT_PUBLIC_P38_BYPASS_USER_PERFIL_ID,
};

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

function normalizeEnvValue(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

/** @param {string} viteKey Ex.: `VITE_SUPABASE_URL` */
export function p38PublicEnv(viteKey) {
  const viteName = viteKey.startsWith('VITE_') ? viteKey : `VITE_${viteKey}`;
  const nextName = viteName.replace(/^VITE_/, 'NEXT_PUBLIC_');

  return (
    normalizeEnvValue(P38_PUBLIC_ENV[viteName])
    ?? readProcessEnv(nextName)
    ?? readProcessEnv(viteName)
    ?? readViteEnv(viteName)
  );
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
