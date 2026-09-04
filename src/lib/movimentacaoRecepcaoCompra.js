/**
 * Payload para entrada de stock na receção de embarque (pedido de compra), enviado apenas ao
 * SDK Base44 → entidade `MovimentacaoEstoque` na **database Base44** (sem canal paralelo).
 *
 * O recálculo na cloud (`recalcularEstoqueProduto`) usa `produto_id`, `tipo`, `quantidade`;
 * os restantes campos servem rastreio no painel Base44.
 */

import { invokeRecalcularEstoqueProduto } from './p38StockRecalc.js';
import { calculateBaseQuantity, getCustoCompraLiquidoFator1 } from './productUnits.js';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { fetchPedidoCompraItensPorPedidos, linhasPedidoCompraToLegacyItens } from '@/lib/fetchPedidoCompraItens';

const round6 = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

/** Fator da linha do pedido/embarque (ex.: 200 para CX de estribo). */
export function resolveFatorRecepcaoCompra(purchaseItem = {}, receiptItem = {}) {
  const fatorApresentacao = Number(
    receiptItem?.fator_apresentacao
      ?? receiptItem?.fator_aplicado
      ?? purchaseItem?.fator_apresentacao
      ?? purchaseItem?.fator_aplicado
      ?? 0,
  );
  if (fatorApresentacao > 0) return fatorApresentacao;

  const fator = Number(
    purchaseItem?.fator_conversao
      ?? purchaseItem?.fator_aplicado
      ?? receiptItem?.fator_conversao
      ?? receiptItem?.fator_aplicado
      ?? 1,
  ) || 1;
  return fator > 0 ? fator : 1;
}

function resolveUnidadeRecepcaoCompra(purchaseItem = {}, receiptItem = {}) {
  return (
    purchaseItem?.unidade_medida
    || purchaseItem?.unidade_sigla
    || receiptItem?.unidade_medida
    || receiptItem?.unidade_sigla
    || ''
  );
}

/** Compara código do embarque com observações/documento (Base44 pode gravar maiúsculas diferentes). */
export function movimentoCombinaCodigoEmbarque(mov, codigoExibicao) {
  if (!codigoExibicao || !mov) return false;
  const c = String(codigoExibicao).trim().toLowerCase();
  if (!c) return false;
  const obs = String(mov.observacoes || '').toLowerCase();
  const doc = String(mov.documento_referencia || '').trim().toLowerCase();
  return obs.includes(c) || doc === c;
}

export function buildMovimentacaoRecepcaoCompraPayload({
  produtoId,
  produtoNome,
  /** Quantidade comercial (ex.: 30 CX) — convertida para base antes de gravar em `quantidade`. */
  quantidade,
  pedido,
  embarque,
  purchaseItem,
  receiptItem,
}) {
  const refTipo = 'PedidoCompra';
  const refId = pedido?.id;
  const refNumero = pedido?.numero != null ? String(pedido.numero) : '';
  const embCodigo =
    embarque?.codigo_exibicao != null && String(embarque.codigo_exibicao).trim() !== ''
      ? String(embarque.codigo_exibicao).trim()
      : embarque?.numero != null
        ? String(embarque.numero)
        : '';

  const fator = resolveFatorRecepcaoCompra(purchaseItem, receiptItem);
  const qtyComercial = Number(quantidade) || 0;
  const qtyBase = round6(calculateBaseQuantity(qtyComercial, fator));
  const unidade = resolveUnidadeRecepcaoCompra(purchaseItem, receiptItem);

  const observacoes = embCodigo
    ? `Recepção pedido ${refNumero} · embarque ${embCodigo}${unidade && fator > 1 ? ` · ${qtyComercial} ${unidade}` : ''}`
    : `Recepção pedido ${refNumero}`;
  const custoLiquido = getCustoCompraLiquidoFator1(purchaseItem);

  return {
    produto_id: produtoId,
    produto_nome: produtoNome,
    tipo: 'Entrada',
    motivo: 'Compra',
    quantidade: qtyBase,
    quantidade_base: qtyBase,
    quantidade_comercial: qtyComercial,
    fator_conversao: fator,
    ...(unidade ? { unidade_medida: unidade, unidade_sigla: unidade } : {}),
    ...(purchaseItem?.produto_unidade_id ? { produto_unidade_id: purchaseItem.produto_unidade_id } : {}),
    ...(custoLiquido > 0 ? { custo_unitario: custoLiquido } : {}),
    referencia_tipo: refTipo,
    referencia_id: refId,
    referencia_numero: refNumero,
    /** Liga o movimento ao embarque na UI (aba Recepção) e no painel Base44. */
    documento_referencia: embCodigo || undefined,
    observacoes,
    ...(pedido?.fornecedor_nome ? { fornecedor_nome: pedido.fornecedor_nome, terceiro_nome: pedido.fornecedor_nome } : {}),
  };
}

/**
 * Para embarques já «recebidos» na UI mas sem linhas em MovimentacaoEstoque (legado ou falha intermedia).
 * Cria apenas movimentos em falta (evita duplicar quando já há marca do código do embarque nas observações / documento_referencia).
 *
 * @returns número de movimentos criados
 */
export async function criarMovimentosStockRecepcaoEmFalta(base44, { pedido, embarque, movimentosExistentes = [] }) {
  const itens = getEmbarqueItensLinhas(embarque);

  const codigoEmb = String(embarque?.codigo_exibicao || '').trim();

  let criados = 0;
  for (const item of itens) {
    const qRec = Number(item.quantidade_recebida) || 0;
    if (qRec <= 0) continue;
    const produtoId = item.produto_id_recebido_diferente || item.produto_id;
    if (!produtoId) continue;

    const jaExiste = movimentosExistentes.some((m) => {
      const marcaPorCodigo = codigoEmb && movimentoCombinaCodigoEmbarque(m, codigoEmb);
      const mesmoProduto =
        String(m.produto_id) === String(produtoId) &&
        m.tipo === 'Entrada' &&
        (m.motivo === 'Compra' || m.motivo == null || m.motivo === '');
      return marcaPorCodigo && mesmoProduto;
    });

    if (jaExiste) continue;

    let purchaseItem = (Array.isArray(pedido?.itens) ? pedido.itens : []).find(
      (pi) => String(pi?.produto_id) === String(item?.produto_id),
    );
    if (!purchaseItem && pedido?.id && base44?.entities?.PedidoCompraItem?.filter) {
      const byPedido = await fetchPedidoCompraItensPorPedidos(base44, [pedido.id]);
      const linhas = byPedido.get(pedido.id) || [];
      const legado = linhasPedidoCompraToLegacyItens(linhas);
      purchaseItem = legado.find((pi) => String(pi?.produto_id) === String(item?.produto_id));
    }
    purchaseItem = purchaseItem || item;

    await base44.entities.MovimentacaoEstoque.create(
      buildMovimentacaoRecepcaoCompraPayload({
        produtoId,
        produtoNome: item.produto_nome_recebido_diferente || item.produto_nome,
        quantidade: qRec,
        pedido,
        embarque,
        purchaseItem,
        receiptItem: item,
      })
    );
    await invokeRecalcularEstoqueProduto(base44, produtoId);
    criados += 1;
  }

  return criados;
}
