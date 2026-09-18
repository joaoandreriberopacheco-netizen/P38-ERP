#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  parseSufixoCodigoEmbarque,
  resolveEmbarqueCodigoExibicao,
  sortEmbarquesParaExibicao,
  proximaLetraEmbarquePedido,
} from '../src/lib/embarqueDisplayUtils.js';

const pedido = { numero: 'AB6-PPQ' };
const embA = {
  id: 'a',
  tipo: 'Embarque',
  data_embarque: '2026-09-08',
  created_at: '2026-09-03T16:24:49Z',
  dados: { codigo_exibicao: 'AB6-PPQ-A' },
};
const embB = {
  id: 'b',
  tipo: 'Embarque',
  data_embarque: '2026-09-15',
  created_at: '2026-09-18T20:22:44Z',
  dados: { codigo_exibicao: 'AB6-PPQ-B' },
};
const embC = {
  id: 'c',
  tipo: 'Necessidade',
  created_at: '2026-09-18T20:24:59Z',
  dados: { codigo_exibicao: 'AB6-PPQ-C' },
};

const ordenados = sortEmbarquesParaExibicao([embB, embC, embA], pedido);
assert.deepEqual(ordenados.map((e) => e.id), ['a', 'b', 'c'], 'ordem A → B → C');
assert.equal(parseSufixoCodigoEmbarque(embC, { ...pedido, _embarques: ordenados }), 'C');
assert.equal(proximaLetraEmbarquePedido(ordenados, pedido), 'D');

const pedidoExc = { numero: 'EXC-FQZ' };
const embRealA = {
  id: 'real-a',
  tipo: 'Embarque',
  data_embarque: '2026-08-01',
  created_at: '2026-08-01T10:00:00Z',
  dados: { codigo_exibicao: 'EXC-FQZ-A' },
};
const embNecErrado = {
  id: 'nec-b',
  tipo: 'Necessidade',
  created_at: '2026-08-04T12:00:00Z',
  dados: { codigo_exibicao: 'EXC-FQZ-A' },
};
const ctxExc = { ...pedidoExc, _embarques: [embRealA, embNecErrado] };
assert.equal(
  resolveEmbarqueCodigoExibicao(ctxExc, embNecErrado),
  'EXC-FQZ-B',
  'necessidade posterior não deve herdar A gravado errado',
);
assert.equal(parseSufixoCodigoEmbarque(embRealA, ctxExc), 'A');
assert.equal(parseSufixoCodigoEmbarque(embNecErrado, ctxExc), 'B');

console.log('OK — ordenação e sufixos A/B/C validados.');
