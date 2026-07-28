// Shim compatível com base44 SDK para funções portadas do Base44.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createSupabaseEntityLayer } from './entityLayer.ts';
import { buildCoreIntegrations } from './integrations.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';

export type P38User = Record<string, unknown> & {
  id: string;
  email?: string;
  role?: string;
  full_name?: string;
  perfil?: string;
};

function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

async function resolveUsuario(client: SupabaseClient, authUser: { id: string; email?: string } | null): Promise<P38User | null> {
  if (!authUser) return null;
  const { data: row } = await client.from('usuario').select('*').eq('id', authUser.id).maybeSingle();
  if (row) {
    const dados = (row as { dados?: Record<string, unknown> }).dados || {};
    return {
      id: String((row as { id: string }).id),
      email: String(dados.email || authUser.email || ''),
      role: String(dados.role || 'user'),
      full_name: String(dados.full_name || dados.nome || ''),
      perfil: String(dados.perfil || dados.perfil_acesso_nome || ''),
      ...dados,
    };
  }
  return {
    id: authUser.id,
    email: authUser.email,
    role: 'user',
    full_name: authUser.email || '',
  };
}

function toKebab(name: string): string {
  return String(name).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function buildFunctions(client: SupabaseClient) {
  return {
    async invoke(name: string, body: Record<string, unknown> = {}) {
      const { data, error } = await client.functions.invoke(toKebab(name), { body });
      if (error) throw new Error(error.message || `invoke(${name}) falhou`);
      return { data };
    },
  };
}

export interface P38Client {
  auth: { me: () => Promise<P38User | null> };
  asServiceRole: {
    entities: ReturnType<typeof createSupabaseEntityLayer>;
    functions: ReturnType<typeof buildFunctions>;
    connectors?: {
      getConnection: (name: string) => Promise<{ accessToken: string }>;
    };
  };
  entities: ReturnType<typeof createSupabaseEntityLayer>;
  integrations: { Core: ReturnType<typeof buildCoreIntegrations> };
  functions: ReturnType<typeof buildFunctions>;
  users?: {
    inviteUser: (args: { email: string }) => Promise<unknown>;
  };
}

export async function createP38Client(req: Request): Promise<P38Client> {
  const client = serviceClient();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let user: P38User | null = null;
  if (jwt) {
    const { data } = await client.auth.getUser(jwt);
    user = await resolveUsuario(client, data.user);
  }

  const entities = createSupabaseEntityLayer(null, client);
  const functions = buildFunctions(client);
  const Core = buildCoreIntegrations();

  return {
    auth: { me: async () => user },
    asServiceRole: {
      entities,
      functions,
      connectors: {
        async getConnection(name: string) {
          if (name === 'github') {
            const token = env('GITHUB_TOKEN') || env('FLARE_GITHUB_TOKEN') || env('SUPABASE_GITHUB_TOKEN');
            if (!token) throw new Error('GITHUB_TOKEN não configurado para connector github');
            return { accessToken: token };
          }
          if (name === 'googledrive') {
            const token = env('GOOGLE_DRIVE_ACCESS_TOKEN');
            if (!token) throw new Error('GOOGLE_DRIVE_ACCESS_TOKEN não configurado');
            return { accessToken: token };
          }
          throw new Error(`Connector "${name}" não configurado no Supabase`);
        },
      },
    },
    entities,
    integrations: { Core },
    functions,
    users: {
      async inviteUser({ email }: { email: string }) {
        const { data, error } = await client.auth.admin.inviteUserByEmail(email);
        if (error) throw new Error(error.message);
        return data;
      },
    },
  };
}
