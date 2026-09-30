/**
 * Payload canónico para saveEmbarqueItem (EmbarqueItem / SQL).
 * Mesma metodologia do pedido: qty na UM da ação + fator + base na gravação.
 */

import {
  resolveFatorParaGravacaoEmbarque,
  resolveFatorPedidoCompraLinha,
  resolveUnidadeSiglaParaGravacaoEmbarque,
} from '@/lib/resolveEmbarqueFatorPersistencia';

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

export function buildItensCanonicosEmbarque(itensNorm = [], pedidoItens = []) {
  return (Array.isArray(itensNorm) ? itensNorm : [])
    .map((it, idx) => {
      const linhaPedido = (pedidoItens || []).find(
        (pi) => String(pi?.produto_id) === String(it?.produto_id),
      );
      const fatorAcao = resolveFatorParaGravacaoEmbarque(linhaPedido, it);
      const fatorPed = resolveFatorPedidoCompraLinha(linhaPedido);
      const qEmbCom = Number(it?.quantidade_embarcada_apresentacao) || 0;
      const qRecCom = Number(it?.quantidade_recebida_apresentacao) || 0;
      const qPedCom =
        Number(it?.quantidade_pedida_apresentacao) ||
        Number(it?.quantidade_pedida_comercial) ||
        Number(linhaPedido?.quantidade ?? linhaPedido?.quantidade_comercial) ||
        (qEmbCom > 0 ? qEmbCom : 0) ||
        0;
      const pedBaseStored = Number(linhaPedido?.quantidade_base) || 0;

      return {
        produto_id: it?.produto_id || '',
        produto_unidade_id: it?.produto_unidade_id || linhaPedido?.produto_unidade_id || '',
        pedido_compra_item_id: it?.pedido_compra_item_id || linhaPedido?.id || '',
        unidade_sigla: resolveUnidadeSiglaParaGravacaoEmbarque(linhaPedido, it),
        fator_aplicado: fatorAcao,
        quantidade_pedida_comercial: round6(qPedCom),
        quantidade_pedida_base: pedBaseStored > 0
          ? round6(pedBaseStored)
          : round6(qPedCom * fatorPed),
        quantidade_embarcada_comercial: round6(qEmbCom),
        quantidade_embarcada_base: round6(qEmbCom * fatorAcao),
        quantidade_recebida_comercial: round6(qRecCom),
        quantidade_recebida_base: round6(qRecCom * fatorAcao),
        divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
        produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
        produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
        acordo_financeiro_lancamento_id: it?.acordo_financeiro_lancamento_id || '',
        ordem: idx,
      };
    })
    .filter((it) => it.produto_id && it.quantidade_embarcada_comercial > 0);
}
