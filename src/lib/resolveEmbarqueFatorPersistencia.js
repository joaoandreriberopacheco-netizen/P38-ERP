/**
 * Fator/unidade para gravar embarque_item: vence a unidade da **ação**
 * (despacho/recepção), não o fator do pedido quando o pedido está em outra UM (ex. M² fator 1).
 */
import { normalizeUnitCode } from '@/lib/productUnits';

function fatorNum(item = {}) {
  return (
    Number(item?.fator_apresentacao ?? item?.fator_aplicado ?? item?.fator_conversao) || 0
  );
}

function unidadeSigla(item = {}) {
  return normalizeUnitCode(
    item?.unidade_apresentacao || item?.unidade_sigla || item?.unidade_medida || '',
  );
}

/**
 * Fator para converter quantidade_embarcada/recebida_comercial → *_base.
 */
export function resolveFatorParaGravacaoEmbarque(linhaPedido = {}, it = {}) {
  const fatorAcao = fatorNum(it);
  const fatorPed = fatorNum(linhaPedido);
  const unAcao = unidadeSigla(it);
  const unPed = unidadeSigla(linhaPedido);
  const unidadesDiferentes = Boolean(unAcao && unPed && unAcao !== unPed);

  if (fatorAcao > 0 && (unidadesDiferentes || fatorAcao > 1.001)) {
    return fatorAcao;
  }
  if (fatorPed > 0) return fatorPed;
  return fatorAcao > 0 ? fatorAcao : 1;
}

/** Fator do pedido (linha PCI) — só para quantidade_pedida_* */
export function resolveFatorPedidoCompraLinha(linhaPedido = {}) {
  const f = fatorNum(linhaPedido);
  return f > 0 ? f : 1;
}

export function resolveUnidadeSiglaParaGravacaoEmbarque(linhaPedido = {}, it = {}) {
  const unAcao = unidadeSigla(it);
  if (unAcao) return unAcao;
  const unPed = unidadeSigla(linhaPedido);
  return unPed || 'UN';
}
