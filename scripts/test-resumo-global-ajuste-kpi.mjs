#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveKpiFisicoResumoGlobal, RESUMO_GLOBAL_DESCONTO_KPI_FISICO_RS } from '../src/lib/relatorioEstoqueGlobalPdf/resumoGlobalAjusteKpi.js';

assert.equal(RESUMO_GLOBAL_DESCONTO_KPI_FISICO_RS, 18100);
const k = resolveKpiFisicoResumoGlobal(348336);
assert.equal(k.integral, 348336);
assert.equal(k.descontoAplicado, 18100);
assert.equal(k.exibido, 348336 - 18100);
console.log('test-resumo-global-ajuste-kpi: ok');
