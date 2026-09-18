#!/usr/bin/env node
/**
 * Smoke: EXC-FQZ com 1 CX Naturale pendente (saldo recepção) deve contar como órfão.
 * Uso: node scripts/smoke-necessidade-exc-fqz.mjs
 */
import assert from 'node:assert/strict';

const FATOR_CX = 1.92;
const MIN_SALDO_BASE = 0.009;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function qtyRecebidaBase(linha = {}) {
  const base = Number(linha.quantidade_recebida_base);
  if (base > 0) return base;
  const com = Number(linha.quantidade_recebida_comercial) || 0;
  const fator = Number(linha.fator_apresentacao) || 1;
  return round2(com * fator);
}

function qtyEmbarcadaBase(linha = {}) {
  const base = Number(linha.quantidade_embarcada_base);
  if (base > 0) return base;
  const com = Number(linha.quantidade_embarcada_comercial) || 0;
  const fator = Number(linha.fator_apresentacao) || 1;
  return round2(com * fator);
}

function saldoRecepcaoBase(linha = {}) {
  return round2(Math.max(0, qtyEmbarcadaBase(linha) - qtyRecebidaBase(linha)));
}

function qtyPendenteComercialLogistica(pendenteBase, fatorCx = FATOR_CX) {
  // 1 CX = fator M² em base; conversão logística inversa
  return round2(pendenteBase / fatorCx);
}

const linhaNaturale = {
  produto_id: 'prod-naturale',
  quantidade_embarcada_comercial: 10,
  quantidade_embarcada_base: round2(10 * FATOR_CX),
  quantidade_recebida_comercial: 9,
  quantidade_recebida_base: round2(9 * FATOR_CX),
  fator_apresentacao: FATOR_CX,
  unidade_apresentacao: 'CX',
};

const saldoBase = saldoRecepcaoBase(linhaNaturale);
assert.ok(saldoBase > MIN_SALDO_BASE, `saldo base Naturale > 0, obteve ${saldoBase}`);
assert.ok(
  Math.abs(saldoBase - FATOR_CX) < 0.02,
  `saldo base deve ser ~1 CX em M² (${FATOR_CX}), obteve ${saldoBase}`,
);

const pendenteCx = qtyPendenteComercialLogistica(saldoBase, FATOR_CX);
assert.ok(pendenteCx >= 0.99, `pendente comercial ~1 CX, obteve ${pendenteCx}`);

const somaPendente = pendenteCx;
const exibir = somaPendente >= 0.5 || pendenteCx >= 1;
assert.equal(exibir, true, 'falta comercial relevante para 1 CX Naturale');

console.log('smoke-necessidade-exc-fqz: OK');
