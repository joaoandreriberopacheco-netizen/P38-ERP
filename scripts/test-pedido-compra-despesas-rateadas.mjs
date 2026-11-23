/**
 * Regras despesas rateadas — pedido de compra (PR #772).
 * node scripts/test-pedido-compra-despesas-rateadas.mjs
 */
import assert from 'node:assert/strict';

import {
  calcValorMercadoriaPedidoCompraBase,
  calcValorTotalPedidoCompra,
  valorFinanceiroLinhaPedido,
} from '../src/lib/pedidoCompraFinanceiro.js';
import {
  aplicarRateioDespesasNosItens,
  acrescimoDespesasRateadasNoTotalPedido,
  outrosUnitarioFator1LinhaPedidoCompra,
  rateioDespesasJaIncorporadoNaLinha,
} from '../src/lib/pedidoCompraDespesasRateadas.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function check(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    return false;
  }
  console.log('OK', label);
  return true;
}

let failed = 0;
let passed = 0;
function run(label, condition) {
  if (!check(label, condition)) failed += 1;
  else passed += 1;
}

/** Linha simples UN×1 — total comercial = qtd × custo (sem frete/outros). */
function linhaSimples({ produto_id, custo, outros = 0, rateio = 0, manual = 0, total }) {
  const outrosF1 = outros || manual + rateio;
  const row = {
    produto_id,
    quantidade: 1,
    quantidade_base: 1,
    fator_conversao: 1,
    custo_unitario: custo,
    custo_unitario_fator1: custo,
    outros_unitario_fator1: outrosF1,
    custo_outros_unitario: outrosF1,
    despesa_rateada_outros_fator1: rateio,
    outros_unitario_fator1_manual: manual,
  };
  if (total != null) {
    row.total = total;
    row.valor_total_item = total;
  }
  return row;
}

// --- Regra 1: mercadoria pura; custo_unitario intacto após rateio ---
const itensBase = [
  linhaSimples({ produto_id: 'p1', custo: 60 }),
  linhaSimples({ produto_id: 'p2', custo: 40 }),
];
const despesas = [{ id: 'd1', descricao: 'Taxa forn.', valor: 10 }];

run('mercadoria base 100 (sem rateio nas linhas)', calcValorMercadoriaPedidoCompraBase({ itens: itensBase }) === 100);

const itensRateados = aplicarRateioDespesasNosItens(itensBase, despesas, {});
run('rateio aplica em 2 linhas', itensRateados.length === 2);
run('custo_unitario p1 permanece 60', Number(itensRateados[0].custo_unitario) === 60);
run('custo_unitario p2 permanece 40', Number(itensRateados[1].custo_unitario) === 40);
run('outros p1 = 6 (60% de 10)', round2(itensRateados[0].outros_unitario_fator1) === 6);
run('outros p2 = 4 (40% de 10)', round2(itensRateados[1].outros_unitario_fator1) === 4);

const mercadoriaAposRateio = calcValorMercadoriaPedidoCompraBase({ itens: itensRateados });
run('mercadoria após rateio ainda 100', mercadoriaAposRateio === 100);

const linhaComOutros = linhaSimples({
  produto_id: 'p3',
  custo: 50,
  manual: 2,
  rateio: 3,
  outros: 5,
  total: round2(50 + 5),
});
run(
  'valorFinanceiroLinha ignora rateio (50)',
  valorFinanceiroLinhaPedido(linhaComOutros) === 50,
);
run(
  'outrosUnitarioFator1Linha = manual+rateio (5)',
  outrosUnitarioFator1LinhaPedidoCompra(linhaComOutros) === 5,
);

// --- Regra 2: total = mercadoria + frete − desconto + despesas ---
const acrescimo = acrescimoDespesasRateadasNoTotalPedido(despesas);
run('acréscimo despesas 10', acrescimo === 10);

const pedidoComForm = {
  itens: itensRateados,
  valor_itens: mercadoriaAposRateio,
  valor_frete: 5,
  valor_desconto: 2,
  despesas_rateadas: despesas,
};
const totalEsperado = round2(100 + 5 - 2 + 10);
run(
  'total pedido fórmula mercadoria+frete−desconto+despesas',
  calcValorTotalPedidoCompra(pedidoComForm) === totalEsperado,
);

// Cenário print: 4259,70 + 102 sem frete/desconto
const pedidoPrint = {
  valor_itens: 4259.7,
  valor_frete: 0,
  valor_desconto: 0,
  despesas_rateadas: [{ descricao: 'Emb.', valor: 102 }],
};
run(
  'cenário print total 4361,70',
  calcValorTotalPedidoCompra(pedidoPrint) === 4361.7,
);

// --- Regra 3: valor financeiro = calcValorTotalPedidoCompra (inclui rateadas) ---
run(
  'valor financeiro sem itens no espelho usa valor_itens + despesas',
  calcValorTotalPedidoCompra({
    valor_itens: 4259.7,
    despesas_rateadas: [{ descricao: 'x', valor: 102 }],
  }) === 4361.7,
);

// Não inflar total somando linhas com outros + header despesas
const pedidoSóHeader = {
  valor_itens: 100,
  despesas_rateadas: despesas,
  itens: itensRateados,
};
run(
  'total com itens+header não duplica despesas (valor_itens prioritário)',
  calcValorTotalPedidoCompra(pedidoSóHeader) === 110,
);

// --- Atualizar preços: outros padrão da linha (manual + rateio) ---
function custoOutrosInicialAtualizarPrecos(item, produtoOutros = 0) {
  const outrosLinhaF1 = outrosUnitarioFator1LinhaPedidoCompra(item);
  return outrosLinhaF1 > 0 ? outrosLinhaF1 : produtoOutros;
}
run(
  'atualizar preços: outros da linha 5',
  custoOutrosInicialAtualizarPrecos(linhaComOutros, 1.5) === 5,
);
run(
  'atualizar preços: fallback cadastro se linha sem outros',
  custoOutrosInicialAtualizarPrecos(linhaSimples({ produto_id: 'z', custo: 10 }), 1.5) === 1.5,
);

// --- Legado: rateio já embutido no custo — não re-ratear ---
const legadoEmbutido = {
  produto_id: 'leg',
  quantidade: 1,
  quantidade_base: 1,
  fator_conversao: 1,
  custo_unitario: 110,
  total: 110,
  valor_total_item: 110,
  outros_unitario_fator1: 0,
  incorpora_despesa_rateada_no_custo: true,
};
run(
  'legado: rateio já no custo → skip re-rateio',
  rateioDespesasJaIncorporadoNaLinha(legadoEmbutido) === true,
);

const itensComLegado = [legadoEmbutido, linhaSimples({ produto_id: 'novo', custo: 100 })];
const posLegado = aplicarRateioDespesasNosItens(itensComLegado, [{ descricao: 'd', valor: 20 }], {});
const linhaLeg = posLegado.find((i) => i.produto_id === 'leg');
const linhaNova = posLegado.find((i) => i.produto_id === 'novo');
run(
  'legado: custo continua 110 após aplicar despesas',
  Number(linhaLeg?.custo_unitario) === 110,
);
run(
  'legado: outros permanece 0 (não re-rateou)',
  Number(linhaLeg?.outros_unitario_fator1 || 0) === 0,
);
run(
  'linha nova absorve rateio inteiro se só ela é elegível',
  round2(linhaNova?.outros_unitario_fator1) === 20,
);

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log(`\nTodos os ${passed} checks passaram.`);
process.exit(0);