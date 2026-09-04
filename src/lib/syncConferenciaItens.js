import { getEntryDisplayQuantity } from '@/lib/inventoryCountUnits';
import { saveConferenciaItem } from '@/functions/saveConferenciaItem';

export function countEntryToCanonicalInput(entry = {}, produto = null, idx = 0) {
  return {
    id: entry?.conferencia_item_id || entry?.id || undefined,
    produto_id: entry?.produto_id || '',
    produto_nome: entry?.produto_nome || '',
    unidade_sigla: entry?.unidade_sigla || entry?.unidade_medida || '',
    unidade_medida: entry?.unidade_medida || entry?.unidade_sigla || '',
    produto_unidade_id: entry?.produto_unidade_id || '',
    fator_conversao: entry?.fator_conversao,
    quantidade_contada_comercial: getEntryDisplayQuantity(entry, produto),
    ordem: idx,
    observacoes: typeof entry?.observacoes === 'string' ? entry.observacoes : '',
  };
}

/** Grava linhas em ConferenciaItem (replaceAll). Cabeçalho não deve persistir `itens_conferidos[]`. */
export async function syncConferenciaItens(conferenciaId, itens = [], produtos = []) {
  const produtoMap = new Map((produtos || []).map((p) => [p.id, p]));
  const items = (itens || [])
    .map((entry, idx) =>
      countEntryToCanonicalInput(entry, produtoMap.get(entry?.produto_id), idx),
    )
    .filter((it) => it.produto_id);

  if (!conferenciaId) return null;
  if (!items.length) {
    return saveConferenciaItem({
      action: 'replaceAll',
      conferencia_id: conferenciaId,
      items: [],
    });
  }

  return saveConferenciaItem({
    action: 'replaceAll',
    conferencia_id: conferenciaId,
    items,
  });
}
