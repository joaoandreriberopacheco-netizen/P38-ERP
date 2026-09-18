#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  parseSufixoCodigoEmbarque,
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

console.log('OK — ordenação e sufixos A/B/C validados.');
