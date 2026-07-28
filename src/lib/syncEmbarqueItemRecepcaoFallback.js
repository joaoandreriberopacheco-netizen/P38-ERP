/**
 * Fallback quando a Edge `saveEmbarqueItem` falha (ex.: BOOT_ERROR).
 * Actualiza linhas canónicas EmbarqueItem a partir das quantidades recebidas no embarque.
 */

export async function syncEmbarqueItemRecepcaoFallback(base44, { embarqueId, itensNorm = [] }) {
  if (!embarqueId || !base44?.entities?.EmbarqueItem) {
    throw new Error('EmbarqueItem indisponível para fallback de sincronização.');
  }

  const existentes = await base44.entities.EmbarqueItem.filter({ embarque_id: embarqueId }, 'ordem', 500);
  const rows = Array.isArray(existentes) ? existentes : [];
  const byProduto = new Map(rows.map((r) => [String(r.produto_id), r]));

  let actualizados = 0;
  for (let idx = 0; idx < itensNorm.length; idx++) {
    const it = itensNorm[idx];
    const produtoId = String(it?.produto_id || '');
    if (!produtoId) continue;
    const qRec = Number(it?.quantidade_recebida) || 0;
    const existente = byProduto.get(produtoId);
    if (!existente?.id) continue;

    await base44.entities.EmbarqueItem.update(existente.id, {
      quantidade_recebida_comercial: qRec,
      divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
      produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
      produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
      ordem: Number.isFinite(Number(it?.ordem)) ? Number(it.ordem) : idx,
    });
    actualizados += 1;
  }

  return { actualizados, total_itens: itensNorm.length };
}
