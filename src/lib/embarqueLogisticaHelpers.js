import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  resolveEmbarqueQuantidadeBase,
  resolveEmbarqueQuantidadeComercial,
} from '@/lib/embarqueQuantityResolve';
import { getEmbarqueItensLinhas, hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';
import { commercialQuantityFromBase, getItemCompraExibicaoVitrine } from '@/lib/productUnits';

function qtyPedidaBaseItem(item = {}) {
  return resolveEmbarqueQuantidadeBase(
    {
      ...item,
      quantidade_pedida_base: item.quantidade_base,
      quantidade_pedida_apresentacao: item.quantidade_pedida_apresentacao ?? item.quantidade,
      quantidade_pedida: item.quantidade,
    },
    'pedida',
  );
}

/** Quantidade embarcada em unidade base — alinhado a integrarPedidosEmbarques (SQL). */
export function qtyEmbarcadaBaseLinha(item = {}) {
  return resolveEmbarqueQuantidadeBase(item, 'embarcada');
}

function qtyRecebidaBaseLinha(item = {}) {
  return resolveEmbarqueQuantidadeBase(item, 'recebida');
}

/** Mínimo em unidade base (M², UN fator 1…) para contar saldo pendente real. */
export const MIN_SALDO_PENDENTE_BASE = 0.009;

/** Saldo pendente do split em base — comparação correcta entre PAC/CX/M². */
export function resolveSaldoPendenteEmbarqueBase(linha = {}) {
  const emb = qtyEmbarcadaBaseLinha(linha);
  const rec = qtyRecebidaBaseLinha(linha);
  return roundToTwoDecimals(Math.max(0, emb - rec));
}

export function embarqueTemSaldoPendente(embarque, minBase = MIN_SALDO_PENDENTE_BASE) {
  return getEmbarqueItensLinhas(embarque).some(
    (linha) => resolveSaldoPendenteEmbarqueBase(linha) > minBase,
  );
}

/** Despacho editável enquanto a recepção deste embarque ainda não começou. */
export function podeEditarDespachoEmbarque(embarque) {
  const status = String(embarque?.status_recebimento || embarque?.status_recebimento_embarque || 'Pendente').trim();
  return !status || status === 'Pendente';
}

/**
 * Recepção concluída neste split (inclui recepção em pacotes com status ainda Pendente).
 * Usa unidade base; exibição continua em vitrine na UI.
 */
export function embarqueRecepcaoDocumentalCompleta(embarque) {
  const linhas = getEmbarqueItensLinhas(embarque);
  if (!linhas.length) return false;
  if (embarqueTemSaldoPendente(embarque)) return false;

  const status = String(embarque.status_recebimento || embarque.status_recebimento_embarque || '').trim();
  if (status === 'Recebido OK' || embarque.status === 'Concluído') return true;
  if (status === 'Com Divergência' || status === 'Recebido Parcial') return true;

  const temRecebido = linhas.some((l) => qtyRecebidaBaseLinha(l) > MIN_SALDO_PENDENTE_BASE);
  const temEmbarcado = linhas.some((l) => qtyEmbarcadaBaseLinha(l) > MIN_SALDO_PENDENTE_BASE);
  return temRecebido && temEmbarcado;
}

/**
 * Percentuais de despacho/conclusão a partir dos embarques reais (entidade Embarque),
 * alinhado à lógica de `integrarPedidosEmbarques` mas sem depender do snapshot no PedidoCompra.
 */
export function calcularPercentuaisLogistica(pedido, embarques = []) {
  const totalPedido = (pedido?.itens || []).reduce(
    (acc, item) => acc + qtyPedidaBaseItem(item),
    0,
  );
  if (!totalPedido) {
    return { despachado: 0, concluido: 0, pendente: 100 };
  }

  const linhas = (embarques || []).filter((emb) => emb?.tipo !== 'Necessidade');
  const porProdutoEmb = {};
  const porProdutoRec = {};

  linhas.forEach((emb) => {
    getEmbarqueItensLinhas(emb).forEach((item) => {
      const pid = item.produto_id;
      if (!pid) return;
      porProdutoEmb[pid] = (porProdutoEmb[pid] || 0) + qtyEmbarcadaBaseLinha(item);
      porProdutoRec[pid] = (porProdutoRec[pid] || 0) + qtyRecebidaBaseLinha(item);
    });
  });

  let totalDespachado = 0;
  let totalConcluido = 0;
  (pedido?.itens || []).forEach((item) => {
    const pedida = qtyPedidaBaseItem(item);
    const emb = porProdutoEmb[item.produto_id] || 0;
    const rec = porProdutoRec[item.produto_id] || 0;
    totalDespachado += Math.min(pedida, emb);
    totalConcluido += Math.min(pedida, rec);
  });

  const pd = Number(((totalDespachado / totalPedido) * 100).toFixed(2));
  const pc = Number(((totalConcluido / totalPedido) * 100).toFixed(2));
  const pp = Number(Math.max(0, 100 - pd).toFixed(2));

  return { despachado: pd, concluido: pc, pendente: pp };
}

export function derivarStatusEmbarqueAgregado(pctDespachado) {
  if (pctDespachado >= 100) return 'Total';
  if (pctDespachado > 0) return 'Parcial';
  return 'Nenhum';
}

/** Quantidade comercial para exibição em órfãos / totais por produto. */
export function qtyEmbarcadaComercialLinha(item = {}) {
  return resolveEmbarqueQuantidadeComercial(item, 'embarcada');
}

/**
 * Itens aguardando novo despacho:
 * 1) saldo em embarques tipo Necessidade (pós-recepção com divergência), e
 * 2) quantidade do pedido ainda não coberta por despachos reais.
 */
/**
 * Converte pendência em base (M²) para unidade vitrine/logística (ex.: CX).
 * `qtd_pendente` nos órfãos é sempre em base — evita comparar CX com M².
 */
export function qtyPendenteComercialParaExibicao(item = {}, produto = null) {
  const pendenteBase = Number(item.qtd_pendente) || 0;
  if (pendenteBase <= 0.009) {
    return { quantidade: 0, unidade: item.unidade_medida || 'UN' };
  }
  const exib = getItemCompraExibicaoVitrine(item, produto);
  return {
    quantidade: commercialQuantityFromBase(pendenteBase, exib.fator_conversao, exib.unidade_medida),
    unidade: exib.unidade_medida || item.unidade_medida || 'UN',
  };
}

export function calcularItensOrfaosAguardandoDespacho(
  pedido,
  embarques = [],
  totalEmbarcadoPorProduto = {},
  produtosMap = {},
) {
  const pendentePorProduto = {};

  (embarques || [])
    .filter((emb) => emb?.tipo === 'Necessidade')
    .forEach((emb) => {
      getEmbarqueItensLinhas(emb).forEach((linha) => {
        const pid = linha?.produto_id;
        if (!pid) return;
        const q = qtyEmbarcadaBaseLinha(linha);
        if (q > 0) {
          pendentePorProduto[pid] = roundToTwoDecimals((pendentePorProduto[pid] || 0) + q);
        }
      });
    });

  (pedido?.itens || []).forEach((item) => {
    const pid = item?.produto_id;
    if (!pid) return;
    const pedidaBase = qtyPedidaBaseItem(item);
    const embarcadoBase = Number(totalEmbarcadoPorProduto[pid]) || 0;
    const faltaDespacho = Math.max(0, pedidaBase - embarcadoBase);
    if (faltaDespacho > 0.009) {
      pendentePorProduto[pid] = roundToTwoDecimals((pendentePorProduto[pid] || 0) + faltaDespacho);
    }
  });

  return (pedido?.itens || [])
    .map((item) => {
      const qtdPendenteBase = roundToTwoDecimals(pendentePorProduto[item.produto_id] || 0);
      const exibCom = qtyPendenteComercialParaExibicao(
        { ...item, qtd_pendente: qtdPendenteBase },
        produtosMap[item.produto_id] || null,
      );
      return {
        ...item,
        qtd_pendente: qtdPendenteBase,
        qtd_pendente_comercial: exibCom.quantidade,
        unidade_pendente_exibicao: exibCom.unidade,
      };
    })
    .filter((item) => item.qtd_pendente > 0.009);
}

function calcularTotalEmbarcadoBase(embarques = []) {
  const map = {};
  (embarques || []).forEach((emb) => {
    if (emb?.tipo === 'Necessidade') return;
    if (!(emb?.data_embarque || emb?.eta || emb?.transportadora_id || emb?.transportadora_nome)) return;
    getEmbarqueItensLinhas(emb).forEach((item) => {
      const pid = item?.produto_id;
      if (!pid) return;
      const add = qtyEmbarcadaBaseLinha(item);
      map[pid] = roundToTwoDecimals((map[pid] || 0) + add);
    });
  });
  return map;
}

/** Órfãos com cálculo automático do total embarcado (para Logs e listagens). */
export function calcularItensOrfaosPedido(pedido, embarques = [], produtosMap = {}) {
  return calcularItensOrfaosAguardandoDespacho(
    pedido,
    embarques,
    calcularTotalEmbarcadoBase(embarques),
    produtosMap,
  );
}

/** Embarques com recepção divergente ou parcial (para aba Logs). */
export function listarEmbarquesComDivergenciaRecepcao(embarques = []) {
  return (embarques || []).filter((emb) => {
    const st = emb?.status_recebimento || emb?.status_recebimento_embarque || '';
    const obs = String(emb?.observacoes || '').toLowerCase();
    return /diverg|parcial/i.test(st) || obs.includes('divergência') || obs.includes('divergencia');
  });
}

/**
 * Percentuais de despacho/conclusão a partir de `_linhas` (EmbarqueItem SQL).
 */
export async function hydrateEmbarquesLinhasDesdeCanonical(base44, pedidoCompraId, embarques) {
  return hydrateEmbarquesPedidoFromSql(base44, pedidoCompraId, embarques);
}

export { rebuildEmbarqueItensMirror };
