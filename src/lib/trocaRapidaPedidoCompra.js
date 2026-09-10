import { roundToTwoDecimals } from '@/lib/financialUtils';
import { formatarLogTime } from '@/components/utils/dateUtils';
import {
  calcValorTotalPedidoCompra,
  calcValorItensPedidoCompra,
  criarLancamentoAjustePedidoCompra,
  listarLancamentosPedidoCompra,
  temLancamentoPagoParaPedido,
} from '@/lib/pedidoCompraFinanceiro';
import {
  pickDefaultPurchaseUnit,
  commercialQuantityFromBase,
  syncItemDescontoApresentacao,
  calcTotalItemCompraPedido,
  normalizeItemToCanonicalFactorOne,
  normalizePedidoCompraItemCustoLiquidoParaPersist,
  custoApresentacaoParaFator1,
  resolveValorDescontoCompraPadraoFator1,
  resolveDescontoPctCompraProduto,
} from '@/lib/productUnits';
import { savePedidoCompraItem } from '@/functions/savePedidoCompraItem';

export function formatNotaHistoricoTroca({
  itemOriginal = {},
  itemNovo = {},
  diferenca = 0,
  motivo = '',
  responsavel = '',
} = {}) {
  const nomeAntigo = itemOriginal.produto_nome || itemOriginal.produto_id || 'item';
  const nomeNovo = itemNovo.produto_nome || itemNovo.produto_id || 'item';
  const diff = roundToTwoDecimals(diferenca);
  const sinal = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const diffAbs = Math.abs(diff).toFixed(2);
  const partes = [
    `[Troca de item: ${nomeAntigo} → ${nomeNovo}`,
    `Diferença: ${sinal}R$ ${diffAbs}`,
    motivo ? `Motivo: ${motivo}` : '',
    responsavel ? `Por: ${responsavel}` : '',
    formatarLogTime(),
  ].filter(Boolean);
  return `\n${partes.join(' | ')}]`;
}

export function buildItemSubstitutoCompra(itemOriginal = {}, produtoNovo = {}) {
  if (!itemOriginal?.produto_id || !produtoNovo?.id) {
    throw new Error('Item original ou produto substituto inválido.');
  }
  if (String(itemOriginal.produto_id) === String(produtoNovo.id)) {
    throw new Error('Escolha um produto diferente do item atual.');
  }

  const opt = pickDefaultPurchaseUnit(produtoNovo);
  const fatorPu = Number(opt?.fator_conversao) || 1;
  const custoF1 = opt
    ? custoApresentacaoParaFator1(opt.valor_unitario ?? 0, fatorPu)
    : Number(produtoNovo.valor_compra) || 0;

  const quantidadeBase =
    Number(itemOriginal.quantidade_base) > 0
      ? Number(itemOriginal.quantidade_base)
      : (Number(itemOriginal.quantidade) || 0) * (Number(itemOriginal.fator_conversao) || 1);

  let item = {
    ...itemOriginal,
    produto_id: produtoNovo.id,
    produto_nome: produtoNovo.nome,
    codigo_produto: produtoNovo.codigo_interno || produtoNovo.codigo_barras || '',
    unidade_medida: opt?.unidade || produtoNovo.unidade_compra || produtoNovo.unidade_principal || 'UN',
    fator_conversao: fatorPu,
    quantidade_base: roundToTwoDecimals(quantidadeBase),
    quantidade: commercialQuantityFromBase(
      quantidadeBase,
      fatorPu,
      opt?.unidade || produtoNovo.unidade_compra || 'UN',
    ),
    custo_unitario: roundToTwoDecimals(custoF1),
    valor_desconto_item: resolveValorDescontoCompraPadraoFator1(produtoNovo, custoF1),
    desconto_pct_item: resolveDescontoPctCompraProduto(produtoNovo, custoF1),
    produto_unidade_id: opt?.produto_unidade_id || opt?.id || itemOriginal.produto_unidade_id || '',
  };

  item = syncItemDescontoApresentacao(item);
  const cost = roundToTwoDecimals(Number(item.custo_unitario) || 0);
  const descUnit = roundToTwoDecimals(Number(item.valor_desconto_item) || 0);
  item.custo_final_unitario = roundToTwoDecimals(cost - descUnit);
  item.subtotal = roundToTwoDecimals(quantidadeBase * cost);
  item.total = calcTotalItemCompraPedido(item);
  return normalizeItemToCanonicalFactorOne(item, 'custo');
}

export function calcularPreviewTrocaPedidoCompra(pedido = {}, itemIndex = -1, produtoSubstituto = {}) {
  const itens = Array.isArray(pedido.itens) ? [...pedido.itens] : [];
  if (itemIndex < 0 || itemIndex >= itens.length) {
    throw new Error('Item do pedido não encontrado.');
  }

  const itemOriginal = itens[itemIndex];
  const itemNovo = buildItemSubstitutoCompra(itemOriginal, produtoSubstituto);
  const itensNovos = itens.map((it, idx) => (idx === itemIndex ? itemNovo : it));

  const pedidoAnterior = { ...pedido, itens };
  const pedidoNovo = { ...pedido, itens: itensNovos };

  const valorAnterior = calcValorTotalPedidoCompra(pedidoAnterior);
  const valorNovo = calcValorTotalPedidoCompra(pedidoNovo);
  const diferencaLinha = roundToTwoDecimals((Number(itemNovo.total) || 0) - (Number(itemOriginal.total) || 0));

  return {
    itemOriginal,
    itemNovo,
    itensNovos,
    valorAnterior,
    valorNovo,
    diferencaPedido: roundToTwoDecimals(valorNovo - valorAnterior),
    diferencaLinha,
    valorItens: calcValorItensPedidoCompra(pedidoNovo),
  };
}

function mapItensCanonicosParaPersist(itens = []) {
  return itens
    .map((it, idx) => {
      const synced = syncItemDescontoApresentacao(it);
      const totalLinha = calcTotalItemCompraPedido(synced);
      const normalizado = normalizePedidoCompraItemCustoLiquidoParaPersist({
        ...synced,
        custo_unitario_fator1: Number(synced?.custo_unitario) || 0,
        quantidade_comercial: Number(synced?.quantidade) || 0,
        quantidade_base: Number(synced?.quantidade_base) || 0,
        fator_aplicado: Number(synced?.fator_conversao) || 1,
        frete_unitario_fator1: Number(synced?.custo_frete_unitario) || 0,
        outros_unitario_fator1: Number(synced?.custo_outros_unitario) || 0,
        desconto_unitario_fator1: Number(synced?.valor_desconto_item ?? synced?.desconto_unitario) || 0,
        total: Number(synced?.total) > 0 ? Number(synced.total) : totalLinha,
      });
      return {
        id: synced?.pedido_compra_item_id || synced?.id || undefined,
        produto_id: synced?.produto_id || '',
        produto_unidade_id: synced?.produto_unidade_id || '',
        unidade_sigla: synced?.unidade_medida || synced?.unidade_apresentacao || '',
        quantidade_comercial: (normalizado.quantidade_comercial ?? Number(synced?.quantidade)) || 0,
        custo_unitario_fator1: normalizado.custo_unitario_fator1,
        frete_unitario_fator1: normalizado.frete_unitario_fator1 ?? 0,
        outros_unitario_fator1: normalizado.outros_unitario_fator1 ?? 0,
        desconto_unitario_fator1: 0,
        valor_desconto_item: 0,
        total: normalizado.total ?? totalLinha,
        quantidade_vinculada: Number(synced?.quantidade_vinculada) || 0,
        ordem: idx,
        observacoes: typeof synced?.observacoes === 'string' ? synced.observacoes : '',
        status_recebimento: synced?.status_recebimento || 'Pendente',
      };
    })
    .filter((it) => it.produto_id && it.quantidade_comercial > 0);
}

export async function executarTrocaRapidaPedidoCompra(base44, {
  pedido = {},
  itemIndex = -1,
  produtoSubstituto = {},
  motivo = '',
  responsavel = '',
  onSave,
} = {}) {
  if (!pedido?.id) throw new Error('Salve o pedido antes de trocar itens.');
  if (typeof onSave !== 'function') throw new Error('Função de salvamento indisponível.');

  const preview = calcularPreviewTrocaPedidoCompra(pedido, itemIndex, produtoSubstituto);
  const notaHistorico = formatNotaHistoricoTroca({
    itemOriginal: preview.itemOriginal,
    itemNovo: preview.itemNovo,
    diferenca: preview.diferencaPedido,
    motivo,
    responsavel,
  });

  const dataToSave = {
    ...pedido,
    itens: preview.itensNovos,
    valor_itens: preview.valorItens,
    valor_total: preview.valorNovo,
    historico: `${pedido.historico || ''}${notaHistorico}`,
  };

  const pedidoSalvo = await onSave(dataToSave);

  const itensCanonicos = mapItensCanonicosParaPersist(preview.itensNovos);
  if (itensCanonicos.length > 0) {
    await savePedidoCompraItem({
      action: 'replaceAll',
      pedido_compra_id: pedido.id,
      items: itensCanonicos,
    });
    await base44.entities.PedidoCompra.update(pedido.id, {
      valor_itens: preview.valorItens,
      valor_total: preview.valorNovo,
      valor_desconto: roundToTwoDecimals(Number(pedido.valor_desconto) || 0),
    });
  }

  let ajusteFinanceiro = null;
  if (Math.abs(preview.diferencaPedido) >= 0.01) {
    const lancamentos = await listarLancamentosPedidoCompra(base44, pedido.id);
    if (temLancamentoPagoParaPedido(lancamentos)) {
      ajusteFinanceiro = await criarLancamentoAjustePedidoCompra(base44, {
        pedido: {
          id: pedido.id,
          numero: pedidoSalvo?.numero || pedido.numero,
          fornecedor_id: pedido.fornecedor_id,
          fornecedor_nome: pedido.fornecedor_nome,
        },
        diferenca: preview.diferencaPedido,
        valorAnterior: preview.valorAnterior,
        valorNovo: preview.valorNovo,
        motivo: motivo || `Troca: ${preview.itemOriginal.produto_nome} → ${preview.itemNovo.produto_nome}`,
        responsavel,
      });
    }
  }

  return {
    pedidoSalvo,
    preview,
    ajusteFinanceiro,
    notaHistorico,
  };
}
