/**
 * node scripts/test-normalizar-rascunho-desconto.mjs
 */

import {
  normalizeMirrorItemDescontoLiquido,
  normalizeCanonicalItemDescontoLiquido,
} from '../src/lib/normalizarPedidosCompraRascunhoDesconto.js';

let failed = 0;

const mirror = normalizeMirrorItemDescontoLiquido({
  quantidade: 1,
  fator_conversao: 1,
  custo_unitario: 100,
  valor_desconto_item: 15,
  total: 85,
});

if (!mirror.changed || mirror.item.custo_unitario !== 85 || mirror.item.desconto_unitario !== 0) {
  console.error('FAIL mirror', mirror);
  failed += 1;
} else {
  console.log('OK mirror líquido');
}

const canon = normalizeCanonicalItemDescontoLiquido({
  quantidade_base: 2,
  fator_aplicado: 1,
  custo_unitario_fator1: 100,
  desconto_unitario_fator1: 10,
});

if (!canon.changed || canon.item.custo_unitario_fator1 !== 90 || canon.item.total !== 180) {
  console.error('FAIL canonical', canon);
  failed += 1;
} else {
  console.log('OK canonical líquido');
}

const idempotente = normalizeMirrorItemDescontoLiquido({
  quantidade: 1,
  custo_unitario: 85,
  desconto_unitario: 0,
  total: 85,
});

if (idempotente.changed) {
  console.error('FAIL idempotente');
  failed += 1;
} else {
  console.log('OK idempotente');
}

process.exit(failed > 0 ? 1 : 0);
