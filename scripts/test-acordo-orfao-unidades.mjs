#!/usr/bin/env node
/**
 * Conversão CX ↔ M² no acordo financeiro (órfãos).
 */
import assert from 'node:assert/strict';
import {
  acordoOrfaoComercialParaBase,
  qtyPendenteComercialParaExibicao,
} from '../src/lib/embarqueLogisticaHelpers.js';

const linhaVerona = {
  produto_id: 'x',
  quantidade: 21.6,
  quantidade_base: 54,
  unidade_medida: 'M2',
  fator_conversao: 1,
};

const pend = qtyPendenteComercialParaExibicao({ ...linhaVerona, qtd_pendente: 9 }, null);
assert.equal(pend.unidade, 'CX');
assert.ok(Math.abs(pend.quantidade - 3.6) < 0.01, `pend comercial ${pend.quantidade}`);

const base1cx = acordoOrfaoComercialParaBase(linhaVerona, 1, null);
assert.ok(Math.abs(base1cx - 2.5) < 0.01, `1 CX → ${base1cx} base`);

const linhaNaturale = { quantidade: 32, quantidade_base: 80, unidade_medida: 'M2', fator_conversao: 1 };
assert.ok(Math.abs(acordoOrfaoComercialParaBase(linhaNaturale, 1, null) - 2.5) < 0.01);

console.log('test-acordo-orfao-unidades: ok');
