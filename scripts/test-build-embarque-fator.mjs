#!/usr/bin/env node
/**
 * Pedido em M² (fator 1) + despacho em CX (fator 1,68) → base correta.
 */
import assert from 'node:assert/strict';
import { buildItensCanonicosEmbarque } from '../src/lib/buildEmbarqueItensCanonicos.js';

const pedidoItem = {
  id: 'pci-1',
  produto_id: 'p1',
  quantidade: 23.52,
  quantidade_comercial: 23.52,
  quantidade_base: 23.52,
  unidade_medida: 'M2',
  unidade_sigla: 'M2',
  fator_conversao: 1,
  fator_aplicado: 1,
};

const linhaDespacho = {
  produto_id: 'p1',
  quantidade_embarcada_apresentacao: 5,
  unidade_apresentacao: 'CX',
  fator_apresentacao: 1.68,
  produto_unidade_id: 'alt_cx',
};

const [row] = buildItensCanonicosEmbarque([linhaDespacho], [pedidoItem]);
assert.equal(row.fator_aplicado, 1.68);
assert.equal(row.unidade_sigla, 'CX');
assert.equal(row.quantidade_embarcada_comercial, 5);
assert.equal(row.quantidade_embarcada_base, 8.4);
assert.equal(row.quantidade_pedida_base, 23.52);

const pedidoCx = {
  ...pedidoItem,
  quantidade: 14,
  quantidade_comercial: 14,
  quantidade_base: 23.52,
  fator_aplicado: 1.68,
  unidade_sigla: 'CX',
};
const linhaMesmaUm = {
  produto_id: 'p1',
  quantidade_embarcada_apresentacao: 5,
  fator_apresentacao: 1.68,
  unidade_apresentacao: 'CX',
};
const [row2] = buildItensCanonicosEmbarque([linhaMesmaUm], [pedidoCx]);
assert.equal(row2.quantidade_embarcada_base, 8.4);

console.log('OK — fator da ação (CX) vence pedido M² fator 1.');
