/**
 * Reverte recepção de embarque: remove entradas de stock ligadas ao código do embarque
 * e repõe o documento como «Pendente» para novo recebimento.
 */

import { movimentoCombinaCodigoEmbarque } from './movimentacaoRecepcaoCompra.js';
import { invokeRecalcularConclusaoPedidoCompra, invokeRecalcularEstoqueProduto } from './p38StockRecalc.js';
import { buildItensCanonicosEmbarque } from '@/lib/buildEmbarqueItensCanonicos';
import { hydrateEmbarquesFromSql, getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import { formatarLogTime } from '@/components/utils/dateUtils';

function motivoEntradaCompraOk(mov) {
  const m = mov?.motivo;
  if (m == null || m === '') return true;
  if (m === 'Compra') return true;
  return String(m).toLowerCase() === 'compra';
}

function getItensEmbarque(embarque) {
  return getEmbarqueItensLinhas(embarque);
}

/** Movimentos de entrada de compra atribuíveis a este embarque. */
export function filtrarMovimentosRecepcaoEmbarque(movimentos, embarque) {
  const codigo = String(embarque?.codigo_exibicao || '').trim();
  const itens = getItensEmbarque(embarque);
  const produtoIds = new Set(
    itens.flatMap((it) => {
      const ids = [];
      if (it?.produto_id) ids.push(String(it.produto_id));
      if (it?.produto_id_recebido_diferente) ids.push(String(it.produto_id_recebido_diferente));
      return ids;
    }),
  );

  const candidatos = (movimentos || []).filter(
    (mov) => mov?.tipo === 'Entrada' && motivoEntradaCompraOk(mov),
  );

  const porCodigo = codigo
    ? candidatos.filter((mov) => movimentoCombinaCodigoEmbarque(mov, codigo))
    : [];

  if (porCodigo.length > 0) return porCodigo;

  // Legado: sem marca do embarque no movimento — só produtos deste embarque com qtd recebida > 0.
  const comRecebimento = itens.filter((it) => (Number(it?.quantidade_recebida) || 0) > 0);
  if (!comRecebimento.length) return [];

  return candidatos.filter((mov) => {
    const pid = mov?.produto_id != null ? String(mov.produto_id) : '';
    return pid && produtoIds.has(pid);
  });
}

function resetItemRecepcao(item = {}) {
  return {
    ...item,
    quantidade_recebida: 0,
    divergencia_tipo: 'Nenhuma',
    produto_id_recebido_diferente: '',
    produto_nome_recebido_diferente: '',
  };
}

async function carregarMovimentosPedido(base44, pedidoId) {
  let movs = await base44.entities.MovimentacaoEstoque.filter(
    { referencia_tipo: 'PedidoCompra', referencia_id: pedidoId },
    '-created_date',
    500,
  );
  if (!movs?.length) {
    movs = await base44.entities.MovimentacaoEstoque.filter(
      { referencia_tipo: 'PedidoCompra', referencia_id: String(pedidoId) },
      '-created_date',
      500,
    );
  }
  return movs || [];
}

/**
 * @param {object} base44
 * @param {{ pedido: object, embarque: object, movimentosExistentes?: object[] }} args
 */
export async function reverterRecepcaoEmbarque(base44, { pedido, embarque, movimentosExistentes }) {
  if (!embarque?.id) {
    throw new Error('Embarque sem identificador — recarregue o pedido.');
  }

  const statusAtual = embarque?.status_recebimento || embarque?.status_recebimento_embarque || 'Pendente';
  if (!statusAtual || statusAtual === 'Pendente') {
    throw new Error('Este embarque ainda não foi recebido.');
  }

  const movimentos =
    Array.isArray(movimentosExistentes) && movimentosExistentes.length > 0
      ? movimentosExistentes
      : await carregarMovimentosPedido(base44, pedido?.id);

  const movimentosEmbarque = filtrarMovimentosRecepcaoEmbarque(movimentos, embarque);
  const [embarqueHidratado] = await hydrateEmbarquesFromSql(base44, [embarque]);
  const itensOriginais = getItensEmbarque(embarqueHidratado || embarque);
  const itensReset = itensOriginais.map(resetItemRecepcao);
  const codigo = embarque?.codigo_exibicao || embarque?.numero || '';

  const produtosRecalc = new Set();
  for (const mov of movimentosEmbarque) {
    await base44.entities.MovimentacaoEstoque.delete(mov.id);
    if (mov?.produto_id) produtosRecalc.add(mov.produto_id);
  }

  for (const produtoId of produtosRecalc) {
    await invokeRecalcularEstoqueProduto(base44, produtoId);
  }

  const pedidoItens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const itensCanonicos = buildItensCanonicosEmbarque(itensReset, pedidoItens);
  if (itensCanonicos.length > 0) {
    await saveEmbarqueItem({
      action: 'replaceAll',
      embarque_id: embarque.id,
      items: itensCanonicos,
    });
  }

  await base44.entities.Embarque.update(embarque.id, {
    status: 'Pendente',
    status_recebimento: 'Pendente',
    status_recebimento_embarque: 'Pendente',
  });

  if (pedido?.id) {
    const tag = `\n[REVERSÃO RECEPÇÃO EMBARQUE ${codigo} | ${movimentosEmbarque.length} movimento(s) removido(s) | ${formatarLogTime()}]`;
    await base44.entities.PedidoCompra.update(pedido.id, {
      historico: String(pedido.historico || '') + tag,
    });
    await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);
  }

  return {
    movimentosRemovidos: movimentosEmbarque.length,
    produtosRecalculados: produtosRecalc.size,
    codigoEmbarque: codigo,
  };
}
