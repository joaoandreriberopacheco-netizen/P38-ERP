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
import { calcularSaldoEmbarquePorLinha } from '../src/lib/pedidoCompraSaldoEmbarque.js';

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

/** Cenário Tintão: pedido M², embarque CX com fator em dados (migration 106). */
const pedidoSqf = {
  id: 'p1',
  numero: 'SQF-TEST',
  itens: [{
    id: 'i1',
    produto_id: 'prod1',
    produto_nome: 'PISO TEST (2,02 M²/CX)',
    quantidade_comercial: 60.6,
    quantidade_base: 60.6,
    fator_aplicado: 1,
    unidade_sigla: 'M2',
  }],
};

const embarqueCx = {
  tipo: 'Embarque',
  _linhas: [{
    produto_id: 'prod1',
    quantidade_embarcada_comercial: 30,
    quantidade_recebida_comercial: 30,
    quantidade_embarcada_base: 60.6,
    quantidade_recebida_base: 60.6,
    fator_aplicado: 2.02,
    unidade_sigla: 'CX',
  }],
};

const linhas = calcularSaldoEmbarquePorLinha(pedidoSqf, [embarqueCx]);
assert.equal(linhas[0].falta_operacional_base, 0, 'Windsor-like: 30 CX = 60.6 M², saldo 0');
assert.ok(linhas[0].falta_operacional <= 0.009, 'vitrine também zero');

console.log('OK — uniformidade comercial/base validada (espelho, legado, %, estoque, saldo CX→M²).');
