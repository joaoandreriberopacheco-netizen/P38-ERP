import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';

/**
 * Oculta registros tipo Necessidade em stand by (sem transporte/datas e sem itens pendentes).
 * Mantém Necessidade com linhas de itens ainda pendentes de despacho/recepção.
 *
 * Função cloud `recalcularConclusaoPedidoCompra` (Base44, fora deste repositório): ao auditar
 * no painel, confirmar que percentuais/status agregados usam quantidade recebida (ou movimentos
 * de compra), não quantidade embarcada isolada; e que não há criação de MovimentacaoEstoque ali
 * (entrada de estoque permanece em RecepcionarEmbarque / conferência).
 */
export function filterEmbarquesVisiveisParaPedido(embarques) {
  return (embarques || []).filter((emb) => {
    const tipoNecessidade = emb?.tipo === 'Necessidade';
    const semVidaOperacional = !emb?.transportadora_id && !emb?.transportadora_nome && !emb?.data_embarque && !emb?.eta;
    const statusDormindo = !emb?.status || emb?.status === 'Pendente';
    const temItensPendentes = getEmbarqueItensLinhas(emb).some(
      (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_pedida) || 0) > 0
    );
    return !(tipoNecessidade && semVidaOperacional && statusDormindo && !temItensPendentes);
  });
}
