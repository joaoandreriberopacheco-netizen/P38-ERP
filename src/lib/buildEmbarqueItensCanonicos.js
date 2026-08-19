/**
 * Payload canónico para saveEmbarqueItem (EmbarqueItem / SQL).
 */

export function buildItensCanonicosEmbarque(itensNorm = [], pedidoItens = []) {
  return (Array.isArray(itensNorm) ? itensNorm : [])
    .map((it, idx) => {
      const linhaPedido = pedidoItens.find((pi) => String(pi?.produto_id) === String(it?.produto_id));
      const qPedida =
        Number(it?.quantidade_pedida_apresentacao) ||
        Number(it?.quantidade_pedida_comercial) ||
        (Number(it?.quantidade_embarcada_apresentacao) > 0 ? Number(it.quantidade_embarcada_apresentacao) : 0) ||
        Number(linhaPedido?.quantidade) ||
        0;
      return {
        produto_id: it?.produto_id || '',
        produto_unidade_id: it?.produto_unidade_id || '',
        pedido_compra_item_id: it?.pedido_compra_item_id || '',
        unidade_sigla: it?.unidade_apresentacao || it?.unidade_medida || '',
        fator_aplicado: Number(it?.fator_apresentacao) || undefined,
        quantidade_pedida_comercial: qPedida,
        quantidade_embarcada_comercial: Number(it?.quantidade_embarcada_apresentacao) || 0,
        quantidade_recebida_comercial: Number(it?.quantidade_recebida_apresentacao) || 0,
        divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
        produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
        produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
        acordo_financeiro_lancamento_id: it?.acordo_financeiro_lancamento_id || '',
        ordem: idx,
      };
    })
    .filter((it) => it.produto_id && it.quantidade_embarcada_comercial > 0);
}
