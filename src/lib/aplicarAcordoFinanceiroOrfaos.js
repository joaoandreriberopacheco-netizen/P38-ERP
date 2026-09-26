/**
 * Baixa logística de itens órfãos após acordo financeiro — alinhada à folha 4 colunas:
 * comprada → despachada → recebida → saldo pendente
 * (saldo_pendente = comprada − recebida − em_trânsito, em_trânsito = despachada − recebida).
 */

import { formatarLogTime } from '@/components/utils/dateUtils';
import { buildItensCanonicosEmbarque } from '@/lib/buildEmbarqueItensCanonicos';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import {
  calcularTotalDespachadoBasePorProduto,
  qtyEmbarcadaBaseLinha,
  qtyPedidaBaseItem,
  qtyRecebidaBaseLinha,
} from '@/lib/embarqueLogisticaHelpers';
import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  calcTotalItemCompraPedido,
  commercialQuantityFromBase,
  getItemCompraExibicaoVitrine,
} from '@/lib/productUnits';
import {
  calcValorItensPedidoCompra,
  calcValorTotalPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';
import { isEmbarqueReal, isEmbarqueSaldoPendente } from '@/lib/embarqueTipoSaldoPendente';

const MIN_BASE = 0.009;

/** Browser usa helper global; scripts passam `base44.functions` (Supabase Edge). */
async function saveEmbarqueItemReplaceAllEntities(base44, body) {
  const embarqueId = String(body?.embarque_id || '').trim();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!embarqueId) throw new Error('embarque_id obrigatório');
  const existing = await base44.entities.EmbarqueItem.filter({ embarque_id: embarqueId });
  for (const row of existing || []) {
    if (row?.id) await base44.entities.EmbarqueItem.delete(row.id);
  }
  for (const item of items) {
    await base44.entities.EmbarqueItem.create({ ...item, embarque_id: embarqueId });
  }
}

async function invokeSaveEmbarqueItem(base44, body) {
  if (body?.action === 'replaceAll' && base44?.entities?.EmbarqueItem) {
    try {
      if (base44?.functions?.invoke) {
        const { data } = await base44.functions.invoke('saveEmbarqueItem', body);
        return data;
      }
    } catch (err) {
      if (!/Unauthorized/i.test(String(err?.message || err))) throw err;
    }
    await saveEmbarqueItemReplaceAllEntities(base44, body);
    return { success: true };
  }
  if (base44?.functions?.invoke) {
    const { data } = await base44.functions.invoke('saveEmbarqueItem', body);
    return data;
  }
  return saveEmbarqueItem(body);
}

/** Soma recebida em embarques reais (exclui saldo pendente pós-recepção). */
export function calcularTotalRecebidoBasePorProduto(embarques = []) {
  const map = {};
  (embarques || [])
    .filter((emb) => isEmbarqueReal(emb))
    .forEach((emb) => {
      getEmbarqueItensLinhas(emb).forEach((linha) => {
        const pid = linha?.produto_id;
        if (!pid) return;
        const add = qtyRecebidaBaseLinha(linha);
        map[pid] = roundToTwoDecimals((map[pid] || 0) + add);
      });
    });
  return map;
}

/** Saldo em embarques tipo Pendente (pós-recepção). */
export function calcularNecessidadeBasePorProduto(embarques = []) {
  const map = {};
  (embarques || [])
    .filter((emb) => isEmbarqueSaldoPendente(emb))
    .forEach((emb) => {
      getEmbarqueItensLinhas(emb).forEach((linha) => {
        const pid = linha?.produto_id;
        if (!pid) return;
        const add = qtyEmbarcadaBaseLinha(linha);
        if (add > MIN_BASE) {
          map[pid] = roundToTwoDecimals((map[pid] || 0) + add);
        }
      });
    });
  return map;
}

/**
 * Folha 4 colunas por linha de pedido (modo legacy agregado em embarques reais).
 */
export function calcularFolhaLogisticaLinha(item = {}, embarques = []) {
  const pid = item?.produto_id;
  const comprada = qtyPedidaBaseItem(item);
  const despachada = roundToTwoDecimals(
    calcularTotalDespachadoBasePorProduto(embarques)[pid] || 0,
  );
  const recebida = roundToTwoDecimals(calcularTotalRecebidoBasePorProduto(embarques)[pid] || 0);
  const emTransito = roundToTwoDecimals(Math.max(0, despachada - recebida));
  const saldoPendente = roundToTwoDecimals(
    Math.max(0, comprada - recebida - emTransito),
  );
  return { comprada, despachada, recebida, emTransito, saldoPendente };
}

/**
 * Particiona a baixa do órfão: Pendente (pós-recepção) → trânsito (embarque real) → comprada.
 */
export function particionarBaixaOrfaoAcordo({
  itemPedido,
  embarques = [],
  qtdBaixaBase,
}) {
  const pid = itemPedido?.produto_id;
  const qtd = roundToTwoDecimals(Math.max(0, Number(qtdBaixaBase) || 0));
  const necessidadeMap = calcularNecessidadeBasePorProduto(embarques);
  const despachadoMap = calcularTotalDespachadoBasePorProduto(embarques);
  const necessidadeBase = roundToTwoDecimals(necessidadeMap[pid] || 0);
  const pedidaBase = qtyPedidaBaseItem(itemPedido);
  const faltaDespachoBase = roundToTwoDecimals(
    Math.max(0, pedidaBase - (despachadoMap[pid] || 0)),
  );

  const folhaAntes = calcularFolhaLogisticaLinha(itemPedido, embarques);
  const emTransitoBase = roundToTwoDecimals(Math.max(0, folhaAntes.emTransito));

  const baixaNecessidade = roundToTwoDecimals(Math.min(qtd, necessidadeBase));
  let restante = roundToTwoDecimals(qtd - baixaNecessidade);
  const baixaTransito = roundToTwoDecimals(Math.min(restante, emTransitoBase));
  restante = roundToTwoDecimals(restante - baixaTransito);
  const baixaComprada = roundToTwoDecimals(Math.min(restante, faltaDespachoBase));

  return {
    produto_id: pid,
    qtd_baixa_total: qtd,
    baixa_necessidade_base: baixaNecessidade,
    baixa_transito_base: baixaTransito,
    baixa_comprada_base: baixaComprada,
    nao_aplicado_base: roundToTwoDecimals(restante - baixaComprada),
    folha_antes: folhaAntes,
  };
}

function reduzirItemPedidoCompra(item = {}, reduzirBase = 0, produto = null) {
  const reduzir = roundToTwoDecimals(Math.max(0, Number(reduzirBase) || 0));
  if (reduzir <= MIN_BASE) return item;

  const fator = Number(item?.fator_aplicado ?? item?.fator_conversao) || 1;
  const pedidaBase = qtyPedidaBaseItem(item);
  const novaBase = roundToTwoDecimals(Math.max(0, pedidaBase - reduzir));
  const exib = getItemCompraExibicaoVitrine(item, produto);
  const novaComercial = commercialQuantityFromBase(
    novaBase,
    exib.fator_conversao || fator,
    exib.unidade_medida,
  );

  const atualizado = {
    ...item,
    quantidade: novaComercial,
    quantidade_base: novaBase,
  };
  const total = calcTotalItemCompraPedido(atualizado);
  return {
    ...atualizado,
    total,
    valor_total_item: total,
    subtotal: total,
  };
}

function aplicarBaixaNecessidadeEmbarque(embarque, produtoId, reduzirBase, lancamentoId, pedidoItens) {
  const reduzir = roundToTwoDecimals(Math.max(0, Number(reduzirBase) || 0));
  if (reduzir <= MIN_BASE) {
    return { embarque, canonicos: [], aplicado: 0 };
  }

  let restante = reduzir;
  const linhas = getEmbarqueItensLinhas(embarque).map((linha) => {
    if (String(linha?.produto_id) !== String(produtoId) || restante <= MIN_BASE) {
      return linha;
    }
    const embBase = qtyEmbarcadaBaseLinha(linha);
    const take = roundToTwoDecimals(Math.min(restante, embBase));
    restante = roundToTwoDecimals(restante - take);
    const novaEmbBase = roundToTwoDecimals(Math.max(0, embBase - take));
    const pedidoItem = (pedidoItens || []).find(
      (pi) => String(pi?.produto_id) === String(produtoId),
    );
    const fator = Number(linha?.fator_aplicado ?? pedidoItem?.fator_aplicado ?? 1) || 1;
    const novaEmbCom = commercialQuantityFromBase(novaEmbBase, fator, linha?.unidade_medida);

    return {
      ...linha,
      quantidade_embarcada: novaEmbBase,
      quantidade_embarcada_base: novaEmbBase,
      quantidade_embarcada_apresentacao: novaEmbCom,
      quantidade_embarcada_comercial: novaEmbCom,
      acordo_financeiro_lancamento_id: take > MIN_BASE ? lancamentoId : (linha.acordo_financeiro_lancamento_id || ''),
      observacoes: take > MIN_BASE
        ? `${linha.observacoes || ''} | Baixa acordo financeiro (−${take} base)`.trim()
        : linha.observacoes,
    };
  });

  const aplicado = roundToTwoDecimals(reduzir - restante);
  const itensNorm = linhas.filter((l) => qtyEmbarcadaBaseLinha(l) > MIN_BASE);
  const canonicos = buildItensCanonicosEmbarque(itensNorm, pedidoItens).map((c) => ({
    ...c,
    acordo_financeiro_lancamento_id: lancamentoId,
  }));

  return { embarque: { ...embarque, _linhas: linhas }, canonicos, aplicado };
}

/** Reduz quantidade embarcada (não recebida) em embarques reais — mercadoria em trânsito perdida. */
function aplicarBaixaTransitoEmbarqueReal(embarque, produtoId, reduzirBase, lancamentoId, pedidoItens) {
  if (isEmbarqueSaldoPendente(embarque)) {
    return { embarque, canonicos: [], aplicado: 0 };
  }
  const reduzir = roundToTwoDecimals(Math.max(0, Number(reduzirBase) || 0));
  if (reduzir <= MIN_BASE) {
    return { embarque, canonicos: [], aplicado: 0 };
  }

  let restante = reduzir;
  const linhas = getEmbarqueItensLinhas(embarque).map((linha) => {
    if (String(linha?.produto_id) !== String(produtoId) || restante <= MIN_BASE) {
      return linha;
    }
    const embBase = qtyEmbarcadaBaseLinha(linha);
    const recBase = qtyRecebidaBaseLinha(linha);
    const transitoLinha = roundToTwoDecimals(Math.max(0, embBase - recBase));
    const take = roundToTwoDecimals(Math.min(restante, transitoLinha));
    restante = roundToTwoDecimals(restante - take);
    const novaEmbBase = roundToTwoDecimals(Math.max(recBase, embBase - take));
    const pedidoItem = (pedidoItens || []).find(
      (pi) => String(pi?.produto_id) === String(produtoId),
    );
    const fator = Number(linha?.fator_aplicado ?? pedidoItem?.fator_aplicado ?? 1) || 1;
    const novaEmbCom = commercialQuantityFromBase(novaEmbBase, fator, linha?.unidade_medida);

    return {
      ...linha,
      quantidade_embarcada: novaEmbBase,
      quantidade_embarcada_base: novaEmbBase,
      quantidade_embarcada_apresentacao: novaEmbCom,
      quantidade_embarcada_comercial: novaEmbCom,
      acordo_financeiro_lancamento_id: take > MIN_BASE ? lancamentoId : (linha.acordo_financeiro_lancamento_id || ''),
      observacoes: take > MIN_BASE
        ? `${linha.observacoes || ''} | Baixa acordo (trânsito −${take} base)`.trim()
        : linha.observacoes,
    };
  });

  const aplicado = roundToTwoDecimals(reduzir - restante);
  const itensNorm = linhas.filter((l) => qtyEmbarcadaBaseLinha(l) > MIN_BASE || qtyRecebidaBaseLinha(l) > MIN_BASE);
  const canonicos = buildItensCanonicosEmbarque(itensNorm, pedidoItens).map((c) => ({
    ...c,
    acordo_financeiro_lancamento_id: lancamentoId,
  }));

  return { embarque: { ...embarque, _linhas: linhas }, canonicos, aplicado };
}

async function recarregarLinhasEmbarqueNoArray(base44, embarquesLocal, embarqueId) {
  const idx = embarquesLocal.findIndex((e) => String(e?.id) === String(embarqueId));
  if (idx < 0 || !base44?.entities?.EmbarqueItem) return;
  const linhas = await base44.entities.EmbarqueItem.filter({ embarque_id: embarqueId });
  embarquesLocal[idx] = {
    ...embarquesLocal[idx],
    _linhas: rebuildEmbarqueItensMirror(linhas || []),
  };
}

/**
 * Aplica baixa logística após criar o lançamento financeiro.
 * @returns {Promise<{ ok: boolean, resumo: object[] }>}
 */
export async function aplicarBaixaLogisticaAcordoFinanceiroOrfaos(
  base44,
  {
    pedido,
    embarques = [],
    itensOrfaos = [],
    lancamentoId,
    produtosMap = {},
    baixarQuantidades = true,
    appendHistorico = true,
    historicoSufixoExtra = '',
  },
) {
  if (!baixarQuantidades) {
    return { ok: true, resumo: [], skipped: true };
  }
  if (!pedido?.id || !lancamentoId) {
    return { ok: false, error: 'pedido ou lançamento ausente' };
  }

  const pedidoItens = Array.isArray(pedido.itens) ? [...pedido.itens] : [];
  const embarquesLocal = Array.isArray(embarques) ? [...embarques] : [];
  const resumo = [];

  for (const orfao of itensOrfaos) {
    const pid = orfao?.produto_id;
    if (!pid) continue;
    const itemPedido = pedidoItens.find((it) => String(it?.produto_id) === String(pid));
    if (!itemPedido) continue;

    const qtdBaixaBase = roundToTwoDecimals(
      Number(orfao.qtd_baixa_base ?? orfao.qtd_pendente) || 0,
    );
    if (qtdBaixaBase <= MIN_BASE) continue;

    const plano = particionarBaixaOrfaoAcordo({
      itemPedido,
      embarques: embarquesLocal,
      qtdBaixaBase,
    });

    let aplicadoNecessidade = 0;
    if (plano.baixa_necessidade_base > MIN_BASE) {
      const necessidadeEmbarques = embarquesLocal.filter((e) => isEmbarqueSaldoPendente(e));
      for (const emb of necessidadeEmbarques) {
        if (aplicadoNecessidade >= plano.baixa_necessidade_base - MIN_BASE) break;
        const faltante = roundToTwoDecimals(plano.baixa_necessidade_base - aplicadoNecessidade);
        const { canonicos, aplicado } = aplicarBaixaNecessidadeEmbarque(
          emb,
          pid,
          faltante,
          lancamentoId,
          pedidoItens,
        );
        if (aplicado > MIN_BASE && emb?.id) {
          await invokeSaveEmbarqueItem(base44, {
            action: 'replaceAll',
            embarque_id: emb.id,
            items: canonicos || [],
          });
          await recarregarLinhasEmbarqueNoArray(base44, embarquesLocal, emb.id);
          aplicadoNecessidade = roundToTwoDecimals(aplicadoNecessidade + aplicado);
        }
      }
    }

    let aplicadoTransito = 0;
    if (plano.baixa_transito_base > MIN_BASE) {
      const embarquesReais = embarquesLocal.filter((e) => isEmbarqueReal(e));
      for (const emb of embarquesReais) {
        if (aplicadoTransito >= plano.baixa_transito_base - MIN_BASE) break;
        const faltante = roundToTwoDecimals(plano.baixa_transito_base - aplicadoTransito);
        const { canonicos, aplicado } = aplicarBaixaTransitoEmbarqueReal(
          emb,
          pid,
          faltante,
          lancamentoId,
          pedidoItens,
        );
        if (aplicado > MIN_BASE && emb?.id) {
          await invokeSaveEmbarqueItem(base44, {
            action: 'replaceAll',
            embarque_id: emb.id,
            items: canonicos || [],
          });
          await recarregarLinhasEmbarqueNoArray(base44, embarquesLocal, emb.id);
          aplicadoTransito = roundToTwoDecimals(aplicadoTransito + aplicado);
        }
      }
    }

    const reduzirCompradaBase = roundToTwoDecimals(
      plano.baixa_comprada_base + (plano.baixa_transito_base || 0),
    );
    let itemAtualizado = itemPedido;
    if (reduzirCompradaBase > MIN_BASE) {
      const idx = pedidoItens.findIndex((it) => String(it?.produto_id) === String(pid));
      itemAtualizado = reduzirItemPedidoCompra(
        itemPedido,
        reduzirCompradaBase,
        produtosMap[pid] || null,
      );
      if (idx >= 0) pedidoItens[idx] = itemAtualizado;
    }

    const folhaDepois = calcularFolhaLogisticaLinha(itemAtualizado, embarquesLocal);
    resumo.push({
      produto_id: pid,
      produto_nome: orfao.produto_nome || itemPedido.produto_nome,
      ...plano,
      aplicado_necessidade_base: aplicadoNecessidade,
      aplicado_transito_base: aplicadoTransito,
      folha_depois: folhaDepois,
    });
  }

  const pedidoPatch = {
    itens: pedidoItens,
    valor_itens: calcValorItensPedidoCompra({ ...pedido, itens: pedidoItens }),
  };
  pedidoPatch.valor_total = calcValorTotalPedidoCompra({ ...pedido, ...pedidoPatch });

  const resumoTxt = resumo
    .map(
      (r) =>
        `${r.produto_nome}: −${r.qtd_baixa_total} base (Pend ${r.aplicado_necessidade_base}, trânsito ${r.aplicado_transito_base ?? 0}, comprada ${r.baixa_comprada_base})`,
    )
    .join('; ');

  if (appendHistorico) {
    const extra = historicoSufixoExtra ? ` ${historicoSufixoExtra}` : '';
    pedidoPatch.historico =
      `${pedido.historico || ''}\n[ACORDO FINANCEIRO ÓRFÃOS | lançamento=${lancamentoId} | ${resumoTxt}${extra} | ${formatarLogTime()}]`.trim();
  } else if (historicoSufixoExtra) {
    pedidoPatch.historico =
      `${pedido.historico || ''}\n[${historicoSufixoExtra} | lançamento=${lancamentoId} | ${resumoTxt} | ${formatarLogTime()}]`.trim();
  }

  await base44.entities.PedidoCompra.update(pedido.id, pedidoPatch);

  return { ok: true, resumo };
}
