/**
 * Fonte única para resolver nomes de secrets P38 (aliases → nome canónico).
 * Não imprime valores — só presença e coerência entre variáveis.
 */
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

/** Project ref canónico do P38 em produção (Supabase). */
export const P38_CANONICAL_PROJECT_REF = 'zhonvxkkqabfdyehyxpu';

/** @typedef {'github' | 'vercel' | 'local' | 'cloud-agent'} SecretContext */

/**
 * @param {string | undefined} value
 * @returns {string}
 */
function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Extrai metadados seguros de uma connection string (sem expor password).
 * @param {string | undefined} databaseUrl
 */
export function parseDatabaseUrlMeta(databaseUrl) {
  if (!databaseUrl) {
    return {
      ok: false,
      projectRef: null,
      host: null,
      user: null,
      port: null,
      fingerprint: null,
      parseError: 'vazio',
    };
  }

  const trimmed = databaseUrl.trim();
  const hadQuotes = /^['"]/.test(trimmed) || /['"]$/.test(trimmed);
  const normalized = trimmed.replace(/^['"]|['"]$/g, '');

  try {
    const url = new URL(normalized.replace(/^postgresql:/, 'postgres:'));
    const user = url.username || null;
    const host = url.hostname || null;
    const port = url.port || '5432';
    const userRef = user?.match(/^postgres\.(.+)$/)?.[1] || null;
    const projectRef = userRef || parseProjectRefFromHost(host);
    const fingerprint = `${host}|${user}|${port}`;

    return {
      ok: true,
      projectRef,
      host,
      user,
      port,
      fingerprint,
      hasPassword: Boolean(url.password),
      hadQuotes,
      hadOuterWhitespace: trimmed !== databaseUrl,
      parseError: null,
    };
  } catch (err) {
    return {
      ok: false,
      projectRef: null,
      host: null,
      user: null,
      port: null,
      fingerprint: null,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * @param {string | null | undefined} host
 * @returns {string | null}
 */
function parseProjectRefFromHost(host) {
  if (!host) return null;
  const pooler = host.match(/^postgres\.([^.]+)\./);
  if (pooler) return pooler[1];
  if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
    return host.slice(3, -'.supabase.co'.length);
  }
  const direct = host.match(/^([^.]+)\.supabase\.co$/);
  return direct ? direct[1] : null;
}

/**
 * @param {string | undefined} databaseUrl
 * @returns {string | null}
 */
export function parseProjectRefFromDatabaseUrl(databaseUrl) {
  const meta = parseDatabaseUrlMeta(databaseUrl);
  return meta.projectRef;
}

/**
 * @param {string | undefined} url
 * @returns {string | null}
 */
export function parseProjectRefFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    return new URL(url.trim()).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Secret ambíguo legado do Cursor Cloud (`supabase` minúsculas).
 * @returns {{ pat?: string, databaseUrl?: string, ambiguous: boolean }}
 */
function resolveLegacySupabaseSecret() {
  const raw = trim(process.env.supabase);
  if (!raw) return { ambiguous: false };
  const isPat = raw.startsWith('sbp_');
  const isDb = raw.startsWith('postgres');
  if (isPat && isDb) return { ambiguous: true };
  if (isPat) return { pat: raw, ambiguous: false };
  if (isDb) return { databaseUrl: raw, ambiguous: false };
  return { ambiguous: true };
}

/**
 * Resolve todas as credenciais conhecidas do ecossistema P38.
 * @returns {{
 *   viteSupabaseUrl: string;
 *   viteSupabaseAnonKey: string;
 *   databaseUrl: string;
 *   accessToken: string;
 *   serviceRoleKey: string;
 *   projectRef: string | null;
 *   p38AuthUrl: string;
 *   vercelToken: string;
 *   vercelOrgId: string;
 *   vercelProjectId: string;
 *   aliasesUsed: string[];
 *   legacySupabaseAmbiguous: boolean;
 * }}
 */
export function resolveP38Secrets() {
  const legacy = resolveLegacySupabaseSecret();
  const aliasesUsed = [];

  let viteSupabaseUrl =
    trim(process.env.VITE_SUPABASE_URL) || trim(process.env.SUPABASE_URL);
  if (!trim(process.env.VITE_SUPABASE_URL) && trim(process.env.SUPABASE_URL)) {
    aliasesUsed.push('SUPABASE_URL→VITE_SUPABASE_URL');
  }

  let viteSupabaseAnonKey =
    trim(process.env.VITE_SUPABASE_ANON_KEY) || trim(process.env.SUPABASE_ANON_KEY);
  if (!trim(process.env.VITE_SUPABASE_ANON_KEY) && trim(process.env.SUPABASE_ANON_KEY)) {
    aliasesUsed.push('SUPABASE_ANON_KEY→VITE_SUPABASE_ANON_KEY');
  }

  let databaseUrl = trim(process.env.DATABASE_URL) || legacy.databaseUrl || '';
  if (!trim(process.env.DATABASE_URL) && legacy.databaseUrl) {
    aliasesUsed.push('supabase→DATABASE_URL');
  }

  let accessToken =
    trim(process.env.SUPABASE_ACCESS_TOKEN) ||
    trim(process.env.SUPABASE_TOKEN) ||
    legacy.pat ||
    '';
  if (!trim(process.env.SUPABASE_ACCESS_TOKEN)) {
    if (trim(process.env.SUPABASE_TOKEN)) aliasesUsed.push('SUPABASE_TOKEN→SUPABASE_ACCESS_TOKEN');
    if (legacy.pat && !trim(process.env.SUPABASE_TOKEN)) aliasesUsed.push('supabase→SUPABASE_ACCESS_TOKEN');
  }

  const serviceRoleKey = trim(process.env.SUPABASE_SERVICE_ROLE_KEY);

  let projectRef =
    trim(process.env.SUPABASE_PROJECT_REF) ||
    parseProjectRefFromSupabaseUrl(viteSupabaseUrl) ||
    parseProjectRefFromDatabaseUrl(databaseUrl) ||
    null;

  let p38AuthUrl = trim(process.env.P38_AUTH_URL);
  if (!p38AuthUrl && viteSupabaseUrl) {
    p38AuthUrl = `${viteSupabaseUrl.replace(/\/$/, '')}/functions/v1/p38-auth`;
  }

  return {
    viteSupabaseUrl,
    viteSupabaseAnonKey,
    databaseUrl,
    accessToken,
    serviceRoleKey,
    projectRef,
    p38AuthUrl,
    vercelToken: trim(process.env.VERCEL_TOKEN),
    vercelOrgId: trim(process.env.VERCEL_ORG_ID),
    vercelProjectId: trim(process.env.VERCEL_PROJECT_ID),
    aliasesUsed,
    legacySupabaseAmbiguous: legacy.ambiguous,
  };
}

/**
 * @param {string} name
 * @param {string} value
 */
export function maskPresence(name, value) {
  return value ? `${name}=ok` : `${name}=EM FALTA`;
}

/**
 * Verifica se DATABASE_URL e VITE_SUPABASE_URL apontam ao mesmo projecto.
 * @param {ReturnType<typeof resolveP38Secrets>} secrets
 */
export function checkProjectRefAlignment(secrets) {
  const refFromVite = parseProjectRefFromSupabaseUrl(secrets.viteSupabaseUrl);
  const refFromDb = parseProjectRefFromDatabaseUrl(secrets.databaseUrl);
  const issues = [];

  if (refFromVite && refFromDb && refFromVite !== refFromDb) {
    issues.push({
      level: 'error',
      code: 'REF_MISMATCH',
      message: `DATABASE_URL (${refFromDb}) ≠ VITE_SUPABASE_URL (${refFromVite}) — devem ser o MESMO projecto Supabase.`,
    });
  } else if (!refFromVite && refFromDb && refFromDb !== P38_CANONICAL_PROJECT_REF) {
    issues.push({
      level: 'error',
      code: 'WRONG_SUPABASE_PROJECT',
      message:
        `DATABASE_URL aponta para o projecto Supabase "${refFromDb}", mas o P38 canónico é "${P38_CANONICAL_PROJECT_REF}". ` +
        'O secret guardado no Cloud parece ser de outro projecto — copiar no chat funciona porque aí colas a URL correcta.',
    });
  }

  const dbMeta = parseDatabaseUrlMeta(secrets.databaseUrl);
  if (dbMeta.ok && dbMeta.hadQuotes) {
    issues.push({
      level: 'warn',
      code: 'DATABASE_URL_QUOTED',
      message:
        'DATABASE_URL tem aspas à volta — remove aspas ao gravar no painel Cursor (só o valor, sem " ").',
    });
  }

  if (secrets.projectRef && refFromVite && secrets.projectRef !== refFromVite) {
    issues.push({
      level: 'error',
      code: 'REF_EXPLICIT_MISMATCH',
      message: `SUPABASE_PROJECT_REF (${secrets.projectRef}) ≠ VITE_SUPABASE_URL (${refFromVite}).`,
    });
  }

  if (secrets.legacySupabaseAmbiguous) {
    issues.push({
      level: 'warn',
      code: 'LEGACY_SUPABASE_AMBIGUOUS',
      message:
        'Secret legado `supabase` (minúsculas) não é reconhecível — use SUPABASE_ACCESS_TOKEN ou DATABASE_URL com nomes explícitos.',
    });
  }

  if (secrets.aliasesUsed.length) {
    issues.push({
      level: 'warn',
      code: 'DEPRECATED_ALIAS',
      message: `Aliases em uso: ${secrets.aliasesUsed.join(', ')}. Prefira os nomes canónicos (ver docs/migration/P38_SECRETS_CANONICOS.md).`,
    });
  }

  return { refFromVite, refFromDb, issues };
}
