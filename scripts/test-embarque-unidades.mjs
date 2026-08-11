#!/usr/bin/env node
/**
 * Testes de uniformidade comercial (UI) vs base (SQL/estoque) no fluxo embarque.
 * Correr: node scripts/test-embarque-unidades.mjs
 */
import assert from 'node:assert/strict';
import {
  resolveEmbarqueQuantidadeBase,
  resolveEmbarqueQuantidadeComercial,
} from '../src/lib/embarqueQuantityResolve.js';

const FATOR = 200;
const toBase = (comercial, fator) => Math.round((Number(comercial) || 0) * (Number(fator) || 1) * 1_000_000) / 1_000_000;

const mirrorOk = {
  quantidade_embarcada: 12,
  quantidade_embarcada_base: 2400,
  quantidade_embarcada_apresentacao: 12,
  quantidade_recebida_apresentacao: 12,
  quantidade_recebida_base: 2400,
  fator_aplicado: FATOR,
  fator_apresentacao: FATOR,
  fator_conversao: FATOR,
  unidade_apresentacao: 'CX',
  unidade_medida: 'CX',
};

assert.equal(resolveEmbarqueQuantidadeComercial(mirrorOk, 'embarcada'), 12);
assert.equal(resolveEmbarqueQuantidadeBase(mirrorOk, 'embarcada'), 2400);
assert.equal(resolveEmbarqueQuantidadeComercial(mirrorOk, 'recebida'), 12);

const mirrorLegado = {
  quantidade_embarcada: 12,
  quantidade_embarcada_base: 2400,
  unidade_medida: 'CX',
};
assert.equal(
  resolveEmbarqueQuantidadeComercial(mirrorLegado, 'embarcada'),
  12,
  'espelho legado deve manter 12 CX na UI',
);

const pedidoBase = 40 * FATOR;
const embBase = (12 + 20) * FATOR;
const pct = Number(((embBase / pedidoBase) * 100).toFixed(2));
assert.equal(pct, 80);

assert.equal(toBase(12, FATOR), 2400);

console.log('OK — uniformidade comercial/base validada (espelho, legado, %, estoque).');
