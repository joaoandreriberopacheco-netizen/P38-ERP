import assert from 'node:assert/strict';
import {
  escalarComponentesCustoMargemParaTotal,
  resolveCustoComponentesUnitBaseMargem,
} from '../src/lib/relatorioMargemCalculos.js';
import { MARGEM_CUSTO_MOMENTO_VENDA } from '../src/lib/margemCustoMode.js';

const product = {
  valor_compra: 100,
  desconto_compra_padrao: 0,
  custo_frete_padrao: 10,
  custo_imposto1_padrao: 5,
  custo_avaria: 0,
  preco_custo_calculado: 115,
};

const item = { custo_unitario_momento: 115 };

const componentes = resolveCustoComponentesUnitBaseMargem(product, item, {
  costMode: MARGEM_CUSTO_MOMENTO_VENDA,
});

assert.equal(componentes.valor_compra, 100);
assert.equal(componentes.custo_frete, 10);
assert.equal(componentes.custo_imposto1, 5);

const scaled = escalarComponentesCustoMargemParaTotal(
  { valor_compra: 80, custo_frete: 20, custo_avaria: 0, custo_imposto1: 0, custo_imposto2: 0, custo_outros: 0 },
  100,
);
assert.equal(scaled.valor_compra + scaled.custo_frete, 100);

console.log('test-margem-custo-componentes: ok');
