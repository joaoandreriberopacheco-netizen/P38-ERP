#!/usr/bin/env node
/**
 * Smoke: valor do card não deve dobrar quando comercial diverge da base (EXC-FQZ).
 * Uso: node scripts/smoke-valor-embarque-card.mjs
 */
import assert from 'node:assert/strict';

const RATIO_DIVERGENCIA_USAR_BASE = 0.15;

const roundToTwoDecimals = (n) => Math.round((Number(n) || 0) * 100) / 100;

function resolveValorProporcional({
  lineTotalFull,
  qtyBasePedido,
  qtyBaseEmbarque,
  qtyComPedido,
  qtyComEmbarque,
  unidadesAlinhadas = true,
}) {
  const ratioBase = qtyBasePedido > 0 && qtyBaseEmbarque > 0
    ? qtyBaseEmbarque / qtyBasePedido
    : null;
  const ratioCom = unidadesAlinhadas && qtyComPedido > 0 && qtyComEmbarque > 0
    ? qtyComEmbarque / qtyComPedido
    : null;

  let ratio = null;
  if (ratioBase != null && ratioCom != null) {
    const maxRatio = Math.max(ratioBase, ratioCom, 0.001);
    const diverge = Math.abs(ratioCom - ratioBase) / maxRatio;
    ratio = diverge > RATIO_DIVERGENCIA_USAR_BASE ? ratioBase : ratioCom;
  } else if (ratioBase != null) {
    ratio = ratioBase;
  } else if (ratioCom != null) {
    ratio = ratioCom;
  }

  if (ratio == null) return lineTotalFull;
  const valor = roundToTwoDecimals(ratio * lineTotalFull);
  return roundToTwoDecimals(Math.min(valor, lineTotalFull));
}

const excFqz = resolveValorProporcional({
  lineTotalFull: 18279.75,
  qtyBasePedido: 462.24,
  qtyBaseEmbarque: 462.24,
  qtyComPedido: 99,
  qtyComEmbarque: 214,
});
assert.ok(excFqz <= 18280 && excFqz >= 18279, `EXC-FQZ esperado ~18.279,75, obteve ${excFqz}`);

const bellaGold = resolveValorProporcional({
  lineTotalFull: 18279.75,
  qtyBasePedido: 67.2,
  qtyBaseEmbarque: 75.6,
  qtyComPedido: 35,
  qtyComEmbarque: 35,
});
assert.ok(bellaGold >= 18279 && bellaGold <= 18280, `BELLA GOLD esperado ~18.279,75, obteve ${bellaGold}`);

console.log('smoke-valor-embarque-card: OK');
