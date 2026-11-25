import { format } from 'date-fns';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import {
  calcValorTotalPedidoCompra,
  loadPedidoCompraComItensCanonico,
} from '@/lib/pedidoCompraFinanceiro';
import {
  legacyItensPedidoCompraToCanonicalPayload,
  readLegacyItensPedidoCompra,
} from '@/lib/fetchPedidoCompraItens';
import { savePedidoCompraItem } from '@/functions/savePedidoCompraItem';

/** Remove IDs e vínculos de logística das linhas; mantém produto, qtd, custos e totais. */
function itensParaDuplicacao(itens = []) {
  const limpos = itens.map((it) => {
    const {
      id: _id,
      pedido_compra_item_id: _pci,
      quantidade_vinculada: _qv,
      ...rest
    } = it;
    return {
      ...rest,
      quantidade_vinculada: 0,
    };
  });
  return legacyItensPedidoCompraToCanonicalPayload(limpos).map(({ id: _omit, ...row }) => row);
}

/**
 * Cria novo pedido em Rascunho com itens do pedido origem (SQL canónico).
 * Cabeçalho: só fornecedor + data_emissao hoje (fornecedor é obrigatório no schema).
 */
export async function duplicarPedidoCompra(base44, pedidoId) {
  if (!base44 || !pedidoId) {
    throw new Error('Pedido inválido para duplicar.');
  }

  let origem = await loadPedidoCompraComItensCanonico(base44, pedidoId);
  if (!origem) {
    throw new Error('Pedido de origem não encontrado.');
  }

  let itens = origem.itens?.length ? origem.itens : readLegacyItensPedidoCompra(origem);
  itens = itens.filter((it) => it?.produto_id);
  if (!itens.length) {
    throw new Error('O pedido não tem itens para copiar.');
  }

  const pedidoEspelho = { ...origem, itens, valor_frete: 0, valor_desconto: 0 };
  const valor_total = calcValorTotalPedidoCompra(pedidoEspelho);
  const numero = await gerarNumeroSequencial('PC');
  const data_emissao = format(new Date(), 'yyyy-MM-dd');
  const notaHist = `\n[Duplicado de ${origem.numero || pedidoId} — ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;

  const novo = await base44.entities.PedidoCompra.create({
    numero,
    fornecedor_id: origem.fornecedor_id,
    fornecedor_nome: origem.fornecedor_nome || '',
    status: 'Rascunho',
    status_aprovacao_financeira: 'Pendente',
    status_embarque: 'Nenhum',
    status_recebimento_geral: 'Nenhum',
    percentual_valor_embarcado: 0,
    status_conferencia_pedido: 'Não Iniciada',
    valor_total,
    data_emissao,
    historico: notaHist,
    nfe_emitida: false,
    tem_divergencias: false,
    is_encomenda: false,
    observacoes: '',
    tags: [],
  });

  const itemsPayload = itensParaDuplicacao(itens);
  await savePedidoCompraItem({
    action: 'replaceAll',
    pedido_compra_id: novo.id,
    items: itemsPayload,
  });

  return novo;
}