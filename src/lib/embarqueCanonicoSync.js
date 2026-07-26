import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';

/** Converte linhas legado do embarque para payload `saveEmbarqueItem`. */
export function buildEmbarqueItensCanonicosFromLegacy(itens = []) {
  return (itens || [])
    .map((it, idx) => ({
      id: it?.embarque_item_id || it?.id || undefined,
      produto_id: it?.produto_id || '',
      produto_unidade_id: it?.produto_unidade_id || '',
      pedido_compra_item_id: it?.pedido_compra_item_id || '',
      unidade_sigla: it?.unidade_medida || '',
      quantidade_pedida_comercial: Number(it?.quantidade_pedida) || 0,
      quantidade_embarcada_comercial: Number(it?.quantidade_embarcada) || 0,
      quantidade_recebida_comercial: Number(it?.quantidade_recebida) || 0,
      divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
      produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
      produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
      acordo_financeiro_lancamento_id: it?.acordo_financeiro_lancamento_id || '',
      ordem: idx,
    }))
    .filter((it) => it.produto_id && it.quantidade_embarcada_comercial > 0);
}

export async function syncEmbarqueItensReplaceAll(embarqueId, itens = []) {
  if (!embarqueId) return { ok: false, skipped: true, reason: 'sem_embarque_id' };

  const items = buildEmbarqueItensCanonicosFromLegacy(itens);
  if (!items.length) return { ok: true, skipped: true, reason: 'sem_linhas' };

  try {
    await saveEmbarqueItem({
      action: 'replaceAll',
      embarque_id: embarqueId,
      items,
    });
    return { ok: true, count: items.length };
  } catch (error) {
    return { ok: false, error };
  }
}
