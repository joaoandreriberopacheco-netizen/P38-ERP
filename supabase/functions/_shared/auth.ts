// supabase/functions/_shared/auth.ts
// Helpers partilhados por todas as Edge Functions P38 portadas do Base44.
// Padrão: Edge valida JWT do utilizador e chama uma RPC Postgres (security definer)
// que faz o trabalho transacional. A Edge nunca faz várias writes soltas.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string): string => Deno.env.get(k) ?? '';

/** Cliente service_role — usado para chamar RPCs e ler tabelas internas. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export interface AuthContext {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
  client: SupabaseClient;
}

/**
 * Valida o JWT do Authorization header.
 * Retorna AuthContext em caso de sucesso, ou uma Response 401 para devolver directo.
 */
export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const client = serviceClient();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) {
    return jsonResponse({ error: 'Não autenticado' }, 401);
  }
  return { user: data.user, client };
}

/** Resolve o nome de exibição do utilizador (usuario.dados.full_name) para auditoria. */
export async function resolveUserName(
  client: SupabaseClient,
  userId: string,
  email?: string,
): Promise<string> {
  const { data } = await client
    .from('usuario')
    .select('dados')
    .eq('id', userId)
    .maybeSingle();
  const dados = (data as { dados?: Record<string, unknown> } | null)?.dados;
  return String(dados?.full_name || email || userId);
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Preflight CORS para chamadas do browser (Vercel → Supabase). */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

/** Resposta JSON canónica (paridade com o Base44 Response.json). */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Atalho para erros 400 de validação de payload. */
export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

/** Exige utilizador autenticado com role admin (usuario.dados.role). */
export async function requireAdmin(req: Request): Promise<AuthContext | Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, client } = auth;

  const { data, error } = await client
    .from('usuario')
    .select('dados')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const role = String((data as { dados?: Record<string, unknown> } | null)?.dados?.role || '');
  if (role !== 'admin') {
    return jsonResponse({ error: 'Acesso restrito a administradores.' }, 403);
  }

  return auth;
}