// Port de base44/functions/processarVendaCaixa → Edge + RPC transacional.
import {
  requireUser,
  resolveUserName,
  jsonResponse,
  badRequest,
  handleCorsPreflight,
} from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, client } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest('JSON inválido.');
  }

  const userName = await resolveUserName(client, user.id, user.email);
  const payload = { ...body, user_name: userName };

  const { data, error } = await client.rpc('processar_venda_caixa', { p_payload: payload });
  if (error) return jsonResponse({ error: error.message }, 500);

  const result = data as Record<string, unknown> | null;
  if (result?.error) {
    const msg = String(result.error);
    let status = 400;
    if (msg.includes('não encontrado')) status = 404;
    if (result.ja_processado) status = 409;
    if (result.em_processamento) status = 409;
    return jsonResponse(result, status);
  }
  return jsonResponse(result);
});
