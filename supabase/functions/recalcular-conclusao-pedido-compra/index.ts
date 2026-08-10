// Recalcula status de conclusão / recebimento de um PedidoCompra a partir dos embarques.
import { requireUser, jsonResponse, badRequest } from '../_shared/auth.ts';

type EmbarqueRow = {
  status_recebimento?: string | null;
  itens?: Array<{ quantidade_embarcada?: number; quantidade_recebida?: number }>;
  itens_embarcados?: Array<{ quantidade_embarcada?: number; quantidade_recebida?: number }>;
};

function statusRecebimentoGeral(embarques: EmbarqueRow[]): string {
  if (!embarques.length) return 'Nenhum';
  const recebimentos = embarques.map((e) => e.status_recebimento).filter(Boolean) as string[];
  if (recebimentos.some((s) => s === 'Com Divergência')) return 'Concluído com Divergência';
  if (recebimentos.length > 0 && recebimentos.every((s) => s === 'Recebido OK')) return 'Concluído OK';
  if (recebimentos.some((s) => s === 'Recebido Parcial')) return 'Recebido Parcial';
  return 'Pendente';
}

function pedidoConcluido(statusReceb: string): boolean {
  return statusReceb === 'Concluído OK' || statusReceb === 'Concluído com Divergência';
}

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await req.json().catch(() => ({}));
  const pedidoId = body.pedidoId || body.pedido_id;
  if (!pedidoId) return badRequest('pedidoId obrigatório');

  const { data: pedido, error: pErr } = await auth.client
    .from('pedido_compra')
    .select('id, numero, status, status_recebimento_geral, historico, itens, dados')
    .eq('id', String(pedidoId))
    .maybeSingle();
  if (pErr) return jsonResponse({ error: pErr.message }, 500);
  if (!pedido) return jsonResponse({ error: 'Pedido não encontrado' }, 404);

  const { data: embarques, error: eErr } = await auth.client
    .from('embarque')
    .select('id, status_recebimento, itens, dados')
    .eq('pedido_compra_id', String(pedidoId));
  if (eErr) return jsonResponse({ error: eErr.message }, 500);

  const embRows: EmbarqueRow[] = (embarques || []).map((e: Record<string, unknown>) => {
    const dados = (e.dados && typeof e.dados === 'object' ? e.dados : {}) as Record<string, unknown>;
    return {
      status_recebimento: (e.status_recebimento as string) || (dados.status_recebimento as string) || null,
      itens: (e.itens as EmbarqueRow['itens']) || (dados.itens as EmbarqueRow['itens']) || [],
      itens_embarcados: (dados.itens_embarcados as EmbarqueRow['itens_embarcados']) || [],
    };
  });

  const statusReceb = statusRecebimentoGeral(embRows);
  const concluido = pedidoConcluido(statusReceb);
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status_recebimento_geral: statusReceb,
  };
  if (concluido) {
    patch.status = 'Concluído';
    patch.data_conclusao = nowIso;
  }

  const tag = `\n[RECALCULO CONCLUSAO | status=${String(patch.status || pedido.status)} | recebimento=${statusReceb} | ${nowIso}]`;
  patch.historico = String(pedido.historico || '') + tag;

  const { error: uErr } = await auth.client
    .from('pedido_compra')
    .update(patch)
    .eq('id', String(pedidoId));
  if (uErr) return jsonResponse({ error: uErr.message }, 500);

  // Também recalcula estoque dos produtos do pedido (compat com versão anterior).
  const itens = (pedido.itens || (pedido.dados as { itens?: Array<{ produto_id?: string }> })?.itens || []) as Array<{
    produto_id?: string;
  }>;
  const ids = [...new Set(itens.map((i) => i.produto_id).filter(Boolean))];
  const results: unknown[] = [];
  for (const pid of ids) {
    const { data, error } = await auth.client.rpc('recalcular_estoque_produto', { p_produto_id: pid });
    if (error) results.push({ produto_id: pid, error: error.message });
    else results.push({ produto_id: pid, ...(data as object) });
  }

  return jsonResponse({
    success: true,
    pedido_id: pedidoId,
    status_recebimento_geral: statusReceb,
    status: patch.status || pedido.status,
    recalculados: results.length,
    results,
  });
});
