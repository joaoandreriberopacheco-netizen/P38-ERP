import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { buildSupabaseOAuthCallbackUrl } from '@/lib/supabaseAuth';
import { loginFromAuthEmail, loginToAuthEmail, normalizeP38Login, resolveLoginCredentials } from '@/lib/p38InternalAuth';
import { p38PublicEnv } from '@/lib/p38PublicEnv';
import { createSupabaseEntityLayer } from './supabaseEntityLayer';
import { isSupabaseAuthEnabled } from './providers';
import { invokeP38Core } from '@/lib/p38CoreInvoke';
import { invokeP38EdgeFunction } from '@/lib/p38EdgeFunctionInvoke';

const STORAGE_KEYS = {
  bypassUser: 'p38_bypass_user_v1',
  legacyAccessToken: 'base44_access_token'
};

const DEFAULT_BYPASS_USER = Object.freeze({
  id: 'p38-bypass-user',
  email: 'admin@varejosync.local',
  full_name: 'Administrador (bypass)',
  role: 'admin',
  perfil_acesso_id: null,
  is_bypass: true
});

function readBypassUserFromEnv() {
  const raw = p38PublicEnv('VITE_P38_BYPASS_USER_JSON');
  if (raw) {
    try {
      return { ...DEFAULT_BYPASS_USER, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('[P38][supabaseAdapter] VITE_P38_BYPASS_USER_JSON inválido, usando default.', err);
    }
  }
  return {
    ...DEFAULT_BYPASS_USER,
    ...(p38PublicEnv('VITE_P38_BYPASS_USER_ID') ? { id: p38PublicEnv('VITE_P38_BYPASS_USER_ID') } : {}),
    ...(p38PublicEnv('VITE_P38_BYPASS_USER_EMAIL') ? { email: p38PublicEnv('VITE_P38_BYPASS_USER_EMAIL') } : {}),
    ...(p38PublicEnv('VITE_P38_BYPASS_USER_NAME') ? { full_name: p38PublicEnv('VITE_P38_BYPASS_USER_NAME') } : {}),
    ...(p38PublicEnv('VITE_P38_BYPASS_USER_ROLE') ? { role: p38PublicEnv('VITE_P38_BYPASS_USER_ROLE') } : {}),
    ...(p38PublicEnv('VITE_P38_BYPASS_USER_PERFIL_ID')
      ? { perfil_acesso_id: p38PublicEnv('VITE_P38_BYPASS_USER_PERFIL_ID') }
      : {})
  };
}

function readPersistedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.bypassUser);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(STORAGE_KEYS.bypassUser, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.bypassUser);
    }
  } catch {
    // noop — storage indisponível (sandbox/private mode)
  }
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Mesmo flatten que `decorateRow` em supabaseEntityLayer — promove `dados` jsonb e datas.
 */
function flattenUsuarioRow(row) {
  if (!row || typeof row !== 'object') return null;
  const out = { ...row };
  const obKey = 'dados';
  if (obKey in out && out[obKey] && typeof out[obKey] === 'object') {
    const blob = out[obKey];
    delete out[obKey];
    for (const [k, v] of Object.entries(blob)) {
      if (!(k in out)) out[k] = v;
    }
  }
  if ('created_at' in out && out.created_at != null) out.created_date = out.created_at;
  if ('updated_at' in out && out.updated_at != null) out.updated_date = out.updated_at;
  return out;
}

/**
 * Liga auth.users à linha `public.usuario`: (1) email case-insensitive; (2) nickname nos metadados.
 * O `id` da linha operacional é o que o P38 usa em FKs (vendedor_id, caixas, etc.).
 */
async function queryUsuarioRows(supabase, column, op, value, limit = 5) {
  let q = supabase.from('usuario').select('*').limit(limit);
  if (op === 'ilike') q = q.ilike(column, value);
  else if (op === 'eq') q = q.eq(column, value);
  return q;
}

async function fetchUsuarioOperacional(supabase, authUser) {
  const authId = authUser?.id;
  if (authId) {
    const { data: byId, error: byIdErr } = await supabase.from('usuario').select('*').eq('id', authId).maybeSingle();
    if (byIdErr) {
      console.warn('[P38][supabaseAdapter] usuario por id:', byIdErr.message);
    } else if (byId) {
      return flattenUsuarioRow(byId);
    }
  }

  const loginFromMeta = normalizeP38Login(
    authUser?.user_metadata?.login ||
      loginFromAuthEmail(authUser?.email) ||
      authUser?.user_metadata?.nickname
  );
  if (loginFromMeta) {
    let { data: rowsLogin, error: loginErr } = await queryUsuarioRows(supabase, 'login', 'ilike', loginFromMeta);
    if (loginErr && /column.*\.login.*does not exist/i.test(loginErr.message)) {
      ({ data: rowsLogin, error: loginErr } = await queryUsuarioRows(supabase, 'dados->>login', 'ilike', loginFromMeta));
    }
    if (loginErr) {
      console.warn('[P38][supabaseAdapter] usuario por login:', loginErr.message);
    } else if (rowsLogin?.length >= 1) {
      return flattenUsuarioRow(rowsLogin[0]);
    }
  }

  const norm = normalizeEmail(authUser?.email);
  if (norm) {
    let { data: rows, error } = await queryUsuarioRows(supabase, 'email', 'ilike', norm);
    if (error && /column.*\.email.*does not exist/i.test(error.message)) {
      ({ data: rows, error } = await queryUsuarioRows(supabase, 'dados->>email', 'ilike', norm));
    }
    if (error) {
      console.warn('[P38][supabaseAdapter] usuario por email:', error.message);
    } else if (rows?.length >= 1) {
      if (rows.length > 1) {
        console.warn('[P38][supabaseAdapter] várias linhas em usuario para o mesmo email; usando a primeira.');
      }
      return flattenUsuarioRow(rows[0]);
    }
  }

  const nickRaw =
    authUser.user_metadata?.nickname ||
    authUser.user_metadata?.preferred_username ||
    authUser.user_metadata?.user_name;
  const nickTrim = nickRaw != null ? String(nickRaw).trim() : '';
  if (nickTrim) {
    let { data: rows2, error: err2 } = await queryUsuarioRows(supabase, 'nickname', 'eq', nickTrim);
    if (err2 && /column.*\.nickname.*does not exist/i.test(err2.message)) {
      ({ data: rows2, error: err2 } = await queryUsuarioRows(supabase, 'dados->>nickname', 'eq', nickTrim));
    }
    if (err2) {
      console.warn('[P38][supabaseAdapter] usuario por nickname:', err2.message);
      return null;
    }
    if (rows2?.length >= 1) {
      if (rows2.length > 1) {
        console.warn('[P38][supabaseAdapter] várias linhas em usuario para o mesmo nickname; usando a primeira.');
      }
      return flattenUsuarioRow(rows2[0]);
    }
  }

  return null;
}

function buildAuth(supabase) {
  const useSupabaseAuth = isSupabaseAuthEnabled() && Boolean(supabase);

  async function meViaSupabase() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const err = new Error(error.message || 'Falha ao consultar usuário Supabase.');
      err.status = error.status || 401;
      throw err;
    }
    const u = data?.user;
    if (!u) {
      const err = new Error('Sessão Supabase ausente.');
      err.status = 401;
      throw err;
    }

    const authShape = {
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email,
      role: u.user_metadata?.role || u.app_metadata?.role || 'user',
      perfil_acesso_id: u.user_metadata?.perfil_acesso_id || null,
      created_date: u.created_at,
      supabase_auth_user_id: u.id,
      raw: u
    };

    const operacional = await fetchUsuarioOperacional(supabase, u);
    if (!operacional) {
      return authShape;
    }

    return {
      ...authShape,
      ...operacional,
      id: operacional.id,
      email: operacional.email || authShape.email,
      full_name: operacional.full_name || authShape.full_name,
      role: operacional.role || authShape.role,
      perfil_acesso_id:
        operacional.perfil_acesso_id != null && operacional.perfil_acesso_id !== ''
          ? operacional.perfil_acesso_id
          : authShape.perfil_acesso_id,
      supabase_auth_user_id: u.id,
      raw: u
    };
  }

  async function meViaBypass() {
    const persisted = readPersistedUser();
    if (persisted) return persisted;
    const fromEnv = readBypassUserFromEnv();
    persistUser(fromEnv);
    return fromEnv;
  }

  return {
    async me() {
      if (useSupabaseAuth) {
        return await meViaSupabase();
      }
      return meViaBypass();
    },
    async login(payload = {}) {
      if (useSupabaseAuth) {
        const { login, email, password } = resolveLoginCredentials(payload);
        if (!email || !password) {
          throw new Error('Informe usuário e senha.');
        }
        persistUser(null);

        const trySignIn = async (authEmail) => {
          return supabase.auth.signInWithPassword({ email: authEmail, password });
        };

        let { data, error } = await trySignIn(email);

        // Legado: contas antigas ainda com email Gmail (pré-migração 028).
        if (error && login && email.endsWith('@login.p38.internal')) {
          const legacyGuess = `${login}@gmail.com`;
          if (legacyGuess !== email) {
            const retry = await trySignIn(legacyGuess);
            if (!retry.error) {
              data = retry.data;
              error = null;
            }
          }
        }

        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            throw new Error(
              'Utilizador ou senha incorrectos. Se ainda não definiu senha, use /ativar-acesso.'
            );
          }
          throw error;
        }
        return data;
      }
      const merged = { ...readBypassUserFromEnv(), ...readPersistedUser(), ...payload };
      persistUser(merged);
      return merged;
    },
    async loginWithGoogle(returnPath = '/') {
      if (!useSupabaseAuth || !supabase) {
        throw new Error('Login com Google indisponível: autenticação Supabase não está activa.');
      }
      persistUser(null);
      const redirectTo = buildSupabaseOAuthCallbackUrl(returnPath);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
      return data;
    },
    async logout(returnUrl) {
      if (useSupabaseAuth) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('[P38][supabaseAdapter] supabase.signOut falhou', err);
        }
      }
      persistUser(null);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(STORAGE_KEYS.legacyAccessToken);
        } catch {
          // ignore
        }
        if (returnUrl) {
          window.location.href = returnUrl;
        }
      }
    },
    redirectToLogin(returnUrl) {
      if (typeof window === 'undefined') return;
      if (window.location.pathname === '/login') return;
      if (window.location.pathname === '/ativar-acesso') return;
      const params = new URLSearchParams();
      if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
        params.set('returnUrl', returnUrl);
      } else if (returnUrl && returnUrl.startsWith(window.location.origin)) {
        const path = returnUrl.slice(window.location.origin.length) || '/';
        params.set('returnUrl', path);
      }
      const qs = params.toString();
      window.location.href = qs ? `/login?${qs}` : '/login';
    },
    /**
     * Compat com `User.loginWithRedirect(returnUrl)` do Base44 SDK.
     * Em modo bypass apenas garante que existe um usuário persistido e devolve.
     */
    async loginWithRedirect(returnUrl) {
      if (useSupabaseAuth) {
        if (typeof window !== 'undefined') {
          if (window.location.pathname === '/login') return null;
          window.location.href = returnUrl || '/login';
        }
        return null;
      }
      const merged = { ...readBypassUserFromEnv(), ...readPersistedUser() };
      persistUser(merged);
      return merged;
    },
    /**
     * Compat com `User.updateMyUserData(patch)` do Base44 SDK.
     * Atualiza o usuário persistido localmente; em supabase-auth também atualiza
     * `user_metadata` quando possível.
     */
    async updateMe(patch = {}) {
      if (useSupabaseAuth) {
        try {
          const { data, error } = await supabase.auth.updateUser({ data: patch });
          if (error) throw error;
          return data?.user || null;
        } catch (err) {
          console.warn('[P38][supabaseAdapter] updateUser falhou', err);
          throw err;
        }
      }
      const current = readPersistedUser() || readBypassUserFromEnv();
      const next = { ...current, ...patch };
      persistUser(next);
      return next;
    },
    setBypassUser(user) {
      persistUser(user);
      return user;
    },
    isUsingSupabaseAuth() {
      return useSupabaseAuth;
    }
  };
}

async function resolveSupabaseFunctionErrorMessage(error, name) {
  let message = error?.message || `Falha ao invocar Edge Function "${name}".`;
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) message = String(body.error);
      else if (body?.message) message = String(body.message);
    } catch {
      // corpo já consumido ou inválido
    }
  }
  if (/not\.found|404/i.test(message)) {
    return `Função "${name}" ainda não foi migrada para Supabase Edge Functions.`;
  }
  if (/não autenticado|missing authorization|unauthorized/i.test(message)) {
    return 'Sessão expirada ou ausente. Saia e entre novamente em /login.';
  }
  return message;
}

function buildFunctions(supabase) {
  return {
    async invoke(name, body, _requestContext = {}) {
      if (!name) {
        throw new Error('P38 supabaseAdapter: functions.invoke requer nome da função.');
      }
      if (!supabase) {
        const err = new Error(
          `Função "${name}" indisponível: Supabase não configurado (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).`
        );
        err.code = 'P38_SUPABASE_NOT_CONFIGURED';
        throw err;
      }
      // Proxy same-origin (/api/p38-edge/*) — evita FunctionsFetchError no browser.
      return invokeP38EdgeFunction(name, body, { supabase });
    }
  };
}

function buildIntegrations(supabase) {
  const bucket = p38PublicEnv('VITE_SUPABASE_ANEXOS_BUCKET') || 'anexos';

  function normalizeInvokeLlmResponse(data) {
    if (data == null) return data;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    if (typeof data !== 'object') return data;
    if (data.response_json && typeof data.response_json === 'object') return data.response_json;
    if (data.response && typeof data.response === 'object') return data.response;
    if (data.data && typeof data.data === 'object') return data.data;
    if (data.result != null) {
      if (typeof data.result === 'object') return data.result;
      if (typeof data.result === 'string') {
        try {
          return JSON.parse(data.result);
        } catch {
          return data;
        }
      }
    }
    return data;
  }

  function formatStorageUploadError(error) {
    const message = error?.message || String(error);
    if (/bucket not found/i.test(message)) {
      return (
        `Bucket de anexos "${bucket}" não existe no Supabase Storage. ` +
        'Aplique a migração supabase/migrations/045_storage_buckets.sql (npm run supabase:deploy) ' +
        'ou crie o bucket no Dashboard → Storage.'
      );
    }
    return message;
  }

  async function invokeCore(op, payload) {
    if (!supabase) throw new Error('Supabase não configurado para integrações Core');

    if (typeof window !== 'undefined') {
      const data = await invokeP38Core({ op, ...payload });
      return data;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionToken = sessionData?.session?.access_token;
    const invokeOptions = {
      body: { op, ...payload },
      ...(sessionToken
        ? { headers: { Authorization: `Bearer ${sessionToken}` } }
        : {}),
    };
    const { data, error } = await supabase.functions.invoke('p38-core', invokeOptions);
    if (error) {
      const message = await resolveSupabaseFunctionErrorMessage(error, `p38-core.${op}`);
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  return {
    Core: {
      async InvokeLLM(payload) {
        const data = await invokeCore('InvokeLLM', payload);
        return normalizeInvokeLlmResponse(data);
      },
      async SendEmail(payload) {
        return invokeCore('SendEmail', payload);
      },
      async GenerateImage(payload) {
        return invokeCore('GenerateImage', payload);
      },
      async CreateFileSignedUrl(payload) {
        return invokeCore('CreateFileSignedUrl', payload);
      },
      async UploadPrivateFile({ file, path }) {
        if (!supabase) throw new Error('Supabase não configurado');
        const name = path || `uploads/${crypto.randomUUID()}_${file.name || 'file'}`;
        const contentType = file.type || 'application/octet-stream';
        const { error } = await supabase.storage.from(bucket).upload(name, file, {
          upsert: true,
          contentType,
        });
        if (error) throw new Error(formatStorageUploadError(error));
        const { data } = supabase.storage.from(bucket).getPublicUrl(name);
        return { file_url: data.publicUrl };
      },
      async UploadFile({ file, path }) {
        return buildIntegrations(supabase).Core.UploadPrivateFile({ file, path });
      },
      async ExtractDataFromUploadedFile(payload) {
        const { data, error } = await supabase.functions.invoke('extract-data-file', { body: payload });
        if (error) throw new Error(error.message || 'ExtractDataFromUploadedFile falhou');
        return data;
      },
    },
  };
}

function buildAppLogs() {
  return {
    async logUserInApp() {
      // No-op: telemetria do Base44 desligada.
    }
  };
}

/**
 * Quando `VITE_P38_PROVIDER=supabase` mas faltam URL/anon key no `.env.local`, não usar o stub
 * Base44 (mensagem confusa). Auth em modo bypass + leituras vazias para o shell local abrir.
 */
function createMissingSupabaseEnvEntitiesProxy() {
  const hint =
    '[P38] Cria legacy/varejosync/.env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ver .env.casa-nova.example). Reinicia npm run dev.';
  const emptyList = async () => [];
  const rejectWrite = async () => {
    throw new Error(hint);
  };
  return new Proxy(
    {},
    {
      get() {
        return {
          list: emptyList,
          filter: emptyList,
          get: async () => null,
          create: rejectWrite,
          update: rejectWrite,
          delete: rejectWrite
        };
      }
    }
  );
}

/**
 * Cliente legado para desenvolvimento local sem `.env.local` completo — evita stub Base44 em auth.me().
 */
export function createLegacyClientWithoutSupabaseEnv() {
  return {
    name: 'p38-supabase-env-missing-local',
    supabase: null,
    auth: buildAuth(null),
    entities: createMissingSupabaseEnvEntitiesProxy(),
    functions: buildFunctions(null),
    integrations: buildIntegrations(null),
    appLogs: buildAppLogs()
  };
}

/**
 * Pseudo-cliente compatível com o shape do `@base44/sdk` consumido em todo o app.
 * Substitui `p38.legacyClient` quando provider === 'supabase'.
 */
export function createSupabaseLegacyClient() {
  const supabase = isSupabaseBrowserConfigured() ? getSupabaseBrowserClient() : null;
  const entities = createSupabaseEntityLayer(null, supabase);
  const auth = buildAuth(supabase);
  const functions = buildFunctions(supabase);
  const integrations = buildIntegrations(supabase);
  const appLogs = buildAppLogs();

  return {
    name: 'p38-supabase-legacy-client',
    supabase,
    auth,
    entities,
    functions,
    integrations,
    appLogs
  };
}

export function createSupabaseAdapter() {
  const configured = isSupabaseBrowserConfigured();
  const supabase = configured ? getSupabaseBrowserClient() : null;

  return {
    name: 'supabase',
    isConfigured: Boolean(supabase),
    legacyClient: createSupabaseLegacyClient(),
    auth: buildAuth(supabase),
    entities: createSupabaseEntityLayer(null, supabase),
    functions: buildFunctions(supabase),
    integrations: buildIntegrations(supabase)
  };
}
