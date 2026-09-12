// Port de cancelarPedidoVenda → Edge + RPC transacional Supabase.
// Contrato:
//   POST /cancelar-pedido-venda  (Authorization: Bearer <jwt>)
//   body: { pedidoId: string, motivo: string }
//   200 → { sucesso: true, pedido_id, numero, status, ... }
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

  let body: { pedidoId?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('JSON inválido.');
  }

  const { pedidoId, motivo } = body;
  if (!pedidoId) return badRequest('pedidoId obrigatório.');
  if (!String(motivo || '').trim()) {
    return badRequest('Informe o motivo do cancelamento.');
  }

  const userName = await resolveUserName(client, user.id, user.email);

  const { data, error } = await client.rpc('cancelar_pedido_venda', {
    p_pedido_id: pedidoId,
    p_motivo: String(motivo).trim(),
    p_user_name: userName,
  });
  if (error) return jsonResponse({ error: error.message }, 500);

  const result = data as Record<string, unknown> | null;
  if (result?.error) {
    const msg = String(result.error);
    let status = 400;
    if (msg.includes('não encontrado')) status = 404;
    if (msg.includes('já está cancelado')) status = 409;
    if (msg.includes('devolução/troca')) status = 409;
    return jsonResponse(result, status);
  }
  return jsonResponse(result);
});
