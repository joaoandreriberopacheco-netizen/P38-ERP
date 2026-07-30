import { p38PublicEnv, p38PublicEnvBool } from '@/lib/p38PublicEnv';

const PROVIDERS = {
  BASE44: 'base44',
  SUBPAYZE: 'subpayze',
  SUPABASE: 'supabase'
};

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase().trim() === 'true';
}

function nonEmptyString(value) {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
}

/**
 * `true` quando as envs Base44 estão **realmente** configuradas. Sem appId+serverUrl
 * o SDK Base44 não funciona — qualquer chamada vira fetch para `null/api/apps/null/...`
 * (foi exatamente o que estourava o PDV no Vercel).
 */
export function hasBase44Credentials() {
  return (
    nonEmptyString(p38PublicEnv('VITE_BASE44_APP_ID'))
    && nonEmptyString(p38PublicEnv('VITE_BASE44_BACKEND_URL'))
  );
}

/**
 * Credenciais Base44 disponíveis em runtime (localStorage após login Base44),
 * mesmo quando o build Vercel não embutiu VITE_BASE44_*.
 */
export function hasBase44RuntimeCredentials(appId, serverUrl) {
  return nonEmptyString(appId) && nonEmptyString(serverUrl);
}

/**
 * `true` quando temos URL + ANON_KEY do Supabase no build. Não inicializa client aqui;
 * usado apenas para autodetecção de provider.
 */
export function hasSupabaseCredentials() {
  return (
    nonEmptyString(p38PublicEnv('VITE_SUPABASE_URL'))
    && nonEmptyString(p38PublicEnv('VITE_SUPABASE_ANON_KEY'))
  );
}

export function resolveP38ProviderName() {
  const rawProvider = p38PublicEnv('VITE_P38_PROVIDER');
  const provider = rawProvider ? String(rawProvider).toLowerCase().trim() : '';

  if (provider === PROVIDERS.SUBPAYZE) {
    return PROVIDERS.SUBPAYZE;
  }
  if (provider === PROVIDERS.SUPABASE) {
    return PROVIDERS.SUPABASE;
  }
  if (provider === PROVIDERS.BASE44) {
    return PROVIDERS.BASE44;
  }

  // VarejoSync em produção usa Base44. Supabase só com VITE_P38_PROVIDER=supabase explícito
  // (repo a29-erp / migração). Não autodetectar Supabase — isso desviava gravações
  // (senhas, despesas, etc.) para um banco vazio no Vercel.
  return PROVIDERS.BASE44;
}

export function getP38Providers() {
  return PROVIDERS;
}

export function isP38SafeModeEnabled() {
  return p38PublicEnvBool('VITE_P38_SAFE_MODE', true);
}

export function isSubpayzeRolloutEnabled() {
  return p38PublicEnvBool('VITE_P38_ENABLE_SUBPAYZE', false);
}

export function isSubpayzeReadyForTraffic() {
  return p38PublicEnvBool('VITE_P38_SUBPAYZE_READY', false);
}

/**
 * Quando ativo, o app roda em "modo bypass": o boot não consulta Base44 (auth, public-settings)
 * e o `@base44/sdk` real nunca é instanciado (evita o analytics tracker que vaza fetch para
 * `null/api/apps/null/analytics/track/batch`).
 *
 * Regras (em ordem):
 *   1. provider=supabase → bypass=true (default).
 *   2. VITE_P38_BYPASS_BASE44 explícito → respeita.
 *   3. Sem credenciais Base44 → força bypass=true (proteção contra config incompleta no Vercel).
 *   4. Caso contrário → false (fluxo Base44 normal).
 */
export function isBase44BypassEnabled() {
  if (resolveP38ProviderName() === PROVIDERS.SUPABASE) {
    return p38PublicEnvBool('VITE_P38_BYPASS_BASE44', true);
  }
  const explicitBypass = p38PublicEnv('VITE_P38_BYPASS_BASE44');
  if (explicitBypass !== undefined) {
    return parseBooleanEnv(explicitBypass, false);
  }
  return false;
}

/**
 * Quando ativo, `auth.me()` tenta `supabase.auth.getUser()` em vez de devolver o mockUser.
 * Com `VITE_P38_PROVIDER=supabase`, o default é **true** (login real) — evita bypass admin em produção
 * quando `VITE_P38_USE_SUPABASE_AUTH` não entrou no bundle do Vercel.
 */
export function isSupabaseAuthEnabled() {
  const explicit = p38PublicEnv('VITE_P38_USE_SUPABASE_AUTH');
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return parseBooleanEnv(explicit, false);
  }
  return resolveP38ProviderName() === PROVIDERS.SUPABASE;
}

/**
 * Botão Google no /login — só quando o provider estiver activo no Supabase
 * (VITE_P38_ENABLE_GOOGLE_LOGIN=true após configurar Google Cloud + Supabase).
 */
export function isGoogleLoginEnabled() {
  return p38PublicEnvBool('VITE_P38_ENABLE_GOOGLE_LOGIN', false);
}
