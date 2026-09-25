/**
 * Self-check: critério de orçamento na listagem SQL (sem BD).
 */
import {
  isOrcamentoPedidoVendaRow,
  isPedidoOrcamento,
} from '../src/lib/pedidoVendaEligibility.js';

const cases = [
  [{ tipo: 'Orcamento', status: 'Rascunho' }, true],
  [{ tipo: 'PDV', status: 'Orçamento' }, true],
  [{ tipo: null, status: null, dados: { tipo: 'Orçamento' } }, true],
  [{ tipo: 'PDV', status: 'Faturado', dados: { origem: 'orcamento_rapido' } }, true],
  [{ tipo: 'PDV', status: 'Faturado' }, false],
];

let failed = 0;
for (const [row, expected] of cases) {
  const got = isOrcamentoPedidoVendaRow(row);
  if (got !== expected) {
    console.error('FAIL', row, 'expected', expected, 'got', got);
    failed += 1;
  }
}

if (!isPedidoOrcamento({ tipo: 'orcamento', status: 'x' })) {
  console.error('FAIL isPedidoOrcamento orcamento tipo');
  failed += 1;
}

if (failed > 0) {
  process.exit(1);
}
console.log('orcamento-salvos-filter-selfcheck: ok');
