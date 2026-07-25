// RPC wrapper: gerar_numero_sequencial
import { requireUser, jsonResponse } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await req.json().catch(() => ({}));
  const tipo = body?.tipo ?? body?.p_tipo;
  if (!tipo) return jsonResponse({ error: 'Parâmetro "tipo" obrigatório.' }, 400);
  const { data, error } = await auth.client.rpc('gerar_numero_sequencial', { p_tipo: tipo });
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse(data);
});
