import {
  serviceClient,
  jsonResponse,
  badRequest,
  requireUser,
} from '../_shared/auth.ts';
import {
  isValidLogin,
  loginFromAuthEmail,
  loginToAuthEmail,
  normalizeLogin,
  randomPassword,
} from '../_shared/p38AuthHelpers.ts';

type UsuarioRow = {
  id: string;
  login?: string | null;
  nickname?: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  perfil_acesso_id?: string | null;
  perfil_acesso_nome?: string | null;
  auth_ativado?: boolean | null;
  dados?: Record<string, unknown>;
};

async function countAuthUsers(admin: ReturnType<typeof serviceClient>['auth']['admin']): Promise<number> {
  const { data, error } = await admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
  // @ts-ignore supabase-js v2 listUsers may expose total
  const total = (data as { total?: number })?.total;
  if (typeof total === 'number') return total;
  const { data: page1 } = await admin.listUsers({ page: 1, perPage: 200 });
  return page1?.users?.length ?? 0;
}

async function findUsuarioByLogin(
  client: ReturnType<typeof serviceClient>,
  login: string,
): Promise<UsuarioRow | null> {
  const norm = normalizeLogin(login);
  if (!norm) return null;

  let { data, error } = await client
    .from('usuario')
    .select('*')
    .ilike('login', norm)
    .limit(1)
    .maybeSingle();
  if (!error && data) return data as UsuarioRow;

  ({ data, error } = await client
    .from('usuario')
    .select('*')
    .ilike('nickname', norm)
    .limit(1)
    .maybeSingle());
  if (!error && data) return data as UsuarioRow;

  return null;
}

function usuarioRole(row: UsuarioRow | null): string {
  if (!row) return '';
  return String(row.role || row.dados?.role || '').toLowerCase();
}

function buildUserMetadata(row: UsuarioRow, login: string) {
  return {
    login,
    nickname: row.nickname || login,
    full_name: row.full_name || row.dados?.full_name || login,
    role: row.role || row.dados?.role || 'user',
    perfil_acesso_id: row.perfil_acesso_id || row.dados?.perfil_acesso_id || null,
    perfil_acesso_nome: row.perfil_acesso_nome || row.dados?.perfil_acesso_nome || null,
    usuario_operacional_id: row.id,
  };
}

async function findAuthUserByLogin(
  admin: ReturnType<typeof serviceClient>['auth']['admin'],
  login: string,
) {
  const email = loginToAuthEmail(login);
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

async function requireAdminUser(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, client } = auth;

  const metaRole = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
  if (metaRole === 'admin') return auth;

  const login = loginFromAuthEmail(user.email) || normalizeLogin(user.user_metadata?.login);
  if (login) {
    const row = await findUsuarioByLogin(client, login);
    if (usuarioRole(row) === 'admin') return auth;
  }

  return jsonResponse({ error: 'Acesso restrito a administradores.' }, 403);
}

async function handleStatus() {
  const client = serviceClient();
  const total = await countAuthUsers(client.auth.admin);
  return jsonResponse({
    needsBootstrap: total === 0,
    authUserCount: total,
  });
}

async function handleBootstrap(body: Record<string, unknown>) {
  const login = normalizeLogin(body.login);
  const password = String(body.password || '');
  if (!isValidLogin(login)) return badRequest('Login inválido (mín. 2 caracteres, sem espaços).');
  if (password.length < 6) return badRequest('Senha deve ter pelo menos 6 caracteres.');

  const client = serviceClient();
  const total = await countAuthUsers(client.auth.admin);
  if (total > 0) {
    return jsonResponse({ error: 'Sistema já activado. Use o login normal.' }, 403);
  }

  const row = await findUsuarioByLogin(client, login);
  if (!row) return badRequest('Utilizador administrador não encontrado. Verifique o login.');
  if (usuarioRole(row) !== 'admin') {
    return badRequest('Este login não é administrador. Use a conta admin do P38.');
  }

  const email = loginToAuthEmail(login);
  const meta = buildUserMetadata({ ...row, role: 'admin' }, login);
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { ...meta, must_activate: false, password_set: true },
  });
  if (error) return jsonResponse({ error: error.message }, 400);

  await client
    .from('usuario')
    .update({ login, auth_ativado: true, role: 'admin' })
    .eq('id', row.id);

  return jsonResponse({ ok: true, login, auth_user_id: data.user?.id });
}

async function handleActivate(body: Record<string, unknown>) {
  const login = normalizeLogin(body.login);
  const password = String(body.password || '');
  if (!isValidLogin(login)) return badRequest('Login inválido.');
  if (password.length < 6) return badRequest('Senha deve ter pelo menos 6 caracteres.');

  const client = serviceClient();
  const authUser = await findAuthUserByLogin(client.auth.admin, login);
  if (!authUser) {
    const row = await findUsuarioByLogin(client, login);
    if (row) {
      return badRequest(
        'Cadastro encontrado, mas ainda sem credencial de acesso. Peça ao administrador para criar o acesso em Configurações → Usuários.',
      );
    }
    return badRequest('Conta não encontrada. Peça ao administrador para criar o seu utilizador.');
  }

  const mustActivate = authUser.user_metadata?.must_activate === true;
  if (!mustActivate && authUser.user_metadata?.password_set === true) {
    return badRequest('Esta conta já está activa. Use o login normal.');
  }

  const { error } = await client.auth.admin.updateUserById(authUser.id, {
    password,
    user_metadata: {
      ...(authUser.user_metadata || {}),
      must_activate: false,
      password_set: true,
    },
  });
  if (error) return jsonResponse({ error: error.message }, 400);

  const row = await findUsuarioByLogin(client, login);
  if (row) {
    await client.from('usuario').update({ login, auth_ativado: true }).eq('id', row.id);
  }

  return jsonResponse({ ok: true, login });
}

async function provisionAuthForUsuario(
  client: ReturnType<typeof serviceClient>,
  row: UsuarioRow,
  login: string,
  opts: {
    fullName: string;
    perfilAcessoId: string | null;
    perfilAcessoNome: string | null;
    role: string;
  },
) {
  const email = loginToAuthEmail(login);
  const tempPassword = randomPassword(24);
  const fullName = opts.fullName || row.full_name || row.dados?.full_name || login;
  const role = opts.role || usuarioRole(row) || 'user';
  const perfilAcessoId = opts.perfilAcessoId || row.perfil_acesso_id || row.dados?.perfil_acesso_id || null;
  const perfilAcessoNome = opts.perfilAcessoNome || row.perfil_acesso_nome || row.dados?.perfil_acesso_nome || null;

  const { data: authData, error: authErr } = await client.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      login,
      nickname: row.nickname || login,
      full_name: fullName,
      role,
      perfil_acesso_id: perfilAcessoId,
      perfil_acesso_nome: perfilAcessoNome,
      usuario_operacional_id: row.id,
      must_activate: true,
      password_set: false,
    },
  });
  if (authErr) return jsonResponse({ error: authErr.message }, 400);

  const updatePayload: Record<string, unknown> = {
    login,
    auth_ativado: false,
  };
  if (fullName) updatePayload.full_name = fullName;
  if (role) updatePayload.role = role;
  if (perfilAcessoId) updatePayload.perfil_acesso_id = perfilAcessoId;
  if (perfilAcessoNome) updatePayload.perfil_acesso_nome = perfilAcessoNome;

  const { error: updErr } = await client.from('usuario').update(updatePayload).eq('id', row.id);
  if (updErr) {
    await client.auth.admin.deleteUser(authData.user!.id);
    return jsonResponse({ error: updErr.message }, 400);
  }

  return jsonResponse({
    ok: true,
    login,
    usuario_id: row.id,
    auth_user_id: authData.user?.id,
    provisioned_existing: true,
    next_step: 'O utilizador deve abrir /ativar-acesso e definir a senha.',
  });
}

async function handleCreateUser(req: Request, body: Record<string, unknown>) {
  const adminAuth = await requireAdminUser(req);
  if (adminAuth instanceof Response) return adminAuth;

  const login = normalizeLogin(body.login);
  const fullName = String(body.full_name || body.fullName || login).trim();
  const perfilAcessoId = body.perfil_acesso_id ? String(body.perfil_acesso_id) : null;
  const perfilAcessoNome = body.perfil_acesso_nome ? String(body.perfil_acesso_nome) : null;
  const role = String(body.role || 'user').toLowerCase();

  if (!isValidLogin(login)) return badRequest('Login inválido.');
  if (!perfilAcessoId) return badRequest('Selecione um perfil de acesso.');

  const client = serviceClient();
  const existingAuth = await findAuthUserByLogin(client.auth.admin, login);
  if (existingAuth) return badRequest('Já existe credencial de acesso para este login.');

  const existing = await findUsuarioByLogin(client, login);
  if (existing) {
    return await provisionAuthForUsuario(client, existing, login, {
      fullName,
      perfilAcessoId,
      perfilAcessoNome,
      role,
    });
  }

  const usuarioId = crypto.randomUUID();
  const email = loginToAuthEmail(login);
  const tempPassword = randomPassword(24);

  const { data: authData, error: authErr } = await client.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      login,
      nickname: login,
      full_name: fullName,
      role,
      perfil_acesso_id: perfilAcessoId,
      perfil_acesso_nome: perfilAcessoNome,
      usuario_operacional_id: usuarioId,
      must_activate: true,
      password_set: false,
    },
  });
  if (authErr) return jsonResponse({ error: authErr.message }, 400);

  const insertPayload: Record<string, unknown> = {
    id: usuarioId,
    login,
    nickname: login,
    full_name: fullName,
    role,
    perfil_acesso_id: perfilAcessoId,
    perfil_acesso_nome: perfilAcessoNome,
    auth_ativado: false,
    dados: {
      login,
      nickname: login,
      full_name: fullName,
      role,
      perfil_acesso_id: perfilAcessoId,
      perfil_acesso_nome: perfilAcessoNome,
    },
  };

  const { error: insErr } = await client.from('usuario').insert(insertPayload);
  if (insErr) {
    await client.auth.admin.deleteUser(authData.user!.id);
    return jsonResponse({ error: insErr.message }, 400);
  }

  return jsonResponse({
    ok: true,
    login,
    usuario_id: usuarioId,
    auth_user_id: authData.user?.id,
    next_step: 'O utilizador deve abrir /ativar-acesso e definir a senha.',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const op = String(body.op || 'status');

    switch (op) {
      case 'status':
        return await handleStatus();
      case 'bootstrap':
        return await handleBootstrap(body);
      case 'activate':
        return await handleActivate(body);
      case 'create_user':
        return await handleCreateUser(req, body);
      default:
        return badRequest(`op inválida: ${op}`);
    }
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
