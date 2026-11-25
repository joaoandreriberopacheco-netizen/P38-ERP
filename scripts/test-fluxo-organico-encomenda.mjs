import assert from 'node:assert/strict';
import { alocarVendasEncomenda } from '../src/lib/relatorioFluxoOrganicoEncomenda/computeFluxoOrganicoEncomenda.js';
import { normalizarCompetenciaRelatorioMes } from '../src/lib/comprasRelatorioPedidos.js';

assert.equal(normalizarCompetenciaRelatorioMes('2026-10'), '2026-10');
assert.equal(normalizarCompetenciaRelatorioMes('invalid'), normalizarCompetenciaRelatorioMes());

const slots = [
  { produtoId: 'p1', qtyEncomenda: 10, qtyAlocada: 0 },
  { produtoId: 'p1', qtyEncomenda: 5, qtyAlocada: 0 },
  { produtoId: 'p2', qtyEncomenda: 3, qtyAlocada: 0 },
];

const { linhas, vendasOrganicas } = alocarVendasEncomenda(slots, { p1: 12, p2: 1, p3: 4 });

assert.equal(linhas[0].qtyAlocada, 10);
assert.equal(linhas[1].qtyAlocada, 2);
assert.equal(linhas[2].qtyAlocada, 1);
assert.equal(vendasOrganicas.p3, 4);
assert.equal(vendasOrganicas.p1, undefined);

console.log('test-fluxo-organico-encomenda: ok');
